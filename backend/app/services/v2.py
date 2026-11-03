"""Portal V2 domain rules shared by the student and staff APIs.

Routing is by the enrollment's workflow policy (NULL = legacy workflow, which
keeps using the pre-V2 pages). Nothing here backfills or reinterprets legacy data.
"""
from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.assessment import Quiz, QuizAttempt
from app.models.people import Student
from app.models.portal_v2 import (
    EligibilityCriterion, EligibilityState, InternshipForm, ProgramRequirement, ProgramStage,
    ProgramWorkflowPolicy, ProjectSelection, RequirementProgress, ReviewEvent,
)
from app.models.program import InternshipProgram, ProgramEnrollment
from app.models.project import MockInterview, Project, ProjectAssignment, ProjectSubmission
from app.models.tiers import TIER_BY_CODE, TRACK_MODELS

TIER_LABELS = {
    "basic": "Basic Internship",
    "professional": "Professional Internship",
    "advanced": "Advanced Internship",
    "career": "Career Internship",
    "accelerator": "Career Accelerator",
}
TIER_CODES = {v: k for k, v in TIER_BY_CODE.items()}  # tier -> program code
SELECTION_TIERS = ("basic", "professional")
FORM_TIERS = ("advanced", "career", "accelerator")
ACCEL_INTERNSHIP_TASKS = 3
ASSIGNED_WORK_TYPES = ("task", "project", "live_project", "office_work", "internship_task")
WORK_STATUS_LABELS = {
    "in_progress": "Not submitted", "submitted": "Submitted", "under_review": "Under Review",
    "revision_requested": "Revision Required", "graded": "Completed",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Program dates (start, end, expiry, unlock) follow India time so a payment made
# at 1 a.m. IST starts that same Indian calendar day, regardless of server TZ.
BUSINESS_TZ = timezone(timedelta(hours=5, minutes=30))  # IST, no DST (no tzdata needed on Windows)


def today() -> date:
    return datetime.now(BUSINESS_TZ).date()


# ---------------------------------------------------------------- dates
def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def add_duration(start: date, duration: int, unit: str) -> date:
    if unit == "weeks":
        return start + timedelta(weeks=duration)
    if unit == "months":
        return add_months(start, duration)
    if unit == "years":
        return add_months(start, 12 * duration)
    raise ValueError(f"Unknown duration unit {unit}")


def months_elapsed(start: date, on: date) -> int:
    """1-based program month the date falls in (month 1 = first month)."""
    months = (on.year - start.year) * 12 + (on.month - start.month)
    if on.day < start.day:
        months -= 1
    return max(months, 0) + 1


# ---------------------------------------------------------------- policy / tier
def policy_for(db: Session, enrollment: ProgramEnrollment) -> ProgramWorkflowPolicy | None:
    if enrollment.workflow_policy_id is None:
        return None
    return db.get(ProgramWorkflowPolicy, enrollment.workflow_policy_id)


def tier_for(db: Session, enrollment: ProgramEnrollment) -> str | None:
    policy = policy_for(db, enrollment)
    return TIER_BY_CODE.get(policy.program_code) if policy else None


def program_tier(program: InternshipProgram) -> str | None:
    return TIER_BY_CODE.get(program.code) if program.workflow_policy_id else None


def form_unlock_date(enrollment: ProgramEnrollment, policy: ProgramWorkflowPolicy) -> date | None:
    """None = available immediately. Accelerator: enrollment date + 5 months + 20 days."""
    if not (policy.form_unlock_months or policy.form_unlock_days):
        return None
    if policy.form_unlock_base == "start_date" and enrollment.start_date:
        base = enrollment.start_date
    else:
        base = (enrollment.enrolled_at or utcnow()).astimezone(BUSINESS_TZ).date()
    return add_months(base, policy.form_unlock_months) + timedelta(days=policy.form_unlock_days)


def access_status(enrollment: ProgramEnrollment, on: date | None = None) -> str:
    """pending_payment / suspended / dropped / completed / expired / active."""
    on = on or today()
    if enrollment.status in ("pending_payment", "suspended", "dropped"):
        return enrollment.status
    if enrollment.status == "completed":
        return "completed"
    if enrollment.expected_end_date and on > enrollment.expected_end_date:
        return "expired"
    return "active"


def days_remaining(enrollment: ProgramEnrollment, on: date | None = None) -> int | None:
    if not enrollment.expected_end_date:
        return None
    return max((enrollment.expected_end_date - (on or today())).days, 0)


def current_stage(db: Session, enrollment: ProgramEnrollment, policy: ProgramWorkflowPolicy) -> dict | None:
    stages = db.query(ProgramStage).filter(ProgramStage.policy_id == policy.id).order_by(ProgramStage.start_month).all()
    if not stages or not enrollment.start_date:
        return None
    month = months_elapsed(enrollment.start_date, today())
    for stage in stages:
        if stage.start_month <= month <= stage.end_month:
            return {"month": month, "code": stage.code, "title": stage.title}
    last = stages[-1]
    return {"month": month, "code": last.code, "title": last.title}


# ---------------------------------------------------------------- pricing
def offer_active(program: InternshipProgram, now: datetime | None = None) -> bool:
    now = now or utcnow()
    if program.offer_enabled and program.offer_start_at and program.offer_end_at:
        return program.offer_start_at <= now <= program.offer_end_at
    if not program.offer_enabled and program.offer_start_date and program.offer_end_date:
        # Legacy date-only offers remain honoured exactly as before.
        return program.offer_start_date <= now.date() <= program.offer_end_date
    return False


def price_for(program: InternshipProgram, currency: str, now: datetime | None = None) -> tuple[Decimal, bool]:
    """Backend-authoritative base price: offer during the window, regular otherwise."""
    regular = program.price_inr if currency == "INR" else program.price_usd
    offer = program.offer_price_inr if currency == "INR" else program.offer_price_usd
    if offer is not None and offer_active(program, now):
        return Decimal(str(offer)), True
    return Decimal(str(regular)), False


# ---------------------------------------------------------------- enrollment lookup / access
def v2_enrollments(db: Session, student: Student) -> list[ProgramEnrollment]:
    return (db.query(ProgramEnrollment)
            .filter(ProgramEnrollment.student_id == student.id, ProgramEnrollment.workflow_policy_id.isnot(None))
            .order_by(ProgramEnrollment.id.desc()).all())


def current_enrollment(db: Session, student: Student, enrollment_id: int | None = None) -> ProgramEnrollment:
    rows = v2_enrollments(db, student)
    if enrollment_id is not None:
        rows = [r for r in rows if r.id == enrollment_id]
    if not rows:
        raise HTTPException(404, "No Portal V2 enrollment found")
    # Prefer a paid enrollment; otherwise the newest (so login can route to payment).
    for row in rows:
        if row.status in ("active", "completed"):
            return row
    return rows[0]


def require_access(db: Session, enrollment: ProgramEnrollment, *, allow_expired: bool = False) -> str:
    state = access_status(enrollment)
    if state == "pending_payment":
        raise HTTPException(402, "Payment is pending. Complete payment to access your dashboard.")
    if state in ("suspended", "dropped"):
        raise HTTPException(403, "Your enrollment is suspended. Please contact Support.")
    if state == "expired" and not allow_expired:
        raise HTTPException(403, "Your program access period has ended. Contact Support to request an extension.")
    return state


# Career Accelerator opens on a fixed launch moment. Until then a paid student only gets the
# dashboard, certificates & invoices, profile and support. Override with ACCELERATOR_LAUNCH_AT
# (ISO 8601, e.g. 2026-11-09T13:00:00+05:30) in .env if the date changes.
def accelerator_launch_at() -> datetime:
    import os
    raw = os.environ.get("ACCELERATOR_LAUNCH_AT") or "2026-11-09T13:00:00+05:30"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        dt = datetime.fromisoformat("2026-11-09T13:00:00+05:30")
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))


