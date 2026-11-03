from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_admin, require_academic_role
from app.models.auth import User
from app.models.engagement import Notification
from app.models.portal_v2 import NotificationReceipt
from app.models.people import Admin
from app.schemas.engagement import BroadcastRequest, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _visible(db: Session, user: User):
    # A direct recipient takes precedence; its role never broadens delivery.
    query = db.query(Notification).filter(or_(Notification.recipient_user_id == user.id,
        and_(Notification.recipient_user_id.is_(None), Notification.recipient_role.in_((user.role.name, "all")))))
    if user.role.name == "instructor":
        query = query.filter(Notification.notification_type.in_(("evaluation", "certificate")))
    return query


def _out(db: Session, row: Notification, user: User) -> NotificationOut:
    receipt = db.get(NotificationReceipt, (row.id, user.id))
    read = receipt.read_at is not None if receipt else bool(row.recipient_user_id == user.id and row.is_read)
    if user.role.name == "instructor":
        # Legacy free-form notifications have no trustworthy sensitivity label.
        return NotificationOut(id=row.id, title="Academic notification", message="An academic update is available.",
            notification_type=row.notification_type, is_read=read, link_url=None, created_at=row.created_at)
    result = NotificationOut.model_validate(row)
    result.is_read = read
    return result


@router.get("", response_model=list[NotificationOut])
def list_my_notifications(db: Session = Depends(get_db), user: User = Depends(require_academic_role)):
    return [_out(db, row, user) for row in _visible(db, user).order_by(Notification.id.desc()).all()]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), user: User = Depends(require_academic_role)):
    return {"unread_count": sum(not _out(db, row, user).is_read for row in _visible(db, user).all())}


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(require_academic_role)):
    if _visible(db, user).filter(Notification.id == notification_id).first() is None:
        raise HTTPException(404, "Notification not found")
    statement = insert(NotificationReceipt).values(notification_id=notification_id, user_id=user.id, read_at=datetime.now(timezone.utc))
    db.execute(statement.on_conflict_do_update(index_elements=["notification_id", "user_id"], set_={"read_at": statement.excluded.read_at}))
    db.commit()


@router.post("/broadcast", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def broadcast(payload: BroadcastRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    if payload.recipient_role not in ("student", "admin", "instructor", "all"):
        raise HTTPException(422, "Unsupported recipient role")
    row = Notification(**payload.model_dump(), created_by=admin.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
