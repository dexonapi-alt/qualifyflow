import base64
import csv
import io
from datetime import timedelta
from uuid import uuid4
import pytest
from sqlalchemy import select, func, text
from sqlalchemy.exc import DBAPIError
from app.models import (
    SpreadsheetImportSource,
    SpreadsheetImportJob,
    SpreadsheetImportPart,
    IntakeBatch,
    IntakeItem,
    Membership,
    now,
)
from app.screening_intake import background
from test_drivers import setup_registry


def setup(client, db, admin, count=125):
    company, other, branches, user, headers = setup_registry(client, db, admin)
    root = f"/api/v1/tenants/{company['id']}"
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Driver", "Report", "Kind", "When"])
    for i in range(count):
        writer.writerow(
            [
                "SYN-" + str(i),
                "R" + str(i if i != 119 else 0),
                "background_screening",
                "wrong-date" if i == 5 else "2026-11-17",
            ]
        )
    data = dict(
        command_id=str(uuid4()),
        filename="synthetic-large.csv",
        branch_id=branches[0]["id"],
        content_base64=base64.b64encode(output.getvalue().encode()).decode(),
    )
    response = client.post(root + "/spreadsheet-imports", headers=headers, json=data)
    assert response.status_code == 202, response.text
    endpoint = root + "/spreadsheet-imports/" + response.json()["id"]
    return root, endpoint, data, headers, user, branches, other


def configure(client, endpoint, headers):
    current = client.get(endpoint).json()
    result = client.post(
        endpoint + "/mapping",
        headers=headers,
        json=dict(
            version=current["version"],
            mapping=dict(
                client_ref=-1, external_driver_ref=0, external_report_ref=1, report_type=2, reported_at=3
            ),
        ),
    )
    assert result.status_code == 202, result.text


def ready(client, endpoint, headers):
    assert background.process_pending() == 1
    assert client.get(endpoint).json()["status"] == "awaiting_mapping"
    configure(client, endpoint, headers)
    assert background.process_pending() == 1
    preview = client.get(endpoint).json()
    assert preview["status"] == "awaiting_confirmation"
    confirmation = dict(version=preview["version"])
    result = client.post(endpoint + "/confirm", headers=headers, json=confirmation)
    assert result.status_code == 202, result.text
    return confirmation


def test_background_pipeline_progress_invalid_rows_dedupe_and_provenance(client, db, admin):
    root, endpoint, data, headers, _, _, _ = setup(client, db, admin)
    assert client.post(root + "/spreadsheet-imports", headers=headers, json=data).json()["replayed"]
    assert (
        client.post(
            root + "/spreadsheet-imports", headers=headers, json={**data, "filename": "different.csv"}
        ).status_code
        == 409
    )
    confirmation = ready(client, endpoint, headers)
    assert client.post(endpoint + "/confirm", headers=headers, json=confirmation).json()["replayed"]
    for expected in [50, 100, 125]:
        assert background.process_pending() == 1
        assert client.get(endpoint).json()["recorded_rows"] == expected
    state = client.get(endpoint).json()
    assert state["status"] == "completed" and len(state["parts"]) == 3
    assert background.process_pending() == 0
    assert db.scalar(select(func.count()).select_from(IntakeItem)) == 125
    assert (
        db.scalar(
            select(func.count()).select_from(IntakeItem).where(IntakeItem.status == "validation_failed")
        )
        == 1
    )
    assert (
        db.scalar(
            select(func.count()).select_from(IntakeItem).where(IntakeItem.status == "duplicate_detected")
        )
        == 1
    )
    first = state["parts"][0]["batch_id"]
    detail = client.get(root + "/intake-batches/" + first).json()
    assert detail["provenance"]["background_source_id"] == state["id"]
    assert detail["provenance"]["first_source_row"] == 1
    assert detail["provenance"]["last_source_row"] == 50
    assert detail["provenance"]["filename"] == "synthetic-large.csv"
    item = detail["items"][0]["id"]
    candidate = client.get(root + "/intake-batches/" + first + "/items/" + item + "/driver-candidate")
    assert candidate.status_code == 409 and candidate.json()["error"]["code"] == "MATCH_REVIEW_REQUIRED"
    saved = client.post(
        root + "/intake-mappings",
        headers=headers,
        json=dict(
            command_id=str(uuid4()),
            source_batch_id=first,
            name="Large handoff",
            reason="Verified columns against the original synthetic background source.",
        ),
    )
    assert saved.status_code == 201, saved.text
    with pytest.raises(DBAPIError):
        with db.begin_nested():
            db.execute(
                text("UPDATE spreadsheet_import_sources SET sha256=:sha WHERE id=:id"),
                dict(sha="tampered", id=state["id"]),
            )


