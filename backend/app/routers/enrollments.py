from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student, require_admin
from app.models.people import Admin, Student
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.schemas.enrollment import EnrollmentCreateRequest, EnrollmentEndDateExtensionRequest, EnrollmentOut
from app.services.activity_log_service import log_activity
from app.services.payment_service import compute_payment

router = APIRouter(prefix="/api/enrollments", tags=["enrollments"])


@router.post("", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
def create_enrollment(
    payload: EnrollmentCreateRequest,
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    program = db.get(InternshipProgram, payload.program_id)
    if program is None or not program.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found or inactive")

    existing = (
        db.query(ProgramEnrollment)
        .filter(ProgramEnrollment.student_id == student.id, ProgramEnrollment.program_id == program.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already enrolled in this program")

    enrollment = ProgramEnrollment(
        student_id=student.id,
        program_id=program.id,
        specialization_track_id=payload.specialization_track_id,
        status="pending_payment",
        start_date=date.today(),
        expected_end_date=date.today() + timedelta(weeks=program.duration_weeks),
        current_phase="phase1" if program.code == "platinum" else None,
    )
    db.add(enrollment)
    db.flush()

    computed = compute_payment(program, student)
    payment = Payment(
        enrollment_id=enrollment.id,
        student_id=student.id,
        currency=computed["currency"],
        base_amount=computed["base_amount"],
        fee_type=computed["fee_type"],
        fee_percent=computed["fee_percent"],
        fee_amount=computed["fee_amount"],
        total_amount=computed["total_amount"],
        status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(enrollment)
    return _enrollment_out(enrollment)


def _enrollment_out(enrollment: ProgramEnrollment) -> EnrollmentOut:
    out = EnrollmentOut.model_validate(enrollment)
    out.program_code = enrollment.program.code if enrollment.program else None
    return out


@router.get("/me", response_model=list[EnrollmentOut])
def my_enrollments(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollments = db.query(ProgramEnrollment).filter(ProgramEnrollment.student_id == student.id).all()
    return [_enrollment_out(e) for e in enrollments]


@router.get("", response_model=list[EnrollmentOut])
def list_enrollments(
    status_filter: str | None = None,
    program_id: int | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    query = db.query(ProgramEnrollment)
    if status_filter:
        query = query.filter(ProgramEnrollment.status == status_filter)
    if program_id:
        query = query.filter(ProgramEnrollment.program_id == program_id)
    enrollments = query.order_by(ProgramEnrollment.id.desc()).all()
    return [_enrollment_out(e) for e in enrollments]


@router.get("/{enrollment_id}", response_model=EnrollmentOut)
def get_enrollment(enrollment_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    enrollment = db.get(ProgramEnrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    return _enrollment_out(enrollment)


@router.put("/{enrollment_id}/status", response_model=EnrollmentOut)
def update_enrollment_status(
    enrollment_id: int,
    new_status: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    enrollment = db.get(ProgramEnrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    valid_statuses = ("pending_payment", "active", "completed", "dropped", "suspended")
    if new_status not in valid_statuses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    enrollment.status = new_status
    if new_status == "completed":
        enrollment.completed_at = datetime.now(timezone.utc)
    db.add(enrollment)
    log_activity(db, admin.user_id, "admin", "update_enrollment_status", "program_enrollments", enrollment.id, f"Status -> {new_status}")
    db.commit()
    db.refresh(enrollment)
    return _enrollment_out(enrollment)


@router.put("/{enrollment_id}/end-date", response_model=EnrollmentOut)
def extend_enrollment_end_date(
    enrollment_id: int,
    payload: EnrollmentEndDateExtensionRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Extend a student's existing enrollment end date; shortening is not allowed here."""
    enrollment = db.get(ProgramEnrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    if enrollment.expected_end_date is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This enrollment has no current end date")
    if payload.new_end_date <= enrollment.expected_end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The new end date must be later than the current end date.",
        )

    previous_end_date = enrollment.expected_end_date
    enrollment.expected_end_date = payload.new_end_date
    db.add(enrollment)
    log_activity(
        db,
        admin.user_id,
        "admin",
        "extend_enrollment_end_date",
        "program_enrollments",
        enrollment.id,
        f"End date extended from {previous_end_date.isoformat()} to {payload.new_end_date.isoformat()}",
    )
    db.commit()
    db.refresh(enrollment)
    return _enrollment_out(enrollment)
