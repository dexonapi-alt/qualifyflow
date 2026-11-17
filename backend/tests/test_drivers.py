from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError
import pytest

from app.models import Membership, OperatorAssignment, DriverIdentity, DriverHistory, AuditEvent, User
from app.drivers import service
from app.drivers.schemas import DriverCreate
from conftest import make_user, sign_in, create_company


def setup_registry(client, db, admin):
    a = create_company(client, admin)
    b = create_company(client, admin, "OTHER")
    branches = [
        client.post(
            f"/api/v1/tenants/{a['id']}/branches",
            headers=admin,
            json={"name": name, "reference": name.upper()},
        ).json()
        for name in ("Main", "East")
    ]
    make_user(db, "driver-admin@example.com", None, False)
    user = db.scalar(select(User).where(User.email == "driver-admin@example.com"))
    db.add(Membership(tenant_id=a["id"], user_id=user.id, role="client_admin"))
    db.commit()
    return a, b, branches, user, sign_in(client, user.email, None)


def payload(branch=None, ref="SYN-001"):
    return {
        "command_id": str(uuid4()),
        "reference": ref,
        "first_name": "Synthetic",
        "last_name": "Driver",
        "start_date": "2026-11-01",
        "branch_id": branch,
    }


def test_registry_persistence_idempotency_names_and_provisioning_denial(client, db, admin):
    a, b, branches, user, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{a['id']}/drivers"
    data = payload(branches[0]["id"])
    first = client.post(base, headers=headers, json=data)
    assert first.status_code == 201, first.text
    did = first.json()["id"]
    assert client.post(base, headers=headers, json=data).json()["id"] == did
    assert db.scalar(select(func.count()).select_from(DriverIdentity)) == 1
    assert db.scalar(select(func.count()).select_from(DriverHistory)) == 1
    assert client.post(base, headers=headers, json={**data, "last_name": "Changed"}).status_code == 409
    assert client.post(base, headers=headers, json=payload(branches[0]["id"])).status_code == 409
    second = client.post(base, headers=headers, json=payload(branches[0]["id"], "SYN-002"))
    assert second.status_code == 201
    assert second.json()["id"] != did  # identical names never merge
    assert client.post(base + "/search", headers=headers, json={"q": "Synthetic"}).json()["total"] == 2
    assert client.post(base + "/search", headers=headers, json={"q": "%"}).json()["total"] == 0
    assert (
        client.get(base + "?limit=1&offset=1").json()["items"][0]["id"]
        != client.get(base + "?limit=1").json()["items"][0]["id"]
    )
    assert client.get(f"/api/v1/tenants/{b['id']}/drivers/{did}").status_code == 404
    client.post("/api/v1/auth/logout", headers=headers, json={})
    # Reset privileged test account's replay step only for this separate authentication.
    operator = db.scalar(select(User).where(User.email == "operator@example.com"))
    operator.last_totp_step = -1
    db.commit()
    sign_in(client)
    assert client.get(base).status_code == 404
    assert client.get(base + "/" + did).status_code == 404
    assert client.get(f"/api/v1/tenants/{a['id']}").json()["driver_access"] is None
    audit = client.get(f"/api/v1/tenants/{a['id']}/audit-events").json()["items"]
    assert not any(e["action"].startswith("driver.") for e in audit)


def test_transfer_scope_history_corrections_and_stale_versions(client, db, admin):
    a, _, branches, user, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{a['id']}/drivers"
    created = client.post(base, headers=headers, json=payload(branches[0]["id"])).json()
    did, engagement = created["id"], created["engagements"][0]
    path = base + "/" + did
    state = path + f"/engagements/{engagement['id']}/state"
    changed = client.post(
        state,
        headers=headers,
        json={"version": 1, "status": "active", "reason": "Synthetic onboarding reviewed"},
    )
    assert changed.status_code == 200, changed.text
    assert (
        client.post(
            state,
            headers=headers,
            json={
                "version": 1,
                "status": "ended",
                "end_date": "2026-11-02",
                "reason": "Stale concurrent review",
            },
        ).status_code
        == 409
    )
    moved = client.post(
        path + f"/engagements/{engagement['id']}/transfer",
        headers=headers,
        json={
            "version": 2,
            "branch_id": branches[1]["id"],
            "effective_date": "2026-11-02",
            "reason": "Confirmed company branch move",
        },
    )
    assert moved.status_code == 200, moved.text
    assert len(moved.json()["engagements"]) == 2
    assert [e for e in moved.json()["engagements"] if e["id"] == engagement["id"]][0]["status"] == "ended"
    corrected = client.post(
        path + "/corrections",
        headers=headers,
        json={
            "version": 1,
            "reference": "SYN-001",
            "first_name": "Corrected",
            "last_name": "Driver",
            "reason": "Reviewed synthetic source",
            "verified_basis": "Reviewed original synthetic employer registration",
        },
    )
    assert corrected.status_code == 200, corrected.text
    assert corrected.json()["history"][0]["details"]["before"]["first_name"] == "Synthetic"
    assert (
        client.post(
            path + "/corrections",
            headers=headers,
            json={
                "version": 1,
                "reference": "SYN-001",
                "first_name": "Stale",
                "last_name": "Driver",
                "reason": "Concurrent stale correction",
                "verified_basis": "Synthetic reviewer confirmation",
            },
        ).status_code
        == 409
    )
    branch_user = make_user(db, "branch-driver@example.com", None, False)
    db.add(
        Membership(
            tenant_id=a["id"], user_id=branch_user.id, role="client_viewer", branch_id=branches[0]["id"]
        )
    )
    db.commit()
    branch_headers = sign_in(client, branch_user.email, None)
    view = client.get(path).json()
    assert len(view["engagements"]) == 1 and view["engagements"][0]["status"] == "ended"
    assert view["history"] is None and branches[1]["id"] not in str(view)
    assert (
        client.post(base, headers=branch_headers, json=payload(branches[0]["id"], "BAD")).status_code == 404
    )
    assert (
        client.post(
            path + "/corrections",
            headers=branch_headers,
            json={
                "version": 2,
                "reference": "SYN-001",
                "first_name": "Bad",
                "last_name": "Driver",
                "reason": "Not authorized",
                "verified_basis": "Not authorized synthetic source",
            },
        ).status_code
        == 404
    )


