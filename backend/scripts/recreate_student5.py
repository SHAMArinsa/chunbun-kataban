"""Delete and recreate student5@gmail.com (premium plan, password 12345678).

Deletion cascades generically: whenever a DELETE hits a FK violation, it parses
the blocking constraint (named "<table>_<column>_fkey" by convention), deletes
the blocking rows in that child table first, then retries. This avoids having
to hand-enumerate every table that references students/users.

Run with: venv/Scripts/python.exe scripts/recreate_student5.py
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date  # noqa: E402

from sqlalchemy import text  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.auth import Role, User  # noqa: E402
from app.models.people import Student  # noqa: E402
from app.models.program import InternshipProgram, ProgramEnrollment  # noqa: E402

EMAIL = "student5@gmail.com"
PASSWORD = "12345678"
PROGRAM_CODE = "premium"

FK_VIOLATION_RE = re.compile(
    r'violates foreign key constraint "(?P<constraint>[^"]+)" on table "(?P<table>[^"]+)"'
    r'.*Key \(id\)=\((?P<blocking_id>\d+)\) is still referenced from table',
    re.DOTALL,
)


def delete_row_cascade(db, table: str, column: str, value: int, depth: int = 0) -> None:
    if depth > 20:
        raise RuntimeError(f"delete cascade too deep at {table}.{column}={value}")

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
            # convention: "<child_table>_<child_column>_fkey"
            prefix = f"{child_table}_"
            suffix = "_fkey"
            if not (constraint.startswith(prefix) and constraint.endswith(suffix)):
                raise RuntimeError(f"cannot infer FK column from constraint name: {constraint}") from exc
            child_column = constraint[len(prefix):-len(suffix)]
            print(f"  cascading: {child_table}.{child_column} = {blocking_id}")
            delete_row_cascade(db, child_table, child_column, blocking_id, depth + 1)


def delete_existing(db) -> None:
    user = db.query(User).filter(User.email == EMAIL).first()
    if user is None:
        print(f"no existing user: {EMAIL}")
        return

    student = db.query(Student).filter(Student.user_id == user.id).first()
    if student is not None:
        print(f"deleting student id={student.id} and all dependent rows...")
        delete_row_cascade(db, "students", "id", student.id)

    print(f"deleting user id={user.id} and all dependent rows...")
    delete_row_cascade(db, "users", "id", user.id)
    print(f"deleted user + student profile: {EMAIL}")


def recreate(db) -> None:
    student_role = db.query(Role).filter(Role.name == "student").first()
    if student_role is None:
        raise RuntimeError("student role not found - run scripts/seed.py first")

    program = db.query(InternshipProgram).filter(InternshipProgram.code == PROGRAM_CODE).first()
    if program is None:
        raise RuntimeError(f"program not found: {PROGRAM_CODE} - run scripts/seed.py first")

    user = User(
        email=EMAIL,
        password_hash=hash_password(PASSWORD),
        role_id=student_role.id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    student = Student(user_id=user.id, full_name="Student Five", citizenship_status="indian")
    db.add(student)
    db.flush()

    enrollment = ProgramEnrollment(
        student_id=student.id,
        program_id=program.id,
        status="active",
        start_date=date.today(),
        current_week=1,
    )
    db.add(enrollment)
    print(f"recreated {EMAIL} enrolled in {program.name} (active)")


def main():
    db = SessionLocal()
    try:
        delete_existing(db)
        db.commit()
        recreate(db)
        db.commit()
        print("done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
