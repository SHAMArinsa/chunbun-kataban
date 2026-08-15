from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.assessment import AssignmentSubmission
from app.models.engagement import Attendance, Certificate
from app.models.people import Admin, Student
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.models.project import Evaluation, ProjectSubmission

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard-summary")
def dashboard_summary(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    total_students = db.query(Student).count()
    active_students = (
        db.query(func.count(func.distinct(ProgramEnrollment.student_id)))
        .filter(ProgramEnrollment.status == "active")
        .scalar()
    )
    revenue_inr = db.query(func.coalesce(func.sum(Payment.total_amount), 0)).filter(Payment.status == "paid", Payment.currency == "INR").scalar()
    revenue_usd = db.query(func.coalesce(func.sum(Payment.total_amount), 0)).filter(Payment.status == "paid", Payment.currency == "USD").scalar()
    coding_pending = db.query(AssignmentSubmission).filter(AssignmentSubmission.status.in_(["submitted", "under_review"])).count()
    project_pending = db.query(ProjectSubmission).filter(ProjectSubmission.status.in_(["submitted", "under_review"])).count()
    pending_reviews = coding_pending + project_pending
    certificates_issued = db.query(Certificate).count()

    return {
        "total_students": total_students,
        "active_students": active_students,
        "revenue_inr": float(revenue_inr or 0),
        "revenue_usd": float(revenue_usd or 0),
        "certificates_issued": certificates_issued,
        "pending_reviews": pending_reviews,
    }


@router.get("/revenue")
def revenue_report(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = (
        db.query(InternshipProgram.name, Payment.currency, func.sum(Payment.total_amount).label("total"))
        .join(ProgramEnrollment, ProgramEnrollment.id == Payment.enrollment_id)
        .join(InternshipProgram, InternshipProgram.id == ProgramEnrollment.program_id)
        .filter(Payment.status == "paid")
        .group_by(InternshipProgram.name, Payment.currency)
        .all()
    )
    return [{"program": r[0], "currency": r[1], "total": float(r[2])} for r in rows]


@router.get("/enrollment")
def enrollment_report(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = (
        db.query(InternshipProgram.name, ProgramEnrollment.status, func.count(ProgramEnrollment.id))
        .join(InternshipProgram, InternshipProgram.id == ProgramEnrollment.program_id)
        .group_by(InternshipProgram.name, ProgramEnrollment.status)
        .all()
    )
    return [{"program": r[0], "status": r[1], "count": r[2]} for r in rows]


@router.get("/completion-rate")
def completion_rate_report(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = (
        db.query(
            InternshipProgram.name,
            func.count(ProgramEnrollment.id).label("total"),
            func.sum(case((ProgramEnrollment.status == "completed", 1), else_=0)).label("completed"),
        )
        .join(InternshipProgram, InternshipProgram.id == ProgramEnrollment.program_id)
        .group_by(InternshipProgram.name)
        .all()
    )
    result = []
    for name, total, completed in rows:
        completed = completed or 0
        rate = round((completed / total * 100), 2) if total else 0
        result.append({"program": name, "total_enrollments": total, "completed": completed, "completion_rate_percent": rate})
    return result


@router.get("/performance")
def performance_report(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = (
        db.query(Evaluation.evaluation_type, func.avg(Evaluation.score), func.count(Evaluation.id))
        .group_by(Evaluation.evaluation_type)
        .all()
    )
    return [{"evaluation_type": r[0], "average_score": float(r[1]) if r[1] is not None else None, "count": r[2]} for r in rows]


@router.get("/attendance-summary")
def attendance_summary_report(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = db.query(Attendance.status, func.count(Attendance.id)).group_by(Attendance.status).all()
    return [{"status": r[0], "count": r[1]} for r in rows]
