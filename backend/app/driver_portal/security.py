"""Personal grants are separate from company memberships and staff assignments."""

from sqlalchemy import select
from app.models import DriverPortalAccess, DriverEngagement, DriverRequirement, Tenant
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.driver_portal.requests import latest_request


def personal_access(db, actor, engagement_id, *, write=False):
    if not actor or actor.status != "active":
        raise DomainError("NOT_FOUND", "Onboarding unavailable.", 404)
    row = db.scalar(
        select(DriverPortalAccess)
        .where(
            DriverPortalAccess.engagement_id == engagement_id,
            DriverPortalAccess.user_id == actor.id,
            DriverPortalAccess.status == "active",
        )
        .execution_options(populate_existing=True)
    )
    engagement = db.get(DriverEngagement, engagement_id)
    if (
        not row
        or not engagement
        or engagement.end_date
        or engagement.status not in {"onboarding", "active", "engagement_draft"}
    ):
        raise DomainError("NOT_FOUND", "Onboarding unavailable.", 404)
    tenant = db.get(Tenant, row.tenant_id)
    allow_write(tenant)
    if write:
        # Same tenant-first lock order as staff mutations and grant revocation.
        db.scalar(select(Tenant).where(Tenant.id == row.tenant_id).with_for_update())
        row = db.scalar(
            select(DriverPortalAccess)
            .where(DriverPortalAccess.id == row.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        db.refresh(engagement)
        if (
            row.status != "active"
            or row.user_id != actor.id
            or engagement.end_date
            or engagement.status not in {"onboarding", "active", "engagement_draft"}
        ):
            raise DomainError("NOT_FOUND", "Onboarding unavailable.", 404)
        db.refresh(tenant)
        allow_write(tenant)
    return row, engagement, tenant


def personal_requirement(db, actor, engagement_id, requirement_id, *, write=False):
    grant, engagement, tenant = personal_access(db, actor, engagement_id, write=write)
    req = db.scalar(
        select(DriverRequirement)
        .where(
            DriverRequirement.id == requirement_id,
            DriverRequirement.tenant_id == grant.tenant_id,
            DriverRequirement.engagement_id == engagement.id,
            DriverRequirement.driver_id == grant.driver_id,
        )
        .execution_options(populate_existing=True)
    )
    shared = latest_request(db, req.id) if req else None
    if not req or not shared or not shared.visible:
        raise DomainError("NOT_FOUND", "Document request unavailable.", 404)
    return grant, engagement, tenant, req


def authorize_upload_actor(db, actor, tenant, req, submitted_via="staff"):
    """Worker rechecks either staff scope or the exact personal upload grant."""
    if submitted_via == "driver":
        personal_requirement(db, actor, req.engagement_id, req.id)
        return
    scope = authorize(db, actor, tenant.id, "drivers:write")
    engagement = db.get(DriverEngagement, req.engagement_id)
    if scope.branch_id and scope.branch_id != engagement.branch_id:
        raise DomainError("NOT_FOUND", "Scope changed.", 404)
    allow_write(tenant)
