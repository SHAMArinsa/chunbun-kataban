from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

PROGRAM_CODES = ("basic", "professional", "premium", "platinum")
DOMAIN_NAMES = ("python", "web_dev", "database", "ai", "genai", "software_engineering")
PHASES = ("phase1", "phase2")
MILESTONE_TYPES = ("assessment", "coding_test", "project", "live_class", "capstone", "mock_interview")
TRACK_NAMES = ("software_dev", "technical_support", "qa_testing", "devops")
ENROLLMENT_STATUSES = ("pending_payment", "active", "completed", "dropped", "suspended")
ACTIVE_ENROLLMENT_STATUSES = ("active", "completed")  # paid; grants portal content access
CURRENCIES = ("INR", "USD")
FEE_TYPES = ("gst", "platform_fee")
PAYMENT_STATUSES = ("pending", "paid", "failed", "refunded")


class InternshipProgram(Base):
    __tablename__ = "internship_programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(Enum(*PROGRAM_CODES, name="program_code"), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    duration_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    price_inr: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    price_usd: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    offer_price_inr: Mapped[float | None] = mapped_column(Numeric(10, 2))
    offer_price_usd: Mapped[float | None] = mapped_column(Numeric(10, 2))
    offer_start_date: Mapped[date | None] = mapped_column(Date)
    offer_end_date: Mapped[date | None] = mapped_column(Date)
    gst_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=18)
    platform_fee_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=10)
    features: Mapped[dict] = mapped_column(JSONB, default=dict)
    certificate_types: Mapped[dict] = mapped_column(JSONB, default=dict)
    default_quiz_pass_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=80)
    default_quiz_max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    default_quiz_attempts_per_day: Mapped[int] = mapped_column(Integer, default=1)
    default_coding_required_correct: Mapped[int] = mapped_column(Integer, default=4)
    default_coding_max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    domains: Mapped[list["ProgramDomain"]] = relationship(back_populates="program", cascade="all, delete-orphan")
    milestones: Mapped[list["ProgramMilestone"]] = relationship(back_populates="program", cascade="all, delete-orphan")


class ProgramDomain(Base):
    __tablename__ = "program_domains"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), nullable=False)
    name: Mapped[str] = mapped_column(Enum(*DOMAIN_NAMES, name="domain_name"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(Text)

    program: Mapped["InternshipProgram"] = relationship(back_populates="domains")


class ProgramMilestone(Base):
    __tablename__ = "program_milestones"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    phase: Mapped[str | None] = mapped_column(Enum(*PHASES, name="milestone_phase"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    milestone_type: Mapped[str] = mapped_column(Enum(*MILESTONE_TYPES, name="milestone_type"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    program: Mapped["InternshipProgram"] = relationship(back_populates="milestones")


class SpecializationTrack(Base):
    __tablename__ = "specialization_tracks"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Enum(*TRACK_NAMES, name="track_name"), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    program_id: Mapped[int | None] = mapped_column(ForeignKey("internship_programs.id"))
    cohort_start_date: Mapped[date | None] = mapped_column(Date)
    cohort_end_date: Mapped[date | None] = mapped_column(Date)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BatchMember(Base):
    __tablename__ = "batch_members"

    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), primary_key=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProgramEnrollment(Base):
    __tablename__ = "program_enrollments"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), nullable=False)
    specialization_track_id: Mapped[int | None] = mapped_column(ForeignKey("specialization_tracks.id"))
    status: Mapped[str] = mapped_column(Enum(*ENROLLMENT_STATUSES, name="enrollment_status"), default="pending_payment")
    suspension_reason: Mapped[str | None] = mapped_column(Text)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    start_date: Mapped[date | None] = mapped_column(Date)
    expected_end_date: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_week: Mapped[int] = mapped_column(Integer, default=1)
    current_phase: Mapped[str | None] = mapped_column(Enum(*PHASES, name="enrollment_phase"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    program: Mapped["InternshipProgram"] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="enrollment", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("student_id", "program_id", name="uq_student_program"),)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    currency: Mapped[str] = mapped_column(Enum(*CURRENCIES, name="payment_currency"), nullable=False)
    base_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    fee_type: Mapped[str] = mapped_column(Enum(*FEE_TYPES, name="payment_fee_type"), nullable=False)
    fee_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    fee_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(Enum(*PAYMENT_STATUSES, name="payment_status"), default="pending")
    payment_method: Mapped[str] = mapped_column(String(50), default="manual_offline")
    marked_paid_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    razorpay_order_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(100))
    razorpay_signature: Mapped[str | None] = mapped_column(String(255))
    invoice_number: Mapped[str | None] = mapped_column(String(16), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    enrollment: Mapped["ProgramEnrollment"] = relationship(back_populates="payments")
