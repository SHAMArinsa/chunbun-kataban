"""One-off script to create test students with active enrollments.
Run with: venv/Scripts/python.exe scripts/add_test_students.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.auth import Role, User  # noqa: E402
from app.models.people import Student  # noqa: E402
from app.models.program import InternshipProgram, ProgramEnrollment  # noqa: E402

TEST_STUDENTS = [
    dict(email="student5@gmail.com", full_name="Student Five", program_code="premium"),
    dict(email="student6@gmail.com", full_name="Student Six", program_code="platinum"),
]
PASSWORD = "12345678"


def main():
    db = SessionLocal()
    try:
        student_role = db.query(Role).filter(Role.name == "student").first()
        if student_role is None:
            raise RuntimeError("student role not found - run scripts/seed.py first")

        for sdef in TEST_STUDENTS:
            program = db.query(InternshipProgram).filter(InternshipProgram.code == sdef["program_code"]).first()
            if program is None:
                raise RuntimeError(f"program not found: {sdef['program_code']} - run scripts/seed.py first")

            user = db.query(User).filter(User.email == sdef["email"]).first()
            if user is None:
                user = User(
                    email=sdef["email"],
                    password_hash=hash_password(PASSWORD),
                    role_id=student_role.id,
                    is_active=True,
                )
                db.add(user)
                db.flush()
                print(f"created user: {sdef['email']}")
            else:
                print(f"user already exists: {sdef['email']}")

            student = db.query(Student).filter(Student.user_id == user.id).first()
            if student is None:
                student = Student(user_id=user.id, full_name=sdef["full_name"], citizenship_status="indian")
                db.add(student)
                db.flush()
                print(f"created student profile: {sdef['full_name']}")

            enrollment = db.query(ProgramEnrollment).filter(
                ProgramEnrollment.student_id == student.id,
                ProgramEnrollment.program_id == program.id,
            ).first()
            if enrollment is None:
                enrollment = ProgramEnrollment(
                    student_id=student.id,
                    program_id=program.id,
                    status="active",
                    start_date=date.today(),
                    current_week=1,
                )
                db.add(enrollment)
                print(f"enrolled {sdef['email']} in {program.name} (active)")
            else:
                enrollment.status = "active"
                print(f"enrollment already exists for {sdef['email']} in {program.name} - set to active")

        db.commit()
        print("done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
