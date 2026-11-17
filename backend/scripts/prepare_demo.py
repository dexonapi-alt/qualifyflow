"""Create local synthetic staff without replacing existing credentials or business records."""

from pathlib import Path
import json
import secrets
import sys

sys.path.insert(0, str(Path(__file__).parents[1]))
import pyotp
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.db import engine
from app.models import User
from app.shared.security import passwords, encrypt

if settings().app_env != "local" or settings().database_url.rsplit("/", 1)[-1] != "qualifyflow":
    raise RuntimeError("Demo setup only supports the local qualifyflow development database")
directory = Path(__file__).parents[2] / ".local"
directory.mkdir(exist_ok=True)
account_file = directory / "demo-accounts.json"
if account_file.exists():
    accounts = json.loads(account_file.read_text())
else:
    accounts = {
        role: {
            "email": f"demo-{role}@example.com",
            "password": secrets.token_urlsafe(18),
            "secret": pyotp.random_base32(),
        }
        for role in ("admin", "specialist")
    }
with Session(engine()) as db, db.begin():
    for role, account in accounts.items():
        existing = db.scalar(select(User).where(User.email == account["email"]))
        if existing:
            if not account_file.exists():
                raise RuntimeError("Existing demo email without saved credentials; refusing overwrite")
            continue
        db.add(
            User(
                email=account["email"],
                password_hash=passwords.hash(account["password"]),
                platform_role="service_admin" if role == "admin" else "specialist",
                totp_secret=encrypt(account["secret"]),
            )
        )
account_file.write_text(json.dumps(accounts, indent=2))
lines = [
    "# Local synthetic test accounts",
    "",
    "App: http://localhost:5173",
    "Inbox: http://localhost:8025",
    "",
    "Local test credentials only. Never reuse for real accounts.",
    "",
]
for role, account in accounts.items():
    lines += [
        f"## {role.title()}",
        "",
        f"Email: `{account['email']}`",
        f"Password: `{account['password']}`",
        f"Authenticator setup key: `{account['secret']}`",
        "",
        "Add the setup key to an authenticator with time-based, 6-digit, 30-second codes.",
        "",
    ]
lines += [
    "Alternatively, get a current code from the project root:",
    "",
    "```powershell",
    r".\backend\.venv\Scripts\python.exe backend/scripts/demo_code.py admin",
    "```",
    "",
    "Use `specialist` instead of `admin` for the other account.",
    "A code cannot be reused after successful sign-in; wait for the next 30-second code.",
]
(directory / "LOCAL_LOGIN.md").write_text("\n".join(lines), encoding="utf-8")
print("Demo accounts ready. Login details: .local/LOCAL_LOGIN.md (ignored by Git).")
