"""Admin Portal V2 API (/api/v2/staff). Admin and Instructor share the academic
endpoints; pricing, offers, payments and access control are Admin-only and are
rejected with 403 for Instructors regardless of what the UI shows."""
from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_staff, get_current_user, require_admin
from app.models.auth import Role, User
from app.models.engagement import Certificate, Notification, SupportTicket
from app.models.people import Admin, Student
from app.models.portal_v2 import (
    MockInterviewRequest,
    WorkFeedbackMessage,
    AreaOfInterest, CertificateEvent, DeliveryAttempt, DocumentDelivery, EligibilityCriterion, EligibilityState,
    EnrollmentAccessExtension, InternshipForm, InvoiceArtifact, ProgramWorkflowPolicy, ProjectSelection,
    ProjectSelectionEvent, ResumeVersion, ReviewEvent,
)
from app.models.proctoring import ProctoringViolation
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.models.project import MockInterview, MockInterviewFile, Project, ProjectAssignment, ProjectSubmission
from app.models.tiers import EVALUATION_FIELDS, EVALUATION_MODELS, TRACK_MODELS, StudentAdminNote
from app.services import v2
from app.services import internship_form_fields as FF
from app.services.activity_log_service import log_activity
from app.services.notification_service import notify_student
from app.services.certificate_service import render_welcome_certificate_pdf
from app.services.storage import download_response, overwrite as storage_overwrite, save
from app.services.v2_documents import (
    completion_pdf, dispatch, issue_completion_certificate, queue_delivery, revoke_certificate,
)
from app.utils.file_validation import read_and_validate_upload

router = APIRouter(prefix="/api/v2/staff", tags=["portal-v2-staff"], dependencies=[Depends(get_current_staff)])

TIERS = tuple(v2.TIER_LABELS)


def _role(db: Session, user: User) -> str:
    return db.get(Role, user.role_id).name


def _tier_program(db: Session, tier: str) -> InternshipProgram:
    if tier not in TIERS:
        raise HTTPException(404, "Unknown program tier")
    program = db.query(InternshipProgram).filter(InternshipProgram.code == v2.TIER_CODES[tier]).first()
    if program is None:
        raise HTTPException(404, "Program not configured")
    return program


def _enrollment(db: Session, enrollment_id: int, tier: str | None = None) -> ProgramEnrollment:
    e = db.get(ProgramEnrollment, enrollment_id)
    if e is None or e.workflow_policy_id is None:
        raise HTTPException(404, "V2 enrollment not found")
    if tier and v2.tier_for(db, e) != tier:
        raise HTTPException(404, "Enrollment is not in this program")
    return e


def _student_row(db: Session, e: ProgramEnrollment) -> dict:
    s = db.get(Student, e.student_id)
    return {"enrollment_id": e.id, "student_id": s.id, "student_number": s.student_number, "name": s.full_name,
            "email": db.get(User, s.user_id).email, "status": e.status, "access": v2.access_status(e),
            "start_date": e.start_date, "end_date": e.expected_end_date, "days_remaining": v2.days_remaining(e)}


# ======================================================================= dashboard
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    is_admin = _role(db, user) == "admin"
    v2_rows = db.query(ProgramEnrollment).filter(ProgramEnrollment.workflow_policy_id.isnot(None)).all()
    by_tier = {t: 0 for t in TIERS}
    active = completed = 0
    for e in v2_rows:
        if e.status in ("active", "completed"):
            by_tier[v2.tier_for(db, e)] += 1
        if v2.access_status(e) == "active":
            active += 1
        if e.status == "completed":
            completed += 1
    recent = (db.query(ProgramEnrollment).filter(ProgramEnrollment.workflow_policy_id.isnot(None))
              .order_by(ProgramEnrollment.enrolled_at.desc()).limit(8).all())
    upcoming = (db.query(MockInterview).filter(MockInterview.scheduled_date >= v2.today(),
                                               or_(MockInterview.status.is_(None), MockInterview.status == "scheduled"))
                .order_by(MockInterview.scheduled_date).limit(8).all())
    suspended = db.query(ProgramEnrollment).filter(ProgramEnrollment.status == "suspended").count()
    out = {
        "total_students": db.query(Student).count(), "active_students": active, "completed_students": completed,
        "students_by_program": [{"tier": t, "label": v2.TIER_LABELS[t], "count": by_tier[t]} for t in TIERS],
        "pending_submissions": v2.dashboard_counts(db)["pending_submissions"],
        "pending_forms": db.query(InternshipForm).filter(InternshipForm.status == "submitted",
                                                         InternshipForm.review_status.in_(("pending", "under_review"))).count(),
        "suspended_accounts": suspended,
        "open_tickets": db.query(SupportTicket).filter(SupportTicket.status.in_(("open", "in_progress"))).count(),
        "recent_registrations": [{**_student_row(db, e), "tier_label": v2.TIER_LABELS[v2.tier_for(db, e)],
                                  "enrolled_at": e.enrolled_at} for e in recent],
        "upcoming_mock_interviews": [{"id": m.id, "number": m.interview_number, "date": m.scheduled_date,
                                      "scheduled_at": m.scheduled_at, "student": db.get(Student, db.get(ProgramEnrollment, m.enrollment_id).student_id).full_name,
                                      "interviewer": m.interviewer_name} for m in upcoming],
        "recent_violations": [{"id": v.id, "student_id": v.student_id, "type": v.violation_type, "at": v.created_at}
                              for v in db.query(ProctoringViolation).order_by(ProctoringViolation.id.desc()).limit(5)],
    }
    # Per-tier work overview (dashboard "Work Management" panel).
    work = {}
    for t in TIERS:
        program = db.query(InternshipProgram).filter(InternshipProgram.code == v2.TIER_CODES[t]).first()
        ids = [e.id for e in v2_rows if program and e.program_id == program.id]
        active_ids = [e.id for e in v2_rows if program and e.program_id == program.id and e.status == "active"]
        evaluated = {r[0] for r in db.query(EVALUATION_MODELS[t].enrollment_id).filter(EVALUATION_MODELS[t].enrollment_id.in_(active_ids or [0]))}
        work[t] = {
            "projects": db.query(Project).filter(Project.program_id == program.id, Project.is_active.is_(True)).count() if program else 0,
            "assignments": db.query(ProjectAssignment).filter(ProjectAssignment.enrollment_id.in_(ids or [0]),
                                                              or_(ProjectAssignment.status.is_(None), ProjectAssignment.status != "completed")).count(),
            "submissions": db.query(ProjectSubmission).filter(ProjectSubmission.enrollment_id.in_(ids or [0]),
                                                              ProjectSubmission.status.in_(("submitted", "under_review"))).count(),
            "forms": db.query(InternshipForm).filter(InternshipForm.enrollment_id.in_(ids or [0]), InternshipForm.status == "submitted",
                                                     InternshipForm.review_status.in_(("pending", "under_review"))).count()
                     if t in v2.FORM_TIERS else None,
            "evaluations": len(set(active_ids) - evaluated),
        }
    out["work_by_tier"] = work
    if is_admin:  # financial widgets never leave the server for Instructors
        paid = db.query(Payment).filter(Payment.status == "paid").order_by(Payment.paid_at.desc()).limit(8).all()
        out["recent_payments"] = [{"id": p.id, "student": db.get(Student, p.student_id).full_name, "amount": float(p.total_amount),
                                   "currency": p.currency, "paid_at": p.paid_at, "invoice_number": p.invoice_number} for p in paid]
        out["failed_deliveries"] = db.query(DocumentDelivery).filter(DocumentDelivery.status == "failed").count()
    return out


# ======================================================================= programs
class ProgramInfoUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=150)
    description: str | None = None
    duration: int | None = Field(None, gt=0)
    is_active: bool | None = None
    mcq_enabled: bool | None = None


class ProgramPricingUpdate(BaseModel):
    price_inr: Decimal | None = Field(None, ge=0)
    price_usd: Decimal | None = Field(None, ge=0)
    gst_percent: Decimal | None = Field(None, ge=0, le=100)
    platform_fee_percent: Decimal | None = Field(None, ge=0, le=100)


class OfferUpdate(BaseModel):
    offer_enabled: bool
    offer_price_inr: Decimal | None = Field(None, ge=0)
    offer_price_usd: Decimal | None = Field(None, ge=0)
    offer_start_at: datetime | None = None
    offer_end_at: datetime | None = None

    @model_validator(mode="after")
    def check(self):
        if self.offer_enabled:
            if not (self.offer_start_at and self.offer_end_at):
                raise ValueError("Offer start and end date/time are required")
            if self.offer_start_at.tzinfo is None or self.offer_end_at.tzinfo is None:
                raise ValueError("Offer times must include a timezone")
            if self.offer_end_at <= self.offer_start_at:
                raise ValueError("Offer end must be after offer start")
            if self.offer_price_inr is None and self.offer_price_usd is None:
                raise ValueError("Set an INR and/or international offer price")
        return self


def _program_out(db, p: InternshipProgram, is_admin: bool) -> dict:
    policy = db.get(ProgramWorkflowPolicy, p.workflow_policy_id) if p.workflow_policy_id else None
    out = {"id": p.id, "code": p.code, "tier": v2.program_tier(p), "name": p.name, "description": p.description,
           "duration": p.duration or p.duration_weeks, "duration_unit": p.duration_unit or "weeks",
           "is_active": p.is_active, "is_v2": policy is not None,
           "mcq_enabled": policy.mcq_enabled if policy else None,
           "enrolled": db.query(ProgramEnrollment).filter(ProgramEnrollment.program_id == p.id,
                                                          ProgramEnrollment.status.in_(("active", "completed"))).count()}
    if is_admin:
        inr, inr_offer = v2.price_for(p, "INR")
        usd, _ = v2.price_for(p, "USD")
        out.update(price_inr=float(p.price_inr), price_usd=float(p.price_usd), gst_percent=float(p.gst_percent),
                   platform_fee_percent=float(p.platform_fee_percent), offer_enabled=p.offer_enabled,
                   offer_price_inr=float(p.offer_price_inr) if p.offer_price_inr is not None else None,
                   offer_price_usd=float(p.offer_price_usd) if p.offer_price_usd is not None else None,
                   offer_start_at=p.offer_start_at, offer_end_at=p.offer_end_at,
                   current_price_inr=float(inr), current_price_usd=float(usd), offer_live=inr_offer)
    return out


@router.get("/programs")
def programs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    is_admin = _role(db, user) == "admin"
    rows = db.query(InternshipProgram).order_by(InternshipProgram.workflow_policy_id.nullslast(), InternshipProgram.id).all()
    return [_program_out(db, p, is_admin) for p in rows]


