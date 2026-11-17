import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from app.models import Membership
from conftest import make_user, sign_in
from test_drivers import setup_registry, payload


@pytest.mark.parametrize(
    "change",
    [
        {"reference": "bad reference"},
        {"first_name": ""},
        {"start_date": "not-a-date"},
        {"ssn": "synthetic-field-must-not-exist"},
        {"command_id": "not-a-uuid"},
    ],
)
def test_driver_validation_has_no_side_effects(client, db, admin, change):
    company, _, branches, _, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{company['id']}/drivers"
    response = client.post(base, headers=headers, json={**payload(branches[0]["id"]), **change})
    assert response.status_code == 422
    assert client.get(base).json()["total"] == 0


def test_wrong_driver_engagement_denied_and_current_membership_rechecked(client, db, admin):
    company, _, branches, user, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{company['id']}/drivers"
    a = client.post(base, headers=headers, json=payload(branches[0]["id"])).json()
    b = client.post(base, headers=headers, json=payload(branches[0]["id"], "SYN-OTHER")).json()
    response = client.post(
        base + f"/{a['id']}/engagements/{b['engagements'][0]['id']}/state",
        headers=headers,
        json={"version": 1, "status": "active", "reason": "Attempt wrong driver engagement"},
    )
    assert response.status_code == 404
    assert client.get(base + "/" + b["id"]).json()["engagements"][0]["status"] == "onboarding"
    member = db.scalar(select(Membership).where(Membership.user_id == user.id))
    member.status = "revoked"
    db.commit()
    assert client.get(base).status_code == 404
    assert client.get(base + "/" + a["id"]).status_code == 404


def test_whole_company_viewer_cannot_read_correction_audit(client, db, admin):
    company, _, branches, _, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{company['id']}/drivers"
    created = client.post(base, headers=headers, json=payload(branches[0]["id"])).json()
    viewer = make_user(db, "history-viewer@example.com", None, False)
    db.add(Membership(tenant_id=company["id"], user_id=viewer.id, role="client_viewer"))
    db.commit()
    sign_in(client, viewer.email, None)
    assert client.get(base + "/" + created["id"]).json()["history"] is None
    assert client.get(base + "/" + created["id"] + "/history").status_code == 403


def test_future_effective_actions_do_not_claim_present_completion(client, db, admin):
    company, _, branches, _, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{company['id']}/drivers"
    future = (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat()
    created = client.post(
        base, headers=headers, json={**payload(branches[0]["id"]), "start_date": future}
    ).json()
    engagement = created["engagements"][0]
    endpoint = base + f"/{created['id']}/engagements/{engagement['id']}"
    assert (
        client.post(
            endpoint + "/state",
            headers=headers,
            json={"version": 1, "status": "active", "reason": "Cannot activate before a future start"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            endpoint + "/state",
            headers=headers,
            json={
                "version": 1,
                "status": "ended",
                "end_date": future,
                "reason": "Cannot claim a future end now",
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            endpoint + "/transfer",
            headers=headers,
            json={
                "version": 1,
                "branch_id": branches[1]["id"],
                "effective_date": future,
                "reason": "Cannot claim a future branch transfer",
            },
        ).status_code
        == 422
    )
    assert client.get(base + "/" + created["id"]).json()["engagements"][0]["status"] == "onboarding"
