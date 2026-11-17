from datetime import timedelta
import hashlib
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session
from app.db import engine
from app.models import EvidenceVersion, DriverRequirement, DriverEngagement, User, Tenant, now, uid
from app.shared.authorization import authorize, allow_write
from app.audit.service import record
from app.documents import storage, scanner


def process_scans(limit=2):
    completed = 0
    for _ in range(limit):
        with Session(engine()) as db, db.begin():
            evidence = db.scalar(
                select(EvidenceVersion)
                .where(
                    or_(
                        and_(EvidenceVersion.status == "quarantined", EvidenceVersion.available_at <= now()),
                        and_(EvidenceVersion.status == "scanning", EvidenceVersion.lease_until < now()),
                    )
                )
                .order_by(EvidenceVersion.uploaded_at)
                .limit(1)
            )
            if not evidence:
                break
            tenant = db.scalar(
                select(Tenant).where(Tenant.id == evidence.tenant_id).with_for_update(skip_locked=True)
            )
            if not tenant:
                break
            evidence = db.scalar(
                select(EvidenceVersion)
                .where(EvidenceVersion.id == evidence.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if evidence.status == "scanning" and evidence.lease_until and evidence.lease_until > now():
                continue
            if evidence.status not in {"quarantined", "scanning"}:
                continue
            actor = db.get(User, evidence.actor_id)
            try:
                scope = authorize(db, actor, tenant.id, "drivers:write")
                allow_write(tenant)
                req = db.get(DriverRequirement, evidence.requirement_id)
                engagement = db.get(DriverEngagement, req.engagement_id)
                if scope.branch_id and scope.branch_id != engagement.branch_id:
                    raise ValueError("Scope changed")
            except Exception:
                evidence.status, evidence.scan_error = "scan_failed", "CURRENT_AUTHORIZATION_OR_TENANT_DENIED"
                continue
            if evidence.scan_attempts >= 3:
                evidence.status, evidence.scan_error = "scan_failed", "SCAN_RETRY_LIMIT"
                continue
            evidence.status, evidence.lease_token, evidence.lease_until = (
                "scanning",
                uid(),
                now() + timedelta(seconds=180),
            )
            evidence.scan_attempts += 1
            eid, key, digest, lease, tid, actor_id = (
                evidence.id,
                evidence.object_key,
                evidence.sha256,
                evidence.lease_token,
                evidence.tenant_id,
                actor.id,
            )
        try:
            content = storage.get(key)
            if hashlib.sha256(content).hexdigest() != digest:
                status, engine_name, error = "scan_failed", None, "EVIDENCE_INTEGRITY_ERROR"
            else:
                status, engine_name, error = scanner.scan(content)
        except Exception:
            status, engine_name, error = "scan_failed", None, "PRIVATE_STORAGE_UNAVAILABLE"
        with Session(engine()) as db, db.begin():
            db.scalar(select(Tenant).where(Tenant.id == tid).with_for_update())
            evidence = db.scalar(select(EvidenceVersion).where(EvidenceVersion.id == eid).with_for_update())
            if evidence.lease_token != lease or evidence.status != "scanning":
                continue
            evidence.status, evidence.scanner, evidence.scan_error = status, engine_name, error
            evidence.scanned_at = now() if status == "needs_review" else None
            evidence.lease_until = None
            evidence.version += 1
            record(
                db,
                db.get(User, actor_id),
                tid,
                "evidence.scan_finished",
                eid,
                "evidence-scan-worker",
                status=status,
                scanner=engine_name,
            )
            completed += 1
    return completed