@router.put("/programs/{program_id}")
def update_program_info(program_id: int, payload: ProgramInfoUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(InternshipProgram, program_id)
    if p is None:
        raise HTTPException(404, "Program not found")
    data = payload.model_dump(exclude_unset=True)
    if "is_active" in data and _role(db, user) != "admin":
        raise HTTPException(403, "Only an Admin can activate or deactivate a program")
    if "mcq_enabled" in data:
        policy = db.get(ProgramWorkflowPolicy, p.workflow_policy_id) if p.workflow_policy_id else None
        if policy is None:
            raise HTTPException(400, "MCQ setting applies to V2 programs only")
        policy.mcq_enabled = data.pop("mcq_enabled")
    if "duration" in data:
        # Changing duration affects future enrollments only (existing dates are stored per enrollment).
        p.duration = data.pop("duration")
    for k, val in data.items():
        setattr(p, k, val)
    log_activity(db, user.id, _role(db, user), "update_program_info", "internship_programs", p.id, None)
    db.commit()
    return _program_out(db, p, _role(db, user) == "admin")


@router.put("/programs/{program_id}/pricing", dependencies=[Depends(require_admin)])
def update_pricing(program_id: int, payload: ProgramPricingUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(InternshipProgram, program_id)
    if p is None:
        raise HTTPException(404, "Program not found")
    for k, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(p, k, val)
    log_activity(db, user.id, "admin", "update_program_pricing", "internship_programs", p.id, None)
    db.commit()
    return _program_out(db, p, True)


@router.put("/programs/{program_id}/offer", dependencies=[Depends(require_admin)])
def update_offer(program_id: int, payload: OfferUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(InternshipProgram, program_id)
    if p is None:
        raise HTTPException(404, "Program not found")
    p.offer_enabled = payload.offer_enabled
    if payload.offer_enabled:
        p.offer_price_inr, p.offer_price_usd = payload.offer_price_inr, payload.offer_price_usd
        p.offer_start_at, p.offer_end_at = payload.offer_start_at, payload.offer_end_at
        # The timestamp window supersedes any legacy date-only window.
        p.offer_start_date = p.offer_end_date = None
    log_activity(db, user.id, "admin", "update_program_offer", "internship_programs", p.id, None)
    db.commit()
    return _program_out(db, p, True)


# ======================================================================= students (per tier)
@router.get("/students")
def students(tier: str, search: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    program = _tier_program(db, tier)
    q = (db.query(ProgramEnrollment).join(Student, Student.id == ProgramEnrollment.student_id).join(User, User.id == Student.user_id)
         .filter(ProgramEnrollment.program_id == program.id, ProgramEnrollment.workflow_policy_id.isnot(None)))
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(or_(Student.full_name.ilike(like), User.email.ilike(like), Student.student_number.ilike(like)))
    if status:
        q = q.filter(ProgramEnrollment.status == status)
    rows = []
    for e in q.order_by(ProgramEnrollment.id.desc()).limit(500):
        row = _student_row(db, e)
        track = db.query(TRACK_MODELS[tier]).filter(TRACK_MODELS[tier].enrollment_id == e.id).first()
        row["track_status"] = track.status if track else None
        rows.append(row)
    return {"tier": tier, "label": v2.TIER_LABELS[tier], "program_id": program.id, "students": rows}


@router.get("/enrollments/{enrollment_id}")
def enrollment_detail(enrollment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = _enrollment(db, enrollment_id)
    is_admin = _role(db, user) == "admin"
    tier = v2.tier_for(db, e)
    s = db.get(Student, e.student_id)
    progress = v2.refresh_track(db, e)
    db.commit()
    items = v2.work_items(db, e)
    form = db.query(InternshipForm).filter(InternshipForm.enrollment_id == e.id).first()
    out = {
        "tier": tier, "tier_label": v2.TIER_LABELS[tier],
        "student": {"id": s.id, "student_number": s.student_number, "name": s.full_name, "email": db.get(User, s.user_id).email,
                    "phone": s.phone, "institution": s.institution, "degree": s.degree, "city": s.city, "country": s.country,
                    "citizenship": s.citizenship_status,
                    "national_id": _national_id_out(s)},
        "enrollment": {**_student_row(db, e), "enrolled_at": e.enrolled_at, "original_end_date": e.original_end_date,
                       "suspension_reason": e.suspension_reason},
        "progress": progress,
        "mcq": v2.mcq_summary(db, e) if tier in ("basic", "professional") or (tier == "accelerator") else None,
        "work": [{k: i[k] for k in ("kind", "label", "title", "project_id", "status", "status_label", "deadline")} | {"versions": len(i["submissions"])} for i in items],
        "internship_form": {"id": form.id, "status": form.status, "review_status": form.review_status, "submitted_at": form.submitted_at} if form else None,
        "certificates": [{"id": c.id, "type": c.certificate_type, "number": c.certificate_number, "issued_date": c.issued_date,
                          "status": c.status or "issued"} for c in db.query(Certificate).filter(Certificate.enrollment_id == e.id)],
        "extensions": [{"previous_end_date": x.previous_end_date, "new_end_date": x.new_end_date, "reason": x.reason,
                        "granted_by": db.get(User, x.granted_by).email, "granted_at": x.granted_at, "status": x.status}
                       for x in db.query(EnrollmentAccessExtension).filter(EnrollmentAccessExtension.enrollment_id == e.id)
                       .order_by(EnrollmentAccessExtension.granted_at.desc())],
        "proctoring": [{"id": v.id, "type": v.violation_type, "at": v.created_at, "severity": v.severity, "category": v.category, "reviewed": v.reviewed}
                       for v in db.query(ProctoringViolation).filter(ProctoringViolation.student_id == s.id).order_by(ProctoringViolation.id.desc()).limit(20)],
        "notes": [{"id": n.id, "note": n.note, "author": db.get(User, n.author_user_id).email, "at": n.created_at}
                  for n in db.query(StudentAdminNote).filter(StudentAdminNote.student_id == s.id).order_by(StudentAdminNote.id.desc())],
        "can_manage_access": is_admin,
        "other_enrollments": [{"enrollment_id": o.id, "tier": v2.tier_for(db, o), "tier_label": v2.TIER_LABELS.get(v2.tier_for(db, o), ""),
                               "status": o.status, "enrolled_at": o.enrolled_at, "note": o.suspension_reason}
                              for o in v2.v2_enrollments(db, s) if o.id != e.id],
    }
    if is_admin:
        out["payments"] = [{"id": p.id, "status": p.status, "amount": float(p.total_amount), "base": float(p.base_amount),
                            "fee": float(p.fee_amount), "fee_type": p.fee_type, "currency": p.currency, "invoice_number": p.invoice_number,
                            "razorpay_payment_id": p.razorpay_payment_id, "razorpay_order_id": p.razorpay_order_id,
                            "paid_at": p.paid_at, "created_at": p.created_at, "notes": p.notes}
                           for p in db.query(Payment).filter(Payment.enrollment_id == e.id).order_by(Payment.id.desc())]
    return out


# ======================================================================= identity verification
def _national_id_out(s: Student) -> dict:
    return {"type": s.national_id_type, "number": s.national_id_number,
            "front_name": s.national_id_document_front_name, "back_name": s.national_id_document_back_name,
            "has_front": bool(s.national_id_document_front_path), "has_back": bool(s.national_id_document_back_path),
            "verified": bool(s.national_id_verified)}


def _student_or_404(db: Session, student_id: int) -> Student:
    s = db.get(Student, student_id)
    if s is None:
        raise HTTPException(404, "Student not found")
    return s


class NationalIdPayload(BaseModel):
    type: str | None = Field(default=None, max_length=50)
    number: str | None = Field(default=None, max_length=50)


@router.get("/students/{student_id}/national-id/{side}")
def national_id_download(student_id: int, side: str, db: Session = Depends(get_db)):
    import mimetypes
    if side not in ("front", "back"):
        raise HTTPException(404, "Invalid document side")
    s = _student_or_404(db, student_id)
    path = getattr(s, f"national_id_document_{side}_path")
    if not path:
        raise HTTPException(404, "No document uploaded for this side")
    name = getattr(s, f"national_id_document_{side}_name") or f"id-{side}"
    media, _ = mimetypes.guess_type(name or path)
    try:
        return download_response(path, filename=name, media_type=media or "application/octet-stream")
    except HTTPException as exc:
        if exc.status_code == 404:
            raise HTTPException(404, "This file is no longer in storage. Upload it again using Replace.") from exc
        raise


@router.put("/students/{student_id}/national-id")
def national_id_update(student_id: int, payload: NationalIdPayload, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    s = _student_or_404(db, student_id)
    if s.national_id_verified:
        raise HTTPException(409, "This ID is verified and locked")
    s.national_id_type = (payload.type or "").strip() or None
    s.national_id_number = (payload.number or "").strip() or None
    log_activity(db, user.id, "admin", "update_national_id", "students", s.id, None)
    db.commit()
    return _national_id_out(s)


@router.post("/students/{student_id}/national-id/{side}")
async def national_id_upload(student_id: int, side: str, file: UploadFile = File(...), db: Session = Depends(get_db),
                             user: User = Depends(get_current_user)):
    from app.routers.students import _set_national_id_document
    if side not in ("front", "back"):
        raise HTTPException(404, "Invalid document side")
    s = _student_or_404(db, student_id)
    content, _ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    _set_national_id_document(s, side, file, content)  # refuses if verified
    log_activity(db, user.id, "admin", f"upload_national_id_document_{side}", "students", s.id, file.filename)
    db.commit()
    return _national_id_out(s)


@router.post("/students/{student_id}/national-id-verify")
def national_id_verify(student_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = _student_or_404(db, student_id)
    if s.national_id_verified:
        raise HTTPException(409, "Already verified")
    if not (s.national_id_type and s.national_id_number):
        raise HTTPException(400, "Enter the ID type and number before verifying")
    if not (s.national_id_document_front_path and s.national_id_document_back_path):
        raise HTTPException(400, "Both front and back documents are needed before verifying")
    s.national_id_verified = True
    log_activity(db, user.id, "admin", "verify_national_id", "students", s.id, s.full_name)
    db.commit()
    return _national_id_out(s)


class NotePayload(BaseModel):
    note: str = Field(min_length=1, max_length=4000)


@router.post("/students/{student_id}/notes")
def add_note(student_id: int, payload: NotePayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.get(Student, student_id) is None:
        raise HTTPException(404, "Student not found")
    db.add(StudentAdminNote(student_id=student_id, author_user_id=user.id, note=payload.note.strip()))
    db.commit()
    return {"ok": True}


class ExtensionPayload(BaseModel):
    new_end_date: date
    reason: str = Field(min_length=3, max_length=2000)


@router.post("/enrollments/{enrollment_id}/extend", dependencies=[Depends(require_admin)])
def extend_access(enrollment_id: int, payload: ExtensionPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = _enrollment(db, enrollment_id)
    previous = e.expected_end_date
    if previous and payload.new_end_date <= previous:
        raise HTTPException(400, "The new end date must be later than the current end date")
    if e.original_end_date is None:
        e.original_end_date = previous
    db.add(EnrollmentAccessExtension(enrollment_id=e.id, previous_end_date=previous, new_end_date=payload.new_end_date,
                                     reason=payload.reason.strip(), granted_by=user.id))
    e.expected_end_date = payload.new_end_date
    notify_student(db, db.get(Student, e.student_id), "Access extended",
                   f"Your program access has been extended until {payload.new_end_date.isoformat()}.", "info", "/dashboard")
    log_activity(db, user.id, "admin", "extend_access", "program_enrollments", e.id, None)
    db.commit()
    return {"end_date": e.expected_end_date}


class StatusPayload(BaseModel):
    action: str = Field(pattern="^(suspend|unlock|complete)$")
    reason: str | None = Field(None, max_length=2000)


@router.post("/enrollments/{enrollment_id}/status", dependencies=[Depends(require_admin)])
def change_status(enrollment_id: int, payload: StatusPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = _enrollment(db, enrollment_id)
    old = e.status
    if payload.action == "suspend":
        if not payload.reason:
            raise HTTPException(400, "A reason is required to suspend")
        e.status, e.suspension_reason = "suspended", payload.reason
    elif payload.action == "unlock":
        if e.status != "suspended":
            raise HTTPException(409, "Enrollment is not suspended")
        e.status, e.suspension_reason = "active", None
    else:
        e.status, e.completed_at = "completed", datetime.now(timezone.utc)
    log_activity(db, user.id, "admin", f"enrollment_{payload.action}", "program_enrollments", e.id, f"{old} -> {e.status}: {payload.reason or ''}")
    db.commit()
    return {"status": e.status}


# ======================================================================= MCQ questions (one question bank per tier)
class QuestionPayload(BaseModel):
    question_text: str = Field(min_length=3)
    option_a: str = Field(min_length=1)
    option_b: str = Field(min_length=1)
    option_c: str = Field(min_length=1)
    option_d: str = Field(min_length=1)
    correct_option: str = Field(pattern="^[ABCD]$")
    explanation: str | None = None


class McqSettingsPayload(BaseModel):
    enabled: bool | None = None
    questions_per_attempt: int | None = Field(None, ge=1, le=500)
    passing_percent: Decimal | None = Field(None, ge=0, le=100)
    time_limit_minutes: int | None = Field(None, ge=1, le=600)
    max_attempts: int | None = Field(None, ge=1, le=100)
    attempts_per_day: int | None = Field(None, ge=1, le=100)


def _tier_quiz(db: Session, tier: str, staff: Admin | None = None):
    """The tier's MCQ quiz; created on first use when a staff profile is given."""
    from app.models.assessment import Quiz
    program = _tier_program(db, tier)
    quiz = (db.query(Quiz).filter(Quiz.program_id == program.id, Quiz.is_active.is_(True))
            .order_by(Quiz.id).first())
    if quiz is None and staff is not None:
        quiz = Quiz(title=f"{program.name} MCQ", program_id=program.id, question_bank_size=0, questions_per_attempt=20,
                    passing_percent=60, max_attempts=3, attempts_per_day=1, time_limit_minutes=30, is_active=True,
                    created_by=staff.id)
        db.add(quiz)
        db.flush()
    return program, quiz


def _question_out(q) -> dict:
    return {"id": q.id, "question_text": q.question_text, "option_a": q.option_a, "option_b": q.option_b,
            "option_c": q.option_c, "option_d": q.option_d, "correct_option": q.correct_option, "explanation": q.explanation}


@router.get("/work/{tier}/questions")
def list_tier_questions(tier: str, db: Session = Depends(get_db)):
    from app.models.assessment import QuizQuestion
    program, quiz = _tier_quiz(db, tier)
    policy = db.get(ProgramWorkflowPolicy, program.workflow_policy_id) if program.workflow_policy_id else None
    enabled = tier in ("basic", "professional") or bool(policy and policy.mcq_enabled)
    questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).order_by(QuizQuestion.id).all() if quiz else []
    return {"enabled": enabled, "always_on": tier in ("basic", "professional"),
            "settings": {"questions_per_attempt": quiz.questions_per_attempt, "passing_percent": float(quiz.passing_percent),
                         "time_limit_minutes": quiz.time_limit_minutes, "max_attempts": quiz.max_attempts,
                         "attempts_per_day": quiz.attempts_per_day} if quiz else None,
            "questions": [_question_out(q) for q in questions]}


@router.put("/work/{tier}/questions/settings")
def update_tier_mcq_settings(tier: str, payload: McqSettingsPayload, db: Session = Depends(get_db), staff: Admin = Depends(get_current_staff)):
    program, quiz = _tier_quiz(db, tier, staff)
    data = payload.model_dump(exclude_unset=True, exclude_none=True)
    enabled = data.pop("enabled", None)
    if enabled is not None and tier not in ("basic", "professional") and program.workflow_policy_id:
        db.get(ProgramWorkflowPolicy, program.workflow_policy_id).mcq_enabled = enabled
    for k, v in data.items():
        setattr(quiz, k, v)
    db.commit()
    return {"ok": True}


@router.post("/work/{tier}/questions")
def add_tier_question(tier: str, payload: QuestionPayload, db: Session = Depends(get_db), staff: Admin = Depends(get_current_staff)):
    from app.models.assessment import QuizQuestion
    _, quiz = _tier_quiz(db, tier, staff)
    q = QuizQuestion(quiz_id=quiz.id, **payload.model_dump())
    db.add(q)
    quiz.question_bank_size = (quiz.question_bank_size or 0) + 1
    db.commit()
    return _question_out(q)


@router.post("/work/{tier}/questions/upload")
async def upload_tier_questions(tier: str, file: UploadFile = File(...), db: Session = Depends(get_db), staff: Admin = Depends(get_current_staff)):
    """Excel (.xlsx): columns question | A | B | C | D | correct letter. A header row is skipped."""
    from app.models.assessment import QuizQuestion
    from app.services.quiz_sheet_service import parse_mcq_sheet
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(400, "Upload an Excel .xlsx file")
    content, _ = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    rows, skipped = parse_mcq_sheet(content)
    if not rows:
        raise HTTPException(400, "No valid questions found. Columns: question, option A, B, C, D, correct letter (A-D).")
    _, quiz = _tier_quiz(db, tier, staff)
    for r in rows:
        db.add(QuizQuestion(quiz_id=quiz.id, question_text=r["question_text"], option_a=r["option_a"], option_b=r["option_b"],
                            option_c=r["option_c"], option_d=r["option_d"], correct_option=r["correct_option"]))
    quiz.question_bank_size = (quiz.question_bank_size or 0) + len(rows)
    db.commit()
    return {"added": len(rows), "skipped": skipped}


def _tier_question(db: Session, tier: str, question_id: int):
    from app.models.assessment import QuizQuestion
    program = _tier_program(db, tier)
    q = db.get(QuizQuestion, question_id)
    if q is None or q.quiz.program_id != program.id:
        raise HTTPException(404, "Question not found in this program")
    return q


@router.put("/work/{tier}/questions/{question_id}")
def update_tier_question(tier: str, question_id: int, payload: QuestionPayload, db: Session = Depends(get_db)):
    q = _tier_question(db, tier, question_id)
    for k, v in payload.model_dump().items():
        setattr(q, k, v)
    db.commit()
    return _question_out(q)


@router.delete("/work/{tier}/questions/{question_id}")
def delete_tier_question(tier: str, question_id: int, db: Session = Depends(get_db)):
    from app.models.assessment import QuizAttemptAnswer
    q = _tier_question(db, tier, question_id)
    if db.query(QuizAttemptAnswer.id).filter(QuizAttemptAnswer.question_id == q.id).first():
        raise HTTPException(409, "Students have already answered this question, so it can't be deleted. Edit it instead.")
    quiz = q.quiz
    db.delete(q)
    quiz.question_bank_size = max((quiz.question_bank_size or 1) - 1, 0)
    db.commit()
    return {"ok": True}


# ======================================================================= video curriculum (Module > Chapter > Video)
class ModulePayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    display_order: int | None = None


class ChapterPayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    display_order: int | None = None


def _video_out(m) -> dict:
    return {"id": m.id, "title": m.title, "description": m.description, "file_type": m.file_type,
            "resource_url": m.resource_url, "duration_minutes": m.duration_minutes, "display_order": m.display_order,
            "publication_state": m.publication_state, "chapter_id": m.chapter_id, "has_file": bool(m.file_path)}


def curriculum_for_program(db: Session, program_id: int, published_only: bool = False) -> dict:
    from app.models.content import CourseModule, LearningMaterial
    q = db.query(LearningMaterial).filter(LearningMaterial.program_id == program_id, LearningMaterial.content_type == "video")
    if published_only:
        q = q.filter(LearningMaterial.publication_state == "published")
    videos = q.order_by(LearningMaterial.display_order, LearningMaterial.id).all()
    by_chapter: dict[int | None, list] = {}
    for v in videos:
        by_chapter.setdefault(v.chapter_id, []).append(_video_out(v))
    modules = (db.query(CourseModule).filter(CourseModule.program_id == program_id)
               .order_by(CourseModule.display_order, CourseModule.id).all())
    out = []
    for n, m in enumerate(modules, 1):
        chapters = [{"id": c.id, "number": i, "title": c.title, "display_order": c.display_order,
                     "videos": by_chapter.get(c.id, [])} for i, c in enumerate(m.chapters, 1)]
        out.append({"id": m.id, "number": n, "title": m.title, "description": m.description, "display_order": m.display_order,
                    "chapters": chapters, "video_count": sum(len(c["videos"]) for c in chapters),
                    "minutes": sum(v["duration_minutes"] or 0 for c in chapters for v in c["videos"])})
    return {"modules": out, "unassigned": by_chapter.get(None, [])}


def _module(db: Session, tier: str, module_id: int):
    from app.models.content import CourseModule
    program = _tier_program(db, tier)
    m = db.get(CourseModule, module_id)
    if m is None or m.program_id != program.id:
        raise HTTPException(404, "Module not found in this program")
    return m


def _chapter(db: Session, tier: str, chapter_id: int):
    from app.models.content import CourseChapter
    c = db.get(CourseChapter, chapter_id)
    if c is None:
        raise HTTPException(404, "Chapter not found")
    _module(db, tier, c.module_id)
    return c


@router.get("/work/{tier}/curriculum")
def get_curriculum(tier: str, db: Session = Depends(get_db)):
    program = _tier_program(db, tier)
    return {"program_id": program.id, **curriculum_for_program(db, program.id)}


@router.post("/work/{tier}/modules")
def create_module(tier: str, payload: ModulePayload, db: Session = Depends(get_db)):
    from app.models.content import CourseModule
    program = _tier_program(db, tier)
    order = payload.display_order
    if order is None:
        order = (db.query(func.max(CourseModule.display_order)).filter(CourseModule.program_id == program.id).scalar() or 0) + 1
    m = CourseModule(program_id=program.id, title=payload.title.strip(), description=payload.description, display_order=order)
    db.add(m)
    db.commit()
    return {"id": m.id}


@router.put("/work/{tier}/modules/{module_id}")
def update_module(tier: str, module_id: int, payload: ModulePayload, db: Session = Depends(get_db)):
    m = _module(db, tier, module_id)
    m.title, m.description = payload.title.strip(), payload.description
    if payload.display_order is not None:
        m.display_order = payload.display_order
    db.commit()
    return {"ok": True}


@router.delete("/work/{tier}/modules/{module_id}")
def delete_module(tier: str, module_id: int, db: Session = Depends(get_db)):
    """Deletes the module and its chapters. Its videos are kept and move to "Not in a module"."""
    from app.models.content import LearningMaterial
    m = _module(db, tier, module_id)
    ids = [c.id for c in m.chapters]
    if ids:
        db.query(LearningMaterial).filter(LearningMaterial.chapter_id.in_(ids)).update({"chapter_id": None}, synchronize_session=False)
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.post("/work/{tier}/modules/{module_id}/chapters")
def create_chapter(tier: str, module_id: int, payload: ChapterPayload, db: Session = Depends(get_db)):
    from app.models.content import CourseChapter
    m = _module(db, tier, module_id)
    order = payload.display_order if payload.display_order is not None else len(m.chapters) + 1
    c = CourseChapter(module_id=m.id, title=payload.title.strip(), display_order=order)
    db.add(c)
    db.commit()
    return {"id": c.id}


@router.put("/work/{tier}/chapters/{chapter_id}")
def update_chapter(tier: str, chapter_id: int, payload: ChapterPayload, db: Session = Depends(get_db)):
    c = _chapter(db, tier, chapter_id)
    c.title = payload.title.strip()
    if payload.display_order is not None:
        c.display_order = payload.display_order
    db.commit()
    return {"ok": True}


@router.delete("/work/{tier}/chapters/{chapter_id}")
def delete_chapter(tier: str, chapter_id: int, db: Session = Depends(get_db)):
    from app.models.content import LearningMaterial
    c = _chapter(db, tier, chapter_id)
    db.query(LearningMaterial).filter(LearningMaterial.chapter_id == c.id).update({"chapter_id": None}, synchronize_session=False)
    db.delete(c)
    db.commit()
    return {"ok": True}


# ======================================================================= change tier (Admin only)
class ChangeTierPayload(BaseModel):
    new_tier: str
    payment_reference: str = Field(min_length=3, max_length=200)
    reason: str | None = Field(None, max_length=2000)


@router.get("/enrollments/{enrollment_id}/change-tier/quote", dependencies=[Depends(require_admin)])
def change_tier_quote(enrollment_id: int, new_tier: str, db: Session = Depends(get_db)):
    """Full price of the new tier for this student (currency and GST/platform fee as at signup)."""
    from app.services.payment_service import compute_payment
    e = _enrollment(db, enrollment_id)
    program = _tier_program(db, new_tier)
    c = compute_payment(program, db.get(Student, e.student_id))
    return {"program": program.name, "currency": c["currency"], "base": float(c["base_amount"]),
            "fee": float(c["fee_amount"]), "fee_type": c["fee_type"], "total": float(c["total_amount"])}


@router.post("/enrollments/{enrollment_id}/change-tier", dependencies=[Depends(require_admin)])
def change_tier(enrollment_id: int, payload: ChangeTierPayload, db: Session = Depends(get_db),
                user: User = Depends(get_current_user), staff: Admin = Depends(get_current_staff)):
    """Moves a student to another tier after they paid the new tier's full price separately.
    The old enrollment is closed (kept for history); a new enrollment starts today with its own
    payment record, invoice, Welcome Certificate and access window."""
    from app.services.payment_service import activate_payment, compute_payment
    from app.services.v2_documents import dispatch_pending
    old = _enrollment(db, enrollment_id)
    old_tier = v2.tier_for(db, old)
    if payload.new_tier == old_tier:
        raise HTTPException(400, "The student is already in this program")
    if old.status in ("pending_payment", "dropped"):
        raise HTTPException(409, "Only a paid enrollment can be moved to another tier")
    program = _tier_program(db, payload.new_tier)
    student = db.get(Student, old.student_id)
    if db.query(ProgramEnrollment).filter(ProgramEnrollment.student_id == student.id,
                                          ProgramEnrollment.program_id == program.id).first():
        raise HTTPException(409, f"This student already has an enrollment in {program.name}")

    note = f"Moved to {program.name} on {v2.today().isoformat()}"
    old_status = old.status
    old.status = "dropped"
    old.suspension_reason = note + (f": {payload.reason.strip()}" if payload.reason else "")
    new = ProgramEnrollment(student_id=student.id, program_id=program.id, status="pending_payment",
                            workflow_policy_id=program.workflow_policy_id, current_week=1,
                            start_date=v2.today(), expected_end_date=v2.today())
    db.add(new)
    db.flush()
    c = compute_payment(program, student)
    payment = Payment(enrollment_id=new.id, student_id=student.id, currency=c["currency"], base_amount=c["base_amount"],
                      fee_type=c["fee_type"], fee_percent=c["fee_percent"], fee_amount=c["fee_amount"],
                      total_amount=c["total_amount"], status="pending")
    db.add(payment)
    db.flush()
    activate_payment(db, payment, method="manual_offline", admin_id=staff.id,
                     notes=f"Tier change from {v2.TIER_LABELS[old_tier]}. Payment reference: {payload.payment_reference.strip()}"
                           + (f". {payload.reason.strip()}" if payload.reason else ""))
    delivery_ids = payment.pending_delivery_ids
    db.add(StudentAdminNote(student_id=student.id, author_user_id=user.id,
                            note=f"Tier changed: {v2.TIER_LABELS[old_tier]} → {v2.TIER_LABELS[payload.new_tier]}. "
                                 f"Payment reference {payload.payment_reference.strip()}, "
                                 f"{c['currency']} {c['total_amount']}." + (f" Reason: {payload.reason.strip()}" if payload.reason else "")))
    notify_student(db, student, "Your program has changed",
                   f"You have been moved to {program.name}. Your new invoice and Welcome Certificate have been emailed to you.",
                   "info", "/dashboard")
    log_activity(db, user.id, "admin", "change_tier", "program_enrollments", new.id,
                 f"enrollment {old.id} ({old_tier}, {old_status}) -> {new.id} ({payload.new_tier})")
    db.commit()
    dispatch_pending(db, delivery_ids)
    return {"new_enrollment_id": new.id, "tier": payload.new_tier}


# ======================================================================= project options (Basic / Professional)
class OptionPayload(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    instructions: str | None = None
    technology: str | None = Field(None, max_length=200)
    sequence_number: int | None = None
    is_active: bool = True


@router.get("/work/{tier}/options")
def list_options(tier: str, db: Session = Depends(get_db)):
    program = _tier_program(db, tier)
    if tier not in v2.SELECTION_TIERS:
        raise HTTPException(400, "Project options apply to Basic and Professional only")
    rows = (db.query(Project).filter(Project.program_id == program.id, Project.work_type == "project_option")
            .order_by(Project.sequence_number.nullslast(), Project.id).all())
    counts = dict(db.query(ProjectSelection.project_id, func.count()).filter(ProjectSelection.active.is_(True))
                  .group_by(ProjectSelection.project_id).all())
    return [{"id": p.id, "number": p.sequence_number, "title": p.title, "description": p.description,
             "instructions": p.instructions, "technology": p.technology, "is_active": p.is_active,
             "resource_file_name": p.instructions_file_name, "instructions_file_name": p.guide_file_name,
             "selected_by": counts.get(p.id, 0)} for p in rows]


@router.post("/work/{tier}/options")
def create_option(tier: str, payload: OptionPayload, db: Session = Depends(get_db), staff: Admin = Depends(get_current_staff)):
    program = _tier_program(db, tier)
    if tier not in v2.SELECTION_TIERS:
        raise HTTPException(400, "Project options apply to Basic and Professional only")
    data = payload.model_dump()
    if data.get("sequence_number") is None:  # number new options after the existing ones
        data["sequence_number"] = (db.query(func.max(Project.sequence_number)).filter(
            Project.program_id == program.id, Project.work_type == "project_option").scalar() or 0) + 1
    p = Project(program_id=program.id, work_type="project_option", project_type="mini" if tier == "basic" else "industry",
                created_by=staff.id, **data)
    db.add(p)
    log_activity(db, staff.user_id, None, "create_project_option", "projects", None, tier)
    db.commit()
    return {"id": p.id}


@router.put("/projects/{project_id}")
def update_definition(project_id: int, payload: OptionPayload, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if p is None or p.work_type not in ("project_option", "accelerator_assignment"):
        raise HTTPException(404, "Definition not found")
    for k, val in payload.model_dump().items():
        setattr(p, k, val)
    db.commit()
    return {"id": p.id}


@router.get("/projects/{project_id}/resource")
def download_definition_resource(project_id: int, kind: str = "details", db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    path, name = (p.guide_file_path, p.guide_file_name) if p and kind == "instructions" else (p.instructions_file_path if p else None, p.instructions_file_name if p else None)
    if not path:
        raise HTTPException(404, "No file uploaded")
    return download_response(path, name or "project.pdf")


@router.post("/projects/{project_id}/resource")
async def upload_definition_resource(project_id: int, kind: str = "details", file: UploadFile = File(...), db: Session = Depends(get_db)):
    """kind=details (default) is the main brief/resource; kind=instructions is the separate Instructions PDF."""
    p = db.get(Project, project_id)
    if p is None or p.work_type is None:
        raise HTTPException(404, "Definition not found")
    content, _ = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    path = save(content, "project_instructions", file.filename)
    if kind == "instructions":
        p.guide_file_path, p.guide_file_name = path, file.filename[:300]
    else:
        p.instructions_file_path, p.instructions_file_name = path, file.filename[:300]
    db.commit()
    return {"resource_file_name": p.instructions_file_name, "instructions_file_name": p.guide_file_name}


# ======================================================================= selections
@router.get("/work/{tier}/selections")
def list_selections(tier: str, db: Session = Depends(get_db)):
    program = _tier_program(db, tier)
    enrollments = db.query(ProgramEnrollment).filter(ProgramEnrollment.program_id == program.id,
                                                     ProgramEnrollment.workflow_policy_id.isnot(None),
                                                     ProgramEnrollment.status.in_(("active", "completed", "suspended"))).all()
    out = []
    for e in enrollments:
        sels = v2.active_selections(db, e.id)
        out.append({**_student_row(db, e), "selections": [
            {"id": s.id, "slot": s.slot, "project_id": s.project_id, "project_title": db.get(Project, s.project_id).title,
             "locked": s.is_locked, "selected_at": s.selected_at} for s in sels]})
    return out


class ResetPayload(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)
    new_project_ids: list[int] | None = None  # optional immediate re-assignment by staff


@router.post("/enrollments/{enrollment_id}/selections/reset")
def reset_selection(enrollment_id: int, payload: ResetPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = _enrollment(db, enrollment_id)
    tier = v2.tier_for(db, e)
    if tier not in v2.SELECTION_TIERS:
        raise HTTPException(400, "This program has no project selection")
    for sel in v2.active_selections(db, e.id):
        sel.active = False
        db.add(ProjectSelectionEvent(selection_id=sel.id, action="reset", previous_project_id=sel.project_id,
                                     reason=payload.reason, performed_by=user.id))
    db.flush()
    if payload.new_project_ids:
        policy = v2.policy_for(db, e)
        ids = list(dict.fromkeys(payload.new_project_ids))
        if len(ids) != policy.selection_limit:
            raise HTTPException(400, f"Provide exactly {policy.selection_limit} project(s)")
        for slot, pid in enumerate(ids, 1):
            p = db.get(Project, pid)
            if p is None or p.program_id != e.program_id or p.work_type != "project_option":
                raise HTTPException(400, "Invalid project option")
            sel = ProjectSelection(student_id=e.student_id, enrollment_id=e.id, program_id=e.program_id, project_id=pid, slot=slot, is_locked=True)
            db.add(sel)
            db.flush()
            db.add(ProjectSelectionEvent(selection_id=sel.id, action="changed", new_project_id=pid, reason=payload.reason, performed_by=user.id))
    notify_student(db, db.get(Student, e.student_id), "Project selection updated",
                   "An administrator has reset your project selection." if not payload.new_project_ids
                   else "An administrator has changed your selected project(s).", "info", "/projects")
    log_activity(db, user.id, _role(db, user), "reset_project_selection", "program_enrollments", e.id, payload.reason)
    v2.refresh_track(db, e)
    db.commit()
    return {"ok": True}


# ======================================================================= submissions / reviews
@router.get("/work/{tier}/submissions")
def list_submissions(tier: str, status: str | None = None, kind: str | None = None, db: Session = Depends(get_db)):
    program = _tier_program(db, tier)
    q = (db.query(ProjectSubmission).join(Project, Project.id == ProjectSubmission.project_id)
         .filter(Project.program_id == program.id, ProjectSubmission.enrollment_id.isnot(None)))
    if status:
        q = q.filter(ProjectSubmission.status == status)
    if kind:
        q = q.filter(Project.work_type == kind)
    rows = q.order_by(ProjectSubmission.submitted_at.desc().nullslast()).limit(500).all()
    latest: dict = {}
    for s in rows:  # newest version per (enrollment, project) only
        latest.setdefault((s.enrollment_id, s.project_id), s)
    out = []
    for s in latest.values():
        p = db.get(Project, s.project_id)
        st = db.get(Student, s.student_id)
        label = p.title
        if p.work_type == "accelerator_assignment":
            label = f"Assignment {p.sequence_number}: {p.title}"
        elif s.project_selection_id:
            label = f"Project {db.get(ProjectSelection, s.project_selection_id).slot}: {p.title}" if tier == "professional" else p.title
        elif s.project_assignment_id:
            a = db.get(ProjectAssignment, s.project_assignment_id)
            label = a.title or p.title
        out.append({**v2.submission_out(s), "enrollment_id": s.enrollment_id, "student": st.full_name,
                    "student_number": st.student_number, "work": label, "work_type": p.work_type})
    return out


@router.get("/submissions/{submission_id}")
def submission_detail(submission_id: int, db: Session = Depends(get_db)):
    s = db.get(ProjectSubmission, submission_id)
    if s is None or s.enrollment_id is None:
        raise HTTPException(404, "Submission not found")
    chain = v2.submission_chain(db, s.enrollment_id, s.project_id)
    p = db.get(Project, s.project_id)
    return {"project": {"id": p.id, "title": p.title, "description": p.description, "instructions": p.instructions, "work_type": p.work_type},
            "student": {"id": s.student_id, "name": db.get(Student, s.student_id).full_name},
            "enrollment_id": s.enrollment_id,
            "versions": [v2.submission_out(x) for x in chain],
            "history": [{"status": r.new_status, "previous_status": r.previous_status, "feedback": r.feedback,
                         "score": float(r.score) if r.score is not None else None, "decision": r.decision, "reason": r.reason,
                         "reviewer": db.get(User, r.reviewer_id).email, "at": r.created_at}
                        for r in v2.review_history(db, [x.id for x in chain])]}


class ReviewPayload(BaseModel):
    action: str = Field(pattern="^(under_review|revision_required|completed)$")
    feedback: str | None = Field(None, max_length=8000)
    grade: Decimal | None = Field(None, ge=0, le=100)


@router.post("/submissions/{submission_id}/review")
def review_submission(submission_id: int, payload: ReviewPayload, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user), staff: Admin = Depends(get_current_staff)):
    s = db.get(ProjectSubmission, submission_id)
    if s is None or s.enrollment_id is None:
        raise HTTPException(404, "Submission not found")
    chain = v2.submission_chain(db, s.enrollment_id, s.project_id)
    if chain[0].id != s.id:
        raise HTTPException(409, "Only the latest version can be reviewed")
    if s.status == "graded":
        raise HTTPException(409, "This submission is already completed")
    new = {"under_review": "under_review", "revision_required": "revision_requested", "completed": "graded"}[payload.action]
    if payload.action == "revision_required" and not (payload.feedback or "").strip():
        chat = [m for m in v2.feedback_thread(db, s.enrollment_id, s.project_id)
                if m.sender_role == "staff" and s.submitted_at and m.created_at >= s.submitted_at]
        if not chat:
            raise HTTPException(400, "Send the student a feedback message in the chat before requesting a revision")
    previous = s.status
    s.status = new
    if payload.feedback is not None:
        s.feedback = payload.feedback
    if payload.grade is not None:
        s.grade = payload.grade
    if new in ("graded", "revision_requested"):
        s.graded_by, s.graded_at = staff.id, datetime.now(timezone.utc)
    db.add(ReviewEvent(project_submission_id=s.id, reviewer_id=user.id, previous_status=previous, new_status=new,
                       feedback=payload.feedback, score=payload.grade, decision=payload.action))
    title = {"under_review": "Submission under review", "revision_required": "Revision required",
             "completed": "Submission completed"}[payload.action]
    notify_student(db, db.get(Student, s.student_id), title, f"{db.get(Project, s.project_id).title}: {title.lower()}.",
                   "evaluation", "/work")
    e = db.get(ProgramEnrollment, s.enrollment_id)
    v2.refresh_track(db, e)
    log_activity(db, user.id, _role(db, user), "review_submission", "project_submissions", s.id, new)
    db.commit()
    return v2.submission_out(s)


@router.get("/submissions/{submission_id}/download")
def download_submission(submission_id: int, db: Session = Depends(get_db)):
    s = db.get(ProjectSubmission, submission_id)
    if s is None or not s.submission_file_path:
        raise HTTPException(404, "No file attached")
    return download_response(s.submission_file_path, s.submission_file_path.rsplit("/", 1)[-1].split("_", 1)[-1])


# ----------------------------------------------------------------------- feedback chat
def _thread_for_submission(db: Session, submission_id: int) -> ProjectSubmission:
    s = db.get(ProjectSubmission, submission_id)
    if s is None or s.enrollment_id is None:
        raise HTTPException(404, "Submission not found")
    return s


@router.get("/submissions/{submission_id}/messages")
def feedback_messages(submission_id: int, db: Session = Depends(get_db)):
    s = _thread_for_submission(db, submission_id)
    msgs = v2.feedback_thread(db, s.enrollment_id, s.project_id)
    now = datetime.now(timezone.utc)
    changed = False
    for m in msgs:
        if m.sender_role == "student" and m.read_at is None:
            m.read_at, changed = now, True
    if changed:
        db.commit()
    return [v2.feedback_out(db, m, "/v2/staff/feedback-messages/{id}/image") for m in msgs]


@router.post("/submissions/{submission_id}/messages")
async def send_feedback_message(submission_id: int, body: str | None = Form(None), image: UploadFile | None = File(None),
                                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = _thread_for_submission(db, submission_id)
    text_ = (body or "").strip()[:8000] or None
    path = name = None
    if image is not None and image.filename:
        content, ext = await read_and_validate_upload(image, 10)
        if ext not in v2.FEEDBACK_IMAGE_EXTS:
            raise HTTPException(400, "Only PNG or JPG images can be attached")
        path, name = save(content, "feedback", image.filename), image.filename
    if not text_ and not path:
        raise HTTPException(400, "Write a message or attach an image")
    m = WorkFeedbackMessage(enrollment_id=s.enrollment_id, project_id=s.project_id, submission_id=s.id,
                            sender_user_id=user.id, sender_role="staff", body=text_, image_path=path, image_name=name)
    db.add(m)
    notify_student(db, db.get(Student, s.student_id), "New feedback message",
                   f"{db.get(Project, s.project_id).title}: you have a new message from your reviewer.", "evaluation", "/work")
    db.commit()
    return v2.feedback_out(db, m, "/v2/staff/feedback-messages/{id}/image")


@router.get("/feedback-messages/{message_id}/image")
def feedback_image(message_id: int, db: Session = Depends(get_db)):
    m = db.get(WorkFeedbackMessage, message_id)
    if m is None or not m.image_path:
        raise HTTPException(404, "Image not found")
    return download_response(m.image_path, m.image_name or "image")


# ======================================================================= internship forms
@router.get("/work/{tier}/forms")
def list_forms(tier: str, db: Session = Depends(get_db)):
    program = _tier_program(db, tier)
    if tier not in v2.FORM_TIERS:
        raise HTTPException(400, "This program has no internship form")
    policy = db.get(ProgramWorkflowPolicy, program.workflow_policy_id)
    enrollments = db.query(ProgramEnrollment).filter(ProgramEnrollment.program_id == program.id,
                                                     ProgramEnrollment.workflow_policy_id.isnot(None),
                                                     ProgramEnrollment.status.in_(("active", "completed", "suspended"))).all()
    out = []
    for e in enrollments:
        f = db.query(InternshipForm).filter(InternshipForm.enrollment_id == e.id).first()
        area = f and f.area_of_interest_id and db.get(AreaOfInterest, f.area_of_interest_id)
        unlock = v2.form_unlock_date(e, policy)
        out.append({**_student_row(db, e), "available_on": unlock,
                    "form_id": f.id if f else None, "form_status": f.status if f else "not_started",
                    "review_status": f.review_status if f else None, "submitted_at": f.submitted_at if f else None,
                    "area_of_interest": area.name if area else None,
                    "resume_count": db.query(ResumeVersion).filter(ResumeVersion.internship_form_id == f.id).count() if f else 0,
                    "assigned_work": db.query(ProjectAssignment).filter(ProjectAssignment.enrollment_id == e.id).count(),
                    "assignment": _assigned_work_out(db, e) if tier in ("advanced", "career") else None,
                    "internship_tasks": _internship_tasks_out(db, e) if tier == "accelerator" else None})
        # What needs the admin's attention (shown at the top of Assign Work).
        row = out[-1]
        unread = (db.query(func.count(WorkFeedbackMessage.id))
                  .filter(WorkFeedbackMessage.enrollment_id == e.id, WorkFeedbackMessage.sender_role == "student",
                          WorkFeedbackMessage.read_at.is_(None)).scalar() or 0)
        last_msg = (db.query(func.max(WorkFeedbackMessage.created_at))
                    .filter(WorkFeedbackMessage.enrollment_id == e.id, WorkFeedbackMessage.sender_role == "student").scalar())
        reasons = []
        if unread:
            reasons.append(f"{unread} new message{'s' if unread > 1 else ''}")
        if f and f.status == "submitted" and (f.review_status in (None, "pending", "submitted")):
            reasons.append("Form awaiting review")
        a = row.get("assignment")
        if a and a.get("status") in ("submitted", "under_review"):
            reasons.append("Work submitted for review")
        row.update(unread_messages=unread, attention=reasons, last_student_activity=last_msg or (f.submitted_at if f else None))
    return out


def _assigned_work_out(db: Session, e: ProgramEnrollment) -> dict | None:
    """The single task/project an Advanced or Career student has been given, with its live status."""
    item = next((i for i in v2.work_items(db, e) if i["kind"] == "assigned_work"), None)
    if item is None:
        return None
    p = db.get(Project, item["project_id"])
    return {"assignment_id": item["assignment_id"], "project_id": p.id, "title": item["title"], "work_type": p.work_type,
            "description": item["description"], "instructions": item["instructions"], "technology": p.technology,
            "deadline": item["deadline"], "assigned_at": item["assigned_at"], "resource_file_name": p.instructions_file_name,
            "status": item["status"], "status_label": item["status_label"], "versions": len(item["submissions"]),
            "latest_submission_id": item["submissions"][0]["id"] if item["submissions"] else None}


def _internship_tasks_out(db: Session, e: ProgramEnrollment) -> list[dict]:
    """The 3 internship-task slots of a Career Accelerator student."""
    items = [i for i in v2.work_items(db, e) if i["kind"] == "internship_task"]
    out = []
    for n in range(1, v2.ACCEL_INTERNSHIP_TASKS + 1):
        i = items[n - 1] if n <= len(items) else None
        if i is None:
            out.append({"number": n})
            continue
        p = db.get(Project, i["project_id"])
        out.append({"number": n, "assignment_id": i["assignment_id"], "project_id": p.id, "title": i["title"], "work_type": p.work_type,
                    "description": i["description"], "instructions": i["instructions"], "technology": p.technology,
                    "deadline": i["deadline"], "resource_file_name": p.instructions_file_name,
                    "status": i["status"], "status_label": i["status_label"], "versions": len(i["submissions"])})
    return out


@router.get("/forms/{form_id}")
def form_detail(form_id: int, db: Session = Depends(get_db)):
    f = db.get(InternshipForm, form_id)
    if f is None:
        raise HTTPException(404, "Form not found")
    s = db.get(Student, f.student_id)
    area = f.area_of_interest_id and db.get(AreaOfInterest, f.area_of_interest_id)
    return {"id": f.id, "enrollment_id": f.enrollment_id, "status": f.status, "review_status": f.review_status,
            "submitted_at": f.submitted_at, "student": {"name": s.full_name, "student_number": s.student_number,
                                                        "email": db.get(User, s.user_id).email, "phone": s.phone},
            "education": f.education, "institution": f.institution, "area_of_interest": area.name if area else None,
            "skills": f.skills, "experience": f.experience, "preferred_role": f.preferred_role, "comments": f.comments,
            "details": f.details, "schema": FF.SECTIONS if f.details else None,
            "resumes": [{"id": r.id, "version": r.version, "file_name": r.file_name, "uploaded_at": r.uploaded_at}
                        for r in db.query(ResumeVersion).filter(ResumeVersion.internship_form_id == f.id).order_by(ResumeVersion.version.desc())]}


@router.get("/resumes/{resume_id}/download")
def download_resume(resume_id: int, db: Session = Depends(get_db)):
    r = db.get(ResumeVersion, resume_id)
    if r is None:
        raise HTTPException(404, "Resume not found")
    return download_response(r.file_path, r.file_name)


class FormReviewPayload(BaseModel):
    review_status: str = Field(pattern="^(under_review|accepted|revision_required)$")
    feedback: str | None = Field(None, max_length=4000)


@router.post("/forms/{form_id}/review")
def review_form(form_id: int, payload: FormReviewPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    f = db.get(InternshipForm, form_id)
    if f is None or f.status == "draft":
        raise HTTPException(404, "Submitted form not found")
    if f.review_status == "accepted":
        raise HTTPException(409, "This internship form has been accepted and is locked — it can no longer be changed")
    previous = f.review_status
    f.review_status, f.reviewed_by, f.reviewed_at = payload.review_status, user.id, datetime.now(timezone.utc)
    f.status = "revision_required" if payload.review_status == "revision_required" else (
        "completed" if payload.review_status == "accepted" else f.status)
    db.add(ReviewEvent(internship_form_id=f.id, reviewer_id=user.id, previous_status=previous, new_status=payload.review_status,
                       feedback=payload.feedback, decision=payload.review_status))
    if payload.review_status == "revision_required":
        notify_student(db, db.get(Student, f.student_id), "Internship form needs changes", payload.feedback or "Please update your form.", "info", "/internship-form")
    db.commit()
    return {"review_status": f.review_status, "status": f.status}


# ======================================================================= assigned work (Advanced / Career / Accelerator internship)
@router.get("/enrollments/{enrollment_id}/assignments")
def list_assignments(enrollment_id: int, db: Session = Depends(get_db)):
    e = _enrollment(db, enrollment_id)
    return [i for i in v2.work_items(db, e) if i["kind"] in ("assigned_work", "internship_task")]


@router.post("/enrollments/{enrollment_id}/assignments")
async def assign_work(
    enrollment_id: int,
    title: str = Form(..., min_length=3, max_length=200),
    work_type: str = Form("task"),
    description: str | None = Form(None),
    instructions: str | None = Form(None),
    technology: str | None = Form(None),
    deadline: date | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db), user: User = Depends(get_current_user), staff: Admin = Depends(get_current_staff),
):
    e = _enrollment(db, enrollment_id)
    tier = v2.tier_for(db, e)
    if tier not in v2.FORM_TIERS:
        raise HTTPException(400, "Work is assigned by ARINSA only in Advanced, Career and Career Accelerator")
    if work_type not in v2.ASSIGNED_WORK_TYPES:
        raise HTTPException(400, "Invalid work type")
    if tier in ("advanced", "career") and db.query(ProjectAssignment.id).filter(ProjectAssignment.enrollment_id == e.id).first():
        raise HTTPException(409, f"{v2.TIER_LABELS[tier]} students get only 1 assigned task/project, and this student already has one")
    if tier == "accelerator":
        # Fast learners may submit the Internship Form early, so only the submitted form is required — not the date.
        form = db.query(InternshipForm).filter(InternshipForm.enrollment_id == e.id).first()
        if form is None or form.status == "draft":
            raise HTTPException(409, "Internship work can be assigned after the student submits the Internship Form")
        work_type = "internship_task" if work_type == "task" else work_type
        existing = (db.query(ProjectAssignment.id).join(Project, Project.id == ProjectAssignment.project_id)
                    .filter(ProjectAssignment.enrollment_id == e.id, Project.work_type.in_(("internship_task", "project", "live_project", "office_work"))).count())
        if existing >= v2.ACCEL_INTERNSHIP_TASKS:
            raise HTTPException(409, f"Career Accelerator students get {v2.ACCEL_INTERNSHIP_TASKS} internship tasks, and this student already has {existing}")
    project = Project(program_id=e.program_id, title=title, description=description, instructions=instructions,
                      technology=technology, project_type="live_product", work_type=work_type, created_by=staff.id)
    if file is not None and file.filename:
        content, _ = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
        project.instructions_file_path = save(content, "project_instructions", file.filename)
        project.instructions_file_name = file.filename[:300]
    db.add(project)
    db.flush()
    db.add(ProjectAssignment(enrollment_id=e.id, project_id=project.id, assignment_scope="individual", student_id=e.student_id,
                             title=title, description=description, instructions=instructions, status="assigned",
                             deadline=datetime.combine(deadline, datetime.max.time(), tzinfo=timezone.utc) if deadline else None,
                             assigned_by=staff.id))
    notify_student(db, db.get(Student, e.student_id), "New work assigned", f"{title} has been assigned to you.", "info", "/work")
    log_activity(db, user.id, _role(db, user), "assign_work", "program_enrollments", e.id, title)
    v2.refresh_track(db, e)
    db.commit()
    return {"project_id": project.id}


class AssignedWorkUpdate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    work_type: str | None = None
    description: str | None = None
    instructions: str | None = None
    technology: str | None = Field(None, max_length=200)
    deadline: date | None = None


def _assigned_work(db: Session, assignment_id: int) -> tuple[ProjectAssignment, Project]:
    a = db.get(ProjectAssignment, assignment_id)
    p = db.get(Project, a.project_id) if a else None
    e = db.get(ProgramEnrollment, a.enrollment_id) if a and a.enrollment_id else None
    if a is None or p is None or e is None or p.work_type == "real_world_project" or v2.tier_for(db, e) not in ("advanced", "career", "accelerator"):
        raise HTTPException(404, "Assigned work not found")
    return a, p


@router.put("/assigned-work/{assignment_id}")
def update_assigned_work(assignment_id: int, payload: AssignedWorkUpdate, db: Session = Depends(get_db)):
    a, p = _assigned_work(db, assignment_id)
    if payload.work_type is not None:
        accel = v2.tier_for(db, db.get(ProgramEnrollment, a.enrollment_id)) == "accelerator"
        allowed = ("internship_task", "live_project", "office_work") if accel else ("task", "project")
        wt = "internship_task" if accel and payload.work_type == "task" else payload.work_type
        if wt not in allowed:
            raise HTTPException(400, "Invalid work type")
        p.work_type = wt
    a.title = p.title = payload.title
    a.description = p.description = payload.description
    a.instructions = p.instructions = payload.instructions
    p.technology = payload.technology
    a.deadline = datetime.combine(payload.deadline, datetime.max.time(), tzinfo=timezone.utc) if payload.deadline else None
    db.commit()
    return {"ok": True}


@router.delete("/assigned-work/{assignment_id}")
def unassign_work(assignment_id: int, db: Session = Depends(get_db)):
    a, p = _assigned_work(db, assignment_id)
    if db.query(ProjectSubmission.id).filter(ProjectSubmission.project_id == p.id).first():
        raise HTTPException(409, "The student has already submitted work for this, so it can't be removed. Edit it instead.")
    e = db.get(ProgramEnrollment, a.enrollment_id)
    db.delete(a)
    db.flush()
    db.delete(p)
    v2.refresh_track(db, e)
    db.commit()
    return {"ok": True}


# ======================================================================= accelerator assignment definitions
class AccelAssignmentPayload(OptionPayload):
    sequence_number: int = Field(ge=1, le=22)
    set_number: int = Field(1, ge=1, le=50)
    available_after_days: int | None = Field(None, ge=0)
    due_after_days: int | None = Field(None, ge=0)


@router.get("/work/accelerator/assignment-sets")
def list_assignment_sets(db: Session = Depends(get_db)):
    """Summary of every question set: how many of the 22 are filled and how many students have it."""
    program = _tier_program(db, "accelerator")
    counts = v2.assignment_set_counts(db, program.id)
    usage = dict(db.query(ProgramEnrollment.assignment_set, func.count(ProgramEnrollment.id))
                 .filter(ProgramEnrollment.program_id == program.id, ProgramEnrollment.assignment_set.isnot(None))
                 .group_by(ProgramEnrollment.assignment_set).all())
    total = max([v2.ACCEL_MIN_SETS, *counts.keys(), *usage.keys()])
    return {"required": v2.ACCEL_ASSIGNMENT_COUNT, "min_sets": v2.ACCEL_MIN_SETS,
            "sets": [{"number": n, "count": counts.get(n, 0), "ready": counts.get(n, 0) >= v2.ACCEL_ASSIGNMENT_COUNT,
                      "students": usage.get(n, 0)} for n in range(1, total + 1)]}


@router.get("/work/accelerator/assignments")
def list_accel_assignments(set_number: int = Query(1, ge=1, le=50), db: Session = Depends(get_db)):
    program = _tier_program(db, "accelerator")
    rows = (db.query(Project).filter(Project.program_id == program.id, Project.work_type == "accelerator_assignment",
                                     Project.set_number == set_number)
            .order_by(Project.sequence_number, Project.id).all())
    return [{"id": p.id, "number": p.sequence_number, "set_number": p.set_number, "title": p.title, "description": p.description,
             "instructions": p.instructions, "technology": p.technology, "available_after_days": p.available_after_days,
             "due_after_days": p.due_after_days, "is_active": p.is_active, "resource_file_name": p.instructions_file_name} for p in rows]


@router.post("/work/accelerator/assignments")
def create_accel_assignment(payload: AccelAssignmentPayload, db: Session = Depends(get_db), staff: Admin = Depends(get_current_staff)):
    program = _tier_program(db, "accelerator")
    clash = db.query(Project).filter(Project.program_id == program.id, Project.work_type == "accelerator_assignment",
                                     Project.set_number == payload.set_number,
                                     Project.sequence_number == payload.sequence_number, Project.is_active.is_(True)).first()
    if clash:
        raise HTTPException(409, f"Set {payload.set_number} already has Assignment {payload.sequence_number}")
    p = Project(program_id=program.id, work_type="accelerator_assignment", project_type="capstone", created_by=staff.id, **payload.model_dump())
    db.add(p)
    db.commit()
    return {"id": p.id}


@router.put("/work/accelerator/assignments/{project_id}")
def update_accel_assignment(project_id: int, payload: AccelAssignmentPayload, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if p is None or p.work_type != "accelerator_assignment":
        raise HTTPException(404, "Assignment not found")
    clash = db.query(Project).filter(Project.program_id == p.program_id, Project.work_type == "accelerator_assignment", Project.id != p.id,
                                     Project.set_number == payload.set_number, Project.sequence_number == payload.sequence_number,
                                     Project.is_active.is_(True)).first()
    if clash:
        raise HTTPException(409, f"Set {payload.set_number} already has Assignment {payload.sequence_number}")
    for k, val in payload.model_dump().items():
        setattr(p, k, val)
    db.commit()
    return {"id": p.id}


# ======================================================================= accelerator: 3 real-world projects, per student
@router.get("/work/accelerator/projects")
def list_accel_projects(db: Session = Depends(get_db)):
    """Every Career Accelerator student with their 3 individually assigned project slots."""
    program = _tier_program(db, "accelerator")
    enrollments = (db.query(ProgramEnrollment).filter(ProgramEnrollment.program_id == program.id,
                                                      ProgramEnrollment.workflow_policy_id.isnot(None),
                                                      ProgramEnrollment.status.in_(("active", "completed", "suspended")))
                   .order_by(ProgramEnrollment.enrolled_at).all())
    out = []
    for e in enrollments:
        items = {i["project_id"]: i for i in v2.work_items(db, e) if i["kind"] == "real_world_project"}
        slots = {}
        for a, p in v2.real_world_assignments(db, e.id):
            i = items.get(p.id, {})
            slots[p.sequence_number] = {
                "assignment_id": a.id, "project_id": p.id, "number": p.sequence_number, "title": a.title or p.title,
                "description": a.description or p.description, "instructions": a.instructions or p.instructions,
                "technology": p.technology, "deadline": a.deadline.date() if a.deadline else None, "assigned_at": a.assigned_at,
                "resource_file_name": p.instructions_file_name, "status": i.get("status"), "status_label": i.get("status_label"),
                "versions": len(i.get("submissions", [])),
            }
        out.append({**_student_row(db, e), "projects": [slots.get(n) or {"number": n} for n in (1, 2, 3)],
                    "assigned": len(slots)})
    return out


def _rwp_assignment(db: Session, assignment_id: int) -> tuple[ProjectAssignment, Project]:
    a = db.get(ProjectAssignment, assignment_id)
    p = db.get(Project, a.project_id) if a else None
    if a is None or p is None or p.work_type != "real_world_project":
        raise HTTPException(404, "Project assignment not found")
    return a, p


@router.post("/enrollments/{enrollment_id}/real-world-projects")
async def assign_real_world_project(
    enrollment_id: int,
    number: int = Form(..., ge=1, le=3),
    title: str = Form(..., min_length=3, max_length=200),
    description: str | None = Form(None),
    instructions: str | None = Form(None),
    technology: str | None = Form(None),
    deadline: date | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db), user: User = Depends(get_current_user), staff: Admin = Depends(get_current_staff),
):
    e = _enrollment(db, enrollment_id, "accelerator")
    if any(p.sequence_number == number for _, p in v2.real_world_assignments(db, e.id)):
        raise HTTPException(409, f"Project {number} is already assigned to this student — edit it instead")
    project = Project(program_id=e.program_id, title=title, description=description, instructions=instructions,
                      technology=technology, project_type="capstone", work_type="real_world_project",
                      sequence_number=number, created_by=staff.id)
    if file is not None and file.filename:
        content, _ = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
        project.instructions_file_path = save(content, "project_instructions", file.filename)
        project.instructions_file_name = file.filename[:300]
    db.add(project)
    db.flush()
    db.add(ProjectAssignment(enrollment_id=e.id, project_id=project.id, assignment_scope="individual", student_id=e.student_id,
                             title=title, description=description, instructions=instructions, status="assigned",
                             deadline=datetime.combine(deadline, datetime.max.time(), tzinfo=timezone.utc) if deadline else None,
                             assigned_by=staff.id))
    notify_student(db, db.get(Student, e.student_id), f"Real-World Project {number} assigned",
                   f"{title} has been assigned to you.", "info", "/work?kind=real_world_project")
    log_activity(db, user.id, _role(db, user), "assign_real_world_project", "program_enrollments", e.id, f"{number}: {title}")
    v2.refresh_track(db, e)
    db.commit()
    return {"assignment_id": db.query(ProjectAssignment.id).filter(ProjectAssignment.project_id == project.id).scalar()}


class RwpUpdate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    instructions: str | None = None
    technology: str | None = Field(None, max_length=200)
    deadline: date | None = None


@router.put("/real-world-projects/{assignment_id}")
def update_real_world_project(assignment_id: int, payload: RwpUpdate, db: Session = Depends(get_db)):
    a, p = _rwp_assignment(db, assignment_id)
    a.title = p.title = payload.title
    a.description = p.description = payload.description
    a.instructions = p.instructions = payload.instructions
    p.technology = payload.technology
    a.deadline = datetime.combine(payload.deadline, datetime.max.time(), tzinfo=timezone.utc) if payload.deadline else None
    db.commit()
    return {"ok": True}


@router.delete("/real-world-projects/{assignment_id}")
def unassign_real_world_project(assignment_id: int, db: Session = Depends(get_db)):
    a, p = _rwp_assignment(db, assignment_id)
    if db.query(ProjectSubmission.id).filter(ProjectSubmission.project_id == p.id).first():
        raise HTTPException(409, "The student has already submitted work for this project, so it can't be removed. Edit it instead.")
    e = db.get(ProgramEnrollment, a.enrollment_id)
    db.delete(a)
    db.flush()
    db.delete(p)
    v2.refresh_track(db, e)
    db.commit()
    return {"ok": True}


# ======================================================================= mock interviews
class MockPayload(BaseModel):
    interview_number: int = Field(ge=1, le=3)
    scheduled_at: datetime
    interviewer_name: str | None = Field(None, max_length=150)
    meeting_link: str | None = Field(None, max_length=500)
    status: str = Field("scheduled", pattern="^(scheduled|completed|cancelled|rescheduled|no_show)$")
    attendance_status: str | None = Field(None, pattern="^(present|absent|excused)$")
    technical_feedback: str | None = None
    communication_feedback: str | None = None
    feedback: str | None = None
    overall_result: str = Field("pending", pattern="^(pass|fail|pending)$")


def _mock_files_out(db: Session, mock_id: int) -> list[dict]:
    return [{"id": f.id, "name": f.file_name, "size": f.file_size, "uploaded_at": f.created_at}
            for f in db.query(MockInterviewFile).filter(MockInterviewFile.mock_interview_id == mock_id).order_by(MockInterviewFile.id)]


MOCK_FILE_MAX = 10  # files per interview


@router.post("/mock-interviews/{mock_id}/files")
async def upload_mock_files(mock_id: int, files: list[UploadFile] = File(...), db: Session = Depends(get_db),
                            user: User = Depends(get_current_user)):
    m = db.get(MockInterview, mock_id)
    if m is None:
        raise HTTPException(404, "Mock interview not found")
    if (m.status == "completed" and m.attendance_status == "present") or m.overall_result in ("pass", "fail"):
        raise HTTPException(409, "This mock interview is done and locked — files can't be changed")
    existing = db.query(func.count(MockInterviewFile.id)).filter(MockInterviewFile.mock_interview_id == m.id).scalar() or 0
    if existing + len(files) > MOCK_FILE_MAX:
        raise HTTPException(400, f"Up to {MOCK_FILE_MAX} files per interview ({existing} already attached)")
    for up in files:
        content, _ext = await read_and_validate_upload(up, settings.MAX_UPLOAD_SIZE_MB)
        path = save(content, "mock_feedback", up.filename)
        db.add(MockInterviewFile(mock_interview_id=m.id, file_path=path, file_name=up.filename, file_size=len(content), uploaded_by=user.id))
    db.commit()
    return _mock_files_out(db, m.id)


@router.get("/mock-interview-files/{file_id}/download")
def download_mock_file(file_id: int, db: Session = Depends(get_db)):
    f = db.get(MockInterviewFile, file_id)
    if f is None:
        raise HTTPException(404, "File not found")
    return download_response(f.file_path, f.file_name)


@router.delete("/mock-interview-files/{file_id}")
def delete_mock_file(file_id: int, db: Session = Depends(get_db)):
    f = db.get(MockInterviewFile, file_id)
    if f is None:
        raise HTTPException(404, "File not found")
    mock_id = f.mock_interview_id
    m = db.get(MockInterview, mock_id)
    if m and ((m.status == "completed" and m.attendance_status == "present") or m.overall_result in ("pass", "fail")):
        raise HTTPException(409, "This mock interview is done and locked — files can't be changed")
    try:
        from app.services.storage import delete as storage_delete
        storage_delete(f.file_path)
    except Exception:  # noqa: BLE001 - the record is removed even if the stored file is already gone
        pass
    db.delete(f)
    db.commit()
    return _mock_files_out(db, mock_id)


@router.get("/work/{tier}/mock-interviews")
def list_mocks(tier: str, db: Session = Depends(get_db)):
    program = _tier_program(db, tier)
    if tier not in ("career", "accelerator"):
        raise HTTPException(400, "Mock interviews apply to Career and Career Accelerator")
    policy = db.get(ProgramWorkflowPolicy, program.workflow_policy_id)
    out = []
    for e in db.query(ProgramEnrollment).filter(ProgramEnrollment.program_id == program.id, ProgramEnrollment.workflow_policy_id.isnot(None),
                                                ProgramEnrollment.status.in_(("active", "completed", "suspended"))):
        mocks = {m.interview_number: m for m in db.query(MockInterview).filter(MockInterview.enrollment_id == e.id)}
        reqs = {r.interview_number: r for r in db.query(MockInterviewRequest).filter(MockInterviewRequest.enrollment_id == e.id)}
        out.append({**_student_row(db, e), "window": v2.mock_window(e), "requests": {
            n: {"preferred_times": r.preferred_times, "note": r.note, "status": r.status, "updated_at": r.updated_at}
            for n, r in reqs.items() if r.status != "cancelled"}, "interviews": [
            {"number": n, **({"id": m.id, "scheduled_at": m.scheduled_at, "interviewer_name": m.interviewer_name,
                               "meeting_link": m.meeting_link, "status": m.status, "attendance_status": m.attendance_status,
                               "technical_feedback": m.technical_feedback, "communication_feedback": m.communication_feedback,
                               "feedback": m.feedback, "overall_result": m.overall_result,
                               "files": _mock_files_out(db, m.id)} if (m := mocks.get(n)) else {})}
            for n in range(1, policy.mock_interview_count + 1)]})
    return out


@router.put("/enrollments/{enrollment_id}/mock-interviews")
def upsert_mock(enrollment_id: int, payload: MockPayload, db: Session = Depends(get_db),
                user: User = Depends(get_current_user), staff: Admin = Depends(get_current_staff)):
    e = _enrollment(db, enrollment_id)
    tier = v2.tier_for(db, e)
    policy = v2.policy_for(db, e)
    if tier not in ("career", "accelerator") or payload.interview_number > policy.mock_interview_count:
        raise HTTPException(400, f"This program has {policy.mock_interview_count} mock interview(s)")
    m = db.query(MockInterview).filter(MockInterview.enrollment_id == e.id, MockInterview.interview_number == payload.interview_number).first()
    if m is not None and ((m.status == "completed" and m.attendance_status == "present") or m.overall_result in ("pass", "fail")):
        raise HTTPException(409, "This mock interview is done and locked — it can't be changed or scheduled again")
    if payload.overall_result in ("pass", "fail") and payload.status in ("scheduled", "rescheduled"):
        payload.status = "completed"  # a recorded result means the interview has taken place
    when = payload.scheduled_at if payload.scheduled_at.tzinfo else payload.scheduled_at.replace(tzinfo=timezone.utc)
    moving = m is None or m.status == "cancelled" or m.scheduled_at is None or abs((m.scheduled_at - when).total_seconds()) > 60
    if payload.status in ("scheduled", "rescheduled") and moving:
        if when - datetime.now(timezone.utc) < timedelta(days=v2.MOCK_CHANGE_CUTOFF_DAYS):
            raise HTTPException(400, f"A mock interview must be scheduled at least {v2.MOCK_CHANGE_CUTOFF_DAYS} days in advance")
        latest = v2.mock_window(e)["latest"]
        if latest and when.date() > latest:
            raise HTTPException(400, f"The interview must be on or before {latest:%d %b %Y} ({v2.MOCK_END_BUFFER_DAYS} days before the internship ends)")
    if m is not None and m.status in ("scheduled", "rescheduled") and (payload.status == "cancelled" or (moving and payload.status in ("scheduled", "rescheduled"))):
        if not v2.mock_changeable(m.scheduled_at):
            raise HTTPException(409, f"This interview is less than {v2.MOCK_CHANGE_CUTOFF_DAYS} days away, so it can't be cancelled or rescheduled")
    req = db.query(MockInterviewRequest).filter(MockInterviewRequest.enrollment_id == e.id,
                                                MockInterviewRequest.interview_number == payload.interview_number).first()
    if req is not None and payload.status in ("scheduled", "rescheduled"):
        req.status = "scheduled"
    elif req is not None and payload.status == "cancelled":
        req.status = "cancelled"
    created = m is None
    if created:
        m = MockInterview(enrollment_id=e.id, program_id=e.program_id, interview_number=payload.interview_number,
                          conducted_by=staff.id, scheduled_date=payload.scheduled_at.date())
        db.add(m)
    data = payload.model_dump()
    for k, val in data.items():
        setattr(m, k, val)
    m.scheduled_date = payload.scheduled_at.date()
    db.flush()
    notify_student(db, db.get(Student, e.student_id),
                   f"Mock interview {payload.interview_number} " + ("scheduled" if created else "updated"),
                   f"Scheduled for {payload.scheduled_at:%d %b %Y %H:%M} UTC." if payload.status == "scheduled" else f"Status: {payload.status}.",
                   "info", "/mock-interviews")
    v2.refresh_track(db, e)
    log_activity(db, user.id, _role(db, user), "upsert_mock_interview", "mock_interviews", m.id, None)
    db.commit()
    return {"id": m.id}


# ======================================================================= eligibility (Accelerator)
class EligibilityPayload(BaseModel):
    criterion_code: str
    state: str = Field(pattern="^(pending|met|not_met|waived)$")
    reason: str = Field(min_length=3, max_length=2000)


@router.get("/enrollments/{enrollment_id}/eligibility")
def get_eligibility(enrollment_id: int, db: Session = Depends(get_db)):
    e = _enrollment(db, enrollment_id, "accelerator")
    policy = v2.policy_for(db, e)
    progress = v2.refresh_track(db, e)
    result = v2.sync_eligibility(db, e, policy)
    db.commit()
    from app.models.portal_v2 import EligibilityDecision
    state_ids = [s.id for s in db.query(EligibilityState).filter(EligibilityState.enrollment_id == e.id)]
    history = (db.query(EligibilityDecision).filter(EligibilityDecision.eligibility_state_id.in_(state_ids))
               .order_by(EligibilityDecision.changed_at.desc()).limit(100).all()) if state_ids else []
    crit = {s.id: db.get(EligibilityCriterion, s.criterion_id).code for s in db.query(EligibilityState).filter(EligibilityState.enrollment_id == e.id)}
    return {"progress": progress, **result, "history": [
        {"criterion": crit.get(h.eligibility_state_id), "from": h.previous_state, "to": h.new_state, "reason": h.reason,
         "by": db.get(User, h.changed_by).email if h.changed_by else "system", "at": h.changed_at} for h in history]}


@router.post("/enrollments/{enrollment_id}/eligibility")
def set_eligibility(enrollment_id: int, payload: EligibilityPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = _enrollment(db, enrollment_id, "accelerator")
    policy = v2.policy_for(db, e)
    v2.sync_eligibility(db, e, policy)
    c = db.query(EligibilityCriterion).filter(EligibilityCriterion.policy_id == policy.id, EligibilityCriterion.code == payload.criterion_code).first()
    if c is None:
        raise HTTPException(404, "Unknown criterion")
    if c.code in v2.AUTO_CRITERIA and payload.state not in ("waived", "pending") and _role(db, user) != "admin":
        raise HTTPException(403, "Automatic criteria can only be overridden by an Admin")
    s = db.query(EligibilityState).filter(EligibilityState.enrollment_id == e.id, EligibilityState.criterion_id == c.id).one()
    s.state, s.reason, s.changed_by, s.changed_at = payload.state, payload.reason, user.id, datetime.now(timezone.utc)
    log_activity(db, user.id, _role(db, user), "set_eligibility", "eligibility_states", s.id, f"{c.code}={payload.state}")
    db.flush()
    v2.refresh_track(db, e)
    db.commit()
    return {"ok": True}


# ======================================================================= evaluations (tier-separated)
@router.get("/evaluations/{tier}")
def list_evaluations(tier: str, db: Session = Depends(get_db)):
    program = _tier_program(db, tier)
    model = EVALUATION_MODELS[tier]
    out = []
    for e in db.query(ProgramEnrollment).filter(ProgramEnrollment.program_id == program.id, ProgramEnrollment.workflow_policy_id.isnot(None),
                                                ProgramEnrollment.status.in_(("active", "completed", "suspended"))):
        latest = db.query(model).filter(model.enrollment_id == e.id).order_by(model.id.desc()).first()
        progress = v2.refresh_track(db, e)
        out.append({**_student_row(db, e), "progress": progress,
                    "evaluation": _eval_out(db, tier, latest) if latest else None})
    db.commit()
    return {"tier": tier, "fields": EVALUATION_FIELDS[tier], "rows": out}


def _eval_out(db, tier, row) -> dict:
    data = {f: (float(v) if isinstance(v := getattr(row, f), Decimal) else v) for f in EVALUATION_FIELDS[tier]}
    return {"id": row.id, "result": row.result, "remarks": row.remarks, "evaluator": db.get(User, row.evaluator_user_id).email,
            "at": row.created_at, **data}


@router.get("/evaluations/{tier}/{enrollment_id}")
def evaluation_history(tier: str, enrollment_id: int, db: Session = Depends(get_db)):
    e = _enrollment(db, enrollment_id, tier)
    model = EVALUATION_MODELS[tier]
    progress = v2.refresh_track(db, e)
    db.commit()
    items = v2.work_items(db, e)
    return {"tier": tier, "fields": EVALUATION_FIELDS[tier], "student": _student_row(db, e), "progress": progress,
            "mcq": v2.mcq_summary(db, e),
            "work": [{k: i[k] for k in ("label", "title", "status_label")} | {"grade": i["submissions"][0]["grade"] if i["submissions"] else None,
                                                                             "versions": len(i["submissions"])} for i in items],
            "history": [_eval_out(db, tier, r) for r in db.query(model).filter(model.enrollment_id == e.id).order_by(model.id.desc())]}


class EvaluationPayload(BaseModel):
    result: str = Field(pattern="^(pending|in_progress|passed|failed|completed|incomplete)$")
    remarks: str | None = Field(None, max_length=8000)
    values: dict = {}


@router.post("/evaluations/{tier}/{enrollment_id}")
def save_evaluation(tier: str, enrollment_id: int, payload: EvaluationPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = _enrollment(db, enrollment_id, tier)
    fields = EVALUATION_FIELDS[tier]
    unknown = set(payload.values) - set(fields)
    if unknown:
        raise HTTPException(400, f"Unknown evaluation fields: {', '.join(sorted(unknown))}")
    model = EVALUATION_MODELS[tier]
    row = model(enrollment_id=e.id, student_id=e.student_id, result=payload.result, remarks=payload.remarks,
                evaluator_user_id=user.id, **{k: (v if v != "" else None) for k, v in payload.values.items()})
    db.add(row)
    log_activity(db, user.id, _role(db, user), "save_evaluation", f"{tier}_evaluations", e.id, payload.result)
    db.commit()
    return _eval_out(db, tier, row)


# ======================================================================= areas of interest
class AreaPayload(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    active: bool = True
    display_order: int = 0


@router.get("/areas-of-interest")
def list_areas(db: Session = Depends(get_db)):
    return [{"id": a.id, "name": a.name, "description": a.description, "active": a.active, "display_order": a.display_order}
            for a in db.query(AreaOfInterest).order_by(AreaOfInterest.display_order, AreaOfInterest.name)]


@router.post("/areas-of-interest")
def create_area(payload: AreaPayload, db: Session = Depends(get_db)):
    if db.query(AreaOfInterest).filter(func.lower(AreaOfInterest.name) == payload.name.lower()).first():
        raise HTTPException(409, "This area already exists")
    a = AreaOfInterest(**payload.model_dump())
    db.add(a)
    db.commit()
    return {"id": a.id}


@router.put("/areas-of-interest/{area_id}")
def update_area(area_id: int, payload: AreaPayload, db: Session = Depends(get_db)):
    a = db.get(AreaOfInterest, area_id)
    if a is None:
        raise HTTPException(404, "Not found")
    for k, val in payload.model_dump().items():
        setattr(a, k, val)
    db.commit()
    return {"id": a.id}


# ======================================================================= certificates
@router.get("/certificates")
def certificates(tier: str | None = None, search: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Certificate).join(Student, Student.id == Certificate.student_id).join(User, User.id == Student.user_id)
    if tier:
        q = q.filter(Certificate.program_id == _tier_program(db, tier).id)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Student.full_name.ilike(like), Student.student_number.ilike(like), User.email.ilike(like),
                         Certificate.certificate_number.ilike(like)))
    out = []
    for c in q.order_by(Certificate.id.desc()).limit(300):
        d = db.query(DocumentDelivery).filter(DocumentDelivery.certificate_id == c.id).first()
        out.append({"id": c.id, "type": c.certificate_type, "number": c.certificate_number, "issued_date": c.issued_date,
                    "status": c.status or "issued", "student": db.get(Student, c.student_id).full_name,
                    "student_number": db.get(Student, c.student_id).student_number, "enrollment_id": c.enrollment_id,
                    "program": db.get(InternshipProgram, c.program_id).name,
                    "delivery_status": d.status if d else "not_sent", "delivery_error": d.error_message if d else None,
                    "revocation_reason": c.revocation_reason})
    return out


@router.get("/certificates/candidates")
def certificate_candidates(tier: str, search: str | None = None, db: Session = Depends(get_db)):
    data = students(tier=tier, search=search, status=None, db=db)
    for row in data["students"]:
        eid = row["enrollment_id"]
        live = lambda t: (db.query(Certificate).filter(Certificate.enrollment_id == eid, Certificate.certificate_type == t,  # noqa: E731
                                                       or_(Certificate.status.is_(None), Certificate.status != "revoked"))
                          .order_by(Certificate.id.desc()).first())
        comp, wel = live("internship_completion"), live("welcome")
        row["has_completion_certificate"] = comp is not None
        row["completion"] = {"id": comp.id, "number": comp.certificate_number, "issued_date": comp.issued_date} if comp else None
        row["welcome"] = {"id": wel.id, "number": wel.certificate_number, "issued_date": wel.issued_date} if wel else None
        pay = (db.query(Payment).filter(Payment.enrollment_id == eid, Payment.status == "paid")
               .order_by(Payment.paid_at.desc().nullslast(), Payment.id.desc()).first())
        art = pay and db.query(InvoiceArtifact).filter(InvoiceArtifact.payment_id == pay.id).first()
        row["invoice"] = {"payment_id": pay.id, "number": pay.invoice_number, "amount": float(pay.total_amount),
                          "currency": pay.currency, "paid_at": pay.paid_at, "has_file": bool(art)} if pay else None
    return data


def _rebuild_certificate_file(db: Session, c: Certificate) -> None:
    """Re-render an issued certificate with the current approved artwork (same number, same dates)."""
    e = db.get(ProgramEnrollment, c.enrollment_id)
    st, prog = db.get(Student, c.student_id), db.get(InternshipProgram, c.program_id)
    if c.certificate_type == "welcome":
        pdf = render_welcome_certificate_pdf(st, prog, e, c.certificate_number, c.issued_date)
    elif c.certificate_type == "internship_completion":
        pdf = completion_pdf(st, prog, c.certificate_number, c.issued_date, e)
    else:
        raise HTTPException(400, "Only Welcome and Completion certificates can be refreshed")
    c.file_path = save(pdf, "certificates", f"{c.certificate_number}.pdf")


@router.post("/certificates/welcome/{enrollment_id}")
def welcome_issue(enrollment_id: int, send_email: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Issue the Welcome Certificate if missing (paid enrollments only), otherwise refresh it with the current design."""
    e = _enrollment(db, enrollment_id)
    c = (db.query(Certificate).filter(Certificate.enrollment_id == e.id, Certificate.certificate_type == "welcome",
                                      or_(Certificate.status.is_(None), Certificate.status != "revoked")).first())
    if c is None:
        if e.status not in ("active", "completed"):
            raise HTTPException(409, "The Welcome Certificate is issued after payment is received")
        from app.services.certificate_service import ensure_welcome_certificate
        c = ensure_welcome_certificate(db, e)
        db.flush()
        now = datetime.now(timezone.utc)
        c.status, c.generated_at, c.issued_at = "issued", now, now
        db.add(CertificateEvent(certificate_id=c.id, action="issued", file_path=c.file_path, performed_by=user.id,
                                snapshot={"type": "welcome", "number": c.certificate_number}, reason="Issued from Certificates page"))
        action = "issued"
    else:
        _rebuild_certificate_file(db, c)
        db.add(CertificateEvent(certificate_id=c.id, action="reissued", file_path=c.file_path, performed_by=user.id, reason="Refreshed with current design"))
        action = "refreshed"
    delivery = queue_delivery(db, student=db.get(Student, e.student_id), enrollment_id=e.id, document_type="welcome_certificate",
                              certificate=c) if send_email else None
    log_activity(db, user.id, _role(db, user), "welcome_certificate", "certificates", c.id, action)
    db.commit()
    if delivery:
        dispatch(db, delivery)
        db.commit()
    return {"id": c.id, "number": c.certificate_number, "action": action, "delivery_status": delivery.status if delivery else None}


@router.post("/certificates/{certificate_id}/regenerate")
def certificate_regenerate(certificate_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(Certificate, certificate_id)
    if c is None or c.status == "revoked":
        raise HTTPException(404, "Certificate not found or revoked")
    _rebuild_certificate_file(db, c)
    db.add(CertificateEvent(certificate_id=c.id, action="reissued", file_path=c.file_path, performed_by=user.id, reason="Refreshed with current design"))
    db.commit()
    return {"id": c.id, "number": c.certificate_number}


@router.get("/certificates/verify/{enrollment_id}")
def certificate_verify(enrollment_id: int, db: Session = Depends(get_db)):
    e = _enrollment(db, enrollment_id)
    tier = v2.tier_for(db, e)
    progress = v2.refresh_track(db, e)
    db.commit()
    model = EVALUATION_MODELS[tier]
    latest = db.query(model).filter(model.enrollment_id == e.id).order_by(model.id.desc()).first()
    return {"student": _student_row(db, e), "program": db.get(InternshipProgram, e.program_id).name, "tier": tier,
            "progress": progress, "evaluation": _eval_out(db, tier, latest) if latest else None,
            "ready": progress.get("track_status") == "completed" or (latest is not None and latest.result in ("passed", "completed"))}


@router.get("/certificates/preview/{enrollment_id}")
def certificate_preview(enrollment_id: int, db: Session = Depends(get_db)):
    e = _enrollment(db, enrollment_id)
    pdf = completion_pdf(db.get(Student, e.student_id), db.get(InternshipProgram, e.program_id), "PREVIEW-NOT-ISSUED", v2.today(), e)
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": 'inline; filename="preview.pdf"'})


class IssuePayload(BaseModel):
    send_email: bool = True
    override_reason: str | None = Field(None, max_length=2000)


@router.post("/certificates/issue/{enrollment_id}")
def certificate_issue(enrollment_id: int, payload: IssuePayload, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user), staff: Admin = Depends(get_current_staff)):
    e = _enrollment(db, enrollment_id)
    existing = db.query(Certificate).filter(Certificate.enrollment_id == e.id, Certificate.certificate_type == "internship_completion",
                                            or_(Certificate.status.is_(None), Certificate.status != "revoked")).first()
    if existing:
        raise HTTPException(409, "A completion certificate is already issued. Revoke it first to reissue.")
    check = certificate_verify(enrollment_id, db)
    if not check["ready"] and not (payload.override_reason or "").strip():
        raise HTTPException(409, "Completion is not verified. Provide an override reason to issue anyway.")
    cert = issue_completion_certificate(db, e, user, staff.id)
    if payload.override_reason:
        db.add(CertificateEvent(certificate_id=cert.id, action="issued", reason=f"Override: {payload.override_reason}", performed_by=user.id))
    delivery = None
    if payload.send_email:
        delivery = queue_delivery(db, student=db.get(Student, e.student_id), enrollment_id=e.id,
                                  document_type="completion_certificate", certificate=cert)
    log_activity(db, user.id, _role(db, user), "issue_certificate", "certificates", cert.id, cert.certificate_number)
    db.commit()
    if delivery:
        dispatch(db, delivery)
        db.commit()
    return {"id": cert.id, "number": cert.certificate_number, "delivery_status": delivery.status if delivery else "not_sent"}


@router.post("/certificates/{certificate_id}/send")
def certificate_send(certificate_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(Certificate, certificate_id)
    if c is None or c.status == "revoked":
        raise HTTPException(404, "Certificate not found or revoked")
    d = queue_delivery(db, student=db.get(Student, c.student_id), enrollment_id=c.enrollment_id,
                       document_type="welcome_certificate" if c.certificate_type == "welcome" else "completion_certificate", certificate=c)
    db.commit()
    dispatch(db, d)
    log_activity(db, user.id, _role(db, user), "send_certificate", "certificates", c.id, d.status)
    db.commit()
    return {"delivery_status": d.status, "error": d.error_message}


class RevokePayload(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)


@router.post("/certificates/{certificate_id}/revoke")
def certificate_revoke(certificate_id: int, payload: RevokePayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(Certificate, certificate_id)
    if c is None or c.status == "revoked":
        raise HTTPException(404, "Certificate not found or already revoked")
    if c.certificate_type == "welcome" and _role(db, user) != "admin":
        raise HTTPException(403, "Only an Admin can revoke a Welcome Certificate")
    revoke_certificate(db, c, user, payload.reason)
    log_activity(db, user.id, _role(db, user), "revoke_certificate", "certificates", c.id, payload.reason)
    db.commit()
    return {"status": "revoked"}


@router.get("/certificates/{certificate_id}/history")
def certificate_history(certificate_id: int, db: Session = Depends(get_db)):
    events = db.query(CertificateEvent).filter(CertificateEvent.certificate_id == certificate_id).order_by(CertificateEvent.id).all()
    deliveries = db.query(DocumentDelivery).filter(DocumentDelivery.certificate_id == certificate_id).all()
    attempts = db.query(DeliveryAttempt).filter(DeliveryAttempt.delivery_id.in_([d.id for d in deliveries] or [0])).order_by(DeliveryAttempt.id).all()
    return {"events": [{"action": ev.action, "reason": ev.reason, "by": db.get(User, ev.performed_by).email if ev.performed_by else "system",
                        "at": ev.created_at} for ev in events],
            "deliveries": [{"recipient": d.recipient, "status": d.status, "sent_at": d.sent_at, "error": d.error_message} for d in deliveries],
            "attempts": [{"number": a.attempt_number, "status": a.status, "at": a.attempted_at, "error": a.error_message} for a in attempts]}


@router.get("/certificates/{certificate_id}/download")
def certificate_download(certificate_id: int, db: Session = Depends(get_db)):
    c = db.get(Certificate, certificate_id)
    if c is None:
        raise HTTPException(404, "Certificate not found")
    return download_response(c.file_path, f"{c.certificate_number}.pdf", "application/pdf")


# ======================================================================= invoices / deliveries (Admin only)
def _paid_payment(db: Session, payment_id: int) -> Payment:
    p = db.get(Payment, payment_id)
    if p is None or p.status != "paid":
        raise HTTPException(404, "Invoices are available for paid payments only")
    return p


@router.post("/invoices/{payment_id}/generate", dependencies=[Depends(require_admin)])
def invoice_generate(payment_id: int, send_email: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Create the invoice if missing, or rebuild it with the current approved design."""
    from app.services.email_service import build_payment_invoice_pdf
    from app.services.v2_documents import ensure_invoice_artifact
    p = _paid_payment(db, payment_id)
    a = db.query(InvoiceArtifact).filter(InvoiceArtifact.payment_id == p.id).first()
    if a is None:
        a = ensure_invoice_artifact(db, p)
        action = "generated"
    else:
        st = db.get(Student, p.student_id)
        prog = db.get(InternshipProgram, db.get(ProgramEnrollment, p.enrollment_id).program_id)
        number, pdf = build_payment_invoice_pdf(student_name=st.full_name, program_name=prog.name, payment=p, student_number=st.student_number)
        storage_overwrite(a.file_path, pdf, "application/pdf")  # invoice records are append-only; refresh the file in place
        action = "refreshed"
    delivery = queue_delivery(db, student=db.get(Student, p.student_id), enrollment_id=p.enrollment_id, document_type="invoice",
                              invoice=a) if send_email else None
    log_activity(db, user.id, _role(db, user), "invoice", "payments", p.id, action)
    db.commit()
    if delivery:
        dispatch(db, delivery)
        db.commit()
    return {"payment_id": p.id, "action": action, "delivery_status": delivery.status if delivery else None,
            "error": delivery.error_message if delivery else None}


@router.get("/invoices/{payment_id}/download", dependencies=[Depends(require_admin)])
def invoice_download(payment_id: int, db: Session = Depends(get_db)):
    a = db.query(InvoiceArtifact).filter(InvoiceArtifact.payment_id == payment_id).first()
    if a is None:
        raise HTTPException(404, "No invoice generated for this payment")
    return download_response(a.file_path, f"Invoice-{db.get(Payment, payment_id).invoice_number}.pdf", "application/pdf")


@router.get("/deliveries", dependencies=[Depends(require_admin)])
def deliveries(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(DocumentDelivery)
    if status:
        q = q.filter(DocumentDelivery.status == status)
    return [{"id": d.id, "document_type": d.document_type, "recipient": d.recipient, "status": d.status,
             "attempts": d.attempt_count, "sent_at": d.sent_at, "error": d.error_message,
             "student": db.get(Student, d.student_id).full_name, "created_at": d.created_at}
            for d in q.order_by(DocumentDelivery.id.desc()).limit(300)]


@router.post("/deliveries/{delivery_id}/retry", dependencies=[Depends(require_admin)])
def retry_delivery(delivery_id: int, db: Session = Depends(get_db)):
    d = db.get(DocumentDelivery, delivery_id)
    if d is None:
        raise HTTPException(404, "Delivery not found")
    if d.status == "sent":
        raise HTTPException(409, "Already sent")
    d.status = "pending"
    dispatch(db, d)
    db.commit()
    return {"status": d.status, "error": d.error_message}


# ======================================================================= announcements
class AnnouncementPayload(BaseModel):
    audience: str = Field(pattern="^(all|basic|professional|advanced|career|accelerator|student)$")
    student_id: int | None = None
    title: str = Field(min_length=2, max_length=200)
    message: str = Field(min_length=2, max_length=5000)


@router.post("/announcements")
def announce(payload: AnnouncementPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user), staff: Admin = Depends(get_current_staff)):
    if payload.audience == "student":
        s = payload.student_id and db.get(Student, payload.student_id)
        if not s:
            raise HTTPException(400, "Choose a student")
        db.add(Notification(recipient_user_id=s.user_id, title=payload.title, message=payload.message,
                            notification_type="announcement", created_by=staff.id))
    else:
        program_id = None if payload.audience == "all" else _tier_program(db, payload.audience).id
        db.add(Notification(recipient_role="student", program_id=program_id, title=payload.title, message=payload.message,
                            notification_type="announcement", created_by=staff.id))
    log_activity(db, user.id, _role(db, user), "announcement", "notifications", None, payload.audience)
    db.commit()
    return {"ok": True}


@router.get("/announcements")
def announcements(db: Session = Depends(get_db)):
    rows = db.query(Notification).filter(Notification.notification_type == "announcement").order_by(Notification.id.desc()).limit(100).all()
    names = {p.id: v2.program_tier(p) for p in db.query(InternshipProgram)}
    return [{"id": n.id, "title": n.title, "message": n.message, "created_at": n.created_at,
             "audience": ("student: " + (db.query(Student).filter(Student.user_id == n.recipient_user_id).first().full_name
                                        if db.query(Student).filter(Student.user_id == n.recipient_user_id).first() else "user"))
             if n.recipient_user_id else (v2.TIER_LABELS.get(names.get(n.program_id)) or "All students")} for n in rows]


# ======================================================================= reports
ACADEMIC_REPORTS = ("enrollment", "progress", "mcq", "submissions", "internship", "mock_interviews", "eligibility", "certificates")
FINANCIAL_REPORTS = ("payments",)


@router.get("/reports/{kind}")
def report(kind: str, tier: str | None = None, export: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if kind in FINANCIAL_REPORTS and _role(db, user) != "admin":
        raise HTTPException(403, "Financial reports are restricted to Admin")
    if kind not in ACADEMIC_REPORTS + FINANCIAL_REPORTS:
        raise HTTPException(404, "Unknown report")
    tiers = [tier] if tier else list(TIERS)
    rows: list[dict] = []
    for t in tiers:
        program = _tier_program(db, t)
        enrollments = db.query(ProgramEnrollment).filter(ProgramEnrollment.program_id == program.id,
                                                         ProgramEnrollment.workflow_policy_id.isnot(None)).all()
        for e in enrollments:
            base = _student_row(db, e) | {"program": v2.TIER_LABELS[t]}
            base.pop("student_id", None)
            if kind == "enrollment":
                rows.append(base | {"enrolled_at": e.enrolled_at})
            elif kind == "progress" and e.status in ("active", "completed"):
                p = v2.refresh_track(db, e)
                rows.append(base | {"percent": p.get("percent"), "track_status": p.get("track_status")})
            elif kind == "mcq":
                m = v2.mcq_summary(db, e) or {}
                rows.append(base | {"mcq_status": m.get("status"), "correct": m.get("correct"), "total": m.get("total"),
                                    "percentage": m.get("percentage"), "attempts": m.get("attempts"), "terminated": m.get("terminated") or 0})
            elif kind == "submissions":
                for i in v2.work_items(db, e):
                    rows.append(base | {"work": i["label"], "title": i["title"], "status": i["status_label"], "versions": len(i["submissions"])})
            elif kind == "internship" and t in v2.FORM_TIERS:
                f = db.query(InternshipForm).filter(InternshipForm.enrollment_id == e.id).first()
                rows.append(base | {"form_status": f.status if f else "not_started", "review_status": f.review_status if f else None,
                                    "assigned_work": db.query(ProjectAssignment).filter(ProjectAssignment.enrollment_id == e.id).count()})
            elif kind == "mock_interviews" and t in ("career", "accelerator"):
                for m in db.query(MockInterview).filter(MockInterview.enrollment_id == e.id):
                    rows.append(base | {"interview": m.interview_number, "scheduled_at": m.scheduled_at, "status": m.status,
                                        "attendance": m.attendance_status, "result": m.overall_result})
            elif kind == "eligibility" and t == "accelerator" and e.status in ("active", "completed"):
                p = v2.refresh_track(db, e)
                rows.append(base | {"assignments": p.get("assignments_completed"), "projects": p.get("projects_completed"),
                                    "total": p.get("total_completed"), "mock_interviews": p.get("mock_interviews_completed"),
                                    "eligibility": p.get("eligibility_status")})
            elif kind == "certificates":
                for c in db.query(Certificate).filter(Certificate.enrollment_id == e.id):
                    rows.append(base | {"certificate": c.certificate_type, "number": c.certificate_number,
                                        "issued_date": c.issued_date, "cert_status": c.status or "issued"})
            elif kind == "payments":
                for p in db.query(Payment).filter(Payment.enrollment_id == e.id):
                    rows.append(base | {"payment_status": p.status, "currency": p.currency, "base": float(p.base_amount),
                                        "fee": float(p.fee_amount), "total": float(p.total_amount),
                                        "invoice_number": p.invoice_number, "paid_at": p.paid_at,
                                        "razorpay_payment_id": p.razorpay_payment_id})
    db.commit()
    if export:
        buffer = io.StringIO()
        if rows:
            writer = csv.DictWriter(buffer, fieldnames=list(dict.fromkeys(k for r in rows for k in r)))
            writer.writeheader()
            writer.writerows(rows)
        return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv",
                                 headers={"Content-Disposition": f'attachment; filename="{kind}-report.csv"'})
    return {"kind": kind, "rows": rows}
