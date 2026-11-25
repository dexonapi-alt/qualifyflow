from uuid import uuid4
import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from app.models import IntakeMappingTemplate, Membership
from test_drivers import setup_registry
from test_spreadsheet_intake import encoded


def receipt(client, headers, root, branch=None, report="R001"):
    data = dict(
        filename="handoff.csv",
        content_base64=encoded(
            f"Driver,Report,Kind,When\n0007,{report},background_screening,2026-11-17\n".encode()
        ),
        branch_id=branch,
        mapping=dict(
            client_ref=-1, external_driver_ref=0, external_report_ref=1, report_type=2, reported_at=3
        ),
        command_id=str(uuid4()),
    )
    response = client.post(root + "/intake-batches/spreadsheet/receive", headers=headers, json=data)
    assert response.status_code == 201, response.text
    return response.json()["id"], data


def save_data(batch):
    return dict(
        command_id=str(uuid4()),
        source_batch_id=batch,
        name="Weekly handoff",
        reason="Verified the synthetic client spreadsheet layout and selected columns.",
    )


def test_saved_mapping_revisions_stale_layout_and_retirement(client, db, admin):
    company, _, _, _, headers = setup_registry(client, db, admin)
    root = f"/api/v1/tenants/{company['id']}"
    bid, imported = receipt(client, headers, root)
    mappings = root + "/intake-mappings"
    data = save_data(bid)
    result = client.post(mappings, headers=headers, json=data)
    assert result.status_code == 201, result.text
    first = result.json()
    assert first["revision"] == 1
    assert client.post(mappings, headers=headers, json=data).json()["replayed"]
    assert client.post(mappings, headers=headers, json={**data, "name": "Changed mapping"}).status_code == 409
    preview = root + "/intake-batches/spreadsheet/preview"
    source = {k: v for k, v in imported.items() if k != "command_id"}
    source["template_revision_id"] = first["id"]
    assert client.post(preview, headers=headers, json=source).status_code == 200
    wrong = {
        **source,
        "content_base64": encoded(b"Report,Driver,Kind,When\nR9,0007,background_screening,2026-11-17\n"),
    }
    assert client.post(preview, headers=headers, json=wrong).status_code == 409
    changed_map = {**source, "mapping": {**source["mapping"], "client_ref": 0}}
    assert client.post(preview, headers=headers, json=changed_map).status_code in {409, 422}
    saved_receipt = client.post(
        root + "/intake-batches/spreadsheet/receive",
        headers=headers,
        json={**source, "command_id": str(uuid4())},
    )
    assert saved_receipt.status_code == 201, saved_receipt.text
    original_bid = saved_receipt.json()["id"]
    revision_data = {
        **data,
        "command_id": str(uuid4()),
        "template_id": first["template_id"],
        "expected_revision": 1,
    }
    second = client.post(mappings, headers=headers, json=revision_data)
    assert second.status_code == 201, second.text
    assert second.json()["revision"] == 2
    assert (
        client.post(mappings, headers=headers, json={**revision_data, "command_id": str(uuid4())}).status_code
        == 409
    )
    assert client.post(preview, headers=headers, json=source).status_code == 409
    assert (
        client.post(
            root + "/intake-batches/spreadsheet/receive",
            headers=headers,
            json={**source, "command_id": str(uuid4())},
        ).status_code
        == 409
    )
    history = client.get(root + "/intake-batches/" + original_bid).json()
    assert history["provenance"]["template_revision_id"] == first["id"]
    assert history["provenance"]["saved_template"] == {"name": first["name"], "revision": 1}
    retirement = dict(
        command_id=str(uuid4()),
        expected_revision=2,
        reason="Client retired the synthetic export layout; preserve previous history.",
    )
    retired = client.post(mappings + "/" + first["template_id"] + "/retire", headers=headers, json=retirement)
    assert retired.status_code == 201, retired.text
    assert not retired.json()["active"]
    assert client.post(
        mappings + "/" + first["template_id"] + "/retire", headers=headers, json=retirement
    ).json()["replayed"]
    source["template_revision_id"] = second.json()["id"]
    assert client.post(preview, headers=headers, json=source).status_code == 409
    listing = client.get(mappings).json()["items"]
    assert len(listing) == 1 and listing[0]["revision"] == 3 and not listing[0]["active"]
    with pytest.raises(DBAPIError):
        with db.begin_nested():
            db.execute(
                text("UPDATE intake_mapping_templates SET active=false WHERE id=:id"), {"id": first["id"]}
            )


def test_mapping_scope_and_no_privilege_escalation(client, db, admin):
    company, other, branches, user, headers = setup_registry(client, db, admin)
    root = f"/api/v1/tenants/{company['id']}"
    bid, source = receipt(client, headers, root, branches[0]["id"])
    mapping = client.post(root + "/intake-mappings", headers=headers, json=save_data(bid)).json()
    assert client.get(root + "/intake-mappings").json()["items"] == []
    assert len(client.get(root + "/intake-mappings?branch_id=" + branches[0]["id"]).json()["items"]) == 1
    assert client.get(f"/api/v1/tenants/{other['id']}/intake-mappings").status_code == 404
    del source["command_id"]
    source.update(branch_id=None, template_revision_id=mapping["id"])
    assert (
        client.post(root + "/intake-batches/spreadsheet/preview", headers=headers, json=source).status_code
        == 404
    )
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    membership.branch_id = branches[1]["id"]
    db.commit()
    assert client.post(root + "/intake-mappings", headers=headers, json=save_data(bid)).status_code == 404
    assert client.get(root + "/intake-mappings?branch_id=" + branches[0]["id"]).status_code in {403, 404}
    retirement = dict(
        command_id=str(uuid4()),
        expected_revision=1,
        reason="Synthetic unauthorized location retirement attempt.",
    )
    assert (
        client.post(
            root + "/intake-mappings/" + mapping["template_id"] + "/retire", headers=headers, json=retirement
        ).status_code
        == 404
    )
    membership.branch_id = None
    membership.role = "client_contributor"
    db.commit()
    assert client.post(root + "/intake-mappings", headers=headers, json=save_data(bid)).status_code == 403
    assert (
        client.post(
            root + "/intake-mappings/" + mapping["template_id"] + "/retire", headers=headers, json=retirement
        ).status_code
        == 403
    )
    assert db.scalar(select(IntakeMappingTemplate).where(IntakeMappingTemplate.id == mapping["id"])).active
    membership.role = "client_viewer"
    db.commit()
    assert client.get(root + "/intake-mappings?branch_id=" + branches[0]["id"]).status_code == 404


def test_concurrent_mapping_revisions_only_one_commits(client, db, admin):
    from concurrent.futures import ThreadPoolExecutor

    company, _, _, _, headers = setup_registry(client, db, admin)
    root = f"/api/v1/tenants/{company['id']}"
    batch, _ = receipt(client, headers, root)
    data = save_data(batch)
    first = client.post(root + "/intake-mappings", headers=headers, json=data).json()

    def revise(_):
        response = client.post(
            root + "/intake-mappings",
            headers=headers,
            json={
                **data,
                "command_id": str(uuid4()),
                "template_id": first["template_id"],
                "expected_revision": 1,
            },
        )
        return response.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(revise, range(2))) == [201, 409]
    assert client.get(root + "/intake-mappings").json()["items"][0]["revision"] == 2
