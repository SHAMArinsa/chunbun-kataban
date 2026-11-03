from fastapi import APIRouter, Depends, Response, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import oauth2_scheme, get_current_user
from app.core.database import get_db
from app.models.program import InternshipProgram
from app.schemas.public import PublicProgramOut

router = APIRouter(prefix="/api/public", tags=["public"])

@router.get("/programs", response_model=list[PublicProgramOut])
def list_public_programs(response: Response, db: Session = Depends(get_db), token: str | None = Depends(oauth2_scheme)):
    if token and get_current_user(token, db).role.name == "instructor":
        raise HTTPException(403, "Use the academic program endpoint")
    # Programme prices and offers are managed in the admin portal. Do not let a
    # browser or intermediary reuse an older catalogue after an admin update.
    response.headers["Cache-Control"] = "no-store, max-age=0"
    from app.services.v2 import price_for, program_tier

    rows = (
        db.query(InternshipProgram)
        .filter(InternshipProgram.is_active.is_(True))
        .order_by(InternshipProgram.duration_weeks)
        .all()
    )
    out = []
    for p in rows:
        item = PublicProgramOut.model_validate(p)
        inr, live = price_for(p, "INR")
        usd, _ = price_for(p, "USD")
        item.tier = program_tier(p)
        item.duration, item.duration_unit = p.duration or p.duration_weeks, p.duration_unit or "weeks"
        item.current_price_inr, item.current_price_usd, item.offer_live = float(inr), float(usd), live
        item.offer_end_at = p.offer_end_at if live and p.offer_enabled else None
        out.append(item)
    return out
