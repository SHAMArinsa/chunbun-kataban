import mimetypes
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student, require_any_role, require_unsuspended_student
from app.models.auth import User
from app.models.people import Admin, Student
from app.models.program import Batch, BatchMember, InternshipProgram, ProgramEnrollment
from app.models.project import PROJECT_MAX_ATTEMPTS, Evaluation, Project, ProjectAssignment, ProjectStudentResource, ProjectSubmission
from app.schemas.assessment import SheetAssignedStudentOut, SheetAssignRequest
from app.schemas.project import (
    ProjectAssignRequest,
    ProjectAttemptStartOut,
    ProjectCreateRequest,
    ProjectGradeRequest,
    ProjectOut,
    ProjectRosterItemOut,
    ProjectRosterOut,
    ProjectStudentResourceOut,
    ProjectSubmissionDetailOut,
    ProjectSubmissionOut,
)
from app.services.activity_log_service import log_activity
from app.services.assignment_visibility import visible_ids_for_student
from app.services.notification_service import notify_students, student_ids_for_assignment_scope
from app.services.project_service import start_project_attempt
from app.services.storage import delete as delete_file, download_response, save
from app.utils.file_validation import read_and_validate_upload

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _project_out(project: Project, has_resource: bool = False, resource_file_name: str | None = None) -> ProjectOut:
    return ProjectOut(
        id=project.id, program_id=project.program_id, title=project.title, description=project.description,
        week_number=project.week_number, project_type=project.project_type,
        instructions_file_path=project.instructions_file_path, instructions_file_name=project.instructions_file_name,
        is_active=project.is_active,
        has_resource=has_resource, resource_file_name=resource_file_name,
    )


