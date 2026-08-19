from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal
from app.routers import (
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
)

app = FastAPI(title="ARINSA AI MINDS - Internship Management System API", version="0.1.0")

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
