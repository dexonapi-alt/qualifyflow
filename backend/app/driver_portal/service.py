from datetime import timedelta
from sqlalchemy import select, exists
from app.models import (
    DriverPortalAccess,
    DriverEngagement,
    DriverIdentity,
    DriverRequirement,
    RequirementDefinition,
    EvidenceVersion,
    User,
    Membership,
    OperatorAssignment,
    Invitation,
    Outbox,
    now,
)
from app.shared.security import token, digest, encrypt, decrypt, passwords
from app.shared.errors import DomainError, conflict
from app.shared.authorization import authorize, allow_write
from app.drivers.service import identity
from app.organizations.service import queue_invite
from app.audit.service import record
from app.documents.state import requirement_state
from app.driver_portal.security import personal_access
from app.driver_portal.requests import latest_request


def user_payload(db, actor):
    return {
        "id": actor.id,
        "email": actor.email,
        "platform_role": actor.platform_role,
        "driver_portal": bool(db.scalar(select(exists().where(DriverPortalAccess.user_id == actor.id)))),
        "company_access": bool(
            actor.platform_role
            or db.scalar(
                select(exists().where(Membership.user_id == actor.id, Membership.status == "active"))
            )
            or db.scalar(
                select(
                    exists().where(
                        OperatorAssignment.user_id == actor.id, OperatorAssignment.status == "active"
                    )
                )
            )
        ),
    }


def staff_access(db, actor, tid, did, *, manage=False):
    scope, driver = identity(db, actor, tid, did, "drivers:write", lock=manage)
    if manage:
        authorize(db, actor, tid, "users:manage")
    return scope, driver


def staff_data(db, actor, tid, did):
    staff_access(db, actor, tid, did)
    rows = db.scalars(
        select(DriverPortalAccess)
        .where(DriverPortalAccess.tenant_id == tid, DriverPortalAccess.driver_id == did)
        .order_by(DriverPortalAccess.id)
    )
    return {
        "items": [
            {
                "id": g.id,
                "engagement_id": g.engagement_id,
                "status": g.status,
                "version": g.version,
                "email": db.get(Invitation, g.id).email,
                "invitation_status": db.get(Invitation, g.id).status,
                "expires_at": db.get(Invitation, g.id).expires_at,
            }
            for g in rows
        ]
    }


def invite_driver(db, actor, tid, did, data, cid):
    scope, _ = staff_access(db, actor, tid, did, manage=True)
    allow_write(scope.tenant)
    engagement = db.scalar(
        select(DriverEngagement).where(
            DriverEngagement.id == str(data.engagement_id),
            DriverEngagement.tenant_id == tid,
            DriverEngagement.driver_id == did,
        )
    )
    if (
        not engagement
        or engagement.end_date
        or engagement.status not in {"engagement_draft", "onboarding", "active"}
    ):
        raise DomainError("NOT_FOUND", "Select a current driver engagement.", 404)
    prior = db.scalar(
        select(DriverPortalAccess)
        .where(
            DriverPortalAccess.engagement_id == engagement.id,
            DriverPortalAccess.status.in_(["invited", "active"]),
        )
        .with_for_update()
    )
    if prior:
        invitation = db.get(Invitation, prior.id)
        if prior.status == "invited" and invitation.expires_at <= now():
            prior.status, prior.version = "revoked", prior.version + 1
            invitation.status, invitation.version = "revoked", invitation.version + 1
            for outbox in db.scalars(
                select(Outbox).where(Outbox.invitation_id == prior.id, Outbox.status != "sent")
            ):
                outbox.status, outbox.encrypted_payload = "canceled", None
            record(db, actor, tid, "driver.portal_invitation_expired", prior.id, cid)
            db.flush()
        else:
            raise DomainError(
                "CONFLICT",
                "This engagement already has driver access or a pending invitation. Revoke it before inviting again.",
                409,
            )
    raw = token()
    invitation = Invitation(
        tenant_id=tid,
        email=str(data.email).lower(),
        role="driver",
        branch_id=engagement.branch_id,
        token_hash=digest(raw),
        expires_at=now() + timedelta(hours=48),
        created_by=actor.id,
    )
    db.add(invitation)
    db.flush()
    grant = DriverPortalAccess(id=invitation.id, tenant_id=tid, driver_id=did, engagement_id=engagement.id)
    db.add(grant)
    queue_invite(db, invitation, raw)
    record(db, actor, tid, "driver.portal_invited", grant.id, cid, driver_id=did, engagement_id=engagement.id)
    db.flush()
    return {"id": grant.id, "status": "invited"}


def revoke(db, actor, tid, did, gid, data, cid):
    staff_access(db, actor, tid, did, manage=True)
    invitation = db.scalar(select(Invitation).where(Invitation.id == gid).with_for_update())
    grant = db.scalar(
        select(DriverPortalAccess)
        .where(
            DriverPortalAccess.id == gid,
            DriverPortalAccess.tenant_id == tid,
            DriverPortalAccess.driver_id == did,
        )
        .with_for_update()
    )
    if not grant:
        raise DomainError("NOT_FOUND", "Driver access unavailable.", 404)
    if grant.version != data.version:
        conflict()
    grant.status, grant.version = "revoked", grant.version + 1
    if invitation.status != "accepted":
        invitation.status, invitation.version = "revoked", invitation.version + 1
    for row in db.scalars(select(Outbox).where(Outbox.invitation_id == gid, Outbox.status != "sent")):
        row.status, row.encrypted_payload = "canceled", None
    record(db, actor, tid, "driver.portal_access_revoked", gid, cid, reason=data.reason)
    return {"status": "revoked"}


