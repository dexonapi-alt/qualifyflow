"""Read-only managed-service overview. Every aggregate retains the current scope."""

from uuid import UUID
from sqlalchemy import select, func, or_, false
from app.models import (
    ExceptionCase,
    ExceptionTask,
    OperatorAssignment,
    User,
    EvidenceReview,
    DriverRequirement,
    DriverEngagement,
    RequirementDefinition,
    DriverIdentity,
    ClientMessage,
    ApprovalRequest,
    now,
)
from app.shared.authorization import authorize
from app.drivers import service as drivers
from app.documents.routes import file_data
from app.approvals.routes import employer_admin, present as approval_data
from app.correspondence.routes import present as message_data
from app.correspondence.routes import active_policy


def overview(db, actor, tid):
    company_scope = authorize(db, actor, tid, "company:read")
    access = drivers.access(db, actor, tid)
    result = {
        "company_id": tid,
        "mode": company_scope.tenant.mode,
        "company_status": company_scope.tenant.status,
        "persona": "administration",
        "access": access,
        "drivers": [],
        "driver_total": None,
        "summary": {},
        "needs_you": [],
        "work": [],
        "activity": [],
        "team": [],
    }
    if not access:
        return result
    scope = authorize(db, actor, tid, "drivers:read")
    result["persona"] = "operations" if scope.role in {"specialist", "reviewer"} else "client"
    page = drivers.listing(db, actor, tid, limit=6)
    result["driver_total"] = page["total"]
    for driver in page["items"]:
        row = {**driver, "file": None}
        if access["can_write"]:
            records = [r for r in file_data(db, actor, tid, driver["id"])["items"] if r["engagement_current"]]
            row["file"] = {
                "assigned": len(records),
                "reviewed": sum(r["status"] == "verified" for r in records),
                "missing": sum(r["status"] == "missing" for r in records),
                "expired": sum(r["status"] == "expired" for r in records),
                "awaiting_review": sum(
                    any(
                        e["status"]
                        in {
                            "quarantined",
                            "scanning",
                            "needs_review",
                            "needs_more_information",
                            "escalated",
                            "scan_failed",
                        }
                        for e in r["evidence"]
                    )
                    for r in records
                ),
            }
        result["drivers"].append(row)
    staff = (
        select(OperatorAssignment, User)
        .join(User, User.id == OperatorAssignment.user_id)
        .where(
            OperatorAssignment.tenant_id == tid,
            OperatorAssignment.status == "active",
            OperatorAssignment.starts_at <= now(),
            or_(OperatorAssignment.ends_at.is_(None), OperatorAssignment.ends_at > now()),
            User.status == "active",
        )
    )
    if scope.branch_id:
        staff = staff.where(
            or_(OperatorAssignment.branch_id.is_(None), OperatorAssignment.branch_id == scope.branch_id)
        )
    result["team"] = [
        {"id": u.id, "email": u.email, "role": assignment.role} for assignment, u in db.execute(staff).all()
    ]
    if not access["can_write"]:
        return result
    case_query = (
        select(ExceptionCase, ExceptionTask, User)
        .join(ExceptionTask, ExceptionTask.case_id == ExceptionCase.id)
        .outerjoin(User, User.id == ExceptionTask.assignee_id)
        .where(ExceptionCase.tenant_id == tid, ExceptionCase.state.not_in(["resolved", "closed", "canceled"]))
    )
    if scope.branch_id:
        case_query = case_query.where(ExceptionCase.branch_id == scope.branch_id)
    open_cases = db.scalar(select(func.count()).select_from(case_query.subquery()))
    result["work"] = [
        {
            "id": c.id,
            "category": c.category,
            "state": c.state,
            "owner": u.email if u else None,
            "created_at": c.created_at,
            "mine": task.assignee_id == actor.id,
        }
        for c, task, u in db.execute(case_query.order_by(ExceptionCase.created_at).limit(5))
    ]
    handling = case_query.join(
        OperatorAssignment,
        (OperatorAssignment.user_id == ExceptionTask.assignee_id) & (OperatorAssignment.tenant_id == tid),
    ).where(
        OperatorAssignment.status == "active",
        OperatorAssignment.starts_at <= now(),
        or_(OperatorAssignment.ends_at.is_(None), OperatorAssignment.ends_at > now()),
        or_(OperatorAssignment.branch_id.is_(None), OperatorAssignment.branch_id == ExceptionCase.branch_id),
        User.status == "active",
        ExceptionCase.state.in_(["assigned", "in_review"]),
    )
    review_query = (
        select(EvidenceReview, User, DriverIdentity, RequirementDefinition)
        .join(User, User.id == EvidenceReview.actor_id)
        .join(DriverRequirement, DriverRequirement.id == EvidenceReview.requirement_id)
        .join(DriverEngagement, DriverEngagement.id == DriverRequirement.engagement_id)
        .join(DriverIdentity, DriverIdentity.id == DriverRequirement.driver_id)
        .join(RequirementDefinition, RequirementDefinition.id == DriverRequirement.definition_id)
        .where(EvidenceReview.tenant_id == tid)
    )
    if scope.branch_id:
        review_query = review_query.where(DriverEngagement.branch_id == scope.branch_id)
    result["activity"] = [
        {
            "id": review.id,
            "actor": u.email,
            "driver_id": d.id,
            "driver_reference": d.reference,
            "requirement": requirement.title,
            "outcome": review.outcome,
            "occurred_at": review.reviewed_at,
        }
        for review, u, d, requirement in db.execute(
            review_query.order_by(EvidenceReview.reviewed_at.desc()).limit(4)
        )
    ]
    completed = db.scalar(
        select(func.count()).select_from(
            review_query.where(EvidenceReview.outcome == "verified_evidence").subquery()
        )
    )
    action_total = 0
    if scope.role in {"specialist", "reviewer"}:
        actionable = case_query.where(
            ExceptionTask.assignee_id == actor.id,
            ExceptionCase.state.in_(["assigned", "in_review", "reopened"]),
        )
        action_total = db.scalar(select(func.count()).select_from(actionable.subquery()))
        result["needs_you"] = [
            {
                "id": c.id,
                "kind": "case",
                "title": c.category.replace("_", " "),
                "context": "Assigned to you · " + c.state.replace("_", " "),
                "created_at": c.created_at,
                "view": "exceptions",
            }
            for c, _, _ in db.execute(actionable.order_by(ExceptionCase.created_at).limit(5))
        ]
    if employer_admin(db, actor, tid):
        approval_query = (
            select(ApprovalRequest)
            .join(ExceptionCase, ExceptionCase.id == ApprovalRequest.case_id)
            .where(
                ApprovalRequest.tenant_id == tid,
                ApprovalRequest.status == "pending",
                ApprovalRequest.expires_at > now(),
                ApprovalRequest.case_version == ExceptionCase.version,
                ExceptionCase.state == "awaiting_internal_approval",
            )
        )
        action_total = db.scalar(select(func.count()).select_from(approval_query.subquery()))
        approvals = db.scalars(approval_query.order_by(ApprovalRequest.created_at).limit(5))
        for row in approvals:
            item = approval_data(db, actor, row)
            if item["can_decide"]:
                result["needs_you"].append(
                    {
                        "id": item["id"],
                        "kind": "decision",
                        "title": "Review a proposed resolution",
                        "context": item["proposal"][:160],
                        "created_at": item["created_at"],
                        "view": "approvals",
                    }
                )
        policy = active_policy(db, tid)
        pending = (
            (ClientMessage.status == "pending_approval")
            & (ClientMessage.policy_id == policy.id)
            & (ClientMessage.case_version == ExceptionCase.version)
            & (ExceptionCase.state == "in_review")
            if policy
            else false()
        )
        awaiting_reply = (
            (ClientMessage.recipient_id == actor.id)
            & ClientMessage.status.in_(["sent", "delivered"])
            & ClientMessage.responded_at.is_(None)
        )
        message_query = (
            select(ClientMessage)
            .join(ExceptionCase, ExceptionCase.id == ClientMessage.case_id)
            .where(
                ClientMessage.tenant_id == tid,
                ExceptionCase.state.not_in(["closed", "resolved", "canceled"]),
                or_(pending, awaiting_reply),
            )
        )
        action_total += db.scalar(select(func.count()).select_from(message_query.subquery()))
        messages = db.scalars(message_query.order_by(ClientMessage.created_at).limit(5))
        for row in messages:
            item = message_data(db, actor, row)
            if item["can_approve"] or item["can_reply"]:
                result["needs_you"].append(
                    {
                        "id": item["id"],
                        "kind": "message_approval" if item["can_approve"] else "request",
                        "title": "Approve a client request"
                        if item["can_approve"]
                        else "Your team needs a response",
                        "context": item["body"][:160],
                        "created_at": item["created_at"],
                        "view": "correspondence",
                    }
                )
    result["summary"] = {
        "open_cases": open_cases,
        "team_handling": db.scalar(select(func.count()).select_from(handling.subquery())),
        "recorded_reviews": completed,
        "needs_you": action_total,
    }
    # Action preview is bounded, totals reflect the scoped actionable objects inspected above.
    result["needs_you"] = result["needs_you"][:5]
    return result


def register(app, DB, Actor):
    @app.get("/api/v1/tenants/{tenant_id}/workspace")
    def home(tenant_id: UUID, actor: Actor, db: DB):
        return overview(db, actor, str(tenant_id))
