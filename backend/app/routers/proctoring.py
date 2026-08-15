import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student
from app.models.auth import User
from app.models.people import Admin, Student
from app.models.program import ProgramEnrollment
from app.models.proctoring import ALL_VIOLATION_TYPES, ProctoringViolation, WatermarkSession
from app.schemas.proctoring import (
    ManualSuspendRequest,
    ViolationOut,
    ViolationReportRequest,
    ViolationReportResponse,
    ViolationReviewRequest,
    WatermarkSessionOut,
    WatermarkSessionStartRequest,
    WatermarkSessionStartResponse,
)
from app.services.activity_log_service import log_activity
from app.services.proctoring_service import _find_relevant_enrollment, record_violation

router = APIRouter(prefix="/api/proctoring", tags=["proctoring"])


def _generate_session_code(db: Session) -> str:
    # 7-char uppercase alphanumeric — short enough to read off a screenshot and retype, long
    # enough (36^7 ≈ 78 billion) that collisions are effectively impossible; retried just in case.
    for _ in range(5):
        code = secrets.token_hex(4).upper()[:7]
        if not db.query(WatermarkSession.id).filter(WatermarkSession.session_code == code).first():
            return code
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not allocate a session code")


@router.post("/session/start", response_model=WatermarkSessionStartResponse, status_code=status.HTTP_201_CREATED)
def start_watermark_session(
    payload: WatermarkSessionStartRequest,
    request: Request,
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    """Called the moment a student opens protected content — mints the short code embedded in
    the watermark (SESSION: XXXXXXX) and records who/what/when/where server-side, so a leaked
    screenshot or recording can be traced back via Admin → Proctoring → Search Session."""
    # Multiple-session conflict: the same student already has another still-open session on this
    # exact assessment (e.g. opened in a second tab/device). Log it as suspicious evidence and
    # soft-invalidate the stale one — this session becomes the one live session going forward.
    if payload.assessment_type and payload.assessment_id:
        stale_sessions = (
            db.query(WatermarkSession)
            .filter(
                WatermarkSession.student_id == student.id,
                WatermarkSession.assessment_type == payload.assessment_type,
                WatermarkSession.assessment_id == payload.assessment_id,
                WatermarkSession.ended_at.is_(None),
            )
            .all()
        )
        if stale_sessions:
            record_violation(
                db,
                student_id=student.id,
                violation_type="MULTIPLE_SESSION_CONFLICT",
                assessment_type=payload.assessment_type,
                assessment_id=payload.assessment_id,
                attempt_id=None,
                resource_id=payload.resource_id,
                route=payload.route,
                user_agent=request.headers.get("user-agent"),
                metadata={"prior_session_codes": [s.session_code for s in stale_sessions]},
            )
            for s in stale_sessions:
                s.ended_at = datetime.now(timezone.utc)
                db.add(s)

    enrollment = _find_relevant_enrollment(db, student.id, payload.assessment_type, payload.assessment_id)
    session = WatermarkSession(
        session_code=_generate_session_code(db),
        student_id=student.id,
        enrollment_id=enrollment.id if enrollment else None,
        assessment_type=payload.assessment_type,
        assessment_id=payload.assessment_id,
        resource_id=payload.resource_id,
        route=payload.route,
        ip_address=request.client.host if request.client else None,
        user_agent=(request.headers.get("user-agent") or "")[:500],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return WatermarkSessionStartResponse(session_code=session.session_code, started_at=session.started_at)


@router.post("/session/{session_code}/end", status_code=status.HTTP_204_NO_CONTENT)
def end_watermark_session(session_code: str, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    session = db.query(WatermarkSession).filter(WatermarkSession.session_code == session_code).first()
    if session is None or session.student_id != student.id:
        return None
    if session.ended_at is None:
        session.ended_at = datetime.now(timezone.utc)
        db.add(session)
        db.commit()
    return None


@router.get("/session/{session_code}", response_model=WatermarkSessionOut)
def get_watermark_session(session_code: str, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Admin lookup: paste the SESSION code visible in a leaked screenshot/recording to identify
    the student, the content they were viewing, and when."""
    session = db.query(WatermarkSession).filter(WatermarkSession.session_code == session_code.strip().upper()).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No session found for this code")

    out = WatermarkSessionOut.model_validate(session)
    student = db.get(Student, session.student_id)
    if student:
        out.student_full_name = student.full_name
        out.student_email = student.email

    window_end = session.ended_at or datetime.now(timezone.utc)
    out.violation_count = (
        db.query(ProctoringViolation)
        .filter(
            ProctoringViolation.student_id == session.student_id,
            ProctoringViolation.created_at >= session.started_at,
            ProctoringViolation.created_at <= window_end,
        )
        .count()
    )
    return out


@router.post("/violation", response_model=ViolationReportResponse)
def report_violation(
    payload: ViolationReportRequest,
    request: Request,
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    if payload.violation_type not in ALL_VIOLATION_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown violation_type")

    try:
        result = record_violation(
            db,
            student_id=student.id,
            violation_type=payload.violation_type,
            assessment_type=payload.assessment_type,
            assessment_id=payload.assessment_id,
            attempt_id=payload.attempt_id,
            resource_id=payload.resource_id,
            route=payload.route,
            user_agent=request.headers.get("user-agent"),
            metadata=payload.metadata,
            session_code=payload.session_code,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown violation_type")

    return ViolationReportResponse(**result)


def _violation_out(v: ProctoringViolation, db: Session) -> ViolationOut:
    out = ViolationOut.model_validate(v)
    student = db.get(Student, v.student_id)
    if student:
        out.student_full_name = student.full_name
        out.student_email = student.email
    return out


@router.get("", response_model=list[ViolationOut])
def list_violations(
    student_id: int | None = None,
    category: str | None = None,
    violation_type: str | None = None,
    reviewed: bool | None = None,
    assessment_type: str | None = None,
    assessment_id: int | None = None,
    session_code: str | None = None,
    student_search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Backs the Admin → Proctoring & Violations audit search — by student ID, session/attempt
    ID, assessment, date range, or (via `student_search`) student name/email."""
    query = db.query(ProctoringViolation)
    if student_id:
        query = query.filter(ProctoringViolation.student_id == student_id)
    if category:
        query = query.filter(ProctoringViolation.category == category)
    if violation_type:
        query = query.filter(ProctoringViolation.violation_type == violation_type)
    if reviewed is not None:
        query = query.filter(ProctoringViolation.reviewed == reviewed)
    if assessment_type:
        query = query.filter(ProctoringViolation.assessment_type == assessment_type)
    if assessment_id is not None:
        query = query.filter(ProctoringViolation.assessment_id == assessment_id)
    if session_code:
        query = query.filter(ProctoringViolation.session_code == session_code.strip().upper())
    if date_from:
        query = query.filter(ProctoringViolation.created_at >= date_from)
    if date_to:
        query = query.filter(ProctoringViolation.created_at <= date_to)
    if student_search:
        needle = f"%{student_search.strip()}%"
        matching_ids = [
            row.id
            for row in db.query(Student.id)
            .join(User, User.id == Student.user_id)
            .filter(or_(Student.full_name.ilike(needle), User.email.ilike(needle)))
        ]
        query = query.filter(ProctoringViolation.student_id.in_(matching_ids or [-1]))
    rows = query.order_by(ProctoringViolation.id.desc()).limit(500).all()
    return [_violation_out(v, db) for v in rows]


@router.get("/{violation_id}", response_model=ViolationOut)
def get_violation(violation_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    v = db.get(ProctoringViolation, violation_id)
    if v is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation not found")
    return _violation_out(v, db)


@router.put("/{violation_id}/review", response_model=ViolationOut)
def review_violation(
    violation_id: int,
    payload: ViolationReviewRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    v = db.get(ProctoringViolation, violation_id)
    if v is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation not found")
    v.reviewed = payload.reviewed
    v.reviewed_by = admin.id
    v.reviewed_at = datetime.now(timezone.utc)
    if payload.admin_notes is not None:
        v.admin_notes = payload.admin_notes
    db.add(v)
    log_activity(db, admin.user_id, "admin", "review_proctoring_violation", "proctoring_violations", v.id, payload.admin_notes)
    db.commit()
    db.refresh(v)
    return _violation_out(v, db)


@router.post("/suspend", response_model=dict)
def manual_suspend(
    payload: ManualSuspendRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    enrollment = db.get(ProgramEnrollment, payload.enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    enrollment.status = "suspended"
    db.add(enrollment)
    log_activity(db, admin.user_id, "admin", "manual_suspend_enrollment", "program_enrollments", enrollment.id, payload.reason)
    db.commit()
    return {"ok": True}


@router.post("/reinstate", response_model=dict)
def reinstate(
    payload: ManualSuspendRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    enrollment = db.get(ProgramEnrollment, payload.enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    enrollment.status = "active"
    db.add(enrollment)
    log_activity(db, admin.user_id, "admin", "reinstate_enrollment", "program_enrollments", enrollment.id, payload.reason)
    db.commit()
    return {"ok": True}
