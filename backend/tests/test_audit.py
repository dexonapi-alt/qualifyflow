import pytest
from sqlalchemy import text, select
from app.models import AuditEvent, User, uid
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


def test_provisioning_cannot_read_integration_or_export_sensitive_audit(client, db, admin):
    company = create_company(client, admin)
    actor = db.scalar(select(User).where(User.email == "operator@example.com"))
    for action in ("integration.event_received", "report.export_processed"):
        db.add(
            AuditEvent(
                tenant_id=company["id"],
                actor_id=actor.id,
                action=action,
                resource_id=uid(),
                correlation_id=uid(),
                details={"marker": "private_processing_context"},
            )
        )
    db.commit()
    response = client.get(f"/api/v1/tenants/{company['id']}/audit-events")
    assert response.status_code == 200
    assert "private_processing_context" not in response.text
    assert client.get(f"/api/v1/tenants/{company['id']}/reports/requirements").status_code == 404
    assert client.get(f"/api/v1/tenants/{company['id']}/provider-connections").status_code == 403
