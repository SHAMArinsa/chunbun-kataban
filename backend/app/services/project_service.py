from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.project import PROJECT_MAX_ATTEMPTS, Project, ProjectSubmission


def check_project_submission_eligibility(db: Session, project: Project, student_id: int) -> int:
    closed = (
        db.query(ProjectSubmission)
        .filter(
            ProjectSubmission.project_id == project.id,
            ProjectSubmission.student_id == student_id,
            ProjectSubmission.admin_marked_status == "closed",
        )
        .first()
    )
    if closed is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This project has already been graded as passed — no further submissions are needed.")

    total = (
        db.query(ProjectSubmission)
        .filter(ProjectSubmission.project_id == project.id, ProjectSubmission.student_id == student_id)
        .count()
    )
    if total >= PROJECT_MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Maximum attempts ({PROJECT_MAX_ATTEMPTS}) reached for this project")

    if total > 0:
        latest = (
            db.query(ProjectSubmission)
            .filter(ProjectSubmission.project_id == project.id, ProjectSubmission.student_id == student_id)
            .order_by(ProjectSubmission.id.desc())
            .first()
        )
        if latest.admin_marked_status != "retake":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You've already submitted this project. Wait for it to be graded, or for the admin to enable a retake.",
            )

    return total + 1


def start_project_attempt(db: Session, project: Project, student_id: int) -> ProjectSubmission:
    """Resumes an in-progress (not-yet-submitted) attempt if one exists, otherwise starts a fresh
    one — subject to the same max-attempts/retake rules as check_project_submission_eligibility.
    Projects have no time limit, unlike coding assignments."""
    existing = (
        db.query(ProjectSubmission)
        .filter(
            ProjectSubmission.project_id == project.id,
            ProjectSubmission.student_id == student_id,
            ProjectSubmission.status == "in_progress",
        )
        .order_by(ProjectSubmission.id.desc())
        .first()
    )
    if existing is not None:
        return existing

    attempt_number = check_project_submission_eligibility(db, project, student_id)

    submission = ProjectSubmission(
        project_id=project.id,
        student_id=student_id,
        attempt_number=attempt_number,
        status="in_progress",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission
