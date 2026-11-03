from datetime import timezone
import logging
import smtplib
from io import BytesIO
from email.message import EmailMessage
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.core.config import settings

logger = logging.getLogger("email")
ARINSA_LOGO_PATH = Path(__file__).resolve().parents[1] / "assets" / "arinsa-ai-minds-logo-cropped.png"


def send_email(to: str, subject: str, body: str, attachment: tuple[str, bytes, str] | None = None) -> None:
    """Sends a plain-text email over SMTP using the SMTP_* env settings. Without SMTP_HOST
    configured, logs the message instead of sending — lets the rest of the app (and OTP flow)
    work in dev without real mail credentials."""
    if not settings.SMTP_HOST:
        logger.warning("SMTP not configured — logging email instead of sending.\nTo: %s\nSubject: %s\n%s", to, subject, body)
        return

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    if attachment:
        filename, content, subtype = attachment
        message.add_attachment(content, maintype="application", subtype=subtype, filename=filename)

    # Port 465 = implicit SSL (e.g. Zoho/Hostinger/GoDaddy); 587/25 = STARTTLS.
    if int(settings.SMTP_PORT) == 465:
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
        server.ehlo()
        server.starttls()
        server.ehlo()
    with server:
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER.strip(), settings.SMTP_PASSWORD.replace(" ", "") if "gmail" in settings.SMTP_HOST else settings.SMTP_PASSWORD)
        server.send_message(message)


PAYMENT_METHOD_LABELS = {
    "manual_offline": "Offline / Bank transfer", "razorpay": "Online (Razorpay)", "upi": "UPI", "card": "Card",
    "netbanking": "Net banking", "wallet": "Wallet", "bank_transfer": "Bank transfer", "cash": "Cash",
}


def build_payment_invoice_pdf(*, student_name: str, program_name: str, payment, student_number: str | None = None) -> tuple[str, bytes]:
    """Fill the approved Payment Invoice artwork (app/assets/templates/payment_invoice.pdf).

    Used for both the payment email and admin/student downloads. Every value comes from the
    persisted payment record.
    """
    from decimal import Decimal
    from sqlalchemy.orm import object_session
    from app.services.document_templates import InvoiceData, _money, render_invoice

    invoice_number = payment.invoice_number or f"{payment.id:016d}"
    when = payment.paid_at or payment.created_at
    if when is None:
        raise ValueError("A payment date is required to generate an invoice")
    if student_number is None:
        session = object_session(payment)
        if session is not None:
            from app.models.people import Student
            st = session.get(Student, payment.student_id)
            student_number = st.student_number if st else None
    from app.services.v2 import BUSINESS_TZ
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    when = when.astimezone(BUSINESS_TZ)
    sym = "\u20b9" if payment.currency == "INR" else "$"
    base, fee = Decimal(str(payment.base_amount or 0)), Decimal(str(payment.fee_amount or 0))
    fee_label = f"{Decimal(str(payment.fee_percent or 0)).normalize()}% {'GST' if payment.fee_type == 'gst' else 'fee'}"
    breakdown = f"{sym}{_money(base, payment.currency)} + {fee_label} {sym}{_money(fee, payment.currency)}" if fee else None
    method = PAYMENT_METHOD_LABELS.get((payment.payment_method or "").lower(), (payment.payment_method or "—").replace("_", " ").title())
    pdf = render_invoice(InvoiceData(
        amount=Decimal(str(payment.total_amount or 0)), currency=payment.currency,
        transaction_id=payment.razorpay_payment_id or f"INV-{invoice_number}",
        transaction_date=when, student_name=student_name, student_number=student_number or "—",
        program_name=program_name, payment_status=(payment.status or "").replace("_", " ").title(),
        payment_method=method, base_amount=base, fee_amount=fee,
        fee_label=f"{'GST' if payment.fee_type == 'gst' else 'Intl. fee'} ({Decimal(str(payment.fee_percent or 0)).normalize():f}%)"))
    return invoice_number, pdf


def send_payment_confirmation_email(*, to: str, student_name: str, program_name: str, payment) -> None:
    """Send the payment confirmation and its PDF invoice after a verified payment."""
    invoice_number, invoice_pdf = build_payment_invoice_pdf(
        student_name=student_name,
        program_name=program_name,
        payment=payment,
    )
    body = (
        f"Hi {student_name},\n\n"
        f"Your payment for {program_name} has been confirmed. Your enrollment is now active.\n\n"
        f"Invoice number: {invoice_number}\n"
        f"Payment ID: {payment.razorpay_payment_id or payment.id}\n"
        f"Amount paid: {payment.currency} {payment.total_amount}\n\n"
        "Your payment invoice is attached to this email.\n\n"
        "ARINSA AI MINDS"
    )
    send_email(to, f"Payment confirmed - {program_name}", body, (f"{invoice_number}.pdf", invoice_pdf, "pdf"))
