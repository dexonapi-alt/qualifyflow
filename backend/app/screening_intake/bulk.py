"""Bounded bulk corrections reuse the single-row invariants and preserve every outcome."""

import json
from typing import Annotated
from uuid import UUID, uuid5
from fastapi import Request
from pydantic import Field
from sqlalchemy import select, func
from app.models import IntakeCorrectionRun, IntakeItem, User
from app.organizations.schemas import Input
from app.screening_intake.review import (
    Correction,
    correct_row,
    validate_correction,
    source_scope,
    fingerprint,
)
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.audit.service import record


class RowCorrection(Input):
    item_id: UUID
    normalized: dict[Annotated[str, Field(max_length=40)], Annotated[str, Field(max_length=200)]] = Field(
        min_length=5, max_length=5
    )


class BulkCorrection(Input):
    command_id: UUID
    reason: str = Field(min_length=20, max_length=2000)
    items: list[RowCorrection] = Field(min_length=1, max_length=25)


def checked_rows(db, actor, tid, bid, data):
    source_scope(db, actor, tid, bid, write=True)
    if len(data.reason.strip()) < 20:
        raise DomainError(
            "INVALID_REASON", "Record a meaningful correction basis of at least 20 characters.", 422
        )
    ids = [str(row.item_id) for row in data.items]
    if len(set(ids)) != len(ids):
        raise DomainError("DUPLICATE_SELECTION", "Select each source row only once.", 422)
    rows = {
        r.id: r
        for r in db.scalars(
            select(IntakeItem).where(
                IntakeItem.tenant_id == tid, IntakeItem.batch_id == bid, IntakeItem.id.in_(ids)
            )
        )
    }
    if len(rows) != len(ids):
        raise DomainError("NOT_FOUND", "One or more source rows are unavailable in this receipt.", 404)
    return rows


def row_command(data, bid, row):
    return Correction(
        command_id=uuid5(data.command_id, bid + ":" + str(row.item_id)),
        normalized=row.normalized,
        reason=data.reason,
    )


def failed(error):
    return dict(
        outcome="unchanged" if error.code == "NO_CHANGE" else "blocked",
        code=error.code,
        message=error.message,
    )


def output(db, run):
    payload = json.loads(decrypt(run.encrypted_payload))
    return dict(
        id=run.id,
        created_at=run.created_at,
        items=payload["items"],
        reason=payload["reason"],
        actor=db.get(User, run.actor_id).email,
    )


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/intake-batches/{batch_id}/correction-runs"

    @app.post(base + "/preview")
    def preview(tenant_id: UUID, batch_id: UUID, data: BulkCorrection, actor: Actor, db: DB):
        tid, bid = str(tenant_id), str(batch_id)
        originals = checked_rows(db, actor, tid, bid, data)
        results, keys = [], set()
        for row in data.items:
            result = dict(
                item_id=str(row.item_id),
                row_number=originals[str(row.item_id)].row_number,
                normalized=row.normalized,
            )
            try:
                _, _, _, parsed = validate_correction(
                    db, actor, tid, bid, str(row.item_id), row_command(data, bid, row)
                )
                if parsed["source_key"] in keys:
                    raise DomainError(
                        "DUPLICATE_SOURCE",
                        "Another selected correction uses this report/type. Review the conflict.",
                        409,
                    )
                keys.add(parsed["source_key"])
                result.update(outcome="ready", code=None, message=parsed["reason"])
            except DomainError as error:
                if error.status in {401, 403, 404}:
                    raise
                result.update(failed(error))
            results.append(result)
        return {"persisted": False, "items": results}

    @app.post(base, status_code=201)
    def receive(
        tenant_id: UUID, batch_id: UUID, data: BulkCorrection, actor: Actor, db: DB, request: Request
    ):
        tid, bid = str(tenant_id), str(batch_id)
        originals = checked_rows(db, actor, tid, bid, data)
        digest = fingerprint({**data.model_dump(), "batch_id": bid})
        prior = db.scalar(
            select(IntakeCorrectionRun).where(
                IntakeCorrectionRun.tenant_id == tid,
                IntakeCorrectionRun.actor_id == actor.id,
                IntakeCorrectionRun.command_id == str(data.command_id),
            )
        )
        if prior:
            if prior.request_hash != digest:
                raise DomainError(
                    "IDEMPOTENCY_CONFLICT",
                    "Correction run command was already used with different input.",
                    409,
                )
            return {**output(db, prior), "replayed": True}
        if (
            db.scalar(
                select(func.count())
                .select_from(IntakeCorrectionRun)
                .where(IntakeCorrectionRun.tenant_id == tid)
            )
            >= 100
        ):
            raise DomainError(
                "CORRECTION_RUN_QUOTA",
                "Local synthetic companies support up to 100 recorded correction runs.",
                429,
            )
        results = []
        for row in data.items:
            result = dict(
                item_id=str(row.item_id),
                row_number=originals[str(row.item_id)].row_number,
                normalized=row.normalized,
            )
            try:
                with db.begin_nested():
                    child = correct_row(
                        db,
                        actor,
                        tid,
                        bid,
                        str(row.item_id),
                        row_command(data, bid, row),
                        request.state.correlation_id,
                    )
                result.update(
                    outcome="corrected",
                    code=None,
                    message="Replacement receipt recorded; driver matching and evidence review remain separate.",
                    replacement=dict(batch_id=child["id"], item_id=child["item_id"]),
                )
            except DomainError as error:
                if error.status in {401, 403, 404}:
                    raise
                result.update(failed(error))
            results.append(result)
        run = IntakeCorrectionRun(
            tenant_id=tid,
            batch_id=bid,
            actor_id=actor.id,
            command_id=str(data.command_id),
            request_hash=digest,
            encrypted_payload=encrypt(json.dumps(dict(reason=data.reason, items=results))),
        )
        db.add(run)
        db.flush()
        record(
            db,
            actor,
            tid,
            "intake.bulk_corrections_recorded",
            run.id,
            request.state.correlation_id,
            source_batch_id=bid,
            corrected=sum(r["outcome"] == "corrected" for r in results),
            blocked=sum(r["outcome"] == "blocked" for r in results),
        )
        return {**output(db, run), "replayed": False}

    @app.get(base)
    def listing(tenant_id: UUID, batch_id: UUID, actor: Actor, db: DB):
        tid, bid = str(tenant_id), str(batch_id)
        source_scope(db, actor, tid, bid)
        return {
            "items": [
                output(db, row)
                for row in db.scalars(
                    select(IntakeCorrectionRun)
                    .where(IntakeCorrectionRun.tenant_id == tid, IntakeCorrectionRun.batch_id == bid)
                    .order_by(IntakeCorrectionRun.created_at.desc())
                    .limit(20)
                )
            ]
        }
