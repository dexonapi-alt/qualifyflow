"""Prepare private local provider credentials without replacing existing ones."""

from pathlib import Path
import json
import secrets

target = Path(__file__).resolve().parents[2] / ".local/provider-simulator.json"
target.parent.mkdir(exist_ok=True)
if not target.exists():
    target.write_text(
        json.dumps({"account_ref": "SYNTHETIC-ACCOUNT", "credential": secrets.token_urlsafe(32)}, indent=2),
        encoding="utf8",
    )
print(
    "Local synthetic provider details are in ignored .local/provider-simulator.json. No credential printed."
)