def accelerator_prelaunch(db: Session, enrollment: ProgramEnrollment) -> bool:
    return tier_for(db, enrollment) == "accelerator" and datetime.now(timezone.utc) < accelerator_launch_at()


def require_launched(db: Session, enrollment: ProgramEnrollment) -> None:
    if accelerator_prelaunch(db, enrollment):
        raise HTTPException(423, "Your Career Accelerator starts on 9 November 2026 at 1:00 PM IST. "
                                 "This section will open then.")


def require_tier(db: Session, enrollment: ProgramEnrollment, *tiers: str) -> str:
    tier = tier_for(db, enrollment)
    if tier not in tiers:
        raise HTTPException(403, "This feature is not part of your program")
    return tier


# ---------------------------------------------------------------- tracks
def ensure_track(db: Session, enrollment: ProgramEnrollment):
    tier = tier_for(db, enrollment)
    if tier is None:
        return None
    model = TRACK_MODELS[tier]
    track = db.query(model).filter(model.enrollment_id == enrollment.id).first()
    if track is None:
        track = model(enrollment_id=enrollment.id, student_id=enrollment.student_id)
        if tier == "accelerator":
            track.internship_form_available_on = form_unlock_date(enrollment, policy_for(db, enrollment))
        db.add(track)
        db.flush()
    return track


