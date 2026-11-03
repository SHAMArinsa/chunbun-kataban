from datetime import date
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.schemas.portal_v2 import AcademicProgramOut


class EnrollmentAcademicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    program_id: int
    program: AcademicProgramOut
    start_date: date | None
    expected_end_date: date | None
    academic_status: str


class StudentAcademicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    institution: str | None = None
    degree: str | None = None
    enrollments: list[EnrollmentAcademicOut] = Field(default_factory=list)


class AcademicDashboardOut(BaseModel):
    total_students: int
    active_students: int
    completed_students: int
    pending_reviews: int


class InstructorCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)
    full_name: str = Field(min_length=1, max_length=150)


class InstructorUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool


class InstructorOut(BaseModel):
    id: int
    user_id: int
    email: str
    full_name: str
    is_active: bool
