from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal
from app.routers import (
    academic,
    instructors,
    certificate_access,
    admin_ops,
    admins,
    attendance,
    auth,
    student_documents,
    coding_assignments,
    document_generator,
    enrollments,
    evaluations,
    live_classes,
    materials,
    mock_interviews,
    nda,
    notifications,
    payments,
    proctoring,
    programs,
    projects,
    public,
    quizzes,
    reports,
    students,
    support,
    v2_staff,
    v2_student,
)

app = FastAPI(title="ARINSA AI MINDS - Internship Management System API", version="0.1.0")


# ---------------------------------------------------------------- admin access areas
from fastapi import Request  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402


@app.middleware("http")
async def enforce_admin_areas(request: Request, call_next):
    """Regular admins can only use the API areas a super admin granted them."""
    path = request.url.path
    auth_header = request.headers.get("authorization", "")
    if path.startswith("/api/") and auth_header.lower().startswith("bearer ") and request.method != "OPTIONS":
        from app.core.permissions import allowed
        from app.core.security import decode_access_token
        payload = decode_access_token(auth_header[7:].strip())
        sub = payload.get("sub") if payload else None
        if sub and str(sub).isdigit():
            from app.models.auth import Role, User
            from app.models.people import Admin
            db = SessionLocal()
            try:
                row = (db.query(Role.name, Admin.is_super_admin, Admin.permissions)
                       .select_from(User).join(Role, Role.id == User.role_id).outerjoin(Admin, Admin.user_id == User.id)
                       .filter(User.id == int(sub)).first())
            finally:
                db.close()
            if row and row[0] == "admin" and not row[1] and not allowed(path, request.method, row[2]):
                return JSONResponse({"detail": "You don't have access to this area. Ask a super admin to grant it."}, status_code=403)
    return await call_next(request)

_SYNC_ID_SEQUENCES_SQL = """
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


@app.on_event("startup")
def synchronize_postgres_id_sequences() -> None:
    """Repair sequences after a database restore/import before requests can write rows."""
    db = SessionLocal()
    try:
        db.execute(text(_SYNC_ID_SEQUENCES_SQL))
        db.commit()
    finally:
        db.close()

@app.on_event("startup")
def check_document_assets() -> None:
    """Certificates and invoices need the bundled PDF templates and fonts."""
    import logging
    from app.services.document_templates import self_check
    missing = self_check()
    if missing:
        msg = f"Certificate/invoice assets missing: {', '.join(missing)}"
        if settings.is_production:
            raise RuntimeError(msg)
        logging.getLogger(__name__).warning(msg)


app.include_router(academic.router)
app.include_router(instructors.router)
app.include_router(certificate_access.router)
app.include_router(certificate_access.public_router)
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(admins.router)
app.include_router(programs.router)
app.include_router(programs.tracks_router)
app.include_router(programs.batches_router)
app.include_router(enrollments.router)
app.include_router(payments.router)
app.include_router(materials.router)
app.include_router(live_classes.router)
app.include_router(quizzes.router)
app.include_router(coding_assignments.router)
app.include_router(document_generator.router)
app.include_router(projects.router)
app.include_router(evaluations.router)
app.include_router(mock_interviews.router)
app.include_router(student_documents.router)
app.include_router(notifications.router)
app.include_router(support.router)
app.include_router(attendance.router)
app.include_router(reports.router)
app.include_router(admin_ops.settings_router)
app.include_router(admin_ops.activity_logs_router)
app.include_router(nda.router)
app.include_router(proctoring.router)
app.include_router(public.router)
app.include_router(v2_student.router)
app.include_router(v2_staff.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# Keep CORS outside FastAPI's error middleware so browser clients receive CORS
# headers even when an unhandled server error occurs.
app = CORSMiddleware(
    app=app,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
