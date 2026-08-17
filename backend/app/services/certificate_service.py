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


def render_welcome_certificate_pdf(student_name: str, program_name: str, certificate_number: str, issued_date: date) -> bytes:
    """Place the student's details over the approved Welcome Certificate artwork."""
    if not WELCOME_TEMPLATE_PATH.exists():
        raise RuntimeError("Welcome certificate template is missing")

    template = PdfReader(str(WELCOME_TEMPLATE_PATH))
    page = template.pages[0]
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)

    overlay = BytesIO()
    c = canvas.Canvas(overlay, pagesize=(width, height))
    # The approved blank artwork reserves these two fields: student name and
    # registered program. No other template content is changed per student.
    # Cover the source document's remaining placeholder fragments inside the
    # name panel while preserving its gold underline.
    c.setFillColor(HexColor("#FFFFFF"))
    c.rect(width * 0.22, height * 0.500, width * 0.56, height * 0.135, stroke=0, fill=1)
    c.setStrokeColor(HexColor("#C89D44"))
    c.setLineWidth(0.8)
    c.line(width * 0.27, height * 0.535, width * 0.73, height * 0.535)
    c.setFillColor(HexColor("#FFFFFF"))
    c.rect(width * 0.33, height * 0.620, width * 0.34, height * 0.065, stroke=0, fill=1)
    c.setFillColor(HexColor("#071C56"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height * 0.650, "This is to certify that")
    c.setFillColor(HexColor("#071C56"))
    _fit_text(c, student_name, width * 0.56, 31)
    c.drawCentredString(width / 2, height * 0.588, student_name)

    c.setFillColor(HexColor("#10285C"))
    program_label = program_name.upper()
    size = 18
    while size > 11 and stringWidth(program_label, "Helvetica-Bold", size) > width * 0.27:
        size -= 1
    c.setFont("Helvetica-Bold", size)
    c.drawCentredString(width / 2, height * 0.455, program_label)
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
    pdf_bytes = render_welcome_certificate_pdf(student.full_name, program.name, certificate_number, date.today())
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
        return render_welcome_certificate_pdf(student_name, program_name, certificate_number, issued_date)
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