def test_record_failure_retry_and_expired_lease_do_not_duplicate_parts(client, db, admin, monkeypatch):
    _, endpoint, _, headers, _, _, _ = setup(client, db, admin)
    ready(client, endpoint, headers)
    assert background.process_pending() == 1
    real = background.receive_metadata

    def fail_after_receipt(*a, **k):
        real(*a, **k)
        raise RuntimeError("Synthetic commit failure")

    monkeypatch.setattr(background, "receive_metadata", fail_after_receipt)
    assert background.process_pending() == 0
    failed = client.get(endpoint).json()
    assert failed["status"] == "failed" and failed["recorded_rows"] == 50 and failed["can_retry"]
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 1
    monkeypatch.setattr(background, "receive_metadata", real)
    assert (
        client.post(endpoint + "/retry", headers=headers, json=dict(version=failed["version"])).status_code
        == 200
    )
    job = db.get(SpreadsheetImportJob, failed["id"])
    job.status = "processing"
    job.lease_until = now() - timedelta(seconds=1)
    job.lease_token = str(uuid4())
    db.commit()
    assert background.process_pending() == 1
    assert client.get(endpoint).json()["recorded_rows"] == 100
    assert background.process_pending() == 1
    assert db.scalar(select(func.count()).select_from(SpreadsheetImportPart)) == 3
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 3


def test_scope_cancel_and_revocation_during_workbook_scan(client, db, admin, monkeypatch):
    root, endpoint, _, headers, user, branches, other = setup(client, db, admin, 3)
    assert (
        client.get(
            f"/api/v1/tenants/{other['id']}/spreadsheet-imports/" + endpoint.rsplit("/", 1)[1]
        ).status_code
        == 404
    )
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    membership.branch_id = branches[1]["id"]
    db.commit()
    assert client.get(endpoint).status_code == 404
    assert client.get(root + "/spreadsheet-imports").json()["items"] == []
    membership.branch_id = None
    db.commit()
    state = client.get(endpoint).json()
    assert (
        client.post(endpoint + "/cancel", headers=headers, json=dict(version=state["version"])).status_code
        == 200
    )
    assert background.process_pending() == 0
    assert client.get(endpoint).json()["status"] == "canceled"
    # Revoke the uploader while the actual workbook I/O phase is outside the DB transaction.
    from test_spreadsheet_intake import workbook

    received = client.post(
        root + "/spreadsheet-imports",
        headers=headers,
        json=dict(
            command_id=str(uuid4()),
            filename="synthetic.xlsx",
            branch_id=branches[0]["id"],
            content_base64=workbook(
                [["Driver", "Report", "Kind", "When"], ["001", "R1", "background_screening", "2026-11-17"]]
            ),
        ),
    )
    assert received.status_code == 202
    from app.documents import scanner

    def revoke(_):
        db.expire_all()
        m = db.get(Membership, membership.id)
        m.status = "revoked"
        db.commit()
        return "needs_review", "synthetic-test", None

    monkeypatch.setattr(scanner, "scan", revoke)
    assert background.process_pending() == 0
    db.expire_all()
    job = db.get(SpreadsheetImportJob, received.json()["id"])
    assert job.status == "failed" and job.encrypted_table is None
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 0


def test_large_row_limit_failure_keeps_private_source_and_creates_no_receipts(client, db, admin):
    _, endpoint, _, _, _, _, _ = setup(client, db, admin, 1001)
    assert background.process_pending() == 0
    state = client.get(endpoint).json()
    assert state["status"] == "failed" and state["error_code"] == "INVALID_SPREADSHEET"
    assert db.get(SpreadsheetImportSource, state["id"]).encrypted_file
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 0


