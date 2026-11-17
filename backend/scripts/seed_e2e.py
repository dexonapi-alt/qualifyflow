"""Explicit synthetic E2E test setup, never touches non-test databases."""

from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).parents[1]))
from sqlalchemy import select
from sqlalchemy.orm import Session
import pyotp

from app.db import engine
from app.config import settings
from app.models import User
from app.shared.security import passwords, encrypt

if not settings().database_url.rsplit("/", 1)[-1].endswith("_test"):
    raise RuntimeError("Refuse non-test database")

root = Path(__file__).parents[2]
output = root / ".local/e2e-accounts.json"
if output.exists():
    accounts = json.loads(output.read_text())
else:
    accounts = {
        role: {
            "email": f"e2e-{role}@example.com",
            "password": "Synthetic-E2E-password-123",
            "secret": pyotp.random_base32(),
        }
        for role in ("admin", "specialist")
    }
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(accounts))
with Session(engine()) as db, db.begin():
    for key, account in accounts.items():
        user = db.scalar(select(User).where(User.email == account["email"]))
        if not user:
            user = User(
                email=account["email"],
                password_hash=passwords.hash(account["password"]),
                platform_role="service_admin" if key == "admin" else "specialist",
                totp_secret=encrypt(account["secret"]),
            )
            db.add(user)
        user.last_totp_step = -1
        # Only *_test databases: restore known synthetic staff under the current local key.
        # Preserve all tenant/business records; never apply this reset to manual/production accounts.
        user.totp_secret = encrypt(account["secret"])
print("Synthetic E2E staff provisioned; credentials remain in ignored .local file.")
