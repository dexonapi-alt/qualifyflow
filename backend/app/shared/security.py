import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from cryptography.fernet import Fernet

from app.config import settings

passwords = PasswordHasher()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def token():
    return secrets.token_urlsafe(32)


def encrypt(value):
    return Fernet(settings().encryption_key.encode()).encrypt(value.encode()).decode()


def decrypt(value):
    return Fernet(settings().encryption_key.encode()).decrypt(value.encode()).decode()


def verify_password(encoded, supplied):
    try:
        return passwords.verify(encoded, supplied)
    except (VerificationError, InvalidHashError):
        return False