def _is_project_ready_for_student(db: Session, project: Project, student_id: int) -> bool:
    """Projects are released only when both the shared problem document and the
    student-specific supporting resource have been uploaded by an admin."""
    return bool(project.instructions_file_path) and (
        db.query(ProjectStudentResource.id)
        .filter(ProjectStudentResource.project_id == project.id, ProjectStudentResource.student_id == student_id)
        .first()
        is not None
    )


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    project = Project(**payload.model_dump(), created_by=admin.id)
    db.add(project)
    log_activity(db, admin.user_id, "admin", "create_project", "projects", None, payload.title)
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/assign", status_code=status.HTTP_201_CREATED)
def assign_project(project_id: int, payload: ProjectAssignRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    targets = [payload.student_id, payload.batch_id, payload.program_id]
    if sum(1 for t in targets if t is not None) != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exactly one of student_id/batch_id/program_id must be set")
    db.add(ProjectAssignment(project_id=project_id, assignment_scope=payload.assignment_scope, student_id=payload.student_id, batch_id=payload.batch_id, program_id=payload.program_id, assigned_by=admin.id))
    student_ids = student_ids_for_assignment_scope(db, payload.student_id, payload.batch_id, payload.program_id)
    notify_students(
        db, student_ids,
        title="New project assigned",
        message=f'"{project.title}" has been assigned to you.',
        notification_type="info",
        link_url="/projects",
    )
    db.commit()
    return {"status": "assigned"}


@router.post("/{project_id}/assign-students", status_code=status.HTTP_201_CREATED)
def assign_project_to_students(project_id: int, payload: SheetAssignRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    existing = {
        row.student_id
        for row in db.query(ProjectAssignment.student_id).filter(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.assignment_scope == "individual",
            ProjectAssignment.student_id.in_(payload.student_ids),
        )
    }
    added = 0
    for student_id in payload.student_ids:
        if student_id in existing:
            continue
        db.add(ProjectAssignment(project_id=project_id, assignment_scope="individual", student_id=student_id, assigned_by=admin.id))
        added += 1

    newly_assigned_ids = [sid for sid in payload.student_ids if sid not in existing]
    notify_students(
        db, newly_assigned_ids,
        title="New project assigned",
        message=f'"{project.title}" has been assigned to you.',
        notification_type="info",
        link_url="/projects",
    )
    log_activity(db, admin.user_id, "admin", "assign_project_students", "projects", project_id, f"Assigned to {added} student(s)")
    db.commit()
    return {"status": "assigned", "newly_assigned": added, "already_assigned": len(existing)}


@router.get("/{project_id}/assigned-students", response_model=list[SheetAssignedStudentOut])
def list_assigned_students(project_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = (
        db.query(Student.id, Student.full_name, User.email)
        .join(ProjectAssignment, ProjectAssignment.student_id == Student.id)
        .join(User, User.id == Student.user_id)
        .filter(ProjectAssignment.project_id == project_id, ProjectAssignment.assignment_scope == "individual")
        .all()
    )
    return [SheetAssignedStudentOut(student_id=r[0], full_name=r[1], email=r[2]) for r in rows]


ATTEMPTS_REMAINING_BUCKETS = {"3": lambda r: r >= 3, "2": lambda r: r == 2, "1": lambda r: r == 1, "0": lambda r: r == 0}


@router.get("/{project_id}/roster", response_model=ProjectRosterOut)
def project_roster(
    project_id: int,
    search: str | None = None,
    internship_status: str | None = None,
    assessment_status: str | None = None,
    attempts_remaining: str | None = None,
    evaluation_status: str | None = None,
    score_min: float | None = None,
    score_max: float | None = None,
    sort_by: str = "full_name",
    sort_dir: str = "asc",
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Full enterprise roster for one project: every enrolled student, always visible, with
    derived assignment/evaluation status, attempt counts, and scores — mirrors the coding
    assignment roster."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    program = db.get(InternshipProgram, project.program_id)
    plan_code = program.code if program else None

    enrolled = (
        db.query(Student, User.email, ProgramEnrollment.status)
        .join(User, User.id == Student.user_id)
        .join(ProgramEnrollment, ProgramEnrollment.student_id == Student.id)
        .filter(ProgramEnrollment.program_id == project.program_id)
        .all()
    )

    batch_by_student = {
        row.student_id: row.name
        for row in db.query(BatchMember.student_id, Batch.name).join(Batch, Batch.id == BatchMember.batch_id)
    }

    assignment_rows = db.query(ProjectAssignment).filter(ProjectAssignment.project_id == project_id).all()
    individually_assigned = {r.student_id for r in assignment_rows if r.assignment_scope == "individual"}
    assigned_batch_ids = {r.batch_id for r in assignment_rows if r.assignment_scope == "batch"}
    program_wide_assigned = any(r.assignment_scope == "program" for r in assignment_rows)
    batch_ids_by_student: dict[int, set[int]] = {}
    for row in db.query(BatchMember.student_id, BatchMember.batch_id):
        batch_ids_by_student.setdefault(row.student_id, set()).add(row.batch_id)

    has_resource_ids = {
        row.student_id for row in db.query(ProjectStudentResource.student_id).filter(ProjectStudentResource.project_id == project_id)
    }

    subs_by_student: dict[int, list[ProjectSubmission]] = {}
    for sub in (
        db.query(ProjectSubmission)
        .filter(ProjectSubmission.project_id == project_id)
        .order_by(ProjectSubmission.id.asc())
        .all()
    ):
        subs_by_student.setdefault(sub.student_id, []).append(sub)

    evaluator_names: dict[int, str] = {}
    grader_ids = {s.graded_by for subs in subs_by_student.values() for s in subs if s.graded_by}
    if grader_ids:
        for a in db.query(Admin).filter(Admin.id.in_(grader_ids)):
            evaluator_names[a.id] = a.full_name

    items: list[ProjectRosterItemOut] = []
    for student, email, enrollment_status in enrolled:
        is_assigned = (
            student.id in individually_assigned
            or bool(batch_ids_by_student.get(student.id, set()) & assigned_batch_ids)
            or program_wide_assigned
        )
        has_resource = student.id in has_resource_ids
        subs = subs_by_student.get(student.id, [])
        latest = subs[-1] if subs else None
        attempts_used = len(subs)
        attempts_remaining_n = max(0, PROJECT_MAX_ATTEMPTS - attempts_used)
        retake_granted = latest is not None and latest.admin_marked_status == "retake"
        locked = latest is not None and not retake_granted

        scores = [float(s.grade) for s in subs if s.grade is not None]
        highest_score = max(scores) if scores else None
        current_score = float(latest.grade) if latest and latest.grade is not None else None

        if latest is None:
            assignment_status = "assigned" if is_assigned else "not_assigned"
            evaluation_status = "pending"
        elif latest.admin_marked_status == "closed":
            assignment_status = "passed"
            evaluation_status = "evaluated"
        elif latest.admin_marked_status == "retake":
            assignment_status = "retake_assigned"
            evaluation_status = "evaluated"
        elif latest.status == "in_progress":
            assignment_status = "in_progress"
            evaluation_status = "pending"
        elif latest.status == "under_review":
            assignment_status = "under_evaluation"
            evaluation_status = "needs_review"
        elif latest.status == "revision_requested":
            assignment_status = "retake_assigned"
            evaluation_status = "needs_review"
        elif latest.status == "submitted":
            assignment_status = "submitted"
            evaluation_status = "pending"
        elif latest.status == "graded":
            evaluation_status = "evaluated"
            assignment_status = "failed" if (latest.grade is not None and latest.grade < 50) and attempts_remaining_n == 0 else "evaluated"
        else:
            assignment_status = "assigned"
            evaluation_status = "pending"

        items.append(ProjectRosterItemOut(
            student_id=student.id, full_name=student.full_name, email=email,
            plan=plan_code, batch=batch_by_student.get(student.id), enrollment_status=enrollment_status,
            assignment_status=assignment_status, attempts_used=attempts_used, max_attempts=PROJECT_MAX_ATTEMPTS,
            attempts_remaining=attempts_remaining_n, highest_score=highest_score, current_score=current_score,
            evaluation_status=evaluation_status,
            assigned_at=subs[0].started_at if subs else None,
            submitted_at=latest.submitted_at if latest else None,
            evaluator=evaluator_names.get(latest.graded_by) if latest and latest.graded_by else None,
            last_updated=(latest.graded_at or latest.submitted_at or latest.started_at) if latest else None,
            locked=locked, retake_granted=retake_granted, has_resource=has_resource,
            latest_submission_id=latest.id if latest else None,
            submission_file_name=_stored_file_display_name(latest.submission_file_path) if latest and latest.submission_file_path else None,
        ))

    if search:
        needle = search.strip().lower()
        items = [i for i in items if needle in i.full_name.lower() or needle in i.email.lower() or needle == str(i.student_id)]
    if internship_status:
        items = [i for i in items if i.enrollment_status == internship_status]
    if assessment_status:
        items = [i for i in items if i.assignment_status == assessment_status]
    if attempts_remaining and attempts_remaining in ATTEMPTS_REMAINING_BUCKETS:
        items = [i for i in items if ATTEMPTS_REMAINING_BUCKETS[attempts_remaining](i.attempts_remaining)]
    if evaluation_status:
        items = [i for i in items if i.evaluation_status == evaluation_status]
    if score_min is not None:
        items = [i for i in items if i.current_score is not None and i.current_score >= score_min]
    if score_max is not None:
        items = [i for i in items if i.current_score is not None and i.current_score <= score_max]

    reverse = sort_dir == "desc"
    sort_key_map = {
        "full_name": lambda i: i.full_name.lower(),
        "email": lambda i: i.email.lower(),
        "highest_score": lambda i: i.highest_score if i.highest_score is not None else -1,
        "current_score": lambda i: i.current_score if i.current_score is not None else -1,
        "submitted_at": lambda i: i.submitted_at or datetime.min.replace(tzinfo=timezone.utc),
        "assigned_at": lambda i: i.assigned_at or datetime.min.replace(tzinfo=timezone.utc),
        "attempts_remaining": lambda i: i.attempts_remaining,
        "status": lambda i: i.assignment_status,
        "evaluator": lambda i: i.evaluator or "",
    }
    items.sort(key=sort_key_map.get(sort_by, sort_key_map["full_name"]), reverse=reverse)

    total = len(items)
    return ProjectRosterOut(total=total, items=items[skip:skip + limit])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), role_user=Depends(require_any_role)):
    if role_user.role.name == "admin":
        return [_project_out(p) for p in db.query(Project).filter(Project.is_active.is_(True)).order_by(Project.id.desc()).all()]

    student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
    if student_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    visible_ids = visible_ids_for_student(db, student_row, ProjectAssignment, "project_id")
    if not visible_ids:
        return []
    projects = (
        db.query(Project)
        .filter(Project.is_active.is_(True), Project.id.in_(visible_ids))
        .order_by(Project.id.desc())
        .all()
    )
    resource_names = {
        row.project_id: row.file_name
        for row in db.query(ProjectStudentResource.project_id, ProjectStudentResource.file_name).filter(
            ProjectStudentResource.student_id == student_row.id,
            ProjectStudentResource.project_id.in_([p.id for p in projects]),
        )
    }
    return [
        _project_out(p, p.id in resource_names, resource_names.get(p.id))
        for p in projects
        if _is_project_ready_for_student(db, p, student_row.id)
    ]


@router.post("/{project_id}/start", response_model=ProjectAttemptStartOut, status_code=status.HTTP_201_CREATED)
def start_project_attempt_route(project_id: int, db: Session = Depends(get_db), student: Student = Depends(require_unsuspended_student)):
    """Called when the student clicks "View" — starts (or resumes) an attempt. Projects have no
    time limit, unlike coding assignments."""
    project = db.get(Project, project_id)
    if project is None or not project.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found or inactive")
    visible_ids = visible_ids_for_student(db, student, ProjectAssignment, "project_id")
    if project.id not in visible_ids or not _is_project_ready_for_student(db, project, student.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not assigned to you")
    submission = start_project_attempt(db, project, student.id)
    return ProjectAttemptStartOut(
        submission_id=submission.id, attempt_number=submission.attempt_number,
        started_at=submission.started_at, time_limit_minutes=None, deadline=None,
    )


@router.post("/submissions/{submission_id}/submit", response_model=ProjectSubmissionOut)
async def submit_project_attempt(
    submission_id: int,
    repo_link: str = Form(...),
    description: str = Form(...),
    file: UploadFile = ...,
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    submission = db.get(ProjectSubmission, submission_id)
    if submission is None or submission.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    if submission.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This attempt has already been submitted")
    if not repo_link.strip() or not description.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Repo link and description are required")
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A file is required")

    content, ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    if ext != "zip":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project deliverables must be submitted as a single .zip file")
    submission.submission_file_path = save(content, "project_submissions", file.filename)
    submission.repo_link = repo_link
    submission.description = description
    submission.status = "submitted"
    submission.submitted_at = datetime.now(timezone.utc)
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/submissions/me", response_model=list[ProjectSubmissionOut])
def my_submissions(project_id: int | None = None, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    query = db.query(ProjectSubmission).filter(ProjectSubmission.student_id == student.id)
    if project_id:
        query = query.filter(ProjectSubmission.project_id == project_id)
    return query.order_by(ProjectSubmission.id.desc()).all()


@router.get("/submissions", response_model=list[ProjectSubmissionOut])
def list_submissions(status_filter: str | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    query = db.query(ProjectSubmission)
    if status_filter:
        query = query.filter(ProjectSubmission.status == status_filter)
    return query.order_by(ProjectSubmission.id.desc()).all()


def _stored_file_display_name(relative_path: str) -> str:
    stored_name = relative_path.rsplit("/", 1)[-1]
    return stored_name.split("_", 1)[1] if "_" in stored_name else stored_name


@router.get("/submissions/{submission_id}", response_model=ProjectSubmissionDetailOut)
def get_project_submission_detail(submission_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    submission = db.get(ProjectSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    if submission.admin_viewed_at is None:
        submission.admin_viewed_at = datetime.now(timezone.utc)
        db.add(submission)
        db.commit()
        db.refresh(submission)
    student = db.get(Student, submission.student_id)
    project = db.get(Project, submission.project_id)
    return ProjectSubmissionDetailOut(
        id=submission.id, project_id=submission.project_id, student_id=submission.student_id,
        submission_file_path=submission.submission_file_path, repo_link=submission.repo_link,
        description=submission.description, attempt_number=submission.attempt_number,
        started_at=submission.started_at, time_limit_minutes=submission.time_limit_minutes,
        submitted_at=submission.submitted_at, status=submission.status,
        grade=submission.grade, feedback=submission.feedback,
        admin_marked_status=submission.admin_marked_status,
        student_full_name=student.full_name if student else "Unknown",
        project_title=project.title if project else "Unknown",
        submission_file_name=_stored_file_display_name(submission.submission_file_path) if submission.submission_file_path else None,
        max_attempts=PROJECT_MAX_ATTEMPTS,
    )


@router.get("/submissions/{submission_id}/download")
def download_project_submission(submission_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    submission = db.get(ProjectSubmission, submission_id)
    if submission is None or not submission.submission_file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No file attached to this submission")
    return download_response(submission.submission_file_path, _stored_file_display_name(submission.submission_file_path))


@router.put("/submissions/{submission_id}/grade", response_model=ProjectSubmissionOut)
def grade_submission(submission_id: int, payload: ProjectGradeRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    submission = db.get(ProjectSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(submission, field, value)
    if payload.status is None:
        submission.status = "graded"
    submission.graded_by = admin.id
    submission.graded_at = datetime.now(timezone.utc)
    db.add(submission)

    project = db.get(Project, submission.project_id)
    enrollment = (
        db.query(ProgramEnrollment)
        .filter(ProgramEnrollment.student_id == submission.student_id, ProgramEnrollment.program_id == project.program_id)
        .first()
    )
    if enrollment and submission.status == "graded":
        db.add(Evaluation(
            student_id=submission.student_id,
            enrollment_id=enrollment.id,
            evaluation_type="project",
            reference_table="project_submissions",
            reference_id=submission.id,
            score=submission.grade,
            max_score=100,
            feedback=submission.feedback,
            evaluated_by=admin.id,
        ))

    notify_students(
        db, [submission.student_id],
        title="Project submission graded",
        message=f'Your submission for "{project.title}" has been graded.',
        notification_type="evaluation",
        link_url="/projects",
    )
    log_activity(db, admin.user_id, "admin", "grade_project_submission", "project_submissions", submission.id, None)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), role_user=Depends(require_any_role)):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if role_user.role.name == "admin":
        return _project_out(project)
    student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
    if student_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    visible_ids = visible_ids_for_student(db, student_row, ProjectAssignment, "project_id")
    if not project.is_active or project.id not in visible_ids or not _is_project_ready_for_student(db, project, student_row.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not assigned to you")
    resource = db.query(ProjectStudentResource).filter(
        ProjectStudentResource.project_id == project_id, ProjectStudentResource.student_id == student_row.id
    ).first() if student_row else None
    return _project_out(project, resource is not None, resource.file_name if resource else None)


@router.post("/{project_id}/instructions", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def upload_project_instructions(
    project_id: int,
    file: UploadFile = ...,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Uploads (or replaces) the problem/question document for a project — one file shared by
    every student assigned to it, distinct from the optional per-student resource handed out via
    the assign wizard, and from the student's own submitted deliverable."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    content, _ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    relative_path = save(content, "project_instructions", file.filename)

    if project.instructions_file_path:
        delete_file(project.instructions_file_path)
    project.instructions_file_path = relative_path
    project.instructions_file_name = file.filename
    db.add(project)
    log_activity(db, admin.user_id, "admin", "upload_project_instructions", "projects", project.id, file.filename)
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.delete("/{project_id}/instructions", response_model=ProjectOut)
def delete_project_instructions(project_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.instructions_file_path:
        delete_file(project.instructions_file_path)
    project.instructions_file_path = None
    project.instructions_file_name = None
    db.add(project)
    log_activity(db, admin.user_id, "admin", "delete_project_instructions", "projects", project.id, None)
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.get("/{project_id}/instructions/download")
def download_project_instructions(
    project_id: int,
    db: Session = Depends(get_db),
    role_user=Depends(require_any_role),
):
    project = db.get(Project, project_id)
    if project is None or not project.instructions_file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No problem document available for this project")

    if role_user.role.name != "admin":
        student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
        if student_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
        require_unsuspended_student(student_row, db)
        visible_ids = visible_ids_for_student(db, student_row, ProjectAssignment, "project_id")
        if not project.is_active or project.id not in visible_ids or not _is_project_ready_for_student(db, project, student_row.id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not assigned to you")
    media_type, _ = mimetypes.guess_type(project.instructions_file_name or project.instructions_file_path)
    return download_response(project.instructions_file_path, project.instructions_file_name or "project-instructions", media_type or "application/octet-stream")


@router.post("/{project_id}/students/{student_id}/resource", response_model=ProjectStudentResourceOut, status_code=status.HTTP_201_CREATED)
async def upload_student_resource(
    project_id: int,
    student_id: int,
    file: UploadFile = ...,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Uploads (or replaces) a zip file tied to one specific student for this project — e.g.
    tier-specific starter files. Re-uploading for the same (project, student) pair replaces the
    previous file rather than accumulating multiple."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    content, ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    if ext != "zip":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .zip files are allowed for student resources")
    relative_path = save(content, "project_student_resources", file.filename)

    existing = db.query(ProjectStudentResource).filter(
        ProjectStudentResource.project_id == project_id, ProjectStudentResource.student_id == student_id
    ).first()
    if existing:
        delete_file(existing.file_path)
        existing.file_path = relative_path
        existing.file_name = file.filename
        existing.file_size_bytes = len(content)
        existing.uploaded_by = admin.id
        existing.uploaded_at = datetime.now(timezone.utc)
        resource = existing
    else:
        resource = ProjectStudentResource(
            project_id=project_id, student_id=student_id, file_path=relative_path,
            file_name=file.filename, file_size_bytes=len(content), uploaded_by=admin.id,
        )
        db.add(resource)

    log_activity(db, admin.user_id, "admin", "upload_project_student_resource", "project_student_resources", project_id, f"{file.filename} -> student {student_id}")
    db.commit()
    db.refresh(resource)
    return resource


@router.get("/{project_id}/students/{student_id}/resource", response_model=ProjectStudentResourceOut)
def get_student_resource(project_id: int, student_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    resource = db.query(ProjectStudentResource).filter(
        ProjectStudentResource.project_id == project_id, ProjectStudentResource.student_id == student_id
    ).first()
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No resource uploaded for this student yet")
    return resource


@router.delete("/{project_id}/students/{student_id}/resource", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_resource(project_id: int, student_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    resource = db.query(ProjectStudentResource).filter(
        ProjectStudentResource.project_id == project_id, ProjectStudentResource.student_id == student_id
    ).first()
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No resource uploaded for this student yet")
    delete_file(resource.file_path)
    db.delete(resource)
    log_activity(db, admin.user_id, "admin", "delete_project_student_resource", "project_student_resources", project_id, f"student {student_id}")
    db.commit()
    return None


@router.get("/{project_id}/resource/download")
def download_my_resource(project_id: int, db: Session = Depends(get_db), student: Student = Depends(require_unsuspended_student)):
    resource = db.query(ProjectStudentResource).filter(
        ProjectStudentResource.project_id == project_id, ProjectStudentResource.student_id == student.id
    ).first()
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No resource file has been uploaded for you on this project yet")

    return download_response(resource.file_path, resource.file_name)
