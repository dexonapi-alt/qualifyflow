from app.models import AuditEvent


def record(db, actor, tenant_id, action, resource_id, correlation_id, **details):
    db.add(
        AuditEvent(
            actor_id=actor.id,
            tenant_id=tenant_id,
            action=action,
            resource_id=resource_id,
            correlation_id=correlation_id,
            details=details,
        )
    )
