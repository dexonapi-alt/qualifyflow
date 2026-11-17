"""Prevent ordinary updates/deletes of audit history at the database layer."""

from alembic import op

revision = "e2a40001"
down_revision = "d117fea3fb4e"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE FUNCTION qf_reject_audit_mutation() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'Audit events are append-only';
        END;
        $$;
        CREATE TRIGGER audit_events_append_only
        BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION qf_reject_audit_mutation();
    """)


def downgrade():
    op.execute("DROP TRIGGER audit_events_append_only ON audit_events")
    op.execute("DROP FUNCTION qf_reject_audit_mutation()")
