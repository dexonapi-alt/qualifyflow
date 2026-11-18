import hashlib
from urllib.parse import quote
from uuid import UUID
from fastapi import Request, Response
from pydantic import EmailStr, Field
from sqlalchemy import select
from app.organizations.schemas import Input, Versioned
from app.models import EvidenceVersion, DriverIdentity, DriverEngagement, DriverDocumentRequest
from app.shared.authorization import Scope
from app.shared.security import encrypt, decrypt
from app.shared.errors import DomainError
from app.audit.service import record
from app.documents.routes import Upload, receive_evidence
from app.documents import storage
from app.driver_portal import service
from app.driver_portal.security import personal_requirement
from app.driver_portal.requests import latest_request


class DriverInvite(Input):
    email: EmailStr
    engagement_id: UUID


class ShareRequest(Input):
    version: int = Field(default=0, ge=0)
    visible: bool
    instructions: str = Field(min_length=10, max_length=2000)


class PersonalUpload(Input):
    command_id: UUID
    filename: str = Field(min_length=1, max_length=180)
    content_base64: str = Field(min_length=1, max_length=2796208)


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/drivers/{driver_id}"

    @app.get(base + "/portal-access")
    def access(tenant_id: UUID, driver_id: UUID, actor: Actor, db: DB):
        return service.staff_data(db, actor, str(tenant_id), str(driver_id))

    @app.post(base + "/portal-access", status_code=201)
    def invite(tenant_id: UUID, driver_id: UUID, data: DriverInvite, actor: Actor, db: DB, request: Request):
        return service.invite_driver(
            db, actor, str(tenant_id), str(driver_id), data, request.state.correlation_id
        )

    @app.post(base + "/portal-access/{grant_id}/revoke")
    def revoke(
        tenant_id: UUID,
        driver_id: UUID,
        grant_id: UUID,
        data: Versioned,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        return service.revoke(
            db, actor, str(tenant_id), str(driver_id), str(grant_id), data, request.state.correlation_id
        )

    @app.post(base + "/file/requirements/{requirement_id}/driver-request")
    def share(
        tenant_id: UUID,
        driver_id: UUID,
        requirement_id: UUID,
        data: ShareRequest,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        from app.documents.routes import requirement

        scope, _, req = requirement(db, actor, str(tenant_id), str(driver_id), str(requirement_id), True)
        if scope.role not in {"client_admin", "reviewer", "specialist"}:
            raise DomainError("FORBIDDEN", "Document-request authority required.", 403)
        engagement = db.get(DriverEngagement, req.engagement_id)
        if engagement.end_date or engagement.status not in {"engagement_draft", "onboarding", "active"}:
            raise DomainError("STATE_TRANSITION_DENIED", "Driver requests require a current engagement.", 409)
        current = latest_request(db, req.id)
        if data.version != (current.version if current else 0):
            raise DomainError("VERSION_CONFLICT", "Driver instructions changed. Refresh before saving.", 409)
        db.add(
            DriverDocumentRequest(
                tenant_id=str(tenant_id),
                requirement_id=req.id,
                version=data.version + 1,
                visible=data.visible,
                encrypted_instructions=encrypt(data.instructions),
                actor_id=actor.id,
            )
        )
        record(
            db,
            actor,
            str(tenant_id),
            "driver.document_request_updated",
            req.id,
            request.state.correlation_id,
            visible=data.visible,
        )
        return {"status": "saved", "visible": data.visible}

    @app.get("/api/v1/driver-portal")
    def list_mine(actor: Actor, db: DB):
        return service.list_onboarding(db, actor)

    @app.get("/api/v1/driver-portal/{engagement_id}")
    def detail(engagement_id: UUID, actor: Actor, db: DB):
        return service.onboarding(db, actor, str(engagement_id))

    @app.post(
        "/api/v1/driver-portal/{engagement_id}/requirements/{requirement_id}/submissions", status_code=201
    )
    def submit(
        engagement_id: UUID,
        requirement_id: UUID,
        data: PersonalUpload,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        grant, engagement, tenant, req = personal_requirement(
            db, actor, str(engagement_id), str(requirement_id), write=True
        )
        return receive_evidence(
            db,
            actor,
            tenant.id,
            grant.driver_id,
            req.id,
            Upload(**data.model_dump()),
            Scope(tenant, engagement.branch_id, "driver"),
            db.get(DriverIdentity, grant.driver_id),
            req,
            request.state.correlation_id,
            submitted_via="driver",
        )

    @app.get(
        "/api/v1/driver-portal/{engagement_id}/requirements/{requirement_id}/submissions/{evidence_id}/download"
    )
    def download(
        engagement_id: UUID, requirement_id: UUID, evidence_id: UUID, actor: Actor, db: DB, request: Request
    ):
        grant, _, tenant, req = personal_requirement(db, actor, str(engagement_id), str(requirement_id))
        ev = db.scalar(
            select(EvidenceVersion).where(
                EvidenceVersion.id == str(evidence_id),
                EvidenceVersion.tenant_id == tenant.id,
                EvidenceVersion.requirement_id == req.id,
                EvidenceVersion.actor_id == actor.id,
            )
        )
        if not ev:
            raise DomainError("NOT_FOUND", "Submission unavailable.", 404)
        if (
            not ev.scanner
            or not ev.scanned_at
            or ev.status
            not in {
                "needs_review",
                "reviewed_accepted",
                "reviewed_rejected",
                "needs_more_information",
                "escalated",
            }
        ):
            raise DomainError("FILE_UNAVAILABLE", "Submission has not cleared its security scan.", 409)
        content = storage.get(ev.object_key)
        if hashlib.sha256(content).hexdigest() != ev.sha256:
            raise DomainError(
                "EVIDENCE_INTEGRITY_ERROR", "Submission unavailable; contact your company.", 409
            )
        record(
            db, actor, grant.tenant_id, "driver.submission_downloaded", ev.id, request.state.correlation_id
        )
        return Response(
            content,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": "attachment; filename*=UTF-8''"
                + quote(decrypt(ev.encrypted_filename), safe=""),
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
