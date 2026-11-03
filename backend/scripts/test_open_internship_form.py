"""TESTING ONLY — temporarily open a Career Accelerator student's Internship Form.

    python -m scripts.test_open_internship_form open   student5@gmail.com [YYYY-MM-DD]
    python -m scripts.test_open_internship_form revert student5@gmail.com

`open` moves the enrollment's date back 200 days (the form unlocks 5 months 20 days
after enrolment) and saves the original value in scripts/.form_unlock_backup.json.
`revert` restores exactly that original value. Nothing else is changed.
"""
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from app.core.database import SessionLocal
from app.models.auth import User
from app.models.people import Student
from app.models.program import ProgramEnrollment
from app.services import v2

BACKUP = Path(__file__).with_name(".form_unlock_backup.json")
SHIFT = timedelta(days=200)


def main(action: str, email: str, target: str | None = None) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        student = user and db.query(Student).filter(Student.user_id == user.id).first()
        if student is None:
            sys.exit(f"No student with email {email}")
        e = v2.current_enrollment(db, student)
        if e is None or v2.tier_for(db, e) != "accelerator":
            sys.exit(f"{email} has no Career Accelerator enrollment")
        policy = v2.policy_for(db, e)
        field = "start_date" if policy.form_unlock_base == "start_date" and e.start_date else "enrolled_at"
        backups = json.loads(BACKUP.read_text()) if BACKUP.exists() else {}
        key = str(e.id)
        if action == "open":
            if key in backups:
                sys.exit("Already opened for testing — run `revert` first.")
            original = getattr(e, field)
            shift = SHIFT
            if target:
                shift = v2.form_unlock_date(e, policy) - date.fromisoformat(target)
                if shift.days <= 0:
                    sys.exit("The target unlock date must be earlier than the current one.")
            backups[key] = {"email": email, "field": field, "value": original.isoformat()}
            setattr(e, field, original - shift)
            db.commit()
            BACKUP.write_text(json.dumps(backups, indent=2))
            print(f"Opened. Form unlock date is now {v2.form_unlock_date(e, policy)} (was {v2.form_unlock_date(e, policy) + shift}).")
        elif action == "revert":
            if key not in backups:
                sys.exit("Nothing to revert for this student.")
            b = backups.pop(key)
            value = datetime.fromisoformat(b["value"]) if b["field"] == "enrolled_at" else date.fromisoformat(b["value"])
            setattr(e, b["field"], value)
            db.commit()
            BACKUP.write_text(json.dumps(backups, indent=2)) if backups else BACKUP.unlink()
            print(f"Reverted. Form unlock date is back to {v2.form_unlock_date(e, policy)}.")
        else:
            sys.exit("Action must be `open` or `revert`")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    main(*sys.argv[1:])
