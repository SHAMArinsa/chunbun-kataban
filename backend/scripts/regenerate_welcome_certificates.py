"""Replace all existing Welcome Certificate PDFs with the current dynamic template.

Run from the backend directory:
    venv/Scripts/python.exe scripts/regenerate_welcome_certificates.py

Use --dry-run to see how many records will be replaced without changing storage or the database.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal  # noqa: E402
from app.models.engagement import Certificate  # noqa: E402
from app.models.people import Student  # noqa: E402
from app.models.program import InternshipProgram, ProgramEnrollment  # noqa: E402
from app.services.certificate_service import render_welcome_certificate_pdf  # noqa: E402
from app.services.storage import delete, save  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate Welcome Certificate PDFs from the current template.")
    parser.add_argument("--dry-run", action="store_true", help="Report affected certificates without changing them.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        certificates = db.query(Certificate).filter(Certificate.certificate_type == "welcome").order_by(Certificate.id).all()
        if args.dry_run:
            print(f"{len(certificates)} Welcome Certificate(s) would be regenerated.")
            return

        replaced: list[str] = []
        for certificate in certificates:
            student = db.get(Student, certificate.student_id)
            enrollment = db.get(ProgramEnrollment, certificate.enrollment_id)
            program = db.get(InternshipProgram, certificate.program_id)
            if student is None or enrollment is None or program is None:
                raise RuntimeError(f"Certificate {certificate.id} is missing its student, enrollment, or program")

            old_path = certificate.file_path
            pdf_bytes = render_welcome_certificate_pdf(
                student, program, enrollment, certificate.certificate_number, certificate.issued_date
            )
            certificate.file_path = save(pdf_bytes, "certificates", f"{certificate.certificate_number}.pdf")
            replaced.append(old_path)

        db.commit()
        for old_path in replaced:
            delete(old_path)
        print(f"Regenerated {len(certificates)} Welcome Certificate(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
