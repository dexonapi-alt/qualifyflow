"""Operational evidence state; no regulatory applicability or deadline inference."""

from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import select
from app.models import EvidenceVersion, EvidenceReview


def requirement_state(db, requirement_id, timezone):
    evidence = list(
        db.scalars(
            select(EvidenceVersion)
            .where(EvidenceVersion.requirement_id == requirement_id)
            .order_by(EvidenceVersion.revision.desc())
        )
    )
    for ev in evidence:
        review = db.scalar(
            select(EvidenceReview)
            .where(EvidenceReview.evidence_id == ev.id)
            .order_by(EvidenceReview.reviewed_at.desc())
            .limit(1)
        )
        if review and review.outcome == "verified_evidence":
            today = datetime.now(ZoneInfo(timezone)).date()
            return "expired" if review.expires_on and review.expires_on < today else "verified"
    if not evidence:
        return "missing"
    return "rejected" if evidence[0].status == "reviewed_rejected" else "needs_review"
