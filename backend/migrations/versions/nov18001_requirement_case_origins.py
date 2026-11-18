"""Add scoped requirement-origin cases without replacing intake history."""

from alembic import op
import sqlalchemy as sa

revision = "nov18001"
down_revision = "aca16001"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("exception_cases", "source_item_id", existing_type=sa.String(36), nullable=True)
    op.add_column("exception_cases", sa.Column("requirement_id", sa.String(36), nullable=True))
    op.create_foreign_key(
        "fk_case_requirement_tenant",
        "exception_cases",
        "driver_requirements",
        ["tenant_id", "requirement_id"],
        ["tenant_id", "id"],
    )
    op.create_check_constraint(
        "ck_case_one_origin", "exception_cases", "(source_item_id IS NULL) <> (requirement_id IS NULL)"
    )
    op.create_index(
        "uq_active_requirement_case",
        "exception_cases",
        ["requirement_id"],
        unique=True,
        postgresql_where=sa.text(
            "requirement_id IS NOT NULL AND state NOT IN ('resolved', 'closed', 'canceled')"
        ),
    )
    op.execute("""CREATE FUNCTION qf_case_origin_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF ROW(NEW.tenant_id,NEW.branch_id,NEW.source_item_id,NEW.requirement_id)
         IS DISTINCT FROM ROW(OLD.tenant_id,OLD.branch_id,OLD.source_item_id,OLD.requirement_id) THEN
        RAISE EXCEPTION 'Case origin is immutable';
      END IF;
      RETURN NEW;
    END; $$""")
    op.execute(
        "CREATE TRIGGER case_origin_immutable BEFORE UPDATE ON exception_cases FOR EACH ROW EXECUTE FUNCTION qf_case_origin_immutable()"
    )


def downgrade():
    op.execute(
        "DO $$ BEGIN IF EXISTS(SELECT 1 FROM exception_cases WHERE requirement_id IS NOT NULL) THEN RAISE EXCEPTION 'Preserve requirement case history; downgrade blocked'; END IF; END $$"
    )
    op.execute("DROP TRIGGER case_origin_immutable ON exception_cases")
    op.execute("DROP FUNCTION qf_case_origin_immutable()")
    op.drop_index("uq_active_requirement_case", table_name="exception_cases")
    op.drop_constraint("ck_case_one_origin", "exception_cases", type_="check")
    op.drop_constraint("fk_case_requirement_tenant", "exception_cases", type_="foreignkey")
    op.drop_column("exception_cases", "requirement_id")
    op.alter_column("exception_cases", "source_item_id", existing_type=sa.String(36), nullable=False)
