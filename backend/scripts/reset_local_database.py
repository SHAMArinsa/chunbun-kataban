"""Reset the local PostgreSQL database while retaining the seeded admin account.

Usage (after taking a backup):
    venv/Scripts/python.exe scripts/reset_local_database.py --confirm

This script refuses non-local database URLs. It preserves roles, the configured
admin user and profile, then creates four fresh student accounts.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.auth import Role, User  # noqa: E402
from app.models.people import Student  # noqa: E402

PASSWORD = "12345678"
STUDENTS = [
    ("student1@gmail.com", "Student One"),
    ("student2@gmail.com", "Student Two"),
    ("student3@gmail.com", "Student Three"),
    ("student4@gmail.com", "Student Four"),
]

TRUNCATE_SQL = """
DO $$
DECLARE tables_to_truncate text;
BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tables_to_truncate
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'alembic_version';

    EXECUTE 'TRUNCATE TABLE ' || tables_to_truncate || ' RESTART IDENTITY CASCADE';
END $$;
"""

SYNC_SEQUENCES_SQL = """
DO $$
DECLARE sequence_record RECORD;
BEGIN
    FOR sequence_record IN
        SELECT
            pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name,
            table_schema,
            table_name,
            column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'id'
    LOOP
        IF sequence_record.sequence_name IS NOT NULL THEN
            EXECUTE format(
                'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1), true)',
                sequence_record.sequence_name,
                sequence_record.column_name,
                sequence_record.table_schema,
                sequence_record.table_name
            );
        END IF;
    END LOOP;
END $$;
"""


def require_local_database() -> None:
    local_hosts = ("localhost", "127.0.0.1", "::1")
    if not any(host in settings.DATABASE_URL for host in local_hosts):
        raise RuntimeError("Refusing to reset a non-local DATABASE_URL")


def reset_database() -> None:
    admin_email = settings.SEED_ADMIN_EMAIL
    db = SessionLocal()
    try:
        admin_count = db.execute(
            text("SELECT COUNT(*) FROM users WHERE email = :email"), {"email": admin_email}
        ).scalar_one()
        if admin_count != 1:
            raise RuntimeError(f"Expected exactly one admin user at {admin_email!r}, found {admin_count}")

        db.execute(text("CREATE TEMP TABLE kept_roles ON COMMIT DROP AS SELECT * FROM roles"))
        db.execute(
            text("CREATE TEMP TABLE kept_user ON COMMIT DROP AS SELECT * FROM users WHERE email = :email"),
            {"email": admin_email},
        )
        db.execute(
            text(
                """
                CREATE TEMP TABLE kept_admin ON COMMIT DROP AS
                SELECT admin.* FROM admins AS admin JOIN kept_user AS kept ON kept.id = admin.user_id
                """
            )
        )
        db.execute(text(TRUNCATE_SQL))
        db.execute(text("INSERT INTO roles SELECT * FROM kept_roles"))
        db.execute(text("INSERT INTO users SELECT * FROM kept_user"))
        db.execute(text("INSERT INTO admins SELECT * FROM kept_admin"))
        db.execute(text(SYNC_SEQUENCES_SQL))

        student_role = db.query(Role).filter(Role.name == "student").one()
        for email, full_name in STUDENTS:
            user = User(
                email=email,
                password_hash=hash_password(PASSWORD),
                role_id=student_role.id,
                is_active=True,
            )
            db.add(user)
            db.flush()
            db.add(Student(user_id=user.id, full_name=full_name, citizenship_status="indian"))
        db.commit()
        print(f"Reset complete. Preserved admin: {admin_email}")
        print("Created: " + ", ".join(email for email, _ in STUDENTS))
        print(f"Student password: {PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", action="store_true", help="required to run the destructive reset")
    args = parser.parse_args()
    if not args.confirm:
        parser.error("Pass --confirm only after taking your local database backup")
    require_local_database()
    reset_database()


if __name__ == "__main__":
    main()
