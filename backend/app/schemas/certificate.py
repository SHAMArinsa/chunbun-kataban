from datetime import date, datetime

from pydantic import BaseModel


class CertificateOut(BaseModel):
    id: int
    student_id: int
    enrollment_id: int
    certificate_type: str
    program_id: int
    certificate_number: str
    issued_date: date
    created_at: datetime

    class Config:
        from_attributes = True


class CertificateGenerateRequest(BaseModel):
    student_id: int
    enrollment_id: int
    certificate_type: str


class StudentDocumentOut(BaseModel):
    id: int
    student_id: int
    document_type: str
    title: str
    file_name: str
    uploaded_at: datetime
    student_name: str | None = None
    student_email: str | None = None

    class Config:
        from_attributes = True
