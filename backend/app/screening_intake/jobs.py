"""Durable job envelopes are PostgreSQL-owned; Redis delivery is only a wakeup."""

from datetime import timedelta
import json
import random
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session
from app.db import engine
from app.models import (
    IntakeJob,
    IntakeBatch,
    IntakeItem,
    ExceptionCase,
    ExceptionTask,
    Tenant,
    User,
    now,
    uid,
)
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import decrypt
from app.exceptions.service import event
from app.audit.service import record


def process_pending(limit=5):
    completed = 0
    for _ in range(limit):
        # Short claim transaction + expiring lease recovers a worker that dies after claiming.
        with Session(engine()) as db, db.begin():
            job = db.scalar(
                select(IntakeJob)
                .where(
                    or_(
                        and_(
                            IntakeJob.status.in_(["queued", "retry_scheduled"]),
                            IntakeJob.available_at <= now(),
                        ),
                        and_(IntakeJob.status == "processing", IntakeJob.lease_until < now()),
                    )
                )
                .order_by(IntakeJob.available_at)
                .limit(1)
            )
            if not job:
                break
            if not db.scalar(
                select(Tenant).where(Tenant.id == job.tenant_id).with_for_update(skip_locked=True)
            ):
                break
            job = db.scalar(
                select(IntakeJob)
                .where(IntakeJob.id == job.id)
                .with_for_update(skip_locked=True)
                .execution_options(populate_existing=True)
            )
            if not job or job.status not in {"queued", "retry_scheduled", "processing"}:
                continue
            if job.status == "processing" and job.lease_until and job.lease_until > now():
                continue
            if job.attempts >= 5:
                job.status, job.error_code = "dead_letter", "INTAKE_RETRY_LIMIT"
                continue
            job.status, job.lease_token, job.lease_until = "processing", uid(), now() + timedelta(seconds=120)
            job.attempts += 1
            jid, tid, lease = job.id, job.tenant_id, job.lease_token
        try:
            with Session(engine()) as db, db.begin():
                tenant = db.scalar(select(Tenant).where(Tenant.id == tid).with_for_update())
                job = db.scalar(select(IntakeJob).where(IntakeJob.id == jid).with_for_update())
                if job.lease_token != lease or job.status != "processing":
                    continue
                actor = db.get(User, job.actor_id)
                if not actor:
                    raise DomainError("FORBIDDEN", "Actor is unavailable.", 403)
                scope = authorize(db, actor, tid, "drivers:write")
                allow_write(tenant)
                batch = db.get(IntakeBatch, job.batch_id)
                if batch.source_channel in {"provider_webhook", "provider_pull"}:
                    from app.models import ProviderConnection, ProviderEvent
                    from app.integrations.service import delegated_owner

                    origin = db.scalar(
                        select(ProviderEvent).where(
                            ProviderEvent.batch_id == batch.id, ProviderEvent.tenant_id == tid
                        )
                    )
                    if not origin:
                        raise DomainError("FORBIDDEN", "Provider receipt origin unavailable.", 403)
                    connection = db.get(ProviderConnection, origin.connection_id)
                    if delegated_owner(db, connection).id != actor.id:
                        raise DomainError("FORBIDDEN", "Provider authority changed.", 403)
                if scope.branch_id and batch.branch_id != scope.branch_id:
                    raise DomainError("FORBIDDEN", "Scope changed.", 403)
                for item in db.scalars(
                    select(IntakeItem).where(IntakeItem.batch_id == batch.id).order_by(IntakeItem.row_number)
                ):
                    from app.screening_intake.lineage import replacement

                    if replacement(db, item.id):
                        continue
                    if db.scalar(select(ExceptionCase.id).where(ExceptionCase.source_item_id == item.id)):
                        continue
                    payload = json.loads(decrypt(item.encrypted_payload))
                    case = ExceptionCase(
                        tenant_id=tid, branch_id=batch.branch_id, source_item_id=item.id, category=item.status
                    )
                    db.add(case)
                    db.flush()
                    db.add(ExceptionTask(tenant_id=tid, case_id=case.id))
                    event(
                        db,
                        case,
                        actor,
                        "exception.opened",
                        payload["reason"],
                        batch_id=batch.id,
                        row_number=item.row_number,
                    )
                    record(
                        db,
                        actor,
                        tid,
                        "exception.opened",
                        case.id,
                        job.correlation_id,
                        category=case.category,
                    )
                job.status, job.error_code, job.completed_at = "completed", None, now()
                job.lease_until = None
                completed += 1
        except Exception as error:
            # Do not put source payloads, exception strings or credentials in error logs.
            with Session(engine()) as db, db.begin():
                db.scalar(select(Tenant).where(Tenant.id == tid).with_for_update())
                job = db.scalar(select(IntakeJob).where(IntakeJob.id == jid).with_for_update())
                if job.lease_token != lease:
                    continue
                job.lease_until = None
                if isinstance(error, DomainError):
                    job.status, job.error_code = "blocked_by_policy", "CURRENT_AUTHORIZATION_OR_TENANT_DENIED"
                else:
                    job.status = "dead_letter" if job.attempts >= 5 else "retry_scheduled"
                    job.error_code = "INTAKE_PROCESSING_FAILED"
                    job.available_at = now() + timedelta(
                        seconds=min(900, 10 * 2**job.attempts) + random.randint(0, 10)
                    )
    return completed
