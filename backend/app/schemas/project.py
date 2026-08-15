from datetime import datetime

from pydantic import BaseModel


class ProjectOut(BaseModel):
    id: int
    program_id: int
    title: str
    description: str | None = None
    week_number: int | None = None
    project_type: str
    instructions_file_path: str | None = None
    instructions_file_name: str | None = None
    is_active: bool
    has_resource: bool = False
    resource_file_name: str | None = None

    class Config:
        from_attributes = True


class ProjectStudentResourceOut(BaseModel):
    id: int
    project_id: int
    student_id: int
    file_name: str
    file_size_bytes: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ProjectCreateRequest(BaseModel):
    program_id: int
    title: str
    description: str | None = None
    week_number: int | None = None
    project_type: str


class ProjectAssignRequest(BaseModel):
    assignment_scope: str
    student_id: int | None = None
    batch_id: int | None = None
    program_id: int | None = None


class ProjectSubmissionCreateRequest(BaseModel):
    repo_link: str | None = None
    description: str | None = None


class ProjectSubmissionOut(BaseModel):
    id: int
    project_id: int
    student_id: int
    submission_file_path: str | None = None
    repo_link: str | None = None
    description: str | None = None
    attempt_number: int
    started_at: datetime
    time_limit_minutes: int | None = None
    submitted_at: datetime | None = None
    status: str
    grade: float | None = None
    feedback: str | None = None
    admin_marked_status: str | None = None

    class Config:
        from_attributes = True


class ProjectAttemptStartOut(BaseModel):
    submission_id: int
    attempt_number: int
    started_at: datetime
    time_limit_minutes: int | None = None
    deadline: datetime | None = None


class ProjectGradeRequest(BaseModel):
    grade: float | None = None
    feedback: str | None = None
    status: str | None = None
    admin_marked_status: str | None = None


class ProjectSubmissionDetailOut(ProjectSubmissionOut):
    student_full_name: str
    project_title: str
    submission_file_name: str | None = None
    max_attempts: int | None = None


class ProjectRosterItemOut(BaseModel):
    student_id: int
    full_name: str
    email: str
    plan: str | None = None
    batch: str | None = None
    enrollment_status: str
    assignment_status: str
    attempts_used: int
    max_attempts: int
    attempts_remaining: int
    highest_score: float | None = None
    current_score: float | None = None
    evaluation_status: str
    assigned_at: datetime | None = None
    submitted_at: datetime | None = None
    evaluator: str | None = None
    last_updated: datetime | None = None
    locked: bool
    retake_granted: bool
    has_resource: bool
    latest_submission_id: int | None = None
    submission_file_name: str | None = None


class ProjectRosterOut(BaseModel):
    total: int
    items: list[ProjectRosterItemOut]
