from uuid import UUID
from fastapi import Request, Query

from app.drivers import service
from app.drivers.schemas import (
    DriverCreate,
    DriverSearch,
    DriverCorrection,
    EngagementCreate,
    EngagementChange,
    EngagementTransfer,
)
from app.drivers.schemas import DriverOutput, DriverPage


def register(app, DB, Actor):
    @app.get("/api/v1/tenants/{tenant_id}/drivers", response_model=DriverPage)
    def registry(
        tenant_id: UUID,
        actor: Actor,
        db: DB,
        status: str | None = Query(
            default=None, pattern="^(engagement_draft|onboarding|active|suspended|inactive|ended)$"
        ),
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=25, ge=1, le=100),
    ):
        return service.listing(db, actor, str(tenant_id), "", status, offset, limit)

    @app.post("/api/v1/tenants/{tenant_id}/drivers/search", response_model=DriverPage)
    def search(tenant_id: UUID, data: DriverSearch, actor: Actor, db: DB):
        # Names/references stay in an authenticated body, never URLs or access logs.
        return service.listing(db, actor, str(tenant_id), data.q, data.status, data.offset, data.limit)

    @app.post("/api/v1/tenants/{tenant_id}/drivers", status_code=201, response_model=DriverOutput)
    def create(tenant_id: UUID, data: DriverCreate, actor: Actor, db: DB, request: Request):
        return service.create(db, actor, str(tenant_id), data, request.state.correlation_id)

    @app.get("/api/v1/tenants/{tenant_id}/drivers/{driver_id}", response_model=DriverOutput)
    def detail(tenant_id: UUID, driver_id: UUID, actor: Actor, db: DB):
        return service.detail(db, actor, str(tenant_id), str(driver_id))

    @app.get("/api/v1/tenants/{tenant_id}/drivers/{driver_id}/history")
    def history(tenant_id: UUID, driver_id: UUID, actor: Actor, db: DB, offset: int = Query(default=0, ge=0)):
        return service.history_page(db, actor, str(tenant_id), str(driver_id), offset)

    @app.post("/api/v1/tenants/{tenant_id}/drivers/{driver_id}/corrections", response_model=DriverOutput)
    def correct(
        tenant_id: UUID, driver_id: UUID, data: DriverCorrection, actor: Actor, db: DB, request: Request
    ):
        return service.correct(db, actor, str(tenant_id), str(driver_id), data, request.state.correlation_id)

    @app.post(
        "/api/v1/tenants/{tenant_id}/drivers/{driver_id}/engagements",
        status_code=201,
        response_model=DriverOutput,
    )
    def rehire(
        tenant_id: UUID, driver_id: UUID, data: EngagementCreate, actor: Actor, db: DB, request: Request
    ):
        return service.open_engagement(
            db, actor, str(tenant_id), str(driver_id), data, request.state.correlation_id
        )

    @app.post(
        "/api/v1/tenants/{tenant_id}/drivers/{driver_id}/engagements/{engagement_id}/state",
        response_model=DriverOutput,
    )
    def transition(
        tenant_id: UUID,
        driver_id: UUID,
        engagement_id: UUID,
        data: EngagementChange,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        return service.change_engagement(
            db, actor, str(tenant_id), str(driver_id), str(engagement_id), data, request.state.correlation_id
        )

    @app.post(
        "/api/v1/tenants/{tenant_id}/drivers/{driver_id}/engagements/{engagement_id}/transfer",
        response_model=DriverOutput,
    )
    def transfer(
        tenant_id: UUID,
        driver_id: UUID,
        engagement_id: UUID,
        data: EngagementTransfer,
        actor: Actor,
        db: DB,
        request: Request,
    ):
        return service.change_engagement(
            db,
            actor,
            str(tenant_id),
            str(driver_id),
            str(engagement_id),
            data,
            request.state.correlation_id,
            transfer=True,
        )
