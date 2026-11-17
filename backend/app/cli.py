import argparse
import os
import pyotp
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import engine
from app.models import User
from app.shared.security import encrypt, passwords


def main():
    parser = argparse.ArgumentParser(description="Local-only explicit account provisioning")
    parser.add_argument("command", choices=["bootstrap"])
    args = parser.parse_args()
    if args.command == "bootstrap":
        email = os.environ["BOOTSTRAP_EMAIL"].lower()
        password = os.environ["BOOTSTRAP_PASSWORD"]
        secret = os.environ["BOOTSTRAP_TOTP_SECRET"]
        role = os.environ.get("BOOTSTRAP_ROLE", "service_admin")
        if len(password) < 12 or role not in {"service_admin", "specialist"}:
            raise ValueError("Use a 12+ character password and valid local staff role")
        pyotp.TOTP(secret).at(0)  # validate base32
        with Session(engine()) as db, db.begin():
            if db.scalar(select(User).where(User.email == email)):
                raise ValueError("Account already exists; refusing to overwrite")
            db.add(
                User(
                    email=email,
                    password_hash=passwords.hash(password),
                    platform_role=role,
                    totp_secret=encrypt(secret),
                )
            )
        print("Local account created; enroll the supplied TOTP seed in your authenticator.")


if __name__ == "__main__":
    main()
