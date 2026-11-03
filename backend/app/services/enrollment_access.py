"""Resource-scoped authorization. These checks never backfill legacy records."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.people import Student
from app.models.program import ACTIVE_ENROLLMENT_STATUSES, ProgramEnrollment


def authorize_enrollment(
    db: Session, student: Student, program_id: int | None,
    enrollment_id: int | None = None, *, require_active: bool = True,
) -> ProgramEnrollment:
    query = db.query(ProgramEnrollment).filter(ProgramEnrollment.student_id == student.id)
    if enrollment_id is not None:
        query = query.filter(ProgramEnrollment.id == enrollment_id)
    if program_id is not None:
        query = query.filter(ProgramEnrollment.program_id == program_id)
    elif enrollment_id is None:
        raise HTTPException(403, "Resource has no verifiable program")
    matches = query.all()
    if len(matches) != 1:
        raise HTTPException(404, "Enrollment not found")
    enrollment = matches[0]
    if require_active and enrollment.status not in ACTIVE_ENROLLMENT_STATUSES:
        raise HTTPException(403, "This enrollment does not permit academic access. Contact Support.")
    return enrollment


def authorize_submission(db: Session, student: Student, submission, definition) -> ProgramEnrollment:
    if submission is None or submission.student_id != student.id or definition is None:
        raise HTTPException(404, "Submission not found")
    return authorize_enrollment(db, student, definition.program_id, getattr(submission, "enrollment_id", None))
