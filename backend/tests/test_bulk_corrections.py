from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import pytest
from sqlalchemy import select, func, text
from sqlalchemy.exc import DBAPIError
from app.models import IntakeBatch, IntakeCorrection, IntakeCorrectionRun, IntakeItem, Membership
from test_drivers import setup_registry
from test_spreadsheet_intake import encoded


def setup(client, db, admin):
    company, other, branches, user, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{company['id']}/intake-batches"
    response = client.post(
        base + "/spreadsheet/receive",
        headers=headers,
        json=dict(
            filename="handoff.csv",
            branch_id=branches[0]["id"],
            command_id=str(uuid4()),
            content_base64=encoded(
                b"Driver,Report,Kind,When\nWRONG-A,R1,background_screening,2026-11-17\nWRONG-B,R2,background_screening,2026-11-17\nKEEP,R3,background_screening,2026-11-17\n"
            ),
            mapping=dict(
                client_ref=-1, external_driver_ref=0, external_report_ref=1, report_type=2, reported_at=3
            ),
        ),
    )
    assert response.status_code == 201, response.text
    bid = response.json()["id"]
    rows = client.get(base + "/" + bid).json()["items"]
    data = dict(
        command_id=str(uuid4()),
        reason="Verified synthetic handoff references against the preserved original source.",
        items=[
            dict(
                item_id=row["id"], normalized={**row["normalized"], "external_driver_ref": "FIXED-" + str(i)}
            )
            for i, row in enumerate(rows)
        ],
    )
    return base, bid, rows, data, headers, user, branches, other


def count(db, entity):
    return db.scalar(select(func.count()).select_from(entity))


def test_bulk_partial_results_preview_replay_and_failed_row_retry(client, db, admin):
    base, bid, rows, data, headers, _, _, _ = setup(client, db, admin)
    endpoint = base + "/" + bid + "/correction-runs"
    data["items"][1]["normalized"]["reported_at"] = "tomorrow"
    data["items"][2]["normalized"] = rows[2]["normalized"]
    preview = client.post(endpoint + "/preview", headers=headers, json=data)
    assert preview.status_code == 200, preview.text
    assert [r["outcome"] for r in preview.json()["items"]] == ["ready", "blocked", "unchanged"]
    assert (
        count(db, IntakeBatch) == 1
        and count(db, IntakeCorrection) == 0
        and count(db, IntakeCorrectionRun) == 0
    )
    recorded = client.post(endpoint, headers=headers, json=data)
    assert recorded.status_code == 201, recorded.text
    run = recorded.json()
    assert [r["outcome"] for r in run["items"]] == ["corrected", "blocked", "unchanged"]
    assert count(db, IntakeBatch) == 2 and count(db, IntakeCorrection) == 1
    assert client.post(endpoint, headers=headers, json=data).json()["replayed"]
    assert count(db, IntakeBatch) == 2 and count(db, IntakeCorrectionRun) == 1
    assert (
        client.post(
            endpoint,
            headers=headers,
            json={**data, "reason": "Different correction basis with the same command."},
        ).status_code
        == 409
    )
    retry = {
        **data,
        "command_id": str(uuid4()),
        "items": [
            dict(item_id=rows[1]["id"], normalized={**rows[1]["normalized"], "reported_at": "2026-11-18"})
        ],
    }
    retried = client.post(endpoint, headers=headers, json=retry)
    assert retried.status_code == 201 and retried.json()["items"][0]["outcome"] == "corrected", retried.text
    assert count(db, IntakeCorrection) == 2
    assert db.get(IntakeItem, rows[0]["id"]).status == "unmatched"
    history = client.get(endpoint).json()["items"]
    assert len(history) == 2
    original = next(r for r in history if r["id"] == run["id"])
    assert original["items"][1]["normalized"]["reported_at"] == "tomorrow"
    assert "tomorrow" not in db.get(IntakeCorrectionRun, run["id"]).encrypted_payload
    with pytest.raises(DBAPIError):
        with db.begin_nested():
            db.execute(
                text("UPDATE intake_correction_runs SET encrypted_payload=:value WHERE id=:id"),
                dict(value="tampered", id=run["id"]),
            )


