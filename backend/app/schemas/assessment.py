from datetime import date, datetime

from pydantic import BaseModel


class QuizOut(BaseModel):
    id: int
    title: str
    program_id: int
    domain_id: int | None = None
    category: str | None = None
    week_number: int | None = None
    question_bank_size: int
    questions_per_attempt: int
    passing_percent: float
    max_attempts: int
    attempts_per_day: int
    time_limit_minutes: int
    is_active: bool

    class Config:
        from_attributes = True


class QuizCreateRequest(BaseModel):
    title: str
    program_id: int
    domain_id: int | None = None
    category: str | None = None
    week_number: int | None = None
    question_bank_size: int = 200
    questions_per_attempt: int = 20
    passing_percent: float = 80
    max_attempts: int = 5
    attempts_per_day: int = 1
    time_limit_minutes: int = 30


class QuizQuestionSheetOut(BaseModel):
    id: int
    quiz_id: int
    title: str
    question_count: int
    assigned_student_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class SheetUploadResult(BaseModel):
    sheet: QuizQuestionSheetOut
    rows_parsed: int
    rows_skipped: int


class SheetAssignRequest(BaseModel):
    student_ids: list[int]


class SheetAssignedStudentOut(BaseModel):
    student_id: int
    full_name: str
    email: str

    class Config:
        from_attributes = True


class QuizQuestionOut(BaseModel):
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str

    class Config:
        from_attributes = True


class QuizQuestionAdminOut(QuizQuestionOut):
    correct_option: str
    explanation: str | None = None


class QuizQuestionCreateRequest(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str | None = None


class QuizAttemptStartOut(BaseModel):
    attempt_id: int
    quiz_id: int
    time_limit_minutes: int
    questions: list[QuizQuestionOut]
    started_at: datetime


class QuizAnswerSubmit(BaseModel):
    question_id: int
    selected_option: str


class QuizSubmitRequest(BaseModel):
    answers: list[QuizAnswerSubmit]


class QuizAttemptResultOut(BaseModel):
    id: int
    quiz_id: int
    status: str
    total_questions: int
    correct_answers: int | None = None
    score_percent: float | None = None
    passed: bool | None = None
    submitted_at: datetime | None = None

    class Config:
        from_attributes = True


class CodingProblemOut(BaseModel):
    id: int
    problem_number: int
    title: str
    statement: str
    sample_input: str | None = None
    sample_output: str | None = None
    constraints: str | None = None

    class Config:
        from_attributes = True


class QuestionFileOut(BaseModel):
    sheet_id: int
    file_name: str


class CodingAssignmentOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    program_id: int
    domain_id: int | None = None
    week_number: int | None = None
    num_problems: int
    required_correct: int
    max_attempts: int
    attempts_per_day: int
    is_active: bool
    problems: list[CodingProblemOut] = []
    question_files: list[QuestionFileOut] = []
    has_resource: bool = False
    resource_file_name: str | None = None

    class Config:
        from_attributes = True


class CodingAssignmentCreateRequest(BaseModel):
    title: str
    description: str | None = None
    program_id: int
    domain_id: int | None = None
    week_number: int | None = None
    num_problems: int = 5
    required_correct: int = 4
    max_attempts: int = 5
    attempts_per_day: int = 1


class CodingProblemCreateRequest(BaseModel):
    problem_number: int
    title: str
    statement: str
    sample_input: str | None = None
    sample_output: str | None = None
    constraints: str | None = None


class CodingProblemSheetOut(BaseModel):
    id: int
    coding_assignment_id: int
    title: str
    due_date: date | None = None
    duration_minutes: int | None = None
    source_file_name: str | None = None
    problem_count: int
    assigned_student_count: int
    assigned_students: list[SheetAssignedStudentOut] = []
    created_at: datetime

    class Config:
        from_attributes = True


class CodingBulkUploadResult(BaseModel):
    sheets: list[CodingProblemSheetOut]
    total_problems_parsed: int
    total_problems_skipped: int
    files_skipped: int


class CodingAssignRequest(BaseModel):
    assignment_scope: str
    student_id: int | None = None
    batch_id: int | None = None
    program_id: int | None = None


class CodingAnswerSubmit(BaseModel):
    problem_id: int
    code_text: str | None = None
    is_correct: bool = False


class CodingSubmitRequest(BaseModel):
    answers: list[CodingAnswerSubmit]


class SubmissionFileOut(BaseModel):
    id: int
    file_path: str
    file_name: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class AssignmentSubmissionOut(BaseModel):
    id: int
    coding_assignment_id: int
    student_id: int
    attempt_number: int
    attempt_date: date
    started_at: datetime
    time_limit_minutes: int | None = None
    submitted_at: datetime | None = None
    status: str
    problems_correct: int | None = None
    passed: bool | None = None
    admin_feedback: str | None = None
    admin_marked_status: str | None = None
    files: list[SubmissionFileOut] = []

    class Config:
        from_attributes = True


class AttemptStartOut(BaseModel):
    submission_id: int
    attempt_number: int
    started_at: datetime
    time_limit_minutes: int | None = None
    deadline: datetime | None = None


class GradeSubmissionRequest(BaseModel):
    problems_correct: int | None = None
    passed: bool | None = None
    admin_feedback: str | None = None
    admin_marked_status: str | None = None


class SubmissionAnswerDetailOut(BaseModel):
    problem_id: int
    problem_number: int
    problem_title: str
    problem_statement: str
    code_text: str | None = None


class AssignmentSubmissionDetailOut(AssignmentSubmissionOut):
    student_full_name: str
    coding_assignment_title: str
    max_attempts: int | None = None
    answers: list[SubmissionAnswerDetailOut] = []


class StudentCodingStatusOut(BaseModel):
    student_id: int
    full_name: str
    email: str
    enrollment_status: str | None = None
    has_sheet: bool
    attempted: bool
    attempts_used: int
    max_attempts: int
    attempts_remaining: int
    locked: bool
    retake_granted: bool


class CodingRosterItemOut(BaseModel):
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
    highest_score_pct: float | None = None
    current_score_pct: float | None = None
    evaluation_status: str
    assigned_at: datetime | None = None
    submitted_at: datetime | None = None
    evaluator: str | None = None
    last_updated: datetime | None = None
    locked: bool
    retake_granted: bool
    has_sheet: bool
    latest_submission_id: int | None = None


class CodingRosterOut(BaseModel):
    total: int
    items: list[CodingRosterItemOut]
