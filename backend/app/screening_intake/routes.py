"""Bounded structured metadata receipts. No file processing or attachment claims."""

import csv
import hashlib
import io
import json
from datetime import date
from uuid import UUID

from fastapi import Query, Request
from pydantic import Field
from sqlalchemy import select, func

from app.models import (
    IntakeBatch,
    IntakeItem,
    IntakeJob,
    IntakeAttachment,
    DriverRequirement,
    DriverIdentity,
    DriverEngagement,
)
from app.organizations.schemas import Input
from app.organizations.service import lock_tenant, branch_check
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.audit.service import record

HEADERS = ["client_ref", "external_driver_ref", "report_type", "external_report_ref", "reported_at"]


class Preview(Input):
    source: str = Field(min_length=1, max_length=64000)
    branch_id: UUID | None = None


class Receipt(Preview):
    command_id: UUID


def scope_for(db, actor, tid, branch_id=None, write=False):
    scope = authorize(db, actor, tid, "drivers:write" if write else "drivers:read", branch_id=branch_id)
    if write:
        allow_write(scope.tenant)
    if scope.branch_id and branch_id != scope.branch_id:
        raise DomainError("FORBIDDEN", "Select your authorized location for this intake.", 403)
    return scope


def parse(db, scope, data):
    source = data.source.lstrip("\ufeff")
    if len(source.encode("utf8")) > 64000 or "\x00" in source:
        raise DomainError("INVALID_CSV", "Use UTF-8 metadata CSV up to 64 KB, without null bytes.", 422)
    try:
        reader = csv.DictReader(io.StringIO(source), strict=True)
        if reader.fieldnames != HEADERS:
            raise DomainError("INVALID_CSV", "Use the five documented columns in the documented order.", 422)
        rows = []
        seen = set()
        for number, raw in enumerate(reader, 1):
            if number > 100:
                raise DomainError("CSV_QUOTA", "Preview supports at most 100 metadata rows.", 422)
            errors = []
            if None in raw or any(v is None for v in raw.values()):
                errors.append("Column count does not match the header.")
            values = {key: (raw.get(key) or "").strip() for key in HEADERS}
            if any(not value or len(value) > 200 for value in values.values()):
                errors.append("Every field is required and limited to 200 characters.")
            if any(value.startswith(("=", "+", "-", "@")) for value in values.values()):
                errors.append("Spreadsheet formula prefixes are not accepted.")
            if values["client_ref"] != scope.tenant.customer_ref:
                errors.append("Client reference does not match this company.")
            try:
                reported = date.fromisoformat(values["reported_at"])
                if reported.isoformat() != values["reported_at"]:
                    raise ValueError()
            except ValueError:
                errors.append("Reported date must be YYYY-MM-DD.")
            if values["report_type"] not in {
                "motor_vehicle_record",
                "employment_verification",
                "background_screening",
            }:
                errors.append("Report type is not in the synthetic metadata schema.")
            key = hashlib.sha256(
                json.dumps([values["external_report_ref"], values["report_type"]]).encode()
            ).hexdigest()
            candidate = None
            status = "validation_failed" if errors else "unmatched"
            reason = "No current engagement matches this company driver reference in your scope."
            if not errors:
                query = (
                    select(DriverIdentity)
                    .join(
                        DriverEngagement,
                        (DriverEngagement.driver_id == DriverIdentity.id)
                        & (DriverEngagement.tenant_id == DriverIdentity.tenant_id),
                    )
                    .where(
                        DriverIdentity.tenant_id == scope.tenant.id,
                        DriverIdentity.reference == values["external_driver_ref"],
                        DriverEngagement.end_date.is_(None),
                    )
                )
                if data.branch_id:
                    query = query.where(DriverEngagement.branch_id == str(data.branch_id))
                driver = db.scalar(query)
                if driver:
                    candidate = {
                        "reference": driver.reference,
                        "name": driver.first_name + " " + driver.last_name,
                    }
                    status = "blocked_by_policy"
                    reason = "Exact-reference candidate found. Open the driver file and review supporting evidence against the matching requirement; nothing is attached yet."
                if key in seen:
                    status, reason = "duplicate_detected", "Repeated source report/type within this preview."
            seen.add(key)
            rows.append(
                {
                    "row_number": number,
                    "raw": raw,
                    "normalized": values,
                    "errors": errors,
                    "candidate": candidate,
                    "status": status,
                    "reason": "; ".join(errors) if errors else reason,
                    "source_key": key,
                }
            )
        if not rows:
            raise DomainError("INVALID_CSV", "Add at least one metadata row.", 422)
        return rows
    except csv.Error:
        raise DomainError("INVALID_CSV", "CSV could not be parsed. Check quoting and column structure.", 422)


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/intake-batches"

    @app.post(base + "/preview")
    def preview(tenant_id: UUID, data: Preview, actor: Actor, db: DB):
        scope = scope_for(db, actor, str(tenant_id), str(data.branch_id) if data.branch_id else None, True)
        if data.branch_id:
            branch_check(db, str(tenant_id), str(data.branch_id))
        return {
            "items": parse(db, scope, data),
            "persisted": False,
            "schema_version": "synthetic-metadata-v1",
        }

    @app.post(base, status_code=201)
    def receive(tenant_id: UUID, data: Receipt, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        branch = str(data.branch_id) if data.branch_id else None
        scope = scope_for(db, actor, tid, branch, True)
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        scope = scope_for(db, actor, tid, branch, True)
        digest = hashlib.sha256(json.dumps([data.source, branch]).encode()).hexdigest()
        prior = db.scalar(
            select(IntakeBatch).where(
                IntakeBatch.tenant_id == tid,
                IntakeBatch.actor_id == actor.id,
                IntakeBatch.command_id == str(data.command_id),
            )
        )
        if prior:
            if prior.source_hash != digest:
                raise DomainError(
                    "IDEMPOTENCY_CONFLICT", "This receipt command was already used with different input.", 409
                )
            return {"id": prior.id, "replayed": True}
        if branch:
            branch_check(db, tid, branch)
        rows = parse(db, scope, data)
        batch = IntakeBatch(
            tenant_id=tid,
            branch_id=branch,
            actor_id=actor.id,
            command_id=str(data.command_id),
            source_hash=digest,
            encrypted_source=encrypt(data.source),
        )
        db.add(batch)
        db.flush()
        db.add(
            IntakeJob(
                tenant_id=tid,
                batch_id=batch.id,
                actor_id=actor.id,
                correlation_id=request.state.correlation_id,
            )
        )
        for row in rows:
            # No candidate IDs or automatic links are persisted. Review must revalidate later.
            row["candidate"] = None
            if row["status"] not in {"validation_failed", "duplicate_detected"}:
                prior_item = db.scalar(
                    select(IntakeItem)
                    .join(IntakeBatch, IntakeBatch.id == IntakeItem.batch_id)
                    .where(
                        IntakeItem.tenant_id == tid,
                        IntakeItem.source_key == row["source_key"],
                        IntakeBatch.branch_id == branch,
                    )
                )
                if prior_item:
                    row["status"] = "duplicate_detected"
                    row["reason"] = (
                        "A receipt for this source report/type already exists in this intake scope."
                    )
            db.add(
                IntakeItem(
                    tenant_id=tid,
                    batch_id=batch.id,
                    row_number=row["row_number"],
                    encrypted_payload=encrypt(json.dumps(row)),
                    source_key=row["source_key"],
                    status=row["status"],
                )
            )
        record(
            db,
            actor,
            tid,
            "intake.received",
            batch.id,
            request.state.correlation_id,
            row_count=len(rows),
            source_channel="csv_metadata",
        )
        return {"id": batch.id, "replayed": False}

    @app.get(base)
    def listing(tenant_id: UUID, actor: Actor, db: DB, offset: int = Query(default=0, ge=0)):
        scope = authorize(db, actor, str(tenant_id), "drivers:write")
        query = select(IntakeBatch).where(IntakeBatch.tenant_id == str(tenant_id))
        if scope.branch_id:
            query = query.where(IntakeBatch.branch_id == scope.branch_id)
        total = db.scalar(select(func.count()).select_from(query.subquery()))
        batches = db.scalars(query.order_by(IntakeBatch.received_at.desc()).offset(offset).limit(25))
        return {
            "total": total,
            "items": [
                {
                    "id": b.id,
                    "received_at": b.received_at,
                    "source_channel": b.source_channel,
                    "schema_version": b.schema_version,
                }
                for b in batches
            ],
        }

    @app.get(base + "/{batch_id}")
    def detail(tenant_id: UUID, batch_id: UUID, actor: Actor, db: DB):
        scope = authorize(db, actor, str(tenant_id), "drivers:write")
        batch = db.scalar(
            select(IntakeBatch).where(
                IntakeBatch.id == str(batch_id), IntakeBatch.tenant_id == str(tenant_id)
            )
        )
        if not batch or (scope.branch_id and batch.branch_id != scope.branch_id):
            raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
        rows = db.scalars(
            select(IntakeItem).where(IntakeItem.batch_id == batch.id).order_by(IntakeItem.row_number)
        )
        return {
            "id": batch.id,
            "received_at": batch.received_at,
            "source_channel": batch.source_channel,
            "schema_version": batch.schema_version,
            "processing": job_output(db, batch.id),
            "items": [row_output(db, row) for row in rows],
        }

    @app.post(base + "/{batch_id}/retry")
    def retry(tenant_id: UUID, batch_id: UUID, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        scope = authorize(db, actor, tid, "drivers:write")
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        scope = authorize(db, actor, tid, "drivers:write")
        batch = db.scalar(
            select(IntakeBatch).where(IntakeBatch.id == str(batch_id), IntakeBatch.tenant_id == tid)
        )
        if not batch or (scope.branch_id and scope.branch_id != batch.branch_id):
            raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
        job = db.scalar(select(IntakeJob).where(IntakeJob.batch_id == batch.id).with_for_update())
        if not job or job.status not in {"blocked_by_policy", "dead_letter", "retry_scheduled"}:
            raise DomainError(
                "STATE_TRANSITION_DENIED", "Only failed or blocked processing can be retried.", 409
            )
        from app.models import now

        job.actor_id, job.status, job.attempts, job.available_at = actor.id, "queued", 0, now()
        job.error_code = None
        record(db, actor, tid, "intake.retry_requested", batch.id, request.state.correlation_id)
        return {"queued": True}

    @app.get(base + "/{batch_id}/items/{item_id}/driver-candidate")
    def candidate(tenant_id: UUID, batch_id: UUID, item_id: UUID, actor: Actor, db: DB):
        tid = str(tenant_id)
        scope = authorize(db, actor, tid, "drivers:write")
        batch = db.scalar(
            select(IntakeBatch).where(IntakeBatch.id == str(batch_id), IntakeBatch.tenant_id == tid)
        )
        if not batch or (scope.branch_id and batch.branch_id != scope.branch_id):
            raise DomainError("NOT_FOUND", "Source unavailable.", 404)
        item = db.scalar(
            select(IntakeItem).where(IntakeItem.id == str(item_id), IntakeItem.batch_id == batch.id)
        )
        if not item or item.status in {"validation_failed", "duplicate_detected"}:
            raise DomainError("SOURCE_MISMATCH", "Correct the source before selecting a driver file.", 409)
        payload = json.loads(decrypt(item.encrypted_payload))["normalized"]
        prior_link = (
            select(DriverRequirement.driver_id)
            .join(IntakeAttachment, IntakeAttachment.requirement_id == DriverRequirement.id)
            .join(DriverEngagement, DriverEngagement.id == DriverRequirement.engagement_id)
            .where(IntakeAttachment.source_item_id == item.id, IntakeAttachment.tenant_id == tid)
        )
        if scope.branch_id:
            prior_link = prior_link.where(DriverEngagement.branch_id == scope.branch_id)
        established_driver = db.scalar(prior_link.order_by(IntakeAttachment.attached_at.desc()).limit(1))
        if established_driver:
            return {"driver_id": established_driver, "source_item_id": item.id}
        query = (
            select(DriverIdentity)
            .join(
                DriverEngagement,
                (DriverEngagement.driver_id == DriverIdentity.id)
                & (DriverEngagement.tenant_id == DriverIdentity.tenant_id),
            )
            .where(
                DriverIdentity.tenant_id == tid,
                DriverIdentity.reference == payload["external_driver_ref"],
                DriverEngagement.end_date.is_(None),
            )
        )
        if scope.branch_id:
            query = query.where(DriverEngagement.branch_id == scope.branch_id)
        if batch.branch_id:
            query = query.where(DriverEngagement.branch_id == batch.branch_id)
        driver = db.scalar(query)
        if not driver:
            raise DomainError(
                "NO_DRIVER_CANDIDATE",
                "No current scoped driver matches this exact reference. Register or investigate the driver first.",
                409,
            )
        return {"driver_id": driver.id, "source_item_id": item.id}


def job_output(db, batch_id):
    job = db.scalar(select(IntakeJob).where(IntakeJob.batch_id == batch_id))
    return {"status": job.status, "attempts": job.attempts, "error_code": job.error_code} if job else None


def row_output(db, row):
    attachment = db.scalar(
        select(IntakeAttachment)
        .where(IntakeAttachment.source_item_id == row.id)
        .order_by(IntakeAttachment.attached_at.desc())
        .limit(1)
    )
    payload = json.loads(decrypt(row.encrypted_payload))
    payload["received_reason"] = payload["reason"]
    if attachment:
        payload["reason"] = (
            "Evidence was reviewed and linked to a driver requirement. This is not a legal qualification decision."
        )
    return dict(
        payload,
        id=row.id,
        received_status=row.status,
        status="attached" if attachment else row.status,
        attachment={
            "evidence_id": attachment.evidence_id,
            "requirement_id": attachment.requirement_id,
            "attached_at": attachment.attached_at,
        }
        if attachment
        else None,
    )
