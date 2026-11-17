import time
import pyotp
from conftest import make_user, ORIGIN, SECRET, PASSWORD


def test_clock_boundary_tolerance_does_not_allow_code_replay(client, db, monkeypatch):
    make_user(db)
    timestamp = int(time.time())
    monkeypatch.setattr("app.auth.service.time.time", lambda: timestamp)
    previous = pyotp.TOTP(SECRET).at((timestamp // 30 - 1) * 30)
    current = pyotp.TOTP(SECRET).at((timestamp // 30) * 30)

    def attempt(code):
        return client.post(
            "/api/v1/auth/login",
            headers=ORIGIN,
            json={"email": "operator@example.com", "password": PASSWORD, "code": code},
        )

    assert attempt(previous).status_code == 200
    assert attempt(previous).status_code == 401
    assert attempt(current).status_code == 200
    assert attempt(previous).status_code == 401
