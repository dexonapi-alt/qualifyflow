import hashlib
import json
from zoneinfo import ZoneInfo
from sqlalchemy import select, func, or_
from sqlalchemy.dialects.postgresql import insert

from app.models import DriverIdentity, DriverEngagement, DriverHistory, DriverCommand, Branch, User, uid, now
from app.shared.authorization import authorize, allow_write, ROLE_CAPABILITIES
from app.shared.errors import DomainError, conflict
from app.organizations.service import lock_tenant, branch_check
from app.audit.service import record

TRANSITIONS = {
    "engagement_draft": ["onboarding", "ended"],
    "onboarding": ["active", "ended"],
    "active": ["suspended", "inactive", "ended"],
    "suspended": ["active", "ended"],
    "inactive": [],
    "ended": [],
}


def unavailable():
    raise DomainError("NOT_FOUND", "Resource unavailable.", 404)


def access(db, actor, tid):
    try:
        scope = authorize(db, actor, tid, "drivers:read")
    except DomainError as error:
        if error.status == 404:
            return None
        raise
    capabilities = ROLE_CAPABILITIES.get(scope.role, set())
    writable = scope.tenant.status not in {"suspended", "offboarding", "closed", "archived_draft"}
    return {
        "role": scope.role,
        "branch_id": scope.branch_id,
        "can_write": writable and "drivers:write" in capabilities,
        "can_rehire": writable and not scope.branch_id and "drivers:write" in capabilities,
        "can_history": not scope.branch_id and "audit:read" in capabilities,
        "can_correct": writable and not scope.branch_id and "drivers:correct" in capabilities,
        "can_transfer": writable and not scope.branch_id and "drivers:correct" in capabilities,
    }


def scope_branch(scope, branch_id):
    branch_id = str(branch_id) if branch_id else None
    if scope.branch_id and scope.branch_id != branch_id:
        unavailable()
    return branch_id


def scoped_engagements(scope, did):
    query = select(DriverEngagement).where(
        DriverEngagement.tenant_id == scope.tenant.id, DriverEngagement.driver_id == did
    )
    if scope.branch_id:
        query = query.where(DriverEngagement.branch_id == scope.branch_id)
    return query.order_by(DriverEngagement.created_at.desc(), DriverEngagement.id)


def identity(db, actor, tid, did, capability="drivers:read", lock=False):
    scope = authorize(db, actor, tid, capability)
    query = select(DriverIdentity).where(DriverIdentity.id == did, DriverIdentity.tenant_id == tid)
    if lock:
        allow_write(lock_tenant(db, actor, tid, capability))
        scope = authorize(db, actor, tid, capability)
        query = query.with_for_update()
    driver = db.scalar(query)
    if not driver or not db.scalar(scoped_engagements(scope, did).limit(1)):
        unavailable()
    return scope, driver


def facts(driver):
    return {
        key: getattr(driver, key)
        for key in ("id", "reference", "first_name", "last_name", "version", "created_at")
    }


def engagement_data(db, item, can_write):
    branch = db.get(Branch, item.branch_id) if item.branch_id else None
    result = {
        key: getattr(item, key) for key in ("id", "branch_id", "start_date", "end_date", "status", "version")
    }
    result.update(
        branch_name=branch.name if branch else None,
        allowed_transitions=TRANSITIONS.get(item.status, []) if can_write else [],
    )
    return result


def detail(db, actor, tid, did):
    scope, driver = identity(db, actor, tid, did)
    permitted = access(db, actor, tid)
    result = facts(driver)
    result["engagements"] = [
        engagement_data(db, e, permitted["can_write"]) for e in db.scalars(scoped_engagements(scope, did))
    ]
    result["access"] = permitted
    result["history"] = None
    result["history_total"] = None
    if permitted["can_history"]:
        result["history_total"] = db.scalar(
            select(func.count())
            .select_from(DriverHistory)
            .where(DriverHistory.tenant_id == tid, DriverHistory.driver_id == did)
        )
        result["history"] = [
            {
                "id": h.id,
                "action": h.action,
                "reason": h.reason,
                "details": h.details,
                "actor_id": h.actor_id,
                "actor_email": actor_email,
                "occurred_at": h.occurred_at,
            }
            for h, actor_email in db.execute(
                select(DriverHistory, User.email)
                .join(User, User.id == DriverHistory.actor_id)
                .where(DriverHistory.tenant_id == tid, DriverHistory.driver_id == did)
                .order_by(DriverHistory.occurred_at.desc(), DriverHistory.id)
                .limit(100)
            )
        ]
    return result


