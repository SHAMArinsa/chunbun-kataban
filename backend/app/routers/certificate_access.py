"""Audited read-only certificate surface; legacy issuance router stays disconnected."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import require_academic_role, get_current_student
from app.models.auth import User
from app.models.engagement import Certificate
from app.models.program import ProgramEnrollment, ACTIVE_ENROLLMENT_STATUSES
from app.schemas.certificate import CertificateOut
from app.services.enrollment_access import authorize_enrollment
from app.services.storage import download_response

router = APIRouter(prefix="/api/certificates", tags=["certificates"])


@router.get("", response_model=list[CertificateOut])
def list_certificates(db: Session = Depends(get_db), user: User = Depends(require_academic_role)):
    query = db.query(Certificate)
    if user.role.name == "student":
        student = get_current_student(user, db)
        query = query.join(ProgramEnrollment, ProgramEnrollment.id == Certificate.enrollment_id).filter(
            Certificate.student_id == student.id, ProgramEnrollment.student_id == student.id,
            ProgramEnrollment.program_id == Certificate.program_id,
            ProgramEnrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
    return query.order_by(Certificate.id.desc()).all()


@router.get("/{certificate_id}/download")
def download_certificate(certificate_id: int, db: Session = Depends(get_db), user: User = Depends(require_academic_role)):
    row = db.get(Certificate, certificate_id)
    if row is None or (user.role.name == "student" and (user.student is None or row.student_id != user.student.id)):
        raise HTTPException(404, "Certificate not found")
    if user.role.name == "student":
        authorize_enrollment(db, user.student, row.program_id, row.enrollment_id)
    if row.revoked_at is not None or row.status == "revoked":
        raise HTTPException(403, "Certificate is revoked")
    return download_response(row.file_path, filename=f"{row.certificate_number}.pdf", media_type="application/pdf")


# ---------------------------------------------------------------- public credential check (no login)
public_router = APIRouter(prefix="/api/public", tags=["public"])


@public_router.get("/credentials/{credential_id}")
def verify_credential(credential_id: str, db: Session = Depends(get_db)):
    """Anyone with a Credential ID can confirm it. Only the details printed on the certificate are returned."""
    from app.models.people import Student
    from app.models.program import InternshipProgram
    cert = (db.query(Certificate)
            .filter(Certificate.certificate_number == credential_id.strip(),
                    Certificate.certificate_type == "internship_completion").first())
    if cert is None:
        raise HTTPException(404, "No certificate found with this Credential ID")
    student = db.get(Student, cert.student_id)
    program = db.get(InternshipProgram, cert.program_id)
    enrollment = db.get(ProgramEnrollment, cert.enrollment_id) if cert.enrollment_id else None
    n, unit = (program.duration or program.duration_weeks), (program.duration_unit or "weeks")
    revoked = cert.status == "revoked"
    return {
        "credential_id": cert.certificate_number,
        "status": "revoked" if revoked else "valid",
        "student_name": student.full_name if student else None,
        "student_id": student.student_number if student else None,
        "program": program.name if program else None,
        "duration": f"{n} {unit.rstrip('s').capitalize()}{'' if n == 1 else 's'}" if program else None,
        "start_date": enrollment.start_date if enrollment else None,
        "end_date": enrollment.expected_end_date if enrollment else None,
        "issued_date": cert.issued_date,
        "issuer": "ARINSA AI MINDS PRIVATE LIMITED",
    }
