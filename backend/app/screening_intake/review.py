"""Reviewed, append-only spreadsheet intake operations."""

import base64
import csv
import hashlib
import io
import json
from uuid import UUID
from fastapi import Request, Response
from pydantic import Field
from sqlalchemy import select, func
from app.models import (
    IntakeBatch,
    IntakeItem,
    IntakeSpreadsheetSource,
    IntakeCorrection,
    IntakeMatch,
    IntakeAttachment,
    EvidenceVersion,
    DriverEngagement,
    ExceptionCase,
)
from app.organizations.schemas import Input
from app.organizations.service import lock_tenant, branch_check
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.audit.service import record
from app.drivers.service import identity
from app.screening_intake.routes import Receipt, Preview, parse, scope_for, receive_metadata, HEADERS
from app.screening_intake.spreadsheet import inspect_file, canonical_source
from app.screening_intake.lineage import replacement, reviewed_match, lineage_ids
from app.exceptions.service import event


class SpreadsheetFile(Input):
    filename: str = Field(min_length=1, max_length=180)
    content_base64: str = Field(min_length=1, max_length=341336)
    sheet: str | None = Field(default=None, max_length=64)
    branch_id: UUID | None = None


class Mapped(SpreadsheetFile):
    mapping: dict[str, int]
    template_revision_id: UUID | None = None


class MappedReceipt(Mapped):
    command_id: UUID


class Correction(Input):
    command_id: UUID
    normalized: dict[str, str]
    reason: str = Field(min_length=20, max_length=2000)


class Match(Input):
    command_id: UUID
    driver_id: UUID
    engagement_id: UUID
    driver_version: int = Field(ge=1)
    engagement_version: int = Field(ge=1)
    verified_driver_reference: str = Field(min_length=1, max_length=64)
    basis: str = Field(min_length=20, max_length=2000)


