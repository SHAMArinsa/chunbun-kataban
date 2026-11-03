from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.engagement import Notification
from app.models.program import ACTIVE_ENROLLMENT_STATUSES, ProgramEnrollment
from app.models.proctoring import (
    ASSESSMENT_TYPE_LABELS,
    CONFIRMED_VIOLATIONS,
    SUSPICIOUS_EVENTS,
    VIOLATION_LABELS,
    ProctoringViolation,
)
from app.services.activity_log_service import log_activity

DEDUPE_WINDOW = timedelta(milliseconds=1000)

# Best-effort mapping from assessment_type -> the model/column used to look up the program_id
# a given assessment belongs to, so we can find the *relevant* active enrollment to suspend
# instead of guessing. Kept lazy/local to avoid import cycles at module load time.


def _describe_assessment(db: Session, assessment_type: str | None, assessment_id: int | None) -> str:
    """Best-effort human-readable label for the suspension-reason message, e.g. 'Quiz 3
    Question' or 'Coding Assignment "Premium Internship Coding Assessment"'. Falls back to a
    generic description if the specific title can't be looked up."""
    type_label = ASSESSMENT_TYPE_LABELS.get(assessment_type or "", "protected content")
    if not assessment_type or not assessment_id:
        return type_label

    try:
        title = None
        if assessment_type == "quiz":
            from app.models.assessment import Quiz

            row = db.get(Quiz, assessment_id)
            title = row.title if row else None
        elif assessment_type == "coding_assignment":
            from app.models.assessment import CodingAssignment

            row = db.get(CodingAssignment, assessment_id)
            title = row.title if row else None
        elif assessment_type == "project":
            from app.models.project import Project

            row = db.get(Project, assessment_id)
            title = row.title if row else None
        elif assessment_type == "material":
            from app.models.content import LearningMaterial

            row = db.get(LearningMaterial, assessment_id)
            title = row.title if row else None
        return f'{type_label} "{title}"' if title else type_label
    except Exception:
        return type_label


def _build_suspension_reason(db: Session, violation_type: str, assessment_type: str | None, assessment_id: int | None, metadata: dict) -> str:
    label = VIOLATION_LABELS.get(violation_type, violation_type.replace("_", " ").title())
    where = _describe_assessment(db, assessment_type, assessment_id)
    key_combo = (metadata or {}).get("key_combo")
    reason = f"Suspended: {label} while viewing {where}"
    if key_combo:
        reason += f" – {key_combo}"
    return reason


def _find_relevant_enrollment(db: Session, student_id: int, assessment_type: str | None, assessment_id: int | None) -> ProgramEnrollment | None:
    from app.models.assessment import Quiz, CodingAssignment
    from app.models.project import Project
    from app.models.content import LearningMaterial
    models = {"quiz": Quiz, "coding_assignment": CodingAssignment, "project": Project, "material": LearningMaterial}
    query = db.query(ProgramEnrollment).filter(ProgramEnrollment.student_id == student_id)
    if assessment_type not in (None, "file_preview") or assessment_id:
        model = models.get(assessment_type)
        resource = db.get(model, assessment_id) if model and assessment_id else None
        if resource is None or resource.program_id is None:
            return None
        query = query.filter(ProgramEnrollment.program_id == resource.program_id)
    else:
        query = query.filter(ProgramEnrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
    rows = query.all()
    # Never suspend an unrelated enrollment or guess among multiple candidates.
    return rows[0] if len(rows) == 1 else None


def record_violation(
    db: Session,
    student_id: int,
    violation_type: str,
    assessment_type: str | None,
    assessment_id: int | None,
    attempt_id: int | None,
    resource_id: str | None,
    route: str | None,
    user_agent: str | None,
    metadata: dict,
    session_code: str | None = None,
) -> dict:
    if violation_type in CONFIRMED_VIOLATIONS:
        category = "confirmed"
    elif violation_type in SUSPICIOUS_EVENTS:
        category = "suspicious"
    else:
        raise ValueError(f"Unknown violation_type: {violation_type}")

    now = datetime.now(timezone.utc)
    dedupe_cutoff = now - DEDUPE_WINDOW
    recent = (
        db.query(ProctoringViolation)
        .filter(
            ProctoringViolation.student_id == student_id,
            ProctoringViolation.violation_type == violation_type,
            ProctoringViolation.assessment_type == assessment_type,
            ProctoringViolation.assessment_id == assessment_id,
            ProctoringViolation.created_at >= dedupe_cutoff,
        )
        .order_by(ProctoringViolation.id.desc())
        .first()
    )
    if recent is not None:
        return {"recorded": False, "deduped": True, "category": category, "suspended": False}

    enrollment = _find_relevant_enrollment(db, student_id, assessment_type, assessment_id)

    violation = ProctoringViolation(
        student_id=student_id,
        enrollment_id=enrollment.id if enrollment else None,
        assessment_type=assessment_type,
        assessment_id=assessment_id,
        attempt_id=attempt_id,
        resource_id=resource_id,
        session_code=session_code,
        violation_type=violation_type,
        category=category,
        severity=category,
        route=route,
        user_agent=(user_agent or "")[:500],
        violation_metadata=metadata or {},
    )
    db.add(violation)

    suspended = False
    if category == "confirmed" and enrollment is not None and enrollment.status != "suspended":
        reason = _build_suspension_reason(db, violation_type, assessment_type, assessment_id, metadata or {})
        enrollment.status = "suspended"
        enrollment.suspension_reason = reason
        db.add(enrollment)
        log_activity(db, None, "system", "auto_suspend_proctoring_violation", "program_enrollments", enrollment.id, reason)
        db.add(
            Notification(
                recipient_role="admin",
                title="Student auto-suspended — proctoring violation",
                message=f"Student #{student_id} (enrollment #{enrollment.id}): {reason}",
                notification_type="alert",
            )
        )
        suspended = True

    # A confirmed violation ends the running quiz attempt: it is closed with 0 marks so it
    # counts as a used attempt everywhere (student page, admin MCQ results, reports).
    if category == "confirmed" and assessment_type == "quiz":
        from datetime import datetime as _dt, timezone as _tz
        from app.models.assessment import QuizAttempt
        q = db.query(QuizAttempt).filter(QuizAttempt.student_id == student_id, QuizAttempt.status == "in_progress")
        q = q.filter(QuizAttempt.id == attempt_id) if attempt_id else q.filter(QuizAttempt.quiz_id == assessment_id)
        for a in q.all():
            a.status, a.submitted_at = "auto_submitted", _dt.now(_tz.utc)
            a.correct_answers, a.score_percent, a.passed = 0, 0, False

    db.commit()
    return {"recorded": True, "deduped": False, "category": category, "suspended": suspended}
