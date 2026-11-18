import base64
import hashlib
import json
from datetime import date, datetime
from pathlib import PurePath
from typing import Literal
from uuid import UUID
from urllib.parse import quote
from zoneinfo import ZoneInfo

from fastapi import Request, Response, Query
from pydantic import Field
from sqlalchemy import select, func, case as sql_case, or_

from app.models import (
    RequirementDefinition,
    DriverRequirement,
    EvidenceVersion,
    EvidenceReview,
    DriverEngagement,
    IntakeItem,
    IntakeBatch,
    IntakeAttachment,
    User,
    DriverIdentity,
    ExceptionCase,
    now,
    uid,
)
from app.organizations.schemas import Input
from app.organizations.service import lock_tenant
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.audit.service import record
from app.drivers.service import identity
from app.documents import storage
from app.driver_portal.requests import latest_request
from app.exceptions.service import event as case_event


class Definition(Input):
    code: str = Field(pattern=r"^[A-Z0-9][A-Z0-9_-]{1,63}$")
    title: str = Field(min_length=3, max_length=160)
    category: Literal[
        "motor_vehicle_record",
        "medical_certificate",
        "license",
        "employment_verification",
        "background_screening",
        "other",
    ]
    requires_expiry: bool = False
    basis: str = Field(min_length=10, max_length=2000)


class Assign(Input):
    definition_id: UUID
    engagement_id: UUID


class Upload(Input):
    command_id: UUID
    filename: str = Field(min_length=1, max_length=180)
    content_base64: str = Field(min_length=1, max_length=2796208)
    source_item_id: UUID | None = None


class Review(Input):
    version: int = Field(ge=1)
    outcome: Literal["verified_evidence", "needs_more_information", "rejected_evidence", "escalated"]
    reason: str = Field(min_length=10, max_length=2000)
    identity_verified: bool
    category_verified: bool
    completeness_verified: bool
    expires_on: date | None = None


def definitions(db, tid):
    rows = db.scalars(
        select(RequirementDefinition)
        .where(RequirementDefinition.tenant_id == tid)
        .order_by(RequirementDefinition.code, RequirementDefinition.revision.desc())
    )
    current = {}
    for row in rows:
        current.setdefault(row.code, row)
    return [
        {
            "id": d.id,
            "code": d.code,
            "revision": d.revision,
            "title": d.title,
            "category": d.category,
            "requires_expiry": d.requires_expiry,
            "applicability": d.applicability,
            "basis": decrypt(d.encrypted_basis),
        }
        for d in current.values()
    ]


def requirement(db, actor, tid, did, rid, write=False):
    scope, driver = identity(db, actor, tid, did, "drivers:write", lock=write)
    query = (
        select(DriverRequirement)
        .join(DriverEngagement, DriverEngagement.id == DriverRequirement.engagement_id)
        .where(
            DriverRequirement.id == rid,
            DriverRequirement.tenant_id == tid,
            DriverRequirement.driver_id == did,
        )
    )
    if scope.branch_id:
        query = query.where(DriverEngagement.branch_id == scope.branch_id)
    row = db.scalar(query)
    if not row:
        raise DomainError("NOT_FOUND", "Requirement unavailable in this driver file.", 404)
    return scope, driver, row


def invalidate_related_cases(db, actor, tenant_id, requirement_id, source_item_id, evidence_id, action):
    sources = set(
        db.scalars(
            select(IntakeAttachment.source_item_id).where(
                IntakeAttachment.tenant_id == tenant_id, IntakeAttachment.requirement_id == requirement_id
            )
        )
    )
    if source_item_id:
        sources.add(source_item_id)
    for case in db.scalars(
        select(ExceptionCase)
        .where(
            ExceptionCase.tenant_id == tenant_id,
            or_(ExceptionCase.source_item_id.in_(sources), ExceptionCase.requirement_id == requirement_id),
        )
        .with_for_update()
    ):
        # Version invalidation is an integrity effect, never a case-resolution override.
        case.version += 1
        case_event(
            db,
            case,
            actor,
            action,
            "Related evidence changed; prior case-version approvals must be revalidated.",
            evidence_id=evidence_id,
            requirement_id=requirement_id,
        )


