from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.content import ASSIGNMENT_SCOPES

PROJECT_TYPES = ("mini", "industry", "end_to_end", "live_product", "capstone")
PROJECT_SUBMISSION_STATUSES = ("in_progress", "submitted", "under_review", "graded", "revision_requested")
PROJECT_REVIEW_OUTCOMES = ("closed", "retake")
PROJECT_MAX_ATTEMPTS = 5
EVALUATION_TYPES = ("quiz", "coding_assignment", "project", "performance", "mock_interview")
MOCK_INTERVIEW_RESULTS = ("pass", "fail", "pending")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    week_number: Mapped[int | None] = mapped_column(Integer)
    project_type: Mapped[str] = mapped_column(Enum(*PROJECT_TYPES, name="project_type"), nullable=False)
    instructions_file_path: Mapped[str | None] = mapped_column(String(500))
    instructions_file_name: Mapped[str | None] = mapped_column(String(300))
    created_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ProjectAssignment(Base):
    __tablename__ = "project_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    assignment_scope: Mapped[str] = mapped_column(Enum(*ASSIGNMENT_SCOPES, name="project_assignment_scope"), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"))
    program_id: Mapped[int | None] = mapped_column(ForeignKey("internship_programs.id"))
    assigned_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "(student_id IS NOT NULL)::int + (batch_id IS NOT NULL)::int + (program_id IS NOT NULL)::int = 1",
            name="ck_project_assignment_exactly_one_target",
        ),
    )


class ProjectStudentResource(Base):
    """A zip (or other allowed file type) admin uploads for one specific student against one
    project — e.g. tier-specific starter files or reference material handed out individually.
    Separate from ProjectAssignment (which only controls whether the student can see the project
    at all) and from ProjectSubmission (the student's own deliverable going the other way)."""

    __tablename__ = "project_student_resources"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_project_student_resources_project_student", "project_id", "student_id", unique=True),)


class ProjectSubmission(Base):
    __tablename__ = "project_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    submission_file_path: Mapped[str | None] = mapped_column(String(500))
    repo_link: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Enum(*PROJECT_SUBMISSION_STATUSES, name="project_submission_status"), default="in_progress")
    grade: Mapped[float | None] = mapped_column(Numeric(5, 2))
    feedback: Mapped[str | None] = mapped_column(Text)
    admin_marked_status: Mapped[str | None] = mapped_column(Enum(*PROJECT_REVIEW_OUTCOMES, name="project_review_outcome"))
    admin_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    graded_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"))
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), nullable=False)
    evaluation_type: Mapped[str] = mapped_column(Enum(*EVALUATION_TYPES, name="evaluation_type"), nullable=False)
    reference_table: Mapped[str] = mapped_column(String(100), nullable=False)
    reference_id: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    max_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    feedback: Mapped[str | None] = mapped_column(Text)
    evaluated_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MockInterview(Base):
    __tablename__ = "mock_interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    rounds: Mapped[dict] = mapped_column(JSONB, default=dict)
    overall_result: Mapped[str] = mapped_column(Enum(*MOCK_INTERVIEW_RESULTS, name="mock_interview_result"), default="pending")
    interviewer_name: Mapped[str | None] = mapped_column(String(150))
    feedback: Mapped[str | None] = mapped_column(Text)
    conducted_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
