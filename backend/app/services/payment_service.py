import secrets
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.people import Student
from app.models.program import InternshipProgram, Payment, ProgramEnrollment


def generate_invoice_number() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(16))


def compute_payment(program: InternshipProgram, student: Student) -> dict:
    """Computes currency/base/fee/total per the pricing rules: INR+GST for Indian citizens, USD+platform fee for international."""
    offer_is_active = (
        program.offer_start_date is not None
        and program.offer_end_date is not None
        and program.offer_start_date <= date.today() <= program.offer_end_date
    )

    if student.citizenship_status == "indian":
        currency = "INR"
        base_amount = Decimal(str(program.offer_price_inr if offer_is_active and program.offer_price_inr is not None else program.price_inr))
        fee_type = "gst"
        fee_percent = Decimal(str(program.gst_percent))
    elif student.citizenship_status == "international":
        currency = "USD"
        base_amount = Decimal(str(program.offer_price_usd if offer_is_active and program.offer_price_usd is not None else program.price_usd))
        fee_type = "platform_fee"
        fee_percent = Decimal(str(program.platform_fee_percent))
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown citizenship status")

    fee_amount = (base_amount * fee_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_amount = (base_amount + fee_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "currency": currency,
        "base_amount": base_amount,
        "fee_type": fee_type,
        "fee_percent": fee_percent,
        "fee_amount": fee_amount,
        "total_amount": total_amount,
    }


def activate_payment(
    db: Session,
    payment: Payment,
    method: str,
    admin_id: int | None = None,
    notes: str | None = None,
    razorpay_order_id: str | None = None,
    razorpay_payment_id: str | None = None,
    razorpay_signature: str | None = None,
) -> Payment:
    """Marks a payment paid and activates its linked enrollment. Shared by the admin
    manual mark-paid path and the Razorpay verified-payment path so both stay in sync."""
    payment.status = "paid"
    if not payment.invoice_number:
        payment.invoice_number = generate_invoice_number()
    payment.payment_method = method
    payment.paid_at = datetime.now(timezone.utc)
    if admin_id is not None:
        payment.marked_paid_by = admin_id
    if notes is not None:
        payment.notes = notes
    if razorpay_order_id is not None:
        payment.razorpay_order_id = razorpay_order_id
    if razorpay_payment_id is not None:
        payment.razorpay_payment_id = razorpay_payment_id
    if razorpay_signature is not None:
        payment.razorpay_signature = razorpay_signature
    db.add(payment)

    enrollment = db.get(ProgramEnrollment, payment.enrollment_id)
    if enrollment and enrollment.status == "pending_payment":
        enrollment.status = "active"
        db.add(enrollment)

    return payment
