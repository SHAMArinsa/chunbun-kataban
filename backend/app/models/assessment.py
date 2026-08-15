from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.content import ASSIGNMENT_SCOPES

OPTION_LETTERS = ("A", "B", "C", "D")
QUIZ_ATTEMPT_STATUSES = ("in_progress", "submitted", "auto_submitted", "expired")
SUBMISSION_STATUSES = ("in_progress", "submitted", "under_review", "graded")
REVIEW_OUTCOMES = ("closed", "retake")


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), nullable=False)
    domain_id: Mapped[int | None] = mapped_column(ForeignKey("program_domains.id"))
    # Set only for the six Platinum Program MCQ assessments. This is the stable upload/bank
    # category; unlike a question sheet it is shared by every eligible Platinum student.
    category: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    week_number: Mapped[int | None] = mapped_column(Integer)
    question_bank_size: Mapped[int] = mapped_column(Integer, default=200)
    questions_per_attempt: Mapped[int] = mapped_column(Integer, default=50)
    passing_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=80)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    attempts_per_day: Mapped[int] = mapped_column(Integer, default=1)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, default=60)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    questions: Mapped[list["QuizQuestion"]] = relationship(back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestionSheet(Base):
    """A named batch of MCQ questions admin bulk-uploaded (Excel) for a quiz. Used for the
    Platinum per-student assignment model: a student only draws from sheets assigned to them,
    not the quiz's whole question pool. Quizzes with no sheets (Basic/Professional/Premium,
    and any Platinum domain admin hasn't migrated yet) keep the original shared-pool behavior."""

    __tablename__ = "quiz_question_sheets"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    questions: Mapped[list["QuizQuestion"]] = relationship(back_populates="sheet", cascade="all, delete-orphan")


class QuizSheetAssignment(Base):
    __tablename__ = "quiz_sheet_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    sheet_id: Mapped[int] = mapped_column(ForeignKey("quiz_question_sheets.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    assigned_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_quiz_sheet_assignments_sheet_student", "sheet_id", "student_id", unique=True),)


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id"), nullable=False)
    sheet_id: Mapped[int | None] = mapped_column(ForeignKey("quiz_question_sheets.id"))
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    option_a: Mapped[str] = mapped_column(Text, nullable=False)
    option_b: Mapped[str] = mapped_column(Text, nullable=False)
    option_c: Mapped[str] = mapped_column(Text, nullable=False)
    option_d: Mapped[str] = mapped_column(Text, nullable=False)
    correct_option: Mapped[str] = mapped_column(Enum(*OPTION_LETTERS, name="quiz_option_letter"), nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    quiz: Mapped["Quiz"] = relationship(back_populates="questions")
    sheet: Mapped["QuizQuestionSheet"] = relationship(back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    attempt_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Enum(*QUIZ_ATTEMPT_STATUSES, name="quiz_attempt_status"), default="in_progress")
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_answers: Mapped[int | None] = mapped_column(Integer)
    score_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    passed: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    answers: Mapped[list["QuizAttemptAnswer"]] = relationship(back_populates="attempt", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_quiz_attempts_quiz_student_date", "quiz_id", "student_id", "attempt_date"),
    )


class QuizAttemptAnswer(Base):
    __tablename__ = "quiz_attempt_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("quiz_attempts.id"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("quiz_questions.id"), nullable=False)
    selected_option: Mapped[str | None] = mapped_column(Enum(*OPTION_LETTERS, name="quiz_answer_option_letter"))
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    attempt: Mapped["QuizAttempt"] = relationship(back_populates="answers")


class CodingAssignment(Base):
    __tablename__ = "coding_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), nullable=False)
    domain_id: Mapped[int | None] = mapped_column(ForeignKey("program_domains.id"))
    week_number: Mapped[int | None] = mapped_column(Integer)
    num_problems: Mapped[int] = mapped_column(Integer, default=5)
    required_correct: Mapped[int] = mapped_column(Integer, default=4)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    attempts_per_day: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    problems: Mapped[list["CodingProblem"]] = relationship(back_populates="coding_assignment", cascade="all, delete-orphan")


class CodingProblemSheet(Base):
    """A named batch of coding problems admin bulk-uploaded (.docx/.txt) for a coding assignment.
    Used for the Platinum per-student assignment model: a student only sees problems from
    sheets assigned to them. Coding assignments with no sheets (Basic/Professional/Premium, and
    any Platinum domain admin hasn't migrated yet) keep the original shared-pool behavior."""

    __tablename__ = "coding_problem_sheets"

    id: Mapped[int] = mapped_column(primary_key=True)
    coding_assignment_id: Mapped[int] = mapped_column(ForeignKey("coding_assignments.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    source_file_path: Mapped[str | None] = mapped_column(String(500))
    source_file_name: Mapped[str | None] = mapped_column(String(300))
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    problems: Mapped[list["CodingProblem"]] = relationship(back_populates="sheet", cascade="all, delete-orphan")


class CodingSheetAssignment(Base):
    __tablename__ = "coding_sheet_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    sheet_id: Mapped[int] = mapped_column(ForeignKey("coding_problem_sheets.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    assigned_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_coding_sheet_assignments_sheet_student", "sheet_id", "student_id", unique=True),)


class CodingProblem(Base):
    __tablename__ = "coding_problems"

    id: Mapped[int] = mapped_column(primary_key=True)
    coding_assignment_id: Mapped[int] = mapped_column(ForeignKey("coding_assignments.id"), nullable=False)
    sheet_id: Mapped[int | None] = mapped_column(ForeignKey("coding_problem_sheets.id"))
    problem_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    sample_input: Mapped[str | None] = mapped_column(Text)
    sample_output: Mapped[str | None] = mapped_column(Text)
    constraints: Mapped[str | None] = mapped_column(Text)

    coding_assignment: Mapped["CodingAssignment"] = relationship(back_populates="problems")
    sheet: Mapped["CodingProblemSheet"] = relationship(back_populates="problems")


class CodingAssignmentAssignment(Base):
    __tablename__ = "coding_assignment_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    coding_assignment_id: Mapped[int] = mapped_column(ForeignKey("coding_assignments.id"), nullable=False)
    assignment_scope: Mapped[str] = mapped_column(Enum(*ASSIGNMENT_SCOPES, name="coding_assignment_scope"), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"))
    program_id: Mapped[int | None] = mapped_column(ForeignKey("internship_programs.id"))
    assigned_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "(student_id IS NOT NULL)::int + (batch_id IS NOT NULL)::int + (program_id IS NOT NULL)::int = 1",
            name="ck_coding_assignment_exactly_one_target",
        ),
    )


class CodingStudentResource(Base):
    __tablename__ = "coding_student_resources"

    id: Mapped[int] = mapped_column(primary_key=True)
    coding_assignment_id: Mapped[int] = mapped_column(ForeignKey("coding_assignments.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("admins.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_coding_student_resources_assignment_student", "coding_assignment_id", "student_id", unique=True),)


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    coding_assignment_id: Mapped[int] = mapped_column(ForeignKey("coding_assignments.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    attempt_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Enum(*SUBMISSION_STATUSES, name="assignment_submission_status"), default="in_progress")
    problems_correct: Mapped[int | None] = mapped_column(Integer)
    passed: Mapped[bool | None] = mapped_column(Boolean)
    admin_feedback: Mapped[str | None] = mapped_column(Text)
    admin_marked_status: Mapped[str | None] = mapped_column(Enum(*REVIEW_OUTCOMES, name="submission_review_outcome"))
    admin_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    graded_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"))
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    answers: Mapped[list["AssignmentSubmissionAnswer"]] = relationship(back_populates="submission", cascade="all, delete-orphan")
    files: Mapped[list["AssignmentSubmissionFile"]] = relationship(back_populates="submission", cascade="all, delete-orphan")


class AssignmentSubmissionAnswer(Base):
    __tablename__ = "assignment_submission_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("assignment_submissions.id"), nullable=False)
    problem_id: Mapped[int] = mapped_column(ForeignKey("coding_problems.id"), nullable=False)
    code_text: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(String(500))
    is_correct: Mapped[bool | None] = mapped_column(Boolean)

    submission: Mapped["AssignmentSubmission"] = relationship(back_populates="answers")


class AssignmentSubmissionFile(Base):
    """One uploaded answer file for a coding attempt (doc/xlsx/zip/pdf/image) — separate from the
    older per-problem `code_text` answers, since a timed file-upload attempt isn't tied to any
    one problem."""

    __tablename__ = "assignment_submission_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("assignment_submissions.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    submission: Mapped["AssignmentSubmission"] = relationship(back_populates="files")
