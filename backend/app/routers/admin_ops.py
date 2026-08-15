from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.admin_ops import ActivityLog, Setting
from app.models.people import Admin
from app.schemas.admin_ops import ActivityLogOut, SettingOut, SettingUpsertRequest

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("", response_model=list[SettingOut])
def list_settings(category: str | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    query = db.query(Setting)
    if category:
        query = query.filter(Setting.category == category)
    return query.all()


@settings_router.put("", response_model=SettingOut)
def upsert_setting(payload: SettingUpsertRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    setting = db.query(Setting).filter(Setting.category == payload.category, Setting.key == payload.key).first()
    if setting is None:
        setting = Setting(category=payload.category, key=payload.key, value=payload.value, description=payload.description, updated_by=admin.id)
    else:
        setting.value = payload.value
        setting.description = payload.description
        setting.updated_by = admin.id
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


activity_logs_router = APIRouter(prefix="/api/activity-logs", tags=["activity-logs"])


@activity_logs_router.get("", response_model=list[ActivityLogOut])
def list_activity_logs(limit: int = 50, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(ActivityLog).order_by(ActivityLog.id.desc()).limit(limit).all()
