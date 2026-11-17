"""Synthetic visual-review fixtures, strictly confined to a dedicated test database."""

from pathlib import Path
import json
import secrets
import sys
from datetime import date

sys.path.insert(0, str(Path(__file__).parents[1]))
import pyotp
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.db import engine
from app.models import User, Tenant, Branch, Membership
from app.shared.security import encrypt, passwords

if settings().database_url.rsplit("/", 1)[-1] != "qualifyflow_ui_test":
    raise RuntimeError("Visual fixtures require dedicated qualifyflow_ui_test database")
target = Path("../.local/ui-qa-accounts.json")
accounts = (
    json.loads(target.read_text())
    if target.exists()
    else {
        role: dict(
            email=f"ui-{role}@example.com", password=secrets.token_urlsafe(18), secret=pyotp.random_base32()
        )
        for role in ("admin", "client", "empty")
    }
)
accounts.setdefault(
    "long",
    dict(
        email="alexandra.transportation.administration@synthetic-company.example.com",
        password=secrets.token_urlsafe(18),
        secret=pyotp.random_base32(),
    ),
)
accounts.setdefault(
    "no_locations",
    dict(
        email="ui-no-locations@example.com",
        password=secrets.token_urlsafe(18),
        secret=pyotp.random_base32(),
    ),
)
with Session(engine()) as db, db.begin():
    users = {}
    for role, a in accounts.items():
        user = db.scalar(select(User).where(User.email == a["email"]))
        if not user:
            user = User(
                email=a["email"],
                password_hash=passwords.hash(a["password"]),
                platform_role="service_admin" if role == "admin" else None,
                totp_secret=encrypt(a["secret"]),
            )
            db.add(user)
            db.flush()
        user.last_totp_step = -1
        users[role] = user
    names = [
        "Northline Transport",
        "Meridian Freight & Logistics International — Western Regional Operations",
        "Aster Distribution",
        "Summit Carriers",
    ]
    for i, name in enumerate(names):
        ref = f"UI-QA-{i}"
        tenant = db.scalar(select(Tenant).where(Tenant.customer_ref == ref))
        if not tenant:
            tenant = Tenant(
                legal_name=name + " LLC",
                display_name=name,
                customer_ref=ref,
                mode="managed",
                timezone="America/Chicago",
                region="Synthetic US region",
                primary_contact="contact@example.com",
                effective_date=date(2026, 11, 17),
                status="draft" if i != 2 else "suspended",
                configuration={},
            )
            db.add(tenant)
            db.flush()
            db.add(Branch(tenant_id=tenant.id, name="Main office", reference="MAIN"))
            if i == 0:
                db.add(Branch(tenant_id=tenant.id, name="East terminal", reference="EAST"))
        if i == 0 and not db.scalar(
            select(Membership).where(
                Membership.user_id == users["client"].id, Membership.tenant_id == tenant.id
            )
        ):
            db.add(Membership(user_id=users["client"].id, tenant_id=tenant.id, role="client_admin"))
        if i == 1 and not db.scalar(
            select(Membership).where(
                Membership.user_id == users["long"].id, Membership.tenant_id == tenant.id
            )
        ):
            branch = db.scalar(select(Branch).where(Branch.tenant_id == tenant.id))
            db.add(
                Membership(
                    user_id=users["long"].id, tenant_id=tenant.id, role="client_viewer", branch_id=branch.id
                )
            )
    empty_tenant = db.scalar(select(Tenant).where(Tenant.customer_ref == "UI-QA-NO-LOCATIONS"))
    if not empty_tenant:
        empty_tenant = Tenant(
            legal_name="Synthetic Empty Locations LLC",
            display_name="Harbor Transport",
            customer_ref="UI-QA-NO-LOCATIONS",
            mode="managed",
            timezone="America/Chicago",
            region="Synthetic US region",
            primary_contact="ui-no-locations@example.com",
            effective_date=date(2026, 11, 17),
            status="draft",
            configuration={},
        )
        db.add(empty_tenant)
        db.flush()
    if not db.scalar(
        select(Membership).where(
            Membership.user_id == users["no_locations"].id, Membership.tenant_id == empty_tenant.id
        )
    ):
        db.add(Membership(user_id=users["no_locations"].id, tenant_id=empty_tenant.id, role="client_admin"))
target.write_text(json.dumps(accounts))
print("Dedicated visual QA fixtures ready; secrets remain in ignored .local file.")
