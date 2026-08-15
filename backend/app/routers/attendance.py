from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student
from app.models.engagement import Attendance
from app.models.people import Admin, Student
from app.schemas.engagement import AttendanceMarkRequest, AttendanceOut

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("/me", response_model=list[AttendanceOut])
def my_attendance(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    return db.query(Attendance).filter(Attendance.student_id == student.id).order_by(Attendance.id.desc()).all()


@router.get("", response_model=list[AttendanceOut])
def list_attendance(live_class_id: int | None = None, student_id: int | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    query = db.query(Attendance)
    if live_class_id:
        query = query.filter(Attendance.live_class_id == live_class_id)
    if student_id:
        query = query.filter(Attendance.student_id == student_id)
    return query.order_by(Attendance.id.desc()).all()


@router.post("", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def mark_attendance(payload: AttendanceMarkRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    existing = db.query(Attendance).filter(Attendance.student_id == payload.student_id, Attendance.live_class_id == payload.live_class_id).first()
    if existing:
        existing.status = payload.status
        existing.marked_by = admin.id
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
    attendance = Attendance(student_id=payload.student_id, live_class_id=payload.live_class_id, status=payload.status, marked_by=admin.id)
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance
