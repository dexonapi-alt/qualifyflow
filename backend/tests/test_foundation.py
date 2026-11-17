from datetime import timedelta
import json

import pyotp
import pytest
from sqlalchemy import select, func

from app.models import Tenant, Membership, Invitation, OperatorAssignment, AuditEvent, Outbox, User, now
from app.shared.security import decrypt, digest
from app.shared.authorization import authorize
from app.shared.errors import DomainError
from conftest import make_user, sign_in, create_company, company_payload, SECRET, PASSWORD, ORIGIN


def invite_token(db, iid):
    row = db.scalar(select(Outbox).where(Outbox.invitation_id == iid).order_by(Outbox.created_at.desc()))
    return json.loads(decrypt(row.encrypted_payload))["token"]


def invite(client, headers, tid, email="client@example.com", role="client_admin", branch_id=None):
    r = client.post(
        f"/api/v1/tenants/{tid}/invitations",
        headers=headers,
        json={"email": email, "role": role, "branch_id": branch_id},
    )
    assert r.status_code == 201, r.text
    return r.json()


def accept(client, token, role="client_admin"):
    return client.post(
        "/api/v1/invitations/accept",
        headers=ORIGIN,
        json={
            "token": token,
            "password": PASSWORD,
            **({"totp_secret": SECRET, "code": pyotp.TOTP(SECRET).now()} if role == "client_admin" else {}),
        },
    )


def test_health_and_persistence_audit(client, db, admin):
    assert client.get("/api/v1/health/ready").json()["database"] == "available"
    c = create_company(client, admin)
    assert c["status"] == "draft"
    assert db.get(Tenant, c["id"]).display_name == "ABC Trucking"
    assert db.scalar(select(AuditEvent).where(AuditEvent.tenant_id == c["id"])).action == "tenant.created"
    assert client.get("/api/v1/tenants/" + c["id"]).json()["id"] == c["id"]


@pytest.mark.parametrize(
    "field,value",
    [
        ("timezone", "Wrong/Zone"),
        ("mode", "root"),
        ("customer_ref", "bad ref"),
        ("primary_contact", "not-email"),
        ("legal_name", ""),
    ],
)
def test_validation(client, admin, field, value):
    data = company_payload()
    data[field] = value
    response = client.post("/api/v1/tenants", headers=admin, json=data)
    assert response.status_code == 422
    assert field in response.json()["error"]["fields"]


def test_branch_identity_and_foreign_tenant_scope(client, db, admin):
    a, b = create_company(client, admin), create_company(client, admin, "XYZ")
    branches = []
    for c in (a, b):
        r = client.post(
            f"/api/v1/tenants/{c['id']}/branches", headers=admin, json={"name": "Main", "reference": "MAIN"}
        )
        assert r.status_code == 201
        branches.append(r.json())
    assert branches[0]["id"] != branches[1]["id"]
    bad = client.post(
        f"/api/v1/tenants/{a['id']}/invitations",
        headers=admin,
        json={"email": "other@example.com", "role": "client_viewer", "branch_id": branches[1]["id"]},
    )
    assert bad.status_code == 422
    assert db.scalar(select(func.count()).select_from(Invitation)) == 0


def test_invite_accept_replay_and_secret_isolation(client, db, admin):
    c = create_company(client, admin)
    item = invite(client, admin, c["id"])
    raw = invite_token(db, item["id"])
    assert raw not in json.dumps(item)
    assert db.get(Invitation, item["id"]).token_hash == digest(raw)
    client.post("/api/v1/auth/logout", headers=admin, json={})
    setup = client.post("/api/v1/invitations/mfa-setup", headers=ORIGIN, json={"token": raw})
    assert setup.status_code == 200
    assert setup.json()["uri"].startswith("otpauth://totp/")
    assert accept(client, raw).status_code == 200
    assert accept(client, raw).status_code == 400
    assert db.scalar(select(func.count()).select_from(Membership)) == 1
    headers = sign_in(client, "client@example.com")
    assert client.get("/api/v1/tenants/" + c["id"]).status_code == 200
    # Clients cannot provision companies or assign service staff.
    assert client.post("/api/v1/tenants", headers=headers, json=company_payload("BAD")).status_code == 403
    assert (
        client.post(
            f"/api/v1/tenants/{c['id']}/invitations",
            headers=headers,
            json={"email": "e@example.com", "role": "service_admin"},
        ).status_code
        == 422
    )


