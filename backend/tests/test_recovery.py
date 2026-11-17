from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from email import policy
from email.parser import BytesParser

from aiosmtpd.controller import Controller
import pyotp
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models import Invitation, Membership, Outbox, User, now
from app.organizations.service import accept as accept_command
from app.auth.schemas import Accept
from app.shared.errors import DomainError
from app.worker import deliver_pending
from conftest import make_user, sign_in, create_company, ORIGIN, SECRET, PASSWORD
from test_foundation import invite, invite_token


@pytest.mark.parametrize("poison_first", [False, True])
def test_real_smtp_acceptance_and_second_sweep_idempotent(client, db, admin, monkeypatch, poison_first):
    received = []

    class Sink:
        async def handle_DATA(self, server, session, envelope):
            received.append(BytesParser(policy=policy.default).parsebytes(envelope.content))
            return "250 Local synthetic sink accepted"

    from app.config import settings

    monkeypatch.setattr(settings(), "smtp_port", 11025)
    controller = Controller(Sink(), hostname="127.0.0.1", port=11025)
    controller.start()
    try:
        c = create_company(client, admin)
        if poison_first:
            poisoned = invite(client, admin, c["id"], email="old-key@example.com")
            bad_row = db.scalar(select(Outbox).where(Outbox.invitation_id == poisoned["id"]))
            bad_row.encrypted_payload = "unreadable-old-encryption-payload"
            db.commit()
        item = invite(client, admin, c["id"])
        assert deliver_pending() == 1
        assert deliver_pending() == 0
        assert len(received) == 1
        assert "/#invite=" in received[0].get_body().get_content()
        db.expire_all()
        assert db.get(Invitation, item["id"]).status == "sent"
        assert db.scalar(select(Outbox).where(Outbox.invitation_id == item["id"])).encrypted_payload is None
        if poison_first:
            db.refresh(bad_row)
            assert bad_row.status == "dead_letter"
            assert bad_row.error_code == "OUTBOX_PAYLOAD_UNREADABLE"
            assert bad_row.encrypted_payload == "unreadable-old-encryption-payload"
            assert db.get(Invitation, poisoned["id"]).status == "send_failed"
    finally:
        controller.stop()


def test_simultaneous_acceptance_creates_one_membership(client, db, admin, engine):
    c = create_company(client, admin)
    item = invite(client, admin, c["id"], role="client_viewer")
    raw = invite_token(db, item["id"])
    data = Accept(token=raw, password=PASSWORD)

    def attempt():
        with Session(engine) as session:
            try:
                with session.begin():
                    accept_command(session, data, None, "concurrent-test")
                return "accepted"
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: attempt(), range(2)))
    assert sorted(results) == ["INVITATION_UNAVAILABLE", "accepted"]
    assert db.scalar(select(func.count()).select_from(Membership)) == 1


def test_login_lockout_and_totp_reuse(client, db):
    user = make_user(db)
    for _ in range(5):
        assert (
            client.post(
                "/api/v1/auth/login",
                headers=ORIGIN,
                json={"email": user.email, "password": "wrong", "code": "000000"},
            ).status_code
            == 401
        )
    db.refresh(user)
    assert user.locked_until > now()
    assert (
        client.post(
            "/api/v1/auth/login",
            headers=ORIGIN,
            json={"email": user.email, "password": PASSWORD, "code": pyotp.TOTP(SECRET).now()},
        ).status_code
        == 401
    )
    user.locked_until, user.failed_logins = now() - timedelta(seconds=1), 0
    db.commit()
    headers = sign_in(client)
    client.post("/api/v1/auth/logout", headers=headers, json={})
    assert (
        client.post(
            "/api/v1/auth/login",
            headers=ORIGIN,
            json={"email": user.email, "password": PASSWORD, "code": pyotp.TOTP(SECRET).now()},
        ).status_code
        == 401
    )


def test_revoke_membership_and_last_admin_guard(client, db, admin):
    c = create_company(client, admin)
    owner = make_user(db, "owner@example.com", None)
    viewer = make_user(db, "viewer@example.com", None, False)
    owner_grant = Membership(user_id=owner.id, tenant_id=c["id"], role="client_admin")
    viewer_grant = Membership(user_id=viewer.id, tenant_id=c["id"], role="client_viewer")
    db.add_all([owner_grant, viewer_grant])
    db.commit()
    disabled_admin = make_user(db, "disabled-admin@example.com", None)
    disabled_admin.status = "disabled"
    db.add(Membership(user_id=disabled_admin.id, tenant_id=c["id"], role="client_admin"))
    db.commit()
    response = client.post(
        f"/api/v1/tenants/{c['id']}/memberships/{owner_grant.id}/change",
        headers=admin,
        json={"version": 1, "reason": "Attempt revoke sole administrator", "action": "revoke"},
    )
    assert response.status_code == 409 and response.json()["error"]["code"] == "LAST_ADMIN"
    admin_cookies = dict(client.cookies)
    client.cookies.clear()
    sign_in(client, "viewer@example.com", None)
    viewer_cookies = dict(client.cookies)
    client.cookies.clear()
    client.cookies.update(admin_cookies)
    assert (
        client.post(
            f"/api/v1/tenants/{c['id']}/memberships/{viewer_grant.id}/change",
            headers=admin,
            json={"version": 1, "reason": "Revoke viewer access now", "action": "revoke"},
        ).status_code
        == 200
    )
    client.cookies.clear()
    client.cookies.update(viewer_cookies)
    assert client.get("/api/v1/tenants/" + c["id"]).status_code == 404


def test_suspended_account_loses_session_access(client, db, admin):
    user = db.scalar(select(User).where(User.platform_role == "service_admin"))
    user.status = "disabled"
    db.commit()
    assert client.get("/api/v1/tenants").status_code == 401