def file_data(db, actor, tid, did):
    scope, _ = identity(db, actor, tid, did, "drivers:write")
    query = (
        select(DriverRequirement, RequirementDefinition, DriverEngagement)
        .join(RequirementDefinition, RequirementDefinition.id == DriverRequirement.definition_id)
        .join(DriverEngagement, DriverEngagement.id == DriverRequirement.engagement_id)
        .where(DriverRequirement.tenant_id == tid, DriverRequirement.driver_id == did)
    )
    if scope.branch_id:
        query = query.where(DriverEngagement.branch_id == scope.branch_id)
    items = []
    today = datetime.now(ZoneInfo(scope.tenant.timezone)).date()
    for req, definition, engagement in db.execute(query.order_by(DriverRequirement.created_at)):
        evidence = list(
            db.scalars(
                select(EvidenceVersion)
                .where(EvidenceVersion.requirement_id == req.id)
                .order_by(EvidenceVersion.revision.desc())
            )
        )
        versions = []
        accepted = None
        for ev in evidence:
            review = db.scalar(
                select(EvidenceReview)
                .where(EvidenceReview.evidence_id == ev.id)
                .order_by(EvidenceReview.reviewed_at.desc())
                .limit(1)
            )
            if review and review.outcome == "verified_evidence" and accepted is None:
                accepted = review
            reviewer = db.get(User, review.actor_id) if review else None
            versions.append(
                {
                    "id": ev.id,
                    "revision": ev.revision,
                    "version": ev.version,
                    "filename": decrypt(ev.encrypted_filename),
                    "submitted_via": ev.submitted_via,
                    "uploaded_by": db.get(User, ev.actor_id).email,
                    "status": ev.status,
                    "media_type": ev.media_type,
                    "byte_size": ev.byte_size,
                    "sha256": ev.sha256,
                    "uploaded_at": ev.uploaded_at,
                    "scanner": ev.scanner,
                    "scanned_at": ev.scanned_at,
                    "scan_error": ev.scan_error,
                    "can_download": ev.scanner is not None
                    and ev.scanned_at is not None
                    and ev.status
                    in {
                        "needs_review",
                        "reviewed_accepted",
                        "reviewed_rejected",
                        "needs_more_information",
                        "escalated",
                    },
                    "review": {
                        "outcome": review.outcome,
                        "reason": decrypt(review.encrypted_reason),
                        "reviewer": reviewer.email,
                        "reviewed_at": review.reviewed_at,
                        "expires_on": review.expires_on,
                    }
                    if review
                    else None,
                }
            )
        shared = latest_request(db, req.id)
        status = "missing"
        if accepted:
            status = "expired" if accepted.expires_on and accepted.expires_on < today else "verified"
        elif evidence:
            status = "rejected" if evidence[0].status == "reviewed_rejected" else "needs_review"
        items.append(
            {
                "id": req.id,
                "engagement_id": req.engagement_id,
                "engagement_current": engagement.end_date is None,
                "definition_id": definition.id,
                "code": definition.code,
                "title": definition.title,
                "category": definition.category,
                "policy_revision": definition.revision,
                "applicability": definition.applicability,
                "requires_expiry": definition.requires_expiry,
                "driver_visible": bool(shared and shared.visible),
                "driver_instructions": decrypt(shared.encrypted_instructions) if shared else "",
                "driver_request_version": shared.version if shared else 0,
                "status": status,
                "follow_up_id": db.scalar(
                    select(ExceptionCase.id)
                    .where(
                        ExceptionCase.tenant_id == tid,
                        ExceptionCase.requirement_id == req.id,
                        ExceptionCase.state.not_in(["resolved", "closed", "canceled"]),
                    )
                    .limit(1)
                ),
                "evidence": versions,
            }
        )
    return {
        "items": items,
        "definitions": definitions(db, tid),
        "can_review": scope.role in {"client_admin", "reviewer", "specialist"},
        "operational_only": True,
    }



