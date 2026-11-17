from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID, uuid4

import pyotp
from fastapi import FastAPI, Depends, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select, text, or_
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User, Tenant, Branch, Membership, Invitation, OperatorAssignment, AuditEvent, now
from app.auth import service as authentication
from app.auth.schemas import Login, Accept
from app.organizations import service as companies
from app.organizations.schemas import (
    CompanyCreate,
    BranchCreate,
    InviteCreate,
    Configuration,
    Versioned,
    AssignmentCreate,
    MemberChange,
)
from app.shared.authorization import authorize, provisioning
from app.shared.errors import DomainError
from app.shared.security import token, digest
from app.audit.service import record
from app.drivers import service as drivers
from app.drivers.routes import register as register_driver_routes
from app.screening_intake.routes import register as register_intake_routes
from app.exceptions.routes import register as register_exception_routes
from app.approvals.routes import register as register_approval_routes
from app.documents.routes import register as register_document_routes
from app.correspondence.routes import register as register_correspondence_routes
from app.workspace import register as register_workspace_routes


@asynccontextmanager
async def lifespan(app):
    settings()
    yield


app = FastAPI(title="QualifyFlow", version="0.1.0", lifespan=lifespan)
DB = Annotated[Session, Depends(get_db, scope="function")]


@app.middleware("http")
async def context(request, call_next):
    request.state.correlation_id = str(uuid4())
    response = await call_next(request)
    response.headers.update(
        {
            "X-Correlation-ID": request.state.correlation_id,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "X-Frame-Options": "DENY",
        }
    )
    return response


def error_response(request, code, message, status, fields=None):
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "correlation_id": request.state.correlation_id,
                "retryable": False,
                "fields": fields or {},
            }
        },
    )


@app.exception_handler(DomainError)
async def domain_error(request, exc):
    return error_response(request, exc.code, exc.message, exc.status, exc.fields)


@app.exception_handler(RequestValidationError)
async def invalid(request, exc):
    # Never echo submitted passwords, tokens or raw validation input.
    fields = {str(e["loc"][-1]): e["msg"] for e in exc.errors()}
    return error_response(request, "VALIDATION_FAILED", "Check the highlighted fields.", 422, fields)


@app.exception_handler(IntegrityError)
async def duplicate(request, exc):
    return error_response(
        request, "CONFLICT", "A conflicting record exists. Refresh and check references.", 409
    )


@app.exception_handler(OperationalError)
async def database_unavailable(request, exc):
    return error_response(
        request, "SERVICE_UNAVAILABLE", "Database unavailable. Refresh before retrying.", 503
    )


@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    return error_response(
        request, "INTERNAL_ERROR", "Operation failed. Use the reference ID when reporting this issue.", 500
    )


def origin(request):
    if request.headers.get("origin") != settings().public_app_origin:
        raise DomainError("ORIGIN_REJECTED", "Request origin is not allowed.", 403)


def principal(request: Request, db: DB):
    actor, session = authentication.resolve(db, request.cookies.get("qf_session"))
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin(request)
        authentication.csrf_check(session, request.headers.get("x-csrf-token"))
    return actor


Actor = Annotated[User, Depends(principal)]


def public(row, *fields):
    return {key: getattr(row, key) for key in fields}


def company(row):
    return public(
        row,
        "id",
        "legal_name",
        "display_name",
        "customer_ref",
        "mode",
        "timezone",
        "region",
        "primary_contact",
        "effective_date",
        "status",
        "configuration",
        "version",
        "created_at",
    )


def invitation(row):
    result = public(row, "id", "email", "role", "branch_id", "status", "expires_at", "version")
    if row.status in {"queued", "sent", "send_failed"} and row.expires_at <= now():
        result["status"] = "expired"
    return result


def cid(request):
    return request.state.correlation_id


@app.get("/api/v1/health/live")
def live():
    return {"status": "alive", "environment": settings().app_env, "data_mode": "synthetic_only"}


@app.get("/api/v1/health/ready")
def ready(db: DB):
    db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "available"}


@app.post("/api/v1/auth/login")
def login(data: Login, request: Request, response: Response, db: DB):
    origin(request)
    actor, raw, csrf = authentication.login(db, data)
    record(db, actor, None, "session.created", actor.id, cid(request))
    response.set_cookie("qf_session", raw, httponly=True, samesite="strict", max_age=28800)
    response.set_cookie("qf_csrf", csrf, httponly=False, samesite="strict", max_age=28800)
    return {"user": public(actor, "id", "email", "platform_role")}


@app.get("/api/v1/auth/me")
def me(actor: Actor, request: Request, response: Response, db: DB):
    # Refresh CSRF on browser reload without exposing session credential to JavaScript.
    _, session = authentication.resolve(db, request.cookies.get("qf_session"))
    csrf = token()
    session.csrf_hash = digest(csrf)
    response.set_cookie("qf_csrf", csrf, samesite="strict", max_age=28800)
    return {"user": public(actor, "id", "email", "platform_role")}


