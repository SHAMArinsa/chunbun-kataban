"""Replace student1@gmail.com through student6@gmail.com with four fresh tier accounts.

The resulting accounts are assigned to Basic, Professional, Premium, and Platinum
respectively. Run with: venv/Scripts/python.exe scripts/reset_tier_test_students.py
"""
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.auth import Role, User  # noqa: E402
from app.models.people import Student  # noqa: E402
from app.models.program import InternshipProgram, ProgramEnrollment  # noqa: E402

PASSWORD = "12345678"
STUDENTS = [
    ("student1@gmail.com", "Student One", "basic"),
    ("student2@gmail.com", "Student Two", "professional"),
    ("student3@gmail.com", "Student Three", "premium"),
    ("student4@gmail.com", "Student Four", "platinum"),
]
TARGET_EMAILS = [f"student{number}@gmail.com" for number in range(1, 7)]
FK_VIOLATION_RE = re.compile(
    r'violates foreign key constraint "(?P<constraint>[^"]+)" on table "(?P<table>[^"]+)"'
    r'.*Key \(id\)=\((?P<blocking_id>\d+)\) is still referenced from table',
    re.DOTALL,
)


def delete_with_dependencies(db, table: str, column: str, value: int, depth: int = 0) -> None:
    if depth > 24:
        raise RuntimeError(f"dependency deletion became too deep at {table}.{column}={value}")
    while True:
        try:
            with db.begin_nested():
                db.execute(text(f'DELETE FROM "{table}" WHERE "{column}" = :value'), {"value": value})
            return
        except IntegrityError as exc:
            match = FK_VIOLATION_RE.search(str(exc.orig))
            if not match:
                raise
            child_table = match.group("table")
            constraint = match.group("constraint")
            blocking_id = int(match.group("blocking_id"))
            prefix = f"{child_table}_"
            suffix_match = re.search(r"_fkey\d*$", constraint)
            if suffix_match is None:
                raise RuntimeError(f"unable to resolve dependency: {constraint}") from exc
            if constraint.startswith(prefix):
                child_column = constraint[len(prefix):suffix_match.start()]
            elif child_table == "proctoring_violations_legacy_backup" and constraint.endswith("_enrollment_id_fkey"):
                # This archive table retained the old table name in its constraint.
                child_column = "enrollment_id"
            else:
                raise RuntimeError(f"unable to resolve dependency: {constraint}") from exc
            delete_with_dependencies(db, child_table, child_column, blocking_id, depth + 1)


def delete_existing_accounts(db) -> None:
    for email in TARGET_EMAILS:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            continue
        student = db.query(Student).filter(Student.user_id == user.id).first()
        if student is not None:
            delete_with_dependencies(db, "students", "id", student.id)
        delete_with_dependencies(db, "users", "id", user.id)
        print(f"deleted {email}")


def create_fresh_accounts(db) -> None:
    role = db.query(Role).filter(Role.name == "student").first()
    if role is None:
        raise RuntimeError("student role not found; run scripts/seed.py first")
    for email, full_name, program_code in STUDENTS:
        program = db.query(InternshipProgram).filter(InternshipProgram.code == program_code).first()
        if program is None:
            raise RuntimeError(f"program {program_code!r} not found; run scripts/seed.py first")
        user = User(email=email, password_hash=hash_password(PASSWORD), role_id=role.id, is_active=True)
        db.add(user)
        db.flush()
        student = Student(user_id=user.id, full_name=full_name, citizenship_status="indian")
        db.add(student)
        db.flush()
        db.add(ProgramEnrollment(
            student_id=student.id,
            program_id=program.id,
            status="active",
            start_date=date.today(),
            current_week=1,
        ))
        print(f"created {email} ({program.name})")


def main() -> None:
    db = SessionLocal()
    try:
        delete_existing_accounts(db)
        db.commit()
        create_fresh_accounts(db)
        db.commit()
        print("completed")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
