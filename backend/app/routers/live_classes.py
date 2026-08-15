from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student, require_any_role
from app.models.engagement import Attendance
from app.models.people import Admin, Student
from app.models.program import BatchMember, InternshipProgram, ProgramEnrollment
from app.models.content import LiveClass
from app.schemas.content import LiveClassCreateRequest, LiveClassOut, LiveClassUpdateRequest
from app.services.activity_log_service import log_activity

router = APIRouter(prefix="/api/live-classes", tags=["live-classes"])


@router.post("", response_model=LiveClassOut, status_code=status.HTTP_201_CREATED)
def create_live_class(payload: LiveClassCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    program = db.get(InternshipProgram, payload.program_id)
    if program is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    if program.code != "platinum":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Live classes are only available for the Platinum Program")

    live_class = LiveClass(**payload.model_dump(), created_by=admin.id)
    db.add(live_class)
    log_activity(db, admin.user_id, "admin", "create_live_class", "live_classes", None, payload.title)
    db.commit()
    db.refresh(live_class)
    return live_class


@router.put("/{live_class_id}", response_model=LiveClassOut)
def update_live_class(live_class_id: int, payload: LiveClassUpdateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    live_class = db.get(LiveClass, live_class_id)
    if live_class is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live class not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(live_class, field, value)
    db.add(live_class)
    db.commit()
    db.refresh(live_class)
    return live_class


@router.delete("/{live_class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_live_class(live_class_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    live_class = db.get(LiveClass, live_class_id)
    if live_class is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live class not found")

    title = live_class.title
    db.query(Attendance).filter(Attendance.live_class_id == live_class_id).delete(synchronize_session=False)
    db.delete(live_class)
    log_activity(db, admin.user_id, "admin", "delete_live_class", "live_classes", live_class_id, title)
    db.commit()
    return None


@router.get("", response_model=list[LiveClassOut])
def list_live_classes(db: Session = Depends(get_db), role_user=Depends(require_any_role)):
    if role_user.role.name == "admin":
        return db.query(LiveClass).order_by(LiveClass.scheduled_date.desc()).all()

    student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
    if student_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    enrolled_program_ids = [r.program_id for r in db.query(ProgramEnrollment.program_id).filter(ProgramEnrollment.student_id == student_row.id, ProgramEnrollment.status == "active")]
    if not enrolled_program_ids:
        return []
    return db.query(LiveClass).filter(LiveClass.program_id.in_(enrolled_program_ids)).order_by(LiveClass.scheduled_date).all()


@router.post("/{live_class_id}/join")
def join_live_class(live_class_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    live_class = db.get(LiveClass, live_class_id)
    if live_class is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live class not found")

    enrolled = (
        db.query(ProgramEnrollment)
        .filter(
            ProgramEnrollment.student_id == student.id,
            ProgramEnrollment.program_id == live_class.program_id,
            ProgramEnrollment.status == "active",
        )
        .first()
    )
    if enrolled is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in the program this live class belongs to")

    existing = db.query(Attendance).filter(Attendance.student_id == student.id, Attendance.live_class_id == live_class_id).first()
    if existing is None:
        db.add(Attendance(student_id=student.id, live_class_id=live_class_id, status="present", joined_at=datetime.now(timezone.utc)))
        db.commit()
    return {"meet_link": live_class.meet_link}