def accept_driver(db, item, data, current_actor, cid):
    grant = db.scalar(select(DriverPortalAccess).where(DriverPortalAccess.id == item.id).with_for_update())
    engagement = db.get(DriverEngagement, grant.engagement_id) if grant else None
    if (
        not grant
        or grant.status != "invited"
        or not engagement
        or engagement.end_date
        or engagement.status not in {"engagement_draft", "onboarding", "active"}
    ):
        raise DomainError("INVITATION_UNAVAILABLE", "Driver invitation is no longer available.", 400)
    actor = db.scalar(select(User).where(User.email == item.email).with_for_update())
    if actor:
        if not current_actor or actor.id != current_actor.id or actor.status != "active":
            raise DomainError("SIGN_IN_REQUIRED", "Sign in as the invited account before accepting.", 401)
    else:
        if not data.password:
            raise DomainError("VALIDATION_FAILED", "Set a password with at least 12 characters.", 422)
        # Optional enrollment must be verified, just as existing privileged enrollment is.
        secret = None
        if data.totp_secret:
            import pyotp

            if not data.code or not pyotp.TOTP(data.totp_secret).verify(data.code, valid_window=1):
                raise DomainError("MFA_REQUIRED", "Confirm the authenticator code.", 422)
            secret = encrypt(data.totp_secret)
        actor = User(email=item.email, password_hash=passwords.hash(data.password), totp_secret=secret)
        db.add(actor)
        db.flush()
    grant.user_id, grant.status, grant.version = actor.id, "active", grant.version + 1
    item.status, item.version = "accepted", item.version + 1
    for row in db.scalars(select(Outbox).where(Outbox.invitation_id == item.id, Outbox.status != "sent")):
        row.status, row.encrypted_payload = "canceled", None
    record(
        db,
        actor,
        grant.tenant_id,
        "driver.portal_invitation_accepted",
        grant.id,
        cid,
        engagement_id=grant.engagement_id,
    )
    return {"status": "accepted", "message": "Your personal onboarding access is ready. Sign in to continue."}


def list_onboarding(db, actor):
    result = []
    for grant in db.scalars(
        select(DriverPortalAccess).where(
            DriverPortalAccess.user_id == actor.id, DriverPortalAccess.status == "active"
        )
    ):
        try:
            _, engagement, tenant = personal_access(db, actor, grant.engagement_id)
        except DomainError:
            continue
        driver = db.get(DriverIdentity, grant.driver_id)
        result.append(
            {
                "engagement_id": engagement.id,
                "company": tenant.display_name,
                "name": f"{driver.first_name} {driver.last_name}",
                "reference": driver.reference,
            }
        )
    return {"items": result}


def onboarding(db, actor, eid):
    grant, engagement, tenant = personal_access(db, actor, eid)
    driver = db.get(DriverIdentity, grant.driver_id)
    items = []
    for req, definition in db.execute(
        select(DriverRequirement, RequirementDefinition)
        .join(RequirementDefinition, RequirementDefinition.id == DriverRequirement.definition_id)
        .where(DriverRequirement.tenant_id == tenant.id, DriverRequirement.engagement_id == eid)
        .order_by(DriverRequirement.created_at)
    ):
        shared = latest_request(db, req.id)
        if not shared or not shared.visible:
            continue
        # No staff evidence filenames, internal findings, policy basis, actor emails or raw reports.
        submissions = db.scalars(
            select(EvidenceVersion)
            .where(
                EvidenceVersion.tenant_id == tenant.id,
                EvidenceVersion.requirement_id == req.id,
                EvidenceVersion.actor_id == actor.id,
            )
            .order_by(EvidenceVersion.revision.desc())
        )
        items.append(
            {
                "id": req.id,
                "title": definition.title,
                "instructions": decrypt(shared.encrypted_instructions),
                "status": requirement_state(db, req.id, tenant.timezone),
                "submissions": [
                    {
                        "id": e.id,
                        "filename": decrypt(e.encrypted_filename),
                        "revision": e.revision,
                        "status": e.status,
                        "uploaded_at": e.uploaded_at,
                        "can_download": bool(
                            e.scanner
                            and e.scanned_at
                            and e.status
                            in {
                                "needs_review",
                                "reviewed_accepted",
                                "reviewed_rejected",
                                "needs_more_information",
                                "escalated",
                            }
                        ),
                    }
                    for e in submissions
                ],
            }
        )
    return {
        "engagement_id": eid,
        "company": tenant.display_name,
        "contact": tenant.primary_contact,
        "name": f"{driver.first_name} {driver.last_name}",
        "reference": driver.reference,
        "items": items,
    }
