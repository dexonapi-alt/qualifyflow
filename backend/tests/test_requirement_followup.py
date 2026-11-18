"""Real PostgreSQL/API follow-ups; scanner responses are explicitly isolated test doubles."""

import base64
from datetime import timedelta
from uuid import uuid4
import pytest
from sqlalchemy import select, func, text
from sqlalchemy.exc import DBAPIError
from app.models import IntakeItem, ExceptionCase, Membership, now
from app.documents import storage, jobs as scan_jobs
from app.correspondence.jobs import publish_pending
from test_drivers import setup_registry, payload

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
)


def setup_file(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, user, headers = setup_registry(client, db, admin)
    monkeypatch.setattr(storage, "ROOT", tmp_path)
    base = f"/api/v1/tenants/{a['id']}"
    driver = client.post(base + "/drivers", headers=headers, json=payload(branches[0]["id"])).json()
    definition = client.post(
        base + "/requirements",
        headers=headers,
        json={
            "code": "TRAINING",
            "title": "Synthetic evidence",
            "category": "background_screening",
            "requires_expiry": False,
            "basis": "Synthetic operational requirement, not a legal rule.",
        },
    )
    assert definition.status_code == 201, definition.text
    path = base + f"/drivers/{driver['id']}/file"
    req = client.post(
        path + "/requirements",
        headers=headers,
        json={"definition_id": definition.json()["id"], "engagement_id": driver["engagements"][0]["id"]},
    )
    assert req.status_code == 201, req.text
    return a, b, branches, user, headers, base, path, req.json()["id"]


def open_case(client, headers, path, rid):
    r = client.post(
        path + f"/requirements/{rid}/follow-up",
        headers=headers,
        json={"reason": "Missing synthetic evidence requires client follow-up."},
    )
    assert r.status_code == 201, r.text
    return r.json()


def transition(client, headers, base, cid, state):
    case = client.get(base + "/exceptions/" + cid).json()
    r = client.post(
        base + f"/exceptions/{cid}/state",
        headers=headers,
        json={
            "version": case["version"],
            "state": state,
            "reason": "Documented synthetic workflow transition.",
        },
    )
    assert r.status_code == 200, r.text
    return client.get(base + "/exceptions/" + cid).json()


def test_requirement_case_deduplicates_without_fake_source_and_enforces_scope(
    client, db, admin, monkeypatch, tmp_path
):
    a, b, branches, user, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    case = open_case(client, h, path, rid)
    assert open_case(client, h, path, rid)["id"] == case["id"]
    assert case["origin"] == "requirement" and case["source"] is None
    assert case["requirement"]["id"] == rid
    assert db.scalar(select(func.count()).select_from(IntakeItem)) == 0
    assert db.scalar(select(func.count()).select_from(ExceptionCase)) == 1
    assert client.get(path).json()["items"][0]["follow_up_id"] == case["id"]
    assert client.get(f"/api/v1/tenants/{b['id']}/exceptions/{case['id']}").status_code == 404
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    membership.branch_id = branches[1]["id"]
    db.commit()
    assert client.get(base + "/exceptions/" + case["id"]).status_code == 404
    assert (
        client.post(
            path + f"/requirements/{rid}/follow-up",
            headers=h,
            json={"reason": "Attempt outside the branch scope."},
        ).status_code
        == 404
    )


def test_missing_evidence_request_reply_review_and_approved_resolution(
    client, db, admin, monkeypatch, tmp_path
):
    a, b, branches, user, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    case = open_case(client, h, path, rid)
    transition(client, h, base, case["id"], "assigned")
    case = transition(client, h, base, case["id"], "in_review")
    policy = client.post(
        base + "/correspondence/policy",
        headers=h,
        json={
            "recipient_id": user.id,
            "instructions": "Respond through the private portal using synthetic evidence only.",
        },
    )
    assert policy.status_code == 201, policy.text
    draft = client.post(
        base + f"/exceptions/{case['id']}/information-requests",
        headers=h,
        json={
            "version": case["version"],
            "command_id": str(uuid4()),
            "body": "Please supply the missing synthetic report for this configured requirement.",
        },
    )
    assert draft.status_code == 201, draft.text
    mid = draft.json()["id"]
    assert publish_pending() == 0  # approval cannot be skipped
    approved = client.post(
        base + f"/correspondence/{mid}/approve",
        headers=h,
        json={"version": 1, "reason": "Approved the exact synthetic request and recipient."},
    )
    assert approved.status_code == 200, approved.text
    assert publish_pending() == 1
    assert publish_pending() == 0
    case = client.get(base + "/exceptions/" + case["id"]).json()
    assert case["state"] == "awaiting_client"
    reply = {
        "command_id": str(uuid4()),
        "body": "The synthetic document is ready for the normal evidence upload and review.",
    }
    assert client.post(base + f"/correspondence/{mid}/reply", headers=h, json=reply).status_code == 200
    assert client.post(base + f"/correspondence/{mid}/reply", headers=h, json=reply).json()["replayed"]
    case = client.get(base + "/exceptions/" + case["id"]).json()
    proposal = {
        "version": case["version"],
        "proposal": "Resolve the synthetic missing-document follow-up.",
        "expires_at": (now() + timedelta(hours=1)).isoformat(),
    }
    assert (
        client.post(base + f"/exceptions/{case['id']}/approvals", headers=h, json=proposal).status_code == 409
    )
    upload = {
        "command_id": str(uuid4()),
        "filename": "training.png",
        "content_base64": base64.b64encode(PNG).decode(),
    }
    evidence = client.post(path + f"/requirements/{rid}/evidence", headers=h, json=upload)
    assert evidence.status_code == 201, evidence.text
    eid = evidence.json()["id"]
    evpath = path + f"/requirements/{rid}/evidence/{eid}"
    assert client.post(path + f"/requirements/{rid}/evidence", headers=h, json=upload).json()["id"] == eid
    assert client.get(evpath + "/download").status_code == 409
    monkeypatch.setattr(
        scan_jobs.scanner, "scan", lambda data: ("needs_review", "isolated_test_scanner", None)
    )
    assert scan_jobs.process_scans() == 1
    file = client.get(path).json()
    ev = file["items"][0]["evidence"][0]
    review = {
        "version": ev["version"],
        "outcome": "verified_evidence",
        "reason": "Verified synthetic identity, category and completeness.",
        "identity_verified": True,
        "category_verified": True,
        "completeness_verified": True,
    }
    assert client.post(evpath + "/review", headers=h, json=review).status_code == 200
    assert client.get(evpath + "/download").content == PNG
    assert client.post(evpath + "/review", headers=h, json=review).status_code == 409
    case = client.get(base + "/exceptions/" + case["id"]).json()
    assert case["requirement"]["status"] == "verified" and case["can_request_approval"]
    proposal["version"] = case["version"]
    approval = client.post(base + f"/exceptions/{case['id']}/approvals", headers=h, json=proposal)
    assert approval.status_code == 201, approval.text
    aid = approval.json()["id"]
    assert (
        client.post(
            base + f"/approvals/{aid}/decide",
            headers=h,
            json={"outcome": "approved", "reason": "Employer approves this exact administrative resolution."},
        ).status_code
        == 200
    )
    transition(client, h, base, case["id"], "resolved")
    transition(client, h, base, case["id"], "closed")
    assert (
        client.post(
            path + f"/requirements/{rid}/follow-up",
            headers=h,
            json={"reason": "Cannot create a false missing document issue."},
        ).status_code
        == 409
    )


def test_evidence_change_suppresses_previously_approved_request(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, user, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    case = open_case(client, h, path, rid)
    transition(client, h, base, case["id"], "assigned")
    case = transition(client, h, base, case["id"], "in_review")
    assert (
        client.post(
            base + "/correspondence/policy",
            headers=h,
            json={
                "recipient_id": user.id,
                "instructions": "Use the authenticated portal and synthetic records only.",
            },
        ).status_code
        == 201
    )
    mid = client.post(
        base + f"/exceptions/{case['id']}/information-requests",
        headers=h,
        json={
            "version": case["version"],
            "command_id": str(uuid4()),
            "body": "Please provide the missing document described in the requirement.",
        },
    ).json()["id"]
    assert (
        client.post(
            base + f"/correspondence/{mid}/approve",
            headers=h,
            json={"version": 1, "reason": "Approve exact text and recipient for this request."},
        ).status_code
        == 200
    )
    r = client.post(
        path + f"/requirements/{rid}/evidence",
        headers=h,
        json={
            "command_id": str(uuid4()),
            "filename": "new.png",
            "content_base64": base64.b64encode(PNG).decode(),
        },
    )
    assert r.status_code == 201, r.text
    assert publish_pending() == 0
    message = client.get(base + "/correspondence").json()["items"][0]
    assert message["status"] == "suppressed" and message["sent_at"] is None


def test_case_origin_is_immutable_in_database(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, user, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    case = open_case(client, h, path, rid)
    with pytest.raises(DBAPIError), db.begin_nested():
        db.execute(
            text("UPDATE exception_cases SET branch_id=:branch WHERE id=:id"),
            {"branch": branches[1]["id"], "id": case["id"]},
        )
