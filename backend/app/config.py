from functools import lru_cache

from pydantic import model_validator, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from cryptography.fernet import Fernet


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    app_env: str = "local"
    database_url: str = "postgresql+psycopg://qualifyflow@127.0.0.1:55432/qualifyflow"
    encryption_key: str  # required; never silently substitute a test secret
    public_app_origin: str = "http://localhost:5173"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    redis_url: str = "redis://localhost:6379/0"
    private_object_dir: str = "../.local/evidence"
    clamav_host: str = "127.0.0.1"
    clamav_port: int = Field(default=3310, ge=1, le=65535)
    provider_simulator_port: int = Field(default=8090, ge=1024, le=65535)
    session_hours: int = 8

    @model_validator(mode="after")
    def local_only(self):
        if self.app_env not in {"local", "test"}:
            raise ValueError("Production/staging disabled pending security and privacy release gates")
        if self.smtp_host not in {"localhost", "127.0.0.1", "mailpit"}:
            raise ValueError("Only local mail sink is enabled")
        if self.clamav_host not in {"localhost", "127.0.0.1", "clamav"}:
            raise ValueError("Only a local/internal scanner is enabled")
        Fernet(self.encryption_key.encode())
        return self


@lru_cache
def settings():
    return Settings()
