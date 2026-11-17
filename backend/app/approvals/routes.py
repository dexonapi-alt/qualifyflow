from datetime import datetime
from typing import Literal
from uuid import UUID
from fastapi import Query, Request
from pydantic import Field
from sqlalchemy import select, func
from app.models import ApprovalRequest, ApprovalDecision, ExceptionCase, Membership, User, now
from app.organizations.schemas import Input
from app.shared.authorization import authorize
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.exceptions import service as cases
from app.audit.service import record


class Propose(Input):
    version: int = Field(ge=1)
    proposal: str = Field(min_length=20, max_length=2000)
    expires_at: datetime


class Decide(Input):
    outcome: Literal["approved", "rejected", "needs_information"]
    reason: str = Field(min_length=10, max_length=2000)


class Withdraw(Input):
    reason: str = Field(min_length=10, max_length=2000)


def employer_admin(db, actor, tid):
    return (
        db.scalar(
            select(Membership.id).where(
                Membership.tenant_id == tid,
                Membership.user_id == actor.id,
                Membership.status == "active",
                Membership.role == "client_admin",
                Membership.branch_id.is_(None),
            )
        )
        is not None
    )


def present(db, actor, approval):
    case = db.get(ExceptionCase, approval.case_id)
    decision = db.scalar(select(ApprovalDecision).where(ApprovalDecision.approval_id == approval.id))
    author = db.get(User, approval.requested_by)
    return {
        "id": approval.id,
        "case_id": approval.case_id,
        "case_version": approval.case_version,
        "action": approval.action,
        "proposal": decrypt(approval.encrypted_proposal),
        "status": "expired"
        if approval.status == "pending" and approval.expires_at <= now()
        else approval.status,
        "expires_at": approval.expires_at,
        "created_at": approval.created_at,
        "requested_by": author.email,
        "can_withdraw": approval.status == "pending"
        and (
            approval.requested_by == actor.id
            or cases.reviewer(authorize(db, actor, approval.tenant_id, "drivers:write"))
        ),
        "can_decide": employer_admin(db, actor, approval.tenant_id)
        and approval.status == "pending"
        and approval.expires_at > now()
        and case.version == approval.case_version
        and case.state == "awaiting_internal_approval",
        "decision": {
            "outcome": decision.outcome,
            "reason": decrypt(decision.encrypted_reason),
            "decided_at": decision.decided_at,
            "actor": db.get(User, decision.actor_id).email,
        }
        if decision
        else None,
    }


