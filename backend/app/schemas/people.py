from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class StudentOut(BaseModel):
    id: int
    student_number: str
    user_id: int
    full_name: str
    email: str
    phone: str | None = None
    dob: date | None = None
    gender: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    citizenship_status: str
    institution: str | None = None
    degree: str | None = None
    graduation_year: int | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    resume_path: str | None = None
    profile_photo_path: str | None = None
    national_id_type: str | None = None
    national_id_number: str | None = None
    national_id_document_front_name: str | None = None
    national_id_document_back_name: str | None = None
    national_id_verified: bool = False
    created_at: datetime
    enrollment_id: int | None = None
    program_id: int | None = None
    program_name: str | None = None
    program_code: str | None = None
    enrollment_status: str | None = None
    enrollment_start_date: date | None = None
    enrollment_end_date: date | None = None
    enrollment_suspension_reason: str | None = None

    class Config:
        from_attributes = True


class StudentUpdateRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    dob: date | None = None
    gender: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    institution: str | None = None
    degree: str | None = None
    graduation_year: int | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    national_id_type: str | None = Field(default=None, max_length=50)
    national_id_number: str | None = Field(default=None, max_length=50)

    @field_validator("national_id_type", "national_id_number", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        return v or None


class AdminOut(BaseModel):
    id: int
    user_id: int
    full_name: str
    designation: str | None = None
    department: str | None = None
    is_super_admin: bool = False
    email: str | None = None

    class Config:
        from_attributes = True


class AdminCreateRequest(BaseModel):
    email: str
    password: str
    full_name: str
    designation: str | None = None
    department: str | None = None
    is_super_admin: bool = False


class AdminUpdateRequest(BaseModel):
    is_super_admin: bool | None = None
