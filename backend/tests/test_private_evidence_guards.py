"""Adversarial private-file checks. Scanner doubles are test-only and explicitly named."""

import base64
from uuid import uuid4
from sqlalchemy import select, func
from app.models import EvidenceVersion, EvidenceReview, Membership, Tenant
from app.documents import storage, jobs
from test_requirement_followup import setup_file, PNG


def upload(client, h, path, rid, **changes):
    return client.post(
        path + f"/requirements/{rid}/evidence",
        headers=h,
        json={
            "command_id": str(uuid4()),
            "filename": "synthetic.png",
            "content_base64": base64.b64encode(PNG).decode(),
            **changes,
        },
    )


def test_bad_signature_idempotency_and_cross_tenant_download(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, user, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    assert upload(client, h, path, rid, filename="pretends-to-be.pdf").status_code == 422
    assert db.scalar(select(func.count()).select_from(EvidenceVersion)) == 0
    command = str(uuid4())
    evidence = upload(client, h, path, rid, command_id=command).json()
    assert upload(client, h, path, rid, command_id=command).json()["id"] == evidence["id"]
    assert upload(client, h, path, rid, command_id=command, filename="changed.png").status_code == 409
    uri = path + f"/requirements/{rid}/evidence/{evidence['id']}/download"
    assert client.get(uri).status_code == 409
    assert client.get(uri.replace(a["id"], b["id"])).status_code == 404
    assert len(list(tmp_path.glob("*.encrypted"))) == 1


def test_scan_failure_and_revoked_actor_never_enable_private_file(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, user, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    evidence = upload(client, h, path, rid).json()
    uri = path + f"/requirements/{rid}/evidence/{evidence['id']}"
    monkeypatch.setattr(jobs.scanner, "scan", lambda data: ("scan_failed", None, "ISOLATED_TEST_UNAVAILABLE"))
    assert jobs.process_scans() == 1
    assert client.get(uri + "/download").status_code == 409
    ev = db.get(EvidenceVersion, evidence["id"])
    review = {
        "version": ev.version,
        "outcome": "verified_evidence",
        "reason": "Attempt to review unscanned synthetic data.",
        "identity_verified": True,
        "category_verified": True,
        "completeness_verified": True,
    }
    assert client.post(uri + "/review", headers=h, json=review).status_code == 409
    assert db.scalar(select(func.count()).select_from(EvidenceReview)) == 0
    retry = client.post(uri + "/retry-scan", headers=h, json={})
    assert retry.status_code == 200, retry.text
    member = db.scalar(select(Membership).where(Membership.user_id == user.id))
    member.status = "revoked"
    db.commit()
    jobs.process_scans()
    db.expire_all()
    assert ev.status == "scan_failed" and ev.scan_error == "CURRENT_AUTHORIZATION_OR_TENANT_DENIED"
    assert client.get(uri + "/download").status_code == 404


def test_download_integrity_branch_scope_and_suspension(client, db, admin, monkeypatch, tmp_path):
    a, b, branches, user, h, base, path, rid = setup_file(client, db, admin, monkeypatch, tmp_path)
    evidence = upload(client, h, path, rid).json()
    uri = path + f"/requirements/{rid}/evidence/{evidence['id']}/download"
    monkeypatch.setattr(jobs.scanner, "scan", lambda data: ("needs_review", "isolated_test_scanner", None))
    jobs.process_scans()
    response = client.get(uri)
    assert response.status_code == 200 and response.content == PNG
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-disposition"].startswith("attachment;")
    member = db.scalar(select(Membership).where(Membership.user_id == user.id))
    member.branch_id = branches[1]["id"]
    db.commit()
    assert client.get(uri).status_code == 404
    member.branch_id = None
    db.commit()
    original = storage.get
    monkeypatch.setattr(storage, "get", lambda key: original(key) + b"tampered")
    assert client.get(uri).json()["error"]["code"] == "EVIDENCE_INTEGRITY_ERROR"
    tenant = db.get(Tenant, a["id"])
    tenant.status = "suspended"
    db.commit()
    assert upload(client, h, path, rid).status_code == 409
