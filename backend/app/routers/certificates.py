from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, require_any_role
from app.models.people import Admin, Student
from app.models.program import InternshipProgram, ProgramEnrollment
from app.models.engagement import Certificate
from app.schemas.certificate import CertificateGenerateRequest, CertificateOut
from app.services.activity_log_service import log_activity
from app.services.certificate_service import ensure_welcome_certificate, generate_certificate_number, render_certificate_pdf, render_welcome_certificate_pdf
from app.services.storage import delete as delete_file, download_response, save

router = APIRouter(prefix="/api/certificates", tags=["certificates"])


@router.post("", response_model=CertificateOut, status_code=status.HTTP_201_CREATED)
def generate_certificate(payload: CertificateGenerateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    student = db.get(Student, payload.student_id)
    enrollment = db.get(ProgramEnrollment, payload.enrollment_id)
    if student is None or enrollment is None or enrollment.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student or enrollment not found")
    program = db.get(InternshipProgram, enrollment.program_id)

    cert_number = generate_certificate_number(payload.certificate_type)
    pdf_bytes = (
        render_welcome_certificate_pdf(student, program, enrollment, cert_number, date.today())
        if payload.certificate_type == "welcome"
        else render_certificate_pdf(student.full_name, program.name, payload.certificate_type, cert_number, date.today())
    )
    relative_path = save(pdf_bytes, "certificates", f"{cert_number}.pdf")

    certificate = Certificate(
        student_id=student.id,
        enrollment_id=enrollment.id,
        certificate_type=payload.certificate_type,
        program_id=program.id,
        file_path=relative_path,
        certificate_number=cert_number,
        issued_by=admin.id,
    )
    db.add(certificate)
    log_activity(db, admin.user_id, "admin", "generate_certificate", "certificates", None, f"{payload.certificate_type} for student {student.id}")
    db.commit()
    db.refresh(certificate)
    return certificate


@router.get("", response_model=list[CertificateOut])
def list_certificates(db: Session = Depends(get_db), role_user=Depends(require_any_role)):
    if role_user.role.name == "admin":
        return db.query(Certificate).order_by(Certificate.id.desc()).all()
    student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
    if student_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    active_enrollments = db.query(ProgramEnrollment).filter(
        ProgramEnrollment.student_id == student_row.id,
        ProgramEnrollment.status.in_(("active", "completed")),
    ).all()
    for enrollment in active_enrollments:
        ensure_welcome_certificate(db, enrollment)
    db.commit()
    return db.query(Certificate).filter(Certificate.student_id == student_row.id).order_by(Certificate.id.desc()).all()


@router.get("/{certificate_id}/download")
def download_certificate(certificate_id: int, db: Session = Depends(get_db), role_user=Depends(require_any_role)):
    certificate = db.get(Certificate, certificate_id)
    if certificate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")

    if role_user.role.name != "admin":
        student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
        if student_row is None or certificate.student_id != student_row.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your certificate")

    try:
        return download_response(certificate.file_path, filename=f"{certificate.certificate_number}.pdf", media_type="application/pdf")
    except HTTPException as exc:
        # Welcome certificates created before Blob storage was enabled can retain a database
        # record whose old local file no longer exists. Rebuild that one document from the live
        # student/enrollment data and make all later downloads use the restored Blob file.
        if exc.status_code != status.HTTP_404_NOT_FOUND or certificate.certificate_type != "welcome":
            raise

    student = db.get(Student, certificate.student_id)
    enrollment = db.get(ProgramEnrollment, certificate.enrollment_id)
    program = db.get(InternshipProgram, certificate.program_id)
    if student is None or enrollment is None or program is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate source data is unavailable")

    pdf_bytes = render_welcome_certificate_pdf(
        student, program, enrollment, certificate.certificate_number, certificate.issued_date
    )
    certificate.file_path = save(pdf_bytes, "certificates", f"{certificate.certificate_number}.pdf")
    db.add(certificate)
    db.commit()
    return download_response(certificate.file_path, filename=f"{certificate.certificate_number}.pdf", media_type="application/pdf")


@router.delete("/{certificate_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_certificate(certificate_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    certificate = db.get(Certificate, certificate_id)
    if certificate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    file_path = certificate.file_path
    db.delete(certificate)
    log_activity(db, admin.user_id, "admin", "revoke_certificate", "certificates", certificate_id, None)
    db.commit()
    delete_file(file_path)
    return None
