import json
from datetime import timedelta
from scripts.inbox_view import render_messages
from app.models import Invitation, now
from conftest import create_company
from test_foundation import invite, invite_token


def test_inbox_hides_other_database_messages_and_disables_used_links(client, db, admin, tmp_path):
    company = create_company(client, admin)
    item = invite(client, admin, company["id"])
    raw = invite_token(db, item["id"])
    for name, token, recipient in [
        ("current", raw, "client@example.com"),
        ("old-test", "not-in-this-database-token", "old-test@example.com"),
    ]:
        (tmp_path / (name + ".json")).write_text(
            json.dumps({"to": [recipient], "body": "Accept: http://localhost:5173/#invite=" + token})
        )
    html = render_messages(db, tmp_path)
    assert "Open invitation" in html
    assert "old-test@example.com" not in html
    assert "not-in-this-database-token" not in html
    row = db.get(Invitation, item["id"])
    for state in ("accepted", "revoked"):
        row.status = state
        db.flush()
        html = render_messages(db, tmp_path)
        assert "Open invitation" not in html
        assert raw not in html
        assert state in html
    row.status, row.expires_at = (
        "sent",
        now() - timedelta(seconds=1),
    )
    db.flush()
    assert "Open invitation" not in render_messages(db, tmp_path)
    assert "expired" in render_messages(db, tmp_path)
