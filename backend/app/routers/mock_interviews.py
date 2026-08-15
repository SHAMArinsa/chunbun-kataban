from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student
from app.models.people import Admin, Student
from app.models.program import ProgramEnrollment
from app.models.project import MockInterview
from app.schemas.mock_interview import MockInterviewCreateRequest, MockInterviewOut, MockInterviewUpdateRequest

router = APIRouter(prefix="/api/mock-interviews", tags=["mock-interviews"])


@router.post("", response_model=MockInterviewOut, status_code=status.HTTP_201_CREATED)
def create_mock_interview(payload: MockInterviewCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    mock = MockInterview(**payload.model_dump(), conducted_by=admin.id)
    db.add(mock)
    db.commit()
    db.refresh(mock)
    return mock


@router.put("/{mock_id}", response_model=MockInterviewOut)
def update_mock_interview(mock_id: int, payload: MockInterviewUpdateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    mock = db.get(MockInterview, mock_id)
    if mock is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mock interview not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(mock, field, value)
    db.add(mock)
    db.commit()
    db.refresh(mock)
    return mock


@router.get("/me", response_model=list[MockInterviewOut])
def my_mock_interviews(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment_ids = [r.id for r in db.query(ProgramEnrollment.id).filter(ProgramEnrollment.student_id == student.id)]
    if not enrollment_ids:
        return []
    return db.query(MockInterview).filter(MockInterview.enrollment_id.in_(enrollment_ids)).all()


@router.get("", response_model=list[MockInterviewOut])
def list_mock_interviews(enrollment_id: int | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    query = db.query(MockInterview)
    if enrollment_id:
        query = query.filter(MockInterview.enrollment_id == enrollment_id)
    return query.order_by(MockInterview.id.desc()).all()
