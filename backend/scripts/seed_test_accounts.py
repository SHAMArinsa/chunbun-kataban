"""LOCAL TEST ACCOUNTS — never run against production.

    python scripts/seed_test_accounts.py

Creates (or resets the password of):
  admin@arinsaaiminds.com / admin          Admin portal
  student1@gmail.com ... student5@gmail.com / 12345678
      student1 Basic, student2 Professional, student3 Advanced,
      student4 Career, student5 Career Accelerator — each already paid (offline),
      so login opens that tier's dashboard.
No emails are sent. Safe to run again.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.auth import Role, User  # noqa: E402
from app.models.people import Admin, Student  # noqa: E402
from app.models.program import InternshipProgram, Payment, ProgramEnrollment  # noqa: E402
from app.services.payment_service import activate_payment, compute_payment  # noqa: E402

if settings.is_production:
    sys.exit("Refusing to create test accounts in production.")

ADMIN_EMAIL, ADMIN_PASSWORD = "admin@arinsaaiminds.com", "admin"
STUDENT_PASSWORD = "12345678"
STUDENTS = [(1, "basic"), (2, "professional"), (3, "advanced"), (4, "career"), (5, "career_accelerator")]


def main():
    db = SessionLocal()
    try:
        roles = {r.name: r for r in db.query(Role)}
        if "admin" not in roles or "student" not in roles:
            sys.exit("Roles missing — run 'alembic upgrade head' and 'python scripts/seed.py' first.")

        u = db.query(User).filter_by(email=ADMIN_EMAIL).first()
        if u is None:
            u = User(email=ADMIN_EMAIL, password_hash="", role_id=roles["admin"].id, is_active=True)
            db.add(u); db.flush()
        u.password_hash, u.role_id, u.is_active = hash_password(ADMIN_PASSWORD), roles["admin"].id, True
        admin = db.query(Admin).filter_by(user_id=u.id).first()
        if admin is None:
            admin = Admin(user_id=u.id, full_name="Platform Administrator", is_super_admin=True)
            db.add(admin); db.flush()
        print(f"admin   {ADMIN_EMAIL} / {ADMIN_PASSWORD}")

        programs = {p.code: p for p in db.query(InternshipProgram)}
        for n, code in STUDENTS:
            email = f"student{n}@gmail.com"
            program = programs.get(code)
            if program is None:
                sys.exit(f"Program '{code}' missing — run 'alembic upgrade head' first.")
            user = db.query(User).filter_by(email=email).first()
            if user is None:
                user = User(email=email, password_hash="", role_id=roles["student"].id, is_active=True)
                db.add(user); db.flush()
            user.password_hash, user.is_active = hash_password(STUDENT_PASSWORD), True
            s = db.query(Student).filter_by(user_id=user.id).first()
            if s is None:
                s = Student(user_id=user.id, full_name=f"Test Student {n}", citizenship_status="indian", phone=f"900000000{n}",
                            institution="Test University", degree="B.Tech CSE", country="India")
                db.add(s); db.flush()
            e = db.query(ProgramEnrollment).filter_by(student_id=s.id, program_id=program.id).first()
            if e is None:
                e = ProgramEnrollment(student_id=s.id, program_id=program.id, status="pending_payment",
                                      workflow_policy_id=program.workflow_policy_id, current_week=1)
                db.add(e); db.flush()
                p = Payment(enrollment_id=e.id, student_id=s.id, status="pending", **compute_payment(program, s))
                db.add(p); db.flush()
                activate_payment(db, p, method="manual_offline", admin_id=admin.id, notes="Test account")
            print(f"student {email} / {STUDENT_PASSWORD}  ->  {program.name} (student ID {s.student_number})")
        db.commit()
        print("Done. No emails were sent.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
