"""Create 5 TEST students, one per programme tier, already paid and active.

    student1@gmail.com  -> Basic Internship
    student2@gmail.com  -> Professional Internship
    student3@gmail.com  -> Advanced Internship
    student4@gmail.com  -> Career Internship
    student5@gmail.com  -> Career Accelerator
    Password for all: 12345678

Run from backend/:   python -m scripts.seed_test_students
Safe to run twice: existing emails are skipped. No emails are sent to these addresses
(they are real Gmail domains), so welcome-certificate / invoice emails are marked as not sent.
"""
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.auth import Role, User
from app.models.nda import NdaAcceptance
from app.models.people import Student
from app.models.program import InternshipProgram, Payment, ProgramEnrollment
from app.models.portal_v2 import DocumentDelivery
from app.services.payment_service import activate_payment, compute_payment

PASSWORD = "12345678"
STUDENTS = [
    ("student1@gmail.com", "Test Student One", "basic"),
    ("student2@gmail.com", "Test Student Two", "professional"),
    ("student3@gmail.com", "Test Student Three", "advanced"),
    ("student4@gmail.com", "Test Student Four", "career"),
    ("student5@gmail.com", "Test Student Five", "career_accelerator"),
]


def main() -> None:
    from datetime import date, timedelta
    from app.services.v2 import add_duration

    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == "student").one()
        for i, (email, name, code) in enumerate(STUDENTS, start=1):
            if db.query(User).filter(User.email == email).first():
                print(f"skip   {email} (already exists)")
                continue
            program = db.query(InternshipProgram).filter(InternshipProgram.code == code).first()
            if program is None:
                print(f"ERROR  programme '{code}' not found — skipped {email}")
                continue
            user = User(email=email, password_hash=hash_password(PASSWORD), role_id=role.id, phone=f"900000000{i}", is_active=True)
            db.add(user)
            db.flush()
            student = Student(user_id=user.id, full_name=name, phone=user.phone, citizenship_status="indian", country="India",
                              national_id_type="PAN", national_id_number=f"TESTP{i:04d}X")
            db.add(student)
            db.flush()
            enrollment = ProgramEnrollment(
                student_id=student.id, program_id=program.id, status="pending_payment", start_date=date.today(),
                expected_end_date=(add_duration(date.today(), program.duration, program.duration_unit)
                                   if program.duration and program.duration_unit else date.today() + timedelta(weeks=program.duration_weeks or 4)),
                workflow_policy_id=program.workflow_policy_id,
            )
            db.add(enrollment)
            db.flush()
            db.add(NdaAcceptance(student_id=student.id, enrollment_id=enrollment.id, signature_name=name, ip_address="127.0.0.1"))
            c = compute_payment(program, student)
            payment = Payment(enrollment_id=enrollment.id, student_id=student.id, currency=c["currency"], base_amount=c["base_amount"],
                              fee_type=c["fee_type"], fee_percent=c["fee_percent"], fee_amount=c["fee_amount"],
                              total_amount=c["total_amount"], status="pending")
            db.add(payment)
            db.flush()
            activate_payment(db, payment, method="manual_offline", notes="Test account (seed script)")
            ids = getattr(payment, "pending_delivery_ids", None) or []
            for d in db.query(DocumentDelivery).filter(DocumentDelivery.id.in_(ids)).all():
                d.status, d.error_message = "failed", "Test account — email not sent"
            db.commit()
            db.refresh(student)
            print(f"created {email} / {PASSWORD}  ->  {program.name}  (Student ID {student.student_number})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
