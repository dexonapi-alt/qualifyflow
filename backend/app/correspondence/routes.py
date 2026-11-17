from uuid import UUID
import hashlib
import json
from fastapi import Query, Request
from pydantic import Field
from sqlalchemy import select, func, or_
from app.models import CommunicationPolicy, ClientMessage, MessageEvent, ExceptionCase, User, Membership, now
from app.organizations.schemas import Input
from app.organizations.service import lock_tenant
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.approvals.routes import employer_admin
from app.exceptions import service as cases
from app.audit.service import record


class Policy(Input):
    recipient_id: UUID
    expected_policy_id: UUID | None = None
    instructions: str = Field(min_length=20, max_length=2000)


class Draft(Input):
    command_id: UUID
    version: int = Field(ge=1)
    body: str = Field(min_length=20, max_length=4000)


class Decision(Input):
    version: int = Field(ge=1)
    reason: str = Field(min_length=10, max_length=2000)


class Reply(Input):
    command_id: UUID
    body: str = Field(min_length=10, max_length=4000)


def active_policy(db, tid):
    return db.scalar(
        select(CommunicationPolicy)
        .where(CommunicationPolicy.tenant_id == tid, CommunicationPolicy.status == "active")
        .order_by(CommunicationPolicy.revision.desc())
        .limit(1)
    )


def event(db, message, actor, action, body, command=None):
    db.add(
        MessageEvent(
            message_id=message.id,
            actor_id=actor.id,
            action=action,
            encrypted_body=encrypt(body),
            command_id=command,
        )
    )


def present(db, actor, message):
    current_case = db.get(ExceptionCase, message.case_id)
    policy = active_policy(db, message.tenant_id)
    current = (
        current_case.version == message.case_version
        and current_case.state == "in_review"
        and policy is not None
        and policy.id == message.policy_id
    )
    return {
        "id": message.id,
        "case_id": message.case_id,
        "case_version": message.case_version,
        "version": message.version,
        "status": message.status,
        "body": decrypt(message.encrypted_body),
        "author": db.get(User, message.author_id).email,
        "recipient": db.get(User, message.recipient_id).email,
        "created_at": message.created_at,
        "sent_at": message.sent_at,
        "opened_at": message.opened_at,
        "responded_at": message.responded_at,
        "error_code": message.error_code,
        "can_approve": message.status == "pending_approval"
        and current
        and employer_admin(db, actor, message.tenant_id),
        "needs_fresh_request": message.status == "pending_approval" and not current,
        "can_reply": actor.id == message.recipient_id
        and employer_admin(db, actor, message.tenant_id)
        and message.status in {"sent", "delivered"},
        "events": [
            {
                "id": e.id,
                "action": e.action,
                "body": decrypt(e.encrypted_body),
                "actor": db.get(User, e.actor_id).email,
                "occurred_at": e.occurred_at,
            }
            for e in db.scalars(
                select(MessageEvent)
                .where(MessageEvent.message_id == message.id)
                .order_by(MessageEvent.occurred_at)
            )
        ],
    }


