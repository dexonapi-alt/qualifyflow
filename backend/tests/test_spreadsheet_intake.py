import base64
import io
from uuid import uuid4

import pytest
from openpyxl import Workbook
from sqlalchemy import text, select
from sqlalchemy.exc import DBAPIError

from app.models import IntakeSpreadsheetSource, IntakeItem, Membership, ExceptionCase
from app.shared.security import decrypt
from app.shared.errors import DomainError
from app.screening_intake.spreadsheet import inspect_file, canonical_source
from test_drivers import setup_registry, payload


def encoded(value):
    return base64.b64encode(value).decode()


def workbook(rows):
    book = Workbook()
    for row in rows:
        book.active.append(row)
    stream = io.BytesIO()
    book.save(stream)
    book.close()
    return encoded(stream.getvalue())


def test_excel_values_scan_and_identifier_safety(monkeypatch):
    from app.documents import scanner

    monkeypatch.setattr(scanner, "scan", lambda _: ("needs_review", "synthetic-test", None))
    source = workbook(
        [["Driver", "Type", "Report", "Date"], ["0007", "background_screening", "R001", "2026-11-17"]]
    )
    table, _ = inspect_file("source.xlsx", source)
    mapping = dict(client_ref=-1, external_driver_ref=0, report_type=1, external_report_ref=2, reported_at=3)
    assert "0007" in canonical_source(table, mapping, "ABC")
    numeric, _ = inspect_file(
        "source.xlsx",
        workbook([["Driver", "Type", "Report", "Date"], [7, "background_screening", "R001", "2026-11-17"]]),
    )
    with pytest.raises(DomainError):
        canonical_source(numeric, mapping, "ABC")
    with pytest.raises(DomainError):
        inspect_file("formula.xlsx", workbook([["Driver"], ["=1+1"]]))
    with pytest.raises(DomainError):
        inspect_file("wide.xlsx", workbook([list(map(str, range(34))), list(range(34))]))
    monkeypatch.setattr(scanner, "scan", lambda _: ("quarantined", "synthetic-test", None))
    with pytest.raises(DomainError) as error:
        inspect_file("source.xlsx", source)
    assert error.value.code == "SCAN_UNAVAILABLE"


def test_mapping_correction_review_and_scope(client, db, admin):
    company, other, branches, user, headers = setup_registry(client, db, admin)
    root = f"/api/v1/tenants/{company['id']}"
    driver = client.post(root + "/drivers", headers=headers, json=payload(branches[0]["id"], "0007")).json()
    base = root + "/intake-batches"
    source = b"Driver,Report,Kind,When\nWRONG,R001,background_screening,2026-11-17\n"
    data = dict(
        filename="client.csv",
        content_base64=encoded(source),
        branch_id=branches[0]["id"],
        mapping=dict(
            client_ref=-1, external_driver_ref=0, external_report_ref=1, report_type=2, reported_at=3
        ),
        command_id=str(uuid4()),
    )
    assert (
        client.post(
            base + "/spreadsheet/inspect",
            headers=headers,
            json={k: v for k, v in data.items() if k not in {"mapping", "command_id"}},
        ).status_code
        == 200
    )
    received = client.post(base + "/spreadsheet/receive", headers=headers, json=data)
    assert received.status_code == 201, received.text
    bid = received.json()["id"]
    assert client.post(base + "/spreadsheet/receive", headers=headers, json=data).json()["replayed"]
    assert (
        client.post(
            base + "/spreadsheet/receive", headers=headers, json={**data, "filename": "changed.csv"}
        ).status_code
        == 409
    )
    original = db.get(IntakeSpreadsheetSource, bid)
    assert base64.b64decode(decrypt(original.encrypted_original)) == source
    detail = client.get(base + "/" + bid).json()
    item = detail["items"][0]
    row = base + "/" + bid + "/items/" + item["id"]
    assert client.get(row + "/driver-candidate").status_code == 409
    from app.screening_intake.jobs import process_pending

    assert process_pending() == 1
    db.expire_all()
    case = db.scalar(select(ExceptionCase).where(ExceptionCase.source_item_id == item["id"]))
    previous_version = case.version
    correction = dict(
        command_id=str(uuid4()),
        normalized={**item["normalized"], "external_driver_ref": "0007"},
        reason="Verified synthetic stable reference against original source.",
    )
    corrected = client.post(row + "/corrections", headers=headers, json=correction)
    assert corrected.status_code == 201, corrected.text
    db.expire_all()
    assert db.get(ExceptionCase, case.id).version == previous_version + 1

    assert client.post(row + "/corrections", headers=headers, json=correction).json()["replayed"]
    assert client.get(base + "/" + bid).json()["items"][0]["status"] == "superseded"
    assert client.get(row + "/driver-candidate").status_code == 409
    child = corrected.json()
    path = base + "/" + child["id"] + "/items/" + child["item_id"]
    engagement = driver["engagements"][0]
    match = dict(
        command_id=str(uuid4()),
        driver_id=driver["id"],
        engagement_id=engagement["id"],
        driver_version=driver["version"],
        engagement_version=engagement["version"],
        verified_driver_reference="0007",
        basis="Verified synthetic stable driver and employer references.",
    )
    assert (
        client.post(
            path + "/match", headers=headers, json={**match, "verified_driver_reference": "WRONG"}
        ).status_code
        == 409
    )
    assert (
        client.post(path + "/match", headers=headers, json={**match, "driver_version": 99}).status_code == 409
    )
    result = client.post(path + "/match", headers=headers, json=match)
    assert result.status_code == 201, result.text
    assert client.post(path + "/match", headers=headers, json=match).json()["replayed"]
    assert client.get(path + "/driver-candidate").json()["driver_id"] == driver["id"]
    assert client.post(path + "/corrections", headers=headers, json=correction).status_code == 409
    assert client.get(f"/api/v1/tenants/{other['id']}/intake-batches/{bid}").status_code == 404
    db.expire_all()
    assert db.get(IntakeItem, item["id"]).status == "unmatched"
    assert client.get(base + "/" + bid + "/errors.csv").status_code == 200
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    membership.branch_id = branches[1]["id"]
    db.commit()
    assert client.get(path + "/driver-candidate").status_code == 404
    assert client.get(base + "/" + bid + "/errors.csv").status_code == 404


def test_original_source_is_append_only_and_csv_export_safe(client, db, admin):
    company, _, _, _, headers = setup_registry(client, db, admin)
    base = f"/api/v1/tenants/{company['id']}/intake-batches"
    source = b"Driver,Report,Kind,Date\n=1+1,R002,background_screening,2026-11-17\n"
    data = dict(
        filename="client.csv",
        content_base64=encoded(source),
        mapping=dict(
            client_ref=-1, external_driver_ref=0, external_report_ref=1, report_type=2, reported_at=3
        ),
        command_id=str(uuid4()),
    )
    result = client.post(base + "/spreadsheet/receive", headers=headers, json=data)
    assert result.status_code == 201, result.text
    bid = result.json()["id"]
    exported = client.get(base + "/" + bid + "/errors.csv")
    assert "'=1+1" in exported.text
    assert exported.headers["cache-control"] == "no-store"
    with pytest.raises(DBAPIError):
        with db.begin_nested():
            db.execute(
                text("UPDATE intake_spreadsheet_sources SET mapping_version=:value WHERE batch_id=:bid"),
                dict(value="tampered", bid=bid),
            )