def activate_v2_enrollment(db: Session, enrollment: ProgramEnrollment) -> None:
    """Called when payment succeeds: access window starts today."""
    policy = policy_for(db, enrollment)
    if policy is None:
        return
    start = today()
    end = add_duration(start, policy.duration, policy.duration_unit)
    enrollment.start_date = start
    enrollment.expected_end_date = end
    enrollment.original_end_date = end
    db.add(enrollment)
    db.flush()
    ensure_track(db, enrollment)


# ---------------------------------------------------------------- MCQ
def mcq_summary(db: Session, enrollment: ProgramEnrollment) -> dict | None:
    """Every started attempt counts (same rule the student sees). Attempts that were never
    submitted — e.g. ended by a proctoring violation or abandoned past the time limit — are
    reported as terminated with 0 marks."""
    quizzes = {q.id: q for q in db.query(Quiz).filter(Quiz.program_id == enrollment.program_id, Quiz.is_active.is_(True))}
    if not quizzes:
        return None
    attempts = (db.query(QuizAttempt)
                .filter(QuizAttempt.student_id == enrollment.student_id, QuizAttempt.quiz_id.in_(list(quizzes)))
                .order_by(QuizAttempt.started_at).all())
    if not attempts:
        return {"attempts": 0, "status": "Not attempted", "terminated": 0}
    now = datetime.now(timezone.utc)

    def running(a):
        limit = getattr(quizzes[a.quiz_id], "time_limit_minutes", None) or 180
        return a.status == "in_progress" and a.started_at and (now - a.started_at).total_seconds() < (limit + 5) * 60

    graded = [a for a in attempts if a.submitted_at is not None and a.score_percent is not None]
    terminated = [a for a in attempts if a.status == "auto_submitted" and not a.correct_answers
                  or (a.submitted_at is None and not running(a))]
    in_progress = any(running(a) for a in attempts)
    base = {"attempts": len(attempts), "terminated": len(terminated), "in_progress": in_progress}
    if not graded:
        if in_progress and not terminated:
            return base | {"status": "In progress"}
        total = attempts[-1].total_questions
        return base | {"correct": 0, "total": total, "percentage": 0.0, "passed": False, "status": "Not passed",
                       "completed_at": None, "attempt_number": attempts[-1].attempt_number}
    best = sorted(graded, key=lambda a: (-float(a.score_percent), a.submitted_at))[0]
    return base | {
        "correct": best.correct_answers, "total": best.total_questions,
        "percentage": float(best.score_percent), "passed": bool(best.passed),
        "status": "Passed" if best.passed else "Not passed",
        "completed_at": best.submitted_at, "attempt_number": best.attempt_number,
    }


