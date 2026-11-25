import json
from sqlalchemy import select, func
from app.models import (
    ExceptionCase,
    ExceptionTask,
    ExceptionEvent,
    IntakeItem,
    IntakeAttachment,
    ApprovalRequest,
    User,
    DriverRequirement,
    DriverEngagement,
    RequirementDefinition,
    DriverIdentity,
    Tenant,
    now,
)
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.organizations.service import lock_tenant
from app.audit.service import record
from app.documents.state import requirement_state

TRANSITIONS = {
    "open": ["assigned", "canceled"],
    "assigned": ["in_review", "canceled"],
    "in_review": ["awaiting_client", "resolved"],
    "awaiting_client": ["in_review"],
    "awaiting_internal_approval": [],
    "resolved": ["closed", "reopened"],
    "reopened": ["assigned"],
    "closed": [],
    "canceled": [],
}


def event(db, case, actor, action, reason, **details):
    db.add(
        ExceptionEvent(
            tenant_id=case.tenant_id,
            case_id=case.id,
            actor_id=actor.id,
            action=action,
            encrypted_details=encrypt(json.dumps({"reason": reason, **details})),
        )
    )


def scoped(db, actor, tid, case_id, write=False):
    scope = authorize(db, actor, tid, "drivers:write")
    if write:
        allow_write(lock_tenant(db, actor, tid, "drivers:write"))
        scope = authorize(db, actor, tid, "drivers:write")
    query = select(ExceptionCase).where(ExceptionCase.id == case_id, ExceptionCase.tenant_id == tid)
    if scope.branch_id:
        query = query.where(ExceptionCase.branch_id == scope.branch_id)
    case = db.scalar(query.with_for_update() if write else query)
    if not case:
        raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
    task = db.scalar(select(ExceptionTask).where(ExceptionTask.case_id == case.id))
    return scope, case, task


def reviewer(scope):
    return not scope.branch_id and scope.role in {"client_admin", "reviewer"}


def unresolved_policy_blocker(db, case):
    if case.requirement_id:
        tenant = db.get(Tenant, case.tenant_id)
        return requirement_state(db, case.requirement_id, tenant.timezone) != "verified"
    from app.screening_intake.lineage import replacement

    active_source = case.source_item_id
    for _ in range(10):
        child = replacement(db, active_source)
        if not child:
            break
        active_source = child.id
    return case.category == "blocked_by_policy" and not db.scalar(
        select(IntakeAttachment.id).where(
            IntakeAttachment.tenant_id == case.tenant_id,
            IntakeAttachment.source_item_id == active_source,
        )
    )


def output(db, scope, case, task, full=False, actor_id=None):
    owner = db.get(User, task.assignee_id) if task.assignee_id else None
    result = {
        "id": case.id,
        "category": case.category,
        "severity": case.severity,
        "state": case.state,
        "version": case.version,
        "created_at": case.created_at,
        "branch_id": case.branch_id,
        "owner": owner.email if owner else None,
        "task_status": task.status,
    }
    if full:
        source = db.get(IntakeItem, case.source_item_id) if case.source_item_id else None
        result["source"] = json.loads(decrypt(source.encrypted_payload)) if source else None
        result["batch_id"] = source.batch_id if source else None
        result["source_item_id"] = source.id if source else None
        from app.screening_intake.lineage import replacement

        child = replacement(db, source.id) if source else None
        result["source_replacement"] = {"batch_id": child.batch_id, "item_id": child.id} if child else None
        result["origin"] = "intake" if source else "requirement"
        result["requirement"] = None
        if case.requirement_id:
            req = db.get(DriverRequirement, case.requirement_id)
            definition = db.get(RequirementDefinition, req.definition_id)
            driver = db.get(DriverIdentity, req.driver_id)
            result["requirement"] = {
                "id": req.id,
                "driver_id": req.driver_id,
                "engagement_id": req.engagement_id,
                "reference": driver.reference,
                "title": definition.title,
                "code": definition.code,
                "status": requirement_state(db, req.id, scope.tenant.timezone),
            }
        result["source_linked"] = (
            db.scalar(
                select(IntakeAttachment.id)
                .where(
                    IntakeAttachment.source_item_id == case.source_item_id,
                    IntakeAttachment.tenant_id == case.tenant_id,
                )
                .limit(1)
            )
            is not None
        )
        result["events"] = [
            {
                "id": e.id,
                "action": e.action,
                "actor": u.email,
                "occurred_at": e.occurred_at,
                "details": json.loads(decrypt(e.encrypted_details)),
            }
            for e, u in db.execute(
                select(ExceptionEvent, User)
                .join(User, User.id == ExceptionEvent.actor_id)
                .where(ExceptionEvent.case_id == case.id)
                .order_by(ExceptionEvent.occurred_at.desc())
                .limit(100)
            )
        ]
        allowed = list(TRANSITIONS.get(case.state, []))
        if not reviewer(scope):
            allowed = [s for s in allowed if s not in {"resolved", "closed", "canceled", "reopened"}]
        if task.assignee_id and task.assignee_id != actor_id and not reviewer(scope):
            allowed = []
        if unresolved_policy_blocker(db, case):
            allowed = [s for s in allowed if s != "resolved"]
        result["allowed_states"] = allowed
        result["can_reassign"] = reviewer(scope)
        result["can_request_approval"] = (
            case.state == "in_review"
            and not unresolved_policy_blocker(db, case)
            and (task.assignee_id == actor_id or reviewer(scope))
        )
    return result


