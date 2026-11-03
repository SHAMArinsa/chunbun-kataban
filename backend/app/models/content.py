from datetime import date, datetime, time

from sqlalchemy import Boolean, CheckConstraint, UniqueConstraint, Date, DateTime, Enum, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

FILE_TYPES = ("pdf", "docx", "zip", "jpg", "jpeg", "png", "xlsx", "xls", "txt", "rar", "pptx", "ppt", "doc",
              "mp4", "webm", "mov", "m4v")
ASSIGNMENT_SCOPES = ("individual", "batch", "program")
LIVE_CLASS_STATUSES = ("scheduled", "completed", "cancelled")


class LearningMaterial(Base):
    __tablename__ = "learning_materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int | None] = mapped_column(ForeignKey("internship_programs.id"))
    domain_id: Mapped[int | None] = mapped_column(ForeignKey("program_domains.id"))
    week_number: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(String(500))
    file_type: Mapped[str | None] = mapped_column(Enum(*FILE_TYPES, name="material_file_type"))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    publication_state: Mapped[str] = mapped_column(String(20), server_default="published", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    content_type: Mapped[str] = mapped_column(String(20), server_default="file", nullable=False)
    resource_url: Mapped[str | None] = mapped_column(String(2000))
    is_platinum_exclusive: Mapped[bool] = mapped_column(Boolean, default=False)
    # Videos can sit inside a course chapter (Module > Chapter > Video) with a running time.
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("course_chapters.id", ondelete="SET NULL"), index=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    assignments: Mapped[list["MaterialAssignment"]] = relationship(back_populates="material", cascade="all, delete-orphan")


class MaterialAssignment(Base):
    __tablename__ = "material_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("learning_materials.id"), nullable=False)
    assignment_scope: Mapped[str] = mapped_column(Enum(*ASSIGNMENT_SCOPES, name="material_assignment_scope"), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"))
    program_id: Mapped[int | None] = mapped_column(ForeignKey("internship_programs.id"))
    assigned_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    material: Mapped["LearningMaterial"] = relationship(back_populates="assignments")

    __table_args__ = (
        CheckConstraint(
            "(student_id IS NOT NULL)::int + (batch_id IS NOT NULL)::int + (program_id IS NOT NULL)::int = 1",
            name="ck_material_assignment_exactly_one_target",
        ),
    )


class LiveClass(Base):
    __tablename__ = "live_classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), nullable=False)
    domain_id: Mapped[int | None] = mapped_column(ForeignKey("program_domains.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    instructor_name: Mapped[str] = mapped_column(String(150), nullable=False)
    meet_link: Mapped[str] = mapped_column(String(500), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    status: Mapped[str] = mapped_column(Enum(*LIVE_CLASS_STATUSES, name="live_class_status"), default="scheduled")
    created_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CourseModule(Base):
    """Top level of a program's video curriculum, e.g. "Module 1: Fundamentals of Programming"."""
    __tablename__ = "course_modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chapters: Mapped[list["CourseChapter"]] = relationship(back_populates="module", cascade="all, delete-orphan",
                                                          order_by="(CourseChapter.display_order, CourseChapter.id)")


class CourseChapter(Base):
    __tablename__ = "course_chapters"

    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("course_modules.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    module: Mapped["CourseModule"] = relationship(back_populates="chapters")


class MaterialView(Base):
    """First time a student opened a video — drives the "watched" eye and module completion %."""
    __tablename__ = "material_views"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("learning_materials.id", ondelete="CASCADE"), nullable=False)
    first_viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("student_id", "material_id", name="uq_material_view"),)
