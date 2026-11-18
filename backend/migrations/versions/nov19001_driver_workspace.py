"""Explicit engagement-scoped driver access and shared document requests."""

from alembic import op
import sqlalchemy as sa

revision = "nov19001"
down_revision = "bc0e7caede1a"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "driver_portal_access",
        sa.Column("id", sa.String(36), sa.ForeignKey("invitations.id"), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("driver_id", sa.String(36), nullable=False),
        sa.Column("engagement_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id", "driver_id", "engagement_id"],
            ["driver_engagements.tenant_id", "driver_engagements.driver_id", "driver_engagements.id"],
        ),
        sa.CheckConstraint("status IN ('invited','active','revoked')", name="driver_portal_status_valid"),
    )
    op.create_index("ix_driver_portal_access_tenant_id", "driver_portal_access", ["tenant_id"])
    op.create_index("ix_driver_portal_access_user_id", "driver_portal_access", ["user_id"])
    op.create_index(
        "uq_driver_portal_current",
        "driver_portal_access",
        ["tenant_id", "engagement_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('invited','active')"),
    )


def downgrade():
    op.drop_table("driver_portal_access")