def test_cross_tenant_and_viewer_write_denied(client, db, admin):
    a, b = create_company(client, admin), create_company(client, admin, "XYZ")
    user = make_user(db, "viewer@example.com", None, False)
    db.add(Membership(user_id=user.id, tenant_id=a["id"], role="client_viewer"))
    db.commit()
    client.post("/api/v1/auth/logout", headers=admin, json={})
    headers = sign_in(client, "viewer@example.com", None)
    assert [c["id"] for c in client.get("/api/v1/tenants").json()["items"]] == [a["id"]]
    for suffix in ("", "/memberships", "/invitations", "/audit-events"):
        r = client.get("/api/v1/tenants/" + b["id"] + suffix)
        assert r.status_code == 404
        assert b["display_name"] not in r.text
    assert (
        client.post(
            "/api/v1/tenants/" + a["id"] + "/branches",
            headers=headers,
            json={"name": "Forbidden", "reference": "NO"},
        ).status_code
        == 404
    )


def test_expired_revoked_resend_invalidates_old_tokens(client, db, admin):
    c = create_company(client, admin)
    i = invite(client, admin, c["id"])
    old = invite_token(db, i["id"])
    r = client.post(
        f"/api/v1/tenants/{c['id']}/invitations/{i['id']}/resend",
        headers=admin,
        json={"version": 1, "reason": "Resend invitation safely"},
    )
    assert r.status_code == 200
    new = invite_token(db, i["id"])
    assert old != new
    client.post("/api/v1/auth/logout", headers=admin, json={})
    assert accept(client, old).status_code == 400
    row = db.get(Invitation, i["id"])
    row.expires_at = now() - timedelta(seconds=1)
    db.commit()
    assert accept(client, new).status_code == 400
    assert db.scalar(select(func.count()).select_from(Membership)) == 0


def test_existing_user_cannot_be_taken_over_by_invite(client, db, admin):
    c = create_company(client, admin)
    make_user(db, "existing@example.com", None)
    i = invite(client, admin, c["id"], "existing@example.com")
    raw = invite_token(db, i["id"])
    client.post("/api/v1/auth/logout", headers=admin, json={})
    assert accept(client, raw).status_code == 401
    headers = sign_in(client, "existing@example.com")
    assert client.post("/api/v1/invitations/accept", headers=headers, json={"token": raw}).status_code == 200


def test_activation_guards_versions_and_suspension(client, db, admin):
    c = create_company(client, admin)
    base = "/api/v1/tenants/" + c["id"]
    config = {
        "version": 1,
        "reason": "Initial approved synthetic SOP",
        "policy_reference": "SYNTHETIC-SOP-1",
        "intake_owner": "service",
        "review_owner": "service",
    }
    assert client.post(base + "/configuration", headers=admin, json=config).status_code == 200
    assert client.post(base + "/configuration", headers=admin, json=config).status_code == 409
    assert (
        client.post(
            base + "/review", headers=admin, json={"version": 2, "reason": "Review configuration"}
        ).status_code
        == 409
    )
    staff = make_user(db, "staff@example.com", "specialist")
    assert (
        client.post(
            base + "/operator-assignments",
            headers=admin,
            json={"user_id": staff.id, "reason": "Assign managed service owner"},
        ).status_code
        == 201
    )
    i = invite(client, admin, c["id"])
    raw = invite_token(db, i["id"])
    # Accept with a separate anonymous browser to preserve administrator session.
    saved = dict(client.cookies)
    client.cookies.clear()
    assert accept(client, raw).status_code == 200
    client.cookies.update(saved)
    for command, version in [("review", 2), ("activate", 3), ("suspend", 4)]:
        r = client.post(
            base + "/" + command, headers=admin, json={"version": version, "reason": "Authorized " + command}
        )
        assert r.status_code == 200, r.text
    assert (
        client.post(
            base + "/invitations", headers=admin, json={"email": "new@example.com", "role": "client_viewer"}
        ).status_code
        == 409
    )
    assert db.get(Tenant, c["id"]).status == "suspended"


