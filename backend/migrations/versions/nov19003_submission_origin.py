"""Record whether evidence was submitted through staff or personal access."""

from alembic import op
import sqlalchemy as sa

revision = "nov19003"
down_revision = "nov19002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "evidence_versions", sa.Column("submitted_via", sa.String(16), nullable=False, server_default="staff")
    )
    op.create_check_constraint(
        "evidence_submission_origin_valid", "evidence_versions", "submitted_via IN ('staff','driver')"
    )


def downgrade():
    op.drop_constraint("evidence_submission_origin_valid", "evidence_versions", type_="check")
    op.drop_column("evidence_versions", "submitted_via")