@pytest.mark.parametrize("branch_choice", ["foreign", "missing"])
def test_branch_writer_cannot_escape_scope(client, db, admin, branch_choice):
    a, b, branches, _, headers = setup_registry(client, db, admin)
    user = make_user(db, "contributor@example.com", None, False)
    db.add(
        Membership(tenant_id=a["id"], user_id=user.id, role="client_contributor", branch_id=branches[0]["id"])
    )
    db.commit()
    headers = sign_in(client, user.email, None)
    base = f"/api/v1/tenants/{a['id']}/drivers"
    bad = branches[1]["id"] if branch_choice == "foreign" else None
    assert client.post(base, headers=headers, json=payload(bad)).status_code == 404
    good = client.post(base, headers=headers, json=payload(branches[0]["id"]))
    assert good.status_code == 201, good.text
    assert client.get(base).json()["total"] == 1
    assert client.get(f"/api/v1/tenants/{b['id']}/drivers").status_code == 404


def test_engagement_state_guards_rehire_and_atomic_history(client, db, admin):
    a, b, branches, _, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{a['id']}/drivers"
    d = client.post(base, headers=headers, json=payload(branches[0]["id"])).json()
    path = base + "/" + d["id"]
    ep = path + "/engagements/" + d["engagements"][0]["id"] + "/state"
    before = db.scalar(select(func.count()).select_from(DriverHistory))
    assert (
        client.post(
            ep,
            headers=headers,
            json={"version": 1, "status": "suspended", "reason": "Invalid state transition"},
        ).status_code
        == 409
    )
    assert db.scalar(select(func.count()).select_from(DriverHistory)) == before
    assert (
        client.post(
            ep,
            headers=headers,
            json={
                "version": 1,
                "status": "ended",
                "end_date": "2026-10-01",
                "reason": "Invalid earlier end date",
            },
        ).status_code
        == 422
    )
    ended = client.post(
        ep,
        headers=headers,
        json={
            "version": 1,
            "status": "ended",
            "end_date": "2026-11-03",
            "reason": "Synthetic engagement ended",
        },
    )
    assert ended.status_code == 200
    assert (
        client.post(
            path + "/engagements",
            headers=headers,
            json={
                "branch_id": branches[1]["id"],
                "start_date": "2026-11-02",
                "reason": "Invalid overlapping rehire",
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            path + "/engagements",
            headers=headers,
            json={
                "branch_id": branches[1]["id"],
                "start_date": "2026-11-04",
                "reason": "Confirmed synthetic rehire",
            },
        ).status_code
        == 201
    )
    assert len(client.get(path).json()["engagements"]) == 2
    with pytest.raises(ProgrammingError), db.begin_nested():
        db.execute(text("UPDATE driver_history SET reason = 'tamper'"))


def test_assigned_staff_revocation_and_tenant_suspension(client, db, admin):
    a, _, branches, _, headers = setup_registry(client, db, admin)
    staff = make_user(db, "driver-staff@example.com", "specialist", False)
    # Staff MFA remains required by the real authentication service; authorize service directly here.
    assignment = OperatorAssignment(tenant_id=a["id"], user_id=staff.id, role="specialist")
    db.add(assignment)
    db.commit()
    assert service.access(db, staff, a["id"])["can_write"]
    assignment.status = "ended"
    db.commit()
    assert service.access(db, staff, a["id"]) is None
    from app.models import Tenant

    db.get(Tenant, a["id"]).status = "suspended"
    db.commit()
    assert (
        client.post(
            f"/api/v1/tenants/{a['id']}/drivers", headers=headers, json=payload(branches[0]["id"])
        ).status_code
        == 409
    )


def test_concurrent_creation_same_command_is_idempotent(client, db, admin, engine):
    a, _, branches, user, _ = setup_registry(client, db, admin)
    data = payload(branches[0]["id"])
    user_id = user.id

    def execute():
        from app.models import User

        with Session(engine, expire_on_commit=False) as session, session.begin():
            return service.create(
                session, session.get(User, user_id), a["id"], DriverCreate(**data), str(uuid4())
            )["id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: execute(), range(2)))
    assert results[0] == results[1]
    assert db.scalar(select(func.count()).select_from(DriverIdentity)) == 1
    assert (
        db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.action == "driver.created"))
        == 1
    )
