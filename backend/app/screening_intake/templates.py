"""Reusable mappings are explicit, scope-bound snapshots, never automatic acceptance."""

import json
from uuid import UUID
from fastapi import Request
from pydantic import Field
from sqlalchemy import select, func
from app.models import IntakeMappingTemplate, IntakeSpreadsheetSource, uid
from app.organizations.schemas import Input
from app.organizations.service import lock_tenant, branch_check
from app.screening_intake.review import source_scope, fingerprint
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.audit.service import record


class SaveTemplate(Input):
    command_id: UUID
    source_batch_id: UUID
    name: str = Field(min_length=3, max_length=80)
    reason: str = Field(min_length=20, max_length=2000)
    template_id: UUID | None = None
    expected_revision: int | None = Field(default=None, ge=1)


class RetireTemplate(Input):
    command_id: UUID
    expected_revision: int = Field(ge=1)
    reason: str = Field(min_length=20, max_length=2000)


def latest(db, tid, template_id):
    return db.scalar(
        select(IntakeMappingTemplate)
        .where(IntakeMappingTemplate.tenant_id == tid, IntakeMappingTemplate.template_id == template_id)
        .order_by(IntakeMappingTemplate.revision.desc())
        .limit(1)
    )


def output(row):
    configuration = json.loads(decrypt(row.encrypted_configuration))
    return dict(
        configuration,
        id=row.id,
        template_id=row.template_id,
        revision=row.revision,
        active=row.active,
        branch_id=row.branch_id,
        created_at=row.created_at,
        source_batch_id=row.source_batch_id,
    )


def replay(db, actor, tid, command_id, digest):
    row = db.scalar(
        select(IntakeMappingTemplate).where(
            IntakeMappingTemplate.tenant_id == tid,
            IntakeMappingTemplate.actor_id == actor.id,
            IntakeMappingTemplate.command_id == str(command_id),
        )
    )
    if row and row.request_hash != digest:
        raise DomainError(
            "IDEMPOTENCY_CONFLICT", "Mapping command was already used with different input.", 409
        )
    return row


