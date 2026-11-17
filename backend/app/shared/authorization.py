from dataclasses import dataclass
from sqlalchemy import select

from app.models import Membership, OperatorAssignment, Tenant, now
from app.shared.errors import DomainError

ROLE_CAPABILITIES = {
    "client_admin": {"company:read", "branches:manage", "users:manage", "audit:read"},
    "client_contributor": {"company:read"},
    "client_viewer": {"company:read"},
    "specialist": {"company:read"},
    "reviewer": {"company:read", "audit:read"},
    "integration_admin": {"company:read"},
}

# Driver access is relationship-scoped, never implied by provisioning authority.
for _role in ("client_admin", "client_contributor", "client_viewer", "specialist", "reviewer"):
    ROLE_CAPABILITIES[_role].add("drivers:read")
for _role in ("client_admin", "client_contributor", "specialist", "reviewer"):
    ROLE_CAPABILITIES[_role].add("drivers:write")
for _role in ("client_admin", "reviewer"):
    ROLE_CAPABILITIES[_role].add("drivers:correct")


@dataclass(frozen=True)
class Scope:
    tenant: Tenant
    branch_id: str | None
    role: str


def provisioning(actor):
    if actor.status != "active" or actor.platform_role != "service_admin":
        raise DomainError("FORBIDDEN", "Service administration permission required.", 403)


def authorize(db, actor, tenant_id, capability="company:read", *, branch_id=None):
    if actor.status != "active":
        raise DomainError("UNAUTHORIZED", "Account is inactive.", 401)
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
    # Provisioning admins can administer organizational metadata, never driver/report access.
    if actor.platform_role == "service_admin" and capability in {
        "company:read",
        "company:manage",
        "branches:manage",
        "users:manage",
        "assignments:manage",
        "audit:read",
    }:
        return Scope(tenant, None, "service_admin")
    grant = db.scalar(
        select(Membership)
        .where(
            Membership.tenant_id == tenant_id, Membership.user_id == actor.id, Membership.status == "active"
        )
        .execution_options(populate_existing=True)
    )
    if grant is None:
        grant = db.scalar(
            select(OperatorAssignment)
            .where(
                OperatorAssignment.tenant_id == tenant_id,
                OperatorAssignment.user_id == actor.id,
                OperatorAssignment.status == "active",
                OperatorAssignment.starts_at <= now(),
                (OperatorAssignment.ends_at.is_(None) | (OperatorAssignment.ends_at > now())),
            )
            .execution_options(populate_existing=True)
        )
    if not grant or capability not in ROLE_CAPABILITIES.get(grant.role, set()):
        raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
    if grant.branch_id and capability in {"users:manage", "branches:manage", "audit:read"}:
        raise DomainError("FORBIDDEN", "Company-wide administration requires a company-wide grant.", 403)
    if grant.branch_id and branch_id and grant.branch_id != branch_id:
        raise DomainError("NOT_FOUND", "Resource unavailable.", 404)
    return Scope(tenant, grant.branch_id, grant.role)


def allow_write(tenant):
    if tenant.status in {"suspended", "offboarding", "closed", "archived_draft"}:
        raise DomainError("STATE_TRANSITION_DENIED", "Company does not currently allow this change.", 409)
