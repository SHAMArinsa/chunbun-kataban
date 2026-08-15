from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_student
from app.models.nda import NdaAcceptance
from app.models.people import Student
from app.models.program import ProgramEnrollment
from app.schemas.nda import NdaAcceptRequest, NdaAcceptanceOut

router = APIRouter(prefix="/api/nda", tags=["nda"])


@router.post("/accept", response_model=NdaAcceptanceOut, status_code=status.HTTP_201_CREATED)
def accept_nda(
    payload: NdaAcceptRequest,
    request: Request,
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    enrollment = db.get(ProgramEnrollment, payload.enrollment_id)
    if enrollment is None or enrollment.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")

    existing = (
        db.query(NdaAcceptance)
        .filter(NdaAcceptance.enrollment_id == enrollment.id, NdaAcceptance.student_id == student.id)
        .first()
    )
    if existing:
        return existing

    acceptance = NdaAcceptance(
        student_id=student.id,
        enrollment_id=enrollment.id,
        signature_name=payload.signature_name,
        ip_address=request.client.host if request.client else None,
    )
    db.add(acceptance)
    db.commit()
    db.refresh(acceptance)
    return acceptance


@router.get("/me", response_model=list[NdaAcceptanceOut])
def my_nda_acceptances(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    return db.query(NdaAcceptance).filter(NdaAcceptance.student_id == student.id).order_by(NdaAcceptance.id.desc()).all()
