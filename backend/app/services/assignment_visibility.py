from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.people import Student
from app.models.program import ACTIVE_ENROLLMENT_STATUSES, BatchMember, ProgramEnrollment
from app.models.assessment import CodingAssignment
from app.models.content import LearningMaterial
from app.models.project import Project


def active_program_ids_for_student(db: Session, student_id: int) -> list[int]:
    """Program ids the student has a paid (active or completed) enrollment in.
    Deliberately excludes pending_payment/dropped/suspended — content and quiz access is gated on payment."""
    from sqlalchemy import or_ as _or
    from app.services.v2 import today as _v2_today

    return [
        row.program_id
        for row in db.query(ProgramEnrollment.program_id).filter(
            ProgramEnrollment.student_id == student_id,
            ProgramEnrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
            # Portal V2 access windows expire unless an Admin extends them. Legacy
            # enrollments (no workflow policy) keep their previous behaviour.
            _or(ProgramEnrollment.workflow_policy_id.is_(None), ProgramEnrollment.expected_end_date.is_(None),
                ProgramEnrollment.expected_end_date >= _v2_today()),
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

    # An individual/batch assignment is visibility, not an enrollment entitlement.
    parent = {"material_id": LearningMaterial, "coding_assignment_id": CodingAssignment,
              "project_id": Project}[id_field_name]
    query = db.query(id_field).join(parent, parent.id == id_field).filter(
        or_(*conditions), parent.program_id.in_(enrolled_program_ids))
    if hasattr(assignment_model, "enrollment_id"):
        enrollment_ids = db.query(ProgramEnrollment.id).filter(
            ProgramEnrollment.student_id == student.id,
            ProgramEnrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
            ProgramEnrollment.program_id == parent.program_id,
        )
        query = query.filter(or_(assignment_model.enrollment_id.is_(None),
                                 assignment_model.enrollment_id.in_(enrollment_ids)))
    if parent is LearningMaterial:
        query = query.filter(parent.publication_state == "published")
    rows = query.distinct().all()
    return [r[0] for r in rows]