def message_scope(db, actor, tid, mid, write=False):
    message = db.scalar(select(ClientMessage).where(ClientMessage.id == mid, ClientMessage.tenant_id == tid))
    if not message:
        raise DomainError("NOT_FOUND", "Message unavailable.", 404)
    scope, case, task = cases.scoped(db, actor, tid, message.case_id, write)
    if actor.id == message.recipient_id and not employer_admin(db, actor, tid):
        raise DomainError("NOT_FOUND", "Message unavailable for this current recipient role.", 404)
    if actor.id not in {message.author_id, message.recipient_id} and not cases.reviewer(scope):
        raise DomainError("NOT_FOUND", "Message unavailable.", 404)
    if write:
        message = db.scalar(
            select(ClientMessage)
            .where(ClientMessage.id == mid)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    return message, scope, case, task


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/correspondence"

    @app.get(base + "/policy")
    def policy(tenant_id: UUID, actor: Actor, db: DB):
        tid = str(tenant_id)
        authorize(db, actor, tid, "drivers:write")
        current = active_policy(db, tid)
        configurable = employer_admin(db, actor, tid)
        recipients = (
            [
                {"id": u.id, "email": u.email}
                for u in db.scalars(
                    select(User)
                    .join(Membership, Membership.user_id == User.id)
                    .where(
                        Membership.tenant_id == tid,
                        Membership.role == "client_admin",
                        Membership.branch_id.is_(None),
                        Membership.status == "active",
                        User.status == "active",
                    )
                )
            ]
            if configurable
            else []
        )
        return {
            "policy": {
                "id": current.id,
                "revision": current.revision,
                "recipient": db.get(User, current.recipient_id).email,
                "instructions": decrypt(current.encrypted_instructions),
            }
            if current
            else None,
            "can_configure": configurable,
            "recipients": recipients,
        }

    @app.post(base + "/policy", status_code=201)
    def configure(tenant_id: UUID, data: Policy, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        recipient = db.get(User, str(data.recipient_id))
        if (
            not employer_admin(db, actor, tid)
            or not recipient
            or recipient.status != "active"
            or not employer_admin(db, recipient, tid)
        ):
            raise DomainError(
                "FORBIDDEN",
                "A current employer administrator must approve a current whole-company client administrator as recipient.",
                403,
            )
        current = active_policy(db, tid)
        if (current.id if current else None) != (
            str(data.expected_policy_id) if data.expected_policy_id else None
        ):
            raise DomainError(
                "VERSION_CONFLICT",
                "The client process changed. Refresh before approving a new revision.",
                409,
            )
        if current:
            current.status = "superseded"
        revision = (
            db.scalar(
                select(func.max(CommunicationPolicy.revision)).where(CommunicationPolicy.tenant_id == tid)
            )
            or 0
        ) + 1
        row = CommunicationPolicy(
            tenant_id=tid,
            revision=revision,
            recipient_id=recipient.id,
            approved_by=actor.id,
            encrypted_instructions=encrypt(data.instructions),
        )
        db.add(row)
        db.flush()
        record(
            db,
            actor,
            tid,
            "message.policy_configured",
            row.id,
            request.state.correlation_id,
            revision=revision,
        )
        return {"id": row.id}

    @app.post(base + "/policy/{policy_id}/revoke")
    def revoke(tenant_id: UUID, policy_id: UUID, data: Decision, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        if not employer_admin(db, actor, tid):
            raise DomainError("FORBIDDEN", "Current employer administration authority required.", 403)
        row = db.scalar(
            select(CommunicationPolicy)
            .where(CommunicationPolicy.id == str(policy_id), CommunicationPolicy.tenant_id == tid)
            .with_for_update()
        )
        if not row or row.status != "active":
            raise DomainError(
                "STATE_TRANSITION_DENIED", "Only the current active process can be revoked.", 409
            )
        if row.revision != data.version:
            raise DomainError("VERSION_CONFLICT", "Refresh the current process before revoking it.", 409)
        row.status = "revoked"
        record(db, actor, tid, "message.policy_revoked", row.id, request.state.correlation_id)
        return {"saved": True}

    @app.post("/api/v1/tenants/{tenant_id}/exceptions/{case_id}/information-requests", status_code=201)
    def draft(tenant_id: UUID, case_id: UUID, data: Draft, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        scope, case, task = cases.scoped(db, actor, tid, str(case_id), True)
        if task.assignee_id != actor.id and not cases.reviewer(scope):
            raise DomainError(
                "FORBIDDEN", "Only the case owner or authorized reviewer may draft client follow-up.", 403
            )
        policy = active_policy(db, tid)
        if not policy:
            raise DomainError(
                "CLIENT_PROCESS_REQUIRED",
                "A client administrator must approve an in-app recipient and process first.",
                409,
            )
        digest = hashlib.sha256(json.dumps([case.id, data.version, data.body]).encode()).hexdigest()
        prior = db.scalar(
            select(ClientMessage).where(
                ClientMessage.tenant_id == tid,
                ClientMessage.author_id == actor.id,
                ClientMessage.command_id == str(data.command_id),
            )
        )
        if prior:
            if prior.request_hash != digest:
                raise DomainError(
                    "IDEMPOTENCY_CONFLICT",
                    "This message command was already used with different content.",
                    409,
                )
            return {"id": prior.id, "replayed": True}
        if case.version != data.version or case.state != "in_review":
            raise DomainError(
                "VERSION_CONFLICT", "Refresh the current in-review case before drafting a request.", 409
            )
        if db.scalar(
            select(ClientMessage.id).where(
                ClientMessage.case_id == case.id,
                ClientMessage.case_version == case.version,
                ClientMessage.status.in_(["pending_approval", "queued"]),
            )
        ):
            raise DomainError(
                "REQUEST_PENDING",
                "An information request already awaits approval or publishing for this case version.",
                409,
            )
        body = decrypt(policy.encrypted_instructions) + "\n\n" + data.body
        message = ClientMessage(
            tenant_id=tid,
            case_id=case.id,
            case_version=case.version,
            policy_id=policy.id,
            author_id=actor.id,
            recipient_id=policy.recipient_id,
            command_id=str(data.command_id),
            request_hash=digest,
            encrypted_body=encrypt(body),
        )
        db.add(message)
        db.flush()
        event(
            db, message, actor, "message.drafted", "Exact content and recipient awaiting employer approval."
        )
        record(db, actor, tid, "message.drafted", message.id, request.state.correlation_id, case_id=case.id)
        return {"id": message.id}

    @app.get(base)
    def listing(tenant_id: UUID, actor: Actor, db: DB, offset: int = Query(default=0, ge=0)):
        tid = str(tenant_id)
        scope = authorize(db, actor, tid, "drivers:write")
        query = (
            select(ClientMessage)
            .join(ExceptionCase, ExceptionCase.id == ClientMessage.case_id)
            .where(ClientMessage.tenant_id == tid)
        )
        if scope.branch_id:
            query = query.where(ExceptionCase.branch_id == scope.branch_id)
        if not cases.reviewer(scope):
            query = query.where(ClientMessage.author_id == actor.id)
        # Unpublished drafts are visible only to the author and authorized whole-company reviewers.
        if not cases.reviewer(scope):
            query = query.where(
                or_(ClientMessage.author_id == actor.id, ClientMessage.status.in_(["sent", "delivered"]))
            )
        total = db.scalar(select(func.count()).select_from(query.subquery()))
        return {
            "total": total,
            "items": [
                present(db, actor, m)
                for m in db.scalars(query.order_by(ClientMessage.created_at.desc()).offset(offset).limit(25))
            ],
        }

    @app.post(base + "/{message_id}/approve")
    def approve(tenant_id: UUID, message_id: UUID, data: Decision, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        message, _, case, _ = message_scope(db, actor, tid, str(message_id), True)
        policy = active_policy(db, tid)
        if not employer_admin(db, actor, tid):
            raise DomainError(
                "FORBIDDEN", "Employer administration authority required for message approval.", 403
            )
        if (
            message.version != data.version
            or message.status != "pending_approval"
            or case.version != message.case_version
            or case.state != "in_review"
            or not policy
            or policy.id != message.policy_id
        ):
            raise DomainError(
                "VERSION_CONFLICT",
                "Message, case or approved client process changed. Create a fresh request.",
                409,
            )
        message.status, message.approved_by, message.version = "queued", actor.id, message.version + 1
        event(db, message, actor, "message.approved", data.reason)
        record(db, actor, tid, "message.approved", message.id, request.state.correlation_id)
        return {"queued": True}

    @app.post(base + "/{message_id}/withdraw")
    def withdraw(tenant_id: UUID, message_id: UUID, data: Decision, actor: Actor, db: DB):
        message, scope, _, _ = message_scope(db, actor, str(tenant_id), str(message_id), True)
        if (
            message.version != data.version
            or message.status not in {"pending_approval", "queued"}
            or (actor.id != message.author_id and not cases.reviewer(scope))
        ):
            raise DomainError(
                "STATE_TRANSITION_DENIED",
                "Only current unpublished requests can be withdrawn by an authorized user.",
                409,
            )
        message.status, message.version = "suppressed", message.version + 1
        message.error_code = "WITHDRAWN_BY_AUTHORIZED_USER"
        event(db, message, actor, "message.withdrawn", data.reason)
        return {"saved": True}

    @app.post(base + "/{message_id}/open")
    def opened(tenant_id: UUID, message_id: UUID, actor: Actor, db: DB):
        message, _, _, _ = message_scope(db, actor, str(tenant_id), str(message_id), True)
        if actor.id != message.recipient_id or message.status not in {"sent", "delivered"}:
            raise DomainError(
                "FORBIDDEN", "Only the intended recipient may record opening a published request.", 403
            )
        if not message.opened_at:
            message.opened_at, message.status, message.version = now(), "delivered", message.version + 1
            event(db, message, actor, "message.opened", "Recipient opened the authenticated in-app request.")
        return {"saved": True}

    @app.post(base + "/{message_id}/reply")
    def reply(tenant_id: UUID, message_id: UUID, data: Reply, actor: Actor, db: DB):
        message, _, case, _ = message_scope(db, actor, str(tenant_id), str(message_id), True)
        if actor.id != message.recipient_id or message.status not in {"sent", "delivered"}:
            raise DomainError(
                "FORBIDDEN", "Only the current intended recipient can reply to a published request.", 403
            )
        prior = db.scalar(
            select(MessageEvent).where(
                MessageEvent.message_id == message.id,
                MessageEvent.actor_id == actor.id,
                MessageEvent.command_id == str(data.command_id),
            )
        )
        if prior:
            if decrypt(prior.encrypted_body) != data.body:
                raise DomainError(
                    "IDEMPOTENCY_CONFLICT", "Reply command was already used with different content.", 409
                )
            return {"saved": True, "replayed": True}
        event(db, message, actor, "message.response_received", data.body, str(data.command_id))
        if not message.opened_at:
            message.opened_at, message.status = now(), "delivered"
            event(
                db, message, actor, "message.opened", "Recipient responded through the authenticated portal."
            )
        message.responded_at = now()
        message.version += 1
        if case.state == "awaiting_client":
            case.state = "in_review"
        case.version += 1
        cases.event(db, case, actor, "message.response_received", data.body, message_id=message.id)
        return {"saved": True}
