from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.program import InternshipProgram
from app.schemas.public import PublicProgramOut

router = APIRouter(prefix="/api/public", tags=["public"])

@router.get("/programs", response_model=list[PublicProgramOut])
def list_public_programs(response: Response, db: Session = Depends(get_db)):
    # Programme prices and offers are managed in the admin portal. Do not let a
    # browser or intermediary reuse an older catalogue after an admin update.
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return (
        db.query(InternshipProgram)
        .filter(InternshipProgram.is_active.is_(True))
        .order_by(InternshipProgram.duration_weeks)
        .all()
    )
