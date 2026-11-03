import uuid
from datetime import date
from io import BytesIO
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.engagement import Certificate
from app.models.people import Student
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.services.storage import save

CERTIFICATE_TITLES = {
    "welcome": "Welcome Certificate",
    "internship_completion": "Certificate of Internship Completion",
    "project_completion": "Certificate of Project Completion",
    "performance_evaluation": "Performance Evaluation Report",
    "recommendation": "Certificate of Recommendation",
    "platinum": "Platinum Program Certificate",
    "experience": "Certificate of Experience",
}

WELCOME_TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "assets" / "welcome_certificate_template.pdf"


def generate_certificate_number(certificate_type: str) -> str:
    return f"ARINSA-{certificate_type[:4].upper()}-{uuid.uuid4().hex[:8].upper()}"


def _fit_text(c: canvas.Canvas, text: str, max_width: float, preferred_size: int, minimum_size: int = 14) -> int:
    size = preferred_size
    while size > minimum_size and stringWidth(text, "Times-Italic", size) > max_width:
        size -= 1
    c.setFont("Times-Italic", size)
    return size


def _display_date(value: date) -> str:
    return value.strftime("%d %b %Y")


def get_welcome_certificate_issue_date(db: Session, enrollment: ProgramEnrollment) -> date:
    """Return the certificate issue date from persisted enrollment/payment data only."""
    payment = (
        db.query(Payment)
        .filter(Payment.enrollment_id == enrollment.id, Payment.status == "paid")
        .order_by(Payment.paid_at.desc(), Payment.id.desc())
        .first()
    )
    if payment is not None and payment.paid_at is not None:
        return payment.paid_at.date()
    if enrollment.start_date is not None:
        return enrollment.start_date
    if enrollment.enrolled_at is not None:
        return enrollment.enrolled_at.date()
    raise ValueError("The enrollment does not contain a date for the Welcome Certificate")


def _duration_label(program: InternshipProgram) -> str:
    if program.duration and program.duration_unit:
        unit = program.duration_unit.rstrip("s").capitalize()
        return f"{program.duration} {unit if program.duration == 1 else unit + 's'}"
    weeks = program.duration_weeks or 0
    return f"{weeks} {'Week' if weeks == 1 else 'Weeks'}"


def render_welcome_certificate_pdf(
    student: Student,
    program: InternshipProgram,
    enrollment: ProgramEnrollment,
    certificate_number: str,
    issued_date: date,
) -> bytes:
    """Fill the approved Welcome Certificate artwork (app/assets/templates/welcome_certificate.pdf)."""
    from app.services.document_templates import WelcomeData, render_welcome
    enrolled_on = enrollment.enrolled_at.date() if enrollment.enrolled_at else issued_date
    return render_welcome(WelcomeData(
        student_name=student.full_name, program_name=program.name, duration=_duration_label(program),
        student_number=student.student_number or f"ARINSA-SD-{student.id:04d}",
        enrollment_date=enrolled_on, start_date=enrollment.start_date or enrolled_on,
        issue_date=issued_date, certificate_number=certificate_number))


def ensure_welcome_certificate(db: Session, enrollment: ProgramEnrollment) -> Certificate | None:
    """Create exactly one welcome certificate per paid program enrollment."""
    if enrollment.status not in {"active", "completed"}:
        return None

    existing = (
        db.query(Certificate)
        .filter(Certificate.enrollment_id == enrollment.id, Certificate.certificate_type == "welcome")
        .first()
    )
    if existing:
        return existing

    student = db.get(Student, enrollment.student_id)
    program = db.get(InternshipProgram, enrollment.program_id)
    if student is None or program is None:
        return None

    certificate_number = generate_certificate_number("welcome")
    issued_date = get_welcome_certificate_issue_date(db, enrollment)
    pdf_bytes = render_welcome_certificate_pdf(student, program, enrollment, certificate_number, issued_date)
    certificate = Certificate(
        student_id=student.id,
        enrollment_id=enrollment.id,
        certificate_type="welcome",
        program_id=program.id,
        file_path=save(pdf_bytes, "certificates", f"{certificate_number}.pdf"),
        certificate_number=certificate_number,
        issued_date=issued_date,
        issued_by=None,
    )
    db.add(certificate)
    return certificate


def render_certificate_pdf(student_name: str, program_name: str, certificate_type: str, certificate_number: str, issued_date: date) -> bytes:
    if certificate_type == "welcome":
        raise ValueError("Welcome certificates require student and enrollment details")
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=landscape(letter))
    width, height = landscape(letter)

    brand = HexColor("#4f46e5")
    c.setStrokeColor(brand)
    c.setLineWidth(6)
    c.rect(0.4 * inch, 0.4 * inch, width - 0.8 * inch, height - 0.8 * inch)

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(brand)
    c.drawCentredString(width / 2, height - 1.2 * inch, "ARINSA AI MINDS")

    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(HexColor("#111827"))
    title = CERTIFICATE_TITLES.get(certificate_type, "Certificate")
    c.drawCentredString(width / 2, height - 2.0 * inch, title)

    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 2.8 * inch, "This is to certify that")

    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(brand)
    c.drawCentredString(width / 2, height - 3.4 * inch, student_name)

    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor("#111827"))
    c.drawCentredString(width / 2, height - 4.0 * inch, f"has successfully completed the {program_name}")
    c.drawCentredString(width / 2, height - 4.4 * inch, "offered by ARINSA AI MINDS.")

    c.setFont("Helvetica", 11)
    c.drawString(1 * inch, 1.1 * inch, f"Certificate No: {certificate_number}")
    c.drawString(1 * inch, 0.85 * inch, f"Issued: {issued_date.isoformat()}")
    c.drawRightString(width - 1 * inch, 1.1 * inch, "Authorized Signatory")
    c.drawRightString(width - 1 * inch, 0.85 * inch, "ARINSA AI MINDS")

    c.showPage()
    c.save()
    return buffer.getvalue()


LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "arinsa-ai-minds-logo-cropped.png"


def render_completion_certificate_pdf(*, student_name: str, student_number: str | None, program_name: str,
                                      start: date | None, end: date | None, duration: str,
                                      certificate_number: str, issued_date: date) -> bytes:
    """Fill the approved Internship Completion Certificate artwork (app/assets/templates/completion_certificate.pdf)."""
    from app.services.document_templates import CompletionData, render_completion
    return render_completion(CompletionData(
        student_name=student_name, program_name=program_name, duration=duration, student_number=student_number or "",
        start_date=start, end_date=end, issue_date=issued_date, certificate_number=certificate_number,
        credential_url=credential_url(certificate_number)))


def credential_url(certificate_number: str) -> str:
    """Public page where anyone (e.g. an employer) can confirm this certificate is genuine."""
    from app.core.config import settings
    return f"{settings.STUDENT_PORTAL_URL.rstrip('/')}/verify/{certificate_number}"
