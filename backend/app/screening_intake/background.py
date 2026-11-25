"""Private, bounded background inspection/validation/recording with expiring leases."""

import base64
import csv
import hashlib
import io
import json
from datetime import timedelta
from pathlib import PurePosixPath
from uuid import UUID, uuid5
from fastapi import Request, Query
from pydantic import Field
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import Session, defer
from app.db import engine
from app.models import (
    SpreadsheetImportSource as Source,
    SpreadsheetImportJob as Job,
    SpreadsheetImportPart as Part,
    IntakeBatch,
    IntakeItem,
    User,
    Tenant,
    now,
    uid,
)
from app.organizations.schemas import Input
from app.organizations.service import lock_tenant, branch_check
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.audit.service import record
from app.screening_intake.review import fingerprint
from app.screening_intake.routes import Receipt, Preview, parse, receive_metadata, HEADERS
from app.screening_intake.spreadsheet import inspect_file, canonical_source
from app.screening_intake.templates import check_application

MAX_FILE = 2_000_000
MAX_ROWS = 1000
PART_SIZE = 50


class Upload(Input):
    command_id: UUID
    filename: str = Field(min_length=1, max_length=180)
    content_base64: str = Field(min_length=1, max_length=2_666_668)
    branch_id: UUID | None = None
    sheet: str | None = Field(default=None, max_length=64)


class Version(Input):
    version: int = Field(ge=1)


class Configure(Version):
    mapping: dict[str, int] = Field(min_length=5, max_length=5)
    template_revision_id: UUID | None = None


class Worksheet(Version):
    sheet: str = Field(min_length=1, max_length=64)


def authority(db, actor, source, write=False):
    scope = authorize(db, actor, source.tenant_id, "drivers:write")
    if scope.branch_id and scope.branch_id != source.branch_id:
        raise DomainError("NOT_FOUND", "Import unavailable in your location.", 404)
    if write:
        allow_write(scope.tenant)
    return scope


def scoped(db, actor, tid, jid, write=False):
    if write:
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
    source = db.scalar(
        select(Source).options(defer(Source.encrypted_file)).where(Source.id == jid, Source.tenant_id == tid)
    )
    if not source:
        raise DomainError("NOT_FOUND", "Import unavailable.", 404)
    scope = authority(db, actor, source, write)
    if write and source.actor_id != actor.id and scope.role not in {"client_admin", "specialist", "reviewer"}:
        raise DomainError(
            "FORBIDDEN",
            "Only the uploader or authorized administration/review staff can control this import.",
            403,
        )
    job = db.scalar(
        select(Job)
        .options(defer(Job.encrypted_table), defer(Job.encrypted_preview))
        .where(Job.id == jid)
        .with_for_update()
        if write
        else select(Job)
        .options(defer(Job.encrypted_table), defer(Job.encrypted_preview))
        .where(Job.id == jid)
    )
    return scope, source, job


def template(db, scope, source, job):
    config = json.loads(decrypt(job.encrypted_config))
    table = json.loads(decrypt(job.encrypted_table))
    if config.get("template_revision_id"):
        check_application(
            db, scope, source.branch_id, config["template_revision_id"], table["columns"], config["mapping"]
        )
    return config, table


def chunks(canonical):
    rows = list(csv.reader(io.StringIO(canonical)))
    header = ",".join(HEADERS) + "\n"
    current = []
    offset = 0
    size = len(header)
    for row in rows[1:]:
        output = io.StringIO()
        csv.writer(output, lineterminator="\n").writerow(row)
        text = output.getvalue()
        length = len(text.encode("utf8"))
        if current and (len(current) >= PART_SIZE or size + length > 60000):
            yield offset, header + "".join(current), len(current)
            offset += len(current)
            current = []
            size = len(header)
        current.append(text)
        size += length
    if current:
        yield offset, header + "".join(current), len(current)


def provenance(db, batch_id):
    part = db.scalar(select(Part).where(Part.batch_id == batch_id))
    if not part:
        return None
    source = db.get(Source, part.source_id)
    job = db.get(Job, part.source_id)
    meta = json.loads(decrypt(source.encrypted_metadata))
    config = json.loads(decrypt(job.encrypted_config))
    table = json.loads(decrypt(job.encrypted_table))
    return dict(
        filename=meta["filename"],
        sheet=table["sheet"],
        mapping=config["mapping"],
        columns=table["columns"],
        sha256=source.sha256,
        mapping_version="background-column-map-v1",
        background_source_id=source.id,
        first_source_row=part.first_row,
        last_source_row=part.first_row + part.row_count - 1,
        template_revision_id=config.get("template_revision_id"),
    )