def test_numeric_excel_identifier_is_a_row_error_not_a_silent_match(client, db, admin, monkeypatch):
    root, endpoint, _, headers, _, branches, _ = setup(client, db, admin, 3)
    state = client.get(endpoint).json()
    client.post(endpoint + "/cancel", headers=headers, json=dict(version=state["version"]))
    from test_spreadsheet_intake import workbook
    from app.documents import scanner

    monkeypatch.setattr(scanner, "scan", lambda _: ("needs_review", "synthetic-test", None))
    result = client.post(
        root + "/spreadsheet-imports",
        headers=headers,
        json=dict(
            command_id=str(uuid4()),
            filename="numeric.xlsx",
            branch_id=branches[0]["id"],
            content_base64=workbook(
                [
                    ["Driver", "Report", "Kind", "When"],
                    [7, "NUMERIC", "background_screening", "2026-11-17"],
                    ["0008", "TEXT", "background_screening", "2026-11-17"],
                ]
            ),
        ),
    )
    endpoint = root + "/spreadsheet-imports/" + result.json()["id"]
    ready(client, endpoint, headers)
    assert background.process_pending() == 1
    part = client.get(endpoint).json()["parts"][0]
    rows = client.get(root + "/intake-batches/" + part["batch_id"]).json()["items"]
    assert rows[0]["received_status"] == "validation_failed"
    assert "Identifier cells" in rows[0]["reason"]
    assert (
        rows[1]["normalized"]["external_driver_ref"] == "0008" and rows[1]["received_status"] == "unmatched"
    )


def test_cancellation_during_scan_discards_stale_worker_result(client, db, admin, monkeypatch):
    root, endpoint, _, headers, _, branches, _ = setup(client, db, admin, 3)
    state = client.get(endpoint).json()
    client.post(endpoint + "/cancel", headers=headers, json=dict(version=state["version"]))
    from test_spreadsheet_intake import workbook
    from app.documents import scanner

    result = client.post(
        root + "/spreadsheet-imports",
        headers=headers,
        json=dict(
            command_id=str(uuid4()),
            filename="cancel.xlsx",
            branch_id=branches[0]["id"],
            content_base64=workbook(
                [["Driver", "Report", "Kind", "When"], ["0008", "TEXT", "background_screening", "2026-11-17"]]
            ),
        ),
    )
    target = root + "/spreadsheet-imports/" + result.json()["id"]

    def cancel(_):
        state = client.get(target).json()
        assert (
            client.post(target + "/cancel", headers=headers, json=dict(version=state["version"])).status_code
            == 200
        )
        return "needs_review", "synthetic-test", None

    monkeypatch.setattr(scanner, "scan", cancel)
    assert background.process_pending() == 0
    db.expire_all()
    job = db.get(SpreadsheetImportJob, result.json()["id"])
    assert job.status == "canceled" and job.encrypted_table is None


def test_contributor_cannot_control_another_uploaders_import(client, db, admin):
    root, endpoint, _, _, _, branches, _ = setup(client, db, admin, 3)
    from conftest import make_user, sign_in

    user = make_user(db, "other-contributor@example.com", None, False)
    db.add(
        Membership(
            tenant_id=root.split("/")[4],
            user_id=user.id,
            role="client_contributor",
            branch_id=branches[0]["id"],
        )
    )
    db.commit()
    headers = sign_in(client, user.email, None)
    state = client.get(endpoint).json()
    assert state["can_manage"] is False and state["can_cancel"] is False
    assert (
        client.post(endpoint + "/cancel", headers=headers, json=dict(version=state["version"])).status_code
        == 403
    )


def test_unreadable_source_records_failure_without_blocking_the_queue(client, db, admin, monkeypatch):
    _, endpoint, _, _, _, _, _ = setup(client, db, admin, 3)
    source = db.get(SpreadsheetImportSource, endpoint.rsplit("/", 1)[1])
    sealed = source.encrypted_file
    original = background.decrypt

    def unreadable(value):
        if value == sealed:
            raise ValueError("Synthetic unreadable ciphertext")
        return original(value)

    monkeypatch.setattr(background, "decrypt", unreadable)
    assert background.process_pending() == 0
    state = client.get(endpoint).json()
    assert state["status"] == "failed" and state["error_code"] == "IMPORT_SOURCE_UNREADABLE"
    assert not state["can_retry"]
    assert background.process_pending() == 0
    assert db.scalar(select(func.count()).select_from(IntakeBatch)) == 0


def test_advertised_thousand_row_boundary_records_every_row_once(client, db, admin):
    _, endpoint, _, headers, _, _, _ = setup(client, db, admin, 1000)
    ready(client, endpoint, headers)
    assert background.process_pending(limit=20) == 20
    state = client.get(endpoint).json()
    assert state["status"] == "completed" and state["recorded_rows"] == 1000
    assert len(state["parts"]) == 20
    assert state["parts"][-1]["first_row"] == 951 and state["parts"][-1]["last_row"] == 1000
    assert db.scalar(select(func.count()).select_from(IntakeItem)) == 1000
    assert background.process_pending() == 0
