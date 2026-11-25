"""Immutable per-row bulk correction outcomes and replay envelope."""

from alembic import op
import sqlalchemy as sa

revision = "nov19006"
down_revision = "nov19005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "intake_correction_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("batch_id", sa.String(36), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("command_id", sa.String(36), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("encrypted_payload", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "actor_id", "command_id"),
        sa.ForeignKeyConstraint(["tenant_id", "batch_id"], ["intake_batches.tenant_id", "intake_batches.id"]),
    )
    op.create_index("ix_intake_correction_runs_tenant_id", "intake_correction_runs", ["tenant_id"])
    op.execute(
        "CREATE TRIGGER intake_correction_runs_immutable BEFORE UPDATE OR DELETE ON intake_correction_runs FOR EACH ROW EXECUTE FUNCTION qf_reject_audit_mutation()"
    )


def downgrade():
    op.drop_table("intake_correction_runs")
