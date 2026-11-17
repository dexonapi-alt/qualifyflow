from uuid import UUID
from fastapi import Query, Request
from pydantic import Field
from typing import Literal
from app.organizations.schemas import Input
from app.exceptions import service


class Change(Input):
    version: int = Field(ge=1)
    state: Literal["assigned", "in_review", "awaiting_client", "resolved", "closed", "reopened", "canceled"]
    reason: str = Field(min_length=10, max_length=2000)


class Note(Input):
    version: int = Field(ge=1)
    reason: str = Field(min_length=5, max_length=2000)


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/exceptions"

    @app.get(base)
    def listing(
        tenant_id: UUID,
        actor: Actor,
        db: DB,
        state: str | None = Query(
            default=None,
            pattern="^(open|assigned|in_review|awaiting_client|awaiting_internal_approval|resolved|closed|reopened|canceled)$",
        ),
        offset: int = Query(default=0, ge=0),
    ):
        return service.listing(db, actor, str(tenant_id), state, offset)

    @app.get(base + "/{case_id}")
    def detail(tenant_id: UUID, case_id: UUID, actor: Actor, db: DB):
        scope, case, task = service.scoped(db, actor, str(tenant_id), str(case_id))
        return service.output(db, scope, case, task, True, actor.id)

    @app.post(base + "/{case_id}/state")
    def transition(tenant_id: UUID, case_id: UUID, data: Change, actor: Actor, db: DB, request: Request):
        service.change(db, actor, str(tenant_id), str(case_id), data, request.state.correlation_id)
        return {"saved": True}

    @app.post(base + "/{case_id}/notes")
    def note(tenant_id: UUID, case_id: UUID, data: Note, actor: Actor, db: DB):
        _, case, _ = service.scoped(db, actor, str(tenant_id), str(case_id), True)
        if case.version != data.version:
            from app.shared.errors import DomainError

            raise DomainError("VERSION_CONFLICT", "Case changed. Refresh before adding a note.", 409)
        service.event(db, case, actor, "exception.note_added", data.reason)
        case.version += 1
        return {"saved": True}
