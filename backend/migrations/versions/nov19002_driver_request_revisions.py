"""Append-only driver instructions, preserving immutable requirement assignments."""

from alembic import op
import sqlalchemy as sa

revision = "nov19002"
down_revision = "nov19001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "driver_document_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("requirement_id", sa.String(36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("visible", sa.Boolean(), nullable=False),
        sa.Column("encrypted_instructions", sa.Text(), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id", "requirement_id"], ["driver_requirements.tenant_id", "driver_requirements.id"]
        ),
        sa.UniqueConstraint("requirement_id", "version"),
    )
    op.create_index("ix_driver_document_requests_tenant_id", "driver_document_requests", ["tenant_id"])
    op.create_index(
        "ix_driver_document_requests_requirement_id", "driver_document_requests", ["requirement_id"]
    )
    op.execute(
        "CREATE TRIGGER driver_document_requests_immutable BEFORE UPDATE OR DELETE ON driver_document_requests FOR EACH ROW EXECUTE FUNCTION qf_reject_audit_mutation()"
    )


def downgrade():
    op.drop_table("driver_document_requests")