def register(app, DB, Actor):
    @app.post("/api/v1/tenants/{tenant_id}/exceptions/{case_id}/approvals", status_code=201)
    def propose(tenant_id: UUID, case_id: UUID, data: Propose, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        scope, case, task = cases.scoped(db, actor, tid, str(case_id), True)
        if case.version != data.version or case.state != "in_review":
            raise DomainError(
                "VERSION_CONFLICT",
                "Refresh the case. Approval requests require the current in-review version.",
                409,
            )
        if task.assignee_id != actor.id and not cases.reviewer(scope):
            raise DomainError(
                "FORBIDDEN", "Only the case owner or authorized reviewer may propose resolution.", 403
            )
        if cases.unresolved_policy_blocker(db, case):
            raise DomainError(
                "STATE_TRANSITION_DENIED",
                "Missing evidence/requirement controls cannot be overridden by this administrative approval.",
                409,
            )
        if data.expires_at.tzinfo is None or data.expires_at <= now():
            raise DomainError("VALIDATION_FAILED", "Choose a future expiry with a timezone.", 422)
        case.state, case.version = "awaiting_internal_approval", case.version + 1
        approval = ApprovalRequest(
            tenant_id=tid,
            case_id=case.id,
            case_version=case.version,
            requested_by=actor.id,
            encrypted_proposal=encrypt(data.proposal),
            expires_at=data.expires_at,
        )
        db.add(approval)
        db.flush()
        cases.event(
            db,
            case,
            actor,
            "approval.requested",
            data.proposal,
            approval_id=approval.id,
            case_version=case.version,
        )
        record(
            db, actor, tid, "approval.requested", approval.id, request.state.correlation_id, case_id=case.id
        )
        return present(db, actor, approval)

    @app.get("/api/v1/tenants/{tenant_id}/approvals")
    def listing(tenant_id: UUID, actor: Actor, db: DB, offset: int = Query(default=0, ge=0)):
        scope = authorize(db, actor, str(tenant_id), "drivers:write")
        query = (
            select(ApprovalRequest)
            .join(ExceptionCase, ExceptionCase.id == ApprovalRequest.case_id)
            .where(ApprovalRequest.tenant_id == str(tenant_id))
        )
        if scope.branch_id:
            query = query.where(ExceptionCase.branch_id == scope.branch_id)
        total = db.scalar(select(func.count()).select_from(query.subquery()))
        return {
            "total": total,
            "items": [
                present(db, actor, item)
                for item in db.scalars(
                    query.order_by(ApprovalRequest.created_at.desc()).offset(offset).limit(25)
                )
            ],
        }

    @app.post("/api/v1/tenants/{tenant_id}/approvals/{approval_id}/decide")
    def decide(tenant_id: UUID, approval_id: UUID, data: Decide, actor: Actor, db: DB, request: Request):
        tid = str(tenant_id)
        approval = db.scalar(
            select(ApprovalRequest).where(
                ApprovalRequest.id == str(approval_id), ApprovalRequest.tenant_id == tid
            )
        )
        if not approval:
            raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
        _, case, _ = cases.scoped(db, actor, tid, approval.case_id, True)
        approval = db.scalar(
            select(ApprovalRequest)
            .where(ApprovalRequest.id == approval.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if not employer_admin(db, actor, tid):
            raise DomainError(
                "FORBIDDEN", "A current whole-company employer administrator must decide this request.", 403
            )
        if (
            approval.status != "pending"
            or approval.expires_at <= now()
            or case.version != approval.case_version
            or case.state != "awaiting_internal_approval"
        ):
            raise DomainError(
                "VERSION_CONFLICT",
                "This request is decided, expired or no longer matches the current case.",
                409,
            )
        db.add(
            ApprovalDecision(
                approval_id=approval.id,
                actor_id=actor.id,
                outcome=data.outcome,
                encrypted_reason=encrypt(data.reason),
            )
        )
        approval.status = data.outcome
        case.state, case.version = "in_review", case.version + 1
        approval.authorized_version = case.version if data.outcome == "approved" else None
        cases.event(
            db, case, actor, "approval.decided", data.reason, approval_id=approval.id, outcome=data.outcome
        )
        record(
            db,
            actor,
            tid,
            "approval.decided",
            approval.id,
            request.state.correlation_id,
            outcome=data.outcome,
        )
        return {"saved": True}

    @app.post("/api/v1/tenants/{tenant_id}/approvals/{approval_id}/withdraw")
    def withdraw(tenant_id: UUID, approval_id: UUID, data: Withdraw, actor: Actor, db: DB):
        tid = str(tenant_id)
        approval = db.scalar(
            select(ApprovalRequest).where(
                ApprovalRequest.id == str(approval_id), ApprovalRequest.tenant_id == tid
            )
        )
        if not approval:
            raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
        scope, case, _ = cases.scoped(db, actor, tid, approval.case_id, True)
        approval = db.scalar(
            select(ApprovalRequest)
            .where(ApprovalRequest.id == approval.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if actor.id != approval.requested_by and not cases.reviewer(scope):
            raise DomainError("FORBIDDEN", "Only the requester or authorized reviewer can withdraw.", 403)
        if approval.status != "pending":
            raise DomainError("STATE_TRANSITION_DENIED", "Only pending requests can be withdrawn.", 409)
        approval.status = "withdrawn"
        if case.state == "awaiting_internal_approval":
            case.state, case.version = "in_review", case.version + 1
        cases.event(db, case, actor, "approval.withdrawn", data.reason, approval_id=approval.id)
        return {"saved": True}
