"""One-off: capitalise existing student names (e.g. 'sayan das' -> 'Sayan Das').
Run from backend/:  python -m scripts.fix_name_capitals"""
from app.core.database import SessionLocal
from app.core.names import proper_name
from app.models.people import Student

with SessionLocal() as db:
    changed = 0
    for st in db.query(Student).all():
        new = proper_name(st.full_name)
        if new != st.full_name:
            print(f"{st.full_name!r} -> {new!r}")
            st.full_name = new
            changed += 1
    db.commit()
    print(f"Updated {changed} student name(s).")
