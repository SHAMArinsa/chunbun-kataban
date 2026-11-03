from datetime import date, datetime

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
    gst_percent: float
    platform_fee_percent: float
    features: dict
    # Portal V2 fields (backend-authoritative current price; the client never decides it)
    tier: str | None = None
    duration: int | None = None
    duration_unit: str | None = None
    current_price_inr: float | None = None
    current_price_usd: float | None = None
    offer_live: bool = False
    offer_end_at: datetime | None = None

    class Config:
        from_attributes = True
