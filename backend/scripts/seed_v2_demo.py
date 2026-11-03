"""LOCAL DEMO DATA for Portal V2 — never run against production.

Creates an Instructor, areas of interest, project options, Accelerator assignments
and one paid demo student per program (password: Student@123), so every screen
of both portals can be tried immediately.

    python scripts/seed_v2_demo.py            # refuses if ENVIRONMENT=production
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.auth import Role, User  # noqa: E402
from app.models.people import Admin, Student  # noqa: E402
from app.models.portal_v2 import AreaOfInterest  # noqa: E402
from app.models.program import InternshipProgram, Payment, ProgramEnrollment  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.services.payment_service import activate_payment, compute_payment  # noqa: E402

if settings.is_production:
    sys.exit("Refusing to create demo data in production.")

AREAS = ["Development", "Testing / QA", "Support", "AI / ML", "Generative AI", "Frontend", "Backend", "Full Stack", "Database", "DevOps"]
BASIC = [
    ("To-Do API", "Build a REST API for a to-do list with CRUD and validation.", "FastAPI, PostgreSQL"),
    ("Weather Dashboard", "Fetch weather data from a public API and display a 5-day forecast.", "React"),
    ("Student Grade Tracker", "CLI/web app that stores marks and computes grades and averages.", "Python"),
    ("URL Shortener", "Shorten URLs and redirect; track click counts.", "FastAPI"),
    ("Expense Splitter", "Split shared expenses between friends and show balances.", "React"),
]
PROFESSIONAL = [
    ("Hospital Appointment System", "Doctors, patients, slots and bookings with role-based access.", "FastAPI + React + PostgreSQL"),
    ("E-commerce Store", "Catalog, cart, checkout (mock payment), admin inventory.", "FastAPI + React + PostgreSQL"),
    ("Learning Management System", "Courses, lessons, enrollments and progress tracking.", "FastAPI + React + PostgreSQL"),
    ("Job Portal", "Employers post jobs; candidates apply and track status.", "FastAPI + React + PostgreSQL"),
]
ACCEL = [(1, "Python Foundations", "Data structures, functions and file handling."), (2, "NumPy & Pandas", "Clean and analyse a dataset."),
         (3, "Linear Regression", "Train and evaluate a regression model.")]
STUDENTS = [("basic", "basic.student@demo.arinsa"), ("professional", "pro.student@demo.arinsa"), ("advanced", "advanced.student@demo.arinsa"),
            ("career", "career.student@demo.arinsa"), ("career_accelerator", "accelerator.student@demo.arinsa")]


def main():
    db = SessionLocal()
    try:
        admin = db.query(Admin).join(User).join(Role).filter(Role.name == "admin").order_by(Admin.id).first()
        if admin is None:
            sys.exit("Run scripts/seed.py first (creates the admin account).")
        programs = {p.code: p for p in db.query(InternshipProgram)}

        role = db.query(Role).filter_by(name="instructor").one()
        if not db.query(User).filter_by(email="instructor@demo.arinsa").first():
            u = User(email="instructor@demo.arinsa", password_hash=hash_password("Instructor@123"), role_id=role.id, is_active=True)
            db.add(u); db.flush()
            db.add(Admin(user_id=u.id, full_name="Demo Instructor", is_super_admin=False))
            print("instructor: instructor@demo.arinsa / Instructor@123")

        for i, name in enumerate(AREAS, 1):
            if not db.query(AreaOfInterest).filter_by(name=name).first():
                db.add(AreaOfInterest(name=name, display_order=i))

        for code, rows, kind in (("basic", BASIC, "mini"), ("professional", PROFESSIONAL, "industry")):
            for n, (title, desc, tech) in enumerate(rows, 1):
                if not db.query(Project).filter_by(program_id=programs[code].id, title=title).first():
                    db.add(Project(program_id=programs[code].id, title=title, description=desc, technology=tech, work_type="project_option",
                                   project_type=kind, sequence_number=n, created_by=admin.id,
                                   instructions="Submit a ZIP of your source code and a GitHub link. Include a README with setup steps."))
        for n, title, desc in ACCEL:
            if not db.query(Project).filter_by(program_id=programs["career_accelerator"].id, work_type="accelerator_assignment", sequence_number=n).first():
                db.add(Project(program_id=programs["career_accelerator"].id, title=title, description=desc, work_type="accelerator_assignment",
                               project_type="capstone", sequence_number=n, available_after_days=(n - 1) * 7, due_after_days=n * 14, created_by=admin.id))
        db.flush()

        student_role = db.query(Role).filter_by(name="student").one()
        for code, email in STUDENTS:
            if db.query(User).filter_by(email=email).first():
                continue
            u = User(email=email, password_hash=hash_password("Student@123"), role_id=student_role.id, is_active=True)
            db.add(u); db.flush()
            s = Student(user_id=u.id, full_name=f"Demo {'Accelerator' if code == 'career_accelerator' else programs[code].name.split()[0]} Student", citizenship_status="indian",
                        phone="9876543210", institution="Demo University", degree="B.Tech CSE")
            db.add(s); db.flush()
            program = programs[code]
            e = ProgramEnrollment(student_id=s.id, program_id=program.id, status="pending_payment", workflow_policy_id=program.workflow_policy_id)
            if code == "career_accelerator":  # show the unlocked internship stage too
                e.enrolled_at = datetime.now(timezone.utc) - timedelta(days=175)
            db.add(e); db.flush()
            c = compute_payment(program, s)
            p = Payment(enrollment_id=e.id, student_id=s.id, status="pending", **c)
            db.add(p); db.flush()
            activate_payment(db, p, method="manual_offline", admin_id=admin.id, notes="Demo data")
            print(f"student: {email} / Student@123  ({program.name})")
        db.commit()
        print("Demo data ready. (Invoice/certificate emails are not sent by this script.)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
