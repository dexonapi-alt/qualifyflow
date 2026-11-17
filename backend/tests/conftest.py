import os
from pathlib import Path

from cryptography.fernet import Fernet
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

os.environ["APP_ENV"] = "test"
os.environ["ENCRYPTION_KEY"] = Fernet.generate_key().decode()
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://qualifyflow@127.0.0.1:55432/qualifyflow_test"
)

from app.models import User
from app.main import app
from app.db import get_db
from app.shared.security import encrypt, passwords

ORIGIN = {"Origin": "http://localhost:5173"}
SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"
PASSWORD = "Synthetic-password-123"


@pytest.fixture(scope="session")
def engine():
    from alembic import command
    from alembic.config import Config

    assert os.environ["DATABASE_URL"].rsplit("/", 1)[-1].endswith("_test"), "Refuse non-test database"
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "head")
    return create_engine(os.environ["DATABASE_URL"])


@pytest.fixture(autouse=True)
def clean(engine):
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE outbox,audit_events,invitations,operator_assignments,memberships,"
                "branches,tenants,sessions,users CASCADE"
            )
        )


@pytest.fixture
def db(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(engine):
    def dependency():
        with Session(engine, expire_on_commit=False) as session:
            with session.begin():
                yield session

    app.dependency_overrides[get_db] = dependency
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def make_user(db, email="operator@example.com", platform_role="service_admin", mfa=True):
    user = User(
        email=email,
        password_hash=passwords.hash(PASSWORD),
        platform_role=platform_role,
        totp_secret=encrypt(SECRET) if mfa else None,
    )
    db.add(user)
    db.commit()
    return user


def sign_in(client, email="operator@example.com", secret=SECRET):
    import pyotp

    response = client.post(
        "/api/v1/auth/login",
        headers=ORIGIN,
        json={"email": email, "password": PASSWORD, "code": pyotp.TOTP(secret).now() if secret else ""},
    )
    assert response.status_code == 200, response.text
    return {**ORIGIN, "X-CSRF-Token": client.cookies["qf_csrf"]}


@pytest.fixture
def admin(client, db):
    make_user(db)
    return sign_in(client)


def company_payload(ref="ABC"):
    return {
        "legal_name": ref + " Synthetic Company",
        "display_name": ref + " Trucking",
        "customer_ref": ref,
        "mode": "managed",
        "timezone": "America/Chicago",
        "region": "Synthetic US example",
        "primary_contact": "contact@example.com",
        "effective_date": "2026-11-17",
    }


def create_company(client, headers, ref="ABC"):
    r = client.post("/api/v1/tenants", headers=headers, json=company_payload(ref))
    assert r.status_code == 201, r.text
    return r.json()
