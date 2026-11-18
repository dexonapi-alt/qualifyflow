"""Adapter contract tests use an actual loopback HTTP fixture, not fabricated connection success."""

import hashlib
import hmac
import json
import time
from datetime import timedelta
from uuid import uuid4
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import pytest
from sqlalchemy import select, func
from app.config import settings
from app.models import (
    ProviderConnection,
    ProviderEvent,
    ProviderJob,
    IntakeBatch,
    DriverIdentity,
    Membership,
    now,
)
from app.screening_intake.jobs import process_pending
from test_drivers import setup_registry

TOKEN = "synthetic-provider-contract-token"


@pytest.fixture
def provider(monkeypatch):
    state = {"events": [], "failure": None, "account_ref": "CONTRACT-ACCOUNT"}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            status = state["failure"] or (
                200 if self.headers.get("Authorization") == "Bearer " + TOKEN else 401
            )
            if "/v1/account" in self.path:
                value = {
                    "schema_version": "qf-sandbox-v1",
                    "account_ref": state["account_ref"],
                    "environment": "local_synthetic",
                }
            else:
                cursor = int(self.path.split("cursor=")[1])
                events = state["events"][cursor : cursor + 50]
                value = {
                    "schema_version": "qf-sandbox-v1",
                    "events": events,
                    "next_cursor": cursor + len(events),
                }
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(value).encode())

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    monkeypatch.setattr(settings(), "provider_simulator_port", server.server_port)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield state
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


def setup_connection(client, db, admin, credential=TOKEN):
    a, b, branches, user, h = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{a['id']}/provider-connections"
    response = client.post(
        base,
        headers=h,
        json={
            "account_ref": "CONTRACT-ACCOUNT",
            "credential": credential,
            "reason": "Authorize this synthetic provider scope for contract testing.",
        },
    )
    assert response.status_code == 201, response.text
    row = response.json()
    return a, b, user, h, base, row


def act(client, h, base, cid, command, extra=None):
    row = next(r for r in client.get(base).json()["items"] if r["id"] == cid)
    return client.post(
        base + "/" + cid + "/" + command,
        headers=h,
        json={
            "version": row["version"],
            "reason": "Documented synthetic connection action.",
            **(extra or {}),
        },
    )


def envelope(ref="ABC", eid="event-001", driver="DOES-NOT-EXIST"):
    return {
        "schema_version": "qf-sandbox-v1",
        "event_id": eid,
        "account_ref": "CONTRACT-ACCOUNT",
        "record": {
            "client_ref": ref,
            "external_driver_ref": driver,
            "report_type": "background_screening",
            "external_report_ref": "REPORT-" + eid,
            "reported_at": "2026-11-18",
        },
    }


