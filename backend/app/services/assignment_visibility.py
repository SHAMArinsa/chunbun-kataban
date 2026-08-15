from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.people import Student
from app.models.program import ACTIVE_ENROLLMENT_STATUSES, BatchMember, ProgramEnrollment


def active_program_ids_for_student(db: Session, student_id: int) -> list[int]:
    """Program ids the student has a paid (active or completed) enrollment in.
    Deliberately excludes pending_payment/dropped/suspended — content and quiz access is gated on payment."""
    return [
        row.program_id
        for row in db.query(ProgramEnrollment.program_id).filter(
            ProgramEnrollment.student_id == student_id,
            ProgramEnrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
        )
    ]


def visible_ids_for_student(db: Session, student: Student, assignment_model, id_field_name: str) -> list[int]:
    """Returns the set of parent-resource ids (material_id/coding_assignment_id/project_id) visible
    to this student, based on individual/batch/program assignment scope. Program-scoped assignments
    only count for programs the student has actually paid for (active/completed enrollment)."""
    enrolled_program_ids = active_program_ids_for_student(db, student.id)
    batch_ids = [row.batch_id for row in db.query(BatchMember.batch_id).filter(BatchMember.student_id == student.id)]

    id_field = getattr(assignment_model, id_field_name)
    conditions = [
        assignment_model.student_id == student.id,
    ]
    if batch_ids:
        conditions.append(assignment_model.batch_id.in_(batch_ids))
    if enrolled_program_ids:
        conditions.append(assignment_model.program_id.in_(enrolled_program_ids))

    rows = db.query(id_field).filter(or_(*conditions)).distinct().all()
    return [r[0] for r in rows]
