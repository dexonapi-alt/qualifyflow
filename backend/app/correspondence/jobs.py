"""Publish approved requests into the private in-app inbox; no external transport."""

from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import engine
from app.models import ClientMessage, ExceptionCase, Tenant, User, now
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.approvals.routes import employer_admin
from app.correspondence.routes import active_policy, event
from app.exceptions.service import event as case_event
from app.audit.service import record


def publish_pending(limit=5):
    published = 0
    for _ in range(limit):
        with Session(engine()) as db, db.begin():
            message = db.scalar(
                select(ClientMessage)
                .where(ClientMessage.status == "queued")
                .order_by(ClientMessage.created_at)
                .limit(1)
            )
            if not message:
                break
            tenant = db.scalar(
                select(Tenant).where(Tenant.id == message.tenant_id).with_for_update(skip_locked=True)
            )
            if not tenant:
                break
            case = db.scalar(
                select(ExceptionCase).where(ExceptionCase.id == message.case_id).with_for_update()
            )
            message = db.scalar(
                select(ClientMessage)
                .where(ClientMessage.id == message.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if message.status != "queued":
                continue
            actor = db.get(User, message.author_id)
            recipient = db.get(User, message.recipient_id)
            approver = db.get(User, message.approved_by) if message.approved_by else None
            try:
                scope = authorize(db, actor, tenant.id, "drivers:write")
                allow_write(tenant)
                if scope.branch_id and case.branch_id != scope.branch_id:
                    raise ValueError("Scope changed")
                policy = active_policy(db, tenant.id)
                if (
                    not policy
                    or policy.id != message.policy_id
                    or policy.recipient_id != message.recipient_id
                ):
                    raise ValueError("Policy changed")
                if (
                    not recipient
                    or recipient.status != "active"
                    or not employer_admin(db, recipient, tenant.id)
                    or not approver
                    or approver.status != "active"
                    or not employer_admin(db, approver, tenant.id)
                ):
                    raise ValueError("Recipient or approval authority changed")
                if case.version != message.case_version or case.state != "in_review":
                    raise ValueError("Case changed")
            except (DomainError, ValueError, AttributeError):
                message.status, message.error_code = (
                    "suppressed",
                    "CURRENT_POLICY_RECIPIENT_CASE_OR_AUTHORITY_CHANGED",
                )
                message.version += 1
                event(
                    db,
                    message,
                    actor,
                    "message.suppressed",
                    "Publishing blocked by changed policy, case or authorization; no recipient fallback.",
                )
                continue
            # One DB transaction publishes the inbox record and case follow-up state.
            # Crash/rollback leaves the same queued row, so replay cannot duplicate delivery.
            message.status, message.sent_at, message.version = "sent", now(), message.version + 1
            case.state, case.version = "awaiting_client", case.version + 1
            event(
                db,
                message,
                actor,
                "message.sent",
                "Published to the approved recipient's authenticated in-app inbox; not external email delivery.",
            )
            case_event(
                db,
                case,
                actor,
                "message.sent",
                "Client information requested through the approved in-app process.",
                message_id=message.id,
            )
            record(
                db, actor, tenant.id, "message.sent", message.id, "in-app-publishing-worker", channel="in_app"
            )
            published += 1
    return published