@app.post("/api/v1/auth/logout")
def logout(actor: Actor, request: Request, response: Response, db: DB):
    _, session = authentication.resolve(db, request.cookies.get("qf_session"))
    db.delete(session)
    response.delete_cookie("qf_session")
    response.delete_cookie("qf_csrf")
    return {"status": "signed_out"}


@app.post("/api/v1/invitations/mfa-setup")
def mfa_setup(data: dict, request: Request, db: DB):
    origin(request)
    from app.shared.security import digest

    item = db.scalar(select(Invitation).where(Invitation.token_hash == digest(str(data.get("token", "")))))
    if not item or item.status not in {"queued", "sent", "send_failed"} or item.expires_at <= now():
        raise DomainError("INVITATION_UNAVAILABLE", "Invitation unavailable.", 400)
    companies.allow_write(db.get(Tenant, item.tenant_id))
    secret = pyotp.random_base32()
    return {
        "secret": secret,
        "uri": pyotp.TOTP(secret).provisioning_uri(name=item.email, issuer_name="QualifyFlow local"),
    }


@app.post("/api/v1/invitations/accept")
def accept(data: Accept, request: Request, db: DB):
    origin(request)
    actor, session = authentication.resolve(db, request.cookies.get("qf_session"), required=False)
    if actor:
        authentication.csrf_check(session, request.headers.get("x-csrf-token"))
    return companies.accept(db, data, actor, cid(request))


@app.get("/api/v1/tenants")
def tenants(actor: Actor, db: DB, offset: int = 0, limit: int = 50):
    offset, limit = max(0, offset), max(1, min(100, limit))
    query = select(Tenant)
    if actor.platform_role != "service_admin":
        members = select(Membership.tenant_id).where(
            Membership.user_id == actor.id, Membership.status == "active"
        )
        assigned = select(OperatorAssignment.tenant_id).where(
            OperatorAssignment.user_id == actor.id,
            OperatorAssignment.status == "active",
            OperatorAssignment.starts_at <= now(),
            or_(OperatorAssignment.ends_at.is_(None), OperatorAssignment.ends_at > now()),
        )
        query = query.where(or_(Tenant.id.in_(members), Tenant.id.in_(assigned)))
    return {
        "items": [
            company(t)
            for t in db.scalars(query.order_by(Tenant.created_at.desc()).offset(offset).limit(limit))
        ],
        "offset": offset,
        "limit": limit,
    }


@app.post("/api/v1/tenants", status_code=201)
def create_tenant(data: CompanyCreate, actor: Actor, db: DB, request: Request):
    return company(companies.create_company(db, actor, data, cid(request)))


@app.get("/api/v1/tenants/{tenant_id}")
def get_tenant(tenant_id: UUID, actor: Actor, db: DB):
    scope = authorize(db, actor, str(tenant_id))
    tenant = scope.tenant
    branches = select(Branch).where(Branch.tenant_id == tenant.id)
    if scope.branch_id:
        branches = branches.where(Branch.id == scope.branch_id)
    result = company(tenant)
    result["branches"] = [
        public(b, "id", "name", "reference", "status", "version")
        for b in db.scalars(branches.order_by(Branch.name))
    ]
    result["scope"] = {"role": scope.role, "branch_id": scope.branch_id}
    result["driver_access"] = drivers.access(db, actor, tenant.id)
    result["missing_prerequisites"] = companies.readiness(db, tenant) if scope.role == "service_admin" else []
    return result


@app.post("/api/v1/tenants/{tenant_id}/configuration")
def configuration(tenant_id: UUID, data: Configuration, actor: Actor, db: DB, request: Request):
    return company(companies.configure(db, actor, str(tenant_id), data, cid(request)))


@app.post("/api/v1/tenants/{tenant_id}/review")
@app.post("/api/v1/tenants/{tenant_id}/activate")
@app.post("/api/v1/tenants/{tenant_id}/suspend")
def transition(tenant_id: UUID, data: Versioned, actor: Actor, db: DB, request: Request):
    return company(
        companies.transition(
            db, actor, str(tenant_id), request.url.path.rsplit("/", 1)[-1], data, cid(request)
        )
    )


@app.post("/api/v1/tenants/{tenant_id}/branches", status_code=201)
def branch(tenant_id: UUID, data: BranchCreate, actor: Actor, db: DB, request: Request):
    return public(
        companies.add_branch(db, actor, str(tenant_id), data, cid(request)),
        "id",
        "name",
        "reference",
        "status",
        "version",
    )


@app.get("/api/v1/tenants/{tenant_id}/invitations")
def invites(tenant_id: UUID, actor: Actor, db: DB):
    authorize(db, actor, str(tenant_id), "users:manage")
    return {
        "items": [
            invitation(i)
            for i in db.scalars(
                select(Invitation)
                .where(Invitation.tenant_id == str(tenant_id))
                .order_by(Invitation.expires_at.desc())
                .limit(100)
            )
        ]
    }