# ---------------------------------------------------------------- work items
def submission_chain(db: Session, enrollment_id: int, project_id: int) -> list[ProjectSubmission]:
    return (db.query(ProjectSubmission)
            .filter(ProjectSubmission.enrollment_id == enrollment_id, ProjectSubmission.project_id == project_id)
            .order_by(ProjectSubmission.attempt_number.desc(), ProjectSubmission.id.desc()).all())


def latest_status(chain: list[ProjectSubmission]) -> str:
    return chain[0].status if chain else "in_progress"


def active_selections(db: Session, enrollment_id: int) -> list[ProjectSelection]:
    return (db.query(ProjectSelection)
            .filter(ProjectSelection.enrollment_id == enrollment_id, ProjectSelection.active.is_(True))
            .order_by(ProjectSelection.slot).all())


def accelerator_definitions(db: Session, program_id: int, work_type: str, set_number: int | None = None) -> list[Project]:
    q = db.query(Project).filter(Project.program_id == program_id, Project.work_type == work_type, Project.is_active.is_(True))
    if set_number is not None:
        q = q.filter(Project.set_number == set_number)
    return q.order_by(Project.sequence_number.nullslast(), Project.id).all()


ACCEL_ASSIGNMENT_COUNT = 22
ACCEL_MIN_SETS = 10


def assignment_set_counts(db: Session, program_id: int) -> dict[int, int]:
    rows = (db.query(Project.set_number, func.count(Project.id))
            .filter(Project.program_id == program_id, Project.work_type == "accelerator_assignment",
                    Project.is_active.is_(True), Project.set_number.isnot(None))
            .group_by(Project.set_number).all())
    return {n: c for n, c in rows}


def ensure_assignment_set(db: Session, enrollment: ProgramEnrollment) -> int | None:
    """Give the student one question set, once, and keep it for the whole program.

    Only complete sets (all 22 assignments) are eligible; among them a random one is picked
    from the least-used sets so students are spread evenly and neighbours rarely share a set.
    If no set is complete yet, the fullest set is used so the student still sees assignments.
    """
    import random
    if enrollment.assignment_set:
        return enrollment.assignment_set
    counts = assignment_set_counts(db, enrollment.program_id)
    if not counts:
        return None
    ready = [n for n, c in counts.items() if c >= ACCEL_ASSIGNMENT_COUNT]
    if not ready:
        return max(counts, key=lambda n: (counts[n], -n))  # provisional, not saved: re-picked once sets are complete
    usage = dict(db.query(ProgramEnrollment.assignment_set, func.count(ProgramEnrollment.id))
                 .filter(ProgramEnrollment.program_id == enrollment.program_id, ProgramEnrollment.assignment_set.in_(ready))
                 .group_by(ProgramEnrollment.assignment_set).all())
    least = min(usage.get(n, 0) for n in ready)
    chosen = random.choice([n for n in ready if usage.get(n, 0) == least])
    enrollment.assignment_set = chosen
    db.flush()
    return chosen


def real_world_assignments(db: Session, enrollment_id: int) -> list[tuple[ProjectAssignment, Project]]:
    rows = (db.query(ProjectAssignment, Project).join(Project, Project.id == ProjectAssignment.project_id)
            .filter(ProjectAssignment.enrollment_id == enrollment_id, Project.work_type == "real_world_project")
            .order_by(Project.sequence_number, ProjectAssignment.id).all())
    return [(a, p) for a, p in rows]


def ensure_real_world_slots(db: Session, program: InternshipProgram, staff_profile_id: int) -> None:
    existing = {p.sequence_number for p in accelerator_definitions(db, program.id, "real_world_project")}
    for n in (1, 2, 3):
        if n not in existing:
            db.add(Project(program_id=program.id, title=f"Real-World Project {n}", project_type="capstone",
                           work_type="real_world_project", sequence_number=n, created_by=staff_profile_id,
                           description="Request the project question from ARINSA AI MINDS by email, then submit here."))
    db.flush()


def _relative_dates(enrollment: ProgramEnrollment, project: Project) -> tuple[date | None, date | None]:
    if not enrollment.start_date:
        return None, None
    available = enrollment.start_date + timedelta(days=project.available_after_days) if project.available_after_days is not None else None
    due = enrollment.start_date + timedelta(days=project.due_after_days) if project.due_after_days is not None else None
    return available, due


def work_items(db: Session, enrollment: ProgramEnrollment) -> list[dict]:
    """Every piece of submittable work for this enrollment, tier-aware."""
    tier = tier_for(db, enrollment)
    items: list[dict] = []

    def add(kind: str, project: Project, *, selection=None, assignment=None, label=None, deadline=None, available=None):
        chain = submission_chain(db, enrollment.id, project.id)
        status = latest_status(chain)
        locked = bool(available and available > today())
        items.append({
            "kind": kind, "label": label or project.title, "project_id": project.id,
            "selection_id": selection.id if selection else None, "assignment_id": assignment.id if assignment else None,
            "title": (assignment.title if assignment and assignment.title else project.title),
            "description": (assignment.description if assignment and assignment.description else project.description),
            "instructions": (assignment.instructions if assignment and assignment.instructions else project.instructions),
            "technology": project.technology, "work_type": project.work_type, "sequence_number": project.sequence_number,
            "has_resource_file": bool(project.instructions_file_path), "resource_file_name": project.instructions_file_name,
            "assigned_at": assignment.assigned_at if assignment else (selection.selected_at if selection else None),
            "available_on": available, "locked": locked,
            "deadline": deadline, "status": status, "status_label": WORK_STATUS_LABELS.get(status, status),
            "can_submit": (not locked) and status in ("in_progress", "revision_requested"),
            "submissions": [submission_out(s) for s in chain],
        })

    if tier in SELECTION_TIERS:
        for sel in active_selections(db, enrollment.id):
            if sel.is_locked:
                add("selected_project", db.get(Project, sel.project_id), selection=sel,
                    label=f"Project {sel.slot}" if tier == "professional" else "Selected Project",
                    deadline=enrollment.expected_end_date)
    if tier in FORM_TIERS:
        rows = (db.query(ProjectAssignment)
                .filter(ProjectAssignment.enrollment_id == enrollment.id)
                .order_by(ProjectAssignment.assigned_at).all())
        n = 0
        for a in rows:
            project = db.get(Project, a.project_id)
            if project.work_type == "real_world_project":
                continue  # listed below, in project order
            n += 1
            add("internship_task" if tier == "accelerator" else "assigned_work", project, assignment=a,
                label=f"Internship Task {n}" if tier == "accelerator" else None,
                deadline=a.deadline.date() if a.deadline else None)
    if tier == "accelerator":
        for p in accelerator_definitions(db, enrollment.program_id, "accelerator_assignment", ensure_assignment_set(db, enrollment) or -1):
            available, due = _relative_dates(enrollment, p)
            add("accelerator_assignment", p, label=f"Assignment {p.sequence_number or ''}".strip(),
                deadline=due, available=available)
        # The 3 real-world projects are assigned to each student individually by ARINSA AI MINDS.
        for a, p in real_world_assignments(db, enrollment.id):
            add("real_world_project", p, assignment=a, label=f"Real-World Project {p.sequence_number}",
                deadline=a.deadline.date() if a.deadline else None)
    return items


def submission_out(s: ProjectSubmission) -> dict:
    return {
        "id": s.id, "version": s.attempt_number, "status": s.status,
        "status_label": WORK_STATUS_LABELS.get(s.status, s.status),
        "submitted_at": s.submitted_at, "repo_link": s.repo_link, "demo_url": s.demo_url,
        "notes": s.description, "has_file": bool(s.submission_file_path),
        "grade": float(s.grade) if s.grade is not None else None, "feedback": s.feedback,
        "reviewed_at": s.graded_at,
    }


