from datetime import timedelta
import hmac
import time

import pyotp
from sqlalchemy import select

from app.models import User, LoginSession, now
from app.shared.errors import DomainError
from app.shared.security import passwords, verify_password, token, digest, decrypt
from app.config import settings

DUMMY_HASH = passwords.hash("synthetic-dummy-password-for-timing")


def login(db, data):
    actor = db.scalar(select(User).where(User.email == str(data.email).lower()).with_for_update())
    valid = verify_password(actor.password_hash if actor else DUMMY_HASH, data.password)
    if not actor or actor.status != "active" or (actor.locked_until and actor.locked_until > now()):
        raise DomainError("UNAUTHORIZED", "Sign-in failed. Check credentials or try again later.", 401)
    step = int(time.time()) // 30
    matched_step = None
    if actor.totp_secret:
        totp = pyotp.TOTP(decrypt(actor.totp_secret))
        matched_step = next(
            (
                candidate
                for candidate in (step, step - 1, step + 1)
                if candidate > actor.last_totp_step
                and hmac.compare_digest(totp.at(candidate * 30), data.code)
            ),
            None,
        )
        valid = valid and matched_step is not None
    elif actor.platform_role:
        valid = False
    if not valid:
        actor.failed_logins += 1
        if actor.failed_logins >= 5:
            actor.locked_until = now() + timedelta(minutes=15)
        # Persist account-level abuse counters despite the rejected login transaction.
        db.commit()
        raise DomainError("UNAUTHORIZED", "Sign-in failed. Check credentials or try again later.", 401)
    actor.failed_logins, actor.locked_until = 0, None
    if actor.totp_secret:
        actor.last_totp_step = matched_step
    raw, csrf = token(), token()
    db.add(
        LoginSession(
            token_hash=digest(raw),
            csrf_hash=digest(csrf),
            user_id=actor.id,
            expires_at=now() + timedelta(hours=settings().session_hours),
            mfa_verified=bool(actor.totp_secret),
        )
    )
    return actor, raw, csrf


def resolve(db, raw, *, required=True):
    session = db.get(LoginSession, digest(raw)) if raw else None
    actor = db.get(User, session.user_id) if session and session.expires_at > now() else None
    if not actor or actor.status != "active":
        if required:
            raise DomainError("UNAUTHORIZED", "Sign in to continue.", 401)
        return None, None
    if actor.totp_secret and not session.mfa_verified:
        raise DomainError("UNAUTHORIZED", "Multi-factor authentication required.", 401)
    return actor, session


def csrf_check(session, supplied):
    if not supplied or not hmac.compare_digest(session.csrf_hash, digest(supplied)):
        raise DomainError("CSRF_REJECTED", "Refresh the page and try again.", 403)
