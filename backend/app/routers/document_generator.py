"""On-demand administrative document generation.

This route deliberately does not publish the generated document to a student or
email it.  It is a private admin preview/download tool; final documents can
still be uploaded through the Certificates & Invoices page when appropriate.
"""
from io import BytesIO
from pathlib import Path
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pypdf import PdfReader, PdfWriter
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.people import Admin, Student
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.services.certificate_service import (
    generate_certificate_number,
    get_welcome_certificate_issue_date,
    render_certificate_pdf,
    render_welcome_certificate_pdf,
)
from app.services.email_service import build_payment_invoice_pdf
from app.utils.file_validation import read_and_validate_upload
from app.core.config import settings


router = APIRouter(prefix="/api/document-generator", tags=["document generator"])

DOCUMENT_TYPES = {"invoice", "welcome_certificate", "internship_certificate"}
WELCOME_TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "assets" / "welcome_certificate_template.pdf"


def _safe_filename_part(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return value or "student"


def _latest_enrollment(db: Session, student_id: int) -> ProgramEnrollment:
    enrollment = (
        db.query(ProgramEnrollment)
        .filter(ProgramEnrollment.student_id == student_id)
        .order_by(ProgramEnrollment.enrolled_at.desc(), ProgramEnrollment.id.desc())
        .first()
    )
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected student has no enrollment")
    return enrollment


def _template_values(student: Student, program: InternshipProgram, enrollment: ProgramEnrollment, payment: Payment | None) -> dict[str, str]:
    # Dates always originate from persisted student/enrollment/payment records.
    enrolled_on = enrollment.enrolled_at.date() if enrollment.enrolled_at else enrollment.start_date
    issue_date = (payment.paid_at.date() if payment and payment.paid_at else enrolled_on) or enrollment.expected_end_date
    duration = f"{program.duration_weeks} {'Week' if program.duration_weeks == 1 else 'Weeks'}"
    return {
        "student_name": student.full_name,
        "program_name": program.name,
        "student_id": f"ARINSA-SD-{student.student_number}",
        "enrollment_date": enrolled_on.strftime("%d %b %Y") if enrolled_on else "",
        "program_duration": duration,
        "start_date": enrollment.start_date.strftime("%d %b %Y") if enrollment.start_date else "",
        "date_of_issue": issue_date.strftime("%d %b %Y") if issue_date else "",
        "invoice_number": payment.invoice_number if payment and payment.invoice_number else "",
        "amount": f"{payment.currency} {payment.total_amount}" if payment else "",
    }


def _fill_uploaded_template(pdf_bytes: bytes, values: dict[str, str]) -> bytes:
    reader = PdfReader(BytesIO(pdf_bytes))
    fields = reader.get_fields() or {}
    usable_fields = set(fields).intersection(values)
    if not usable_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The uploaded template must be a fillable PDF with at least one supported field: "
                "student_name, program_name, student_id, enrollment_date, program_duration, "
                "start_date, date_of_issue, invoice_number, or amount."
            ),
        )
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    writer.update_page_form_field_values(None, {name: values[name] for name in usable_fields}, auto_regenerate=True)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


@router.get("/templates")
def list_templates(admin: Admin = Depends(get_current_admin)):
    return [
        {
            "id": "default-invoice",
            "document_type": "invoice",
            "name": "ARINSA Invoice - Default",
            "description": "Database-driven invoice layout.",
        },
        {
            "id": "default-welcome",
            "document_type": "welcome_certificate",
            "name": "ARINSA Welcome Certificate - Blank",
            "description": "Approved blank welcome-certificate artwork with dynamic student fields.",
        },
        {
            "id": "default-internship",
            "document_type": "internship_certificate",
            "name": "ARINSA Internship Certificate - Default",
            "description": "Database-driven internship completion certificate layout.",
        },
    ]


@router.post("/generate")
async def generate_document(
    student_id: int = Form(...),
    document_type: str = Form(...),
    template_id: str = Form("default"),
    template_file: UploadFile | None = File(None),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported document type")
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    enrollment = _latest_enrollment(db, student.id)
    program = db.get(InternshipProgram, enrollment.program_id)
    if program is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The student's program was not found")
    payment = (
        db.query(Payment)
        .filter(Payment.enrollment_id == enrollment.id, Payment.status == "paid")
        .order_by(Payment.paid_at.desc(), Payment.id.desc())
        .first()
    )

    if template_file is not None:
        content, _ = await read_and_validate_upload(template_file, settings.MAX_UPLOAD_SIZE_MB)
        if not (template_file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Custom templates must be PDF files")
        pdf_bytes = _fill_uploaded_template(content, _template_values(student, program, enrollment, payment))
    elif document_type == "invoice":
        if payment is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No payment exists for this student's enrollment")
        _number, pdf_bytes = build_payment_invoice_pdf(student_name=student.full_name, program_name=program.name, payment=payment)
    elif document_type == "welcome_certificate":
        if not WELCOME_TEMPLATE_PATH.exists():
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Welcome certificate template is missing")
        issue_date = get_welcome_certificate_issue_date(db, enrollment)
        pdf_bytes = render_welcome_certificate_pdf(
            student, program, enrollment, generate_certificate_number("welcome"), issue_date
        )
    else:
        issue_date = get_welcome_certificate_issue_date(db, enrollment)
        pdf_bytes = render_certificate_pdf(
            student.full_name, program.name, "internship_completion", generate_certificate_number("internship"), issue_date
        )

    type_part = document_type.replace("_", "_")
    filename = f"{type_part}_{_safe_filename_part(student.full_name)}_{_safe_filename_part(program.name)}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"', "X-Generated-Filename": filename},
    )
