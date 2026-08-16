from datetime import date

from pydantic import BaseModel


class PublicProgramOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    duration_weeks: int
    price_inr: float
    price_usd: float
    offer_price_inr: float | None = None
    offer_price_usd: float | None = None
    offer_start_date: date | None = None
    offer_end_date: date | None = None
    features: dict

    class Config:
        from_attributes = True
