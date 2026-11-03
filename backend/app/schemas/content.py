from datetime import date, datetime, time

from pydantic import BaseModel


class LearningMaterialOut(BaseModel):
    id: int
    program_id: int | None = None
    domain_id: int | None = None
    week_number: int | None = None
    title: str
    description: str | None = None
    file_type: str | None = None
    file_size_bytes: int | None = None
    content_type: str = "file"
    resource_url: str | None = None
    chapter_id: int | None = None
    duration_minutes: int | None = None
    display_order: int = 0
    publication_state: str = "published"
    is_platinum_exclusive: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MaterialAssignRequest(BaseModel):
    assignment_scope: str
    student_id: int | None = None
    batch_id: int | None = None
    program_id: int | None = None


class LiveClassOut(BaseModel):
    id: int
    program_id: int
    domain_id: int | None = None
    batch_id: int | None = None
    title: str
    description: str | None = None
    instructor_name: str
    meet_link: str
    scheduled_date: date
    start_time: time
    end_time: time
    status: str

    class Config:
        from_attributes = True


class LiveClassCreateRequest(BaseModel):
    program_id: int
    domain_id: int | None = None
    batch_id: int | None = None
    title: str
    description: str | None = None
    instructor_name: str
    meet_link: str
    scheduled_date: date
    start_time: time
    end_time: time


class LiveClassUpdateRequest(BaseModel):
    domain_id: int | None = None
    title: str | None = None
    description: str | None = None
    instructor_name: str | None = None
    meet_link: str | None = None
    scheduled_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    status: str | None = None


class MaterialUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    display_order: int | None = None
    publication_state: str | None = None  # "published" | "draft"
    resource_url: str | None = None
    chapter_id: int | None = None
    duration_minutes: int | None = None
