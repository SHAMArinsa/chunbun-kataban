from datetime import date, datetime

from pydantic import BaseModel


class MockInterviewOut(BaseModel):
    id: int
    enrollment_id: int
    scheduled_date: date
    rounds: dict
    overall_result: str
    interviewer_name: str | None = None
    feedback: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class MockInterviewCreateRequest(BaseModel):
    enrollment_id: int
    scheduled_date: date
    interviewer_name: str | None = None


class MockInterviewUpdateRequest(BaseModel):
    rounds: dict | None = None
    overall_result: str | None = None
    feedback: str | None = None