def output(db, source, job, offset=0, full=True, can_manage=True):
    meta = json.loads(decrypt(source.encrypted_metadata))
    table = (
        json.loads(decrypt(job.encrypted_table))
        if full
        and job.status in {"awaiting_mapping", "awaiting_confirmation", "failed"}
        and job.encrypted_table
        else None
    )
    preview = (
        json.loads(decrypt(job.encrypted_preview))
        if full and job.status == "awaiting_confirmation" and job.encrypted_preview
        else None
    )
    parts = list(db.scalars(select(Part).where(Part.source_id == source.id).order_by(Part.part_number)))
    return dict(
        id=source.id,
        filename=meta["filename"],
        created_at=source.created_at,
        branch_id=source.branch_id,
        status=job.status,
        phase=job.phase,
        version=job.version,
        attempts=job.attempts,
        error_code=job.error_code,
        can_manage=can_manage,
        can_confirm=can_manage and job.status == "awaiting_confirmation",
        can_map=can_manage
        and job.status in {"awaiting_mapping", "awaiting_confirmation", "failed"}
        and job.confirmed_version is None
        and job.encrypted_table is not None,
        can_cancel=can_manage and job.status not in {"completed", "canceled"},
        row_count=job.row_count,
        recorded_rows=job.processed_rows,
        sha256=source.sha256,
        inspection=dict(
            columns=table["columns"], sheets=table["sheets"], sheet=table["sheet"], sample=table["rows"][:3]
        )
        if table
        else None,
        configuration=json.loads(decrypt(job.encrypted_config)),
        preview=dict(
            total=len(preview["items"]),
            offset=offset,
            items=preview["items"][offset : offset + 25],
            counts={
                s: sum(r["status"] == s for r in preview["items"])
                for s in {r["status"] for r in preview["items"]}
            },
        )
        if preview
        else None,
        parts=[
            dict(batch_id=p.batch_id, first_row=p.first_row, last_row=p.first_row + p.row_count - 1)
            for p in parts
        ],
        can_retry=can_manage
        and job.status == "failed"
        and job.attempts < 3
        and job.error_code in {"SCAN_UNAVAILABLE", "IMPORT_WORKER_FAILED", "IMPORT_LEASE_EXPIRED"},
    )


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/spreadsheet-imports"

    @app.post(base, status_code=202)
    def upload(tenant_id: UUID, data: Upload, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        branch = str(data.branch_id) if data.branch_id else None
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        scope = authorize(db, actor, tid, "drivers:write", branch_id=branch)
        if scope.branch_id and scope.branch_id != branch:
            raise DomainError("FORBIDDEN", "Select your authorized intake location.", 403)
        if branch:
            branch_check(db, tid, branch)
        digest = fingerprint(data.model_dump())
        prior = db.scalar(
            select(Source).where(
                Source.tenant_id == tid,
                Source.actor_id == actor.id,
                Source.command_id == str(data.command_id),
            )
        )
        if prior:
            if prior.request_hash != digest:
                raise DomainError(
                    "IDEMPOTENCY_CONFLICT", "Upload command was used with different input.", 409
                )
            return {"id": prior.id, "replayed": True}
        try:
            content = base64.b64decode(data.content_base64, validate=True)
        except ValueError:
            raise DomainError("INVALID_SPREADSHEET", "Choose a valid metadata file.", 422)
        if (
            not content
            or len(content) > MAX_FILE
            or PurePosixPath(data.filename.replace("\\", "/")).suffix.lower() not in {".csv", ".xlsx"}
        ):
            raise DomainError("INVALID_SPREADSHEET", "Choose CSV or XLSX up to 2 MB.", 422)
        if db.scalar(select(func.count()).select_from(Source).where(Source.tenant_id == tid)) >= 20:
            raise DomainError(
                "IMPORT_QUOTA", "Local synthetic companies support up to 20 background uploads.", 429
            )
        source = Source(
            tenant_id=tid,
            branch_id=branch,
            actor_id=actor.id,
            command_id=str(data.command_id),
            request_hash=digest,
            sha256=hashlib.sha256(content).hexdigest(),
            encrypted_file=encrypt(data.content_base64),
            encrypted_metadata=encrypt(json.dumps(dict(filename=data.filename))),
        )
        db.add(source)
        db.flush()
        db.add(
            Job(
                id=source.id,
                tenant_id=tid,
                encrypted_config=encrypt(json.dumps(dict(sheet=data.sheet))),
                correlation_id=request.state.correlation_id,
            )
        )
        record(
            db,
            actor,
            tid,
            "intake.background_upload_received",
            source.id,
            request.state.correlation_id,
            size_bytes=len(content),
        )
        return {"id": source.id, "replayed": False}

    @app.get(base)
    def listing(tenant_id: UUID, actor: Actor, db: DB):
        tid = str(tenant_id)
        scope = authorize(db, actor, tid, "drivers:write")
        query = select(Source).options(defer(Source.encrypted_file)).where(Source.tenant_id == tid)
        if scope.branch_id:
            query = query.where(Source.branch_id == scope.branch_id)
        return {
            "items": [
                output(
                    db,
                    s,
                    db.get(Job, s.id, options=[defer(Job.encrypted_table), defer(Job.encrypted_preview)]),
                    full=False,
                    can_manage=s.actor_id == actor.id
                    or scope.role in {"client_admin", "specialist", "reviewer"},
                )
                for s in db.scalars(query.order_by(Source.created_at.desc()).limit(20))
            ]
        }

    @app.get(base + "/{import_id}")
    def detail(
        tenant_id: UUID, import_id: UUID, actor: Actor, db: DB, offset: int = Query(default=0, ge=0, le=1000)
    ):
        scope, source, job = scoped(db, actor, str(tenant_id), str(import_id))
        return output(
            db,
            source,
            job,
            offset,
            can_manage=source.actor_id == actor.id
            or scope.role in {"client_admin", "specialist", "reviewer"},
        )

    @app.post(base + "/{import_id}/mapping", status_code=202)
    def mapping(tenant_id: UUID, import_id: UUID, data: Configure, actor: Actor, db: DB, request: Request):
        scope, source, job = scoped(db, actor, str(tenant_id), str(import_id), True)
        if (
            job.version != data.version
            or job.confirmed_version is not None
            or job.status not in {"awaiting_mapping", "awaiting_confirmation", "failed"}
            or not job.encrypted_table
        ):
            raise DomainError("VERSION_CONFLICT", "Reload the import before changing its mapping.", 409)
        table = json.loads(decrypt(job.encrypted_table))
        canonical_source({**table, "rows": [], "numeric": []}, data.mapping, scope.tenant.customer_ref)
        if data.template_revision_id:
            check_application(
                db, scope, source.branch_id, str(data.template_revision_id), table["columns"], data.mapping
            )
        job.encrypted_config = encrypt(
            json.dumps(
                dict(
                    sheet=table["sheet"],
                    mapping=data.mapping,
                    template_revision_id=str(data.template_revision_id)
                    if data.template_revision_id
                    else None,
                )
            )
        )
        job.status, job.phase, job.attempts, job.error_code = "queued", "validate", 0, None
        job.version += 1
        job.encrypted_preview = None
        record(
            db,
            actor,
            source.tenant_id,
            "intake.background_mapping_queued",
            source.id,
            request.state.correlation_id,
        )
        return {"id": job.id, "version": job.version}

    @app.post(base + "/{import_id}/sheet", status_code=202)
    def sheet(tenant_id: UUID, import_id: UUID, data: Worksheet, actor: Actor, db: DB, request: Request):
        _, source, job = scoped(db, actor, str(tenant_id), str(import_id), True)
        if (
            job.version != data.version
            or job.confirmed_version is not None
            or job.status not in {"awaiting_mapping", "awaiting_confirmation", "failed"}
        ):
            raise DomainError("VERSION_CONFLICT", "Reload before choosing a worksheet.", 409)
        job.encrypted_config = encrypt(json.dumps(dict(sheet=data.sheet)))
        job.status, job.phase, job.attempts, job.error_code = "queued", "inspect", 0, None
        job.encrypted_table, job.encrypted_preview = None, None
        job.row_count = 0
        job.version += 1
        record(
            db,
            actor,
            source.tenant_id,
            "intake.background_worksheet_queued",
            source.id,
            request.state.correlation_id,
        )
        return {"id": job.id}

    @app.post(base + "/{import_id}/confirm", status_code=202)
    def confirm(tenant_id: UUID, import_id: UUID, data: Version, actor: Actor, db: DB, request: Request):
        scope, source, job = scoped(db, actor, str(tenant_id), str(import_id), True)
        if job.confirmed_version is not None:
            if job.confirmed_version != data.version:
                raise DomainError("VERSION_CONFLICT", "Confirmation belongs to an older preview.", 409)
            return {"id": job.id, "replayed": True}
        if job.version != data.version or job.status != "awaiting_confirmation":
            raise DomainError("VERSION_CONFLICT", "Wait for validation and review the current preview.", 409)
        template(db, scope, source, job)
        job.confirmed_version = data.version
        job.status, job.phase, job.attempts, job.error_code = "queued", "record", 0, None
        job.version += 1
        record(
            db,
            actor,
            source.tenant_id,
            "intake.background_receipts_confirmed",
            source.id,
            request.state.correlation_id,
            row_count=job.row_count,
        )
        return {"id": job.id, "replayed": False}

    @app.post(base + "/{import_id}/{action}")
    def action(
        tenant_id: UUID, import_id: UUID, action: str, data: Version, actor: Actor, db: DB, request: Request
    ):
        _, source, job = scoped(db, actor, str(tenant_id), str(import_id), True)
        if job.version != data.version:
            raise DomainError("VERSION_CONFLICT", "Import changed. Refresh first.", 409)
        if action == "cancel" and job.status not in {"completed", "canceled"}:
            job.status = "canceled"
            job.lease_token = None
            job.lease_until = None
        elif action == "retry" and (
            job.status == "failed"
            and job.attempts < 3
            and job.error_code in {"SCAN_UNAVAILABLE", "IMPORT_WORKER_FAILED", "IMPORT_LEASE_EXPIRED"}
        ):
            job.status = "queued"
            job.error_code = None
        else:
            raise DomainError("INVALID_TRANSITION", "This import cannot perform that action.", 409)
        job.version += 1
        record(
            db,
            actor,
            source.tenant_id,
            "intake.background_" + action,
            source.id,
            request.state.correlation_id,
            recorded_rows=job.processed_rows,
        )
        return {"id": job.id}


def process_pending(limit=1):
    completed = 0
    for _ in range(limit):
        with Session(engine()) as db, db.begin():
            job = db.scalar(
                select(Job)
                .where(or_(Job.status == "queued", and_(Job.status == "processing", Job.lease_until < now())))
                .order_by(Job.id)
                .limit(1)
            )
            if not job:
                break
            if not db.scalar(
                select(Tenant).where(Tenant.id == job.tenant_id).with_for_update(skip_locked=True)
            ):
                break
            job = db.scalar(
                select(Job)
                .where(Job.id == job.id)
                .with_for_update(skip_locked=True)
                .execution_options(populate_existing=True)
            )
            if (
                not job
                or job.status not in {"queued", "processing"}
                or (job.status == "processing" and job.lease_until and job.lease_until > now())
            ):
                continue
            if job.attempts >= 3:
                job.status, job.error_code = "failed", "IMPORT_LEASE_EXPIRED"
                job.version += 1
                continue
            source = db.get(Source, job.id)
            actor = db.get(User, source.actor_id)
            try:
                authority(db, actor, source, True)
            except DomainError:
                job.status, job.error_code = "failed", "CURRENT_AUTHORIZATION_DENIED"
                job.version += 1
                continue
            job.status, job.lease_token, job.lease_until = "processing", uid(), now() + timedelta(minutes=5)
            job.attempts += 1
            job.version += 1
            jid, tid, lease, phase = job.id, job.tenant_id, job.lease_token, job.phase
            sealed_file, sealed_metadata, sealed_config = (
                source.encrypted_file if phase == "inspect" else None,
                source.encrypted_metadata,
                job.encrypted_config,
            )
            expected_hash = source.sha256
        try:
            try:
                encoded = decrypt(sealed_file) if sealed_file else None
                meta = json.loads(decrypt(sealed_metadata))
                config = json.loads(decrypt(sealed_config))
            except Exception:
                raise DomainError(
                    "IMPORT_SOURCE_UNREADABLE", "Stored import source could not be opened safely.", 409
                )
            table = None
            if phase == "inspect":
                if hashlib.sha256(base64.b64decode(encoded, validate=True)).hexdigest() != expected_hash:
                    raise DomainError("IMPORT_INTEGRITY_ERROR", "Stored source integrity check failed.", 409)
                table, _ = inspect_file(
                    meta["filename"],
                    encoded,
                    config.get("sheet"),
                    max_rows=MAX_ROWS,
                    max_file=MAX_FILE,
                    max_csv=MAX_FILE,
                    max_expanded=8_000_000,
                )
            with Session(engine()) as db, db.begin():
                db.scalar(select(Tenant).where(Tenant.id == tid).with_for_update())
                job = db.scalar(
                    select(Job)
                    .options(defer(Job.encrypted_table), defer(Job.encrypted_preview))
                    .where(Job.id == jid)
                    .with_for_update()
                )
                if job.status != "processing" or job.lease_token != lease:
                    continue
                source = db.get(Source, jid)
                actor = db.get(User, source.actor_id)
                scope = authority(db, actor, source, True)
                if phase == "inspect":
                    job.encrypted_table = encrypt(json.dumps(table))
                    job.row_count = len(table["rows"])
                    job.status = "awaiting_mapping"
                elif phase == "validate":
                    config, table = template(db, scope, source, job)
                    canonical = canonical_source(
                        {**table, "numeric": []},
                        config["mapping"],
                        scope.tenant.customer_ref,
                        max_bytes=1_500_000,
                    )
                    items, seen = [], set()
                    prior_keys = set(
                        db.scalars(
                            select(IntakeItem.source_key)
                            .join(IntakeBatch, IntakeBatch.id == IntakeItem.batch_id)
                            .where(IntakeItem.tenant_id == tid, IntakeBatch.branch_id == source.branch_id)
                        )
                    )
                    for offset, text, _ in chunks(canonical):
                        for row in parse(db, scope, Preview(source=text, branch_id=source.branch_id)):
                            row["row_number"] += offset
                            numeric = table["numeric"][row["row_number"] - 1] if table["numeric"] else []
                            if any(
                                config["mapping"][f] in numeric
                                for f in ["client_ref", "external_driver_ref", "external_report_ref"]
                            ):
                                row["status"], row["reason"], row["numeric_identifier"] = (
                                    "validation_failed",
                                    "Identifier cells must be text or explicit zero-padded Excel identifiers. Verify the source before correcting this row.",
                                    True,
                                )
                            if row["status"] != "validation_failed" and (
                                row["source_key"] in seen or row["source_key"] in prior_keys
                            ):
                                row["status"], row["reason"] = (
                                    "duplicate_detected",
                                    "Report/type already appears in this source or intake location.",
                                )
                            seen.add(row["source_key"])
                            row["candidate"] = None
                            items.append(row)
                    job.encrypted_preview = encrypt(json.dumps(dict(canonical=canonical, items=items)))
                    job.status = "awaiting_confirmation"
                elif phase == "record":
                    template(db, scope, source, job)
                    preview = json.loads(decrypt(job.encrypted_preview))
                    next_part = next(
                        (p for p in chunks(preview["canonical"]) if p[0] == job.processed_rows), None
                    )
                    if not next_part:
                        raise DomainError(
                            "IMPORT_CURSOR_ERROR",
                            "Recorded cursor does not agree with the validated rows.",
                            409,
                        )
                    offset, text, count = next_part
                    result = receive_metadata(
                        db,
                        actor,
                        tid,
                        Receipt(
                            source=text, branch_id=source.branch_id, command_id=uuid5(UUID(jid), str(offset))
                        ),
                        job.correlation_id,
                        source_channel="background_spreadsheet",
                        row_errors={
                            i + 1: r["reason"]
                            for i, r in enumerate(preview["items"][offset : offset + count])
                            if r.get("numeric_identifier")
                        },
                        row_offset=offset,
                    )
                    db.add(
                        Part(
                            tenant_id=tid,
                            source_id=jid,
                            batch_id=result["id"],
                            part_number=db.scalar(
                                select(func.count()).select_from(Part).where(Part.source_id == jid)
                            )
                            + 1,
                            first_row=offset + 1,
                            row_count=count,
                        )
                    )
                    job.processed_rows += count
                    job.attempts = 0
                    job.status = "completed" if job.processed_rows == job.row_count else "queued"
                else:
                    raise DomainError("IMPORT_PHASE_ERROR", "Import phase is unavailable.", 409)
                job.error_code = None
                job.lease_token = None
                job.lease_until = None
                job.version += 1
                record(
                    db,
                    actor,
                    tid,
                    "intake.background_phase_completed",
                    jid,
                    job.correlation_id,
                    phase=phase,
                    recorded_rows=job.processed_rows,
                )
            completed += 1
        except Exception as error:
            code = error.code if isinstance(error, DomainError) else "IMPORT_WORKER_FAILED"
            with Session(engine()) as db, db.begin():
                db.scalar(select(Tenant).where(Tenant.id == tid).with_for_update())
                job = db.scalar(
                    select(Job)
                    .options(defer(Job.encrypted_table), defer(Job.encrypted_preview))
                    .where(Job.id == jid)
                    .with_for_update()
                )
                if job.status != "processing" or job.lease_token != lease:
                    continue
                job.status, job.error_code = "failed", code
                job.lease_token = None
                job.lease_until = None
                job.version += 1
                record(
                    db,
                    db.get(User, db.get(Source, jid).actor_id),
                    tid,
                    "intake.background_phase_failed",
                    jid,
                    job.correlation_id,
                    phase=phase,
                    error_code=code,
                )
    return completed
