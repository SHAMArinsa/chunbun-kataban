from datetime import datetime

from pydantic import BaseModel


class SettingOut(BaseModel):
    id: int
    category: str
    key: str
    value: str | None = None
    description: str | None = None
    updated_at: datetime

    class Config:
        from_attributes = True


class SettingUpsertRequest(BaseModel):
    category: str
    key: str
    value: str | None = None
    description: str | None = None


class ActivityLogOut(BaseModel):
    id: int
    actor_role: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: int | None = None
    description: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
