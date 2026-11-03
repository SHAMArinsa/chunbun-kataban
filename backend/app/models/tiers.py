"""Tier-separated operational ("track") and evaluation tables (spec 9.11).

One track row per V2 enrollment holds that tier's workflow state; evaluation
rows are append-only history (a PostgreSQL trigger rejects UPDATE/DELETE), so
the latest row is the current evaluation and older rows are the audit trail.
Authentication, payments, notifications, certificates etc. stay shared.
"""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class _Track:
    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), unique=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), server_default="in_progress")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class _Mcq:
    mcq_score: Mapped[float | None] = mapped_column(Numeric(6, 2))
    mcq_max_score: Mapped[float | None] = mapped_column(Numeric(6, 2))
    mcq_passed: Mapped[bool | None] = mapped_column(Boolean)
    mcq_attempts: Mapped[int] = mapped_column(Integer, server_default="0")
    mcq_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    selection_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BasicTrack(_Track, _Mcq, Base):
    __tablename__ = "basic_tracks"
    project_status: Mapped[str] = mapped_column(String(30), server_default="not_selected")


class ProfessionalTrack(_Track, _Mcq, Base):
    __tablename__ = "professional_tracks"
    project1_status: Mapped[str] = mapped_column(String(30), server_default="not_selected")
    project2_status: Mapped[str] = mapped_column(String(30), server_default="not_selected")


class AdvancedTrack(_Track, Base):
    __tablename__ = "advanced_tracks"
    form_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_count: Mapped[int] = mapped_column(Integer, server_default="0")
    completed_count: Mapped[int] = mapped_column(Integer, server_default="0")


class CareerTrack(_Track, Base):
    __tablename__ = "career_tracks"
    form_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_count: Mapped[int] = mapped_column(Integer, server_default="0")
    completed_count: Mapped[int] = mapped_column(Integer, server_default="0")
    mock_interview_status: Mapped[str] = mapped_column(String(30), server_default="not_scheduled")


class AcceleratorTrack(_Track, Base):
    __tablename__ = "accelerator_tracks"
    internship_form_available_on: Mapped[date | None] = mapped_column(Date)
    form_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assignments_completed: Mapped[int] = mapped_column(Integer, server_default="0")
    projects_completed: Mapped[int] = mapped_column(Integer, server_default="0")
    mock_interviews_completed: Mapped[int] = mapped_column(Integer, server_default="0")
    internship_tasks_completed: Mapped[int] = mapped_column(Integer, server_default="0")
    eligibility_status: Mapped[str] = mapped_column(String(30), server_default="in_progress")


class _Evaluation:
    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    result: Mapped[str] = mapped_column(String(30), server_default="pending")
    remarks: Mapped[str | None] = mapped_column(Text)
    evaluator_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class BasicEvaluation(_Evaluation, Base):
    __tablename__ = "basic_evaluations"
    mcq_score: Mapped[float | None] = mapped_column(Numeric(6, 2))
    project_grade: Mapped[float | None] = mapped_column(Numeric(6, 2))


class ProfessionalEvaluation(_Evaluation, Base):
    __tablename__ = "professional_evaluations"
    mcq_score: Mapped[float | None] = mapped_column(Numeric(6, 2))
    project1_grade: Mapped[float | None] = mapped_column(Numeric(6, 2))
    project2_grade: Mapped[float | None] = mapped_column(Numeric(6, 2))


class AdvancedEvaluation(_Evaluation, Base):
    __tablename__ = "advanced_evaluations"
    form_review: Mapped[str | None] = mapped_column(String(30))
    work_quality: Mapped[int | None] = mapped_column(Integer)
    performance_rating: Mapped[int | None] = mapped_column(Integer)


class CareerEvaluation(_Evaluation, Base):
    __tablename__ = "career_evaluations"
    work_quality: Mapped[int | None] = mapped_column(Integer)
    performance_rating: Mapped[int | None] = mapped_column(Integer)
    mock_interview_rating: Mapped[int | None] = mapped_column(Integer)


class AcceleratorEvaluation(_Evaluation, Base):
    __tablename__ = "accelerator_evaluations"
    internship_performance: Mapped[int | None] = mapped_column(Integer)
    deadline_compliance: Mapped[str | None] = mapped_column(String(20))
    professional_conduct: Mapped[str | None] = mapped_column(String(20))
    integrity: Mapped[str | None] = mapped_column(String(20))
    confidentiality: Mapped[str | None] = mapped_column(String(20))
    eligibility_decision: Mapped[str | None] = mapped_column(String(30))


class StudentAdminNote(Base):
    __tablename__ = "student_admin_notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    author_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# program code -> tier key
TIER_BY_CODE = {"basic": "basic", "professional": "professional", "advanced": "advanced",
                "career": "career", "career_accelerator": "accelerator"}
TRACK_MODELS = {"basic": BasicTrack, "professional": ProfessionalTrack, "advanced": AdvancedTrack,
                "career": CareerTrack, "accelerator": AcceleratorTrack}
EVALUATION_MODELS = {"basic": BasicEvaluation, "professional": ProfessionalEvaluation, "advanced": AdvancedEvaluation,
                     "career": CareerEvaluation, "accelerator": AcceleratorEvaluation}
EVALUATION_FIELDS = {
    "basic": ("mcq_score", "project_grade"),
    "professional": ("mcq_score", "project1_grade", "project2_grade"),
    "advanced": ("form_review", "work_quality", "performance_rating"),
    "career": ("work_quality", "performance_rating", "mock_interview_rating"),
    "accelerator": ("internship_performance", "deadline_compliance", "professional_conduct", "integrity",
                    "confidentiality", "eligibility_decision"),
}
