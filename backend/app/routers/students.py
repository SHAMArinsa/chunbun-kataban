import mimetypes

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student, require_admin
from app.models.auth import User
from app.models.people import Admin, Student
from app.models.program import ACTIVE_ENROLLMENT_STATUSES, InternshipProgram, ProgramEnrollment
from app.schemas.people import StudentOut, StudentUpdateRequest
from app.services.activity_log_service import log_activity
from app.services.storage import delete as delete_file, download_response, save
from app.utils.file_validation import read_and_validate_upload

router = APIRouter(prefix="/api/students", tags=["students"])


def _student_out(db: Session, student: Student) -> StudentOut:
    out = StudentOut.model_validate(student)
    enrollments = (
        db.query(ProgramEnrollment)
        .filter(ProgramEnrollment.student_id == student.id)
        .order_by(ProgramEnrollment.id.desc())
        .all()
    )
    primary = next((e for e in enrollments if e.status in ACTIVE_ENROLLMENT_STATUSES), enrollments[0] if enrollments else None)
    if primary is not None:
        program = db.get(InternshipProgram, primary.program_id)
        out.enrollment_id = primary.id
        out.program_id = primary.program_id
        out.program_name = program.name if program else None
        out.program_code = program.code if program else None
        out.enrollment_status = primary.status
        out.enrollment_start_date = primary.start_date
        out.enrollment_end_date = primary.expected_end_date
        out.enrollment_suspension_reason = primary.suspension_reason
    return out


@router.get("/me", response_model=StudentOut)
def get_my_profile(student: Student = Depends(get_current_student)):
    return student


@router.put("/me", response_model=StudentOut)
def update_my_profile(
    payload: StudentUpdateRequest,
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, field, value)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


NATIONAL_ID_SIDES = ("front", "back")


def _side_or_404(side: str) -> str:
    if side not in NATIONAL_ID_SIDES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid document side")
    return side


def _set_national_id_document(student: Student, side: str, file: UploadFile, content: bytes) -> None:
    path_field = f"national_id_document_{side}_path"
    name_field = f"national_id_document_{side}_name"
    existing_path = getattr(student, path_field)
    if existing_path:
        delete_file(existing_path)
    setattr(student, path_field, save(content, "national_id_documents", file.filename))
    setattr(student, name_field, file.filename)


@router.post("/me/national-id-document/{side}", response_model=StudentOut)
async def upload_my_national_id_document(
    side: str,
    file: UploadFile,
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Self-service upload of the front or back of the ID document — used right after signup
    (registration must complete first since this endpoint needs an authenticated session), and
    any time the student wants to replace either side."""
    side = _side_or_404(side)
    content, _ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    _set_national_id_document(student, side, file, content)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.post("/{student_id}/national-id-document/{side}", response_model=StudentOut)
async def admin_upload_national_id_document(
    student_id: int,
    side: str,
    file: UploadFile,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    side = _side_or_404(side)
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    content, _ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    _set_national_id_document(student, side, file, content)
    db.add(student)
    log_activity(db, admin.user_id, "admin", f"upload_national_id_document_{side}", "students", student.id, file.filename)
    db.commit()
    db.refresh(student)
    return _student_out(db, student)


@router.get("/{student_id}/national-id-document/{side}/download")
def download_national_id_document(student_id: int, side: str, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    side = _side_or_404(side)
    student = db.get(Student, student_id)
    doc_path = getattr(student, f"national_id_document_{side}_path", None) if student else None
    if student is None or not doc_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No document uploaded for this student")
    doc_name = getattr(student, f"national_id_document_{side}_name")
    media_type, _ = mimetypes.guess_type(doc_name or doc_path)
    return download_response(doc_path, filename=doc_name, media_type=media_type or "application/octet-stream")


@router.get("", response_model=list[StudentOut])
def list_students(
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    program_id: int | None = None,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Student).options(joinedload(Student.user))
    if search:
        query = query.join(User, User.id == Student.user_id).filter(
            or_(Student.full_name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"))
        )
    if program_id:
        active_student_ids = db.query(ProgramEnrollment.student_id).filter(
            ProgramEnrollment.program_id == program_id,
            ProgramEnrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
        )
        query = query.filter(Student.id.in_(active_student_ids))
    students = query.order_by(Student.id).offset(skip).limit(limit).all()
    return [_student_out(db, s) for s in students]


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, admin=Depends(require_admin), db: Session = Depends(get_db)):
    student = db.query(Student).options(joinedload(Student.user)).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return _student_out(db, student)


@router.put("/{student_id}", response_model=StudentOut)
def admin_update_student(
    student_id: int,
    payload: StudentUpdateRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Lets an admin correct/complete a student's profile fields — e.g. national ID details —
    reusing the same StudentUpdateRequest shape the student's own self-service PUT /me uses."""
    student = db.query(Student).options(joinedload(Student.user)).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, field, value)
    db.add(student)
    db.commit()
    db.refresh(student)
    return _student_out(db, student)