def test_bulk_rejects_duplicate_proposals_and_rechecks_changed_sources(client, db, admin):
    base, bid, rows, data, headers, _, _, _ = setup(client, db, admin)
    endpoint = base + "/" + bid + "/correction-runs"
    data["items"] = data["items"][:2]
    for row in data["items"]:
        row["normalized"]["external_report_ref"] = "SAME-REPORT"
    preview = client.post(endpoint + "/preview", headers=headers, json=data).json()
    assert [r["outcome"] for r in preview["items"]] == ["ready", "blocked"]
    result = client.post(endpoint, headers=headers, json=data)
    assert result.status_code == 201, result.text
    assert [r["outcome"] for r in result.json()["items"]] == ["corrected", "blocked"]
    # A second operator's replacement after preview cannot be silently overwritten.
    next_data = dict(
        command_id=str(uuid4()),
        reason=data["reason"],
        items=[
            dict(item_id=rows[1]["id"], normalized={**rows[1]["normalized"], "reported_at": "2026-11-18"})
        ],
    )
    assert (
        client.post(endpoint + "/preview", headers=headers, json=next_data).json()["items"][0]["outcome"]
        == "ready"
    )
    single = client.post(
        base + "/" + bid + "/items/" + rows[1]["id"] + "/corrections",
        headers=headers,
        json={**next_data["items"][0], "command_id": str(uuid4()), "reason": data["reason"]},
    )
    # Single-row contract deliberately excludes item_id from the body.
    assert single.status_code == 422
    single = client.post(
        base + "/" + bid + "/items/" + rows[1]["id"] + "/corrections",
        headers=headers,
        json=dict(
            command_id=str(uuid4()), reason=data["reason"], normalized=next_data["items"][0]["normalized"]
        ),
    )
    assert single.status_code == 201, single.text
    stale = client.post(endpoint, headers=headers, json=next_data)
    assert stale.status_code == 201 and stale.json()["items"][0]["code"] == "SOURCE_LOCKED"
    assert count(db, IntakeCorrection) == 2


def test_bulk_scope_limits_and_role_checks_are_atomic(client, db, admin):
    base, bid, rows, data, headers, user, branches, other = setup(client, db, admin)
    endpoint = base + "/" + bid + "/correction-runs"
    bad = {**data, "items": [data["items"][0], dict(item_id=str(uuid4()), normalized=rows[1]["normalized"])]}
    assert client.post(endpoint, headers=headers, json=bad).status_code == 404
    assert count(db, IntakeCorrection) == 0 and count(db, IntakeCorrectionRun) == 0
    assert (
        client.post(endpoint, headers=headers, json={**data, "items": [data["items"][0]] * 2}).status_code
        == 422
    )
    assert (
        client.post(endpoint, headers=headers, json={**data, "items": [data["items"][0]] * 26}).status_code
        == 422
    )
    assert (
        client.get(f"/api/v1/tenants/{other['id']}/intake-batches/{bid}/correction-runs").status_code == 404
    )
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    membership.branch_id = branches[1]["id"]
    db.commit()
    assert client.post(endpoint, headers=headers, json=data).status_code == 404
    assert client.get(endpoint).status_code == 404
    membership.branch_id = None
    membership.role = "client_contributor"
    db.commit()
    assert client.post(endpoint, headers=headers, json=data).status_code == 403
    membership.role = "client_viewer"
    db.commit()
    assert client.get(endpoint).status_code == 404
    assert count(db, IntakeCorrection) == 0


def test_concurrent_bulk_replay_records_one_run(client, db, admin):
    base, bid, _, data, headers, _, _, _ = setup(client, db, admin)
    data["items"] = data["items"][:1]
    endpoint = base + "/" + bid + "/correction-runs"

    def attempt(_):
        result = client.post(endpoint, headers=headers, json=data)
        assert result.status_code == 201, result.text
        return result.json()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, range(2)))
    assert results[0]["id"] == results[1]["id"]
    assert sorted(r["replayed"] for r in results) == [False, True]
    assert count(db, IntakeCorrectionRun) == 1 and count(db, IntakeCorrection) == 1


def test_unexpected_failure_rolls_back_replacements_and_run(client, db, admin, monkeypatch):
    from app.screening_intake import bulk

    base, bid, _, data, headers, _, _, _ = setup(client, db, admin)
    data["items"] = data["items"][:2]
    original = bulk.correct_row
    calls = 0

    def fail_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("Synthetic unexpected persistence failure")
        return original(*args, **kwargs)

    monkeypatch.setattr(bulk, "correct_row", fail_second)
    with pytest.raises(RuntimeError):
        client.post(base + "/" + bid + "/correction-runs", headers=headers, json=data)
    db.expire_all()
    assert count(db, IntakeBatch) == 1
    assert count(db, IntakeCorrection) == 0 and count(db, IntakeCorrectionRun) == 0
