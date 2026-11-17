"""Development inbox rendering: never offer links from another database or stale tokens."""

import html
import json
import re
from sqlalchemy import select
from app.models import Invitation, Tenant, now
from app.shared.security import digest

LINK = re.compile(r"http://localhost:5173/\#invite=([A-Za-z0-9_-]+)")


def render_messages(db, directory):
    invitations = {
        invite.token_hash: (invite, tenant)
        for invite, tenant in db.execute(select(Invitation, Tenant).join(Tenant))
    }
    rendered = []
    for path in sorted(directory.glob("*.json"), reverse=True):
        message = json.loads(path.read_text())
        match = LINK.search(message["body"])
        current = invitations.get(digest(match[1])) if match else None
        if not current:
            continue  # Preserve archives on disk; unrelated database/rotated links never appear.
        invitation, tenant = current
        status = invitation.status
        if status in {"queued", "sent", "send_failed"} and invitation.expires_at <= now():
            status = "expired"
        usable = status in {"queued", "sent", "send_failed"} and tenant.status not in {
            "suspended",
            "offboarding",
            "closed",
            "archived_draft",
        }
        body = LINK.sub(
            lambda m: (
                f'<a href="{m[0]}" target="_blank" rel="noreferrer">Open invitation</a>'
                if usable
                else "Invitation link unavailable. Request a new invitation from your administrator."
            ),
            html.escape(message["body"]),
        )
        rendered.append(
            f"<article><h2>{html.escape(invitation.email)}</h2>"
            f"<p>{html.escape(tenant.display_name)} · {html.escape(status)}</p><pre>{body}</pre></article>"
        )
        if len(rendered) >= 50:
            break
    return (
        "".join(rendered)
        or "<p>No invitations for the current workspace. Create one under Company → People &amp; access, then refresh this inbox.</p>"
    )
