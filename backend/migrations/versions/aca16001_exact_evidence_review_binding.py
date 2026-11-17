"""Enforce exact evidence/requirement/review binding for intake attachments."""

from alembic import op

revision = "aca16001"
down_revision = "1c534a4c5d58"
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint(
        "uq_review_evidence_binding", "evidence_reviews", ["tenant_id", "requirement_id", "evidence_id", "id"]
    )
    op.create_foreign_key(
        "fk_attachment_exact_review",
        "intake_attachments",
        "evidence_reviews",
        ["tenant_id", "requirement_id", "evidence_id", "review_id"],
        ["tenant_id", "requirement_id", "evidence_id", "id"],
    )


def downgrade():
    op.drop_constraint("fk_attachment_exact_review", "intake_attachments", type_="foreignkey")
    op.drop_constraint("uq_review_evidence_binding", "evidence_reviews", type_="unique")
