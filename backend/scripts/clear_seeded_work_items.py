"""Remove only the legacy Coding Work and Project records created by the seed script."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        coding_ids = [row[0] for row in db.execute(text("""
            SELECT id FROM coding_assignments
            WHERE title IN (
                'Basic Internship Coding Assessment',
                'Professional Internship Coding Assessment',
                'Premium Internship Coding Assessment',
                'Platinum Program Coding Assessment - python',
                'Platinum Program Coding Assessment - web_dev',
                'Platinum Program Coding Assessment - database',
                'Platinum Program Coding Assessment - ai',
                'Platinum Program Coding Assessment - genai',
                'Platinum Program Coding Assessment - software_engineering'
            )
        """)).all()]
        project_ids = [row[0] for row in db.execute(text("""
            SELECT id FROM projects
            WHERE title IN (
                'Basic Internship - Mini Project',
                'Professional Internship - Industry Project',
                'Premium Internship - End To End Project',
                'Platinum Mini Project - Python Basics',
                'Platinum Final Capstone Project'
            )
        """)).all()]

        if coding_ids:
            ids = tuple(coding_ids)
            db.execute(text("DELETE FROM assignment_submission_files WHERE submission_id IN (SELECT id FROM assignment_submissions WHERE coding_assignment_id = ANY(:ids))"), {"ids": coding_ids})
            db.execute(text("DELETE FROM assignment_submission_answers WHERE submission_id IN (SELECT id FROM assignment_submissions WHERE coding_assignment_id = ANY(:ids))"), {"ids": coding_ids})
            db.execute(text("DELETE FROM assignment_submissions WHERE coding_assignment_id = ANY(:ids)"), {"ids": coding_ids})
            db.execute(text("DELETE FROM coding_sheet_assignments WHERE sheet_id IN (SELECT id FROM coding_problem_sheets WHERE coding_assignment_id = ANY(:ids))"), {"ids": coding_ids})
            db.execute(text("DELETE FROM coding_assignment_assignments WHERE coding_assignment_id = ANY(:ids)"), {"ids": coding_ids})
            db.execute(text("DELETE FROM coding_problems WHERE coding_assignment_id = ANY(:ids)"), {"ids": coding_ids})
            db.execute(text("DELETE FROM coding_problem_sheets WHERE coding_assignment_id = ANY(:ids)"), {"ids": coding_ids})
            db.execute(text("DELETE FROM coding_assignments WHERE id = ANY(:ids)"), {"ids": coding_ids})

        if project_ids:
            ids = tuple(project_ids)
            db.execute(text("DELETE FROM project_student_resources WHERE project_id = ANY(:ids)"), {"ids": project_ids})
            db.execute(text("DELETE FROM project_assignments WHERE project_id = ANY(:ids)"), {"ids": project_ids})
            db.execute(text("DELETE FROM project_submissions WHERE project_id = ANY(:ids)"), {"ids": project_ids})
            db.execute(text("DELETE FROM projects WHERE id = ANY(:ids)"), {"ids": project_ids})

        db.commit()
        print(f"removed {len(coding_ids)} seeded coding assignments and {len(project_ids)} seeded projects")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
