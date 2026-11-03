"""V2 validation contracts only; no routes or authorization changes in Phase 1."""
from typing import Literal
from datetime import date
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


class AcademicProgramOut(BaseModel):
    """Intentionally contains no prices, offers, taxes or payment references."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    description: str | None = None
    duration: int | None = None
    duration_unit: Literal['weeks', 'months', 'years'] | None = None
    duration_weeks: int
    is_active: bool


class ProgramOfferConfig(BaseModel):
    offer_enabled: bool = False
    offer_start_at: AwareDatetime | None = None
    offer_end_at: AwareDatetime | None = None
    offer_price_inr: float | None = Field(default=None, gt=0)
    offer_price_usd: float | None = Field(default=None, gt=0)

    @model_validator(mode='after')
    def validate_window(self):
        if self.offer_enabled and any(v is None for v in (
            self.offer_start_at, self.offer_end_at, self.offer_price_inr, self.offer_price_usd
        )):
            raise ValueError('Enabled offers require aware start/end timestamps and both prices')
        if self.offer_start_at and self.offer_end_at and self.offer_end_at <= self.offer_start_at:
            raise ValueError('Offer end must follow start')
        return self


class ProjectSelectionInput(BaseModel):
    enrollment_id: int = Field(gt=0)
    project_id: int = Field(gt=0)
    slot: int = Field(ge=1, le=2)
    # Tier, owner and project/program equality are database checks, not trusted inputs.


class AccessExtensionInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    previous_end_date: date | None = None
    new_end_date: date
    reason: str = Field(min_length=1)

    @model_validator(mode='after')
    def validate_dates(self):
        if self.previous_end_date and self.new_end_date <= self.previous_end_date:
            raise ValueError('An extension must end after the previous end date')
        return self


class ReviewEventInput(BaseModel):
    project_submission_id: int | None = Field(default=None, gt=0)
    assignment_submission_id: int | None = Field(default=None, gt=0)
    evaluation_id: int | None = Field(default=None, gt=0)
    internship_form_id: int | None = Field(default=None, gt=0)
    resume_version_id: int | None = Field(default=None, gt=0)
    previous_status: str | None = None
    new_status: str = Field(min_length=1, max_length=30)
    feedback: str | None = None
    score: float | None = None
    decision: str = Field(min_length=1, max_length=50)
    reason: str | None = None

    @model_validator(mode='after')
    def one_target(self):
        if sum(v is not None for v in (self.project_submission_id, self.assignment_submission_id,
                self.evaluation_id, self.internship_form_id, self.resume_version_id)) != 1:
            raise ValueError('A review must reference exactly one persisted target')
        return self
