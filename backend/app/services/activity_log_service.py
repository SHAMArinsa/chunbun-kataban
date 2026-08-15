from sqlalchemy.orm import Session

from app.models.admin_ops import ActivityLog


def log_activity(
    db: Session,
    actor_user_id: int | None,
    actor_role: str | None,
    action: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    description: str | None = None,
) -> None:
    db.add(
        ActivityLog(
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
        )
    )
