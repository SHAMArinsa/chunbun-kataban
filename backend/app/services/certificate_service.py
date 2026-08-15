import uuid
from datetime import date
from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from app.core.config import settings

CERTIFICATE_TITLES = {
    "internship_completion": "Certificate of Internship Completion",
    "project_completion": "Certificate of Project Completion",
    "performance_evaluation": "Performance Evaluation Report",
    "recommendation": "Certificate of Recommendation",
    "platinum": "Platinum Program Certificate",
    "experience": "Certificate of Experience",
}


def generate_certificate_number(certificate_type: str) -> str:
    return f"ARINSA-{certificate_type[:4].upper()}-{uuid.uuid4().hex[:8].upper()}"


def render_certificate_pdf(student_name: str, program_name: str, certificate_type: str, certificate_number: str, issued_date: date) -> bytes:
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
