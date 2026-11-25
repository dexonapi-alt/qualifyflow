"""Durable background spreadsheet sources, jobs and recorded parts."""

from alembic import op
import sqlalchemy as sa

revision = "nov19007"
down_revision = "nov19006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "spreadsheet_import_sources",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("branch_id", sa.String(36)),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("command_id", sa.String(36), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("encrypted_file", sa.Text(), nullable=False),
        sa.Column("encrypted_metadata", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "id"),
        sa.UniqueConstraint("tenant_id", "actor_id", "command_id"),
        sa.ForeignKeyConstraint(["tenant_id", "branch_id"], ["branches.tenant_id", "branches.id"]),
    )
    op.create_table(
        "spreadsheet_import_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("phase", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("lease_token", sa.String(36)),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("error_code", sa.String(64)),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("processed_rows", sa.Integer(), nullable=False),
        sa.Column("encrypted_table", sa.Text()),
        sa.Column("encrypted_config", sa.Text(), nullable=False),
        sa.Column("encrypted_preview", sa.Text()),
        sa.Column("confirmed_version", sa.Integer()),
        sa.Column("correlation_id", sa.String(64), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id", "id"], ["spreadsheet_import_sources.tenant_id", "spreadsheet_import_sources.id"]
        ),
    )
    op.create_table(
        "spreadsheet_import_parts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("source_id", sa.String(36), nullable=False),
        sa.Column("batch_id", sa.String(36), nullable=False),
        sa.Column("part_number", sa.Integer(), nullable=False),
        sa.Column("first_row", sa.Integer(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.UniqueConstraint("source_id", "part_number"),
        sa.UniqueConstraint("batch_id"),
        sa.ForeignKeyConstraint(
            ["tenant_id", "source_id"],
            ["spreadsheet_import_sources.tenant_id", "spreadsheet_import_sources.id"],
        ),
        sa.ForeignKeyConstraint(["tenant_id", "batch_id"], ["intake_batches.tenant_id", "intake_batches.id"]),
    )
    for table in ("spreadsheet_import_sources", "spreadsheet_import_jobs", "spreadsheet_import_parts"):
        op.create_index("ix_" + table + "_tenant_id", table, ["tenant_id"])
    for table in ("spreadsheet_import_sources", "spreadsheet_import_parts"):
        op.execute(
            f"CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION qf_reject_audit_mutation()"
        )


def downgrade():
    for table in ("spreadsheet_import_parts", "spreadsheet_import_jobs", "spreadsheet_import_sources"):
        op.drop_table(table)