def review_history(db: Session, submission_ids: list[int]) -> list[ReviewEvent]:
    if not submission_ids:
        return []
    return (db.query(ReviewEvent).filter(ReviewEvent.project_submission_id.in_(submission_ids))
            .order_by(ReviewEvent.created_at).all())


# ---------------------------------------------------------------- progress / tracks refresh
def refresh_track(db: Session, enrollment: ProgramEnrollment) -> dict:
    """Recompute the tier track snapshot from source records and return progress."""
    tier = tier_for(db, enrollment)
    if tier is None:
        return {}
    track = ensure_track(db, enrollment)
    items = work_items(db, enrollment)
    done = lambda kind: sum(1 for i in items if i["kind"] == kind and i["status"] == "graded")  # noqa: E731
    progress: dict = {"tier": tier}

    if tier in SELECTION_TIERS:
        mcq = mcq_summary(db, enrollment)
        if mcq and mcq.get("attempts"):
            track.mcq_score = mcq.get("correct")
            track.mcq_max_score = mcq.get("total")
            track.mcq_passed = mcq.get("passed")
            track.mcq_attempts = mcq["attempts"]
            track.mcq_completed_at = mcq.get("completed_at")
        selected = [i for i in items if i["kind"] == "selected_project"]
        needed = 1 if tier == "basic" else 2
        if tier == "basic":
            track.project_status = selected[0]["status"] if selected else "not_selected"
        else:
            by_slot = {db.get(ProjectSelection, i["selection_id"]).slot: i["status"] for i in selected}
            track.project1_status = by_slot.get(1, "not_selected")
            track.project2_status = by_slot.get(2, "not_selected")
        completed = sum(1 for i in selected if i["status"] == "graded")
        mcq_ok = (mcq is None) or bool(mcq.get("passed"))
        steps_total = needed + 2  # materials/MCQ + selection + projects
        steps_done = (1 if mcq_ok else 0) + (1 if len(selected) == needed else 0) + completed
        progress.update(mcq=mcq, projects_completed=completed, projects_required=needed,
                        selection_confirmed=len(selected) == needed,
                        percent=round(100 * steps_done / steps_total))
        complete = mcq_ok and completed == needed
    elif tier in ("advanced", "career"):
        form = db.query(InternshipForm).filter(InternshipForm.enrollment_id == enrollment.id).first()
        assigned = [i for i in items if i["kind"] == "assigned_work"]
        track.form_submitted_at = form.submitted_at if form else None
        track.assigned_count = len(assigned)
        track.completed_count = sum(1 for i in assigned if i["status"] == "graded")
        progress.update(form_status=form.status if form else "not_started", assigned=len(assigned),
                        completed=track.completed_count)
        total = 1 + len(assigned) + (1 if tier == "career" else 0)
        finished = (1 if form and form.status != "draft" else 0) + track.completed_count
        if tier == "career":
            mock = (db.query(MockInterview).filter(MockInterview.enrollment_id == enrollment.id)
                    .order_by(MockInterview.id.desc()).first())
            track.mock_interview_status = (mock.status or "scheduled") if mock else "not_scheduled"
            if mock and mock.status == "completed":
                finished += 1
            progress["mock_interview_status"] = track.mock_interview_status
        progress["percent"] = round(100 * finished / total) if total else 0
        complete = bool(assigned) and track.completed_count == len(assigned) and (
            tier != "career" or track.mock_interview_status == "completed")
    else:  # accelerator
        policy = policy_for(db, enrollment)
        form = db.query(InternshipForm).filter(InternshipForm.enrollment_id == enrollment.id).first()
        track.form_submitted_at = form.submitted_at if form else None
        track.assignments_completed = done("accelerator_assignment")
        track.projects_completed = done("real_world_project")
        track.internship_tasks_completed = done("internship_task")
        track.mock_interviews_completed = db.query(MockInterview).filter(
            MockInterview.enrollment_id == enrollment.id, MockInterview.status == "completed").count()
        _sync_requirements(db, enrollment, policy, {
            "assignments": track.assignments_completed, "projects": track.projects_completed,
            "total_work": track.assignments_completed + track.projects_completed,
            "internship": 1 if (form and form.status != "draft") else 0,
            "mock_interviews": track.mock_interviews_completed,
        })
        eligibility = sync_eligibility(db, enrollment, policy)
        track.eligibility_status = eligibility["overall"]
        progress.update(
            assignments_completed=track.assignments_completed, assignments_required=22,
            projects_completed=track.projects_completed, projects_required=3,
            total_completed=track.assignments_completed + track.projects_completed, total_required=25,
            mock_interviews_completed=track.mock_interviews_completed, mock_interviews_required=policy.mock_interview_count,
            internship_tasks_completed=track.internship_tasks_completed,
            internship_form_available_on=track.internship_form_available_on,
            internship_form_status=form.status if form else "not_started",
            stage=current_stage(db, enrollment, policy), eligibility_status=track.eligibility_status,
            percent=round(100 * (track.assignments_completed + track.projects_completed + track.mock_interviews_completed) / 28),
        )
        complete = eligibility["overall"] == "eligible"

    if track.status != "completed":
        track.status = "completed" if complete else ("expired" if access_status(enrollment) == "expired" else "in_progress")
        if complete:
            track.completed_at = utcnow()
    progress["track_status"] = track.status
    # Per-item detail for the admin student report.
    progress["items"] = [{
        "title": i.get("title"), "label": i.get("label"), "kind": i["kind"], "status": i["status"],
        "status_label": i.get("status_label"), "deadline": i.get("deadline"), "locked": i.get("locked", False),
        "versions": len(i.get("submissions") or []),
        "revisions": sum(1 for x in (i.get("submissions") or []) if x.get("status") == "revision_requested"),
        "last_submitted_at": (i.get("submissions") or [{}])[0].get("submitted_at"),
        "latest_feedback": (i.get("submissions") or [{}])[0].get("feedback"),
    } for i in items]
    db.add(track)
    db.flush()
    return progress


