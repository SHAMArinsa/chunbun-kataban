"""Rebuild every existing Welcome Certificate, Completion Certificate and Payment Invoice
with the current approved designs (app/assets/templates). Numbers, dates and records stay
the same — only the PDF files are re-rendered. Revoked certificates are skipped.

    python -m scripts.refresh_documents
"""
from sqlalchemy import or_

from app.core.database import SessionLocal
from app.models.engagement import Certificate
from app.models.people import Student
from app.models.portal_v2 import InvoiceArtifact
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.services import storage
from app.services.certificate_service import render_welcome_certificate_pdf
from app.services.email_service import build_payment_invoice_pdf
from app.services.v2_documents import completion_pdf


def main() -> None:
    db = SessionLocal()
    done = {"welcome": 0, "internship_completion": 0, "invoice": 0}
    failed = []
    try:
        certs = (db.query(Certificate)
                 .filter(Certificate.certificate_type.in_(("welcome", "internship_completion")),
                         or_(Certificate.status.is_(None), Certificate.status != "revoked")).all())
        for c in certs:
            try:
                e = db.get(ProgramEnrollment, c.enrollment_id)
                st, prog = db.get(Student, c.student_id), db.get(InternshipProgram, c.program_id)
                if e is None or st is None or prog is None:
                    continue
                pdf = (render_welcome_certificate_pdf(st, prog, e, c.certificate_number, c.issued_date)
                       if c.certificate_type == "welcome" else completion_pdf(st, prog, c.certificate_number, c.issued_date, e))
                storage.overwrite(c.file_path, pdf, "application/pdf")
                done[c.certificate_type] += 1
            except Exception as exc:  # keep going; report at the end
                failed.append(f"certificate {c.certificate_number}: {exc}")
        for a in db.query(InvoiceArtifact).all():
            try:
                p = db.get(Payment, a.payment_id)
                st = db.get(Student, a.student_id)
                prog = db.get(InternshipProgram, a.program_id)
                _, pdf = build_payment_invoice_pdf(student_name=st.full_name, program_name=prog.name, payment=p,
                                                   student_number=st.student_number)
                storage.overwrite(a.file_path, pdf, "application/pdf")
                done["invoice"] += 1
            except Exception as exc:
                failed.append(f"invoice for payment {a.payment_id}: {exc}")
    finally:
        db.close()
    print(f"Refreshed {done['welcome']} Welcome Certificates, {done['internship_completion']} Completion Certificates "
          f"and {done['invoice']} Invoices.")
    for f in failed:
        print("  could not refresh", f)


if __name__ == "__main__":
    main()
