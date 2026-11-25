"""Immutable spreadsheet provenance, reviewed matches and correction lineage."""

from alembic import op
import sqlalchemy as sa

revision = "nov19004"
down_revision = "nov19003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "intake_spreadsheet_sources",
        sa.Column("batch_id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("encrypted_original", sa.Text(), nullable=False),
        sa.Column("encrypted_metadata", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("mapping_version", sa.String(32), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id", "batch_id"], ["intake_batches.tenant_id", "intake_batches.id"]),
    )
    op.create_table(
        "intake_corrections",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("parent_item_id", sa.String(36), nullable=False),
        sa.Column("child_item_id", sa.String(36), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("command_id", sa.String(36), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("encrypted_reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id", "parent_item_id"], ["intake_items.tenant_id", "intake_items.id"]
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "child_item_id"], ["intake_items.tenant_id", "intake_items.id"]
        ),
        sa.UniqueConstraint("parent_item_id"),
        sa.UniqueConstraint("child_item_id"),
        sa.UniqueConstraint("tenant_id", "actor_id", "command_id"),
        sa.CheckConstraint("parent_item_id <> child_item_id", name="intake_correction_different_rows"),
    )
    op.create_table(
        "intake_matches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("source_item_id", sa.String(36), nullable=False),
        sa.Column("driver_id", sa.String(36), nullable=False),
        sa.Column("engagement_id", sa.String(36), nullable=False),
        sa.Column("driver_version", sa.Integer(), nullable=False),
        sa.Column("engagement_version", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("command_id", sa.String(36), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("encrypted_basis", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id", "source_item_id"], ["intake_items.tenant_id", "intake_items.id"]
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "driver_id", "engagement_id"],
            ["driver_engagements.tenant_id", "driver_engagements.driver_id", "driver_engagements.id"],
        ),
        sa.UniqueConstraint("source_item_id"),
        sa.UniqueConstraint("tenant_id", "actor_id", "command_id"),
    )
    for table in ("intake_spreadsheet_sources", "intake_corrections", "intake_matches"):
        op.create_index("ix_" + table + "_tenant_id", table, ["tenant_id"])
        op.execute(
            f"CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION qf_reject_audit_mutation()"
        )


def downgrade():
    for table in ("intake_matches", "intake_corrections", "intake_spreadsheet_sources"):
        op.drop_table(table)
