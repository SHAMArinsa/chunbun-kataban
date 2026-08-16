import hashlib
import hmac
import json
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student
from app.models.auth import User
from app.models.nda import NdaAcceptance
from app.models.people import Admin, Student
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.schemas.enrollment import MarkPaidRequest, PaymentAdminOut, PaymentOut, RazorpayOrderOut, RazorpayVerifyRequest
from app.core.config import settings
from app.services.activity_log_service import log_activity
from app.services.email_service import build_payment_invoice_pdf, send_payment_confirmation_email
from app.services.payment_service import activate_payment, generate_invoice_number
from app.services.razorpay_service import create_order, verify_signature

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.post("/razorpay/webhook", status_code=status.HTTP_200_OK)
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Process Razorpay's server-to-server payment confirmation securely."""
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Razorpay webhook is not configured")

    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    expected = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Razorpay webhook signature")

    event = json.loads(body)
    if event.get("event") != "payment.captured":
        return {"status": "ignored"}

    gateway_payment = event.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = gateway_payment.get("order_id")
    payment_id = gateway_payment.get("id")
    if not order_id or not payment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing payment details in webhook")

    payment = db.query(Payment).filter(Payment.razorpay_order_id == order_id).first()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if payment.status == "paid":
        return {"status": "already_processed"}

    expected_amount = int(round(float(payment.total_amount) * 100))
    if gateway_payment.get("currency") != payment.currency or gateway_payment.get("amount") != expected_amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount or currency mismatch")

    nda = db.query(NdaAcceptance).filter(NdaAcceptance.enrollment_id == payment.enrollment_id, NdaAcceptance.student_id == payment.student_id).first()
    if nda is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="NDA acceptance is required")

    activate_payment(db, payment, method="razorpay", razorpay_order_id=order_id, razorpay_payment_id=payment_id)
    db.commit()
    db.refresh(payment)

    try:
        student = db.get(Student, payment.student_id)
        enrollment = db.get(ProgramEnrollment, payment.enrollment_id)
        program = db.get(InternshipProgram, enrollment.program_id) if enrollment else None
        if student and program:
            send_payment_confirmation_email(to=student.email, student_name=student.full_name, program_name=program.name, payment=payment)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Could not send payment confirmation email for webhook payment %s", payment.id)

    return {"status": "processed"}


def _to_admin_out(payment: Payment, student: Student, user: User, program: InternshipProgram) -> PaymentAdminOut:
    return PaymentAdminOut(
        **PaymentOut.model_validate(payment).model_dump(),
        student_name=student.full_name,
        student_email=user.email,
        program_id=program.id,
        program_name=program.name,
        program_code=program.code,
    )


def _admin_payment_query(db: Session):
    return (
        db.query(Payment, Student, User, InternshipProgram)
        .join(Student, Student.id == Payment.student_id)
        .join(User, User.id == Student.user_id)
        .join(ProgramEnrollment, ProgramEnrollment.id == Payment.enrollment_id)
        .join(InternshipProgram, InternshipProgram.id == ProgramEnrollment.program_id)
    )


@router.get("/me", response_model=list[PaymentOut])
def my_payments(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    return db.query(Payment).filter(Payment.student_id == student.id).order_by(Payment.id.desc()).all()


@router.get("", response_model=list[PaymentAdminOut])
def list_payments(
    status_filter: str | None = None,
    program_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    query = _admin_payment_query(db)

    if status_filter:
        query = query.filter(Payment.status == status_filter)
    if program_id:
        query = query.filter(InternshipProgram.id == program_id)
    if search:
        like = f"%{search}%"
        conditions = [Student.full_name.ilike(like), User.email.ilike(like), Payment.razorpay_payment_id.ilike(like), Payment.razorpay_order_id.ilike(like)]
        if search.isdigit():
            conditions.append(Payment.id == int(search))
        query = query.filter(or_(*conditions))
    if date_from:
        query = query.filter(Payment.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        query = query.filter(Payment.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))

    rows = query.order_by(Payment.id.desc()).all()
    return [_to_admin_out(payment, student, user, program) for payment, student, user, program in rows]


@router.get("/{payment_id}", response_model=PaymentAdminOut)
def get_payment(payment_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    row = _admin_payment_query(db).filter(Payment.id == payment_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    payment, student, user, program = row
    return _to_admin_out(payment, student, user, program)


@router.get("/{payment_id}/invoice")
def download_invoice(payment_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    row = _admin_payment_query(db).filter(Payment.id == payment_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    payment, student, _, program = row
    if payment.status != "paid":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An invoice is available only after successful payment")
    if not payment.invoice_number:
        payment.invoice_number = generate_invoice_number()
        db.add(payment)
        db.commit()
        db.refresh(payment)

    invoice_number, invoice_pdf = build_payment_invoice_pdf(
        student_name=student.full_name,
        program_name=program.name,
        payment=payment,
    )
    return Response(
        content=invoice_pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{invoice_number}.pdf"'},
    )


@router.post("/{payment_id}/mark-paid", response_model=PaymentOut)
def mark_paid(
    payment_id: int,
    payload: MarkPaidRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if payment.status == "paid":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment already marked paid")

    activate_payment(db, payment, method="manual_offline", admin_id=admin.id, notes=payload.notes)

    log_activity(db, admin.user_id, "admin", "mark_payment_paid", "payments", payment.id, f"Marked paid: {payment.total_amount} {payment.currency}")
    db.commit()
    db.refresh(payment)
    return payment


def _get_owned_pending_payment(db: Session, payment_id: int, student: Student) -> Payment:
    payment = db.get(Payment, payment_id)
    if payment is None or payment.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if payment.status == "paid":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment already paid")
    return payment


@router.post("/{payment_id}/razorpay/create-order", response_model=RazorpayOrderOut)
def razorpay_create_order(payment_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    payment = _get_owned_pending_payment(db, payment_id, student)

    order = create_order(payment)

    payment.razorpay_order_id = order["id"]
    db.add(payment)
    db.commit()

    return RazorpayOrderOut(order_id=order["id"], amount=order["amount"], currency=order["currency"], key_id=settings.RAZORPAY_KEY_ID)


@router.post("/{payment_id}/razorpay/verify", response_model=PaymentOut)
def razorpay_verify(
    payment_id: int,
    payload: RazorpayVerifyRequest,
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    payment = _get_owned_pending_payment(db, payment_id, student)

    if payment.razorpay_order_id != payload.razorpay_order_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order mismatch")

    nda = (
        db.query(NdaAcceptance)
        .filter(NdaAcceptance.enrollment_id == payment.enrollment_id, NdaAcceptance.student_id == student.id)
        .first()
    )
    if nda is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="NDA must be accepted before payment can be verified")

    if not verify_signature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment signature verification failed")

    activate_payment(
        db,
        payment,
        method="razorpay",
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature,
    )
    db.commit()
    db.refresh(payment)
    try:
        enrollment = db.get(ProgramEnrollment, payment.enrollment_id)
        program = db.get(InternshipProgram, enrollment.program_id) if enrollment else None
        if program:
            send_payment_confirmation_email(
                to=student.email,
                student_name=student.full_name,
                program_name=program.name,
                payment=payment,
            )
    except Exception:
        # Payment remains successful even if SMTP is temporarily unavailable.
        import logging
        logging.getLogger(__name__).exception("Could not send payment confirmation email for payment %s", payment.id)
    return payment
