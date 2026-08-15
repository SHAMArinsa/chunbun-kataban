from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.program import InternshipProgram
from app.schemas.public import PublicProgramOut

router = APIRouter(prefix="/api/public", tags=["public"])

@router.get("/programs", response_model=list[PublicProgramOut])
def list_public_programs(db: Session = Depends(get_db)):
    return (
        db.query(InternshipProgram)
        .filter(InternshipProgram.is_active.is_(True))
        .order_by(InternshipProgram.duration_weeks)
        .all()
    )
