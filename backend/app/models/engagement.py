from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

CERTIFICATE_TYPES = (
    "welcome",
    "internship_completion",
    "project_completion",
    "performance_evaluation",
    "recommendation",
    "platinum",
    "experience",
)
NOTIFICATION_TYPES = ("info", "announcement", "alert", "evaluation", "certificate", "payment")
TICKET_CATEGORIES = ("technical", "payment", "content", "suspension", "other")
TICKET_STATUSES = ("open", "in_progress", "resolved", "closed")
TICKET_PRIORITIES = ("low", "medium", "high")
ATTENDANCE_STATUSES = ("present", "absent", "excused")


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), nullable=False)
    certificate_type: Mapped[str] = mapped_column(Enum(*CERTIFICATE_TYPES, name="certificate_type"), nullable=False)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    certificate_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    issued_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    issued_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StudentDocument(Base):
    """A document explicitly uploaded by an admin for one student.

    This intentionally does not generate files or send them by email.  Invoices
    and certificates are published only after the admin selects the student and
    uploads the final document.
    """
    __tablename__ = "student_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipient_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    recipient_role: Mapped[str | None] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(Enum(*NOTIFICATION_TYPES, name="notification_type"), default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    link_url: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Enum(*TICKET_CATEGORIES, name="ticket_category"), default="other")
    status: Mapped[str] = mapped_column(Enum(*TICKET_STATUSES, name="ticket_status"), default="open")
    priority: Mapped[str] = mapped_column(Enum(*TICKET_PRIORITIES, name="ticket_priority"), default="medium")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attachment_path: Mapped[str | None] = mapped_column(String(500))
    attachment_name: Mapped[str | None] = mapped_column(String(300))

    replies: Mapped[list["TicketReply"]] = relationship(back_populates="ticket", cascade="all, delete-orphan")


class TicketReply(Base):
    __tablename__ = "ticket_replies"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("support_tickets.id"), nullable=False)
    sender_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_path: Mapped[str | None] = mapped_column(String(500))
    attachment_name: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ticket: Mapped["SupportTicket"] = relationship(back_populates="replies")


class FAQ(Base):
    __tablename__ = "faqs"

    id: Mapped[int] = mapped_column(primary_key=True)
    question: Mapped[str] = mapped_column(String(300), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    live_class_id: Mapped[int] = mapped_column(ForeignKey("live_classes.id"), nullable=False)
    status: Mapped[str] = mapped_column(Enum(*ATTENDANCE_STATUSES, name="attendance_status"), default="present")
    joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    marked_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
