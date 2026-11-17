"""PostgreSQL outbox is the recovery source; Celery beat polls it via Redis."""

from datetime import timedelta
from email.message import EmailMessage
import json
import smtplib

from celery import Celery
from cryptography.fernet import InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import engine
from app.models import Outbox, Invitation, Tenant, now
from app.shared.security import decrypt


def deliver_pending(limit=20):
    count = 0
    for _ in range(limit):
        with Session(engine()) as db, db.begin():
            candidate = db.scalar(
                select(Outbox)
                .where(Outbox.status.in_(["queued", "retry_scheduled"]), Outbox.available_at <= now())
                .order_by(Outbox.created_at)
                .limit(1)
            )
            if not candidate:
                break
            # Match command lock order: tenant -> invitation -> outbox, avoiding resend deadlocks.
            tenant = db.scalar(
                select(Tenant).where(Tenant.id == candidate.tenant_id).with_for_update(skip_locked=True)
            )
            if not tenant:
                break
            invite = db.scalar(
                select(Invitation).where(Invitation.id == candidate.invitation_id).with_for_update()
            )
            row = db.scalar(
                select(Outbox)
                .where(Outbox.id == candidate.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if row.status not in {"queued", "retry_scheduled"} or row.available_at > now():
                continue
            if (
                invite.status not in {"queued", "send_failed"}
                or invite.expires_at <= now()
                or tenant.status in {"suspended", "offboarding", "closed", "archived_draft"}
            ):
                row.status, row.encrypted_payload = "canceled", None
                continue
            row.attempts += 1
            try:
                raw = json.loads(decrypt(row.encrypted_payload))["token"]
            except (InvalidToken, TypeError, ValueError, KeyError):
                # Preserve failed evidence and let later tenants/items continue.
                row.status, row.error_code = "dead_letter", "OUTBOX_PAYLOAD_UNREADABLE"
                invite.status = "send_failed"
                continue
            message = EmailMessage()
            message["From"], message["To"] = "QualifyFlow local <no-reply@qualifyflow.invalid>", invite.email
            message["Subject"] = "Your QualifyFlow synthetic workspace invitation"
            message["Message-ID"] = f"<{row.id}@qualifyflow.invalid>"
            message.set_content(
                f"Accept your workspace invitation (expires in 48 hours):\n"
                f"{settings().public_app_origin}/#invite={raw}\n"
                "Local synthetic environment only."
            )
            try:
                with smtplib.SMTP(settings().smtp_host, settings().smtp_port, timeout=5) as smtp:
                    smtp.send_message(message)
                row.status, row.encrypted_payload, row.error_code = "sent", None, None
                invite.status = "sent"
                count += 1
            except (OSError, smtplib.SMTPException):
                row.status = "dead_letter" if row.attempts >= 5 else "retry_scheduled"
                row.error_code = "LOCAL_SMTP_UNAVAILABLE"
                row.available_at = now() + timedelta(seconds=min(900, 2**row.attempts * 10))
                invite.status = "send_failed"
    return count


def create_celery():
    worker = Celery("qualifyflow", broker=settings().redis_url)
    worker.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        beat_schedule={
            "dispatch-outbox": {"task": "qualifyflow.outbox", "schedule": 10.0},
            "dispatch-intake": {"task": "qualifyflow.intake", "schedule": 5.0},
        },
    )
    worker.task(name="qualifyflow.outbox")(deliver_pending)
    from app.screening_intake.jobs import process_pending

    worker.task(name="qualifyflow.intake")(process_pending)
    from app.documents.jobs import process_scans

    worker.task(name="qualifyflow.evidence_scans")(process_scans)
    worker.conf.beat_schedule["evidence-scans"] = {"task": "qualifyflow.evidence_scans", "schedule": 5.0}
    from app.correspondence.jobs import publish_pending

    worker.task(name="qualifyflow.in_app_messages")(publish_pending)
    worker.conf.beat_schedule["in-app-messages"] = {"task": "qualifyflow.in_app_messages", "schedule": 5.0}
    return worker


celery_app = create_celery()


if __name__ == "__main__":
    print(f"SMTP-accepted invitations: {deliver_pending()}")
