import uuid
from datetime import date
from io import BytesIO
from pathlib import Path

from reportlab.lib.colors import HexColor
from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.engagement import Certificate
from app.models.people import Student
from app.models.program import InternshipProgram, ProgramEnrollment
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


def render_welcome_certificate_pdf(
    student: Student,
    program: InternshipProgram,
    enrollment: ProgramEnrollment,
    certificate_number: str,
    issued_date: date,
) -> bytes:
    """Place enrollment-specific values into the approved Welcome Certificate artwork."""
    if not WELCOME_TEMPLATE_PATH.exists():
        raise RuntimeError("Welcome certificate template is missing")

    template = PdfReader(str(WELCOME_TEMPLATE_PATH))
    page = template.pages[0]
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)

    overlay = BytesIO()
    c = canvas.Canvas(overlay, pagesize=(width, height))
    enrolled_on = enrollment.enrolled_at.date() if enrollment.enrolled_at else issued_date
    start_on = enrollment.start_date or enrolled_on
    student_id = f"ARINSA-SD-{student.id:04d}"
    duration = f"{program.duration_weeks} {'Week' if program.duration_weeks == 1 else 'Weeks'}"

    # The supplied artwork deliberately leaves these fields empty.  Coordinates are expressed
    # as proportions so the overlay remains aligned if the template page size changes slightly.
    c.setFillColor(HexColor("#071C56"))
    _fit_text(c, student.full_name, width * 0.52, 30)
    c.drawCentredString(width / 2, height * 0.570, student.full_name)

    c.setFillColor(HexColor("#10285C"))
    program_label = program.name.upper()
    size = 17
    while size > 10 and stringWidth(program_label, "Helvetica-Bold", size) > width * 0.43:
        size -= 1
    c.setFont("Helvetica-Bold", size)
    c.drawCentredString(width / 2, height * 0.445, program_label)

    c.setFillColor(HexColor("#10285C"))
    c.setFont("Helvetica-Bold", 10)
    for x, value in (
        (0.225, student_id),
        (0.425, _display_date(enrolled_on)),
        (0.600, duration),
        (0.795, _display_date(start_on)),
    ):
        c.drawCentredString(width * x, height * 0.250, value)

    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width * 0.665, height * 0.140, _display_date(issued_date))

    c.save()

    page.merge_page(PdfReader(overlay).pages[0])
    writer = PdfWriter()
    writer.add_page(page)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


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
    pdf_bytes = render_welcome_certificate_pdf(student, program, enrollment, certificate_number, date.today())
    certificate = Certificate(
        student_id=student.id,
        enrollment_id=enrollment.id,
        certificate_type="welcome",
        program_id=program.id,
        file_path=save(pdf_bytes, "certificates", f"{certificate_number}.pdf"),
        certificate_number=certificate_number,
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