def test_assignment_revocation_immediate_and_platform_no_report_access(client, db, admin):
    c = create_company(client, admin)
    staff = make_user(db, "staff@example.com", "specialist")
    response = client.post(
        f"/api/v1/tenants/{c['id']}/operator-assignments",
        headers=admin,
        json={"user_id": staff.id, "reason": "Grant client service assignment"},
    )
    aid = response.json()["id"]
    admin_user = db.scalar(select(User).where(User.platform_role == "service_admin"))
    with pytest.raises(DomainError):
        authorize(db, admin_user, c["id"], "documents:read")
    client.post("/api/v1/auth/logout", headers=admin, json={})
    sign_in(client, "staff@example.com")
    assert client.get("/api/v1/tenants/" + c["id"]).status_code == 200
    assignment = db.get(OperatorAssignment, aid)
    assignment.status, assignment.ends_at = "ended", now()
    db.commit()
    assert client.get("/api/v1/tenants/" + c["id"]).status_code == 404


def test_branch_scope_is_filtered_and_cannot_administer(client, db, admin):
    c = create_company(client, admin)
    branches = []
    for ref in ("NORTH", "SOUTH"):
        branches.append(
            client.post(
                f"/api/v1/tenants/{c['id']}/branches", headers=admin, json={"name": ref, "reference": ref}
            ).json()
        )
    u = make_user(db, "branch@example.com", None, False)
    db.add(Membership(user_id=u.id, tenant_id=c["id"], role="client_admin", branch_id=branches[0]["id"]))
    db.commit()
    client.post("/api/v1/auth/logout", headers=admin, json={})
    h = sign_in(client, "branch@example.com", None)
    result = client.get("/api/v1/tenants/" + c["id"]).json()
    assert [b["id"] for b in result["branches"]] == [branches[0]["id"]]
    assert (
        client.post(
            f"/api/v1/tenants/{c['id']}/invitations",
            headers=h,
            json={"email": "bad@example.com", "role": "client_viewer"},
        ).status_code
        == 403
    )


def test_csrf_origin_logout_and_session_revocation(client, db, admin):
    assert client.post("/api/v1/tenants", json=company_payload()).status_code == 403
    assert (
        client.post(
            "/api/v1/tenants", headers={**admin, "Origin": "https://evil.example"}, json=company_payload()
        ).status_code
        == 403
    )
    raw = client.cookies["qf_session"]
    assert client.post("/api/v1/auth/logout", headers=admin, json={}).status_code == 200
    client.cookies.set("qf_session", raw)
    assert client.get("/api/v1/tenants").status_code == 401


def test_duplicate_reference_is_atomic(client, db, admin):
    create_company(client, admin)
    assert client.post("/api/v1/tenants", headers=admin, json=company_payload()).status_code == 409
    assert db.scalar(select(func.count()).select_from(Tenant)) == 1
    assert (
        db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.action == "tenant.created"))
        == 1
    )


def test_worker_failure_persists_recovery_and_no_secret_in_api(client, db, admin, monkeypatch):
    from app.worker import deliver_pending

    c = create_company(client, admin)
    i = invite(client, admin, c["id"])

    def unavailable(*args, **kwargs):
        raise OSError("mail sink offline")

    monkeypatch.setattr("smtplib.SMTP", unavailable)
    assert deliver_pending() == 0
    db.expire_all()
    row = db.scalar(select(Outbox).where(Outbox.invitation_id == i["id"]))
    assert row.status == "retry_scheduled" and row.attempts == 1
    response = client.get(f"/api/v1/tenants/{c['id']}/invitations")
    assert response.json()["items"][0]["status"] == "send_failed"
    assert row.encrypted_payload not in response.text