@app.post("/api/v1/tenants/{tenant_id}/invitations", status_code=201)
def invite(tenant_id: UUID, data: InviteCreate, actor: Actor, db: DB, request: Request):
    return invitation(companies.invite(db, actor, str(tenant_id), data, cid(request)))


@app.post("/api/v1/tenants/{tenant_id}/invitations/{invite_id}/resend")
@app.post("/api/v1/tenants/{tenant_id}/invitations/{invite_id}/revoke")
def invite_action(tenant_id: UUID, invite_id: UUID, data: Versioned, actor: Actor, db: DB, request: Request):
    return invitation(
        companies.invitation_action(
            db, actor, str(tenant_id), str(invite_id), request.url.path.rsplit("/", 1)[-1], data, cid(request)
        )
    )


@app.get("/api/v1/staff")
def staff(actor: Actor, db: DB):
    provisioning(actor)
    return {
        "items": [
            public(u, "id", "email")
            for u in db.scalars(
                select(User).where(
                    User.platform_role == "specialist", User.status == "active", User.totp_secret.is_not(None)
                )
            )
        ]
    }


@app.get("/api/v1/tenants/{tenant_id}/operator-assignments")
def assignments(tenant_id: UUID, actor: Actor, db: DB):
    authorize(db, actor, str(tenant_id), "assignments:manage")
    return {
        "items": [
            dict(public(a, "id", "user_id", "branch_id", "status", "version"), email=u.email)
            for a, u in db.execute(
                select(OperatorAssignment, User)
                .join(User)
                .where(OperatorAssignment.tenant_id == str(tenant_id))
            )
        ]
    }


@app.post("/api/v1/tenants/{tenant_id}/operator-assignments", status_code=201)
def assign(tenant_id: UUID, data: AssignmentCreate, actor: Actor, db: DB, request: Request):
    return public(
        companies.assign(db, actor, str(tenant_id), data, cid(request)),
        "id",
        "user_id",
        "branch_id",
        "status",
        "version",
    )


@app.post("/api/v1/tenants/{tenant_id}/operator-assignments/{assignment_id}/end")
def end_assignment(
    tenant_id: UUID, assignment_id: UUID, data: Versioned, actor: Actor, db: DB, request: Request
):
    return public(
        companies.end_assignment(db, actor, str(tenant_id), str(assignment_id), data, cid(request)),
        "id",
        "status",
        "version",
    )


@app.get("/api/v1/tenants/{tenant_id}/memberships")
def memberships(tenant_id: UUID, actor: Actor, db: DB):
    authorize(db, actor, str(tenant_id), "users:manage")
    return {
        "items": [
            dict(public(m, "id", "role", "branch_id", "status", "version"), email=u.email)
            for m, u in db.execute(
                select(Membership, User).join(User).where(Membership.tenant_id == str(tenant_id))
            )
        ]
    }


@app.post("/api/v1/tenants/{tenant_id}/memberships/{membership_id}/change")
def change_member(
    tenant_id: UUID, membership_id: UUID, data: MemberChange, actor: Actor, db: DB, request: Request
):
    return public(
        companies.change_member(db, actor, str(tenant_id), str(membership_id), data, cid(request)),
        "id",
        "role",
        "status",
        "version",
    )


@app.get("/api/v1/tenants/{tenant_id}/audit-events")
def audit(tenant_id: UUID, actor: Actor, db: DB, offset: int = 0):
    authorize(db, actor, str(tenant_id), "audit:read")
    driver_access = drivers.access(db, actor, str(tenant_id))
    events = select(AuditEvent).where(AuditEvent.tenant_id == str(tenant_id))
    if not driver_access or not driver_access["can_history"]:
        events = events.where(~AuditEvent.action.startswith("driver."))
        events = events.where(~AuditEvent.action.startswith("intake."))
        events = events.where(~AuditEvent.action.startswith("exception."))
        events = events.where(~AuditEvent.action.startswith("approval."))
        events = events.where(~AuditEvent.action.startswith("evidence."))
        events = events.where(~AuditEvent.action.startswith("message."))
    return {
        "items": [
            public(e, "id", "action", "resource_id", "actor_id", "details", "occurred_at", "correlation_id")
            for e in db.scalars(
                events.order_by(AuditEvent.occurred_at.desc()).offset(max(0, offset)).limit(100)
            )
        ]
    }


register_driver_routes(app, DB, Actor)
register_intake_routes(app, DB, Actor)
register_exception_routes(app, DB, Actor)
register_approval_routes(app, DB, Actor)
register_document_routes(app, DB, Actor)
register_correspondence_routes(app, DB, Actor)
register_workspace_routes(app, DB, Actor)
