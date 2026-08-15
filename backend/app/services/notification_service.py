from sqlalchemy.orm import Session

from app.models.engagement import Notification
from app.models.people import Student
from app.models.program import ACTIVE_ENROLLMENT_STATUSES, BatchMember, ProgramEnrollment


def notify_user(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "info",
    link_url: str | None = None,
) -> None:
    """Queues a notification for a single user. Does not commit — caller owns the transaction."""
    db.add(Notification(recipient_user_id=user_id, title=title, message=message, notification_type=notification_type, link_url=link_url))


def notify_students(
    db: Session,
    student_ids: list[int],
    title: str,
    message: str,
    notification_type: str = "info",
    link_url: str | None = None,
) -> None:
    if not student_ids:
        return
    user_ids = [
        row.user_id
        for row in db.query(Student.user_id).filter(Student.id.in_(set(student_ids))).all()
    ]
    for user_id in user_ids:
        notify_user(db, user_id, title, message, notification_type, link_url)


def notify_student(db: Session, student: Student, title: str, message: str, notification_type: str = "info", link_url: str | None = None) -> None:
    notify_user(db, student.user_id, title, message, notification_type, link_url)


def student_ids_for_assignment_scope(db: Session, student_id: int | None, batch_id: int | None, program_id: int | None) -> list[int]:
    if student_id is not None:
        return [student_id]
    if batch_id is not None:
        return [row.student_id for row in db.query(BatchMember.student_id).filter(BatchMember.batch_id == batch_id).all()]
    if program_id is not None:
        return [
            row.student_id
            for row in db.query(ProgramEnrollment.student_id)
            .filter(ProgramEnrollment.program_id == program_id, ProgramEnrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
            .all()
        ]
    return []
