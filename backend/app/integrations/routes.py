import hashlib
import hmac
import secrets
import time
from datetime import date, timedelta
from typing import Literal
from uuid import UUID
from fastapi import Request, Query
from pydantic import Field
from sqlalchemy import select, func
from app.organizations.schemas import Input, Versioned
from app.models import ProviderConnection, IntegrationRun, ProviderJob, Tenant, now
from app.shared.security import encrypt, decrypt
from app.shared.errors import DomainError
from app.audit.service import record
from app.approvals.routes import employer_admin
from app.integrations import service


class Configure(Input):
    account_ref: str = Field(min_length=3, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")
    credential: str = Field(min_length=8, max_length=512, pattern=r"^[A-Za-z0-9_-]+$")
    reason: str = Field(min_length=10, max_length=500)


class Rotate(Versioned):
    credential: str = Field(min_length=8, max_length=512, pattern=r"^[A-Za-z0-9_-]+$")


class QueuePull(Versioned):
    command_id: UUID


class Schedule(Versioned):
    enabled: bool
    interval_minutes: Literal[15, 60, 1440]
    dry_run: bool = False


class Simulate(Versioned):
    driver_reference: str = Field(min_length=1, max_length=100)
    report_reference: str = Field(min_length=1, max_length=100)
    report_type: Literal["motor_vehicle_record", "employment_verification", "background_screening"]
    reported_at: date


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/provider-connections"

    @app.get(base)
    def listing(tenant_id: UUID, actor: Actor, db: DB, offset: int = Query(0, ge=0)):
        tid = str(tenant_id)
        service.access(db, actor, tid)
        query = select(ProviderConnection).where(ProviderConnection.tenant_id == tid)
        return {
            "items": [
                service.present(r)
                for r in db.scalars(
                    query.order_by(ProviderConnection.created_at.desc()).offset(offset).limit(25)
                )
            ],
            "total": db.scalar(select(func.count()).select_from(query.subquery())),
            "can_manage": employer_admin(db, actor, tid),
            "environment": "local_synthetic",
        }

    @app.post(base, status_code=201)
    def configure(tenant_id: UUID, data: Configure, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        service.access(db, actor, tid, True)
        if (
            db.scalar(
                select(func.count())
                .select_from(ProviderConnection)
                .where(ProviderConnection.tenant_id == tid)
            )
            >= 5
        ):
            raise DomainError(
                "CONNECTION_QUOTA", "Local synthetic environment permits five connections per company.", 429
            )
        key = secrets.token_urlsafe(32)
        row = ProviderConnection(
            tenant_id=tid,
            owner_id=actor.id,
            account_ref=data.account_ref,
            encrypted_credential=encrypt(data.credential),
            encrypted_signing_key=encrypt(key),
        )
        db.add(row)
        db.flush()
        record(
            db, actor, tid, "integration.configured", row.id, request.state.correlation_id, reason=data.reason
        )
        return {**service.present(row), "signing_key": key}

    @app.get(base + "/{connection_id}/runs")
    def runs(tenant_id: UUID, connection_id: UUID, actor: Actor, db: DB, offset: int = Query(0, ge=0)):
        row = service.connection(db, actor, str(tenant_id), str(connection_id))
        query = select(IntegrationRun).where(IntegrationRun.connection_id == row.id)
        return {
            "items": [
                service.run_data(r)
                for r in db.scalars(query.order_by(IntegrationRun.created_at.desc()).offset(offset).limit(25))
            ],
            "total": db.scalar(select(func.count()).select_from(query.subquery())),
        }

    def current(tenant_id, connection_id, actor, db, version):
        row = service.connection(db, actor, str(tenant_id), str(connection_id), True)
        if row.version != version:
            raise DomainError("VERSION_CONFLICT", "Connection changed. Refresh before acting.", 409)
        if row.state == "revoked":
            raise DomainError(
                "STATE_TRANSITION_DENIED",
                "Revoked connections cannot resume. Configure a new authorized connection.",
                409,
            )
        return row

    @app.get(base + "/{connection_id}/jobs")
    def jobs(tenant_id: UUID, connection_id: UUID, actor: Actor, db: DB, offset: int = Query(0, ge=0)):
        from app.integrations.jobs import present

        row = service.connection(db, actor, str(tenant_id), str(connection_id))
        query = select(ProviderJob).where(ProviderJob.connection_id == row.id)
        return {
            "items": [
                present(job)
                for job in db.scalars(query.order_by(ProviderJob.created_at.desc()).offset(offset).limit(25))
            ],
            "total": db.scalar(select(func.count()).select_from(query.subquery())),
        }

    @app.post(base + "/{connection_id}/pull-jobs", status_code=202)
    def enqueue(
        tenant_id: UUID, connection_id: UUID, data: QueuePull, actor: Actor, db: DB, request: Request
    ):
        from app.integrations.jobs import present

        service.access(db, actor, str(tenant_id), True)
        prior = db.scalar(
            select(ProviderJob).where(
                ProviderJob.tenant_id == str(tenant_id),
                ProviderJob.actor_id == actor.id,
                ProviderJob.command_id == str(data.command_id),
            )
        )
        if prior:
            if prior.connection_id != str(connection_id):
                raise DomainError("IDEMPOTENCY_CONFLICT", "Pull command belongs to another connection.", 409)
            return present(prior)
        row = current(tenant_id, connection_id, actor, db, data.version)
        service.delegated_owner(db, row)
        if db.scalar(
            select(ProviderJob.id).where(
                ProviderJob.connection_id == row.id,
                ProviderJob.status.in_(["queued", "processing", "retry_scheduled"]),
            )
        ):
            raise DomainError(
                "PULL_ALREADY_QUEUED",
                "A pull is already pending for this connection. Inspect its job status.",
                409,
            )
        job = ProviderJob(
            tenant_id=row.tenant_id,
            connection_id=row.id,
            actor_id=actor.id,
            command_id=str(data.command_id),
            credential_version=row.credential_version,
        )
        db.add(job)
        db.flush()
        record(
            db,
            actor,
            row.tenant_id,
            "integration.pull_queued",
            job.id,
            request.state.correlation_id,
            reason=data.reason,
        )
        return present(job)

    @app.post(base + "/{connection_id}/sync-schedule")
    def sync_schedule(
        tenant_id: UUID, connection_id: UUID, data: Schedule, actor: Actor, db: DB, request: Request
    ):
        row = current(tenant_id, connection_id, actor, db, data.version)
        if data.enabled:
            service.delegated_owner(db, row)
        if data.dry_run:
            return {
                "dry_run": True,
                "would_enable": data.enabled,
                "interval_minutes": data.interval_minutes,
                "next_action": "queue_metadata_pull" if data.enabled else "pause_future_pulls",
                "evidence_outcome": "human_review_required",
            }
        previous = {"enabled": row.sync_enabled, "interval_minutes": row.sync_interval_minutes}
        row.sync_enabled, row.sync_interval_minutes = data.enabled, data.interval_minutes
        row.sync_approved_by, row.sync_credential_version = actor.id, row.credential_version
        row.sync_error = None
        row.next_sync_at = now() + timedelta(minutes=data.interval_minutes) if data.enabled else None
        row.version += 1
        record(
            db,
            actor,
            row.tenant_id,
            "integration.schedule_configured",
            row.id,
            request.state.correlation_id,
            reason=data.reason,
            previous=previous,
            enabled=data.enabled,
            interval_minutes=data.interval_minutes,
            version=row.version,
        )
        return service.present(row)

    @app.post(base + "/{connection_id}/{operation}")
    def action(
        tenant_id: UUID,
        connection_id: UUID,
        operation: Literal["test", "pull", "pause", "resume", "revoke", "rotate-signing-key"],
        data: Versioned,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        row = current(tenant_id, connection_id, actor, db, data.version)
        if operation in {"test", "pull"}:
            if operation == "pull":
                service.delegated_owner(db, row)
            return {"run": service.operate(db, actor, row, operation, request.state.correlation_id)}
        result = {}
        if operation == "pause":
            row.state = "paused"
            row.sync_enabled, row.next_sync_at, row.sync_error = False, None, "CONNECTION_PAUSED"
        elif operation == "revoke":
            row.state = "revoked"
            row.sync_enabled, row.next_sync_at, row.sync_error = False, None, "CONNECTION_REVOKED"
            row.verified_credential_version = None
            row.encrypted_signing_key = encrypt(secrets.token_urlsafe(32))
        elif operation == "resume":
            if row.verified_credential_version != row.credential_version or not row.tested_at:
                raise DomainError(
                    "TEST_REQUIRED", "Test current credentials before resuming this sandbox connection.", 409
                )
            row.state = "sandbox_verified"
        else:
            key = secrets.token_urlsafe(32)
            row.encrypted_signing_key = encrypt(key)
            result["signing_key"] = key
        row.version += 1
        record(
            db,
            actor,
            row.tenant_id,
            "integration." + operation,
            row.id,
            request.state.correlation_id,
            reason=data.reason,
        )
        return {**service.present(row), **result}

    @app.post(base + "/{connection_id}/credentials/rotate")
    def rotate(tenant_id: UUID, connection_id: UUID, data: Rotate, actor: Actor, db: DB, request: Request):
        row = current(tenant_id, connection_id, actor, db, data.version)
        row.encrypted_credential = encrypt(data.credential)
        row.credential_version += 1
        row.version += 1
        row.state = "configured"
        row.verified_credential_version = None
        row.tested_at = None
        row.sync_enabled, row.next_sync_at, row.sync_error = False, None, "CREDENTIAL_CHANGED"
        record(
            db,
            actor,
            row.tenant_id,
            "integration.credentials_rotated",
            row.id,
            request.state.correlation_id,
            reason=data.reason,
        )
        return service.present(row)

    @app.post(base + "/{connection_id}/simulator/records")
    def simulate(
        tenant_id: UUID, connection_id: UUID, data: Simulate, actor: Actor, db: DB, request: Request
    ):
        row = current(tenant_id, connection_id, actor, db, data.version)
        service.delegated_owner(db, row)
        payload = {
            "client_ref": db.get(Tenant, row.tenant_id).customer_ref,
            "external_driver_ref": data.driver_reference,
            "external_report_ref": data.report_reference,
            "report_type": data.report_type,
            "reported_at": data.reported_at.isoformat(),
        }
        return {"run": service.operate(db, actor, row, "simulate", request.state.correlation_id, payload)}

    @app.post("/api/v1/provider-webhooks/{connection_id}", status_code=202)
    async def webhook(connection_id: UUID, request: Request, db: DB):
        # Separate machine authentication; no browser session or CSRF is accepted as provider authority.
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > 64000:
                raise DomainError("PAYLOAD_TOO_LARGE", "Provider event exceeds its quota.", 413)
        timestamp = request.headers.get("x-qf-timestamp", "")
        signature = request.headers.get("x-qf-signature", "")
        row = db.get(ProviderConnection, str(connection_id))
        if (
            not row
            or not timestamp.isascii()
            or not timestamp.isdigit()
            or len(timestamp) > 12
            or len(signature) != 64
            or any(c not in "0123456789abcdef" for c in signature)
            or abs(time.time() - int(timestamp)) > 300
        ):
            raise DomainError("PROVIDER_AUTH_REJECTED", "Provider signature or timestamp is invalid.", 401)
        expected = hmac.new(
            decrypt(row.encrypted_signing_key).encode(),
            timestamp.encode() + b"." + bytes(raw),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise DomainError("PROVIDER_AUTH_REJECTED", "Provider signature or timestamp is invalid.", 401)
        # Serialize tenant-bound duplicate recognition with all canonical receipt writes.
        db.scalar(select(Tenant).where(Tenant.id == row.tenant_id).with_for_update())
        row = db.scalar(
            select(ProviderConnection)
            .where(ProviderConnection.id == row.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        current_signature = hmac.new(
            decrypt(row.encrypted_signing_key).encode(),
            timestamp.encode() + b"." + bytes(raw),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(current_signature, signature):
            raise DomainError(
                "PROVIDER_AUTH_REJECTED", "Provider signing key changed; retry with the current key.", 401
            )
        result = service.receive(db, row, bytes(raw), request.state.correlation_id, "provider_webhook")
        return {**result, "status": "durably_received_for_review"}