def _sync_requirements(db: Session, enrollment, policy, counts: dict) -> None:
    for req in db.query(ProgramRequirement).filter(ProgramRequirement.policy_id == policy.id):
        value = min(counts.get(req.code, 0), req.target_count)
        row = db.query(RequirementProgress).filter(RequirementProgress.enrollment_id == enrollment.id,
                                                   RequirementProgress.requirement_id == req.id).first()
        status = "completed" if value >= req.target_count else ("in_progress" if value else "not_started")
        if row is None:
            db.add(RequirementProgress(enrollment_id=enrollment.id, requirement_id=req.id, completed_count=value, status=status))
        elif row.status != "waived" and (row.completed_count != value or row.status != status):
            row.completed_count, row.status = value, status
    db.flush()


AUTO_CRITERIA = ("assignments", "projects", "total_work", "internship", "mock_interviews")
MANUAL_CRITERIA = ("internship_performance", "assigned_work", "deadlines", "professional_conduct",
                   "integrity", "confidentiality", "overall")


def sync_eligibility(db: Session, enrollment, policy) -> dict:
    """Automatic criteria follow requirement progress; staff decide the rest. The DB
    trigger records every state change in eligibility_decisions."""
    criteria = db.query(EligibilityCriterion).filter(EligibilityCriterion.policy_id == policy.id).all()
    progress = {p.requirement_id: p for p in db.query(RequirementProgress).filter(RequirementProgress.enrollment_id == enrollment.id)}
    states = {s.criterion_id: s for s in db.query(EligibilityState).filter(EligibilityState.enrollment_id == enrollment.id)}
    for c in criteria:
        state = states.get(c.id)
        if state is None:
            state = EligibilityState(enrollment_id=enrollment.id, criterion_id=c.id, state="pending", reason="Initial state")
            db.add(state)
            db.flush()
            states[c.id] = state
        if c.requirement_id and c.code in AUTO_CRITERIA:
            p = progress.get(c.requirement_id)
            new = "met" if p and p.status in ("completed", "waived") else "pending"
            if state.state not in ("waived",) and state.state != new:
                state.state = new
                state.value = {"completed": p.completed_count if p else 0}
                state.reason = "Automatic from progress"
                state.changed_by = None
    db.flush()
    rows = []
    required_ok = True
    overall = None
    for c in criteria:
        s = states[c.id]
        rows.append({"criterion_id": c.id, "code": c.code, "description": c.description, "state": s.state,
                     "reason": s.reason, "automatic": c.code in AUTO_CRITERIA, "changed_at": s.changed_at})
        if c.code == "overall":
            overall = s.state
        elif c.is_required and s.state not in ("met", "waived"):
            required_ok = False
    if overall == "met" and required_ok:
        status = "eligible"
    elif overall == "not_met" or any(r["state"] == "not_met" for r in rows):
        status = "not_eligible"
    else:
        status = "in_progress"
    return {"criteria": rows, "overall": status, "requirements_met": required_ok}


