from sqlalchemy import select
from app.models import DriverDocumentRequest


def latest_request(db, requirement_id):
    return db.scalar(
        select(DriverDocumentRequest)
        .where(DriverDocumentRequest.requirement_id == requirement_id)
        .order_by(DriverDocumentRequest.version.desc())
        .limit(1)
    )
