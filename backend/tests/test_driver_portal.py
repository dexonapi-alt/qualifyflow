"""Real PostgreSQL/API personal grants; antivirus doubles are explicitly test-only."""

import base64
import json
import pytest
from datetime import timedelta
from uuid import uuid4
from sqlalchemy import select, func, text
from sqlalchemy.exc import DBAPIError
from app.models import (
    DriverRequirement,
    DriverPortalAccess,
    DriverEngagement,
    Invitation,
    Outbox,
    Membership,
    EvidenceVersion,
    now,
)
from app.shared.security import decrypt
from app.documents import jobs
from conftest import ORIGIN, PASSWORD, sign_in, make_user
from test_requirement_followup import setup_file, PNG
from test_drivers import payload


def setup_portal(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, staff, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    req = db.get(DriverRequirement, rid)
    driver_base = path.removesuffix("/file")
    share = client.post(
        path + f"/requirements/{rid}/driver-request",
        headers=h,
        json={
            "visible": True,
            "instructions": "Upload a readable synthetic training document showing the correct identity.",
        },
    )
    assert share.status_code == 200, share.text
    invited = client.post(
        driver_base + "/portal-access",
        headers=h,
        json={"email": "personal-driver@example.com", "engagement_id": req.engagement_id},
    )
    assert invited.status_code == 201, invited.text
    iid = invited.json()["id"]
    envelope = db.scalar(select(Outbox).where(Outbox.invitation_id == iid))
    token = json.loads(decrypt(envelope.encrypted_payload))["token"]
    return a, b, branches, staff, h, base, path, rid, req.engagement_id, driver_base, iid, token


def accept(client, h, token):
    assert client.post("/api/v1/auth/logout", headers=h, json={}).status_code == 200
    r = client.post("/api/v1/invitations/accept", headers=ORIGIN, json={"token": token, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return sign_in(client, "personal-driver@example.com", None)


def upload(client, h, endpoint):
    return client.post(
        endpoint,
        headers=h,
        json={
            "command_id": str(uuid4()),
            "filename": "synthetic-personal.png",
            "content_base64": base64.b64encode(PNG).decode(),
        },
    )


def test_personal_account_upload_review_and_company_visibility(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, staff, h, base, path, rid, eid, driver_base, iid, token = setup_portal(
        client, db, admin, monkeypatch, tmp_path
    )
    inspected = client.post("/api/v1/invitations/inspect", headers=ORIGIN, json={"token": token})
    assert inspected.json()["role"] == "driver"
    dh = accept(client, h, token)
    user = client.get("/api/v1/auth/me").json()["user"]
    dh = {**ORIGIN, "X-CSRF-Token": client.cookies["qf_csrf"]}
    assert user["driver_portal"] and not user["company_access"]
    assert (
        db.scalar(select(func.count()).select_from(Membership).where(Membership.user_id == user["id"])) == 0
    )
    assert client.get("/api/v1/tenants").json()["items"] == []
    mine = client.get("/api/v1/driver-portal").json()["items"]
    assert len(mine) == 1 and mine[0]["engagement_id"] == eid
    own = f"/api/v1/driver-portal/{eid}"
    assert client.get(own).json()["items"][0]["id"] == rid
    assert client.get(driver_base).status_code == 404
    assert client.get(path).status_code == 404
    assert (
        client.post(
            path + "/requirements", headers=dh, json={"definition_id": str(uuid4()), "engagement_id": eid}
        ).status_code
        == 404
    )
    assert client.get(f"/api/v1/driver-portal/{uuid4()}").status_code == 404
    assert upload(client, dh, own + f"/requirements/{uuid4()}/submissions").status_code == 404
    result = upload(client, dh, own + f"/requirements/{rid}/submissions")
    assert result.status_code == 201, result.text
    ev = result.json()["id"]
    download = own + f"/requirements/{rid}/submissions/{ev}/download"
    assert client.get(download).status_code == 409
    monkeypatch.setattr(jobs.scanner, "scan", lambda data: ("needs_review", "isolated-test-scanner", None))
    assert jobs.process_scans() == 1
    assert client.get(download).content == PNG
    assert (
        client.post(
            path + f"/requirements/{rid}/evidence/{ev}/review",
            headers=dh,
            json={
                "version": 1,
                "outcome": "verified_evidence",
                "reason": "An unauthorized self-review attempt.",
                "identity_verified": True,
                "category_verified": True,
                "completeness_verified": True,
            },
        ).status_code
        == 404
    )
    sh = sign_in(client, staff.email, None)
    evidence = client.get(path).json()["items"][0]["evidence"][0]
    assert evidence["id"] == ev
    r = client.post(
        path + f"/requirements/{rid}/evidence/{ev}/review",
        headers=sh,
        json={
            "version": evidence["version"],
            "outcome": "verified_evidence",
            "reason": "CONFIDENTIAL internal findings not intended for driver display.",
            "identity_verified": True,
            "category_verified": True,
            "completeness_verified": True,
        },
    )
    assert r.status_code == 200, r.text
    sign_in(client, "personal-driver@example.com", None)
    personal = client.get(own)
    assert personal.json()["items"][0]["status"] == "verified"
    assert "CONFIDENTIAL" not in personal.text and staff.email not in personal.text
    assert (
        client.post(
            "/api/v1/invitations/accept",
            headers={**ORIGIN, "X-CSRF-Token": client.cookies["qf_csrf"]},
            json={"token": token},
        ).status_code
        == 400
    )


def test_hidden_requests_and_staff_files_are_not_exposed(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, staff, h, base, path, rid, eid, driver_base, iid, token = setup_portal(
        client, db, admin, monkeypatch, tmp_path
    )
    uploaded = client.post(
        path + f"/requirements/{rid}/evidence",
        headers=h,
        json={
            "command_id": str(uuid4()),
            "filename": "PRIVATE-staff-report.png",
            "content_base64": base64.b64encode(PNG).decode(),
        },
    )
    assert uploaded.status_code == 201
    ev = uploaded.json()["id"]
    dh = accept(client, h, token)
    own = f"/api/v1/driver-portal/{eid}"
    data = client.get(own)
    assert "PRIVATE-staff-report" not in data.text
    assert data.json()["items"][0]["submissions"] == []
    assert client.get(own + f"/requirements/{rid}/submissions/{ev}/download").status_code == 404
    sh = sign_in(client, staff.email, None)
    assert (
        client.post(
            path + f"/requirements/{rid}/driver-request",
            headers=sh,
            json={
                "version": 1,
                "visible": False,
                "instructions": "Keep this requirement internal for the synthetic exercise.",
            },
        ).status_code
        == 200
    )
    dh = sign_in(client, "personal-driver@example.com", None)
    assert client.get(own).json()["items"] == []
    assert upload(client, dh, own + f"/requirements/{rid}/submissions").status_code == 404
    assert (
        client.post(
            own + f"/requirements/{rid}/submissions",
            headers=dh,
            json={
                "command_id": str(uuid4()),
                "filename": "synthetic.png",
                "content_base64": base64.b64encode(PNG).decode(),
                "source_item_id": str(uuid4()),
            },
        ).status_code
        == 422
    )


def test_revoked_grant_and_ended_engagement_fail_closed(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, staff, h, base, path, rid, eid, driver_base, iid, token = setup_portal(
        client, db, admin, monkeypatch, tmp_path
    )
    dh = accept(client, h, token)
    own = f"/api/v1/driver-portal/{eid}"
    result = upload(client, dh, own + f"/requirements/{rid}/submissions")
    assert result.status_code == 201
    sh = sign_in(client, staff.email, None)
    state = client.get(driver_base + "/portal-access").json()["items"][0]
    response = client.post(
        driver_base + f"/portal-access/{iid}/revoke",
        headers=sh,
        json={"version": state["version"], "reason": "Synthetic access revocation exercise."},
    )
    assert response.status_code == 200, response.text
    assert (
        client.post(
            driver_base + f"/portal-access/{iid}/revoke",
            headers=sh,
            json={"version": state["version"], "reason": "Stale revocation command exercise."},
        ).status_code
        == 409
    )
    monkeypatch.setattr(jobs.scanner, "scan", lambda data: ("needs_review", "isolated-test-scanner", None))
    jobs.process_scans()
    db.expire_all()
    assert db.get(EvidenceVersion, result.json()["id"]).scan_error == "CURRENT_AUTHORIZATION_OR_TENANT_DENIED"
    dh = sign_in(client, "personal-driver@example.com", None)
    assert client.get(own).status_code == 404
    assert client.get("/api/v1/driver-portal").json()["items"] == []
    assert upload(client, dh, own + f"/requirements/{rid}/submissions").status_code == 404


def test_grant_binding_does_not_follow_other_driver_or_transfer(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, staff, h, base, path, rid, eid, driver_base, iid, token = setup_portal(
        client, db, admin, monkeypatch, tmp_path
    )
    second = client.post(base + "/drivers", headers=h, json=payload(branches[0]["id"], "SYN-SECOND")).json()
    accept(client, h, token)
    assert client.get(f"/api/v1/driver-portal/{second['engagements'][0]['id']}").status_code == 404
    engagement = db.get(DriverEngagement, eid)
    engagement.end_date = now().date()
    engagement.status = "ended"
    db.commit()
    assert client.get(f"/api/v1/driver-portal/{eid}").status_code == 404
    assert client.get("/api/v1/driver-portal").json()["items"] == []


def test_expiry_reinvite_and_existing_account_acceptance(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, staff, h, base, path, rid, eid, driver_base, iid, token = setup_portal(
        client, db, admin, monkeypatch, tmp_path
    )
    invitation = db.get(Invitation, iid)
    invitation.expires_at = now() - timedelta(seconds=1)
    db.commit()
    assert (
        client.post(
            "/api/v1/invitations/accept", headers=h, json={"token": token, "password": PASSWORD}
        ).status_code
        == 400
    )
    invitation = client.post(
        driver_base + "/portal-access",
        headers=h,
        json={"email": "personal-driver@example.com", "engagement_id": eid},
    )
    assert invitation.status_code == 201, invitation.text
    iid2 = invitation.json()["id"]
    raw = json.loads(
        decrypt(db.scalar(select(Outbox).where(Outbox.invitation_id == iid2)).encrypted_payload)
    )["token"]
    make_user(db, "personal-driver@example.com", None, False)
    # A bearer token cannot replace authentication of an existing account, even for a company admin.
    assert (
        client.post(
            "/api/v1/invitations/accept", headers=h, json={"token": raw, "password": PASSWORD}
        ).status_code
        == 401
    )
    dh = sign_in(client, "personal-driver@example.com", None)
    assert client.post("/api/v1/invitations/accept", headers=dh, json={"token": raw}).status_code == 200
    assert client.get(f"/api/v1/driver-portal/{eid}").status_code == 200


def test_driver_cannot_invite_or_receive_company_membership(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, staff, h, base, path, rid, eid, driver_base, iid, token = setup_portal(
        client, db, admin, monkeypatch, tmp_path
    )
    # Only the dedicated flow may create a driver grant; generic company invitations remain constrained.
    assert (
        client.post(
            base + "/invitations", headers=h, json={"email": "x@example.com", "role": "driver"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            base + f"/invitations/{iid}/resend",
            headers=h,
            json={"version": 1, "reason": "Attempt generic invitation management."},
        ).status_code
        == 403
    )
    assert client.get(base + "/invitations").json()["items"] == []
    dh = accept(client, h, token)
    assert (
        client.post(
            driver_base + "/portal-access", headers=dh, json={"email": "x@example.com", "engagement_id": eid}
        ).status_code
        == 404
    )
    assert client.get(driver_base + "/portal-access").status_code == 404
    assert client.get(base + "/members").status_code == 404
    assert client.get(f"/api/v1/tenants/{b['id']}").status_code == 404


def test_revocation_during_scan_prevents_cleared_result(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, staff, h, base, path, rid, eid, driver_base, iid, token = setup_portal(
        client, db, admin, monkeypatch, tmp_path
    )
    dh = accept(client, h, token)
    submitted = upload(client, dh, f"/api/v1/driver-portal/{eid}/requirements/{rid}/submissions").json()

    def scanner(_):
        grant = db.get(DriverPortalAccess, iid)
        grant.status = "revoked"
        db.commit()
        return "needs_review", "isolated-test-scanner", None

    monkeypatch.setattr(jobs.scanner, "scan", scanner)
    jobs.process_scans()
    db.expire_all()
    ev = db.get(EvidenceVersion, submitted["id"])
    assert ev.status == "scan_failed" and ev.scanned_at is None


def test_document_requests_are_versioned_append_only_without_changing_assignments(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, staff, h, base, path, rid, eid, driver_base, iid, token = setup_portal(client, db, admin, monkeypatch, tmp_path)
    endpoint = path + f"/requirements/{rid}/driver-request"
    assert client.post(endpoint, headers=h, json={"version":0,"visible":False,"instructions":"Stale instructions must not overwrite the current request."}).status_code == 409
    assert client.post(endpoint, headers=h, json={"version":1,"visible":False,"instructions":"New private revision withdraws this document request."}).status_code == 200
    rows = db.execute(text("SELECT version,visible FROM driver_document_requests WHERE requirement_id=:rid ORDER BY version"), {"rid":rid}).all()
    assert rows == [(1, True), (2, False)]
    with pytest.raises(DBAPIError):
        db.execute(text("UPDATE driver_document_requests SET visible=true WHERE requirement_id=:rid"), {"rid":rid})
        db.commit()
    db.rollback()
    with pytest.raises(DBAPIError):
        db.execute(text("UPDATE driver_requirements SET definition_id=definition_id WHERE id=:rid"), {"rid":rid})
        db.commit()
    db.rollback()