def listing(db, actor, tid, q="", status=None, offset=0, limit=25):
    scope = authorize(db, actor, tid, "drivers:read")
    visible = scoped_engagements(scope, DriverIdentity.id).order_by(None)
    query = select(DriverIdentity).where(DriverIdentity.tenant_id == tid, visible.exists())
    if status:
        latest_status = (
            scoped_engagements(scope, DriverIdentity.id)
            .with_only_columns(DriverEngagement.status)
            .limit(1)
            .scalar_subquery()
        )
        query = query.where(latest_status == status)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = "%" + escaped + "%"
        query = query.where(
            or_(
                DriverIdentity.reference.ilike(pattern, escape="\\"),
                DriverIdentity.first_name.ilike(pattern, escape="\\"),
                DriverIdentity.last_name.ilike(pattern, escape="\\"),
                (DriverIdentity.first_name + " " + DriverIdentity.last_name).ilike(pattern, escape="\\"),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(DriverIdentity.last_name, DriverIdentity.first_name, DriverIdentity.id)
        .offset(offset)
        .limit(limit)
    )
    permitted = access(db, actor, tid)
    items = []
    for driver in rows:
        item = facts(driver)
        latest = db.scalar(scoped_engagements(scope, driver.id).limit(1))
        item["engagement"] = engagement_data(db, latest, permitted["can_write"])
        items.append(item)
    return {"items": items, "total": total, "offset": offset, "limit": limit}


def history_page(db, actor, tid, did, offset):
    identity(db, actor, tid, did)
    if not access(db, actor, tid)["can_history"]:
        raise DomainError("FORBIDDEN", "Record history requires whole-company audit authority.", 403)
    query = (
        select(DriverHistory, User.email)
        .join(User, User.id == DriverHistory.actor_id)
        .where(DriverHistory.tenant_id == tid, DriverHistory.driver_id == did)
    )
    rows = db.execute(
        query.order_by(DriverHistory.occurred_at.desc(), DriverHistory.id).offset(offset).limit(100)
    )
    return {
        "items": [
            {
                "id": h.id,
                "action": h.action,
                "reason": h.reason,
                "details": h.details,
                "actor_id": h.actor_id,
                "actor_email": email,
                "occurred_at": h.occurred_at,
            }
            for h, email in rows
        ]
    }


def event(db, actor, driver, engagement, action, reason, cid, **details):
    db.add(
        DriverHistory(
            tenant_id=driver.tenant_id,
            driver_id=driver.id,
            engagement_id=engagement.id if engagement else None,
            actor_id=actor.id,
            action=action,
            reason=reason,
            details=details,
        )
    )
    # General audit intentionally carries no names or sensitive correction payload.
    record(
        db,
        actor,
        driver.tenant_id,
        action,
        driver.id,
        cid,
        engagement_id=engagement.id if engagement else None,
    )


def create(db, actor, tid, data, cid):
    scope = authorize(db, actor, tid, "drivers:write")
    allow_write(lock_tenant(db, actor, tid, "drivers:write"))
    bid = scope_branch(scope, data.branch_id)
    branch_check(db, tid, bid)
    hashed = hashlib.sha256(json.dumps(data.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()
    did = uid()
    claimed = db.scalar(
        insert(DriverCommand)
        .values(
            id=uid(),
            tenant_id=tid,
            actor_id=actor.id,
            command_id=str(data.command_id),
            request_hash=hashed,
            driver_id=did,
        )
        .on_conflict_do_nothing(index_elements=["tenant_id", "actor_id", "command_id"])
        .returning(DriverCommand.id)
    )
    if not claimed:
        receipt = db.scalar(
            select(DriverCommand).where(
                DriverCommand.tenant_id == tid,
                DriverCommand.actor_id == actor.id,
                DriverCommand.command_id == str(data.command_id),
            )
        )
        if receipt.request_hash != hashed:
            raise DomainError("CONFLICT", "This command key was used with different information.", 409)
        return detail(db, actor, tid, receipt.driver_id)
    if db.scalar(
        select(DriverIdentity.id).where(
            DriverIdentity.tenant_id == tid, DriverIdentity.reference == data.reference
        )
    ):
        raise DomainError(
            "DRIVER_REFERENCE_CONFLICT",
            "This company reference is already in use. Investigate the existing record; do not merge by name.",
            409,
        )
    driver = DriverIdentity(
        id=did, tenant_id=tid, reference=data.reference, first_name=data.first_name, last_name=data.last_name
    )
    db.add(driver)
    db.flush()
    engagement = DriverEngagement(
        tenant_id=tid, driver_id=driver.id, branch_id=bid, start_date=data.start_date
    )
    db.add(engagement)
    db.flush()
    event(
        db,
        actor,
        driver,
        engagement,
        "driver.created",
        "Driver registered with an explicit company reference",
        cid,
    )
    db.flush()
    return detail(db, actor, tid, driver.id)


def correct(db, actor, tid, did, data, cid):
    scope, driver = identity(db, actor, tid, did, "drivers:correct", True)
    if scope.branch_id:
        raise DomainError("FORBIDDEN", "Identity corrections require whole-company review authority.", 403)
    if driver.version != data.version:
        conflict()
    before = {key: getattr(driver, key) for key in ("reference", "first_name", "last_name")}
    for key in before:
        setattr(driver, key, getattr(data, key))
    if before == {key: getattr(driver, key) for key in before}:
        raise DomainError("VALIDATION_FAILED", "Change a value before recording a correction.", 422)
    driver.version += 1
    event(
        db,
        actor,
        driver,
        None,
        "driver.identity_corrected",
        data.reason,
        cid,
        before=before,
        after={key: getattr(driver, key) for key in before},
        verified_basis=data.verified_basis,
    )
    db.flush()
    return detail(db, actor, tid, did)


def open_engagement(db, actor, tid, did, data, cid):
    scope, driver = identity(db, actor, tid, did, "drivers:write", True)
    if scope.branch_id:
        raise DomainError("FORBIDDEN", "Re-engagement requires whole-company authority.", 403)
    bid = scope_branch(scope, data.branch_id)
    branch_check(db, tid, bid)
    previous = list(
        db.scalars(
            select(DriverEngagement).where(
                DriverEngagement.tenant_id == tid, DriverEngagement.driver_id == did
            )
        )
    )
    if any(e.end_date is None for e in previous):
        raise DomainError("CONFLICT", "End or transfer the current engagement before creating another.", 409)
    if any(e.end_date > data.start_date for e in previous):
        raise DomainError(
            "VALIDATION_FAILED", "New engagement cannot precede the previous engagement's end.", 422
        )
    engagement = DriverEngagement(tenant_id=tid, driver_id=did, branch_id=bid, start_date=data.start_date)
    db.add(engagement)
    db.flush()
    event(db, actor, driver, engagement, "driver.engagement_created", data.reason, cid)
    db.flush()
    return detail(db, actor, tid, did)


def change_engagement(db, actor, tid, did, eid, data, cid, transfer=False):
    capability = "drivers:correct" if transfer else "drivers:write"
    scope, driver = identity(db, actor, tid, did, capability, True)
    engagement = db.scalar(scoped_engagements(scope, did).where(DriverEngagement.id == eid).with_for_update())
    if not engagement:
        unavailable()
    if engagement.version != data.version:
        conflict()
    if transfer:
        if scope.branch_id:
            raise DomainError("FORBIDDEN", "Transfers require whole-company review authority.", 403)
        if engagement.end_date is not None:
            raise DomainError(
                "STATE_TRANSITION_DENIED", "Only the current engagement can be transferred.", 409
            )
        bid = scope_branch(scope, data.branch_id)
        branch_check(db, tid, bid)
        if bid == engagement.branch_id or data.effective_date < engagement.start_date:
            raise DomainError(
                "VALIDATION_FAILED",
                "Select a different location and a date on or after the engagement start.",
                422,
            )
        if data.effective_date > now().astimezone(ZoneInfo(scope.tenant.timezone)).date():
            raise DomainError(
                "VALIDATION_FAILED",
                "Future-dated transfers require a scheduled workflow and cannot be applied now.",
                422,
            )
        previous_status = engagement.status
        engagement.end_date = data.effective_date
        engagement.status = "ended"
        engagement.version += 1
        db.flush()  # End old row before the partial uniqueness constraint sees the new one.
        next_engagement = DriverEngagement(
            tenant_id=tid,
            driver_id=did,
            branch_id=bid,
            start_date=data.effective_date,
            status=previous_status,
        )
        db.add(next_engagement)
        db.flush()
        event(
            db,
            actor,
            driver,
            engagement,
            "driver.engagement_transferred",
            data.reason,
            cid,
            previous_engagement_id=engagement.id,
            next_engagement_id=next_engagement.id,
            previous_branch_id=engagement.branch_id,
            next_branch_id=bid,
        )
    else:
        if data.status not in TRANSITIONS.get(engagement.status, []):
            raise DomainError("STATE_TRANSITION_DENIED", "This engagement transition is not allowed.", 409)
        ending = data.status in {"inactive", "ended"}
        today = now().astimezone(ZoneInfo(scope.tenant.timezone)).date()
        if (ending and data.end_date and data.end_date > today) or (
            data.status == "active" and engagement.start_date > today
        ):
            raise DomainError(
                "VALIDATION_FAILED",
                "Use an effective date that has occurred before applying this state change.",
                422,
            )
        if (ending and (not data.end_date or data.end_date < engagement.start_date)) or (
            not ending and data.end_date is not None
        ):
            raise DomainError(
                "VALIDATION_FAILED",
                "Provide a valid end date only when ending or deactivating an engagement.",
                422,
            )
        old_status = engagement.status
        engagement.status = data.status
        engagement.end_date = data.end_date
        engagement.version += 1
        event(
            db,
            actor,
            driver,
            engagement,
            "driver.engagement_changed",
            data.reason,
            cid,
            previous_status=old_status,
            status=engagement.status,
        )
    db.flush()
    return detail(db, actor, tid, did)
