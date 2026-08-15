from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ViolationReportRequest(BaseModel):
    """What the frontend is allowed to send. No severity/suspend flag is accepted from the
    client — those are decided entirely server-side in proctoring_service."""

    violation_type: str
    assessment_type: str | None = None
    assessment_id: int | None = None
    attempt_id: int | None = None
    resource_id: str | None = None
    session_code: str | None = None
    route: str | None = None
    metadata: dict = Field(default_factory=dict)

    @field_validator("resource_id", mode="before")
    @classmethod
    def _coerce_resource_id(cls, v):
        # Callers pass either a numeric ID (e.g. a material/project ID) or an arbitrary string
        # (e.g. a filename, in FilePreview's standalone fallback) — accept either rather than
        # rejecting perfectly legitimate numeric IDs with a 422.
        return str(v) if v is not None else None


class ViolationReportResponse(BaseModel):
    recorded: bool
    deduped: bool = False
    category: str
    suspended: bool = False


class ViolationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    enrollment_id: int | None
    assessment_type: str | None
    assessment_id: int | None
    attempt_id: int | None
    resource_id: str | None
    session_code: str | None
    violation_type: str
    category: str
    severity: str
    route: str | None
    user_agent: str | None
    created_at: datetime
    reviewed: bool
    reviewed_by: int | None
    reviewed_at: datetime | None
    admin_notes: str | None
    student_full_name: str | None = None
    student_email: str | None = None


class ViolationReviewRequest(BaseModel):
    reviewed: bool = True
    admin_notes: str | None = None


class ManualSuspendRequest(BaseModel):
    enrollment_id: int
    reason: str | None = None


class WatermarkSessionStartRequest(BaseModel):
    assessment_type: str | None = None
    assessment_id: int | None = None
    resource_id: str | None = None
    route: str | None = None

    @field_validator("resource_id", mode="before")
    @classmethod
    def _coerce_resource_id(cls, v):
        return str(v) if v is not None else None


class WatermarkSessionStartResponse(BaseModel):
    session_code: str
    started_at: datetime


class WatermarkSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_code: str
    student_id: int
    enrollment_id: int | None
    assessment_type: str | None
    assessment_id: int | None
    resource_id: str | None
    route: str | None
    ip_address: str | None
    started_at: datetime
    ended_at: datetime | None
    student_full_name: str | None = None
    student_email: str | None = None
    violation_count: int = 0
