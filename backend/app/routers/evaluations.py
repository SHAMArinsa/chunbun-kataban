from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student
from app.models.assessment import AssignmentSubmission, CodingAssignment
from app.models.people import Admin, Student
from app.models.program import InternshipProgram
from app.models.project import Evaluation, Project, ProjectSubmission
from app.schemas.evaluation import (
    EvaluationCreateRequest,
    EvaluationOut,
    EvaluationRemarksUpdateRequest,
    PendingCountOut,
    PendingReviewItem,
)
from app.services.activity_log_service import log_activity

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])


def _reference_info(db: Session, evaluation: Evaluation) -> tuple[str | None, int | None]:
    """Returns (title, program_id) of whatever this evaluation is about."""
    if evaluation.reference_table == "assignment_submissions":
        submission = db.get(AssignmentSubmission, evaluation.reference_id)
        if submission:
            coding = db.get(CodingAssignment, submission.coding_assignment_id)
            return (coding.title, coding.program_id) if coding else (None, None)
    elif evaluation.reference_table == "project_submissions":
        submission = db.get(ProjectSubmission, evaluation.reference_id)
        if submission:
            project = db.get(Project, submission.project_id)
            return (project.title, project.program_id) if project else (None, None)
    return None, None


def _tier_for_program(db: Session, program_id: int | None) -> str | None:
    if program_id is None:
        return None
    program = db.get(InternshipProgram, program_id)
    return program.code if program else None


def _evaluation_out(db: Session, evaluation: Evaluation) -> EvaluationOut:
    student = db.get(Student, evaluation.student_id)
    title, program_id = _reference_info(db, evaluation)
    return EvaluationOut(
        id=evaluation.id, student_id=evaluation.student_id, student_full_name=student.full_name if student else "Unknown",
        enrollment_id=evaluation.enrollment_id, evaluation_type=evaluation.evaluation_type,
        reference_table=evaluation.reference_table, reference_id=evaluation.reference_id,
        reference_title=title, program_id=program_id, tier=_tier_for_program(db, program_id),
        score=evaluation.score, max_score=evaluation.max_score, feedback=evaluation.feedback,
        evaluated_by=evaluation.evaluated_by, evaluated_at=evaluation.evaluated_at,
    )


def _file_display_name(relative_path: str) -> str:
    stored_name = relative_path.rsplit("/", 1)[-1]
    return stored_name.split("_", 1)[1] if "_" in stored_name else stored_name


@router.get("/pending", response_model=list[PendingReviewItem])
def pending_reviews(search: str | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    items: list[PendingReviewItem] = []

    coding_rows = (
        db.query(AssignmentSubmission, CodingAssignment, Student)
        .join(CodingAssignment, CodingAssignment.id == AssignmentSubmission.coding_assignment_id)
        .join(Student, Student.id == AssignmentSubmission.student_id)
        .filter(AssignmentSubmission.status.in_(["submitted", "under_review"]))
        .all()
    )
    for submission, coding, student in coding_rows:
        items.append(PendingReviewItem(
            kind="coding_assignment", submission_id=submission.id, student_id=submission.student_id,
            student_full_name=student.full_name, tier=_tier_for_program(db, coding.program_id),
            title=coding.title, program_id=coding.program_id, file_name=None, file_type="code",
            submitted_at=submission.submitted_at, status=submission.status,
            is_read=submission.admin_viewed_at is not None,
        ))

    project_rows = (
        db.query(ProjectSubmission, Project, Student)
        .join(Project, Project.id == ProjectSubmission.project_id)
        .join(Student, Student.id == ProjectSubmission.student_id)
        .filter(ProjectSubmission.status.in_(["submitted", "under_review"]))
        .all()
    )
    for submission, project, student in project_rows:
        file_name = _file_display_name(submission.submission_file_path) if submission.submission_file_path else None
        file_type = file_name.rsplit(".", 1)[-1].lower() if file_name and "." in file_name else None
        items.append(PendingReviewItem(
            kind="project", submission_id=submission.id, student_id=submission.student_id,
            student_full_name=student.full_name, tier=_tier_for_program(db, project.program_id),
            title=project.title, program_id=project.program_id, file_name=file_name, file_type=file_type,
            submitted_at=submission.submitted_at, status=submission.status,
            is_read=submission.admin_viewed_at is not None,
        ))

    if search:
        needle = search.strip().lower()
        items = [
            i for i in items
            if needle in i.student_full_name.lower() or needle == str(i.student_id)
        ]

    return sorted(items, key=lambda i: i.submitted_at, reverse=True)


@router.get("/pending-count", response_model=PendingCountOut)
def pending_count(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    coding_pending = db.query(AssignmentSubmission).filter(AssignmentSubmission.status.in_(["submitted", "under_review"])).count()
    project_pending = db.query(ProjectSubmission).filter(ProjectSubmission.status.in_(["submitted", "under_review"])).count()
    return PendingCountOut(coding_pending=coding_pending, project_pending=project_pending, total_pending=coding_pending + project_pending)


@router.get("", response_model=list[EvaluationOut])
def list_evaluations(
    student_id: int | None = None,
    evaluation_type: str | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    query = db.query(Evaluation)
    if student_id:
        query = query.filter(Evaluation.student_id == student_id)
    if evaluation_type:
        query = query.filter(Evaluation.evaluation_type == evaluation_type)
    evaluations = query.order_by(Evaluation.id.desc()).all()
    return [_evaluation_out(db, e) for e in evaluations]


@router.get("/me", response_model=list[EvaluationOut])
def my_evaluations(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    evaluations = db.query(Evaluation).filter(Evaluation.student_id == student.id).order_by(Evaluation.id.desc()).all()
    return [_evaluation_out(db, e) for e in evaluations]


@router.post("", response_model=EvaluationOut, status_code=status.HTTP_201_CREATED)
def create_evaluation(payload: EvaluationCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    evaluation = Evaluation(**payload.model_dump(), reference_table="manual_entry", reference_id=0, evaluated_by=admin.id)
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return _evaluation_out(db, evaluation)


@router.get("/{evaluation_id}", response_model=EvaluationOut)
def get_evaluation(evaluation_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    evaluation = db.get(Evaluation, evaluation_id)
    if evaluation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evaluation not found")
    return _evaluation_out(db, evaluation)


@router.put("/{evaluation_id}/remarks", response_model=EvaluationOut)
def update_remarks(evaluation_id: int, payload: EvaluationRemarksUpdateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Lets admin add or edit remarks on an evaluation independent of (re-)grading — e.g. to
    follow up with a note after the fact."""
    evaluation = db.get(Evaluation, evaluation_id)
    if evaluation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evaluation not found")
    evaluation.feedback = payload.feedback
    db.add(evaluation)
    log_activity(db, admin.user_id, "admin", "update_evaluation_remarks", "evaluations", evaluation_id, None)
    db.commit()
    db.refresh(evaluation)
    return _evaluation_out(db, evaluation)
