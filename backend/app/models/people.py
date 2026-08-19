from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

CITIZENSHIP_VALUES = ("indian", "international")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_number: Mapped[str] = mapped_column(String(8), unique=True, nullable=False, server_default=text("generate_student_number()"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    dob: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    citizenship_status: Mapped[str] = mapped_column(
        Enum(*CITIZENSHIP_VALUES, name="citizenship_status"), nullable=False, default="indian"
    )
    institution: Mapped[str | None] = mapped_column(String(200))
    degree: Mapped[str | None] = mapped_column(String(150))
    graduation_year: Mapped[int | None] = mapped_column()
    github_url: Mapped[str | None] = mapped_column(String(255))
    linkedin_url: Mapped[str | None] = mapped_column(String(255))
    resume_path: Mapped[str | None] = mapped_column(String(500))
    profile_photo_path: Mapped[str | None] = mapped_column(String(500))
    national_id_type: Mapped[str | None] = mapped_column(String(50))
    national_id_number: Mapped[str | None] = mapped_column(String(50))
    national_id_document_front_path: Mapped[str | None] = mapped_column(String(500))
    national_id_document_front_name: Mapped[str | None] = mapped_column(String(300))
    national_id_document_back_path: Mapped[str | None] = mapped_column(String(500))
    national_id_document_back_name: Mapped[str | None] = mapped_column(String(300))
    national_id_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="student")  # noqa: F821

    @property
    def email(self) -> str:
        return self.user.email


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(150))
    department: Mapped[str | None] = mapped_column(String(150))
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="admin")  # noqa: F821
