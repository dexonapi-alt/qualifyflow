from datetime import timedelta
from uuid import UUID
from collections import Counter
from fastapi import Request, Response, Query
from pydantic import Field
from sqlalchemy import select, func
from app.models import ExportJob, now
from app.organizations.schemas import Input
from app.shared.security import encrypt, decrypt
from app.shared.authorization import allow_write
from app.shared.errors import DomainError
from app.audit.service import record
from app.reporting import service


class Export(Input):
    command_id: UUID
    purpose: str = Field(min_length=10, max_length=500)


def register(app, DB, Actor):
    base = "/api/v1/tenants/{tenant_id}/reports"

    @app.get(base + "/requirements")
    def report(tenant_id: UUID, actor: Actor, db: DB, offset: int = Query(0, ge=0)):
        rows = service.rows(db, actor, str(tenant_id))
        return {
            "items": rows[offset : offset + 25],
            "total": len(rows),
            "states": dict(Counter(row["state"] for row in rows)),
            "generated_at": now(),
            "basis": "Configured evidence only; legal applicability unverified",
        }

    @app.get(base + "/exports")
    def exports(tenant_id: UUID, actor: Actor, db: DB, offset: int = Query(0, ge=0)):
        scope = service.access(db, actor, str(tenant_id))
        query = select(ExportJob).where(
            ExportJob.tenant_id == str(tenant_id),
            ExportJob.actor_id == actor.id,
            ExportJob.branch_id == scope.branch_id,
        )
        return {
            "items": [
                service.present(j)
                for j in db.scalars(query.order_by(ExportJob.created_at.desc()).offset(offset).limit(25))
            ],
            "total": db.scalar(select(func.count()).select_from(query.subquery())),
        }

    @app.post(base + "/exports", status_code=202)
    def create(tenant_id: UUID, data: Export, actor: Actor, db: DB, request: Request):
        from app.organizations.service import lock_tenant

        tid = str(tenant_id)
        scope = service.access(db, actor, tid)
        allow_write(lock_tenant(db, actor, tid, "drivers:correct"))
        prior = db.scalar(
            select(ExportJob).where(
                ExportJob.tenant_id == tid,
                ExportJob.actor_id == actor.id,
                ExportJob.command_id == str(data.command_id),
            )
        )
        if prior:
            service.export_access(db, actor, prior)
            if decrypt(prior.encrypted_purpose) != data.purpose:
                raise DomainError("IDEMPOTENCY_CONFLICT", "Export command purpose changed.", 409)
            return service.present(prior)
        if (
            db.scalar(
                select(func.count())
                .select_from(ExportJob)
                .where(ExportJob.actor_id == actor.id, ExportJob.created_at > now() - timedelta(hours=1))
            )
            >= 10
        ):
            raise DomainError("EXPORT_RATE_LIMIT", "Limit of ten export requests per hour reached.", 429)
        row = ExportJob(
            tenant_id=tid,
            actor_id=actor.id,
            branch_id=scope.branch_id,
            command_id=str(data.command_id),
            encrypted_purpose=encrypt(data.purpose),
            expires_at=now() + timedelta(hours=1),
        )
        db.add(row)
        db.flush()
        record(
            db,
            actor,
            tid,
            "report.export_requested",
            row.id,
            request.state.correlation_id,
            branch_id=scope.branch_id,
        )
        return service.present(row)

    @app.get(base + "/exports/{export_id}/download")
    def download(tenant_id: UUID, export_id: UUID, actor: Actor, db: DB, request: Request):
        service.access(db, actor, str(tenant_id))
        row = db.scalar(
            select(ExportJob).where(ExportJob.id == str(export_id), ExportJob.tenant_id == str(tenant_id))
        )
        if not row:
            raise DomainError("NOT_FOUND", "Export unavailable.", 404)
        body = service.content(db, actor, row)
        record(
            db,
            actor,
            str(tenant_id),
            "report.export_downloaded",
            row.id,
            request.state.correlation_id,
            row_count=row.row_count,
        )
        return Response(
            body,
            media_type="text/csv",
            headers={
                "Content-Disposition": 'attachment; filename="qualifyflow-configured-evidence.csv"',
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
