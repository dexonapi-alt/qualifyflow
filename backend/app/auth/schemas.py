from pydantic import EmailStr, Field
from app.organizations.schemas import Input


class Login(Input):
    model_config = {"extra": "forbid", "str_strip_whitespace": False}
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    code: str = Field(default="", max_length=6)


class Accept(Input):
    model_config = {"extra": "forbid", "str_strip_whitespace": False}
    token: str = Field(min_length=30, max_length=100)
    password: str | None = Field(default=None, min_length=12, max_length=128)
    totp_secret: str | None = Field(default=None, pattern=r"^[A-Z2-7]{32}$")
    code: str | None = Field(default=None, pattern=r"^\d{6}$")
