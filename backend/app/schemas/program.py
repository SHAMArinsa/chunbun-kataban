from datetime import date, datetime

from pydantic import BaseModel, Field


class ProgramDomainOut(BaseModel):
    id: int
    name: str
    order_index: int
    description: str | None = None

    class Config:
        from_attributes = True


class ProgramMilestoneOut(BaseModel):
    id: int
    week_number: int
    phase: str | None = None
    title: str
    description: str | None = None
    milestone_type: str
    order_index: int

    class Config:
        from_attributes = True


class ProgramOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    duration_weeks: int
    price_inr: float
    price_usd: float
    offer_price_inr: float | None = None
    offer_price_usd: float | None = None
    offer_start_date: date | None = None
    offer_end_date: date | None = None
    gst_percent: float
    platform_fee_percent: float
    features: dict
    certificate_types: dict
    default_quiz_pass_percent: float
    default_quiz_max_attempts: int
    default_quiz_attempts_per_day: int
    default_coding_required_correct: int
    default_coding_max_attempts: int
    is_active: bool
    domains: list[ProgramDomainOut] = []
    milestones: list[ProgramMilestoneOut] = []

    class Config:
        from_attributes = True


class ProgramUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    duration_weeks: int | None = Field(default=None, gt=0)
    price_inr: float | None = Field(default=None, gt=0)
    price_usd: float | None = Field(default=None, gt=0)
    offer_price_inr: float | None = Field(default=None, gt=0)
    offer_price_usd: float | None = Field(default=None, gt=0)
    offer_start_date: date | None = None
    offer_end_date: date | None = None
    gst_percent: float | None = Field(default=None, ge=0)
    platform_fee_percent: float | None = Field(default=None, ge=0)
    features: dict | None = None
    certificate_types: dict | None = None
    default_quiz_pass_percent: float | None = None
    default_quiz_max_attempts: int | None = None
    default_quiz_attempts_per_day: int | None = None
    default_coding_required_correct: int | None = None
    default_coding_max_attempts: int | None = None
    is_active: bool | None = None


class SpecializationTrackOut(BaseModel):
    id: int
    name: str
    description: str | None = None

    class Config:
        from_attributes = True


class BatchOut(BaseModel):
    id: int
    name: str
    program_id: int | None = None
    cohort_start_date: date | None = None
    cohort_end_date: date | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchCreateRequest(BaseModel):
    name: str
    program_id: int | None = None
    cohort_start_date: date | None = None
    cohort_end_date: date | None = None
