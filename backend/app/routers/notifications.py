from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_user
from app.models.auth import User
from app.models.engagement import Notification
from app.models.people import Admin
from app.schemas.engagement import BroadcastRequest, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_my_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role_name = user.role.name
    return (
        db.query(Notification)
        .filter(or_(Notification.recipient_user_id == user.id, Notification.recipient_role == role_name, Notification.recipient_role == "all"))
        .order_by(Notification.id.desc())
        .all()
    )


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role_name = user.role.name
    count = (
        db.query(Notification)
        .filter(
            or_(Notification.recipient_user_id == user.id, Notification.recipient_role == role_name, Notification.recipient_role == "all"),
            Notification.is_read.is_(False),
        )
        .count()
    )
    return {"unread_count": count}


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.is_read = True
    db.add(notification)
    db.commit()
    return None


@router.post("/broadcast", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def broadcast(payload: BroadcastRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    notification = Notification(
        recipient_user_id=None,
        recipient_role=payload.recipient_role,
        title=payload.title,
        message=payload.message,
        notification_type=payload.notification_type,
        link_url=payload.link_url,
        created_by=admin.id,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
