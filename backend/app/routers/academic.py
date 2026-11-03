"""Explicit academic projections; financial models are not queried here."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_staff
from app.models.people import Admin, Student
from app.models.program import InternshipProgram, ProgramEnrollment
from app.models.project import ProjectSubmission, Evaluation
from app.models.assessment import AssignmentSubmission
from app.models.admin_ops import ActivityLog
from app.schemas.portal_v2 import AcademicProgramOut
from app.schemas.staff import StudentAcademicOut, EnrollmentAcademicOut, AcademicDashboardOut
from app.schemas.admin_ops import ActivityLogOut

router = APIRouter(prefix="/api/academic", tags=["academic"], dependencies=[Depends(get_current_staff)])


def enrollment_out(row: ProgramEnrollment) -> EnrollmentAcademicOut:
    # Do not turn pending_payment into an Instructor payment-status report.
    academic_status = row.status if row.status in ("active", "completed", "suspended") else "unavailable"
    return EnrollmentAcademicOut(id=row.id, student_id=row.student_id, program_id=row.program_id,
        program=AcademicProgramOut.model_validate(row.program), start_date=row.start_date,
        expected_end_date=row.expected_end_date, academic_status=academic_status)


def student_out(db: Session, row: Student) -> StudentAcademicOut:
    result = StudentAcademicOut.model_validate(row)
    result.enrollments = [enrollment_out(e) for e in db.query(ProgramEnrollment).filter(ProgramEnrollment.student_id == row.id)]
    return result


@router.get("/programs", response_model=list[AcademicProgramOut])
def programs(db: Session = Depends(get_db)):
    return db.query(InternshipProgram).order_by(InternshipProgram.id).all()


@router.get("/programs/{program_id}", response_model=AcademicProgramOut)
def program(program_id: int, db: Session = Depends(get_db)):
    row = db.get(InternshipProgram, program_id)
    if row is None:
        raise HTTPException(404, "Program not found")
    return row


@router.get("/students", response_model=list[StudentAcademicOut])
def students(search: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Student)
    if search:
        query = query.filter(Student.full_name.ilike(f"%{search}%"))
    return [student_out(db, row) for row in query.order_by(Student.id).limit(500)]


@router.get("/students/{student_id}", response_model=StudentAcademicOut)
def student(student_id: int, db: Session = Depends(get_db)):
    row = db.get(Student, student_id)
    if row is None:
        raise HTTPException(404, "Student not found")
    return student_out(db, row)


@router.get("/enrollments", response_model=list[EnrollmentAcademicOut])
def enrollments(student_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(ProgramEnrollment)
    if student_id is not None:
        query = query.filter(ProgramEnrollment.student_id == student_id)
    return [enrollment_out(row) for row in query.order_by(ProgramEnrollment.id).limit(500)]


@router.get("/dashboard", response_model=AcademicDashboardOut)
def dashboard(db: Session = Depends(get_db)):
    def count_status(value: str) -> int:
        return db.query(func.count(func.distinct(ProgramEnrollment.student_id))).filter(ProgramEnrollment.status == value).scalar() or 0
    return AcademicDashboardOut(total_students=db.query(Student).count(), active_students=count_status("active"),
        completed_students=count_status("completed"), pending_reviews=
        db.query(ProjectSubmission).filter(ProjectSubmission.status.in_(("submitted", "under_review"))).count()
        + db.query(AssignmentSubmission).filter(AssignmentSubmission.status.in_(("submitted", "under_review"))).count())


@router.get("/reports/performance")
def performance(db: Session = Depends(get_db)):
    rows = db.query(Evaluation.evaluation_type, func.avg(Evaluation.score), func.count(Evaluation.id)).group_by(Evaluation.evaluation_type).all()
    return [{"evaluation_type": kind, "average_score": float(score) if score is not None else None, "count": count} for kind, score, count in rows]


@router.get("/reports/completion")
def completion(db: Session = Depends(get_db)):
    rows = db.query(ProgramEnrollment.program_id, func.count(ProgramEnrollment.id)).filter(ProgramEnrollment.status == "completed").group_by(ProgramEnrollment.program_id).all()
    return [{"program_id": program_id, "completed": count} for program_id, count in rows]


@router.get("/activity-logs", response_model=list[ActivityLogOut])
def activity_logs(db: Session = Depends(get_db)):
    # Allowlist event kinds; omit arbitrary descriptions/JSON rather than trying
    # to redact financial details or credentials out of historical free text.
    allowed = ("upload_material", "replace_material_file", "create_project", "grade_project",
               "grade_coding_assignment", "update_evaluation_remarks", "review_proctoring_violation")
    rows = db.query(ActivityLog).filter(ActivityLog.action.in_(allowed)).order_by(ActivityLog.id.desc()).limit(100)
    return [ActivityLogOut(id=r.id, actor_role=r.actor_role, action=r.action, entity_type=r.entity_type,
                          entity_id=r.entity_id, description=None, created_at=r.created_at) for r in rows]