def fingerprint(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def source_scope(db, actor, tid, bid, iid=None, write=False):
    scope = authorize(db, actor, tid, "drivers:write")
    if write:
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        scope = authorize(db, actor, tid, "drivers:write")
        if scope.role not in {"client_admin", "reviewer", "specialist"}:
            raise DomainError(
                "FORBIDDEN", "Reviewed intake changes require a specialist or reviewer role.", 403
            )
    batch = db.scalar(select(IntakeBatch).where(IntakeBatch.id == bid, IntakeBatch.tenant_id == tid))
    if not batch or (scope.branch_id and batch.branch_id != scope.branch_id):
        raise DomainError("NOT_FOUND", "Source unavailable.", 404)
    item = (
        db.scalar(select(IntakeItem).where(IntakeItem.id == iid, IntakeItem.batch_id == bid)) if iid else None
    )
    if iid and not item:
        raise DomainError("NOT_FOUND", "Source unavailable.", 404)
    return scope, batch, item


def prepare(db, actor, tid, data):
    branch = str(data.branch_id) if data.branch_id else None
    scope = scope_for(db, actor, tid, branch, True)
    if branch:
        branch_check(db, tid, branch)
    table, content = inspect_file(data.filename, data.content_base64, data.sheet)
    return scope, table, content


def mapped_source(db, actor, tid, data):
    scope, table, content = prepare(db, actor, tid, data)
    canonical = canonical_source(table, data.mapping, scope.tenant.customer_ref)
    if data.template_revision_id:
        from app.screening_intake.templates import check_application

        check_application(
            db,
            scope,
            str(data.branch_id) if data.branch_id else None,
            str(data.template_revision_id),
            table["columns"],
            data.mapping,
        )
    return scope, table, content, canonical


def validate_correction(db, actor, tid, bid, iid, data):
    scope, batch, item = source_scope(db, actor, tid, bid, iid, True)
    if (
        replacement(db, iid)
        or reviewed_match(db, iid)
        or db.scalar(select(EvidenceVersion.id).where(EvidenceVersion.source_item_id == iid).limit(1))
        or db.scalar(select(IntakeAttachment.id).where(IntakeAttachment.source_item_id == iid).limit(1))
    ):
        raise DomainError(
            "SOURCE_LOCKED",
            "This source is already reviewed, used or corrected. Open its current record instead.",
            409,
        )
    if item.status == "duplicate_detected":
        raise DomainError(
            "DUPLICATE_SOURCE",
            "Investigate the original receipt; duplicates cannot be relabeled through row correction.",
            409,
        )
    ancestors = lineage_ids(db, iid)
    if len(ancestors) >= 10:
        raise DomainError("CORRECTION_LIMIT", "Escalate this source after ten correction versions.", 409)
    if set(data.normalized) != set(HEADERS):
        raise DomainError("INVALID_CSV", "Supply all five canonical metadata fields.", 422)
    original = json.loads(decrypt(item.encrypted_payload))["normalized"]
    if data.normalized == original:
        raise DomainError("NO_CHANGE", "Change the incorrect metadata before recording a correction.", 422)
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(HEADERS)
    writer.writerow([data.normalized[f] for f in HEADERS])
    parsed = parse(db, scope, Preview(source=output.getvalue(), branch_id=batch.branch_id))
    if parsed[0]["errors"]:
        raise DomainError("INVALID_CSV", "; ".join(parsed[0]["errors"]), 422)
    duplicate = db.scalar(
        select(IntakeItem.id)
        .join(IntakeBatch, IntakeBatch.id == IntakeItem.batch_id)
        .where(
            IntakeItem.tenant_id == tid,
            IntakeItem.source_key == parsed[0]["source_key"],
            IntakeBatch.branch_id == batch.branch_id,
            IntakeItem.id.not_in(ancestors),
        )
        .limit(1)
    )
    if duplicate:
        raise DomainError(
            "DUPLICATE_SOURCE",
            "The corrected report/type already has a separate receipt in this scope.",
            409,
        )
    return batch, ancestors, output.getvalue(), parsed[0]


def correct_row(db, actor, tid, bid, iid, data, cid):
    scope, batch, item = source_scope(db, actor, tid, bid, iid, True)
    digest = fingerprint(data.model_dump())
    prior = db.scalar(
        select(IntakeCorrection).where(
            IntakeCorrection.tenant_id == tid,
            IntakeCorrection.actor_id == actor.id,
            IntakeCorrection.command_id == str(data.command_id),
        )
    )
    if prior:
        if prior.request_hash != digest:
            raise DomainError(
                "IDEMPOTENCY_CONFLICT", "Correction command was already used with different input.", 409
            )
        child = db.get(IntakeItem, prior.child_item_id)
        if prior.parent_item_id != iid:
            raise DomainError("IDEMPOTENCY_CONFLICT", "Correction command belongs to another row.", 409)
        return {"id": child.batch_id, "item_id": child.id, "replayed": True}
    batch, ancestors, source, _ = validate_correction(db, actor, tid, bid, iid, data)
    receipt = receive_metadata(
        db,
        actor,
        tid,
        Receipt(source=source, branch_id=batch.branch_id, command_id=data.command_id),
        cid,
        source_channel="corrected_metadata",
        superseded_ids=ancestors,
    )
    child = db.scalar(select(IntakeItem).where(IntakeItem.batch_id == receipt["id"]))
    db.add(
        IntakeCorrection(
            tenant_id=tid,
            parent_item_id=iid,
            child_item_id=child.id,
            actor_id=actor.id,
            command_id=str(data.command_id),
            request_hash=digest,
            encrypted_reason=encrypt(data.reason),
        )
    )
    for case in db.scalars(
        select(ExceptionCase)
        .where(ExceptionCase.tenant_id == tid, ExceptionCase.source_item_id.in_(ancestors))
        .with_for_update()
    ):
        case.version += 1
        event(
            db,
            case,
            actor,
            "intake.source_corrected",
            data.reason,
            replacement_item_id=child.id,
            replacement_batch_id=child.batch_id,
        )
    record(
        db,
        actor,
        tid,
        "intake.row_corrected",
        iid,
        cid,
        replacement_item_id=child.id,
    )
    return {"id": child.batch_id, "item_id": child.id, "replayed": False}


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/intake-batches"

    @app.post(base + "/spreadsheet/inspect")
    def inspect(tenant_id: UUID, data: SpreadsheetFile, actor: Actor, db: DB):
        _, table, _ = prepare(db, actor, str(tenant_id), data)
        return {
            "columns": table["columns"],
            "sheets": table["sheets"],
            "sheet": table["sheet"],
            "sample": table["rows"][:3],
            "row_count": len(table["rows"]),
        }

    @app.post(base + "/spreadsheet/preview")
    def preview(tenant_id: UUID, data: Mapped, actor: Actor, db: DB):
        scope, table, _, canonical = mapped_source(db, actor, str(tenant_id), data)
        rows = parse(db, scope, Preview(source=canonical, branch_id=data.branch_id))
        return {
            "items": rows,
            "persisted": False,
            "sheet": table["sheet"],
            "mapping_version": "column-map-v1",
        }

    @app.post(base + "/spreadsheet/receive", status_code=201)
    def receive(tenant_id: UUID, data: MappedReceipt, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        scope_for(db, actor, tid, str(data.branch_id) if data.branch_id else None, True)
        # Preserve command replay for receipts recorded before saved mappings existed.
        digest = fingerprint(
            data.model_dump(exclude={"template_revision_id"} if data.template_revision_id is None else set())
        )
        prior = db.scalar(
            select(IntakeBatch).where(
                IntakeBatch.tenant_id == tid,
                IntakeBatch.actor_id == actor.id,
                IntakeBatch.command_id == str(data.command_id),
            )
        )
        if prior:
            original = db.get(IntakeSpreadsheetSource, prior.id)
            if not original or original.request_hash != digest:
                raise DomainError(
                    "IDEMPOTENCY_CONFLICT",
                    "Import command was used with a different file, sheet or mapping.",
                    409,
                )
            return {"id": prior.id, "replayed": True}
        if (
            db.scalar(
                select(func.count())
                .select_from(IntakeSpreadsheetSource)
                .where(IntakeSpreadsheetSource.tenant_id == tid)
            )
            >= 100
        ):
            raise DomainError(
                "IMPORT_QUOTA",
                "The local synthetic workspace is limited to 100 mapped imports per company.",
                429,
            )
        _, table, content, canonical = mapped_source(db, actor, tid, data)
        saved_template = None
        if data.template_revision_id:
            from app.models import IntakeMappingTemplate

            saved = db.get(IntakeMappingTemplate, str(data.template_revision_id))
            config = json.loads(decrypt(saved.encrypted_configuration))
            saved_template = {"name": config["name"], "revision": saved.revision}
        result = receive_metadata(
            db,
            actor,
            tid,
            Receipt(source=canonical, branch_id=data.branch_id, command_id=data.command_id),
            request.state.correlation_id,
            source_channel="mapped_spreadsheet",
        )
        db.add(
            IntakeSpreadsheetSource(
                batch_id=result["id"],
                tenant_id=tid,
                encrypted_original=encrypt(base64.b64encode(content).decode()),
                encrypted_metadata=encrypt(
                    json.dumps(
                        {
                            "filename": data.filename,
                            "sheet": table["sheet"],
                            "mapping": data.mapping,
                            "columns": table["columns"],
                            "saved_template": saved_template,
                            "template_revision_id": str(data.template_revision_id)
                            if data.template_revision_id
                            else None,
                        }
                    )
                ),
                sha256=hashlib.sha256(content).hexdigest(),
                request_hash=digest,
            )
        )
        record(
            db,
            actor,
            tid,
            "intake.mapping_recorded",
            result["id"],
            request.state.correlation_id,
            mapping_version="column-map-v1",
            row_count=len(table["rows"]),
        )
        return result

    item_base = base + "/{batch_id}/items/{item_id}"

    @app.post(item_base + "/corrections", status_code=201)
    def correct(
        tenant_id: UUID,
        batch_id: UUID,
        item_id: UUID,
        data: Correction,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        return correct_row(
            db, actor, str(tenant_id), str(batch_id), str(item_id), data, request.state.correlation_id
        )

    @app.post(item_base + "/match", status_code=201)
    def match(
        tenant_id: UUID, batch_id: UUID, item_id: UUID, data: Match, actor: Actor, db: DB, request: Request
    ):
        tid, bid, iid = str(tenant_id), str(batch_id), str(item_id)
        scope, batch, item = source_scope(db, actor, tid, bid, iid, True)
        if replacement(db, iid) or item.status in {"validation_failed", "duplicate_detected"}:
            raise DomainError(
                "SOURCE_MISMATCH", "Correct the source or open its replacement before matching.", 409
            )
        digest = fingerprint(data.model_dump())
        prior = reviewed_match(db, iid)
        if prior:
            if (
                prior.actor_id == actor.id
                and prior.command_id == str(data.command_id)
                and prior.request_hash == digest
            ):
                return {"id": prior.id, "replayed": True}
            raise DomainError(
                "MATCH_EXISTS", "This source already has a reviewed match. Refresh its record.", 409
            )
        reused = db.scalar(
            select(IntakeMatch.id).where(
                IntakeMatch.tenant_id == tid,
                IntakeMatch.actor_id == actor.id,
                IntakeMatch.command_id == str(data.command_id),
            )
        )
        if reused:
            raise DomainError("IDEMPOTENCY_CONFLICT", "Match command belongs to another source row.", 409)
        _, driver = identity(db, actor, tid, str(data.driver_id), "drivers:write")
        engagement = db.scalar(
            select(DriverEngagement).where(
                DriverEngagement.id == str(data.engagement_id),
                DriverEngagement.tenant_id == tid,
                DriverEngagement.driver_id == driver.id,
            )
        )
        if (
            not engagement
            or engagement.end_date
            or (scope.branch_id and engagement.branch_id != scope.branch_id)
            or (batch.branch_id and engagement.branch_id != batch.branch_id)
        ):
            raise DomainError(
                "SOURCE_MISMATCH", "Select a current engagement in this source's authorized location.", 409
            )
        if driver.version != data.driver_version or engagement.version != data.engagement_version:
            raise DomainError(
                "VERSION_CONFLICT", "The driver or engagement changed. Search and verify again.", 409
            )
        normalized = json.loads(decrypt(item.encrypted_payload))["normalized"]
        if (
            data.verified_driver_reference != driver.reference
            or normalized["external_driver_ref"] != driver.reference
        ):
            raise DomainError(
                "SOURCE_MISMATCH",
                "The trusted reference must agree with both records. Correct the source first; names alone cannot establish a match.",
                409,
            )
        matched = IntakeMatch(
            tenant_id=tid,
            source_item_id=iid,
            driver_id=driver.id,
            engagement_id=engagement.id,
            driver_version=driver.version,
            engagement_version=engagement.version,
            actor_id=actor.id,
            command_id=str(data.command_id),
            request_hash=digest,
            encrypted_basis=encrypt(data.basis),
        )
        db.add(matched)
        db.flush()
        record(
            db,
            actor,
            tid,
            "intake.match_reviewed",
            matched.id,
            request.state.correlation_id,
            source_item_id=iid,
            driver_id=driver.id,
            engagement_id=engagement.id,
        )
        return {"id": matched.id, "replayed": False}

    @app.get(base + "/{batch_id}/errors.csv")
    def errors(tenant_id: UUID, batch_id: UUID, actor: Actor, db: DB, request: Request):
        tid, bid = str(tenant_id), str(batch_id)
        source_scope(db, actor, tid, bid)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["row_number", *HEADERS, "outcome", "reason"])
        count = 0
        for item in db.scalars(
            select(IntakeItem).where(IntakeItem.batch_id == bid).order_by(IntakeItem.row_number)
        ):
            if replacement(db, item.id) or item.status not in {
                "validation_failed",
                "unmatched",
                "duplicate_detected",
            }:
                continue
            payload = json.loads(decrypt(item.encrypted_payload))
            values = [
                str(item.row_number),
                *[payload["normalized"][f] for f in HEADERS],
                item.status,
                payload["reason"],
            ]
            writer.writerow(
                [
                    "'" + v
                    if v.lstrip().startswith(("=", "+", "-", "@")) or v.startswith(("\t", "\r", "\n"))
                    else v
                    for v in values
                ]
            )
            count += 1
        record(db, actor, tid, "intake.errors_exported", bid, request.state.correlation_id, row_count=count)
        return Response(
            output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=metadata-row-errors.csv",
                "Cache-Control": "no-store",
            },
        )
