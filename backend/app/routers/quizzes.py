from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student, require_any_role, require_unsuspended_student
from app.models.assessment import (
    Quiz,
    QuizAttempt,
    QuizAttemptAnswer,
    QuizQuestion,
    QuizQuestionSheet,
    QuizSheetAssignment,
)
from app.models.auth import User
from app.models.people import Admin, Student
from app.services.assignment_visibility import active_program_ids_for_student
from app.schemas.assessment import (
    QuizAnswerSubmit,
    QuizAttemptResultOut,
    QuizAttemptStartOut,
    QuizCreateRequest,
    QuizOut,
    QuizQuestionAdminOut,
    QuizQuestionCreateRequest,
    QuizQuestionOut,
    QuizQuestionSheetOut,
    QuizSubmitRequest,
    SheetAssignedStudentOut,
    SheetAssignRequest,
    SheetUploadResult,
)
from app.services.activity_log_service import log_activity
from app.services.notification_service import notify_students
from app.services.quiz_service import check_attempt_eligibility, grade_attempt, select_random_questions
from app.services.quiz_sheet_service import parse_mcq_sheet

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


@router.post("", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_quiz(payload: QuizCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    quiz = Quiz(**payload.model_dump(), created_by=admin.id)
    db.add(quiz)
    log_activity(db, admin.user_id, "admin", "create_quiz", "quizzes", None, payload.title)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.get("", response_model=list[QuizOut])
def list_quizzes(program_id: int | None = None, db: Session = Depends(get_db), role_user=Depends(require_any_role)):
    query = db.query(Quiz).filter(Quiz.is_active.is_(True))
    if program_id:
        query = query.filter(Quiz.program_id == program_id)

    if role_user.role.name != "admin":
        student = db.query(Student).filter(Student.user_id == role_user.id).first()
        if student is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
        active_program_ids = active_program_ids_for_student(db, student.id)
        if not active_program_ids:
            return []
        query = query.filter(Quiz.program_id.in_(active_program_ids))

    return query.all()


@router.post("/{quiz_id}/questions", response_model=QuizQuestionAdminOut, status_code=status.HTTP_201_CREATED)
def add_question(quiz_id: int, payload: QuizQuestionCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    quiz = db.get(Quiz, quiz_id)
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    question = QuizQuestion(quiz_id=quiz_id, **payload.model_dump())
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.get("/{quiz_id}/questions", response_model=list[QuizQuestionAdminOut])
def list_questions(quiz_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id).all()


@router.post("/{quiz_id}/sheets", response_model=SheetUploadResult, status_code=status.HTTP_201_CREATED)
async def upload_question_sheet(
    quiz_id: int,
    title: str = Form(...),
    file: UploadFile = ...,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Bulk-uploads an Excel MCQ sheet (question, option_a-d, correct_option columns) for a quiz.
    Once a quiz has any sheets, students only draw from sheets explicitly assigned to them —
    see POST /sheets/{sheet_id}/assign."""
    quiz = db.get(Quiz, quiz_id)
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    content = await file.read()
    rows, skipped = parse_mcq_sheet(content)

    sheet = QuizQuestionSheet(quiz_id=quiz_id, title=title, uploaded_by=admin.id)
    db.add(sheet)
    db.flush()

    for row in rows:
        db.add(QuizQuestion(quiz_id=quiz_id, sheet_id=sheet.id, **row))

    log_activity(db, admin.user_id, "admin", "upload_quiz_sheet", "quiz_question_sheets", sheet.id, f"{title} ({len(rows)} questions)")
    db.commit()
    db.refresh(sheet)

    return SheetUploadResult(
        sheet=QuizQuestionSheetOut(
            id=sheet.id, quiz_id=sheet.quiz_id, title=sheet.title,
            question_count=len(rows), assigned_student_count=0, created_at=sheet.created_at,
        ),
        rows_parsed=len(rows),
        rows_skipped=skipped,
    )


@router.get("/{quiz_id}/sheets", response_model=list[QuizQuestionSheetOut])
def list_question_sheets(quiz_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    sheets = db.query(QuizQuestionSheet).filter(QuizQuestionSheet.quiz_id == quiz_id).order_by(QuizQuestionSheet.id.desc()).all()
    out = []
    for sheet in sheets:
        question_count = db.query(QuizQuestion).filter(QuizQuestion.sheet_id == sheet.id).count()
        assigned_count = db.query(QuizSheetAssignment).filter(QuizSheetAssignment.sheet_id == sheet.id).count()
        out.append(QuizQuestionSheetOut(
            id=sheet.id, quiz_id=sheet.quiz_id, title=sheet.title,
            question_count=question_count, assigned_student_count=assigned_count, created_at=sheet.created_at,
        ))
    return out


@router.post("/sheets/{sheet_id}/assign", status_code=status.HTTP_201_CREATED)
def assign_sheet_to_students(sheet_id: int, payload: SheetAssignRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    sheet = db.get(QuizQuestionSheet, sheet_id)
    if sheet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sheet not found")

    existing = {
        row.student_id
        for row in db.query(QuizSheetAssignment.student_id).filter(QuizSheetAssignment.sheet_id == sheet_id, QuizSheetAssignment.student_id.in_(payload.student_ids))
    }
    added = 0
    for student_id in payload.student_ids:
        if student_id in existing:
            continue
        db.add(QuizSheetAssignment(sheet_id=sheet_id, student_id=student_id, assigned_by=admin.id))
        added += 1

    newly_assigned_ids = [sid for sid in payload.student_ids if sid not in existing]
    quiz = db.get(Quiz, sheet.quiz_id)
    notify_students(
        db, newly_assigned_ids,
        title="New quiz assigned",
        message=f'"{quiz.title if quiz else sheet.title}" has been assigned to you.',
        notification_type="info",
        link_url="/quizzes",
    )
    log_activity(db, admin.user_id, "admin", "assign_quiz_sheet", "quiz_question_sheets", sheet_id, f"Assigned to {added} student(s)")
    db.commit()
    return {"status": "assigned", "newly_assigned": added, "already_assigned": len(existing)}


@router.get("/sheets/{sheet_id}/assignments", response_model=list[SheetAssignedStudentOut])
def list_sheet_assignments(sheet_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = (
        db.query(Student.id, Student.full_name, User.email)
        .join(QuizSheetAssignment, QuizSheetAssignment.student_id == Student.id)
        .join(User, User.id == Student.user_id)
        .filter(QuizSheetAssignment.sheet_id == sheet_id)
        .all()
    )
    return [SheetAssignedStudentOut(student_id=r[0], full_name=r[1], email=r[2]) for r in rows]


@router.delete("/sheets/{sheet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question_sheet(sheet_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    sheet = db.get(QuizQuestionSheet, sheet_id)
    if sheet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sheet not found")

    used = (
        db.query(QuizAttemptAnswer)
        .join(QuizQuestion, QuizQuestion.id == QuizAttemptAnswer.question_id)
        .filter(QuizQuestion.sheet_id == sheet_id)
        .first()
    )
    if used is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This sheet has already been used in a student's quiz attempt and cannot be deleted",
        )

    title = sheet.title
    db.query(QuizSheetAssignment).filter(QuizSheetAssignment.sheet_id == sheet_id).delete(synchronize_session=False)
    db.delete(sheet)
    log_activity(db, admin.user_id, "admin", "delete_quiz_sheet", "quiz_question_sheets", sheet_id, title)
    db.commit()
    return None


@router.post("/{quiz_id}/start", response_model=QuizAttemptStartOut)
def start_attempt(quiz_id: int, db: Session = Depends(get_db), student: Student = Depends(require_unsuspended_student)):
    quiz = db.get(Quiz, quiz_id)
    if quiz is None or not quiz.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found or inactive")
    if quiz.program_id not in active_program_ids_for_student(db, student.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have an active enrollment for this quiz's program")

    attempt_number = check_attempt_eligibility(db, quiz, student.id)
    selected_questions = select_random_questions(db, quiz, student.id)

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        student_id=student.id,
        attempt_number=attempt_number,
        total_questions=len(selected_questions),
        status="in_progress",
    )
    db.add(attempt)
    db.flush()

    for q in selected_questions:
        db.add(QuizAttemptAnswer(attempt_id=attempt.id, question_id=q.id))
    db.commit()
    db.refresh(attempt)

    return QuizAttemptStartOut(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        time_limit_minutes=quiz.time_limit_minutes,
        questions=[QuizQuestionOut.model_validate(q) for q in selected_questions],
        started_at=attempt.started_at,
    )


@router.post("/attempts/{attempt_id}/submit", response_model=QuizAttemptResultOut)
def submit_attempt(attempt_id: int, payload: QuizSubmitRequest, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    attempt = db.get(QuizAttempt, attempt_id)
    if attempt is None or attempt.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    if attempt.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt already submitted")

    quiz = db.get(Quiz, attempt.quiz_id)
    answers_map = {a.question_id: a.selected_option for a in payload.answers}
    grade_attempt(db, attempt, quiz, answers_map)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/attempts/me", response_model=list[QuizAttemptResultOut])
def my_attempts(quiz_id: int | None = None, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    query = db.query(QuizAttempt).filter(QuizAttempt.student_id == student.id)
    if quiz_id:
        query = query.filter(QuizAttempt.quiz_id == quiz_id)
    return query.order_by(QuizAttempt.id.desc()).all()


@router.get("/attempts", response_model=list[QuizAttemptResultOut])
def list_attempts(quiz_id: int | None = None, student_id: int | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    query = db.query(QuizAttempt)
    if quiz_id:
        query = query.filter(QuizAttempt.quiz_id == quiz_id)
    if student_id:
        query = query.filter(QuizAttempt.student_id == student_id)
    return query.order_by(QuizAttempt.id.desc()).all()