def open_requirement_case(db, actor, tid, did, rid, reason, cid):
    # Same lock order as evidence writes: tenant, driver, requirement, case.
    from app.documents.routes import requirement

    scope, _, req = requirement(db, actor, tid, did, rid, True)
    db.refresh(req, with_for_update=True)
    existing = db.scalar(
        select(ExceptionCase)
        .where(
            ExceptionCase.tenant_id == tid,
            ExceptionCase.requirement_id == req.id,
            ExceptionCase.state.not_in(["resolved", "closed", "canceled"]),
        )
        .with_for_update()
    )
    if existing:
        task = db.scalar(select(ExceptionTask).where(ExceptionTask.case_id == existing.id))
        return output(db, scope, existing, task, True, actor.id)
    status = requirement_state(db, req.id, scope.tenant.timezone)
    if status == "verified":
        raise DomainError(
            "STATE_TRANSITION_DENIED",
            "This requirement has current accepted evidence; no missing-evidence case was opened.",
            409,
        )
    engagement = db.get(DriverEngagement, req.engagement_id)
    if engagement.end_date is not None:
        raise DomainError("STATE_TRANSITION_DENIED", "Open follow-up only for a current engagement.", 409)
    case = ExceptionCase(
        tenant_id=tid,
        branch_id=engagement.branch_id,
        requirement_id=req.id,
        category={"missing": "missing_evidence", "expired": "expired_evidence"}.get(
            status, "evidence_review"
        ),
    )
    db.add(case)
    db.flush()
    task = ExceptionTask(tenant_id=tid, case_id=case.id)
    db.add(task)
    event(db, case, actor, "exception.opened", reason, requirement_id=req.id, observed_state=status)
    record(db, actor, tid, "exception.opened", case.id, cid, requirement_id=req.id)
    db.flush()
    return output(db, scope, case, task, True, actor.id)


def listing(db, actor, tid, state=None, offset=0):
    scope = authorize(db, actor, tid, "drivers:write")
    query = select(ExceptionCase).where(ExceptionCase.tenant_id == tid)
    if scope.branch_id:
        query = query.where(ExceptionCase.branch_id == scope.branch_id)
    if state:
        query = query.where(ExceptionCase.state == state)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    return {
        "total": total,
        "items": [
            output(db, scope, c, db.scalar(select(ExceptionTask).where(ExceptionTask.case_id == c.id)))
            for c in db.scalars(query.order_by(ExceptionCase.created_at.desc()).offset(offset).limit(25))
        ],
    }


def change(db, actor, tid, case_id, data, cid):
    scope, case, task = scoped(db, actor, tid, case_id, True)
    if case.version != data.version:
        raise DomainError("VERSION_CONFLICT", "Case changed. Refresh before deciding.", 409)
    if data.state not in TRANSITIONS.get(case.state, []):
        raise DomainError("STATE_TRANSITION_DENIED", "This case transition is unavailable.", 409)
    if data.state in {"resolved", "closed", "canceled", "reopened"} and not reviewer(scope):
        raise DomainError("FORBIDDEN", "Whole-company review authority required.", 403)
    if task.assignee_id and task.assignee_id != actor.id and not reviewer(scope):
        raise DomainError(
            "FORBIDDEN", "Only the current owner or authorized reviewer may change this case.", 403
        )
    if data.state == "resolved" and unresolved_policy_blocker(db, case):
        raise DomainError(
            "STATE_TRANSITION_DENIED",
            "Source evidence must be reviewed and attached to a matching driver requirement before this case can be resolved.",
            409,
        )
    if data.state == "resolved" and not db.scalar(
        select(ApprovalRequest.id).where(
            ApprovalRequest.case_id == case.id,
            ApprovalRequest.status == "approved",
            ApprovalRequest.authorized_version == case.version,
            ApprovalRequest.expires_at > now(),
        )
    ):
        raise DomainError(
            "APPROVAL_REQUIRED",
            "An unexpired employer approval for this exact case version is required for administrative resolution.",
            409,
        )
    before = case.state
    case.state, case.version = data.state, case.version + 1
    if data.state == "assigned":
        task.assignee_id, task.status = actor.id, "assigned"
    elif data.state in {"resolved", "closed", "canceled"}:
        task.status = "completed"
    elif data.state == "reopened":
        task.assignee_id, task.status = None, "unassigned"
    event(db, case, actor, "exception.state_changed", data.reason, before=before, after=case.state)
    record(db, actor, tid, "exception.state_changed", case.id, cid, state=case.state)
    return case