def receive_evidence(db, actor, tid, did, rid, data, scope, driver, req, correlation_id, submitted_via="staff"):
    try:
        content = base64.b64decode(data.content_base64, validate=True)
    except ValueError:
        raise DomainError("INVALID_FILE", "File encoding is invalid.", 422)
    if not content or len(content) > 2 * 1024 * 1024:
        raise DomainError("FILE_QUOTA", "Use a nonempty PDF, PNG or JPEG up to 2 MiB.", 422)
    filename = data.filename.replace("\\", "/").split("/")[-1]
    extension = PurePath(filename).suffix.lower()
    media = None
    if extension == ".pdf" and content.startswith(b"%PDF-") and b"%%EOF" in content[-2048:]:
        media = "application/pdf"
    elif extension == ".png" and content.startswith(b"\x89PNG\r\n\x1a\n") and b"IEND" in content[-16:]:
        media = "image/png"
    elif (
        extension in {".jpg", ".jpeg"}
        and content.startswith(b"\xff\xd8\xff")
        and content.endswith(b"\xff\xd9")
    ):
        media = "image/jpeg"
    if not media:
        raise DomainError(
            "FILE_TYPE_DENIED",
            "Extension and file signature must agree for a supported PDF, PNG or JPEG.",
            422,
        )
    digest = hashlib.sha256(content).hexdigest()
    request_hash = hashlib.sha256(
        json.dumps([rid, filename, digest, str(data.source_item_id)]).encode()
    ).hexdigest()
    prior = db.scalar(
        select(EvidenceVersion).where(
            EvidenceVersion.tenant_id == tid,
            EvidenceVersion.actor_id == actor.id,
            EvidenceVersion.command_id == str(data.command_id),
        )
    )
    if prior:
        if prior.request_hash != request_hash:
            raise DomainError(
                "IDEMPOTENCY_CONFLICT", "Upload command was used with different evidence.", 409
            )
        return {"id": prior.id, "status": prior.status, "replayed": True}
    if data.source_item_id:
        source = db.scalar(
            select(IntakeItem).where(
                IntakeItem.id == str(data.source_item_id), IntakeItem.tenant_id == tid
            )
        )
        if not source or source.status in {"validation_failed", "duplicate_detected"}:
            raise DomainError("SOURCE_MISMATCH", "Source cannot support this evidence attachment.", 409)
        payload = json.loads(decrypt(source.encrypted_payload))["normalized"]
        batch = db.get(IntakeBatch, source.batch_id)
        target_engagement = db.get(DriverEngagement, req.engagement_id)
        if (scope.branch_id and batch.branch_id != scope.branch_id) or (
            batch.branch_id and batch.branch_id != target_engagement.branch_id
        ):
            raise DomainError(
                "SOURCE_MISMATCH", "Source location and selected engagement do not agree.", 409
            )
        definition = db.get(RequirementDefinition, req.definition_id)
        if (
            payload["external_driver_ref"] != driver.reference
            or payload["report_type"] != definition.category
        ):
            raise DomainError(
                "SOURCE_MISMATCH",
                "Verify the exact driver reference and requirement category before attachment.",
                409,
            )
    if (
        db.scalar(
            select(func.count())
            .select_from(EvidenceVersion)
            .where(
                EvidenceVersion.tenant_id == tid, EvidenceVersion.status.in_(["quarantined", "scanning"])
            )
        )
        or 0
    ) >= 50:
        raise DomainError(
            "FILE_QUOTA",
            "This company already has 50 files awaiting scanning. Process those before uploading more.",
            429,
        )
    if (
        db.scalar(
            select(func.count()).select_from(EvidenceVersion).where(EvidenceVersion.tenant_id == tid)
        )
        or 0
    ) >= 1000:
        raise DomainError(
            "FILE_QUOTA",
            "Local synthetic storage is limited to 1,000 evidence versions per company.",
            429,
        )
    revision = (
        db.scalar(select(func.max(EvidenceVersion.revision)).where(EvidenceVersion.requirement_id == rid))
        or 0
    ) + 1
    key = uid()
    storage.put(key, content)
    evidence = EvidenceVersion(
        id=uid(),
        tenant_id=tid,
        requirement_id=rid,
        source_item_id=str(data.source_item_id) if data.source_item_id else None,
        actor_id=actor.id,
        submitted_via=submitted_via,
        command_id=str(data.command_id),
        request_hash=request_hash,
        revision=revision,
        object_key=key,
        encrypted_filename=encrypt(filename),
        media_type=media,
        byte_size=len(content),
        sha256=digest,
    )
    db.add(evidence)
    db.flush()
    invalidate_related_cases(
        db, actor, tid, rid, evidence.source_item_id, evidence.id, "evidence.version_received"
    )
    record(
        db,
        actor,
        tid,
        "evidence.uploaded",
        evidence.id,
        correlation_id,
        requirement_id=rid,
        revision=revision,
    )
    return {"id": evidence.id, "status": evidence.status}


