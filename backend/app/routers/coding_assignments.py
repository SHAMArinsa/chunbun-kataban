from datetime import date, datetime, timezone
import mimetypes

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student, require_any_role, require_unsuspended_student
from app.core.config import settings
from app.models.assessment import (
    AssignmentSubmission,
    AssignmentSubmissionAnswer,
    AssignmentSubmissionFile,
    CodingAssignment,
    CodingAssignmentAssignment,
    CodingProblem,
    CodingProblemSheet,
    CodingSheetAssignment,
    CodingStudentResource,
)
from app.models.auth import User
from app.models.people import Admin, Student
from app.models.program import Batch, BatchMember, InternshipProgram, ProgramEnrollment
from app.models.project import Evaluation
from app.schemas.assessment import (
    AssignmentSubmissionDetailOut,
    AssignmentSubmissionOut,
    AttemptStartOut,
    CodingAssignmentCreateRequest,
    CodingAssignmentOut,
    CodingAssignRequest,
    CodingBulkUploadResult,
    CodingProblemCreateRequest,
    CodingProblemOut,
    CodingProblemSheetOut,
    CodingRosterItemOut,
    CodingRosterOut,
    CodingSubmitRequest,
    GradeSubmissionRequest,
    QuestionFileOut,
    SheetAssignedStudentOut,
    SheetAssignRequest,
    StudentCodingStatusOut,
    SubmissionAnswerDetailOut,
)
from app.services.activity_log_service import log_activity
from app.services.assignment_visibility import visible_ids_for_student
from app.services.coding_service import check_submission_eligibility, start_attempt, visible_problems_for_student
from app.services.coding_sheet_service import extract_text_from_upload, parse_coding_problems, parse_zip_of_problems
from app.services.notification_service import notify_students, student_ids_for_assignment_scope
from app.services.storage import delete as delete_file, download_response, save
from app.utils.file_validation import read_and_validate_upload

router = APIRouter(prefix="/api/coding-assignments", tags=["coding-assignments"])


def _student_scoped_out(db: Session, coding: CodingAssignment, problems: list[CodingProblem], resource: CodingStudentResource | None = None) -> CodingAssignmentOut:
    sheet_ids = {p.sheet_id for p in problems if p.sheet_id is not None}
    question_files = []
    if sheet_ids:
        sheets = db.query(CodingProblemSheet).filter(CodingProblemSheet.id.in_(sheet_ids), CodingProblemSheet.source_file_name.isnot(None)).all()
        question_files = [QuestionFileOut(sheet_id=s.id, file_name=s.source_file_name) for s in sheets]
    return CodingAssignmentOut(
        id=coding.id, title=coding.title, description=coding.description, program_id=coding.program_id,
        domain_id=coding.domain_id, week_number=coding.week_number, num_problems=coding.num_problems,
        required_correct=coding.required_correct, max_attempts=coding.max_attempts, attempts_per_day=coding.attempts_per_day,
        is_active=coding.is_active, problems=[CodingProblemOut.model_validate(p) for p in problems],
        question_files=question_files,
        has_resource=resource is not None, resource_file_name=resource.file_name if resource else None,
    )


def _is_coding_ready_for_student(db: Session, coding: CodingAssignment, student_id: int) -> bool:
    """A coding item becomes visible only after the admin uploads a question file and
    assigns that uploaded sheet to this specific student."""
    has_question = (
        db.query(CodingProblemSheet.id)
        .join(CodingSheetAssignment, CodingSheetAssignment.sheet_id == CodingProblemSheet.id)
        .join(CodingProblem, CodingProblem.sheet_id == CodingProblemSheet.id)
        .filter(
            CodingProblemSheet.coding_assignment_id == coding.id,
            CodingSheetAssignment.student_id == student_id,
            CodingProblemSheet.source_file_path.isnot(None),
        )
        .first()
        is not None
    )
    has_resource = db.query(CodingStudentResource.id).filter(CodingStudentResource.coding_assignment_id == coding.id, CodingStudentResource.student_id == student_id).first() is not None
    return has_question and has_resource


