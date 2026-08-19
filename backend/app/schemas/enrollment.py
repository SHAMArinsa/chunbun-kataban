from datetime import date, datetime

from pydantic import BaseModel


class EnrollmentCreateRequest(BaseModel):
    program_id: int
    specialization_track_id: int | None = None


class EnrollmentEndDateExtensionRequest(BaseModel):
    new_end_date: date


class EnrollmentOut(BaseModel):
    id: int
    student_id: int
    program_id: int
    program_code: str | None = None
    specialization_track_id: int | None = None
    status: str
    enrolled_at: datetime
    start_date: date | None = None
    expected_end_date: date | None = None
    completed_at: datetime | None = None
    current_week: int
    current_phase: str | None = None
    suspension_reason: str | None = None

    class Config:
        from_attributes = True


class PaymentOut(BaseModel):
    id: int
    enrollment_id: int
    student_id: int
    currency: str
    base_amount: float
    fee_type: str
    fee_percent: float
    fee_amount: float
    total_amount: float
    status: str
    payment_method: str
    paid_at: datetime | None = None
    notes: str | None = None
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentAdminOut(PaymentOut):
    student_name: str
    student_email: str
    program_id: int
    program_name: str
    program_code: str


class MarkPaidRequest(BaseModel):
    notes: str | None = None


class RazorpayOrderOut(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
