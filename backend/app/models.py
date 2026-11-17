"""Foundation entities. Tenant relationships are explicit, not inferred from names."""

from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, ForeignKeyConstraint, Integer, JSON, String, Text
from sqlalchemy import UniqueConstraint, Index, CheckConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def now():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid4())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="active")
    platform_role: Mapped[str | None] = mapped_column(String(32))
    totp_secret: Mapped[str | None] = mapped_column(Text)
    last_totp_step: Mapped[int] = mapped_column(Integer, default=-1)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LoginSession(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    mfa_verified: Mapped[bool] = mapped_column(Boolean, default=False)


class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    legal_name: Mapped[str] = mapped_column(String(200))
    display_name: Mapped[str] = mapped_column(String(200))
    customer_ref: Mapped[str] = mapped_column(String(64), unique=True)
    mode: Mapped[str] = mapped_column(String(24))
    timezone: Mapped[str] = mapped_column(String(64))
    region: Mapped[str] = mapped_column(String(100))
    primary_contact: Mapped[str] = mapped_column(String(254))
    effective_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    configuration: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Branch(Base):
    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("tenant_id", "reference"), UniqueConstraint("tenant_id", "id"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    reference: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(24), default="active")
    version: Mapped[int] = mapped_column(Integer, default=1)


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id"),
        ForeignKeyConstraint(["tenant_id", "branch_id"], ["branches.tenant_id", "branches.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(32))
    branch_id: Mapped[str | None] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(24), default="active")
    version: Mapped[int] = mapped_column(Integer, default=1)


class OperatorAssignment(Base):
    __tablename__ = "operator_assignments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id"),
        ForeignKeyConstraint(["tenant_id", "branch_id"], ["branches.tenant_id", "branches.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(32), default="specialist")
    branch_id: Mapped[str | None] = mapped_column(String(36))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(24), default="active")
    version: Mapped[int] = mapped_column(Integer, default=1)


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id", "branch_id"], ["branches.tenant_id", "branches.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    email: Mapped[str] = mapped_column(String(254))
    role: Mapped[str] = mapped_column(String(32))
    branch_id: Mapped[str | None] = mapped_column(String(36))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(24), default="queued")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str | None] = mapped_column(ForeignKey("tenants.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str] = mapped_column(String(36))
    correlation_id: Mapped[str] = mapped_column(String(36))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Outbox(Base):
    __tablename__ = "outbox"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    invitation_id: Mapped[str] = mapped_column(ForeignKey("invitations.id"))
    encrypted_payload: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    error_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class DriverIdentity(Base):
    __tablename__ = "driver_identities"
    __table_args__ = (UniqueConstraint("tenant_id", "reference"), UniqueConstraint("tenant_id", "id"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    reference: Mapped[str] = mapped_column(String(64))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class DriverEngagement(Base):
    __tablename__ = "driver_engagements"
    __table_args__ = (
        UniqueConstraint("tenant_id", "driver_id", "id"),
        ForeignKeyConstraint(
            ["tenant_id", "driver_id"], ["driver_identities.tenant_id", "driver_identities.id"]
        ),
        ForeignKeyConstraint(["tenant_id", "branch_id"], ["branches.tenant_id", "branches.id"]),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="engagement_dates_ordered"),
        CheckConstraint(
            "status IN ('engagement_draft','onboarding','active','suspended','inactive','ended')",
            name="engagement_status_valid",
        ),
        CheckConstraint(
            "(status IN ('ended','inactive')) = (end_date IS NOT NULL)", name="engagement_end_consistent"
        ),
        Index(
            "uq_driver_current_engagement",
            "tenant_id",
            "driver_id",
            unique=True,
            postgresql_where=text("end_date IS NULL"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    driver_id: Mapped[str] = mapped_column(String(36), index=True)
    branch_id: Mapped[str | None] = mapped_column(String(36))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="onboarding")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class DriverHistory(Base):
    __tablename__ = "driver_history"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "driver_id"], ["driver_identities.tenant_id", "driver_identities.id"]
        ),
        ForeignKeyConstraint(
            ["tenant_id", "driver_id", "engagement_id"],
            ["driver_engagements.tenant_id", "driver_engagements.driver_id", "driver_engagements.id"],
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    driver_id: Mapped[str] = mapped_column(String(36), index=True)
    engagement_id: Mapped[str | None] = mapped_column(String(36))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(64))
    reason: Mapped[str] = mapped_column(String(500))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class DriverCommand(Base):
    __tablename__ = "driver_commands"
    __table_args__ = (
        UniqueConstraint("tenant_id", "actor_id", "command_id"),
        ForeignKeyConstraint(
            ["tenant_id", "driver_id"],
            ["driver_identities.tenant_id", "driver_identities.id"],
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    command_id: Mapped[str] = mapped_column(String(36))
    request_hash: Mapped[str] = mapped_column(String(64))
    driver_id: Mapped[str] = mapped_column(String(36))


class IntakeBatch(Base):
    __tablename__ = "intake_batches"
    __table_args__ = (
        UniqueConstraint("tenant_id", "actor_id", "command_id"),
        UniqueConstraint("tenant_id", "id"),
        ForeignKeyConstraint(["tenant_id", "branch_id"], ["branches.tenant_id", "branches.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    branch_id: Mapped[str | None] = mapped_column(String(36))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    command_id: Mapped[str] = mapped_column(String(36))
    source_hash: Mapped[str] = mapped_column(String(64))
    encrypted_source: Mapped[str] = mapped_column(Text)
    source_channel: Mapped[str] = mapped_column(String(24), default="csv_metadata")
    schema_version: Mapped[str] = mapped_column(String(32), default="synthetic-metadata-v1")
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class IntakeItem(Base):
    __tablename__ = "intake_items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_intake_items_tenant_identity"),
        UniqueConstraint("batch_id", "row_number"),
        ForeignKeyConstraint(["tenant_id", "batch_id"], ["intake_batches.tenant_id", "intake_batches.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    batch_id: Mapped[str] = mapped_column(String(36), index=True)
    row_number: Mapped[int] = mapped_column(Integer)
    encrypted_payload: Mapped[str] = mapped_column(Text)
    source_key: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32))


class IntakeJob(Base):
    __tablename__ = "intake_jobs"
    __table_args__ = (
        UniqueConstraint("batch_id"),
        ForeignKeyConstraint(["tenant_id", "batch_id"], ["intake_batches.tenant_id", "intake_batches.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    batch_id: Mapped[str] = mapped_column(String(36))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    purpose: Mapped[str] = mapped_column(String(64), default="metadata_exception_routing")
    policy_version: Mapped[str] = mapped_column(String(32), default="synthetic-metadata-v1")
    correlation_id: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_token: Mapped[str | None] = mapped_column(String(36))
    error_code: Mapped[str | None] = mapped_column(String(64))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExceptionCase(Base):
    __tablename__ = "exception_cases"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("source_item_id"),
        ForeignKeyConstraint(["tenant_id", "branch_id"], ["branches.tenant_id", "branches.id"]),
        ForeignKeyConstraint(["tenant_id", "source_item_id"], ["intake_items.tenant_id", "intake_items.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    branch_id: Mapped[str | None] = mapped_column(String(36))
    source_item_id: Mapped[str] = mapped_column(String(36))
    category: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(24), default="normal")
    state: Mapped[str] = mapped_column(String(32), default="open")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ExceptionTask(Base):
    __tablename__ = "exception_tasks"
    __table_args__ = (
        UniqueConstraint("case_id"),
        ForeignKeyConstraint(["tenant_id", "case_id"], ["exception_cases.tenant_id", "exception_cases.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36))
    case_id: Mapped[str] = mapped_column(String(36))
    assignee_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(24), default="unassigned")


class ExceptionEvent(Base):
    __tablename__ = "exception_events"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id", "case_id"], ["exception_cases.tenant_id", "exception_cases.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36))
    case_id: Mapped[str] = mapped_column(String(36), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(64))
    encrypted_details: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id", "case_id"], ["exception_cases.tenant_id", "exception_cases.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    case_id: Mapped[str] = mapped_column(String(36), index=True)
    case_version: Mapped[int] = mapped_column(Integer)
    authorized_version: Mapped[int | None] = mapped_column(Integer)
    requested_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(64), default="administrative_resolution")
    encrypted_proposal: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ApprovalDecision(Base):
    __tablename__ = "approval_decisions"
    __table_args__ = (UniqueConstraint("approval_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    approval_id: Mapped[str] = mapped_column(ForeignKey("approval_requests.id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    outcome: Mapped[str] = mapped_column(String(32))
    encrypted_reason: Mapped[str] = mapped_column(Text)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RequirementDefinition(Base):
    __tablename__ = "requirement_definitions"
    __table_args__ = (UniqueConstraint("tenant_id", "code", "revision"), UniqueConstraint("tenant_id", "id"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    code: Mapped[str] = mapped_column(String(64))
    revision: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(64))
    requires_expiry: Mapped[bool] = mapped_column(Boolean, default=False)
    applicability: Mapped[str] = mapped_column(String(40), default="unverified_regulatory")
    encrypted_basis: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class DriverRequirement(Base):
    __tablename__ = "driver_requirements"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("engagement_id", "definition_id"),
        ForeignKeyConstraint(
            ["tenant_id", "driver_id", "engagement_id"],
            ["driver_engagements.tenant_id", "driver_engagements.driver_id", "driver_engagements.id"],
        ),
        ForeignKeyConstraint(
            ["tenant_id", "definition_id"],
            ["requirement_definitions.tenant_id", "requirement_definitions.id"],
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    driver_id: Mapped[str] = mapped_column(String(36), index=True)
    engagement_id: Mapped[str] = mapped_column(String(36))
    definition_id: Mapped[str] = mapped_column(String(36))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class EvidenceVersion(Base):
    __tablename__ = "evidence_versions"
    __table_args__ = (
        UniqueConstraint("requirement_id", "revision"),
        UniqueConstraint("tenant_id", "actor_id", "command_id"),
        UniqueConstraint("tenant_id", "requirement_id", "id"),
        ForeignKeyConstraint(
            ["tenant_id", "requirement_id"], ["driver_requirements.tenant_id", "driver_requirements.id"]
        ),
        ForeignKeyConstraint(["tenant_id", "source_item_id"], ["intake_items.tenant_id", "intake_items.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    requirement_id: Mapped[str] = mapped_column(String(36), index=True)
    source_item_id: Mapped[str | None] = mapped_column(String(36))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    command_id: Mapped[str] = mapped_column(String(36))
    request_hash: Mapped[str] = mapped_column(String(64))
    revision: Mapped[int] = mapped_column(Integer)
    object_key: Mapped[str] = mapped_column(String(64), unique=True)
    encrypted_filename: Mapped[str] = mapped_column(Text)
    media_type: Mapped[str] = mapped_column(String(80))
    byte_size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="quarantined")
    scanner: Mapped[str | None] = mapped_column(String(64))
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scan_error: Mapped[str | None] = mapped_column(String(64))
    scan_attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_token: Mapped[str | None] = mapped_column(String(36))
    version: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class EvidenceReview(Base):
    __tablename__ = "evidence_reviews"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "requirement_id", "evidence_id", "id", name="uq_review_evidence_binding"
        ),
        UniqueConstraint("evidence_id", "evidence_version"),
        ForeignKeyConstraint(
            ["tenant_id", "requirement_id", "evidence_id"],
            ["evidence_versions.tenant_id", "evidence_versions.requirement_id", "evidence_versions.id"],
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    requirement_id: Mapped[str] = mapped_column(String(36))
    evidence_id: Mapped[str] = mapped_column(String(36), index=True)
    evidence_version: Mapped[int] = mapped_column(Integer)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    outcome: Mapped[str] = mapped_column(String(40))
    encrypted_reason: Mapped[str] = mapped_column(Text)
    identity_verified: Mapped[bool] = mapped_column(Boolean)
    category_verified: Mapped[bool] = mapped_column(Boolean)
    completeness_verified: Mapped[bool] = mapped_column(Boolean)
    expires_on: Mapped[date | None] = mapped_column(Date)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class IntakeAttachment(Base):
    __tablename__ = "intake_attachments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "requirement_id", "evidence_id", "review_id"],
            [
                "evidence_reviews.tenant_id",
                "evidence_reviews.requirement_id",
                "evidence_reviews.evidence_id",
                "evidence_reviews.id",
            ],
            name="fk_attachment_exact_review",
        ),
        UniqueConstraint("source_item_id", "evidence_id"),
        ForeignKeyConstraint(["tenant_id", "source_item_id"], ["intake_items.tenant_id", "intake_items.id"]),
        ForeignKeyConstraint(
            ["tenant_id", "requirement_id", "evidence_id"],
            ["evidence_versions.tenant_id", "evidence_versions.requirement_id", "evidence_versions.id"],
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    source_item_id: Mapped[str] = mapped_column(String(36), index=True)
    requirement_id: Mapped[str] = mapped_column(String(36))
    evidence_id: Mapped[str] = mapped_column(String(36))
    review_id: Mapped[str] = mapped_column(ForeignKey("evidence_reviews.id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    attached_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class CommunicationPolicy(Base):
    __tablename__ = "communication_policies"
    __table_args__ = (UniqueConstraint("tenant_id", "revision"), UniqueConstraint("tenant_id", "id"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    recipient_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    encrypted_instructions: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="active")
    channel: Mapped[str] = mapped_column(String(24), default="in_app")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ClientMessage(Base):
    __tablename__ = "client_messages"
    __table_args__ = (
        UniqueConstraint("tenant_id", "author_id", "command_id"),
        ForeignKeyConstraint(["tenant_id", "case_id"], ["exception_cases.tenant_id", "exception_cases.id"]),
        ForeignKeyConstraint(
            ["tenant_id", "policy_id"], ["communication_policies.tenant_id", "communication_policies.id"]
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    case_id: Mapped[str] = mapped_column(String(36), index=True)
    case_version: Mapped[int] = mapped_column(Integer)
    policy_id: Mapped[str] = mapped_column(String(36))
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    recipient_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    command_id: Mapped[str] = mapped_column(String(36))
    request_hash: Mapped[str] = mapped_column(String(64))
    encrypted_body: Mapped[str] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="pending_approval")
    version: Mapped[int] = mapped_column(Integer, default=1)
    error_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MessageEvent(Base):
    __tablename__ = "message_events"
    __table_args__ = (UniqueConstraint("message_id", "actor_id", "command_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    message_id: Mapped[str] = mapped_column(ForeignKey("client_messages.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    command_id: Mapped[str | None] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(64))
    encrypted_body: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
