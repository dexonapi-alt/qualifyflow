"""Durable bounded provider pulls. PostgreSQL owns delivery and crash recovery."""

from datetime import timedelta
import random
from uuid import uuid5, NAMESPACE_URL
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session
from app.db import engine
from app.models import ProviderJob, ProviderConnection, Tenant, User, now, uid
from app.integrations import service
from app.shared.errors import DomainError
from app.audit.service import record


def schedule_pending(limit=20):
    """Only explicitly approved pull schedules; no notices, evidence acceptance or legal rules."""
    queued = 0
    with Session(engine()) as listing:
        ids = list(
            listing.scalars(
                select(ProviderConnection.id)
                .where(ProviderConnection.sync_enabled.is_(True), ProviderConnection.next_sync_at <= now())
                .order_by(ProviderConnection.next_sync_at)
                .limit(limit)
            )
        )
    for cid in ids:
        with Session(engine()) as db, db.begin():
            binding = db.get(ProviderConnection, cid)
            if not binding or not db.scalar(
                select(Tenant).where(Tenant.id == binding.tenant_id).with_for_update(skip_locked=True)
            ):
                continue
            row = db.scalar(
                select(ProviderConnection)
                .where(ProviderConnection.id == cid)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if not row.sync_enabled or not row.next_sync_at or row.next_sync_at > now():
                continue
            approver = db.get(User, row.sync_approved_by)
            try:
                service.delegated_owner(db, row)
                if not approver or approver.status != "active":
                    raise DomainError("FORBIDDEN", "Schedule approver unavailable.", 403)
                service.access(db, approver, row.tenant_id, True)
                if row.sync_credential_version != row.credential_version:
                    raise DomainError("CREDENTIAL_CHANGED", "Schedule requires renewed approval.", 409)
            except DomainError as error:
                row.sync_enabled, row.sync_error = False, error.code
                row.version += 1
                if approver:
                    record(
                        db,
                        approver,
                        row.tenant_id,
                        "integration.schedule_blocked",
                        row.id,
                        uid(),
                        error_code=error.code,
                        initiator_type="scheduler",
                    )
                continue
            pending = db.scalar(
                select(ProviderJob.id).where(
                    ProviderJob.connection_id == row.id,
                    ProviderJob.status.in_(["queued", "processing", "retry_scheduled"]),
                )
            )
            if not pending:
                command = str(uuid5(NAMESPACE_URL, row.id + ":schedule:" + row.next_sync_at.isoformat()))
                job = ProviderJob(
                    tenant_id=row.tenant_id,
                    connection_id=row.id,
                    actor_id=approver.id,
                    command_id=command,
                    credential_version=row.credential_version,
                )
                db.add(job)
                db.flush()
                record(
                    db,
                    approver,
                    row.tenant_id,
                    "integration.scheduled_pull_queued",
                    job.id,
                    job.id,
                    initiator_type="scheduler",
                    interval_minutes=row.sync_interval_minutes,
                )
                queued += 1
            row.next_sync_at = now() + timedelta(minutes=row.sync_interval_minutes)
    return queued


TRANSIENT = {"PROVIDER_UNAVAILABLE", "PROVIDER_RATE_LIMIT"}


def present(job):
    return {
        key: getattr(job, key)
        for key in (
            "id",
            "connection_id",
            "status",
            "attempts",
            "available_at",
            "error_code",
            "run_id",
            "created_at",
        )
    }


def process_pending(limit=5):
    completed = 0
    for _ in range(limit):
        with Session(engine()) as db, db.begin():
            job = db.scalar(
                select(ProviderJob)
                .where(
                    or_(
                        and_(
                            ProviderJob.status.in_(["queued", "retry_scheduled"]),
                            ProviderJob.available_at <= now(),
                        ),
                        and_(ProviderJob.status == "processing", ProviderJob.lease_until < now()),
                    )
                )
                .order_by(ProviderJob.available_at)
                .limit(1)
            )
            if not job:
                break
            if not db.scalar(
                select(Tenant).where(Tenant.id == job.tenant_id).with_for_update(skip_locked=True)
            ):
                break
            job = db.scalar(
                select(ProviderJob)
                .where(ProviderJob.id == job.id)
                .with_for_update(skip_locked=True)
                .execution_options(populate_existing=True)
            )
            if not job or job.status not in {"queued", "retry_scheduled", "processing"}:
                continue
            if job.status == "processing" and job.lease_until and job.lease_until > now():
                continue
            if job.attempts >= 5:
                job.status, job.error_code = "dead_letter", "PROVIDER_RETRY_LIMIT"
                continue
            job.status, job.lease_token, job.lease_until = "processing", uid(), now() + timedelta(seconds=120)
            job.attempts += 1
            jid, tid, lease = job.id, job.tenant_id, job.lease_token
        try:
            with Session(engine()) as db, db.begin():
                db.scalar(select(Tenant).where(Tenant.id == tid).with_for_update())
                job = db.scalar(select(ProviderJob).where(ProviderJob.id == jid).with_for_update())
                if job.status != "processing" or job.lease_token != lease:
                    continue
                actor = db.get(User, job.actor_id)
                row = db.scalar(
                    select(ProviderConnection)
                    .where(ProviderConnection.id == job.connection_id)
                    .with_for_update()
                )
                try:
                    if not actor or actor.status != "active":
                        raise DomainError("FORBIDDEN", "Requesting actor unavailable.", 403)
                    service.access(db, actor, tid, True)
                    service.delegated_owner(db, row)
                    if row.credential_version != job.credential_version:
                        raise DomainError(
                            "CREDENTIAL_CHANGED", "Queue a new pull after credential rotation.", 409
                        )
                except DomainError as error:
                    job.status, job.error_code = "blocked_by_policy", error.code
                else:
                    result = service.operate(db, actor, row, "pull", job.id)
                    job.run_id = result["id"]
                    job.error_code = result["error_code"]
                    if result["state"] == "succeeded":
                        job.status = "completed"
                    elif job.error_code in TRANSIENT and job.attempts < 5:
                        job.status = "retry_scheduled"
                        job.available_at = now() + timedelta(
                            seconds=min(300, 5 * 2**job.attempts) + random.randint(0, 5)
                        )
                    else:
                        job.status = "dead_letter"
                job.lease_until, job.lease_token = None, None
                if actor:
                    record(
                        db,
                        actor,
                        tid,
                        "integration.job_processed",
                        job.id,
                        job.id,
                        state=job.status,
                        error_code=job.error_code,
                    )
                completed += 1
        except Exception:
            # The committed lease recovers unexpected process/DB failures; never log secrets.
            continue
    return completed
