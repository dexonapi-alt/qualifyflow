from datetime import timedelta
import json

import pyotp
from sqlalchemy import select, func

from app.models import (
    Tenant,
    Branch,
    User,
    Membership,
    OperatorAssignment,
    Invitation,
    Outbox,
    ProviderConnection,
    now,
)
from app.audit.service import record
from app.shared.authorization import authorize, provisioning, allow_write
from app.shared.errors import DomainError, conflict
from app.shared.security import token, digest, encrypt, passwords


def lock_tenant(db, actor, tenant_id, capability):
    scope = authorize(db, actor, tenant_id, capability)
    tenant = db.scalar(
        select(Tenant)
        .where(Tenant.id == scope.tenant.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    # Recheck grants after any wait for a concurrent tenant administration command.
    authorize(db, actor, tenant_id, capability)
    return tenant


def branch_check(db, tenant_id, branch_id):
    if branch_id and not db.scalar(
        select(Branch).where(
            Branch.id == str(branch_id), Branch.tenant_id == tenant_id, Branch.status == "active"
        )
    ):
        raise DomainError(
            "VALIDATION_FAILED",
            "Select an active branch in this company.",
            422,
            {"branch_id": "Branch is unavailable in this company."},
        )


def create_company(db, actor, data, cid):
    provisioning(actor)
    tenant = Tenant(**data.model_dump(mode="python"))
    db.add(tenant)
    db.flush()
    record(db, actor, tenant.id, "tenant.created", tenant.id, cid, status="draft")
    return tenant


def configure(db, actor, tid, data, cid):
    tenant = lock_tenant(db, actor, tid, "company:manage")
    if tenant.version != data.version:
        conflict()
    if tenant.status not in {"draft", "configuring", "ready_for_review"}:
        raise DomainError(
            "STATE_TRANSITION_DENIED", "Configuration changes require an onboarding company.", 409
        )
    if tenant.mode == "self_service" and (data.intake_owner != "client" or data.review_owner != "client"):
        raise DomainError("VALIDATION_FAILED", "Self-service tasks must be owned by client staff.", 422)
    if tenant.mode == "managed" and (data.intake_owner != "service" or data.review_owner != "service"):
        raise DomainError("VALIDATION_FAILED", "Managed routine tasks must be owned by service staff.", 422)
    old = tenant.status
    previous_configuration = tenant.configuration
    tenant.configuration = data.model_dump(exclude={"version", "reason"})
    tenant.status, tenant.version = "configuring", tenant.version + 1
    record(
        db,
        actor,
        tid,
        "tenant.configured",
        tid,
        cid,
        before=old,
        previous_configuration=previous_configuration,
        configuration=tenant.configuration,
        after=tenant.status,
        version=tenant.version,
        reason=data.reason,
        policy_reference=data.policy_reference,
    )
    return tenant


def readiness(db, tenant):
    missing = []
    if not tenant.configuration.get("policy_reference"):
        missing.append("Record the approved responsibility and communication policy reference.")
    if tenant.configuration.get("integration_required"):
        verified = db.scalar(
            select(ProviderConnection.id)
            .join(User, User.id == ProviderConnection.owner_id)
            .join(
                Membership,
                (Membership.user_id == User.id) & (Membership.tenant_id == ProviderConnection.tenant_id),
            )
            .where(
                ProviderConnection.tenant_id == tenant.id,
                ProviderConnection.state == "sandbox_verified",
                ProviderConnection.verified_credential_version == ProviderConnection.credential_version,
                User.status == "active",
                Membership.status == "active",
                Membership.role == "client_admin",
                Membership.branch_id.is_(None),
            )
            .limit(1)
        )
        if not verified:
            missing.append(
                "Required sandbox connection must pass a current authenticated test under active employer authorization."
            )
    admins = db.scalar(
        select(func.count())
        .select_from(Membership)
        .join(User)
        .where(
            Membership.tenant_id == tenant.id,
            Membership.role == "client_admin",
            Membership.branch_id.is_(None),
            Membership.status == "active",
            User.status == "active",
            User.totp_secret.is_not(None),
        )
    )
    if not admins:
        missing.append("An invited company administrator must accept and enable MFA.")
    if tenant.mode in {"managed", "hybrid"}:
        staff = db.scalar(
            select(func.count())
            .select_from(OperatorAssignment)
            .join(User)
            .where(
                OperatorAssignment.tenant_id == tenant.id,
                OperatorAssignment.status == "active",
                OperatorAssignment.branch_id.is_(None),
                OperatorAssignment.starts_at <= now(),
                (OperatorAssignment.ends_at.is_(None) | (OperatorAssignment.ends_at > now())),
                User.status == "active",
                User.platform_role == "specialist",
            )
        )
        if not staff:
            missing.append("Assign an active company-wide managed-service specialist.")
    return missing


def transition(db, actor, tid, command, data, cid):
    tenant = lock_tenant(db, actor, tid, "company:manage")
    if tenant.version != data.version:
        conflict()
    destinations = {
        "review": ({"configuring"}, "ready_for_review"),
        "activate": ({"ready_for_review", "suspended"}, "active"),
        "suspend": ({"active"}, "suspended"),
    }
    allowed, destination = destinations[command]
    if tenant.status not in allowed:
        raise DomainError(
            "STATE_TRANSITION_DENIED", "This transition is unavailable in the current state.", 409
        )
    missing = readiness(db, tenant) if command in {"review", "activate"} else []
    if missing:
        raise DomainError("ONBOARDING_INCOMPLETE", " ".join(missing), 409)
    before = tenant.status
    tenant.status, tenant.version = destination, tenant.version + 1
    record(
        db,
        actor,
        tid,
        f"tenant.{command}",
        tid,
        cid,
        before=before,
        after=destination,
        reason=data.reason,
        version=tenant.version,
    )
    return tenant


def add_branch(db, actor, tid, data, cid):
    tenant = lock_tenant(db, actor, tid, "branches:manage")
    allow_write(tenant)
    branch = Branch(tenant_id=tid, **data.model_dump())
    db.add(branch)
    db.flush()
    record(db, actor, tid, "branch.created", branch.id, cid)
    return branch


def invite(db, actor, tid, data, cid):
    tenant = lock_tenant(db, actor, tid, "users:manage")
    allow_write(tenant)
    branch_check(db, tid, data.branch_id)
    email = str(data.email).lower()
    if db.scalar(
        select(Invitation).where(
            Invitation.tenant_id == tid,
            Invitation.email == email,
            Invitation.status.in_(["queued", "sent", "send_failed"]),
            Invitation.expires_at > now(),
        )
    ):
        raise DomainError("CONFLICT", "A pending invitation already exists. Revoke or resend it.", 409)
    user = db.scalar(select(User).where(User.email == email))
    if user and db.scalar(
        select(Membership).where(Membership.tenant_id == tid, Membership.user_id == user.id)
    ):
        raise DomainError(
            "CONFLICT", "This account already has membership history. Manage its existing grant.", 409
        )
    raw = token()
    invitation = Invitation(
        tenant_id=tid,
        email=email,
        role=data.role,
        branch_id=str(data.branch_id) if data.branch_id else None,
        token_hash=digest(raw),
        expires_at=now() + timedelta(hours=48),
        created_by=actor.id,
    )
    db.add(invitation)
    db.flush()
    queue_invite(db, invitation, raw)
    record(db, actor, tid, "user.invited", invitation.id, cid, role=data.role, branch_id=invitation.branch_id)
    return invitation


def queue_invite(db, invitation, raw):
    db.add(
        Outbox(
            tenant_id=invitation.tenant_id,
            invitation_id=invitation.id,
            encrypted_payload=encrypt(json.dumps({"token": raw})),
        )
    )


def invitation_action(db, actor, tid, iid, action, data, cid):
    tenant = lock_tenant(db, actor, tid, "users:manage")
    allow_write(tenant)
    item = db.scalar(
        select(Invitation).where(Invitation.id == iid, Invitation.tenant_id == tid).with_for_update()
    )
    if not item:
        raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
    if item.role == "driver":
        raise DomainError("FORBIDDEN", "Manage this invitation from the driver profile.", 403)
    if item.version != data.version:
        conflict()
    if item.status in {"accepted", "revoked"}:
        raise DomainError("STATE_TRANSITION_DENIED", "Invitation can no longer be changed.", 409)
    for outbox in db.scalars(select(Outbox).where(Outbox.invitation_id == iid, Outbox.status != "sent")):
        outbox.status, outbox.encrypted_payload = "canceled", None
    if action == "revoke":
        item.status = "revoked"
    else:
        raw = token()
        item.token_hash, item.expires_at, item.status = digest(raw), now() + timedelta(hours=48), "queued"
        queue_invite(db, item, raw)
    item.version += 1
    record(db, actor, tid, f"invitation.{action}", iid, cid, reason=data.reason)
    return item


def accept(db, data, current_actor, cid):
    candidate = db.scalar(select(Invitation).where(Invitation.token_hash == digest(data.token)))
    if not candidate:
        raise DomainError("INVITATION_UNAVAILABLE", "Invitation expired, revoked, used or unavailable.", 400)
    tenant = db.scalar(select(Tenant).where(Tenant.id == candidate.tenant_id).with_for_update())
    item = db.scalar(
        select(Invitation)
        .where(Invitation.id == candidate.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not item or item.status not in {"queued", "sent", "send_failed"} or item.expires_at <= now():
        raise DomainError("INVITATION_UNAVAILABLE", "Invitation expired, revoked, used or unavailable.", 400)
    allow_write(tenant)
    branch_check(db, item.tenant_id, item.branch_id)
    if item.role == "driver":
        from app.driver_portal.service import accept_driver
        return accept_driver(db, item, data, current_actor, cid)
    actor = db.scalar(select(User).where(User.email == item.email).with_for_update())
    if actor:
        if not current_actor or actor.id != current_actor.id or actor.status != "active":
            raise DomainError("SIGN_IN_REQUIRED", "Sign in as the invited account before accepting.", 401)
        if item.role == "client_admin" and not actor.totp_secret:
            raise DomainError("MFA_REQUIRED", "Administrator accounts require MFA enrollment.", 409)
    else:
        if not data.password:
            raise DomainError("VALIDATION_FAILED", "Set a password with at least 12 characters.", 422)
        secret = None
        if item.role == "client_admin":
            if (
                not data.totp_secret
                or not data.code
                or not pyotp.TOTP(data.totp_secret).verify(data.code, valid_window=1)
            ):
                raise DomainError(
                    "MFA_REQUIRED", "Confirm an authenticator code to activate administrator access.", 422
                )
            secret = encrypt(data.totp_secret)
        actor = User(email=item.email, password_hash=passwords.hash(data.password), totp_secret=secret)
        db.add(actor)
        db.flush()
    if db.scalar(
        select(Membership).where(Membership.tenant_id == item.tenant_id, Membership.user_id == actor.id)
    ):
        raise DomainError("CONFLICT", "Membership already exists.", 409)
    member = Membership(tenant_id=item.tenant_id, user_id=actor.id, role=item.role, branch_id=item.branch_id)
    db.add(member)
    item.status, item.version = "accepted", item.version + 1
    for outbox in db.scalars(select(Outbox).where(Outbox.invitation_id == item.id, Outbox.status != "sent")):
        outbox.status, outbox.encrypted_payload = "canceled", None
    db.flush()
    record(
        db,
        actor,
        item.tenant_id,
        "invitation.accepted",
        member.id,
        cid,
        invitation_id=item.id,
        role=member.role,
        branch_id=member.branch_id,
    )
    return {"status": "accepted", "message": "Account access activated. Sign in to continue."}


def assign(db, actor, tid, data, cid):
    tenant = lock_tenant(db, actor, tid, "assignments:manage")
    allow_write(tenant)
    branch_check(db, tid, data.branch_id)
    staff = db.get(User, str(data.user_id))
    if not staff or staff.platform_role != "specialist" or staff.status != "active" or not staff.totp_secret:
        raise DomainError("VALIDATION_FAILED", "Select an active, MFA-enabled service specialist.", 422)
    if db.scalar(
        select(OperatorAssignment).where(
            OperatorAssignment.tenant_id == tid, OperatorAssignment.user_id == staff.id
        )
    ):
        raise DomainError("CONFLICT", "Assignment already exists; manage its current grant.", 409)
    item = OperatorAssignment(
        tenant_id=tid, user_id=staff.id, branch_id=str(data.branch_id) if data.branch_id else None
    )
    db.add(item)
    db.flush()
    record(
        db,
        actor,
        tid,
        "operator.assigned",
        item.id,
        cid,
        reason=data.reason,
        user_id=staff.id,
        branch_id=item.branch_id,
    )
    return item


def end_assignment(db, actor, tid, aid, data, cid):
    lock_tenant(db, actor, tid, "assignments:manage")
    item = db.scalar(
        select(OperatorAssignment)
        .where(OperatorAssignment.id == aid, OperatorAssignment.tenant_id == tid)
        .with_for_update()
    )
    if not item:
        raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
    if item.version != data.version:
        conflict()
    if item.status != "active":
        raise DomainError("STATE_TRANSITION_DENIED", "Assignment has already ended.", 409)
    item.status, item.ends_at, item.version = "ended", now(), item.version + 1
    record(db, actor, tid, "operator.assignment_ended", aid, cid, reason=data.reason)
    return item


def change_member(db, actor, tid, mid, data, cid):
    lock_tenant(db, actor, tid, "users:manage")
    member = db.scalar(
        select(Membership).where(Membership.id == mid, Membership.tenant_id == tid).with_for_update()
    )
    if not member:
        raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
    if member.version != data.version:
        conflict()
    if member.user_id == actor.id:
        raise DomainError("FORBIDDEN", "Another administrator must change your access.", 403)
    if member.status != "active":
        raise DomainError("STATE_TRANSITION_DENIED", "Membership is not active.", 409)
    if member.role == "client_admin" and member.branch_id is None:
        count = db.scalar(
            select(func.count())
            .select_from(Membership)
            .join(User)
            .where(
                Membership.tenant_id == tid,
                Membership.role == "client_admin",
                Membership.branch_id.is_(None),
                Membership.status == "active",
                User.status == "active",
                User.totp_secret.is_not(None),
            )
        )
        if count <= 1 and (data.action == "revoke" or data.role != "client_admin"):
            raise DomainError(
                "LAST_ADMIN", "Keep another active company administrator before this change.", 409
            )
    before = {"role": member.role, "status": member.status}
    if data.action == "revoke":
        member.status = "revoked"
    else:
        if not data.role:
            raise DomainError("VALIDATION_FAILED", "Select a role.", 422)
        if data.role == "client_admin" and not db.get(User, member.user_id).totp_secret:
            raise DomainError("MFA_REQUIRED", "Enroll MFA before granting administrator authority.", 409)
        member.role = data.role
    member.version += 1
    record(
        db,
        actor,
        tid,
        f"membership.{data.action}",
        mid,
        cid,
        before=before,
        after={"role": member.role, "status": member.status},
        reason=data.reason,
    )
    return member