@router.post("", response_model=CodingAssignmentOut, status_code=status.HTTP_201_CREATED)
def create_coding_assignment(payload: CodingAssignmentCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    coding = CodingAssignment(**payload.model_dump(), created_by=admin.id)
    db.add(coding)
    log_activity(db, admin.user_id, "admin", "create_coding_assignment", "coding_assignments", None, payload.title)
    db.commit()
    db.refresh(coding)
    return coding


@router.post("/{coding_id}/problems", response_model=CodingProblemOut, status_code=status.HTTP_201_CREATED)
def add_problem(coding_id: int, payload: CodingProblemCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    coding = db.get(CodingAssignment, coding_id)
    if coding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not found")
    problem = CodingProblem(coding_assignment_id=coding_id, **payload.model_dump())
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return problem


@router.post("/{coding_id}/problems/upload", response_model=CodingBulkUploadResult, status_code=status.HTTP_201_CREATED)
async def upload_problem_sheets(
    coding_id: int,
    files: list[UploadFile] = File(...),
    title: str | None = Form(None),
    due_date: date | None = Form(None),
    duration_minutes: int | None = Form(None),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Bulk-uploads coding problems: each .docx/.pdf/.txt file becomes its own sheet (named after
    the file, or after `title` when exactly one file/zip-entry is uploaded), and a .zip is expanded
    into one sheet per .docx/.pdf/.txt file inside it. New sheets are always added alongside any
    existing ones — nothing is replaced. `due_date`/`duration_minutes` are informational, stamped
    on every sheet created in this call.

    Basic/Professional/Premium (coding.domain_id is None): no manual assignment needed — each
    student is automatically locked to one random sheet from the batch the first time they open
    their Coding Work (see visible_problems_for_student). Platinum (domain_id set): admin must
    explicitly assign each sheet to chosen students via POST /sheets/{sheet_id}/assign."""
    coding = db.get(CodingAssignment, coding_id)
    if coding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not found")

    existing_count = db.query(CodingProblem).filter(CodingProblem.coding_assignment_id == coding_id).count()
    sheets_out: list[CodingProblemSheetOut] = []
    total_parsed = 0
    total_skipped = 0
    files_skipped = 0

    def make_sheet(label: str, rows: list[dict], raw_content: bytes, source_filename: str) -> None:
        nonlocal existing_count
        source_file_path = save(raw_content, "coding_problem_sheets", source_filename)
        sheet = CodingProblemSheet(
            coding_assignment_id=coding_id, title=label, uploaded_by=admin.id,
            due_date=due_date, duration_minutes=duration_minutes,
            source_file_path=source_file_path, source_file_name=source_filename,
        )
        db.add(sheet)
        db.flush()
        for i, row in enumerate(rows):
            db.add(CodingProblem(coding_assignment_id=coding_id, sheet_id=sheet.id, problem_number=existing_count + i + 1, **row))
        existing_count += len(rows)
        sheets_out.append(CodingProblemSheetOut(
            id=sheet.id, coding_assignment_id=sheet.coding_assignment_id, title=sheet.title,
            due_date=sheet.due_date, duration_minutes=sheet.duration_minutes, source_file_name=sheet.source_file_name,
            problem_count=len(rows), assigned_student_count=0, created_at=sheet.created_at,
        ))

    for f in files:
        content = await f.read()
        name = f.filename or "upload"
        if name.lower().endswith(".zip"):
            entries, skipped_files = parse_zip_of_problems(content)
            files_skipped += skipped_files
            for label, rows, skipped, raw_bytes, original_name in entries:
                make_sheet(label, rows, raw_bytes, original_name)
                total_parsed += len(rows)
                total_skipped += skipped
        else:
            label = name.rsplit(".", 1)[0]
            text = extract_text_from_upload(name, content)
            rows, skipped = parse_coding_problems(text, fallback_title=label)
            make_sheet(label, rows, content, name)
            total_parsed += len(rows)
            total_skipped += skipped

    if title and len(sheets_out) == 1:
        sheet = db.get(CodingProblemSheet, sheets_out[0].id)
        sheet.title = title
        db.add(sheet)
        sheets_out[0] = CodingProblemSheetOut(**{**sheets_out[0].model_dump(), "title": title})

    log_activity(db, admin.user_id, "admin", "upload_coding_problems", "coding_assignments", coding_id, f"{len(sheets_out)} sheet(s), {total_parsed} problems")
    db.commit()

    return CodingBulkUploadResult(sheets=sheets_out, total_problems_parsed=total_parsed, total_problems_skipped=total_skipped, files_skipped=files_skipped)


@router.get("/{coding_id}/sheets", response_model=list[CodingProblemSheetOut])
def list_problem_sheets(coding_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    sheets = db.query(CodingProblemSheet).filter(CodingProblemSheet.coding_assignment_id == coding_id).order_by(CodingProblemSheet.id.desc()).all()
    out = []
    for sheet in sheets:
        problem_count = db.query(CodingProblem).filter(CodingProblem.sheet_id == sheet.id).count()
        assigned_rows = (
            db.query(Student.id, Student.full_name, User.email)
            .join(CodingSheetAssignment, CodingSheetAssignment.student_id == Student.id)
            .join(User, User.id == Student.user_id)
            .filter(CodingSheetAssignment.sheet_id == sheet.id)
            .all()
        )
        assigned_students = [SheetAssignedStudentOut(student_id=r[0], full_name=r[1], email=r[2]) for r in assigned_rows]
        out.append(CodingProblemSheetOut(
            id=sheet.id, coding_assignment_id=sheet.coding_assignment_id, title=sheet.title,
            due_date=sheet.due_date, duration_minutes=sheet.duration_minutes, source_file_name=sheet.source_file_name,
            problem_count=problem_count, assigned_student_count=len(assigned_students),
            assigned_students=assigned_students, created_at=sheet.created_at,
        ))
    return out


def _authorize_sheet_access(db: Session, sheet: CodingProblemSheet, user) -> None:
    if user.role.name != "student":
        return
    student_row = db.query(Student).filter(Student.user_id == user.id).first()
    if student_row is not None:
        require_unsuspended_student(student_row, db)
    assigned = student_row and db.query(CodingSheetAssignment).filter(
        CodingSheetAssignment.sheet_id == sheet.id,
        CodingSheetAssignment.student_id == student_row.id,
    ).first()
    if not assigned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This question document is not assigned to you")


@router.get("/sheets/{sheet_id}/download")
def download_sheet_source_file(sheet_id: int, db: Session = Depends(get_db), user=Depends(require_any_role)):
    sheet = db.get(CodingProblemSheet, sheet_id)
    if sheet is None or not sheet.source_file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No source file available for this sheet")
    _authorize_sheet_access(db, sheet, user)

    media_type, _ = mimetypes.guess_type(sheet.source_file_name or sheet.source_file_path)
    return download_response(sheet.source_file_path, sheet.source_file_name or "coding-problem-sheet", media_type or "application/octet-stream")




def _locked_student_ids(db: Session, coding_assignment_id: int, student_ids: list[int]) -> set[int]:
    """A student is locked out of receiving a (re)assigned sheet once they've attempted this
    coding assignment, unless an admin has granted them a retake from the Evaluations page."""
    locked = set()
    for student_id in student_ids:
        latest = (
            db.query(AssignmentSubmission)
            .filter(AssignmentSubmission.coding_assignment_id == coding_assignment_id, AssignmentSubmission.student_id == student_id)
            .order_by(AssignmentSubmission.id.desc())
            .first()
        )
        if latest is not None and latest.admin_marked_status != "retake":
            locked.add(student_id)
    return locked


@router.get("/{coding_id}/student-status", response_model=list[StudentCodingStatusOut])
def coding_student_status(coding_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    coding = db.get(CodingAssignment, coding_id)
    if coding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not found")

    students = (
        db.query(Student, User.email, ProgramEnrollment.status)
        .join(User, User.id == Student.user_id)
        .join(ProgramEnrollment, ProgramEnrollment.student_id == Student.id)
        .filter(ProgramEnrollment.program_id == coding.program_id)
        .all()
    )

    sheet_ids_with_problems = {
        row.student_id
        for row in db.query(CodingSheetAssignment.student_id)
        .join(CodingProblemSheet, CodingProblemSheet.id == CodingSheetAssignment.sheet_id)
        .filter(CodingProblemSheet.coding_assignment_id == coding_id)
    }

    latest_by_student: dict[int, AssignmentSubmission] = {}
    attempts_used_by_student: dict[int, int] = {}
    for sub in (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.coding_assignment_id == coding_id)
        .order_by(AssignmentSubmission.id.desc())
        .all()
    ):
        latest_by_student.setdefault(sub.student_id, sub)
        attempts_used_by_student[sub.student_id] = attempts_used_by_student.get(sub.student_id, 0) + 1

    out = []
    for student, email, enrollment_status in students:
        latest = latest_by_student.get(student.id)
        attempted = latest is not None
        retake_granted = attempted and latest.admin_marked_status == "retake"
        attempts_used = attempts_used_by_student.get(student.id, 0)
        attempts_remaining = max(0, coding.max_attempts - attempts_used)
        out.append(StudentCodingStatusOut(
            student_id=student.id, full_name=student.full_name, email=email, enrollment_status=enrollment_status,
            has_sheet=student.id in sheet_ids_with_problems, attempted=attempted,
            attempts_used=attempts_used, max_attempts=coding.max_attempts, attempts_remaining=attempts_remaining,
            locked=attempted and not retake_granted, retake_granted=retake_granted,
        ))
    return out


ATTEMPTS_REMAINING_BUCKETS = {"3": lambda r: r >= 3, "2": lambda r: r == 2, "1": lambda r: r == 1, "0": lambda r: r == 0}


@router.get("/{coding_id}/roster", response_model=CodingRosterOut)
def coding_roster(
    coding_id: int,
    search: str | None = None,
    internship_status: str | None = None,
    assessment_status: str | None = None,
    attempts_remaining: str | None = None,
    evaluation_status: str | None = None,
    score_min: float | None = None,
    score_max: float | None = None,
    sort_by: str = "full_name",
    sort_dir: str = "asc",
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Full enterprise roster for one coding assignment: every enrolled student, always visible,
    with derived assignment/evaluation status, attempt counts, and scores. Filtering, search,
    sorting and pagination all happen here so the admin never has to hunt across pages of cards.
    Note: for the scale in the spec (10k+ students) this would want status/score materialized as
    real columns with DB indexes rather than derived in Python on every request — acceptable for
    the per-program cohort sizes this product actually has today."""
    coding = db.get(CodingAssignment, coding_id)
    if coding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not found")
    program = db.get(InternshipProgram, coding.program_id)
    plan_code = program.code if program else None

    enrolled = (
        db.query(Student, User.email, ProgramEnrollment.status)
        .join(User, User.id == Student.user_id)
        .join(ProgramEnrollment, ProgramEnrollment.student_id == Student.id)
        .filter(ProgramEnrollment.program_id == coding.program_id)
        .all()
    )

    batch_by_student = {
        row.student_id: row.name
        for row in db.query(BatchMember.student_id, Batch.name).join(Batch, Batch.id == BatchMember.batch_id)
    }

    assignment_rows = db.query(CodingAssignmentAssignment).filter(CodingAssignmentAssignment.coding_assignment_id == coding_id).all()
    individually_assigned = {r.student_id for r in assignment_rows if r.assignment_scope == "individual"}
    assigned_batch_ids = {r.batch_id for r in assignment_rows if r.assignment_scope == "batch"}
    program_wide_assigned = any(r.assignment_scope == "program" for r in assignment_rows)
    batch_ids_by_student: dict[int, set[int]] = {}
    for row in db.query(BatchMember.student_id, BatchMember.batch_id):
        batch_ids_by_student.setdefault(row.student_id, set()).add(row.batch_id)

    sheet_ids_with_problems = {
        row.student_id
        for row in db.query(CodingSheetAssignment.student_id)
        .join(CodingProblemSheet, CodingProblemSheet.id == CodingSheetAssignment.sheet_id)
        .filter(CodingProblemSheet.coding_assignment_id == coding_id)
    }

    subs_by_student: dict[int, list[AssignmentSubmission]] = {}
    for sub in (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.coding_assignment_id == coding_id)
        .order_by(AssignmentSubmission.id.asc())
        .all()
    ):
        subs_by_student.setdefault(sub.student_id, []).append(sub)

    evaluator_names: dict[int, str] = {}
    grader_ids = {s.graded_by for subs in subs_by_student.values() for s in subs if s.graded_by}
    if grader_ids:
        for a in db.query(Admin).filter(Admin.id.in_(grader_ids)):
            evaluator_names[a.id] = a.full_name

    items: list[CodingRosterItemOut] = []
    for student, email, enrollment_status in enrolled:
        is_assigned = (
            student.id in individually_assigned
            or bool(batch_ids_by_student.get(student.id, set()) & assigned_batch_ids)
            or program_wide_assigned
        )
        has_sheet = student.id in sheet_ids_with_problems
        subs = subs_by_student.get(student.id, [])
        latest = subs[-1] if subs else None
        attempts_used = len(subs)
        attempts_remaining_n = max(0, coding.max_attempts - attempts_used)
        retake_granted = latest is not None and latest.admin_marked_status == "retake"
        locked = latest is not None and not retake_granted

        scores = [100 * s.problems_correct / coding.num_problems for s in subs if s.problems_correct is not None and coding.num_problems]
        highest_score_pct = max(scores) if scores else None
        current_score_pct = (100 * latest.problems_correct / coding.num_problems) if latest and latest.problems_correct is not None and coding.num_problems else None

        if latest is None:
            assignment_status = "assigned" if (is_assigned or has_sheet) else "not_assigned"
            evaluation_status = "pending"
        elif latest.admin_marked_status == "closed":
            assignment_status = "passed"
            evaluation_status = "evaluated"
        elif latest.admin_marked_status == "retake":
            assignment_status = "retake_assigned"
            evaluation_status = "evaluated"
        elif latest.status == "in_progress":
            assignment_status = "in_progress"
            evaluation_status = "pending"
        elif latest.status == "under_review":
            assignment_status = "under_evaluation"
            evaluation_status = "needs_review"
        elif latest.status == "submitted":
            assignment_status = "submitted"
            evaluation_status = "pending"
        elif latest.status == "graded":
            evaluation_status = "evaluated"
            assignment_status = "failed" if latest.passed is False and attempts_remaining_n == 0 else "evaluated"
        else:
            assignment_status = "assigned"
            evaluation_status = "pending"

        items.append(CodingRosterItemOut(
            student_id=student.id, full_name=student.full_name, email=email,
            plan=plan_code, batch=batch_by_student.get(student.id), enrollment_status=enrollment_status,
            assignment_status=assignment_status, attempts_used=attempts_used, max_attempts=coding.max_attempts,
            attempts_remaining=attempts_remaining_n, highest_score_pct=highest_score_pct, current_score_pct=current_score_pct,
            evaluation_status=evaluation_status,
            assigned_at=subs[0].started_at if subs else None,
            submitted_at=latest.submitted_at if latest else None,
            evaluator=evaluator_names.get(latest.graded_by) if latest and latest.graded_by else None,
            last_updated=(latest.graded_at or latest.submitted_at or latest.started_at) if latest else None,
            locked=locked, retake_granted=retake_granted, has_sheet=has_sheet,
            latest_submission_id=latest.id if latest else None,
        ))

    if search:
        needle = search.strip().lower()
        items = [i for i in items if needle in i.full_name.lower() or needle in i.email.lower() or needle == str(i.student_id)]
    if internship_status:
        items = [i for i in items if i.enrollment_status == internship_status]
    if assessment_status:
        items = [i for i in items if i.assignment_status == assessment_status]
    if attempts_remaining and attempts_remaining in ATTEMPTS_REMAINING_BUCKETS:
        items = [i for i in items if ATTEMPTS_REMAINING_BUCKETS[attempts_remaining](i.attempts_remaining)]
    if evaluation_status:
        items = [i for i in items if i.evaluation_status == evaluation_status]
    if score_min is not None:
        items = [i for i in items if i.current_score_pct is not None and i.current_score_pct >= score_min]
    if score_max is not None:
        items = [i for i in items if i.current_score_pct is not None and i.current_score_pct <= score_max]

    reverse = sort_dir == "desc"
    sort_key_map = {
        "full_name": lambda i: i.full_name.lower(),
        "email": lambda i: i.email.lower(),
        "highest_score": lambda i: i.highest_score_pct if i.highest_score_pct is not None else -1,
        "current_score": lambda i: i.current_score_pct if i.current_score_pct is not None else -1,
        "submitted_at": lambda i: i.submitted_at or datetime.min.replace(tzinfo=timezone.utc),
        "assigned_at": lambda i: i.assigned_at or datetime.min.replace(tzinfo=timezone.utc),
        "attempts_remaining": lambda i: i.attempts_remaining,
        "status": lambda i: i.assignment_status,
        "evaluator": lambda i: i.evaluator or "",
    }
    items.sort(key=sort_key_map.get(sort_by, sort_key_map["full_name"]), reverse=reverse)

    total = len(items)
    return CodingRosterOut(total=total, items=items[skip:skip + limit])


@router.post("/sheets/{sheet_id}/assign", status_code=status.HTTP_201_CREATED)
def assign_problem_sheet(sheet_id: int, payload: SheetAssignRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    sheet = db.get(CodingProblemSheet, sheet_id)
    if sheet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sheet not found")

    locked = _locked_student_ids(db, sheet.coding_assignment_id, payload.student_ids)
    if locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{len(locked)} selected student(s) have already attempted this assignment. Enable a retake for them from Evaluations before assigning new questions.",
        )

    existing = {
        row.student_id
        for row in db.query(CodingSheetAssignment.student_id).filter(CodingSheetAssignment.sheet_id == sheet_id, CodingSheetAssignment.student_id.in_(payload.student_ids))
    }
    # A student should only ever have one active question set for a given coding assignment —
    # assigning a new/different sheet (e.g. changing the question for a retake) replaces whatever
    # sheet(s) they had before under this same assignment, rather than layering problems together.
    db.query(CodingSheetAssignment).filter(
        CodingSheetAssignment.student_id.in_(payload.student_ids),
        CodingSheetAssignment.sheet_id != sheet_id,
        CodingSheetAssignment.sheet_id.in_(
            db.query(CodingProblemSheet.id).filter(CodingProblemSheet.coding_assignment_id == sheet.coding_assignment_id)
        ),
    ).delete(synchronize_session=False)

    added = 0
    for student_id in payload.student_ids:
        if student_id in existing:
            continue
        db.add(CodingSheetAssignment(sheet_id=sheet_id, student_id=student_id, assigned_by=admin.id))
        added += 1

    newly_assigned_ids = [sid for sid in payload.student_ids if sid not in existing]
    coding = db.get(CodingAssignment, sheet.coding_assignment_id)
    notify_students(
        db, newly_assigned_ids,
        title="New coding problems assigned",
        message=f'New problems have been assigned for "{coding.title if coding else sheet.title}".',
        notification_type="info",
        link_url="/coding",
    )
    log_activity(db, admin.user_id, "admin", "assign_coding_sheet", "coding_problem_sheets", sheet_id, f"Assigned to {added} student(s)")
    db.commit()
    return {"status": "assigned", "newly_assigned": added, "already_assigned": len(existing)}


@router.get("/sheets/{sheet_id}/assignments", response_model=list[SheetAssignedStudentOut])
def list_sheet_assignments(sheet_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = (
        db.query(Student.id, Student.full_name, User.email)
        .join(CodingSheetAssignment, CodingSheetAssignment.student_id == Student.id)
        .join(User, User.id == Student.user_id)
        .filter(CodingSheetAssignment.sheet_id == sheet_id)
        .all()
    )
    return [SheetAssignedStudentOut(student_id=r[0], full_name=r[1], email=r[2]) for r in rows]


@router.get("/sheets/{sheet_id}/problems", response_model=list[CodingProblemOut])
def get_sheet_problems(sheet_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    sheet = db.get(CodingProblemSheet, sheet_id)
    if sheet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sheet not found")
    return db.query(CodingProblem).filter(CodingProblem.sheet_id == sheet_id).order_by(CodingProblem.problem_number).all()


@router.delete("/sheets/{sheet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_problem_sheet(sheet_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    sheet = db.get(CodingProblemSheet, sheet_id)
    if sheet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sheet not found")

    used = (
        db.query(AssignmentSubmissionAnswer)
        .join(CodingProblem, CodingProblem.id == AssignmentSubmissionAnswer.problem_id)
        .filter(CodingProblem.sheet_id == sheet_id)
        .first()
    )
    if used is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This sheet has already been used in a student's submission and cannot be deleted",
        )

    title = sheet.title
    source_file_path = sheet.source_file_path
    db.query(CodingSheetAssignment).filter(CodingSheetAssignment.sheet_id == sheet_id).delete(synchronize_session=False)
    db.delete(sheet)
    log_activity(db, admin.user_id, "admin", "delete_coding_sheet", "coding_problem_sheets", sheet_id, title)
    db.commit()
    if source_file_path:
        delete_file(source_file_path)
    return None


@router.post("/{coding_id}/assign", status_code=status.HTTP_201_CREATED)
def assign_coding(coding_id: int, payload: CodingAssignRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    coding = db.get(CodingAssignment, coding_id)
    if coding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not found")
    targets = [payload.student_id, payload.batch_id, payload.program_id]
    if sum(1 for t in targets if t is not None) != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exactly one of student_id/batch_id/program_id must be set")
    db.add(CodingAssignmentAssignment(coding_assignment_id=coding_id, assignment_scope=payload.assignment_scope, student_id=payload.student_id, batch_id=payload.batch_id, program_id=payload.program_id, assigned_by=admin.id))
    student_ids = student_ids_for_assignment_scope(db, payload.student_id, payload.batch_id, payload.program_id)
    notify_students(
        db, student_ids,
        title="New coding assignment assigned",
        message=f'"{coding.title}" has been assigned to you.',
        notification_type="info",
        link_url="/coding",
    )
    db.commit()
    return {"status": "assigned"}


@router.post("/{coding_id}/assign-students", status_code=status.HTTP_201_CREATED)
def assign_coding_to_students(coding_id: int, payload: SheetAssignRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Grants individual students visibility into this coding assignment (separate from which
    sheet/problems they end up with — see the sheet-assignment endpoints for that)."""
    coding = db.get(CodingAssignment, coding_id)
    if coding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not found")

    existing = {
        row.student_id
        for row in db.query(CodingAssignmentAssignment.student_id).filter(
            CodingAssignmentAssignment.coding_assignment_id == coding_id,
            CodingAssignmentAssignment.assignment_scope == "individual",
            CodingAssignmentAssignment.student_id.in_(payload.student_ids),
        )
    }
    added = 0
    for student_id in payload.student_ids:
        if student_id in existing:
            continue
        db.add(CodingAssignmentAssignment(coding_assignment_id=coding_id, assignment_scope="individual", student_id=student_id, assigned_by=admin.id))
        added += 1

    newly_assigned_ids = [sid for sid in payload.student_ids if sid not in existing]
    notify_students(
        db, newly_assigned_ids,
        title="New coding assignment assigned",
        message=f'"{coding.title}" has been assigned to you.',
        notification_type="info",
        link_url="/coding",
    )
    log_activity(db, admin.user_id, "admin", "assign_coding_students", "coding_assignments", coding_id, f"Assigned to {added} student(s)")
    db.commit()
    return {"status": "assigned", "newly_assigned": added, "already_assigned": len(existing)}


@router.get("/{coding_id}/assigned-students", response_model=list[SheetAssignedStudentOut])
def list_assigned_students(coding_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = (
        db.query(Student.id, Student.full_name, User.email)
        .join(CodingAssignmentAssignment, CodingAssignmentAssignment.student_id == Student.id)
        .join(User, User.id == Student.user_id)
        .filter(CodingAssignmentAssignment.coding_assignment_id == coding_id, CodingAssignmentAssignment.assignment_scope == "individual")
        .all()
    )
    return [SheetAssignedStudentOut(student_id=r[0], full_name=r[1], email=r[2]) for r in rows]


@router.post("/{coding_id}/students/{student_id}/resource", status_code=status.HTTP_201_CREATED)
async def upload_student_resource(coding_id: int, student_id: int, file: UploadFile, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    coding, student = db.get(CodingAssignment, coding_id), db.get(Student, student_id)
    if coding is None or student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment or student not found")
    content, _ = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    relative_path = save(content, "coding_student_resources", file.filename)
    resource = db.query(CodingStudentResource).filter(CodingStudentResource.coding_assignment_id == coding_id, CodingStudentResource.student_id == student_id).first()
    if resource:
        previous_path = resource.file_path
        resource.file_path, resource.file_name, resource.file_size_bytes, resource.uploaded_by = relative_path, file.filename, len(content), admin.id
    else:
        previous_path = None
        resource = CodingStudentResource(coding_assignment_id=coding_id, student_id=student_id, file_path=relative_path, file_name=file.filename, file_size_bytes=len(content), uploaded_by=admin.id)
        db.add(resource)
    db.commit()
    if previous_path:
        delete_file(previous_path)
    return {"file_name": resource.file_name}


@router.get("/{coding_id}/resource/download")
def download_my_resource(coding_id: int, db: Session = Depends(get_db), student: Student = Depends(require_unsuspended_student)):
    resource = db.query(CodingStudentResource).filter(CodingStudentResource.coding_assignment_id == coding_id, CodingStudentResource.student_id == student.id).first()
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No supporting file has been uploaded for you")
    return download_response(resource.file_path, resource.file_name)


@router.get("", response_model=list[CodingAssignmentOut])
def list_coding_assignments(db: Session = Depends(get_db), role_user=Depends(require_any_role)):
    if role_user.role.name == "admin":
        return db.query(CodingAssignment).filter(CodingAssignment.is_active.is_(True)).order_by(CodingAssignment.id.desc()).all()

    student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
    if student_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    visible_ids = visible_ids_for_student(db, student_row, CodingAssignmentAssignment, "coding_assignment_id")
    if not visible_ids:
        return []
    codings = (
        db.query(CodingAssignment)
        .filter(CodingAssignment.is_active.is_(True), CodingAssignment.id.in_(visible_ids))
        .order_by(CodingAssignment.id.desc())
        .all()
    )
    return [
        _student_scoped_out(db, c, visible_problems_for_student(db, c, student_row.id), db.query(CodingStudentResource).filter(CodingStudentResource.coding_assignment_id == c.id, CodingStudentResource.student_id == student_row.id).first())
        for c in codings
        if _is_coding_ready_for_student(db, c, student_row.id)
    ]


@router.get("/submissions/me", response_model=list[AssignmentSubmissionOut])
def my_submissions(coding_id: int | None = None, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    query = db.query(AssignmentSubmission).filter(AssignmentSubmission.student_id == student.id)
    if coding_id:
        query = query.filter(AssignmentSubmission.coding_assignment_id == coding_id)
    return query.order_by(AssignmentSubmission.id.desc()).all()


@router.get("/submissions", response_model=list[AssignmentSubmissionOut])
def list_submissions(status_filter: str | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    query = db.query(AssignmentSubmission)
    if status_filter:
        query = query.filter(AssignmentSubmission.status == status_filter)
    return query.order_by(AssignmentSubmission.id.desc()).all()


@router.get("/submissions/{submission_id}", response_model=AssignmentSubmissionDetailOut)
def get_submission_detail(submission_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    submission = db.get(AssignmentSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    if submission.admin_viewed_at is None:
        submission.admin_viewed_at = datetime.now(timezone.utc)
        db.add(submission)
        db.commit()
        db.refresh(submission)
    student = db.get(Student, submission.student_id)

    answers = db.query(AssignmentSubmissionAnswer).filter(AssignmentSubmissionAnswer.submission_id == submission_id).all()
    answer_details = []
    for ans in answers:
        problem = db.get(CodingProblem, ans.problem_id)
        if problem is None:
            continue
        answer_details.append(SubmissionAnswerDetailOut(
            problem_id=problem.id, problem_number=problem.problem_number, problem_title=problem.title,
            problem_statement=problem.statement, code_text=ans.code_text,
        ))
    answer_details.sort(key=lambda a: a.problem_number)

    coding = db.get(CodingAssignment, submission.coding_assignment_id)
    return AssignmentSubmissionDetailOut(
        id=submission.id, coding_assignment_id=submission.coding_assignment_id, student_id=submission.student_id,
        student_full_name=student.full_name if student else "Unknown",
        coding_assignment_title=coding.title if coding else "Unknown",
        attempt_number=submission.attempt_number, started_at=submission.started_at,
        time_limit_minutes=submission.time_limit_minutes,
        attempt_date=submission.attempt_date, submitted_at=submission.submitted_at, status=submission.status,
        problems_correct=submission.problems_correct, passed=submission.passed, admin_feedback=submission.admin_feedback,
        admin_marked_status=submission.admin_marked_status, answers=answer_details,
        files=submission.files,
        max_attempts=coding.max_attempts if coding else None,
    )


@router.get("/submissions/{submission_id}/files/{file_id}/download")
def download_submission_file(submission_id: int, file_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    file_row = db.get(AssignmentSubmissionFile, file_id)
    if file_row is None or file_row.submission_id != submission_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return download_response(file_row.file_path, file_row.file_name)


@router.put("/submissions/{submission_id}/grade", response_model=AssignmentSubmissionOut)
def grade_submission(submission_id: int, payload: GradeSubmissionRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    submission = db.get(AssignmentSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(submission, field, value)
    submission.status = "graded"
    submission.graded_by = admin.id
    submission.graded_at = datetime.now(timezone.utc)
    db.add(submission)

    coding = db.get(CodingAssignment, submission.coding_assignment_id)
    enrollment = (
        db.query(ProgramEnrollment)
        .filter(ProgramEnrollment.student_id == submission.student_id, ProgramEnrollment.program_id == coding.program_id)
        .first()
    )
    if enrollment:
        db.add(Evaluation(
            student_id=submission.student_id,
            enrollment_id=enrollment.id,
            evaluation_type="coding_assignment",
            reference_table="assignment_submissions",
            reference_id=submission.id,
            score=submission.problems_correct,
            max_score=coding.num_problems,
            feedback=submission.admin_feedback,
            evaluated_by=admin.id,
        ))

    notify_students(
        db, [submission.student_id],
        title="Coding submission graded",
        message=f'Your submission for "{coding.title}" has been graded.',
        notification_type="evaluation",
        link_url="/coding",
    )
    log_activity(db, admin.user_id, "admin", "grade_coding_submission", "assignment_submissions", submission.id, None)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{coding_id}", response_model=CodingAssignmentOut)
def get_coding_assignment(coding_id: int, db: Session = Depends(get_db), role_user=Depends(require_any_role)):
    coding = db.get(CodingAssignment, coding_id)
    if coding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not found")
    if role_user.role.name == "admin":
        return coding
    student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
    if student_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    visible_ids = visible_ids_for_student(db, student_row, CodingAssignmentAssignment, "coding_assignment_id")
    if not coding.is_active or coding.id not in visible_ids or not _is_coding_ready_for_student(db, coding, student_row.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not assigned to you")
    resource = db.query(CodingStudentResource).filter(CodingStudentResource.coding_assignment_id == coding.id, CodingStudentResource.student_id == student_row.id).first()
    return _student_scoped_out(db, coding, visible_problems_for_student(db, coding, student_row.id), resource)


@router.post("/{coding_id}/submit", response_model=AssignmentSubmissionOut, status_code=status.HTTP_201_CREATED)
def submit_coding(coding_id: int, payload: CodingSubmitRequest, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    coding = db.get(CodingAssignment, coding_id)
    if coding is None or not coding.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not found or inactive")
    visible_ids = visible_ids_for_student(db, student, CodingAssignmentAssignment, "coding_assignment_id")
    if coding.id not in visible_ids or not _is_coding_ready_for_student(db, coding, student.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not assigned to you")
    allowed_problem_ids = {p.id for p in visible_problems_for_student(db, coding, student.id)}
    if not allowed_problem_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No problems have been assigned to you yet for this coding assignment — contact your administrator.")
    if any(ans.problem_id not in allowed_problem_ids for ans in payload.answers):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="One or more submitted problems are not assigned to you")

    attempt_number = check_submission_eligibility(db, coding, student.id)

    submission = AssignmentSubmission(
        coding_assignment_id=coding.id,
        student_id=student.id,
        attempt_number=attempt_number,
        status="submitted",
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(submission)
    db.flush()

    for ans in payload.answers:
        db.add(AssignmentSubmissionAnswer(submission_id=submission.id, problem_id=ans.problem_id, code_text=ans.code_text))

    db.commit()
    db.refresh(submission)
    return submission


@router.post("/{coding_id}/start", response_model=AttemptStartOut, status_code=status.HTTP_201_CREATED)
def start_coding_attempt(coding_id: int, db: Session = Depends(get_db), student: Student = Depends(require_unsuspended_student)):
    """Called when the student clicks "View" — starts (or resumes) an attempt. Coding assignments
    have no time limit."""
    coding = db.get(CodingAssignment, coding_id)
    if coding is None or not coding.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not found or inactive")
    visible_ids = visible_ids_for_student(db, student, CodingAssignmentAssignment, "coding_assignment_id")
    if coding.id not in visible_ids or not _is_coding_ready_for_student(db, coding, student.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding assignment not assigned to you")
    submission = start_attempt(db, coding, student.id)
    return AttemptStartOut(
        submission_id=submission.id, attempt_number=submission.attempt_number,
        started_at=submission.started_at, time_limit_minutes=None, deadline=None,
    )


@router.post("/submissions/{submission_id}/submit-files", response_model=AssignmentSubmissionOut)
async def submit_coding_files(
    submission_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    submission = db.get(AssignmentSubmission, submission_id)
    if submission is None or submission.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    if submission.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This attempt has already been submitted")
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attach at least one file")

    for f in files:
        content, _ext = await read_and_validate_upload(f, settings.MAX_UPLOAD_SIZE_MB)
        path = save(content, "coding_submissions", f.filename)
        db.add(AssignmentSubmissionFile(submission_id=submission.id, file_path=path, file_name=f.filename))

    submission.status = "submitted"
    submission.submitted_at = datetime.now(timezone.utc)
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission
