import csv
import io
import hashlib
import json
from uuid import uuid5, NAMESPACE_URL
from sqlalchemy import select, func
from app.models import ProviderConnection, ProviderEvent, IntegrationRun, User, Tenant, now
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import decrypt, encrypt
from app.organizations.service import lock_tenant
from app.approvals.routes import employer_admin
from app.screening_intake.routes import receive_metadata, Receipt, HEADERS
from app.audit.service import record
from app.integrations import adapter


def access(db, actor, tid, manage=False):
    scope = authorize(db, actor, tid, "company:read")
    if scope.branch_id or scope.role not in {"client_admin", "reviewer", "specialist", "integration_admin"}:
        raise DomainError("FORBIDDEN", "Company-wide connection authority required.", 403)
    if manage:
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        if not employer_admin(db, actor, tid):
            raise DomainError(
                "FORBIDDEN", "A current employer administrator must authorize provider access.", 403
            )
    return scope


def connection(db, actor, tid, cid, manage=False):
    access(db, actor, tid, manage)
    query = select(ProviderConnection).where(
        ProviderConnection.tenant_id == tid, ProviderConnection.id == cid
    )
    row = db.scalar(query.with_for_update() if manage else query)
    if not row:
        raise DomainError("NOT_FOUND", "Connection unavailable.", 404)
    return row


def delegated_owner(db, row):
    if not row:
        raise DomainError("FORBIDDEN", "Provider connection is unavailable.", 403)
    owner = db.get(User, row.owner_id)
    if not owner or owner.status != "active" or not employer_admin(db, owner, row.tenant_id):
        raise DomainError("FORBIDDEN", "The employer authorization owner is no longer active.", 403)
    scope = authorize(db, owner, row.tenant_id, "drivers:write")
    allow_write(scope.tenant)
    if (
        scope.branch_id
        or row.state != "sandbox_verified"
        or row.verified_credential_version != row.credential_version
    ):
        raise DomainError(
            "STATE_TRANSITION_DENIED", "Connection must be currently sandbox verified and unpaused.", 409
        )
    return owner


def present(row):
    return {
        k: getattr(row, k)
        for k in [
            "id",
            "provider_code",
            "account_ref",
            "state",
            "version",
            "credential_version",
            "tested_at",
            "cursor",
            "sync_interval_minutes",
            "sync_enabled",
            "next_sync_at",
            "sync_error",
            "created_at",
        ]
    }


def run_data(run):
    return {
        k: getattr(run, k)
        for k in [
            "id",
            "operation",
            "state",
            "error_code",
            "received_count",
            "duplicate_count",
            "correlation_id",
            "created_at",
        ]
    }


def validate_envelope(row, value, tenant):
    if not isinstance(value, dict) or value.get("schema_version") != adapter.SCHEMA:
        raise DomainError("SCHEMA_MISMATCH", "Provider envelope schema is unsupported.", 422)
    eid = value.get("event_id")
    data = value.get("record")
    if (
        not isinstance(eid, str)
        or not 1 <= len(eid) <= 100
        or not isinstance(data, dict)
        or set(data) != set(HEADERS)
    ):
        raise DomainError(
            "SCHEMA_MISMATCH", "Provider event requires a stable ID and five canonical metadata fields.", 422
        )
    if any(not isinstance(v, str) or len(v) > 200 for v in data.values()):
        raise DomainError("SCHEMA_MISMATCH", "Provider fields must be bounded strings.", 422)
    if value.get("account_ref") != row.account_ref or data.get("client_ref") != tenant.customer_ref:
        raise DomainError(
            "PROVIDER_BINDING_DENIED", "Provider account/client binding does not match this connection.", 403
        )
    return eid, data


def receive(db, row, raw, correlation_id, channel):
    actor = delegated_owner(db, row)
    tenant = db.get(Tenant, row.tenant_id)
    try:
        envelope = json.loads(raw)
    except (ValueError, UnicodeError):
        raise DomainError("SCHEMA_MISMATCH", "Invalid provider JSON envelope.", 422) from None
    eid, data = validate_envelope(row, envelope, tenant)
    digest = hashlib.sha256(json.dumps(envelope, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    prior = db.scalar(
        select(ProviderEvent).where(ProviderEvent.connection_id == row.id, ProviderEvent.event_id == eid)
    )
    if prior:
        if prior.body_hash != digest:
            raise DomainError(
                "IDEMPOTENCY_CONFLICT", "Provider event ID was reused with a changed payload.", 409
            )
        return {"batch_id": prior.batch_id, "duplicate": True}
    if (
        db.scalar(
            select(func.count()).select_from(ProviderEvent).where(ProviderEvent.tenant_id == row.tenant_id)
        )
        >= 1000
    ):
        raise DomainError("PROVIDER_EVENT_QUOTA", "Local synthetic provider storage quota reached.", 429)
    source = io.StringIO()
    writer = csv.writer(source)
    writer.writerow(HEADERS)
    writer.writerow([data[k] for k in HEADERS])
    receipt = receive_metadata(
        db,
        actor,
        row.tenant_id,
        Receipt(source=source.getvalue(), command_id=uuid5(NAMESPACE_URL, row.id + ":" + eid)),
        correlation_id,
        channel,
    )
    db.add(
        ProviderEvent(
            tenant_id=row.tenant_id,
            connection_id=row.id,
            event_id=eid,
            body_hash=digest,
            encrypted_source=encrypt(raw.decode("utf8")),
            batch_id=receipt["id"],
        )
    )
    record(
        db,
        actor,
        row.tenant_id,
        "integration.event_received",
        row.id,
        correlation_id,
        initiator_type="provider",
        batch_id=receipt["id"],
        mapping_version=adapter.SCHEMA,
    )
    db.flush()
    return {"batch_id": receipt["id"], "duplicate": False}


def operate(db, actor, row, operation, correlation_id, payload=None):
    run = IntegrationRun(
        tenant_id=row.tenant_id,
        connection_id=row.id,
        operation=operation,
        state="running",
        correlation_id=correlation_id,
    )
    db.add(run)
    try:
        if operation == "test":
            value = adapter.request(decrypt(row.encrypted_credential), "GET", "/v1/account")
            if value.get("account_ref") != row.account_ref or value.get("environment") != "local_synthetic":
                raise adapter.ProviderError("PROVIDER_ACCOUNT_MISMATCH")
            row.tested_at = now()
            row.verified_credential_version = row.credential_version
            if row.state != "paused":
                row.state = "sandbox_verified"
        elif operation == "pull":
            delegated_owner(db, row)
            value = adapter.request(
                decrypt(row.encrypted_credential), "GET", f"/v1/reports?cursor={row.cursor}"
            )
            rows = value.get("events")
            cursor = value.get("next_cursor")
            if (
                not isinstance(rows, list)
                or len(rows) > 50
                or not isinstance(cursor, int)
                or cursor != row.cursor + len(rows)
            ):
                raise adapter.ProviderError("PROVIDER_SCHEMA_INVALID")
            for envelope in rows:
                validate_envelope(row, envelope, db.get(Tenant, row.tenant_id))
            # Savepoint prevents partial receipt writes/cursor advance on an inconsistent page.
            with db.begin_nested():
                for envelope in rows:
                    received = receive(
                        db,
                        row,
                        json.dumps(envelope, separators=(",", ":")).encode(),
                        correlation_id,
                        "provider_pull",
                    )
                    if received["duplicate"]:
                        run.duplicate_count = (run.duplicate_count or 0) + 1
                    else:
                        run.received_count = (run.received_count or 0) + 1
                row.cursor = cursor
        elif operation == "simulate":
            value = adapter.request(decrypt(row.encrypted_credential), "POST", "/v1/reports", payload)
            validate_envelope(row, value.get("event"), db.get(Tenant, row.tenant_id))
        run.state = "succeeded"
    except (adapter.ProviderError, DomainError) as error:
        run.state = "failed"
        run.error_code = error.code
        if operation == "test":
            row.state = "test_failed"
            row.verified_credential_version = None
            row.sync_enabled, row.next_sync_at, row.sync_error = False, None, "CONNECTION_TEST_FAILED"
        run.received_count = 0
        run.duplicate_count = 0
    row.version += 1
    record(
        db,
        actor,
        row.tenant_id,
        "integration." + operation,
        row.id,
        correlation_id,
        state=run.state,
        error_code=run.error_code,
    )
    db.flush()
    return run_data(run)