def signed(client, cid, key, payload, age=0):
    raw = json.dumps(payload, separators=(",", ":")).encode()
    stamp = str(int(time.time()) - age)
    signature = hmac.new(key.encode(), stamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
    return client.post(
        "/api/v1/provider-webhooks/" + cid,
        content=raw,
        headers={"X-QF-Timestamp": stamp, "X-QF-Signature": signature, "Content-Type": "application/json"},
    )


def test_real_http_test_failure_rotation_pause_and_truthful_states(client, db, admin, provider):
    a, b, user, h, base, row = setup_connection(client, db, admin, "wrong-contract-credential")
    cid = row["id"]
    assert row["state"] == "configured"
    listing = client.get(base)
    assert "wrong-contract-credential" not in listing.text and row["signing_key"] not in listing.text
    assert "encrypted_credential" not in listing.text and "encrypted_signing_key" not in listing.text
    result = act(client, h, base, cid, "test").json()["run"]
    assert result["state"] == "failed" and result["error_code"] == "PROVIDER_AUTH_REJECTED"
    rotated = client.post(
        base + "/" + cid + "/credentials/rotate",
        headers=h,
        json={
            "version": 2,
            "reason": "Replace the rejected synthetic provider credential.",
            "credential": TOKEN,
        },
    )
    assert rotated.status_code == 200, rotated.text
    assert rotated.json()["state"] == "configured"
    assert act(client, h, base, cid, "resume").status_code == 409
    assert act(client, h, base, cid, "test").json()["run"]["state"] == "succeeded"
    assert client.get(base).json()["items"][0]["state"] == "sandbox_verified"
    assert act(client, h, base, cid, "pause").status_code == 200
    assert signed(client, cid, row["signing_key"], envelope()).status_code == 409
    assert act(client, h, base, cid, "resume").status_code == 200
    provider["failure"] = 429
    failed = act(client, h, base, cid, "pull").json()["run"]
    assert failed["error_code"] == "PROVIDER_RATE_LIMIT" and failed["state"] == "failed"
    assert db.scalar(select(ProviderConnection).where(ProviderConnection.id == cid)).cursor == 0
    assert act(client, h, base, cid, "revoke").status_code == 200
    assert act(client, h, base, cid, "resume").status_code == 409


def test_signed_webhook_replay_binding_and_current_authority(client, db, admin, provider):
    a, b, user, h, base, row = setup_connection(client, db, admin)
    cid, key = row["id"], row["signing_key"]
    assert signed(client, cid, key, envelope()).status_code == 409  # saved is not verified
    assert act(client, h, base, cid, "test").json()["run"]["state"] == "succeeded"
    assert signed(client, cid, "wrong-signing-key", envelope()).status_code == 401
    assert signed(client, cid, key, envelope(), age=301).status_code == 401
    assert signed(client, cid, key, envelope(ref="OTHER")).status_code == 403
    assert db.scalar(select(func.count()).select_from(ProviderEvent)) == 0
    first = signed(client, cid, key, envelope())
    assert first.status_code == 202, first.text
    assert signed(client, cid, key, envelope()).json()["duplicate"]
    assert signed(client, cid, key, envelope(driver="CHANGED")).status_code == 409
    assert db.scalar(select(func.count()).select_from(ProviderEvent)) == 1
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 1
    assert db.scalar(select(func.count()).select_from(DriverIdentity)) == 0  # no automatic driver creation
    assert client.get(f"/api/v1/tenants/{b['id']}/provider-connections/{cid}/runs").status_code == 404
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    membership.status = "revoked"
    db.commit()
    assert signed(client, cid, key, envelope(eid="later")).status_code == 403


def test_pull_dedupe_and_pause_blocks_pending_receipt_worker(client, db, admin, provider):
    a, b, user, h, base, row = setup_connection(client, db, admin)
    cid = row["id"]
    act(client, h, base, cid, "test")
    provider["events"] = [envelope(eid="one"), envelope(eid="one")]
    run = act(client, h, base, cid, "pull").json()["run"]
    assert run["state"] == "succeeded" and run["received_count"] == 1 and run["duplicate_count"] == 1
    assert act(client, h, base, cid, "pull").json()["run"]["received_count"] == 0
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 1
    act(client, h, base, cid, "pause")
    assert process_pending() == 0
    batch = client.get(f"/api/v1/tenants/{a['id']}/intake-batches/{db.scalar(select(IntakeBatch.id))}").json()
    assert batch["processing"]["status"] == "blocked_by_policy"


def test_wrong_bound_page_does_not_advance_cursor_or_create_partial_receipts(client, db, admin, provider):
    a, b, user, h, base, row = setup_connection(client, db, admin)
    cid = row["id"]
    act(client, h, base, cid, "test")
    provider["events"] = [envelope(eid="one"), envelope(ref="OTHER", eid="two")]
    run = act(client, h, base, cid, "pull").json()["run"]
    assert run["state"] == "failed" and run["error_code"] == "PROVIDER_BINDING_DENIED"
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 0
    assert db.get(ProviderConnection, cid).cursor == 0


def queue(client, h, base, cid, command=None):
    row = client.get(base).json()["items"][0]
    return client.post(
        base + "/" + cid + "/pull-jobs",
        headers=h,
        json={
            "version": row["version"],
            "command_id": command or str(uuid4()),
            "reason": "Receive the authorized synthetic provider records.",
        },
    )


def test_durable_pull_backoff_idempotency_and_lease_recovery(client, db, admin, provider):
    from app.integrations.jobs import process_pending as process_provider

    a, b, user, h, base, row = setup_connection(client, db, admin)
    cid = row["id"]
    act(client, h, base, cid, "test")
    command = str(uuid4())
    queued = queue(client, h, base, cid, command)
    assert queued.status_code == 202, queued.text
    assert queue(client, h, base, cid, command).json()["id"] == queued.json()["id"]
    assert queue(client, h, base, cid).status_code == 409
    provider["failure"] = 429
    assert process_provider() == 1
    job = db.get(ProviderJob, queued.json()["id"])
    assert job.status == "retry_scheduled" and job.attempts == 1
    assert job.error_code == "PROVIDER_RATE_LIMIT" and job.available_at > now()
    assert process_provider() == 0
    # A crashed claim is recovered only after its durable lease expires.
    job.status, job.lease_token, job.lease_until = "processing", str(uuid4()), now() - timedelta(seconds=1)
    db.commit()
    provider["failure"] = None
    provider["events"] = [envelope(eid="recovered")]
    assert process_provider() == 1
    db.expire_all()
    assert job.status == "completed" and job.attempts == 2 and job.run_id
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 1
    assert process_provider() == 0


def test_queued_pull_rechecks_revocation_and_bounded_dead_letter(client, db, admin, provider):
    from app.integrations.jobs import process_pending as process_provider

    a, b, user, h, base, row = setup_connection(client, db, admin)
    cid = row["id"]
    act(client, h, base, cid, "test")
    first = queue(client, h, base, cid).json()
    act(client, h, base, cid, "pause")
    assert process_provider() == 1
    job = db.get(ProviderJob, first["id"])
    assert job.status == "blocked_by_policy"
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 0
    act(client, h, base, cid, "resume")
    second = queue(client, h, base, cid).json()
    final = db.get(ProviderJob, second["id"])
    final.attempts = 4
    db.commit()
    provider["failure"] = 429
    assert process_provider() == 1
    db.expire_all()
    assert final.status == "dead_letter" and final.attempts == 5
    assert process_provider() == 0


def test_schedule_dry_run_due_dedupe_and_current_approval(client, db, admin, provider):
    from app.integrations.jobs import schedule_pending, process_pending as process_provider

    a, b, user, h, base, row = setup_connection(client, db, admin)
    cid = row["id"]
    act(client, h, base, cid, "test")
    data = {
        "version": client.get(base).json()["items"][0]["version"],
        "enabled": True,
        "interval_minutes": 15,
        "dry_run": True,
        "reason": "Approve the bounded local synthetic metadata pull schedule.",
    }
    response = client.post(base + "/" + cid + "/sync-schedule", headers=h, json=data)
    assert response.status_code == 200 and response.json()["dry_run"]
    connection = db.get(ProviderConnection, cid)
    assert not connection.sync_enabled and schedule_pending() == 0
    data["dry_run"] = False
    response = client.post(base + "/" + cid + "/sync-schedule", headers=h, json=data)
    assert response.status_code == 200, response.text
    db.expire_all()
    assert connection.sync_enabled and connection.next_sync_at > now()
    connection.next_sync_at = now() - timedelta(seconds=1)
    db.commit()
    assert schedule_pending() == 1 and schedule_pending() == 0
    assert db.scalar(select(func.count()).select_from(ProviderJob)) == 1
    assert process_provider() == 1
    db.expire_all()
    connection.next_sync_at = now() - timedelta(seconds=1)
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    membership.status = "revoked"
    db.commit()
    assert schedule_pending() == 0
    db.expire_all()
    assert not connection.sync_enabled and connection.sync_error == "FORBIDDEN"
    assert db.scalar(select(func.count()).select_from(ProviderJob)) == 1
