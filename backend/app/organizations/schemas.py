from datetime import date
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CompanyCreate(Input):
    legal_name: str = Field(min_length=2, max_length=200)
    display_name: str = Field(min_length=2, max_length=200)
    customer_ref: str = Field(pattern=r"^[A-Z0-9][A-Z0-9_-]{1,63}$")
    mode: Literal["managed", "self_service", "hybrid"]
    timezone: str
    region: str = Field(min_length=2, max_length=100)
    primary_contact: EmailStr
    effective_date: date

    @field_validator("timezone")
    @classmethod
    def valid_zone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Select a valid IANA timezone")
        return value


class BranchCreate(Input):
    name: str = Field(min_length=1, max_length=160)
    reference: str = Field(pattern=r"^[A-Z0-9][A-Z0-9_-]{0,63}$")


class InviteCreate(Input):
    email: EmailStr
    role: Literal["client_admin", "client_contributor", "client_viewer"]
    branch_id: UUID | None = None


class Versioned(Input):
    version: int = Field(ge=1)
    reason: str = Field(min_length=5, max_length=500)


class Configuration(Versioned):
    policy_reference: str = Field(min_length=3, max_length=100)
    intake_owner: Literal["client", "service"]
    review_owner: Literal["client", "service"]
    integration_required: bool = False


class AssignmentCreate(Input):
    user_id: UUID
    branch_id: UUID | None = None
    reason: str = Field(min_length=5, max_length=500)


class MemberChange(Versioned):
    role: Literal["client_admin", "client_contributor", "client_viewer"] | None = None
    action: Literal["revoke", "change_role"]
