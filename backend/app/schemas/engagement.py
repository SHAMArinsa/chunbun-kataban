from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    link_url: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class BroadcastRequest(BaseModel):
    title: str
    message: str
    notification_type: str = "announcement"
    recipient_role: str = "student"  # "student" | "admin" | "all"
    link_url: str | None = None


class TicketReplyOut(BaseModel):
    id: int
    sender_user_id: int
    sender_name: str | None = None
    sender_role: str | None = None
    message: str
    attachment_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class SupportTicketOut(BaseModel):
    id: int
    student_id: int
    student_full_name: str | None = None
    student_email: str | None = None
    subject: str
    description: str
    category: str
    status: str
    priority: str
    attachment_name: str | None = None
    created_at: datetime
    updated_at: datetime
    replies: list[TicketReplyOut] = []

    class Config:
        from_attributes = True


class SupportTicketCreateRequest(BaseModel):
    subject: str
    description: str
    category: str = "other"
    priority: str = "medium"


class SupportTicketUpdateRequest(BaseModel):
    status: str | None = None
    priority: str | None = None


class TicketReplyCreateRequest(BaseModel):
    message: str


class FAQOut(BaseModel):
    id: int
    question: str
    answer: str
    category: str | None = None

    class Config:
        from_attributes = True


class FAQCreateRequest(BaseModel):
    question: str
    answer: str
    category: str | None = None


class AttendanceOut(BaseModel):
    id: int
    student_id: int
    live_class_id: int
    status: str
    joined_at: datetime | None = None

    class Config:
        from_attributes = True


class AttendanceMarkRequest(BaseModel):
    student_id: int
    live_class_id: int
    status: str