def dashboard_counts(db: Session) -> dict:
    return {
        "pending_submissions": db.query(func.count(ProjectSubmission.id)).filter(
            ProjectSubmission.enrollment_id.isnot(None), ProjectSubmission.status.in_(("submitted", "under_review"))).scalar() or 0,
    }


# ----------------------------------------------------------------------- feedback chat
FEEDBACK_IMAGE_EXTS = {"png", "jpg", "jpeg"}


def feedback_thread(db, enrollment_id: int, project_id: int):
    from app.models.portal_v2 import WorkFeedbackMessage
    return (db.query(WorkFeedbackMessage)
            .filter(WorkFeedbackMessage.enrollment_id == enrollment_id, WorkFeedbackMessage.project_id == project_id)
            .order_by(WorkFeedbackMessage.created_at, WorkFeedbackMessage.id).all())


def feedback_out(db, m, image_url: str) -> dict:
    from app.models.auth import User
    from app.models.people import Admin, Student
    name = None
    if m.sender_role == "staff":
        a = db.query(Admin).filter(Admin.user_id == m.sender_user_id).first()
        name = getattr(a, "full_name", None) or "ARINSA AI MINDS"
    else:
        s = db.query(Student).filter(Student.user_id == m.sender_user_id).first()
        name = getattr(s, "full_name", None) or "Student"
    return {"id": m.id, "sender_role": m.sender_role, "sender_name": name, "body": m.body,
            "has_image": bool(m.image_path), "image_name": m.image_name,
            "image_url": image_url.format(id=m.id) if m.image_path else None,
            "submission_id": m.submission_id, "read_at": m.read_at, "created_at": m.created_at}


# ----------------------------------------------------------------------- mock interview timing rules
MOCK_REQUEST_LEAD_DAYS = 14   # preferred timings must be at least 14 days ahead
MOCK_CHANGE_CUTOFF_DAYS = 3   # nothing can be scheduled, rescheduled or cancelled inside 3 days
MOCK_END_BUFFER_DAYS = 14     # the interview must be done 14 days before the internship ends


def mock_window(enrollment: ProgramEnrollment, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    earliest = (now + timedelta(days=MOCK_REQUEST_LEAD_DAYS)).date()
    latest = (enrollment.expected_end_date - timedelta(days=MOCK_END_BUFFER_DAYS)) if enrollment.expected_end_date else None
    return {"earliest": earliest, "latest": latest, "open": latest is None or earliest <= latest,
            "lead_days": MOCK_REQUEST_LEAD_DAYS, "cutoff_days": MOCK_CHANGE_CUTOFF_DAYS, "end_buffer_days": MOCK_END_BUFFER_DAYS}


def mock_changeable(scheduled_at: datetime | None, now: datetime | None = None) -> bool:
    """A scheduled interview can be cancelled / moved only while it is more than 3 days away."""
    if scheduled_at is None:
        return True
    now = now or datetime.now(timezone.utc)
    return scheduled_at - now > timedelta(days=MOCK_CHANGE_CUTOFF_DAYS)
