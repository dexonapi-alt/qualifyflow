from datetime import timedelta
from uuid import uuid4
import pytest
from sqlalchemy import select
from app.models import ExportJob, Membership, now
from app.reporting.service import process_pending, safe_cell
from test_requirement_followup import setup_file


def request_export(
    client, h, base, command=None, purpose="Reconcile synthetic configured requirements for training."
):
    return client.post(
        base + "/reports/exports", headers=h, json={"command_id": command or str(uuid4()), "purpose": purpose}
    )


def test_report_export_persistence_scope_recheck_expiration_and_audit(
    client, db, admin, monkeypatch, tmp_path
):
    a, b, branches, user, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    response = client.get(base + "/reports/requirements")
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1 and response.json()["states"] == {"missing": 1}
    command = str(uuid4())
    created = request_export(client, h, base, command)
    assert created.status_code == 202, created.text
    eid = created.json()["id"]
    assert request_export(client, h, base, command).json()["id"] == eid
    assert (
        request_export(
            client, h, base, command, "A different purpose must not reuse the same command."
        ).status_code
        == 409
    )
    url = base + f"/reports/exports/{eid}/download"
    assert client.get(url).status_code == 409
    assert process_pending() == 1
    row = db.get(ExportJob, eid)
    assert row.status == "completed" and row.row_count == 1
    assert "Synthetic evidence" not in row.encrypted_content
    response = client.get(url)
    assert response.status_code == 200
    assert "Synthetic evidence" in response.text and "legal applicability unverified" in response.text
    assert (
        response.headers["cache-control"] == "no-store"
        and response.headers["x-content-type-options"] == "nosniff"
    )
    assert client.get(url.replace(a["id"], b["id"])).status_code == 404
    member = db.scalar(select(Membership).where(Membership.user_id == user.id))
    member.branch_id = branches[1]["id"]
    db.commit()
    assert client.get(base + "/reports/requirements").json()["total"] == 0
    assert client.get(url).status_code == 404
    member.branch_id = None
    row.expires_at = now() - timedelta(seconds=1)
    db.commit()
    assert client.get(url).status_code == 409
    process_pending()
    db.expire_all()
    assert row.status == "expired" and row.encrypted_content is None
    events = client.get(base + "/audit-events").json()["items"]
    assert any(e["action"] == "report.export_downloaded" for e in events)


def test_export_worker_rechecks_revoked_authority_and_rate_limit(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, user, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    jobs = [request_export(client, h, base) for _ in range(10)]
    assert all(r.status_code == 202 for r in jobs)
    assert request_export(client, h, base).status_code == 429
    member = db.scalar(select(Membership).where(Membership.user_id == user.id))
    member.status = "revoked"
    db.commit()
    process_pending(limit=10)
    row = db.get(ExportJob, jobs[0].json()["id"])
    assert row.status == "failed" and row.encrypted_content is None
    assert client.get(base + "/reports/requirements").status_code == 404


@pytest.mark.parametrize(
    "value", ["=2+2", "+SUM(A1)", "-1+2", "@command", "  =formula", "\tvalue", "\rvalue", "\nvalue"]
)
def test_csv_formula_injection_is_neutralized(value):
    assert safe_cell(value).startswith("'")
