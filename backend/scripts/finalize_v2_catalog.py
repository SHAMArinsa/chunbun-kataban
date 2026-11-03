"""One-time Portal V2 catalogue finalisation.

1. Sets the official prices / durations of the five programs.
2. Permanently deletes the old Premium and Platinum plans and every OLD student
   (a student with no Portal V2 enrollment), together with everything that
   belongs to them: enrollments, payments, invoices, certificates, submissions,
   quiz attempts, tickets, notifications, proctoring records, login account...

SAFE BY DEFAULT: without --confirm it only prints what would change.

    python scripts/finalize_v2_catalog.py            # dry run (no changes)
    python scripts/finalize_v2_catalog.py --confirm  # apply
    python scripts/finalize_v2_catalog.py --all-students            # preview: remove EVERY student
    python scripts/finalize_v2_catalog.py --all-students --confirm  # apply

Take a backup first:
    pg_dump -Fc -U postgres -h localhost internship -f before_cleanup.dump
Needs a PostgreSQL superuser connection (e.g. the local 'postgres' user), because
the append-only history guards are switched off for this one transaction.
Uploaded files on disk are not deleted.
"""
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402

PRICES = {  # code: (name, duration, unit, duration_weeks, INR, USD)
    "basic": ("Basic Internship", 2, "weeks", 2, 500, 12),
    "professional": ("Professional Internship", 4, "weeks", 4, 1500, 22),
    "advanced": ("Advanced Internship", 12, "weeks", 12, 5000, 80),
    "career": ("Career Internship", 24, "weeks", 24, 10000, 170),
    "career_accelerator": ("Career Accelerator Program", 1, "years", 52, 25000, 350),
}
OLD_PLANS = ("premium", "platinum")
NEVER_DELETE = {"admins", "roles", "program_workflow_policies", "alembic_version"}


def fk_graph(db):
    """child_table -> list of (child_column, parent_table, parent_column)."""
    rows = db.execute(text("""
        SELECT tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    """)).all()
    children = defaultdict(list)  # parent_table -> [(child_table, child_col, parent_col)]
    for child, ccol, parent, pcol in rows:
        children[parent].append((child, ccol, pcol))
    return children


def pk_column(db, table):
    return db.execute(text("""
        SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = CAST(:t AS regclass) AND i.indisprimary
    """), {"t": table}).scalars().all()


def collect(db, roots):
    """roots: {table: set(ids)} -> every dependent row, following foreign keys."""
    children = fk_graph(db)
    found = defaultdict(set)  # table -> set of primary-key tuples/ids
    queue = [(t, "id", ids) for t, ids in roots.items() if ids]
    for t, _, ids in queue:
        found[t] |= ids
    while queue:
        parent, pcol, values = queue.pop()
        for child, ccol, ref_col in children.get(parent, []):
            if child in NEVER_DELETE or ref_col != pcol and ref_col != "id":
                continue
            keys = pk_column(db, child)
            if keys != ["id"]:
                # composite-key link tables: delete by the referencing column directly
                found[(child, ccol)] |= set(values)
                continue
            rows = set(db.execute(text(f'SELECT id FROM "{child}" WHERE "{ccol}" = ANY(:v)'), {"v": list(values)}).scalars())
            new = rows - found[child]
            if new:
                found[child] |= new
                queue.append((child, "id", new))
    return found


def main():
    confirm = "--confirm" in sys.argv
    all_students = "--all-students" in sys.argv  # delete EVERY student, including Portal V2 ones
    db = SessionLocal()
    try:
        ver = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        if ver not in ("c0ffee290010", "c0ffee290011"):
            raise SystemExit(f"Database is at migration {ver}, not Portal V2 (c0ffee290010).\n"
                             "Run 'alembic upgrade head' first, then run this script again.")
        print("== Prices ==")
        for code, (name, dur, unit, weeks, inr, usd) in PRICES.items():
            row = db.execute(text("SELECT id, name, price_inr, price_usd FROM internship_programs WHERE code = :c"), {"c": code}).first()
            if row is None:
                print(f"  ! {code} missing — run 'alembic upgrade head' first"); continue
            print(f"  {name:<28} ₹{row.price_inr} / ${row.price_usd}  ->  ₹{inr} / ${usd}  ({dur} {unit})")
            db.execute(text("""UPDATE internship_programs SET name=:n, duration=:d, duration_unit=:u, duration_weeks=:w,
                               price_inr=:inr, price_usd=:usd, is_active=true WHERE code=:c"""),
                       {"n": name, "d": dur, "u": unit, "w": weeks, "inr": inr, "usd": usd, "c": code})

        old_programs = set(db.execute(text("SELECT id FROM internship_programs WHERE code = ANY(:c)"), {"c": list(OLD_PLANS)}).scalars())
        old_students = set(db.execute(text("SELECT id FROM students")).scalars()) if all_students else set(db.execute(text("""
            SELECT s.id FROM students s WHERE NOT EXISTS (
              SELECT 1 FROM program_enrollments e WHERE e.student_id = s.id AND e.workflow_policy_id IS NOT NULL)
        """)).scalars())
        old_users = set(db.execute(text("SELECT user_id FROM students WHERE id = ANY(:s)"), {"s": list(old_students)}).scalars())
        # Also remove old-student enrollments in the shared Basic/Professional plans.
        found = collect(db, {"students": old_students, "users": old_users, "internship_programs": old_programs})

        print("\n== Would delete ==" if not confirm else "\n== Deleting ==")
        print(f"  old plans: {', '.join(OLD_PLANS)}   old students: {len(old_students)}")
        for key in sorted((k for k in found if found[k]), key=str):
            name = key if isinstance(key, str) else f"{key[0]} (by {key[1]})"
            print(f"  {name:<45} {len(found[key])}")

        # Safety: never delete a V2 student's data through a shared parent row.
        v2_students = set(db.execute(text("SELECT DISTINCT student_id FROM program_enrollments WHERE workflow_policy_id IS NOT NULL")).scalars())
        if not all_students and v2_students & found.get("students", set()):
            raise SystemExit("Refusing: a Portal V2 student would be deleted.")
        v2_enr = set(db.execute(text("SELECT id FROM program_enrollments WHERE workflow_policy_id IS NOT NULL")).scalars())
        if not all_students and v2_enr & found.get("program_enrollments", set()):
            raise SystemExit("Refusing: a Portal V2 enrollment would be deleted.")

        if not confirm:
            db.rollback()
            print("\nDry run only — nothing changed. Re-run with --confirm to apply.")
            return

        db.execute(text("SET LOCAL session_replication_role = replica"))  # disable history guards for this transaction
        for key, ids in found.items():
            if isinstance(key, tuple):
                table, col = key
                db.execute(text(f'DELETE FROM "{table}" WHERE "{col}" = ANY(:v)'), {"v": list(ids)})
            else:
                db.execute(text(f'DELETE FROM "{key}" WHERE id = ANY(:v)'), {"v": list(ids)})
        db.commit()
        print("\nDone. Prices updated and old plans/students removed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
