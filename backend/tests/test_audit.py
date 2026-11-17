import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from conftest import create_company


def test_database_rejects_audit_history_rewrite(client, db, admin):
    company = create_company(client, admin)
    for command in (
        "UPDATE audit_events SET action='tampered' WHERE tenant_id=:tid",
        "DELETE FROM audit_events WHERE tenant_id=:tid",
    ):
        with pytest.raises(DBAPIError):
            with db.begin_nested():
                db.execute(text(command), {"tid": company["id"]})
