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

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)


def build_payment_invoice_pdf(*, student_name: str, program_name: str, payment) -> tuple[str, bytes]:
    """Build the single invoice PDF used for both email and admin downloads."""
    invoice_number = payment.invoice_number or f"{payment.id:016d}"
    # Both invoice dates are sourced from the persisted payment record.  A paid
    # payment normally has `paid_at`; `created_at` is a safe database fallback
    # for legacy records that predate that field being populated.
    payment_timestamp = payment.paid_at or payment.created_at
    if payment_timestamp is None:
        raise ValueError("A payment date is required to generate an invoice")
    paid_at = payment_timestamp.strftime("%d %b %Y, %H:%M UTC")
    currency = payment.currency
    invoice = BytesIO()
    pdf = canvas.Canvas(invoice, pagesize=A4)
    width, height = A4
    left, right = 18 * mm, width - 18 * mm
    y = height - 18 * mm
    navy, purple, muted, line = colors.HexColor("#0B1F3A"), colors.HexColor("#6437C7"), colors.HexColor("#64748B"), colors.HexColor("#D9E1EC")
    pdf.setTitle(f"ARINSA AI MINDS Invoice {invoice_number}")
    brand_x = left + 42 * mm
    if ARINSA_LOGO_PATH.exists():
        pdf.drawImage(ImageReader(str(ARINSA_LOGO_PATH)), left, y - 19 * mm, width=35 * mm, height=27 * mm, preserveAspectRatio=True, mask="auto", anchor="sw")
    else:
        brand_x = left
    pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 22); pdf.drawString(brand_x, y, "ARINSA AI MINDS")
    pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 8.5); pdf.drawString(brand_x, y - 6 * mm, "GSTIN: 19ABCCA8011D1Z2")
    pdf.setFillColor(muted); pdf.setFont("Helvetica", 8.5); pdf.drawString(brand_x, y - 11 * mm, "Intelligent Solutions. Real Impact.")
    pdf.setFillColor(purple); pdf.setFont("Helvetica-Bold", 22); pdf.drawRightString(right, y, "TAX INVOICE")
    pdf.setFillColor(muted); pdf.setFont("Helvetica", 9); pdf.drawRightString(right, y - 7 * mm, f"Invoice No: {invoice_number}")
    pdf.drawRightString(right, y - 12 * mm, f"Invoice Date: {paid_at.split(',')[0]}")
    y -= 25 * mm; pdf.setStrokeColor(line); pdf.line(left, y, right, y)
    y -= 9 * mm
    pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 9); pdf.drawString(left, y, "BILLED TO")
    pdf.drawString(left + 88 * mm, y, "INVOICE FOR PAYMENT DETAILS")
    pdf.setFillColor(colors.black); pdf.setFont("Helvetica-Bold", 12); pdf.drawString(left, y - 8 * mm, student_name)
    pdf.setFont("Helvetica", 9); pdf.setFillColor(muted); pdf.drawString(left, y - 14 * mm, "Student / Participant")
    pdf.setFillColor(colors.black); pdf.drawString(left + 88 * mm, y - 8 * mm, program_name)
    pdf.setFillColor(muted); pdf.drawString(left + 88 * mm, y - 14 * mm, "Course + Industry Internship Program")
    pdf.setFillColor(colors.black); pdf.drawString(left + 88 * mm, y - 20 * mm, f"Paid on: {paid_at}")
    pdf.drawString(left + 88 * mm, y - 26 * mm, f"Payment ID: {payment.razorpay_payment_id or payment.id}")
    pdf.drawString(left + 88 * mm, y - 32 * mm, f"Currency: {currency}")
    pdf.setFillColor(colors.HexColor("#16803C")); pdf.setFont("Helvetica-Bold", 9); pdf.drawString(left + 88 * mm, y - 38 * mm, "Payment Status: PAID")
    y -= 49 * mm
    columns = [left, left + 86 * mm, left + 108 * mm, left + 136 * mm, right]
    pdf.setFillColor(navy); pdf.rect(left, y - 8 * mm, right - left, 8 * mm, fill=1, stroke=0)
    pdf.setFillColor(colors.white); pdf.setFont("Helvetica-Bold", 9)
    for x, label in zip(columns[:-1], ["Description", "Qty", "Rate", "Amount"]): pdf.drawString(x + 3 * mm, y - 5.4 * mm, label)
    y -= 8 * mm; pdf.setFillColor(colors.white); pdf.setStrokeColor(line); pdf.rect(left, y - 18 * mm, right - left, 18 * mm, fill=1, stroke=1)
    pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 10); pdf.drawString(left + 3 * mm, y - 6 * mm, program_name)
    pdf.setFont("Helvetica", 8.5); pdf.setFillColor(muted); pdf.drawString(left + 3 * mm, y - 12 * mm, "Learning Program + Industry Internship")
    pdf.setFillColor(colors.black); pdf.setFont("Helvetica", 9); pdf.drawString(columns[1] + 3 * mm, y - 9 * mm, "1")
    pdf.drawRightString(columns[3] - 3 * mm, y - 9 * mm, f"{currency} {payment.base_amount}")
    pdf.drawRightString(right - 3 * mm, y - 9 * mm, f"{currency} {payment.base_amount}")
    y -= 27 * mm
    for label, amount, bold in [("Programme Fee", payment.base_amount, False), ("GST" if payment.fee_type == "gst" else "Platform Fee", payment.fee_amount, False), ("Total Paid", payment.total_amount, True)]:
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", 10)
        pdf.setFillColor(navy if bold else muted); pdf.drawRightString(columns[3] - 5 * mm, y, label)
        pdf.setFillColor(navy if bold else colors.black); pdf.drawRightString(right, y, f"{currency} {amount}")
        if bold: pdf.setStrokeColor(purple); pdf.line(columns[2], y + 4 * mm, right, y + 4 * mm)
        y -= 8 * mm
    y -= 7 * mm; pdf.setStrokeColor(line); pdf.line(left, y, right, y)
    pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 10); pdf.drawString(left, y - 10 * mm, "Payment Confirmation")
    pdf.setFillColor(muted); pdf.setFont("Helvetica", 8.5); pdf.drawString(left, y - 16 * mm, "This invoice confirms receipt of the amount shown above for enrollment in the stated ARINSA AI MINDS internship/course")
    pdf.drawString(left, y - 21 * mm, "program. Please retain this invoice for your records.")
    pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 9); pdf.drawString(left, 23 * mm, "ARINSA AI MINDS PRIVATE LIMITED")
    pdf.setFillColor(muted); pdf.setFont("Helvetica", 8); pdf.drawString(left, 17 * mm, "Computer Generated Invoice - No signature required.")
    pdf.drawRightString(right, 17 * mm, "For internship, learning, training and related program payments.")
    pdf.save()

    return invoice_number, invoice.getvalue()


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
