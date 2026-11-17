from sqlalchemy import select

from app.models import Membership
from conftest import sign_in
from test_drivers import setup_registry, payload


def test_workspace_aggregates_current_scope_and_revocation(client, db, admin):
    a, b, branches, user, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{a['id']}"
    for i, branch in enumerate(branches):
        response = client.post(base + "/drivers", headers=headers, json=payload(branch["id"], f"REAL-{i}"))
        assert response.status_code == 201
    home = client.get(base + "/workspace")
    assert home.status_code == 200, home.text
    assert home.json()["driver_total"] == 2
    assert len(home.json()["drivers"]) == 2
    assert home.json()["summary"]["needs_you"] == 0
    assert all(row["file"]["assigned"] == 0 for row in home.json()["drivers"])
    assert client.get(f"/api/v1/tenants/{b['id']}/workspace").status_code == 404
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    membership.branch_id = branches[0]["id"]
    db.commit()
    home = client.get(base + "/workspace").json()
    assert home["driver_total"] == 1
    assert [row["reference"] for row in home["drivers"]] == ["REAL-0"]
    membership.status = "revoked"
    db.commit()
    assert client.get(base + "/workspace").status_code == 404


def test_workspace_viewer_gets_records_without_protected_file_aggregates(client, db, admin):
    a, _, _, user, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{a['id']}"
    assert client.post(base + "/drivers", headers=headers, json=payload()).status_code == 201
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    membership.role = "client_viewer"
    db.commit()
    home = client.get(base + "/workspace").json()
    assert home["driver_total"] == 1
    assert home["drivers"][0]["file"] is None
    assert home["summary"] == {}
    assert home["work"] == home["activity"] == home["needs_you"] == []


def test_provisioning_authority_is_metadata_only(client, db, admin):
    a, _, _, _, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{a['id']}"
    assert client.post(base + "/drivers", headers=headers, json=payload()).status_code == 201
    client.post("/api/v1/auth/logout", headers=headers, json={})
    # Initial privileged login happened in this test; use the existing session's
    # account with no MFA replay solely for independent test authentication.
    from app.models import User

    operator = db.scalar(select(User).where(User.email == "operator@example.com"))
    operator.last_totp_step = -1
    db.commit()
    sign_in(client)
    response = client.get(base + "/workspace")
    assert response.status_code == 200, response.text
    home = response.json()
    assert home["access"] is None
    assert home["driver_total"] is None
    assert home["summary"] == {}
    assert home["drivers"] == home["work"] == home["activity"] == home["team"] == []
