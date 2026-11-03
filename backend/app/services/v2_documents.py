"""Invoice / certificate generation and durable e-mail delivery (outbox).

Flow after a successful payment (spec 1.2 / 2.1):
  payment paid -> enrollment active -> invoice artifact + Welcome Certificate ->
  two DocumentDelivery rows (pending) -> dispatched after the DB commit.
Failed or pending payments never reach this code. Each send attempt is recorded
in delivery_attempts (append-only); failed deliveries can be retried by staff.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.auth import User
from app.models.engagement import Certificate
from app.models.people import Student
from app.models.portal_v2 import CertificateEvent, DeliveryAttempt, DocumentDelivery, InvoiceArtifact
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.services import storage
from app.services.certificate_service import (
    ensure_welcome_certificate, generate_certificate_number, render_completion_certificate_pdf,
)
from app.services.email_service import build_payment_invoice_pdf, send_email
from app.services.notification_service import notify_student
from app.services.v2 import activate_v2_enrollment, ensure_track, today as _today

logger = logging.getLogger("v2.documents")


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------------------------------------------------ invoice
def ensure_invoice_artifact(db: Session, payment: Payment) -> InvoiceArtifact:
    existing = db.query(InvoiceArtifact).filter(InvoiceArtifact.payment_id == payment.id).first()
    if existing:
        return existing
    enrollment = db.get(ProgramEnrollment, payment.enrollment_id)
    student = db.get(Student, payment.student_id)
    program = db.get(InternshipProgram, enrollment.program_id)
    number, pdf = build_payment_invoice_pdf(student_name=student.full_name, program_name=program.name, payment=payment)
    artifact = InvoiceArtifact(payment_id=payment.id, student_id=student.id, enrollment_id=enrollment.id,
                               program_id=program.id, file_path=storage.save(pdf, "invoices", f"{number}.pdf"))
    db.add(artifact)
    db.flush()
    return artifact


# ------------------------------------------------------------------ deliveries
def queue_delivery(db: Session, *, student: Student, enrollment_id: int | None, document_type: str,
                   certificate: Certificate | None = None, invoice: InvoiceArtifact | None = None) -> DocumentDelivery:
    recipient = db.get(User, student.user_id).email
    if certificate is not None:
        key = f"certificate:{certificate.id}:{recipient}"
        existing = db.query(DocumentDelivery).filter(DocumentDelivery.certificate_id == certificate.id,
                                                     DocumentDelivery.recipient == recipient).first()
    else:
        key = f"invoice:{invoice.id}:{recipient}"
        existing = db.query(DocumentDelivery).filter(DocumentDelivery.invoice_artifact_id == invoice.id,
                                                     DocumentDelivery.recipient == recipient).first()
    if existing:
        if existing.status in ("failed", "cancelled", "sent"):
            existing.status = "pending"  # explicit resend request
            existing.available_at = _now()
        return existing
    delivery = DocumentDelivery(idempotency_key=key, student_id=student.id, enrollment_id=enrollment_id,
                                document_type=document_type, certificate_id=certificate.id if certificate else None,
                                invoice_artifact_id=invoice.id if invoice else None, recipient=recipient)
    db.add(delivery)
    db.flush()
    return delivery


def _message_for(db: Session, delivery: DocumentDelivery) -> tuple[str, str, tuple[str, bytes, str]]:
    student = db.get(Student, delivery.student_id)
    if delivery.invoice_artifact_id:
        artifact = db.get(InvoiceArtifact, delivery.invoice_artifact_id)
        payment = db.get(Payment, artifact.payment_id)
        program = db.get(InternshipProgram, artifact.program_id)
        pdf = _read(artifact.file_path)
        subject = f"Payment confirmed - Invoice {payment.invoice_number} - {program.name}"
        body = (f"Hi {student.full_name},\n\nThank you for enrolling in {program.name}. Your payment has been "
                f"confirmed and your enrollment is now active.\n\nInvoice number: {payment.invoice_number}\n"
                f"Amount paid: {payment.currency} {payment.total_amount}\n\nYour invoice is attached.\n\nARINSA AI MINDS")
        return subject, body, (f"Invoice-{payment.invoice_number}.pdf", pdf, "pdf")
    cert = db.get(Certificate, delivery.certificate_id)
    program = db.get(InternshipProgram, cert.program_id)
    pdf = _read(cert.file_path)
    if cert.certificate_type == "welcome":
        subject = f"Welcome to {program.name} - ARINSA AI MINDS"
        body = (f"Hi {student.full_name},\n\nWelcome to {program.name}! Your Welcome Certificate is attached. "
                "You can also find it anytime in the Certificates section of your Student Portal.\n\n"
                f"Student ID: {student.student_number}\n\nARINSA AI MINDS")
    else:
        subject = f"Your {program.name} Completion Certificate"
        body = (f"Hi {student.full_name},\n\nCongratulations on completing {program.name}. Your certificate "
                f"({cert.certificate_number}) is attached and available in your Student Portal.\n\nARINSA AI MINDS")
    return subject, body, (f"{cert.certificate_number}.pdf", pdf, "pdf")


def _read(path: str) -> bytes:
    if settings.STORAGE_PROVIDER == "local":
        return storage.resolve(path).read_bytes()
    response = storage.download_response(path, "document.pdf", "application/pdf")
    return response.body


def dispatch(db: Session, delivery: DocumentDelivery) -> DocumentDelivery:
    """One send attempt. Caller commits."""
    if delivery.status == "sent":
        return delivery
    number = delivery.attempt_count + 1
    delivery.attempt_count = number
    delivery.last_attempt_at = _now()
    try:
        if not settings.SMTP_HOST:
            raise RuntimeError("Email (SMTP) is not configured on the server; nothing was sent.")
        subject, body, attachment = _message_for(db, delivery)
        send_email(delivery.recipient, subject, body, attachment)
    except Exception as exc:  # noqa: BLE001 - any failure is recorded and retryable
        logger.warning("Delivery %s failed: %s", delivery.id, exc)
        delivery.status = "failed"
        delivery.error_message = str(exc)[:1000]
        db.add(DeliveryAttempt(delivery_id=delivery.id, attempt_number=number, status="failed", error_message=str(exc)[:1000]))
    else:
        delivery.status = "sent"
        delivery.sent_at = _now()
        delivery.error_message = None
        db.add(DeliveryAttempt(delivery_id=delivery.id, attempt_number=number, status="sent"))
    db.add(delivery)
    db.flush()
    return delivery


def dispatch_pending(db: Session, delivery_ids: list[int]) -> None:
    for delivery_id in delivery_ids:
        delivery = db.get(DocumentDelivery, delivery_id)
        if delivery is not None and delivery.status == "pending":
            dispatch(db, delivery)
    db.commit()


# ------------------------------------------------------------------ payment success hook
def on_payment_paid(db: Session, payment: Payment) -> list[int]:
    """Runs inside the payment transaction. Returns delivery ids to dispatch after commit."""
    enrollment = db.get(ProgramEnrollment, payment.enrollment_id)
    if enrollment is None or enrollment.status not in ("active", "completed"):
        return []
    if enrollment.workflow_policy_id is not None:
        if enrollment.start_date is None or enrollment.original_end_date is None:
            activate_v2_enrollment(db, enrollment)
        ensure_track(db, enrollment)
    student = db.get(Student, payment.student_id)
    invoice = ensure_invoice_artifact(db, payment)
    welcome = ensure_welcome_certificate(db, enrollment)
    ids = [queue_delivery(db, student=student, enrollment_id=enrollment.id, document_type="invoice", invoice=invoice).id]
    if welcome is not None:
        db.flush()
        if welcome.status is None:
            welcome.status, welcome.generated_at, welcome.issued_at = "issued", _now(), _now()
            db.add(CertificateEvent(certificate_id=welcome.id, action="issued", file_path=welcome.file_path,
                                    snapshot={"type": "welcome", "number": welcome.certificate_number}, reason="Automatic on payment"))
        ids.append(queue_delivery(db, student=student, enrollment_id=enrollment.id, document_type="welcome_certificate",
                                  certificate=welcome).id)
    notify_student(db, student, "Enrollment active",
                   "Your payment was received. Your invoice and Welcome Certificate have been emailed to you.",
                   "payment", "/dashboard")
    return ids


# ------------------------------------------------------------------ completion certificates
def completion_pdf(student: Student, program: InternshipProgram, number: str, issued: date,
                   enrollment: ProgramEnrollment | None = None) -> bytes:
    n, unit = (program.duration or program.duration_weeks), (program.duration_unit or "weeks")
    label = unit.rstrip("s").capitalize() + ("" if n == 1 else "s")
    return render_completion_certificate_pdf(
        student_name=student.full_name, student_number=student.student_number, program_name=program.name,
        start=enrollment.start_date if enrollment else None, end=enrollment.expected_end_date if enrollment else None,
        duration=f"{n} {label}", certificate_number=number, issued_date=issued)


def issue_completion_certificate(db: Session, enrollment: ProgramEnrollment, actor: User, staff_profile_id: int) -> Certificate:
    student = db.get(Student, enrollment.student_id)
    program = db.get(InternshipProgram, enrollment.program_id)
    number = generate_certificate_number("internship_completion")
    issued = _today()
    pdf = completion_pdf(student, program, number, issued, enrollment)
    cert = Certificate(student_id=student.id, enrollment_id=enrollment.id, certificate_type="internship_completion",
                       program_id=program.id, file_path=storage.save(pdf, "certificates", f"{number}.pdf"),
                       certificate_number=number, issued_date=issued, issued_by=staff_profile_id,
                       status="issued", generated_at=_now(), issued_at=_now())
    db.add(cert)
    db.flush()
    snapshot = {"type": "internship_completion", "number": number, "student": student.full_name,
                "student_number": student.student_number, "program": program.name, "issued": issued.isoformat()}
    db.add(CertificateEvent(certificate_id=cert.id, action="generated", file_path=cert.file_path, snapshot=snapshot, performed_by=actor.id))
    db.add(CertificateEvent(certificate_id=cert.id, action="issued", file_path=cert.file_path, snapshot=snapshot, performed_by=actor.id))
    notify_student(db, student, "Certificate issued", f"Your {program.name} completion certificate is ready.", "certificate", "/certificates")
    return cert


def revoke_certificate(db: Session, cert: Certificate, actor: User, reason: str) -> None:
    cert.status = "revoked"
    cert.revoked_at = _now()
    cert.revoked_by = actor.id
    cert.revocation_reason = reason
    db.add(CertificateEvent(certificate_id=cert.id, action="revoked", file_path=cert.file_path, reason=reason, performed_by=actor.id))
    for d in db.query(DocumentDelivery).filter(DocumentDelivery.certificate_id == cert.id, DocumentDelivery.status == "pending"):
        d.status = "cancelled"
