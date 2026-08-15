from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Server is the sole authority on these lists — the frontend only reports a violation_type string,
# never a severity or "should suspend" flag. Anything outside these two sets is rejected with 400.
CONFIRMED_VIOLATIONS = (
    "COPY_ATTEMPT",
    "RIGHT_CLICK_ATTEMPT",
    "PRINT_ATTEMPT",
    "SAVE_ATTEMPT",
    "DEVTOOLS_SHORTCUT_ATTEMPT",
    "PRINTSCREEN_KEY_ATTEMPT",
    "PROTECTED_DOWNLOAD_ATTEMPT",
)
SUSPICIOUS_EVENTS = (
    "TAB_HIDDEN",
    "WINDOW_FOCUS_LOST",
    "FULLSCREEN_EXIT",
    "MULTIPLE_SESSION_CONFLICT",
    "SESSION_EXPIRED",
    "ASSESSMENT_WINDOW_LEFT",
)
ALL_VIOLATION_TYPES = CONFIRMED_VIOLATIONS + SUSPICIOUS_EVENTS
SEVERITIES = ("confirmed", "suspicious")
ASSESSMENT_TYPES = ("quiz", "coding_assignment", "project", "file_preview", "material")

VIOLATION_LABELS = {
    "COPY_ATTEMPT": "Copy attempt",
    "RIGHT_CLICK_ATTEMPT": "Right-click attempt",
    "PRINT_ATTEMPT": "Print attempt",
    "SAVE_ATTEMPT": "Save attempt",
    "DEVTOOLS_SHORTCUT_ATTEMPT": "Developer tools shortcut",
    "PRINTSCREEN_KEY_ATTEMPT": "Screenshot shortcut detected",
    "PROTECTED_DOWNLOAD_ATTEMPT": "Unauthorized download attempt",
}

ASSESSMENT_TYPE_LABELS = {
    "quiz": "Quiz",
    "coding_assignment": "Coding Assignment",
    "project": "Project",
    "material": "Learning Material",
    "file_preview": "Protected Document",
}


class WatermarkSession(Base):
    """One "viewing session" of protected content — created the moment a student opens a
    protected surface (MCQ/coding/project/quiz attempt, or a protected material/document), torn
    down when they leave. `session_code` is the short human-typeable code embedded in the
    watermark (e.g. "A8F2K91"): if a leaked screenshot/recording surfaces later, an admin can
    look this code up to identify exactly which student, which content, and when."""

    __tablename__ = "watermark_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    enrollment_id: Mapped[int | None] = mapped_column(ForeignKey("program_enrollments.id"))
    assessment_type: Mapped[str | None] = mapped_column(String(30))
    assessment_id: Mapped[int | None] = mapped_column(Integer)
    resource_id: Mapped[str | None] = mapped_column(String(100))
    route: Mapped[str | None] = mapped_column(String(300))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProctoringViolation(Base):
    __tablename__ = "proctoring_violations"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    enrollment_id: Mapped[int | None] = mapped_column(ForeignKey("program_enrollments.id"))
    assessment_type: Mapped[str | None] = mapped_column(String(30))
    assessment_id: Mapped[int | None] = mapped_column(Integer)
    attempt_id: Mapped[int | None] = mapped_column(Integer)
    resource_id: Mapped[str | None] = mapped_column(String(100))
    session_code: Mapped[str | None] = mapped_column(String(16), index=True)
    violation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)  # "confirmed" | "suspicious"
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    route: Mapped[str | None] = mapped_column(String(300))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    violation_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    admin_notes: Mapped[str | None] = mapped_column(Text)
