"""Apply the 24-week Platinum Program plan to the local database.

Run from the backend directory:
    venv/Scripts/python.exe scripts/configure_platinum_learning_plan.py
"""

from datetime import timedelta
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.program import InternshipProgram, ProgramEnrollment, ProgramMilestone


PLAN = [
    (1, "Python Programming", "Platinum Program MCQ Assessment – Python — 25 Questions · 80% Pass · 20 Min · 3 Attempts"),
    (2, "Python Programming", "Platinum Program Coding Assessment – Python — 1 Problem + Platinum Domain Mini Projects"),
    (3, "Web Development", "No assessment or activity scheduled."),
    (4, "Web Development", "Platinum Program MCQ Assessment – Web Dev — 25 Questions · 80% Pass · 20 Min · 3 Attempts + Platinum Program Coding Assessment – Web Development — 1 Problem"),
    (5, "Database", "Platinum Program MCQ Assessment – Database — 25 Questions · 80% Pass · 20 Min · 3 Attempts"),
    (6, "Database", "Platinum Program Coding Assessment – Database — 1 Problem + Platinum Final Capstone Project"),
    (7, "Artificial Intelligence", "No assessment or activity scheduled."),
    (8, "Artificial Intelligence / GenAI", "Platinum Program MCQ Assessment – AI/GenAI — 25 Questions · 80% Pass · 20 Min · 3 Attempts + Platinum Program Coding Assessment – AI — 1 Problem"),
    (9, "Generative AI", "No assessment or activity scheduled."),
    (10, "Generative AI", "Platinum Program Coding Assessment – GenAI — 1 Problem"),
    (11, "AI/GENAI", "Platinum Program MCQ Assessment – Overall 1 — 100 Questions · 80% Pass · 60 Min · 3 Attempts"),
    (12, "AI/GENAI", "Platinum Program Coding Assessment – Surprise — 1 Problem + Platinum Program MCQ Assessment – Overall 2 — 100 Questions · 80% Pass · 60 Min · 3 Attempts + Platinum Industry Internship Project"),
]

PHASE_TWO = [
    (13, "Industry Internship - Specialization Track Begins", "project"),
    (23, "Final Mock Interview", "mock_interview"),
    (24, "Final Evaluation & Employment Outcome", "project"),
]


def main() -> None:
    with SessionLocal() as db:
        platinum = db.scalar(select(InternshipProgram).where(InternshipProgram.code == "platinum"))
        if platinum is None:
            raise RuntimeError("Platinum Program was not found")

        platinum.duration_weeks = 24
        platinum.description = "24-week Platinum Program: 12 weeks of live-taught technical learning followed by a 12-week industry internship phase."
        platinum.features = {
            "highlights": [
                "12 weeks of structured technical learning",
                "One live class every week for Weeks 1–12",
                "Six MCQ assessments, coding assessments, mini projects, and final projects",
                "12-week industry internship with specialization track and final evaluation",
            ]
        }

        db.query(ProgramMilestone).filter(ProgramMilestone.program_id == platinum.id).delete(synchronize_session=False)
        for order_index, (week, topic, activity) in enumerate(PLAN, start=1):
            db.add(ProgramMilestone(
                program_id=platinum.id,
                week_number=week,
                phase="phase1",
                title=f"{topic} — Live Class",
                description=activity,
                milestone_type="live_class",
                order_index=order_index,
            ))
        for order_index, (week, title, milestone_type) in enumerate(PHASE_TWO, start=len(PLAN) + 1):
            db.add(ProgramMilestone(
                program_id=platinum.id,
                week_number=week,
                phase="phase2",
                title=title,
                milestone_type=milestone_type,
                order_index=order_index,
            ))

        for enrollment in db.scalars(select(ProgramEnrollment).where(ProgramEnrollment.program_id == platinum.id)):
            if enrollment.start_date:
                enrollment.expected_end_date = enrollment.start_date + timedelta(weeks=24)
            enrollment.current_phase = "phase1" if (enrollment.current_week or 1) <= 12 else "phase2"
            enrollment.current_week = min(max(enrollment.current_week or 1, 1), 24)

        db.commit()
        print("Configured Platinum Program for 24 weeks: revised Phase 1 and restored Phase 2 milestones.")


if __name__ == "__main__":
    main()