def check_application(db, scope, branch, revision_id, columns, mapping):
    row = db.scalar(
        select(IntakeMappingTemplate).where(
            IntakeMappingTemplate.id == revision_id,
            IntakeMappingTemplate.tenant_id == scope.tenant.id,
            IntakeMappingTemplate.branch_id == branch,
        )
    )
    if not row:
        raise DomainError("NOT_FOUND", "Saved mapping unavailable in this location.", 404)
    current = latest(db, scope.tenant.id, row.template_id)
    if not current.active or current.id != row.id:
        raise DomainError(
            "MAPPING_CHANGED",
            "This saved mapping changed or was retired. Reload mappings and review again.",
            409,
        )
    config = json.loads(decrypt(row.encrypted_configuration))
    if config["columns"] != columns or config["mapping"] != mapping:
        raise DomainError(
            "MAPPING_LAYOUT_CHANGED",
            "Spreadsheet columns or mapping differ. Map manually or select a compatible saved mapping.",
            409,
        )
    return row


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/intake-mappings"

    @app.get(base)
    def listing(tenant_id: UUID, actor: Actor, db: DB, branch_id: UUID | None = None):
        tid, branch = str(tenant_id), str(branch_id) if branch_id else None
        scope = authorize(db, actor, tid, "drivers:write", branch_id=branch)
        if scope.branch_id and scope.branch_id != branch:
            raise DomainError("FORBIDDEN", "Select your authorized location for intake mappings.", 403)
        if branch:
            branch_check(db, tid, branch)
        rows = db.scalars(
            select(IntakeMappingTemplate)
            .where(IntakeMappingTemplate.tenant_id == tid, IntakeMappingTemplate.branch_id == branch)
            .order_by(IntakeMappingTemplate.template_id, IntakeMappingTemplate.revision.desc())
        )
        seen, result = set(), []
        for row in rows:
            if row.template_id not in seen:
                seen.add(row.template_id)
                result.append(output(row))
        return {"items": result}

    @app.post(base, status_code=201)
    def save(tenant_id: UUID, data: SaveTemplate, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        _, batch, _ = source_scope(db, actor, tid, str(data.source_batch_id), write=True)
        digest = fingerprint(data.model_dump())
        prior = replay(db, actor, tid, data.command_id, digest)
        if prior:
            return {**output(prior), "replayed": True}
        source = db.get(IntakeSpreadsheetSource, batch.id)
        if source:
            config = json.loads(decrypt(source.encrypted_metadata))
        else:
            from app.screening_intake.background import provenance

            config = provenance(db, batch.id)
            if not config:
                raise DomainError(
                    "MAPPING_SOURCE_REQUIRED",
                    "Save a mapping from an actual mapped spreadsheet receipt.",
                    409,
                )
        current = latest(db, tid, str(data.template_id)) if data.template_id else None
        if data.template_id and (not current or current.branch_id != batch.branch_id):
            raise DomainError("NOT_FOUND", "Saved mapping unavailable in this location.", 404)
        if current and (not current.active or current.revision != data.expected_revision):
            raise DomainError(
                "VERSION_CONFLICT", "Mapping changed or was retired. Reload before saving a revision.", 409
            )
        if not current and data.expected_revision is not None:
            raise DomainError(
                "INVALID_MAPPING_REVISION", "New mappings do not have a previous revision.", 422
            )
        if (
            db.scalar(
                select(func.count())
                .select_from(IntakeMappingTemplate)
                .where(IntakeMappingTemplate.tenant_id == tid)
            )
            >= 100
        ):
            raise DomainError(
                "MAPPING_QUOTA", "Local synthetic workspaces support up to 100 saved mapping revisions.", 429
            )
        row = IntakeMappingTemplate(
            tenant_id=tid,
            template_id=current.template_id if current else uid(),
            revision=current.revision + 1 if current else 1,
            branch_id=batch.branch_id,
            source_batch_id=batch.id,
            actor_id=actor.id,
            command_id=str(data.command_id),
            request_hash=digest,
            active=True,
            encrypted_configuration=encrypt(
                json.dumps(
                    dict(
                        name=data.name.strip(),
                        reason=data.reason,
                        columns=config["columns"],
                        mapping=config["mapping"],
                    )
                )
            ),
        )
        if len(data.name.strip()) < 3:
            raise DomainError(
                "INVALID_MAPPING_NAME", "Use a meaningful mapping name of at least three characters.", 422
            )
        db.add(row)
        db.flush()
        record(
            db,
            actor,
            tid,
            "intake.mapping_saved",
            row.id,
            request.state.correlation_id,
            template_id=row.template_id,
            revision=row.revision,
            source_batch_id=batch.id,
        )
        return {**output(row), "replayed": False}

    @app.post(base + "/{template_id}/retire", status_code=201)
    def retire(
        tenant_id: UUID, template_id: UUID, data: RetireTemplate, actor: Actor, db: DB, request: Request
    ):
        tid = str(tenant_id)
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        scope = authorize(db, actor, tid, "drivers:write")
        if scope.role not in {"client_admin", "reviewer", "specialist"}:
            raise DomainError("FORBIDDEN", "Reviewed intake permission required.", 403)
        row = latest(db, tid, str(template_id))
        if not row or (scope.branch_id and row.branch_id != scope.branch_id):
            raise DomainError("NOT_FOUND", "Saved mapping unavailable.", 404)
        digest = fingerprint({**data.model_dump(), "template_id": str(template_id), "action": "retire"})
        prior = replay(db, actor, tid, data.command_id, digest)
        if prior:
            return {**output(prior), "replayed": True}
        if not row.active or row.revision != data.expected_revision:
            raise DomainError(
                "VERSION_CONFLICT", "Mapping changed or was already retired. Reload its current state.", 409
            )
        config = json.loads(decrypt(row.encrypted_configuration))
        config["reason"] = data.reason
        retired = IntakeMappingTemplate(
            tenant_id=tid,
            template_id=row.template_id,
            revision=row.revision + 1,
            branch_id=row.branch_id,
            source_batch_id=row.source_batch_id,
            actor_id=actor.id,
            command_id=str(data.command_id),
            request_hash=digest,
            active=False,
            encrypted_configuration=encrypt(json.dumps(config)),
        )
        db.add(retired)
        db.flush()
        record(
            db,
            actor,
            tid,
            "intake.mapping_retired",
            retired.id,
            request.state.correlation_id,
            template_id=row.template_id,
            revision=retired.revision,
        )
        return {**output(retired), "replayed": False}
