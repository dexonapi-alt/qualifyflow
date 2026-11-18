"""Configured evidence reporting, never a statutory qualification score."""

import csv
import hashlib
import io
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session
from app.db import engine
from app.models import (
    DriverRequirement,
    DriverEngagement,
    DriverIdentity,
    RequirementDefinition,
    ExportJob,
    Tenant,
    User,
    now,
)
from app.shared.authorization import authorize, allow_write
from app.shared.errors import DomainError
from app.shared.security import encrypt, decrypt
from app.documents.state import requirement_state
from app.audit.service import record


def access(db, actor, tid):
    return authorize(db, actor, tid, "drivers:correct")


def rows(db, actor, tid):
    scope = access(db, actor, tid)
    query = (
        select(
            DriverRequirement,
            DriverIdentity.reference,
            RequirementDefinition.title,
            RequirementDefinition.code,
        )
        .join(DriverEngagement, DriverEngagement.id == DriverRequirement.engagement_id)
        .join(DriverIdentity, DriverIdentity.id == DriverRequirement.driver_id)
        .join(RequirementDefinition, RequirementDefinition.id == DriverRequirement.definition_id)
        .where(DriverRequirement.tenant_id == tid, DriverEngagement.end_date.is_(None))
    )
    if scope.branch_id:
        query = query.where(DriverEngagement.branch_id == scope.branch_id)
    records = list(
        db.execute(
            query.order_by(DriverIdentity.reference, RequirementDefinition.code, DriverRequirement.id).limit(
                1001
            )
        )
    )
    if len(records) > 1000:
        raise DomainError(
            "REPORT_QUOTA",
            "This local report is limited to 1000 assigned requirements. Use a narrower location grant.",
            422,
        )
    return [
        {
            "driver_id": req.driver_id,
            "driver_reference": ref,
            "requirement": title,
            "code": code,
            "state": requirement_state(db, req.id, scope.tenant.timezone),
        }
        for req, ref, title, code in records
    ]


def export_access(db, actor, job):
    scope = access(db, actor, job.tenant_id)
    allow_write(scope.tenant)
    if job.actor_id != actor.id or scope.branch_id != job.branch_id:
        raise DomainError("NOT_FOUND", "Export unavailable in the current scope.", 404)
    return scope


def present(job):
    return {
        key: getattr(job, key)
        for key in ("id", "status", "error_code", "row_count", "sha256", "created_at", "expires_at")
    }


def safe_cell(value):
    # Spreadsheet formula injection remains dangerous even when CSV-quoted.
    value = str(value)
    return (
        "'" + value
        if value.lstrip().startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n"))
        else value
    )


def process_pending(limit=5):
    completed = 0
    with Session(engine()) as listing:
        ids = list(
            listing.scalars(
                select(ExportJob.id)
                .where(
                    or_(
                        ExportJob.status == "queued",
                        and_(ExportJob.status == "completed", ExportJob.expires_at <= now()),
                    )
                )
                .order_by(ExportJob.created_at)
                .limit(100)
            )
        )
    for jid in ids:
        with Session(engine()) as db, db.begin():
            info = db.get(ExportJob, jid)
            if not info or not db.scalar(
                select(Tenant).where(Tenant.id == info.tenant_id).with_for_update(skip_locked=True)
            ):
                continue
            job = db.scalar(
                select(ExportJob)
                .where(ExportJob.id == jid)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            actor = db.get(User, job.actor_id)
            if job.expires_at <= now():
                job.status, job.encrypted_content = "expired", None
                record(db, actor, job.tenant_id, "report.export_expired", job.id, job.id)
                continue
            if job.status != "queued" or completed >= limit:
                continue
            try:
                export_access(db, actor, job)
                content = io.StringIO(newline="")
                writer = csv.writer(content)
                writer.writerow(
                    ["driver_reference", "requirement_code", "requirement", "evidence_state", "basis"]
                )
                records = rows(db, actor, job.tenant_id)
                for row in records:
                    writer.writerow(
                        [
                            safe_cell(row["driver_reference"]),
                            safe_cell(row["code"]),
                            safe_cell(row["requirement"]),
                            row["state"],
                            "Configured evidence only; legal applicability unverified",
                        ]
                    )
                body = content.getvalue()
                job.encrypted_content, job.sha256 = encrypt(body), hashlib.sha256(body.encode()).hexdigest()
                job.row_count, job.status = len(records), "completed"
            except DomainError as error:
                job.status, job.error_code = "failed", error.code
            record(
                db,
                actor,
                job.tenant_id,
                "report.export_processed",
                job.id,
                job.id,
                state=job.status,
                row_count=job.row_count,
                error_code=job.error_code,
            )
            completed += 1
    return completed


def content(db, actor, job):
    export_access(db, actor, job)
    if job.status != "completed" or job.expires_at <= now() or not job.encrypted_content:
        raise DomainError(
            "EXPORT_UNAVAILABLE",
            "Export is pending, expired or unavailable. Request a new export if needed.",
            409,
        )
    body = decrypt(job.encrypted_content).encode()
    if hashlib.sha256(body).hexdigest() != job.sha256:
        raise DomainError("EXPORT_INTEGRITY_ERROR", "Export integrity verification failed.", 409)
    return body
