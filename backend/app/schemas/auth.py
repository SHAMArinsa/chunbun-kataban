from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.names import proper_name


class StudentRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    full_name: str = Field(min_length=2, max_length=150)
    phone: str | None = None
    citizenship_status: str = Field(default="indian", pattern="^(indian|international)$")
    country: str | None = None
    dob: date | None = None
    national_id_type: str = Field(min_length=1, max_length=50)
    national_id_number: str = Field(min_length=1, max_length=50)

    @field_validator("full_name")
    @classmethod
    def _proper_name(cls, v: str) -> str:
        return proper_name(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class EmailOtpSendRequest(BaseModel):
    email: EmailStr


class EmailOtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int


class RoleOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class UserMeOut(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    full_name: str | None = None
    is_super_admin: bool = False
    permissions: list[str] | None = None
    student_id: int | None = None
    student_number: str | None = None
    national_id_type: str | None = None
    national_id_number: str | None = None

    class Config:
        from_attributes = True


class PasswordForgotRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=100)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=100)
