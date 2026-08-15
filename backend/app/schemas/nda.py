from datetime import datetime

from pydantic import BaseModel


class NdaAcceptRequest(BaseModel):
    enrollment_id: int
    signature_name: str


class NdaAcceptanceOut(BaseModel):
    id: int
    enrollment_id: int
    signature_name: str
    nda_version: str
    accepted_at: datetime

    class Config:
        from_attributes = True
