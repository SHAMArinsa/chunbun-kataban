from pydantic import BaseModel


class PublicProgramOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    duration_weeks: int
    price_inr: float
    price_usd: float
    features: dict

    class Config:
        from_attributes = True
