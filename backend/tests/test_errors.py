from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from app.main import app
from app.db import get_db


def test_database_outage_returns_safe_correlated_error(client):
    def unavailable():
        raise OperationalError("sensitive-statement", {}, Exception("private-credential"))
        yield

    app.dependency_overrides[get_db] = unavailable
    with TestClient(app, raise_server_exceptions=False) as safe_client:
        response = safe_client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert response.json()["error"]["correlation_id"]
    assert "sensitive-statement" not in response.text
    assert "private-credential" not in response.text


def test_transaction_finalization_failure_cannot_report_success(client, db):
    def fails_during_commit():
        yield db
        raise OperationalError("commit-failed", {}, Exception("private-database-detail"))

    app.dependency_overrides[get_db] = fails_during_commit
    with TestClient(app, raise_server_exceptions=False) as safe_client:
        response = safe_client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert "private-database-detail" not in response.text
