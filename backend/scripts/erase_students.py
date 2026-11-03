"""Erase ALL students and everything that belongs to them: enrollments, payments, invoices,
certificates, submissions, tracks, tickets, notifications, NDA records, OTPs, login sessions and
their user accounts. Admin/staff accounts, programmes, prices and course content are kept.

Run from backend/:   python -m scripts.erase_students
It shows what will be deleted and asks you to type ERASE before anything is removed.
Everything runs in one transaction - if anything fails, nothing is deleted.
"""
from sqlalchemy import MetaData, text

from app.core.database import engine


def main() -> None:
    meta = MetaData()
    meta.reflect(bind=engine)
    t = meta.tables

    # children[parent] = [(child_table, child_col, parent_col), ...]
    children: dict[str, list[tuple[str, str, str]]] = {}
    for table in t.values():
        for fk in table.foreign_keys:
            children.setdefault(fk.column.table.name, []).append((table.name, fk.parent.name, fk.column.name))

    plan: list[tuple[str, str]] = []  # (table, WHERE) in safe delete order (children first)

    def collect(table: str, where: str, path: tuple[str, ...]) -> None:
        for child, ccol, pcol in children.get(table, []):
            if child in path:  # self / circular references
                continue
            collect(child, f'"{ccol}" IN (SELECT "{pcol}" FROM "{table}" WHERE {where})', path + (child,))
        plan.append((table, where))

    student_users = '"id" IN (SELECT "user_id" FROM "students")'
    collect("students", "TRUE", ("students",))
    # Student login accounts (their refresh tokens etc. are children of users).
    for child, ccol, pcol in children.get("users", []):
        if child != "students":
            collect(child, f'"{ccol}" IN (SELECT "{pcol}" FROM "users" WHERE {student_users})', (child,))
    plan.append(("users", student_users))

    with engine.begin() as conn:
        n_students = conn.execute(text('SELECT count(*) FROM "students"')).scalar()
        n_payments = conn.execute(text('SELECT count(*) FROM "payments"')).scalar() if "payments" in t else 0
        print(f"Students: {n_students}   Payments: {n_payments}")
        print("Admin/staff accounts, programmes and course content will NOT be touched.")
        if input("Type ERASE to permanently delete all students and their data: ").strip() != "ERASE":
            print("Cancelled - nothing deleted.")
            return
        # users must be read before students are gone, so stash the ids first.
        conn.execute(text('CREATE TEMP TABLE _erase_users AS SELECT "user_id" AS id FROM "students"'))
        # Some history tables are protected by append-only triggers; switch those off for this
        # transaction only (they are switched back on before commit, or by rollback on error).
        touched = sorted({tb for tb, _ in plan} | ({"email_otps"} & set(t)))
        for tb in touched:
            conn.execute(text(f'ALTER TABLE "{tb}" DISABLE TRIGGER USER'))
        totals: dict[str, int] = {}
        for table, where in plan:
            where = where.replace('SELECT "user_id" FROM "students"', 'SELECT id FROM _erase_users')
            n = conn.execute(text(f'DELETE FROM "{table}" WHERE {where}')).rowcount
            if n:
                totals[table] = totals.get(table, 0) + n
        if "email_otps" in t:
            totals["email_otps"] = conn.execute(text('DELETE FROM "email_otps" WHERE "email" NOT IN (SELECT "email" FROM "users")')).rowcount
        for tb in touched:
            conn.execute(text(f'ALTER TABLE "{tb}" ENABLE TRIGGER USER'))
        for table, n in sorted(totals.items()):
            print(f"  deleted {n:>5}  {table}")
    print("Done. All students and their payments have been erased.")


if __name__ == "__main__":
    main()