def register(app, DB, Actor):
    @app.get("/api/v1/tenants/{tenant_id}/requirements/attention")
    def attention(
        tenant_id: UUID,
        actor: Actor,
        db: DB,
        state: str | None = Query(default=None, pattern="^(missing|expired|needs_review)$"),
        offset: int = Query(default=0, ge=0),
    ):
        tid = str(tenant_id)
        scope = authorize(db, actor, tid, "drivers:write")
        today = datetime.now(ZoneInfo(scope.tenant.timezone)).date()
        any_evidence = (
            select(EvidenceVersion.id)
            .where(EvidenceVersion.requirement_id == DriverRequirement.id)
            .correlate(DriverRequirement)
            .exists()
        )
        accepted = (
            select(EvidenceReview.id)
            .where(
                EvidenceReview.requirement_id == DriverRequirement.id,
                EvidenceReview.outcome == "verified_evidence",
            )
            .correlate(DriverRequirement)
            .exists()
        )
        expiry = (
            select(EvidenceReview.expires_on)
            .join(EvidenceVersion, EvidenceVersion.id == EvidenceReview.evidence_id)
            .where(
                EvidenceReview.requirement_id == DriverRequirement.id,
                EvidenceReview.outcome == "verified_evidence",
            )
            .order_by(EvidenceVersion.revision.desc())
            .limit(1)
            .correlate(DriverRequirement)
            .scalar_subquery()
        )
        status = sql_case(
            (~any_evidence, "missing"),
            (accepted & (expiry < today), "expired"),
            (~accepted, "needs_review"),
            else_="verified",
        )
        query = (
            select(
                DriverRequirement.id.label("requirement_id"),
                DriverIdentity.id.label("driver_id"),
                DriverIdentity.reference,
                DriverIdentity.first_name,
                DriverIdentity.last_name,
                RequirementDefinition.title,
                status.label("status"),
            )
            .join(DriverIdentity, DriverIdentity.id == DriverRequirement.driver_id)
            .join(DriverEngagement, DriverEngagement.id == DriverRequirement.engagement_id)
            .join(RequirementDefinition, RequirementDefinition.id == DriverRequirement.definition_id)
            .where(
                DriverRequirement.tenant_id == tid, DriverEngagement.end_date.is_(None), status != "verified"
            )
        )
        if scope.branch_id:
            query = query.where(DriverEngagement.branch_id == scope.branch_id)
        if state:
            query = query.where(status == state)
        total = db.scalar(select(func.count()).select_from(query.subquery()))
        return {
            "total": total,
            "items": [
                dict(row._mapping)
                for row in db.execute(query.order_by(DriverRequirement.created_at).offset(offset).limit(25))
            ],
        }

    @app.get("/api/v1/tenants/{tenant_id}/requirements")
    def catalog(tenant_id: UUID, actor: Actor, db: DB):
        scope = authorize(db, actor, str(tenant_id), "drivers:write")
        return {
            "items": definitions(db, str(tenant_id)),
            "can_configure": not scope.branch_id and scope.role in {"client_admin", "reviewer"},
        }

    @app.post("/api/v1/tenants/{tenant_id}/requirements", status_code=201)
    def configure(tenant_id: UUID, data: Definition, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        allow_write(lock_tenant(db, actor, tid, "drivers:correct"))
        scope = authorize(db, actor, tid, "drivers:correct")
        if scope.branch_id:
            raise DomainError("FORBIDDEN", "Company-wide requirement authority required.", 403)
        revision = (
            db.scalar(
                select(func.max(RequirementDefinition.revision)).where(
                    RequirementDefinition.tenant_id == tid, RequirementDefinition.code == data.code
                )
            )
            or 0
        ) + 1
        definition = RequirementDefinition(
            tenant_id=tid,
            code=data.code,
            revision=revision,
            title=data.title,
            category=data.category,
            requires_expiry=data.requires_expiry,
            encrypted_basis=encrypt(data.basis),
            created_by=actor.id,
        )
        db.add(definition)
        db.flush()
        record(
            db,
            actor,
            tid,
            "evidence.requirement_configured",
            definition.id,
            request.state.correlation_id,
            revision=revision,
        )
        return {"id": definition.id, "revision": revision}

    base = "/api/v1/tenants/{tenant_id}/drivers/{driver_id}/file"

    @app.get(base)
    def driver_file(tenant_id: UUID, driver_id: UUID, actor: Actor, db: DB):
        return file_data(db, actor, str(tenant_id), str(driver_id))

    @app.get(base + "/source-context/{source_item_id}")
    def source_context(tenant_id: UUID, driver_id: UUID, source_item_id: UUID, actor: Actor, db: DB):
        tid = str(tenant_id)
        scope, driver = identity(db, actor, tid, str(driver_id), "drivers:write")
        source = db.scalar(
            select(IntakeItem).where(IntakeItem.id == str(source_item_id), IntakeItem.tenant_id == tid)
        )
        if not source:
            raise DomainError("NOT_FOUND", "Source unavailable.", 404)
        batch = db.get(IntakeBatch, source.batch_id)
        payload = json.loads(decrypt(source.encrypted_payload))["normalized"]
        established = db.scalar(
            select(IntakeAttachment.id)
            .join(DriverRequirement, DriverRequirement.id == IntakeAttachment.requirement_id)
            .where(
                IntakeAttachment.tenant_id == tid,
                IntakeAttachment.source_item_id == source.id,
                DriverRequirement.driver_id == driver.id,
            )
        )
        if (scope.branch_id and batch.branch_id != scope.branch_id) or (
            payload["external_driver_ref"] != driver.reference and not established
        ):
            raise DomainError("SOURCE_MISMATCH", "Source does not match this scoped driver reference.", 409)
        return {
            "id": source.id,
            "report_reference": payload["external_report_ref"],
            "category": payload["report_type"],
            "driver_reference": payload["external_driver_ref"],
            "received_status": source.status,
        }

    @app.post(base + "/requirements", status_code=201)
    def assign(tenant_id: UUID, driver_id: UUID, data: Assign, actor: Actor, db: DB, request: Request):
        tid, did = str(tenant_id), str(driver_id)
        scope, _ = identity(db, actor, tid, did, "drivers:write", lock=True)
        engagement = db.scalar(
            select(DriverEngagement).where(
                DriverEngagement.id == str(data.engagement_id),
                DriverEngagement.tenant_id == tid,
                DriverEngagement.driver_id == did,
            )
        )
        definition = db.scalar(
            select(RequirementDefinition).where(
                RequirementDefinition.id == str(data.definition_id), RequirementDefinition.tenant_id == tid
            )
        )
        if not engagement or not definition or (scope.branch_id and engagement.branch_id != scope.branch_id):
            raise DomainError("NOT_FOUND", "Select a requirement and engagement in this driver file.", 404)
        prior = db.scalar(
            select(DriverRequirement).where(
                DriverRequirement.engagement_id == engagement.id,
                DriverRequirement.definition_id == definition.id,
            )
        )
        if prior:
            return {"id": prior.id, "replayed": True}
        row = DriverRequirement(
            tenant_id=tid,
            driver_id=did,
            engagement_id=engagement.id,
            definition_id=definition.id,
            created_by=actor.id,
        )
        db.add(row)
        db.flush()
        record(
            db,
            actor,
            tid,
            "evidence.requirement_assigned",
            row.id,
            request.state.correlation_id,
            driver_id=did,
            engagement_id=engagement.id,
        )
        return {"id": row.id}

    @app.post(base + "/requirements/{requirement_id}/evidence", status_code=201)
    def upload(
        tenant_id: UUID,
        driver_id: UUID,
        requirement_id: UUID,
        data: Upload,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        tid, did, rid = str(tenant_id), str(driver_id), str(requirement_id)
        scope, driver, req = requirement(db, actor, tid, did, rid, True)
        return receive_evidence(db, actor, tid, did, rid, data, scope, driver, req, request.state.correlation_id)

    @app.post(base + "/requirements/{requirement_id}/evidence/{evidence_id}/review")
    def review(
        tenant_id: UUID,
        driver_id: UUID,
        requirement_id: UUID,
        evidence_id: UUID,
        data: Review,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        tid, did, rid = str(tenant_id), str(driver_id), str(requirement_id)
        scope, _, req = requirement(db, actor, tid, did, rid, True)
        if scope.role not in {"client_admin", "reviewer", "specialist"}:
            raise DomainError("FORBIDDEN", "Evidence review authority required.", 403)
        evidence = db.scalar(
            select(EvidenceVersion)
            .where(
                EvidenceVersion.id == str(evidence_id),
                EvidenceVersion.tenant_id == tid,
                EvidenceVersion.requirement_id == rid,
            )
            .with_for_update()
        )
        if not evidence:
            raise DomainError("NOT_FOUND", "Evidence unavailable in this requirement.", 404)
        if (
            evidence.version != data.version
            or evidence.status != "needs_review"
            or not evidence.scanner
            or not evidence.scanned_at
        ):
            raise DomainError(
                "VERSION_CONFLICT", "Evidence changed or has not passed its scanner. Refresh the file.", 409
            )
        definition = db.get(RequirementDefinition, req.definition_id)
        if data.outcome == "verified_evidence" and (
            not all([data.identity_verified, data.category_verified, data.completeness_verified])
            or (definition.requires_expiry and not data.expires_on)
        ):
            raise DomainError(
                "REVIEW_INCOMPLETE",
                "Verify identity, category and completeness, and enter the configured expiry date when required.",
                422,
            )
        if (
            data.outcome == "verified_evidence"
            and hashlib.sha256(storage.get(evidence.object_key)).hexdigest() != evidence.sha256
        ):
            raise DomainError(
                "EVIDENCE_INTEGRITY_ERROR", "Stored evidence integrity could not be verified.", 409
            )
        decision = EvidenceReview(
            tenant_id=tid,
            requirement_id=rid,
            evidence_id=evidence.id,
            evidence_version=evidence.version,
            actor_id=actor.id,
            outcome=data.outcome,
            encrypted_reason=encrypt(data.reason),
            identity_verified=data.identity_verified,
            category_verified=data.category_verified,
            completeness_verified=data.completeness_verified,
            expires_on=data.expires_on,
        )
        db.add(decision)
        db.flush()
        if data.outcome == "verified_evidence" and evidence.source_item_id:
            db.add(
                IntakeAttachment(
                    tenant_id=tid,
                    source_item_id=evidence.source_item_id,
                    requirement_id=rid,
                    evidence_id=evidence.id,
                    review_id=decision.id,
                    actor_id=actor.id,
                )
            )
        evidence.status = {
            "verified_evidence": "reviewed_accepted",
            "rejected_evidence": "reviewed_rejected",
            "needs_more_information": "needs_more_information",
            "escalated": "escalated",
        }[data.outcome]
        evidence.version += 1
        invalidate_related_cases(
            db, actor, tid, rid, evidence.source_item_id, evidence.id, "evidence.review_recorded"
        )
        record(
            db,
            actor,
            tid,
            "evidence.reviewed",
            evidence.id,
            request.state.correlation_id,
            outcome=data.outcome,
            requirement_id=rid,
        )
        return {"saved": True}

    @app.post(base + "/requirements/{requirement_id}/evidence/{evidence_id}/retry-scan")
    def retry_scan(
        tenant_id: UUID,
        driver_id: UUID,
        requirement_id: UUID,
        evidence_id: UUID,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        tid, rid = str(tenant_id), str(requirement_id)
        requirement(db, actor, tid, str(driver_id), rid, True)
        evidence = db.scalar(
            select(EvidenceVersion)
            .where(
                EvidenceVersion.id == str(evidence_id),
                EvidenceVersion.tenant_id == tid,
                EvidenceVersion.requirement_id == rid,
            )
            .with_for_update()
        )
        if not evidence or evidence.status != "scan_failed":
            raise DomainError("STATE_TRANSITION_DENIED", "Only a failed scan may be retried.", 409)
        evidence.status, evidence.available_at, evidence.scan_attempts = "quarantined", now(), 0
        evidence.scan_error = None
        evidence.version += 1
        record(db, actor, tid, "evidence.scan_retry_requested", evidence.id, request.state.correlation_id)
        return {"queued": True}

    @app.get(base + "/requirements/{requirement_id}/evidence/{evidence_id}/download")
    def download(
        tenant_id: UUID,
        driver_id: UUID,
        requirement_id: UUID,
        evidence_id: UUID,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        tid, rid = str(tenant_id), str(requirement_id)
        requirement(db, actor, tid, str(driver_id), rid)
        evidence = db.scalar(
            select(EvidenceVersion).where(
                EvidenceVersion.id == str(evidence_id),
                EvidenceVersion.tenant_id == tid,
                EvidenceVersion.requirement_id == rid,
            )
        )
        if (
            not evidence
            or not evidence.scanner
            or not evidence.scanned_at
            or evidence.status
            not in {
                "needs_review",
                "reviewed_accepted",
                "reviewed_rejected",
                "needs_more_information",
                "escalated",
            }
        ):
            raise DomainError("FILE_UNAVAILABLE", "File has not passed its scanner or is unavailable.", 409)
        content = storage.get(evidence.object_key)
        if hashlib.sha256(content).hexdigest() != evidence.sha256:
            raise DomainError(
                "EVIDENCE_INTEGRITY_ERROR", "Stored evidence integrity could not be verified.", 409
            )
        record(db, actor, tid, "evidence.downloaded", evidence.id, request.state.correlation_id)
        return Response(
            content,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": "attachment; filename*=UTF-8''"
                + quote(decrypt(evidence.encrypted_filename), safe=""),
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
