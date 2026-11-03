from datetime import timedelta
"""Student Portal V2 API (/api/v2/me). Everything is scoped to the caller's own
enrollment; tier, payment status, suspension and access expiry are enforced here."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_student
from app.models.auth import User
from app.models.engagement import Certificate, Notification
from app.models.people import Student
from app.models.portal_v2 import (
    MockInterviewRequest,
    WorkFeedbackMessage,
    AreaOfInterest, AreaOfInterestProgram, EnrollmentAccessExtension, InternshipForm, ProjectSelection,
    ProjectSelectionEvent, ResumeVersion,
)
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.models.project import MockInterview, MockInterviewFile, Project, ProjectAssignment, ProjectSubmission
from app.services import v2
from app.services import internship_form_fields as FF
from app.services.notification_service import notify_user
from app.services.storage import download_response, save
from app.utils.file_validation import read_and_validate_upload

router = APIRouter(prefix="/api/v2/me", tags=["portal-v2-student"])

CAREER_NOTICE = ("Resume Building and Job Assistance will be provided through your registered email address. "
                 "Please regularly check your inbox and spam/junk folder for communications from ARINSA AI MINDS.")


ACCELERATOR_NOTICE = ("Professional resume building and placement-related communication will be provided through your registered "
                      "email address. Email ARINSA AI MINDS to request each real-world project question and to book each mock "
                      "interview (at least 2 weeks ahead). Please check your inbox and spam/junk folder regularly.")


def _ctx(db: Session, student: Student, enrollment_id: int | None = None, *, allow_expired=False, allow_unpaid=False,
         allow_prelaunch=False):
    enrollment = v2.current_enrollment(db, student, enrollment_id)
    if not allow_unpaid:
        v2.require_access(db, enrollment, allow_expired=allow_expired)
    if not allow_prelaunch:
        v2.require_launched(db, enrollment)  # Career Accelerator content stays closed until launch
    return enrollment, v2.tier_for(db, enrollment), v2.policy_for(db, enrollment)


def _features(tier: str, policy) -> list[str]:
    f = ["dashboard", "materials", "certificates", "notifications", "profile", "support"]
    if tier in ("basic", "professional"):
        f += ["mcq", "project_selection", "projects"]
    if tier in ("advanced", "career"):
        f += ["internship_form", "assigned_work"]
    if tier == "career":
        f += ["mock_interviews"]
    if tier == "accelerator":
        f += ["assignments", "real_world_projects", "internship", "mock_interviews", "eligibility"]
        if policy.mcq_enabled:
            f.append("mcq")
    return f


# ------------------------------------------------------------------ overview
@router.get("/status")
def my_status(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    """Login routing: tells the SPA whether to show the dashboard, payment or legacy UI."""
    rows = v2.v2_enrollments(db, student)
    legacy = db.query(ProgramEnrollment).filter(ProgramEnrollment.student_id == student.id,
                                                ProgramEnrollment.workflow_policy_id.is_(None)).all()
    if not rows:
        return {"portal": "legacy" if legacy else "none", "legacy_statuses": [e.status for e in legacy]}
    e = v2.current_enrollment(db, student)
    payment = (db.query(Payment).filter(Payment.enrollment_id == e.id).order_by(Payment.id.desc()).first())
    return {"portal": "v2", "enrollment_id": e.id, "tier": v2.tier_for(db, e), "access": v2.access_status(e),
            "pending_payment_id": payment.id if payment and payment.status != "paid" else None,
            "program_id": e.program_id}


@router.get("/overview")
def overview(enrollment_id: int | None = None, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, policy = _ctx(db, student, enrollment_id, allow_expired=True, allow_prelaunch=True)
    program = db.get(InternshipProgram, enrollment.program_id)
    progress = v2.refresh_track(db, enrollment)
    db.commit()
    items = v2.work_items(db, enrollment)
    upcoming = sorted([i for i in items if i["deadline"] and i["status"] != "graded"], key=lambda i: i["deadline"])[:5]
    current = next((i for i in items if i["status"] in ("in_progress", "revision_requested") and not i["locked"]), None)
    extensions = (db.query(EnrollmentAccessExtension).filter(EnrollmentAccessExtension.enrollment_id == enrollment.id)
                  .order_by(EnrollmentAccessExtension.granted_at.desc()).all())
    from app.models.engagement import Notification
    notes = (db.query(Notification).filter(
        (Notification.recipient_user_id == student.user_id) |
        ((Notification.recipient_user_id.is_(None)) & ((Notification.program_id.is_(None)) | (Notification.program_id == enrollment.program_id))
         & ((Notification.recipient_role.is_(None)) | (Notification.recipient_role == "student"))))
             .order_by(Notification.created_at.desc()).limit(5).all())
    return {
        "student": {"id": student.id, "name": student.full_name, "student_number": student.student_number,
                    "email": db.get(User, student.user_id).email},
        "enrollment": {"id": enrollment.id, "status": enrollment.status, "access": v2.access_status(enrollment),
                       "enrolled_at": enrollment.enrolled_at, "start_date": enrollment.start_date,
                       "end_date": enrollment.expected_end_date, "original_end_date": enrollment.original_end_date,
                       "days_remaining": v2.days_remaining(enrollment),
                       "extended": bool(extensions), "latest_extension_reason": extensions[0].reason if extensions else None},
        "program": {"id": program.id, "code": program.code, "name": program.name, "tier": tier,
                    "tier_label": v2.TIER_LABELS[tier], "duration": policy.duration, "duration_unit": policy.duration_unit},
        "features": _features(tier, policy),
        "progress": progress,
        "current_work": current and {k: current[k] for k in ("label", "title", "status_label", "deadline", "kind")},
        "deadlines": [{"label": i["label"], "title": i["title"], "deadline": i["deadline"], "status_label": i["status_label"]} for i in upcoming],
        "notifications": [{"id": n.id, "title": n.title, "message": n.message, "created_at": n.created_at} for n in notes],
        "prelaunch": v2.accelerator_prelaunch(db, enrollment),
        "launch_at": v2.accelerator_launch_at().isoformat() if tier == "accelerator" else None,
        "career_notice": CAREER_NOTICE if tier == "career" else (ACCELERATOR_NOTICE if tier == "accelerator" else None),
    }


# ------------------------------------------------------------------ project selection (Basic / Professional)
class SelectionRequest(BaseModel):
    project_ids: list[int] = Field(min_length=1, max_length=2)


@router.get("/project-options")
def project_options(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, policy = _ctx(db, student)
    v2.require_tier(db, enrollment, *v2.SELECTION_TIERS)
    options = (db.query(Project).filter(Project.program_id == enrollment.program_id, Project.work_type == "project_option",
                                        Project.is_active.is_(True)).order_by(Project.sequence_number.nullslast(), Project.id).all())
    selections = v2.active_selections(db, enrollment.id)
    confirmed = len(selections) == policy.selection_limit and all(s.is_locked for s in selections)
    if confirmed:  # once locked, the student only sees (and can open) the project(s) they chose
        chosen = {s.project_id for s in selections}
        options = [p for p in options if p.id in chosen]
    return {
        "tier": tier, "required": policy.selection_limit,
        "confirmed": confirmed,
        "selected_project_ids": [s.project_id for s in selections],
        "options": [{"id": p.id, "number": p.sequence_number, "title": p.title, "description": p.description,
                     "instructions": p.instructions, "technology": p.technology,
                     "has_resource_file": bool(p.instructions_file_path), "has_instructions_file": bool(p.guide_file_path)} for p in options],
    }


@router.post("/project-selection")
def confirm_selection(payload: SelectionRequest, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, policy = _ctx(db, student)
    v2.require_tier(db, enrollment, *v2.SELECTION_TIERS)
    ids = list(dict.fromkeys(payload.project_ids))
    if len(ids) != policy.selection_limit:
        raise HTTPException(400, f"Select exactly {policy.selection_limit} different project(s)")
    if v2.active_selections(db, enrollment.id):
        raise HTTPException(409, "Your project selection is already confirmed and locked. Only an administrator can change it.")
    for pid in ids:
        project = db.get(Project, pid)
        if project is None or project.program_id != enrollment.program_id or project.work_type != "project_option" or not project.is_active:
            raise HTTPException(400, "Invalid project option")
    for slot, pid in enumerate(ids, start=1):
        sel = ProjectSelection(student_id=student.id, enrollment_id=enrollment.id, program_id=enrollment.program_id,
                               project_id=pid, slot=slot, is_locked=True, active=True)
        db.add(sel)
        db.flush()
        db.add(ProjectSelectionEvent(selection_id=sel.id, action="selected", new_project_id=pid,
                                     reason="Student confirmed selection", performed_by=student.user_id))
        db.add(ProjectSelectionEvent(selection_id=sel.id, action="locked", new_project_id=pid,
                                     reason="Locked on confirmation", performed_by=student.user_id))
    track = v2.ensure_track(db, enrollment)
    track.selection_confirmed_at = datetime.now(timezone.utc)
    v2.refresh_track(db, enrollment)
    db.commit()
    return {"confirmed": True}


# ------------------------------------------------------------------ work & submissions
@router.get("/work")
def my_work(kind: str | None = None, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, _ = _ctx(db, student, allow_expired=True)
    items = v2.work_items(db, enrollment)
    if kind:
        items = [i for i in items if i["kind"] == kind]
    expired = v2.access_status(enrollment) == "expired"
    for i in items:
        if expired:
            i["can_submit"] = False
        subs = [s["id"] for s in i["submissions"]]
        i["review_history"] = [{"status": r.new_status, "feedback": r.feedback, "at": r.created_at}
                               for r in v2.review_history(db, subs) if r.decision != "internal"]
        thread = v2.feedback_thread(db, enrollment.id, i["project_id"])
        i["message_count"] = len(thread)
        i["unread_messages"] = sum(1 for m in thread if m.sender_role == "staff" and m.read_at is None)
    return {"tier": tier, "items": items, "access": v2.access_status(enrollment)}


@router.post("/work/submit")
async def submit_work(
    project_id: int = Form(...),
    repo_link: str | None = Form(None),
    demo_url: str | None = Form(None),
    notes: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    enrollment, tier, _ = _ctx(db, student)
    item = next((i for i in v2.work_items(db, enrollment) if i["project_id"] == project_id), None)
    if item is None:
        raise HTTPException(404, "This work item is not available to you")
    if not item["can_submit"]:
        raise HTTPException(409, "Submission is not open. Resubmission is only possible after a reviewer requests a revision.")
    repo_link, demo_url, notes = (repo_link or "").strip() or None, (demo_url or "").strip() or None, (notes or "").strip() or None
    if file is None and not repo_link:
        raise HTTPException(400, "Attach a ZIP/file or provide a GitHub repository URL")
    for url in (repo_link, demo_url):
        if url and not url.lower().startswith(("http://", "https://")):
            raise HTTPException(400, "Links must start with http:// or https://")
    path = None
    if file is not None and file.filename:
        content, _ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
        path = save(content, "project_submissions", file.filename)
    previous = v2.submission_chain(db, enrollment.id, project_id)
    now = datetime.now(timezone.utc)
    submission = ProjectSubmission(
        enrollment_id=enrollment.id, project_id=project_id, student_id=student.id,
        project_selection_id=item["selection_id"], project_assignment_id=item["assignment_id"],
        submission_file_path=path, repo_link=repo_link, demo_url=demo_url, description=notes,
        attempt_number=(previous[0].attempt_number + 1) if previous else 1,
        started_at=now, submitted_at=now, status="submitted",
    )
    db.add(submission)
    proj = db.get(Project, project_id)
    if proj.work_type == "accelerator_assignment" and not enrollment.assignment_set and proj.set_number:
        enrollment.assignment_set = proj.set_number  # lock a provisional set as soon as work is submitted
    v2.refresh_track(db, enrollment)
    db.commit()
    return {"id": submission.id, "version": submission.attempt_number, "status": "submitted"}


@router.get("/work/submissions/{submission_id}/download")
def download_my_submission(submission_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    s = db.get(ProjectSubmission, submission_id)
    if s is None or s.student_id != student.id or not s.submission_file_path:
        raise HTTPException(404, "File not found")
    return download_response(s.submission_file_path, s.submission_file_path.rsplit("/", 1)[-1].split("_", 1)[-1])


def _my_thread(db: Session, student: Student, project_id: int) -> ProgramEnrollment:
    enrollment, _, _ = _ctx(db, student)
    if not any(i["project_id"] == project_id for i in v2.work_items(db, enrollment)):
        raise HTTPException(404, "Work item not found")
    return enrollment


@router.get("/work/{project_id}/messages")
def my_feedback_messages(project_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment = _my_thread(db, student, project_id)
    msgs = v2.feedback_thread(db, enrollment.id, project_id)
    now = datetime.now(timezone.utc)
    for m in msgs:
        if m.sender_role == "staff" and m.read_at is None:
            m.read_at = now
    db.commit()
    return [v2.feedback_out(db, m, "/v2/me/feedback-messages/{id}/image") for m in msgs]


@router.post("/work/{project_id}/messages")
async def send_my_feedback_message(project_id: int, body: str | None = Form(None), image: UploadFile | None = File(None),
                                   db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment = _my_thread(db, student, project_id)
    text_ = (body or "").strip()[:8000] or None
    path = name = None
    if image is not None and image.filename:
        content, ext = await read_and_validate_upload(image, 10)
        if ext not in v2.FEEDBACK_IMAGE_EXTS:
            raise HTTPException(400, "Only PNG or JPG images can be attached")
        path, name = save(content, "feedback", image.filename), image.filename
    latest = (db.query(ProjectSubmission).filter(ProjectSubmission.enrollment_id == enrollment.id, ProjectSubmission.project_id == project_id)
              .order_by(ProjectSubmission.attempt_number.desc()).first())
    if latest is None or latest.status not in ("submitted", "under_review"):
        raise HTTPException(403, "You can message your reviewer only while a submission is awaiting review.")
    if not text_ and not path:
        raise HTTPException(400, "Write a message or attach an image")
    m = WorkFeedbackMessage(enrollment_id=enrollment.id, project_id=project_id, submission_id=latest.id if latest else None,
                            sender_user_id=student.user_id, sender_role="student", body=text_, image_path=path, image_name=name)
    db.add(m)
    db.commit()
    return v2.feedback_out(db, m, "/v2/me/feedback-messages/{id}/image")


@router.get("/feedback-messages/{message_id}/image")
def my_feedback_image(message_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    m = db.get(WorkFeedbackMessage, message_id)
    if m is None or not m.image_path:
        raise HTTPException(404, "Image not found")
    e = db.get(ProgramEnrollment, m.enrollment_id)
    if e is None or e.student_id != student.id:
        raise HTTPException(404, "Image not found")
    return download_response(m.image_path, m.image_name or "image")


@router.get("/work/{project_id}/resource")
def download_work_resource(project_id: int, kind: str = "details", db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, _, _ = _ctx(db, student)
    project = db.get(Project, project_id)
    options_visible = project and project.work_type == "project_option" and project.program_id == enrollment.program_id
    if options_visible:
        selections = v2.active_selections(db, enrollment.id)
        if selections and all(s.is_locked for s in selections) and project_id not in {s.project_id for s in selections}:
            options_visible = False  # selection locked: other options are no longer viewable
    assigned = any(i["project_id"] == project_id for i in v2.work_items(db, enrollment))
    path, name = ((project.guide_file_path, project.guide_file_name) if project and kind == "instructions"
                  else (project.instructions_file_path if project else None, project.instructions_file_name if project else None))
    if not project or not path or not (options_visible or assigned):
        raise HTTPException(404, "Resource not found")
    return download_response(path, name or "resource")


# ------------------------------------------------------------------ internship form + resume
class FormPayload(BaseModel):
    phone: str | None = Field(None, max_length=20)
    education: str | None = Field(None, max_length=2000)
    institution: str | None = Field(None, max_length=200)
    area_of_interest_id: int | None = None
    skills: str | None = Field(None, max_length=4000)
    experience: str | None = Field(None, max_length=4000)
    preferred_role: str | None = Field(None, max_length=300)
    comments: str | None = Field(None, max_length=4000)
    details: dict | None = None


FORM_FILL_WINDOW_DAYS = 10  # students should submit the form within this many days of the "fill from" date


def _form_gate(db, enrollment, tier, policy):
    v2.require_tier(db, enrollment, *v2.FORM_TIERS)
    # No lock: the form can be filled any time. The page shows the recommended window instead.


def _form_out(db, form: InternshipForm | None, enrollment, policy, student):
    unlock = v2.form_unlock_date(enrollment, policy)
    resumes = []
    if form:
        resumes = db.query(ResumeVersion).filter(ResumeVersion.internship_form_id == form.id).order_by(ResumeVersion.version.desc()).all()
    return {
        "available_on": unlock, "locked": False,
        "fill_from": unlock, "fill_by": (unlock + timedelta(days=FORM_FILL_WINDOW_DAYS)) if unlock else None,
        "status": form.status if form else "not_started", "review_status": form.review_status if form else None,
        "submitted_at": form.submitted_at if form else None,
        "student_name": student.full_name, "student_number": student.student_number,
        "email": db.get(User, student.user_id).email, "phone": student.phone,
        "education": form.education if form else student.degree, "institution": form.institution if form else student.institution,
        "area_of_interest_id": form.area_of_interest_id if form else None,
        "skills": form.skills if form else None, "experience": form.experience if form else None,
        "preferred_role": form.preferred_role if form else None, "comments": form.comments if form else None,
        "resumes": [{"id": r.id, "version": r.version, "file_name": r.file_name, "uploaded_at": r.uploaded_at} for r in resumes],
        "editable": (form is None or form.status in ("draft", "revision_required")),
        "details": _details_prefill(form, student) if v2.tier_for(db, enrollment) in FF.DETAILED_FORM_TIERS else None,
        "schema": FF.SECTIONS if v2.tier_for(db, enrollment) in FF.DETAILED_FORM_TIERS else None,
    }


def _details_prefill(form, student) -> dict:
    d = dict((form.details if form else None) or {})
    d.setdefault("phone", student.phone or "")
    d.setdefault("institution", (form.institution if form else None) or student.institution or "")
    if student.graduation_year:
        d.setdefault("graduation_year", student.graduation_year)
    return d


@router.get("/areas-of-interest")
def areas(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, _, _ = _ctx(db, student)
    rows = db.query(AreaOfInterest).filter(AreaOfInterest.active.is_(True)).order_by(AreaOfInterest.display_order, AreaOfInterest.name).all()
    limited = {a.area_of_interest_id: set() for a in db.query(AreaOfInterestProgram)}
    for a in db.query(AreaOfInterestProgram):
        limited[a.area_of_interest_id].add(a.program_id)
    return [{"id": r.id, "name": r.name} for r in rows if r.id not in limited or enrollment.program_id in limited[r.id]]


@router.get("/internship-form")
def get_form(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, policy = _ctx(db, student, allow_expired=True)
    v2.require_tier(db, enrollment, *v2.FORM_TIERS)
    form = db.query(InternshipForm).filter(InternshipForm.enrollment_id == enrollment.id).first()
    return {"tier": tier, "show_preferred_role": tier in ("career", "accelerator"), **_form_out(db, form, enrollment, policy, student)}


def _editable_form(db, enrollment, student) -> InternshipForm:
    form = db.query(InternshipForm).filter(InternshipForm.enrollment_id == enrollment.id).first()
    if form is None:
        form = InternshipForm(student_id=student.id, enrollment_id=enrollment.id, program_id=enrollment.program_id, status="draft")
        db.add(form)
        db.flush()
    elif form.status not in ("draft", "revision_required"):
        raise HTTPException(409, "Your internship form has been submitted and can no longer be edited")
    return form


@router.put("/internship-form")
def save_form(payload: FormPayload, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, policy = _ctx(db, student)
    _form_gate(db, enrollment, tier, policy)
    form = _editable_form(db, enrollment, student)
    if payload.area_of_interest_id is not None:
        area = db.get(AreaOfInterest, payload.area_of_interest_id)
        if area is None or not area.active:
            raise HTTPException(400, "Invalid area of interest")
    if tier in FF.DETAILED_FORM_TIERS:
        try:
            d = FF.clean(payload.details)
        except ValueError as e:
            raise HTTPException(400, str(e))
        form.details = d
        for k, v in FF.summary_text(d).items():
            setattr(form, k, v)
        form.institution = d.get("institution")
        area_name = FF.AREA_ALIASES.get(d.get("primary_area"), d.get("primary_area"))
        area = area_name and db.query(AreaOfInterest).filter(func.lower(AreaOfInterest.name) == area_name.lower(), AreaOfInterest.active.is_(True)).first()
        form.area_of_interest_id = area.id if area else None
        if d.get("phone"):
            student.phone = d["phone"][:20]
        db.commit()
        return _form_out(db, form, enrollment, policy, student)
    form.education, form.institution = payload.education, payload.institution
    form.area_of_interest_id, form.skills, form.experience = payload.area_of_interest_id, payload.skills, payload.experience
    form.comments, form.preferred_role = payload.comments, payload.preferred_role
    if payload.phone:
        student.phone = payload.phone
    db.commit()
    return _form_out(db, form, enrollment, policy, student)


@router.post("/internship-form/resume")
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, policy = _ctx(db, student)
    _form_gate(db, enrollment, tier, policy)
    form = _editable_form(db, enrollment, student)
    content, ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    if ext not in ("pdf", "docx"):
        raise HTTPException(400, "Resume must be a PDF or DOCX file")
    last = db.query(ResumeVersion).filter(ResumeVersion.internship_form_id == form.id).order_by(ResumeVersion.version.desc()).first()
    db.add(ResumeVersion(internship_form_id=form.id, version=(last.version + 1) if last else 1,
                         file_path=save(content, "resumes", file.filename), file_name=file.filename[:300],
                         uploaded_by=student.user_id))
    db.commit()
    return _form_out(db, form, enrollment, policy, student)


@router.post("/internship-form/submit")
def submit_form(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, policy = _ctx(db, student)
    _form_gate(db, enrollment, tier, policy)
    form = _editable_form(db, enrollment, student)
    if tier in FF.DETAILED_FORM_TIERS:
        missing = FF.missing(form.details or {})
    else:
        missing = [n for n, v in (("Education", form.education), ("College / University", form.institution),
                                  ("Area of Interest", form.area_of_interest_id), ("Skills", form.skills)) if not v]
    if not db.query(ResumeVersion).filter(ResumeVersion.internship_form_id == form.id).count():
        missing.append("Resume")
    if missing:
        raise HTTPException(400, "Please complete: " + ", ".join(missing))
    form.status, form.review_status, form.submitted_at = "submitted", "pending", datetime.now(timezone.utc)
    db.add(Notification(recipient_role="admin", title="Internship form submitted",
                        message=f"{student.full_name} ({student.student_number}, {v2.TIER_LABELS.get(tier, tier)}) submitted the Internship Form & Resume — "
                                f"review it in Work Management → {v2.TIER_LABELS.get(tier, tier)} → {'Assign Internship Task' if tier == 'accelerator' else 'Assign Work'}.",
                        notification_type="info"))
    v2.refresh_track(db, enrollment)
    db.commit()
    return _form_out(db, form, enrollment, policy, student)


@router.get("/internship-form/resume/{resume_id}")
def download_resume(resume_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    r = db.get(ResumeVersion, resume_id)
    form = r and db.get(InternshipForm, r.internship_form_id)
    if form is None or form.student_id != student.id:
        raise HTTPException(404, "Resume not found")
    return download_response(r.file_path, r.file_name)


# ------------------------------------------------------------------ mock interviews / eligibility
@router.get("/mock-interviews")
def my_mocks(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, policy = _ctx(db, student, allow_expired=True)
    v2.require_tier(db, enrollment, "career", "accelerator")
    rows = {m.interview_number: m for m in db.query(MockInterview).filter(MockInterview.enrollment_id == enrollment.id)}
    reqs = {r.interview_number: r for r in db.query(MockInterviewRequest).filter(MockInterviewRequest.enrollment_id == enrollment.id)}
    planned = {1: "Month 6", 2: "Month 9", 3: "Month 12"} if tier == "accelerator" else {}
    out = []
    for n in range(1, policy.mock_interview_count + 1):
        m, r = rows.get(n), reqs.get(n)
        active = m is not None and m.status != "cancelled"
        out.append({"number": n, "planned_for": planned.get(n), "scheduled": active,
                    "can_cancel": bool(active and m.status in ("scheduled", "rescheduled") and v2.mock_changeable(m.scheduled_at)),
                    "request": None if r is None or r.status == "cancelled" else
                    {"preferred_times": r.preferred_times, "note": r.note, "status": r.status, "updated_at": r.updated_at},
                    "was_cancelled": m is not None and m.status == "cancelled",
                    **({} if not active else {
                        "scheduled_at": m.scheduled_at, "scheduled_date": m.scheduled_date, "interviewer": m.interviewer_name,
                        "meeting_link": m.meeting_link, "status": "completed" if m.overall_result in ("pass", "fail") else (m.status or "scheduled"), "attendance": m.attendance_status,
                        "technical_feedback": m.technical_feedback, "communication_feedback": m.communication_feedback,
                        "overall_feedback": m.feedback, "result": m.overall_result,
                        "files": [{"id": f.id, "name": f.file_name, "size": f.file_size}
                                  for f in db.query(MockInterviewFile).filter(MockInterviewFile.mock_interview_id == m.id).order_by(MockInterviewFile.id)]})})
    return {"interviews": out, "window": v2.mock_window(enrollment), "access": v2.access_status(enrollment)}


@router.get("/mock-interview-files/{file_id}/download")
def my_mock_file(file_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    f = db.get(MockInterviewFile, file_id)
    m = f and db.get(MockInterview, f.mock_interview_id)
    e = m and db.get(ProgramEnrollment, m.enrollment_id)
    if not e or e.student_id != student.id:
        raise HTTPException(404, "File not found")
    return download_response(f.file_path, f.file_name)


class MockRequestPayload(BaseModel):
    preferred_times: list[datetime] = Field(min_length=5, max_length=5)
    note: str | None = Field(None, max_length=1000)


def _mock_slot(db, student, number):
    enrollment, tier, policy = _ctx(db, student)
    v2.require_tier(db, enrollment, "career", "accelerator")
    if not 1 <= number <= policy.mock_interview_count:
        raise HTTPException(404, "Mock interview not found")
    m = db.query(MockInterview).filter(MockInterview.enrollment_id == enrollment.id, MockInterview.interview_number == number).first()
    r = db.query(MockInterviewRequest).filter(MockInterviewRequest.enrollment_id == enrollment.id, MockInterviewRequest.interview_number == number).first()
    return enrollment, m, r


@router.put("/mock-interviews/{number}/request")
def request_mock(number: int, payload: MockRequestPayload, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, m, r = _mock_slot(db, student, number)
    if m is not None and m.status != "cancelled":
        raise HTTPException(409, "This mock interview is already scheduled")
    if number > 1:
        prev = db.query(MockInterview).filter(MockInterview.enrollment_id == enrollment.id, MockInterview.interview_number == number - 1).first()
        if prev is None or prev.status != "completed":
            raise HTTPException(409, f"Complete mock interview {number - 1} first")
    w = v2.mock_window(enrollment)
    if not w["open"]:
        raise HTTPException(409, f"It is too late to request a mock interview: it must take place at least {w['end_buffer_days']} days before your internship ends "
                                 f"({w['latest']:%d %b %Y}) and be requested at least {w['lead_days']} days in advance. Please contact Support.")
    times = sorted({t if t.tzinfo else t.replace(tzinfo=timezone.utc) for t in payload.preferred_times})
    if len(times) != 5:
        raise HTTPException(400, "Please give 5 different timings")
    for t in times:
        if t.date() < w["earliest"]:
            raise HTTPException(400, f"Every timing must be at least {w['lead_days']} days from today (on or after {w['earliest']:%d %b %Y})")
        if w["latest"] and t.date() > w["latest"]:
            raise HTTPException(400, f"Every timing must be on or before {w['latest']:%d %b %Y} ({w['end_buffer_days']} days before your internship ends)")
    if r is None:
        r = MockInterviewRequest(enrollment_id=enrollment.id, interview_number=number, preferred_times=[], status="pending")
        db.add(r)
    r.preferred_times, r.note, r.status = [t.isoformat() for t in times], (payload.note or "").strip() or None, "pending"
    db.add(Notification(recipient_role="admin", title="Mock interview request",
                        message=f"{student.full_name} ({student.student_number}) sent 5 preferred timings for mock interview {number}.",
                        notification_type="info"))
    db.commit()
    return {"ok": True}


@router.delete("/mock-interviews/{number}/request")
def withdraw_mock_request(number: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    _, m, r = _mock_slot(db, student, number)
    if r is None or r.status != "pending":
        raise HTTPException(409, "There is no pending request to withdraw")
    r.status = "cancelled"
    db.commit()
    return {"ok": True}


@router.post("/mock-interviews/{number}/cancel")
def cancel_my_mock(number: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    _, m, r = _mock_slot(db, student, number)
    if m is None or m.status not in ("scheduled", "rescheduled"):
        raise HTTPException(409, "Only a scheduled interview can be cancelled")
    if not v2.mock_changeable(m.scheduled_at):
        raise HTTPException(409, f"Interviews can't be cancelled less than {v2.MOCK_CHANGE_CUTOFF_DAYS} days before the scheduled time")
    m.status = "cancelled"
    if r is not None:
        r.status = "cancelled"
    db.add(Notification(recipient_role="admin", title="Mock interview cancelled by student",
                        message=f"{student.full_name} ({student.student_number}) cancelled mock interview {number}.", notification_type="alert"))
    db.commit()
    return {"ok": True}


@router.get("/eligibility")
def my_eligibility(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    enrollment, tier, policy = _ctx(db, student, allow_expired=True)
    v2.require_tier(db, enrollment, "accelerator")
    progress = v2.refresh_track(db, enrollment)
    result = v2.sync_eligibility(db, enrollment, policy)
    db.commit()
    return {"progress": progress, **result}


@router.get("/certificates")
def my_certificates(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    rows = (db.query(Certificate).filter(Certificate.student_id == student.id)
            .filter((Certificate.status.is_(None)) | (Certificate.status != "revoked"))
            .order_by(Certificate.issued_date.desc()).all())
    return [{"id": c.id, "type": c.certificate_type, "number": c.certificate_number, "issued_date": c.issued_date,
             "program": db.get(InternshipProgram, c.program_id).name} for c in rows]


@router.get("/certificates/{certificate_id}/download")
def download_my_certificate(certificate_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    c = db.get(Certificate, certificate_id)
    if c is None or c.student_id != student.id or c.status == "revoked":
        raise HTTPException(404, "Certificate not found")
    return download_response(c.file_path, f"{c.certificate_number}.pdf", "application/pdf")


@router.get("/invoices")
def my_invoices(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.models.portal_v2 import InvoiceArtifact
    rows = db.query(InvoiceArtifact).filter(InvoiceArtifact.student_id == student.id).order_by(InvoiceArtifact.id.desc()).all()
    out = []
    for a in rows:
        p = db.get(Payment, a.payment_id)
        out.append({"payment_id": p.id, "invoice_number": p.invoice_number, "amount": float(p.total_amount), "currency": p.currency,
                    "paid_at": p.paid_at, "program": db.get(InternshipProgram, a.program_id).name,
                    "base_amount": float(p.base_amount or 0), "fee_amount": float(p.fee_amount or 0),
                    "fee_percent": float(p.fee_percent or 0), "fee_type": p.fee_type, "status": p.status,
                    "method": p.payment_method, "transaction_id": p.razorpay_payment_id})
    return out


@router.get("/invoices/{payment_id}/download")
def download_my_invoice(payment_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.models.portal_v2 import InvoiceArtifact
    a = db.query(InvoiceArtifact).filter(InvoiceArtifact.payment_id == payment_id, InvoiceArtifact.student_id == student.id).first()
    if a is None:
        raise HTTPException(404, "Invoice not found")
    return download_response(a.file_path, f"Invoice-{db.get(Payment, payment_id).invoice_number}.pdf", "application/pdf")


@router.post("/profile-photo")
async def upload_profile_photo(file: UploadFile = File(...), db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    content, ext = await read_and_validate_upload(file, 5)
    if ext not in ("jpg", "jpeg", "png"):
        raise HTTPException(400, "Profile photo must be a JPG or PNG image")
    student.profile_photo_path = save(content, "profile_photos", file.filename)
    db.commit()
    return {"ok": True}


@router.get("/profile-photo")
def get_profile_photo(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    if not student.profile_photo_path:
        raise HTTPException(404, "No profile photo")
    ext = student.profile_photo_path.rsplit(".", 1)[-1].lower()
    return download_response(student.profile_photo_path, f"photo.{ext}", "image/png" if ext == "png" else "image/jpeg")


# ------------------------------------------------------------------ video curriculum
@router.get("/curriculum")
def my_curriculum(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    """Module > Chapter > Video for the student's program, with watched flags and completion %."""
    from app.models.content import LearningMaterial, MaterialAssignment, MaterialView
    from app.routers.v2_staff import curriculum_for_program
    from app.services.assignment_visibility import visible_ids_for_student
    e = v2.current_enrollment(db, student)
    v2.require_access(db, e)
    v2.require_launched(db, e)
    if v2.tier_for(db, e) != "accelerator":
        raise HTTPException(403, "Videos are available only in the Career Accelerator program")
    visible = set(visible_ids_for_student(db, student, MaterialAssignment, "material_id"))
    data = curriculum_for_program(db, e.program_id, published_only=True)
    watched = {r[0] for r in db.query(MaterialView.material_id).filter(MaterialView.student_id == student.id)}

    def mark(videos):
        return [v | {"watched": v["id"] in watched} for v in videos if v["id"] in visible]
    for m in data["modules"]:
        for c in m["chapters"]:
            c["videos"] = mark(c["videos"])
        vids = [v for c in m["chapters"] for v in c["videos"]]
        m["video_count"] = len(vids)
        m["minutes"] = sum(v["duration_minutes"] or 0 for v in vids)
        m["completed_percent"] = round(100 * sum(v["watched"] for v in vids) / len(vids)) if vids else 0
    data["unassigned"] = mark(data["unassigned"])
    return data


@router.post("/videos/{material_id}/watched")
def mark_video_watched(material_id: int, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.models.content import MaterialAssignment, MaterialView
    from app.services.assignment_visibility import visible_ids_for_student
    v2.require_launched(db, v2.current_enrollment(db, student))
    if material_id not in visible_ids_for_student(db, student, MaterialAssignment, "material_id"):
        raise HTTPException(403, "Video not available to you")
    if not db.query(MaterialView.id).filter(MaterialView.student_id == student.id, MaterialView.material_id == material_id).first():
        db.add(MaterialView(student_id=student.id, material_id=material_id))
        db.commit()
    return {"ok": True}
