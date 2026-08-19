"""Synchronize Platinum coding assignments and projects with the 24-week timeline.

Run from ``backend``:
    venv/Scripts/python.exe scripts/sync_platinum_work_items.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.assessment import AssignmentSubmission, CodingAssignment, CodingAssignmentAssignment, CodingProblem
from app.models.people import Admin
from app.models.program import InternshipProgram
from app.models.project import Project, ProjectAssignment


CODING_PLAN = {
    "Platinum Program Coding Assessment - python": (2, "Platinum Program Coding Assessment - Python"),
    "Platinum Program Coding Assessment - web_dev": (4, "Platinum Program Coding Assessment - Web Development"),
    "Platinum Program Coding Assessment - database": (6, "Platinum Program Coding Assessment - Database"),
    "Platinum Program Coding Assessment - ai": (8, "Platinum Program Coding Assessment - AI"),
    "Platinum Program Coding Assessment - genai": (10, "Platinum Program Coding Assessment - GenAI"),
}

PROJECT_PLAN = {
    "Platinum Domain Mini Projects": (2, "mini"),
    "Platinum Final Capstone Project": (6, "capstone"),
    "Platinum Industry Internship Project": (12, "industry"),
}


def assign_to_platinum(db, item, assignment_model, id_field: str, platinum_id: int, admin_id: int) -> None:
    if not db.scalar(select(assignment_model).where(
        getattr(assignment_model, id_field) == item.id,
        assignment_model.program_id == platinum_id,
    )):
        db.add(assignment_model(
            **{id_field: item.id, "assignment_scope": "program", "program_id": platinum_id, "assigned_by": admin_id}
        ))


def keep_one_problem(db, coding: CodingAssignment) -> None:
    problems = db.scalars(select(CodingProblem).where(CodingProblem.coding_assignment_id == coding.id).order_by(CodingProblem.problem_number, CodingProblem.id)).all()
    if db.scalar(select(AssignmentSubmission).where(AssignmentSubmission.coding_assignment_id == coding.id)):
        raise RuntimeError(f"Cannot reduce {coding.title}: it already has student submissions")
    for problem in problems[1:]:
        db.delete(problem)
    if problems:
        problems[0].problem_number = 1


def main() -> None:
    with SessionLocal() as db:
        platinum = db.scalar(select(InternshipProgram).where(InternshipProgram.code == "platinum"))
        admin = db.scalar(select(Admin).order_by(Admin.id))
        if platinum is None or admin is None:
            raise RuntimeError("Platinum Program or administrator was not found")

        coding_items = {
            item.title: item
            for item in db.scalars(select(CodingAssignment).where(CodingAssignment.program_id == platinum.id))
        }
        for old_title, (week, title) in CODING_PLAN.items():
            coding = coding_items.get(old_title)
            if coding is None:
                raise RuntimeError(f"Missing coding assignment: {old_title}")
            coding.title = title
            coding.week_number = week
            coding.num_problems = 1
            coding.required_correct = 1
            coding.max_attempts = 3
            coding.attempts_per_day = 1
            coding.is_active = True
            keep_one_problem(db, coding)
            assign_to_platinum(db, coding, CodingAssignmentAssignment, "coding_assignment_id", platinum.id, admin.id)

        legacy = coding_items.get("Platinum Program Coding Assessment - software_engineering")
        if legacy is not None:
            legacy.title = "Platinum Program Coding Assessment - Surprise"
            legacy.domain_id = None
            legacy.week_number = 12
            legacy.num_problems = 1
            legacy.required_correct = 1
            legacy.max_attempts = 3
            legacy.attempts_per_day = 1
            legacy.is_active = True
            keep_one_problem(db, legacy)
            assign_to_platinum(db, legacy, CodingAssignmentAssignment, "coding_assignment_id", platinum.id, admin.id)

        projects = {item.title: item for item in db.scalars(select(Project).where(Project.program_id == platinum.id))}
        for title, (week, project_type) in PROJECT_PLAN.items():
            project = projects.get(title)
            if project is None:
                raise RuntimeError(f"Missing project: {title}")
            project.week_number = week
            project.project_type = project_type
            project.is_active = True
            assign_to_platinum(db, project, ProjectAssignment, "project_id", platinum.id, admin.id)

        db.commit()
        print("Synchronized six Platinum coding assessments and three Platinum projects.")


if __name__ == "__main__":
    main()
