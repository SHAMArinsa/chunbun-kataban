from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
