from sqlalchemy import select
from app.models import IntakeCorrection, IntakeMatch, IntakeItem, DriverEngagement
from app.shared.errors import DomainError


def replacement(db, item_id):
    link = db.scalar(select(IntakeCorrection).where(IntakeCorrection.parent_item_id == item_id))
    return db.get(IntakeItem, link.child_item_id) if link else None


def reviewed_match(db, item_id):
    return db.scalar(select(IntakeMatch).where(IntakeMatch.source_item_id == item_id))


def lineage_ids(db, item_id):
    result = {item_id}
    current = item_id
    for _ in range(10):
        link = db.scalar(select(IntakeCorrection).where(IntakeCorrection.child_item_id == current))
        if not link:
            return result
        result.add(link.parent_item_id)
        current = link.parent_item_id
    raise DomainError(
        "CORRECTION_LIMIT",
        "This source has reached ten correction versions. Escalate for investigation.",
        409,
    )


def require_current_source(db, item, batch, driver_id=None, engagement_id=None):
    if replacement(db, item.id):
        raise DomainError(
            "SOURCE_SUPERSEDED", "Use the corrected receipt. The original row is retained as history.", 409
        )
    match = reviewed_match(db, item.id)
    if (
        batch.source_channel in {"mapped_spreadsheet", "corrected_metadata", "background_spreadsheet"}
        and not match
    ):
        raise DomainError(
            "MATCH_REVIEW_REQUIRED",
            "Confirm the driver reference and engagement in intake review before opening the file.",
            409,
        )
    if match:
        engagement = db.get(DriverEngagement, match.engagement_id)
        if (
            not engagement
            or engagement.end_date
            or (driver_id and match.driver_id != driver_id)
            or (engagement_id and match.engagement_id != engagement_id)
        ):
            raise DomainError(
                "SOURCE_MISMATCH", "The reviewed source belongs to a different or ended engagement.", 409
            )
        if batch.branch_id and engagement.branch_id != batch.branch_id:
            raise DomainError("SOURCE_MISMATCH", "The reviewed source location no longer agrees.", 409)
    return match
