import random

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.assessment import AssignmentSubmission, CodingAssignment, CodingProblem, CodingProblemSheet, CodingSheetAssignment


def check_submission_eligibility(db: Session, coding_assignment: CodingAssignment, student_id: int) -> int:
    closed = (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.coding_assignment_id == coding_assignment.id,
            AssignmentSubmission.student_id == student_id,
            AssignmentSubmission.admin_marked_status == "closed",
        )
        .first()
    )
    if closed is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You have already passed this coding assignment — no further submissions are needed.")

    total = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.coding_assignment_id == coding_assignment.id, AssignmentSubmission.student_id == student_id)
        .count()
    )
    if total >= coding_assignment.max_attempts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Maximum attempts ({coding_assignment.max_attempts}) reached for this coding assignment")

    return total + 1


def start_attempt(db: Session, coding_assignment: CodingAssignment, student_id: int) -> AssignmentSubmission:
    """Resumes an in-progress (not-yet-submitted) attempt if one exists, otherwise starts a fresh
    one — subject to the same max-attempts/retake rules as check_submission_eligibility. Coding
    assignments have no time limit."""
    existing = (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.coding_assignment_id == coding_assignment.id,
            AssignmentSubmission.student_id == student_id,
            AssignmentSubmission.status == "in_progress",
        )
        .order_by(AssignmentSubmission.id.desc())
        .first()
    )
    if existing is not None:
        return existing

    visible_problems_for_student(db, coding_assignment, student_id)  # ensures auto-assignment happened
    attempt_number = check_submission_eligibility(db, coding_assignment, student_id)

    submission = AssignmentSubmission(
        coding_assignment_id=coding_assignment.id,
        student_id=student_id,
        attempt_number=attempt_number,
        status="in_progress",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def visible_problems_for_student(db: Session, coding_assignment: CodingAssignment, student_id: int) -> list[CodingProblem]:
    """If this coding assignment has any problem sheets at all (each uploaded doc = one sheet),
    it's in per-student assignment mode: the student only sees problems from the sheet(s)
    assigned to them, not the whole batch. Coding assignments with no sheets yet (only
    manually-added problems) keep the original shared-pool behavior, showing every problem tied
    to the assignment.

    For Basic/Professional/Premium (domain_id is None), a student with no sheet assignment yet
    is auto-assigned one random sheet from the batch the first time they're looked up here — a
    lightweight "5 docs randomly distributed across every enrolled student" model that needs no
    manual admin action. Platinum (domain_id set) never auto-assigns: admin must explicitly pick
    which sheet goes to which student via POST /sheets/{sheet_id}/assign."""
    # The work item is cross-tier, but uploaded question sheets are still assigned
    # individually by the administrator.
    has_sheets = db.query(CodingProblemSheet.id).filter(
        CodingProblemSheet.coding_assignment_id == coding_assignment.id
    ).first() is not None

    if not has_sheets:
        return db.query(CodingProblem).filter(CodingProblem.coding_assignment_id == coding_assignment.id).order_by(CodingProblem.problem_number).all()

    assigned_sheet_ids = [
        row.sheet_id
        for row in db.query(CodingSheetAssignment.sheet_id)
        .join(CodingProblemSheet, CodingProblemSheet.id == CodingSheetAssignment.sheet_id)
        .filter(CodingProblemSheet.coding_assignment_id == coding_assignment.id, CodingSheetAssignment.student_id == student_id)
    ]

    if not assigned_sheet_ids:
        return []
    return db.query(CodingProblem).filter(CodingProblem.sheet_id.in_(assigned_sheet_ids)).order_by(CodingProblem.problem_number).all()
