from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, BaseModel
from app.organizations.schemas import Input, Versioned


class DriverCreate(Input):
    command_id: UUID
    reference: str = Field(pattern=r"^[A-Z0-9][A-Z0-9_-]{1,63}$")
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    branch_id: UUID | None = None
    start_date: date


class DriverSearch(Input):
    q: str = Field(default="", max_length=100)
    status: Literal["engagement_draft", "onboarding", "active", "suspended", "inactive", "ended"] | None = (
        None
    )
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=25, ge=1, le=100)


class DriverCorrection(Versioned):
    reference: str = Field(pattern=r"^[A-Z0-9][A-Z0-9_-]{1,63}$")
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    verified_basis: str = Field(min_length=10, max_length=500)


class EngagementCreate(Input):
    branch_id: UUID | None = None
    start_date: date
    reason: str = Field(min_length=5, max_length=500)


class EngagementChange(Versioned):
    status: Literal["onboarding", "active", "suspended", "inactive", "ended"]
    end_date: date | None = None


class EngagementTransfer(Versioned):
    branch_id: UUID | None = None
    effective_date: date


class DriverAccess(BaseModel):
    role: str
    branch_id: UUID | None
    can_write: bool
    can_correct: bool
    can_transfer: bool
    can_rehire: bool
    can_history: bool


class IdentityOutput(BaseModel):
    id: UUID
    reference: str
    first_name: str
    last_name: str
    version: int
    created_at: datetime


class EngagementOutput(BaseModel):
    id: UUID
    branch_id: UUID | None
    branch_name: str | None
    start_date: date
    end_date: date | None
    status: str
    version: int
    allowed_transitions: list[str]


class HistoryOutput(BaseModel):
    id: UUID
    action: str
    reason: str
    details: dict
    actor_id: UUID
    actor_email: str
    occurred_at: datetime


class DriverOutput(IdentityOutput):
    engagements: list[EngagementOutput]
    access: DriverAccess
    history: list[HistoryOutput] | None
    history_total: int | None


class DriverListItem(IdentityOutput):
    engagement: EngagementOutput


class DriverPage(BaseModel):
    items: list[DriverListItem]
    total: int
    offset: int
    limit: int
