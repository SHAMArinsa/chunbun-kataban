from datetime import datetime

from pydantic import BaseModel


class EvaluationOut(BaseModel):
    id: int
    student_id: int
    student_full_name: str
    enrollment_id: int
    evaluation_type: str
    reference_table: str
    reference_id: int
    reference_title: str | None = None
    program_id: int | None = None
    tier: str | None = None
    score: float | None = None
    max_score: float | None = None
    feedback: str | None = None
    evaluated_by: int
    evaluated_at: datetime

    class Config:
        from_attributes = True


class EvaluationCreateRequest(BaseModel):
    student_id: int
    enrollment_id: int
    evaluation_type: str
    score: float | None = None
    max_score: float | None = None
    feedback: str | None = None


class EvaluationRemarksUpdateRequest(BaseModel):
    feedback: str


class PendingReviewItem(BaseModel):
    kind: str  # "coding_assignment" | "project"
    submission_id: int
    student_id: int
    student_full_name: str
    tier: str | None = None
    title: str
    program_id: int
    file_name: str | None = None
    file_type: str | None = None
    submitted_at: datetime
    status: str
    is_read: bool = False


class PendingCountOut(BaseModel):
    coding_pending: int
    project_pending: int
    total_pending: int
