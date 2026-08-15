"""Idempotent seed script. Run with: venv/Scripts/python.exe scripts/seed.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.assessment import CodingAssignment, CodingProblem, Quiz, QuizQuestion  # noqa: E402
from app.models.auth import Role, User  # noqa: E402
from app.models.engagement import FAQ  # noqa: E402
from app.models.people import Admin  # noqa: E402
from app.models.program import InternshipProgram, ProgramDomain, ProgramMilestone, SpecializationTrack  # noqa: E402
from app.models.project import Project  # noqa: E402

PROGRAM_DEFS = [
    dict(
        code="basic",
        name="Basic Internship",
        description="2-week foundational internship with MCQ + coding assessment and a mini project.",
        duration_weeks=2,
        price_inr=1999,
        price_usd=80,
        features={
            "highlights": [
                "1 MCQ Assessment (200-question bank, 80% pass, 5 attempts, 1/day)",
                "1 Coding Test (5 problems, 4 correct required, 5 attempts, 1/day)",
                "Week 2 Mini Project",
            ]
        },
        certificate_types=["internship_completion", "project_completion"],
        default_quiz_max_attempts=5,
        default_coding_max_attempts=5,
        milestones=[
            (1, None, "MCQ Assessment", "assessment"),
            (1, None, "Coding Assessment", "coding_test"),
            (2, None, "Mini Project", "project"),
        ],
    ),
    dict(
        code="professional",
        name="Professional Internship",
        description="4-week internship with MCQ + 3 coding tests and a full industry project.",
        duration_weeks=4,
        price_inr=4999,
        price_usd=120,
        features={
            "highlights": [
                "1 MCQ Assessment",
                "3 Coding Tests (5 questions each, 4 correct required, 3 attempts)",
                "Weeks 2-4 Industry Project (requirements, DB design, backend, frontend, APIs, testing, docs, demo)",
            ]
        },
        certificate_types=["internship_completion", "project_completion", "performance_evaluation"],
        default_quiz_max_attempts=3,
        default_coding_max_attempts=3,
        milestones=[
            (1, None, "MCQ Assessment", "assessment"),
            (1, None, "Coding Test 1", "coding_test"),
            (1, None, "Coding Test 2", "coding_test"),
            (1, None, "Coding Test 3", "coding_test"),
            (2, None, "Industry Project - Requirements & DB Design", "project"),
            (3, None, "Industry Project - Backend & Frontend", "project"),
            (4, None, "Industry Project - Testing, Docs & Demo", "project"),
        ],
    ),
    dict(
        code="premium",
        name="Premium Internship",
        description="6-week internship: assessments, end-to-end project, and live product development.",
        duration_weeks=6,
        price_inr=9999,
        price_usd=260,
        features={
            "highlights": [
                "MCQ + Coding Assessments",
                "Weeks 2-3 End-to-End Industry Project",
                "Weeks 4-6 Live Product Development (features, bug fixes, APIs, DB, AI features, GitHub, docs, weekly reviews)",
            ]
        },
        certificate_types=["internship_completion", "project_completion", "performance_evaluation", "recommendation"],
        default_quiz_max_attempts=5,
        default_coding_max_attempts=5,
        milestones=[
            (1, None, "MCQ Assessment", "assessment"),
            (1, None, "Coding Assessment", "coding_test"),
            (2, None, "End-to-End Project - Phase 1", "project"),
            (3, None, "End-to-End Project - Phase 2", "project"),
            (4, None, "Live Product Development - Sprint 1", "project"),
            (5, None, "Live Product Development - Sprint 2", "project"),
            (6, None, "Live Product Development - Final Review", "project"),
        ],
    ),
    dict(
        code="platinum",
        name="Platinum Program",
        description="24-week (6-month) program: Phase 1 live-taught learning across 6 domains, Phase 2 industry internship with guaranteed employment outcome.",
        duration_weeks=24,
        price_inr=25000,
        price_usd=500,
        features={
            "highlights": [
                "Phase 1 (12 weeks): Live classes via Google Meet across 6 domains",
                "6 MCQ Assessments + 6 Coding Assessments + Mini Projects + Capstone Project",
                "Phase 2 (12 weeks): Industry internship with specialization track + mock interview",
                "Guaranteed employment outcome based on final evaluation",
            ]
        },
        certificate_types=[
            "platinum",
            "internship_completion",
            "project_completion",
            "experience",
            "performance_evaluation",
            "recommendation",
        ],
        default_quiz_max_attempts=3,
        default_coding_max_attempts=3,
        domains=[
            ("python", "Python Programming: fundamentals, advanced, OOP, data structures, exceptions, file handling, debugging, optimization"),
            ("web_dev", "Web Development: HTML, CSS, JavaScript, React.js, FastAPI, REST APIs, Authentication"),
            ("database", "Database: PostgreSQL, SQL, CRUD, database design, query optimization"),
            ("ai", "Artificial Intelligence: machine learning, deep learning, data processing, model training, evaluation"),
            ("genai", "Generative AI: LLMs, prompt engineering, RAG, AI agents, agentic AI, MCP"),
            ("software_engineering", "Software Engineering: Git, GitHub, system design, API development, deployment, performance, clean code"),
        ],
        milestones=[
            (1, "phase1", "Python Programming - Live Classes", "live_class"),
            (2, "phase1", "Python Programming - Assessment", "assessment"),
            (3, "phase1", "Web Development - Live Classes", "live_class"),
            (4, "phase1", "Web Development - Assessment", "assessment"),
            (5, "phase1", "Database - Live Classes", "live_class"),
            (6, "phase1", "Database - Assessment", "assessment"),
            (7, "phase1", "Artificial Intelligence - Live Classes", "live_class"),
            (8, "phase1", "Artificial Intelligence - Assessment", "assessment"),
            (9, "phase1", "Generative AI - Live Classes", "live_class"),
            (10, "phase1", "Generative AI - Assessment", "assessment"),
            (11, "phase1", "Software Engineering - Live Classes", "live_class"),
            (12, "phase1", "Final Capstone Project", "capstone"),
            (13, "phase2", "Industry Internship - Specialization Track Begins", "project"),
            (23, "phase2", "Final Mock Interview", "mock_interview"),
            (24, "phase2", "Final Evaluation & Employment Outcome", "project"),
        ],
    ),
]

FAQ_DEFS = [
    ("How do I enroll in an internship program?", "Go to Internship Plans, select a program, and complete enrollment. Your enrollment activates once payment is confirmed.", "enrollment"),
    ("How many attempts do I get on a quiz?", "Attempt limits vary by program and are shown on the quiz itself before you start (e.g. Basic allows 5 attempts, one per day).", "assessments"),
    ("What file formats can I upload for assignments and projects?", "PDF, DOCX, ZIP, JPG, JPEG, and PNG only. Video files are not supported on this platform.", "submissions"),
    ("How do I join a Platinum live class?", "Go to Live Classes and click Join Class at the scheduled time — it opens the Google Meet link in a new tab.", "platinum"),
    ("How do I download my certificate?", "Once your program is marked complete by Admin and certificates are generated, they will appear in the Certificates section for download.", "certificates"),
]


def seed_roles(db) -> dict[str, Role]:
    roles = {}
    for name, desc in [("admin", "Full platform access"), ("student", "Own-data access only")]:
        role = db.query(Role).filter(Role.name == name).first()
        if role is None:
            role = Role(name=name, description=desc)
            db.add(role)
            db.flush()
            print(f"created role: {name}")
        roles[name] = role
    return roles


def seed_admin(db, roles: dict[str, Role]) -> Admin:
    user = db.query(User).filter(User.email == settings.SEED_ADMIN_EMAIL).first()
    if user is None:
        user = User(
            email=settings.SEED_ADMIN_EMAIL,
            password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
            role_id=roles["admin"].id,
            is_active=True,
        )
        db.add(user)
        db.flush()
        admin = Admin(user_id=user.id, full_name="Platform Administrator", designation="Super Admin", department="Operations")
        db.add(admin)
        db.flush()
        print(f"created admin: {settings.SEED_ADMIN_EMAIL}")
        return admin
    print(f"admin already exists: {settings.SEED_ADMIN_EMAIL}")
    return db.query(Admin).filter(Admin.user_id == user.id).first()


def seed_specialization_tracks(db) -> None:
    for name, desc in [
        ("software_dev", "Software Development specialization track"),
        ("technical_support", "Technical Support specialization track"),
        ("qa_testing", "QA Testing specialization track"),
        ("devops", "DevOps specialization track"),
    ]:
        existing = db.query(SpecializationTrack).filter(SpecializationTrack.name == name).first()
        if existing is None:
            db.add(SpecializationTrack(name=name, description=desc))
            print(f"created specialization track: {name}")


def seed_sample_quiz(db, program: InternshipProgram, admin: Admin, domain: ProgramDomain | None, week: int, title_suffix: str, questions_per_attempt: int = 25, category: str | None = None) -> None:
    title = f"{program.name} MCQ Assessment{title_suffix}"
    existing = db.query(Quiz).filter(Quiz.program_id == program.id, Quiz.domain_id == (domain.id if domain else None), Quiz.title == title).first()
    if existing:
        # Keep already-created Platinum records aligned when this idempotent seed is rerun.
        if category:
            existing.category = category
            existing.questions_per_attempt = 50
            existing.passing_percent = 80
            existing.max_attempts = 5
            existing.attempts_per_day = 1
        return
    quiz = Quiz(
        title=title,
        program_id=program.id,
        domain_id=domain.id if domain else None,
        category=category,
        week_number=week,
        question_bank_size=200,
        questions_per_attempt=questions_per_attempt,
        passing_percent=program.default_quiz_pass_percent,
        max_attempts=5 if category else program.default_quiz_max_attempts,
        attempts_per_day=1 if category else program.default_quiz_attempts_per_day,
        time_limit_minutes=30,
        created_by=admin.id,
    )
    db.add(quiz)
    db.flush()

    sample_questions = [
        ("What does CRUD stand for in software development?", "Create, Read, Update, Delete", "Copy, Run, Undo, Debug", "Create, Run, Update, Deploy", "Compile, Read, Undo, Deploy", "A"),
        ("Which HTTP method is idempotent and used to update a resource fully?", "POST", "PUT", "PATCH", "CONNECT", "B"),
        ("In PostgreSQL, which clause filters rows after GROUP BY aggregation?", "WHERE", "FILTER", "HAVING", "LIMIT", "C"),
        ("Which Python keyword defines a generator function?", "return", "yield", "async", "lambda", "B"),
        ("What is the primary purpose of a JWT refresh token?", "Encrypt passwords", "Obtain a new access token without re-authenticating", "Store user profile data", "Sign API requests", "B"),
        ("Which React hook is used to memoize an expensive computation?", "useEffect", "useState", "useMemo", "useRef", "C"),
        ("What does REST stand for?", "Representational State Transfer", "Remote Execution State Transfer", "Reliable State Transmission", "Resource State Transport", "A"),
        ("Which SQL constraint ensures a column's values are unique across a table?", "PRIMARY KEY", "UNIQUE", "CHECK", "INDEX", "B"),
        ("Which HTTP status code indicates a successful resource creation?", "200", "201", "204", "301", "B"),
        ("In FastAPI, which library is used for request/response data validation?", "SQLAlchemy", "Pydantic", "Jinja2", "Starlette", "B"),
    ]
    for q_text, a, b, c, d, correct in sample_questions:
        db.add(QuizQuestion(quiz_id=quiz.id, question_text=q_text, option_a=a, option_b=b, option_c=c, option_d=d, correct_option=correct))
    print(f"seeded quiz: {title} (10 sample questions)")


def seed_sample_coding(db, program: InternshipProgram, admin: Admin, domain: ProgramDomain | None, week: int, title_suffix: str) -> None:
    title = f"{program.name} Coding Assessment{title_suffix}"
    existing = db.query(CodingAssignment).filter(CodingAssignment.program_id == program.id, CodingAssignment.domain_id == (domain.id if domain else None), CodingAssignment.title == title).first()
    if existing:
        return
    coding = CodingAssignment(
        title=title,
        description=f"5-problem coding assessment for {program.name}.",
        program_id=program.id,
        domain_id=domain.id if domain else None,
        week_number=week,
        num_problems=5,
        required_correct=4,
        max_attempts=program.default_coding_max_attempts,
        attempts_per_day=program.default_quiz_attempts_per_day,
        created_by=admin.id,
    )
    db.add(coding)
    db.flush()

    problems = [
        ("Reverse a String", "Write a function that returns the reverse of a given string.", "\"hello\"", "\"olleh\""),
        ("Find the Maximum", "Write a function that returns the maximum value in a list of integers.", "[3, 7, 2, 9]", "9"),
        ("FizzBuzz", "Print numbers 1 to n; multiples of 3 print 'Fizz', of 5 print 'Buzz', of both print 'FizzBuzz'.", "n=5", "1 2 Fizz 4 Buzz"),
        ("Palindrome Check", "Write a function that checks whether a given string is a palindrome.", "\"madam\"", "true"),
        ("Sum of Digits", "Write a function that returns the sum of digits of a positive integer.", "1234", "10"),
    ]
    for i, (p_title, statement, sample_in, sample_out) in enumerate(problems, start=1):
        db.add(CodingProblem(
            coding_assignment_id=coding.id,
            problem_number=i,
            title=p_title,
            statement=statement,
            sample_input=sample_in,
            sample_output=sample_out,
        ))
    print(f"seeded coding assignment: {title} (5 problems)")


def seed_sample_project(db, program: InternshipProgram, admin: Admin, week: int, project_type: str, title: str, description: str) -> None:
    existing = db.query(Project).filter(Project.program_id == program.id, Project.title == title).first()
    if existing:
        return
    db.add(Project(
        program_id=program.id,
        title=title,
        description=description,
        week_number=week,
        project_type=project_type,
        created_by=admin.id,
    ))
    print(f"seeded project: {title}")


def seed_programs(db, admin: Admin) -> None:
    for pdef in PROGRAM_DEFS:
        program = db.query(InternshipProgram).filter(InternshipProgram.code == pdef["code"]).first()
        if program is None:
            program = InternshipProgram(
                code=pdef["code"],
                name=pdef["name"],
                description=pdef["description"],
                duration_weeks=pdef["duration_weeks"],
                price_inr=pdef["price_inr"],
                price_usd=pdef["price_usd"],
                features=pdef["features"],
                certificate_types={"types": pdef["certificate_types"]},
                default_quiz_max_attempts=pdef["default_quiz_max_attempts"],
                default_coding_max_attempts=pdef["default_coding_max_attempts"],
                created_by=admin.id,
            )
            db.add(program)
            db.flush()
            print(f"created program: {program.name}")
        else:
            print(f"program already exists: {program.name}")

        domain_rows: dict[str, ProgramDomain] = {}
        for order_index, (dname, ddesc) in enumerate(pdef.get("domains", [])):
            domain = db.query(ProgramDomain).filter(ProgramDomain.program_id == program.id, ProgramDomain.name == dname).first()
            if domain is None:
                domain = ProgramDomain(program_id=program.id, name=dname, order_index=order_index, description=ddesc)
                db.add(domain)
                db.flush()
                print(f"  created domain: {dname}")
            domain_rows[dname] = domain

        for order_index, (week, phase, mtitle, mtype) in enumerate(pdef.get("milestones", [])):
            existing_m = db.query(ProgramMilestone).filter(
                ProgramMilestone.program_id == program.id,
                ProgramMilestone.week_number == week,
                ProgramMilestone.title == mtitle,
            ).first()
            if existing_m is None:
                db.add(ProgramMilestone(
                    program_id=program.id,
                    week_number=week,
                    phase=phase,
                    title=mtitle,
                    milestone_type=mtype,
                    order_index=order_index,
                ))

        if pdef["code"] == "platinum":
            platinum_categories = {
                "python": "python", "web_dev": "web_dev", "database": "database",
                "ai": "ai", "genai": "ovr1", "software_engineering": "ovr2",
            }
            for dname, domain in domain_rows.items():
                seed_sample_quiz(db, program, admin, domain, week=1, title_suffix=f" - {dname}", questions_per_attempt=50, category=platinum_categories[dname])
                # Coding Work is created by an admin only when it is ready.
        else:
            seed_sample_quiz(db, program, admin, None, week=1, title_suffix="", questions_per_attempt=50)
            # Projects are created by an admin only when they are ready.


def seed_faqs(db) -> None:
    for question, answer, category in FAQ_DEFS:
        existing = db.query(FAQ).filter(FAQ.question == question).first()
        if existing is None:
            db.add(FAQ(question=question, answer=answer, category=category))
    print(f"seeded {len(FAQ_DEFS)} FAQs (idempotent)")


def main():
    db = SessionLocal()
    try:
        roles = seed_roles(db)
        admin = seed_admin(db, roles)
        db.commit()

        seed_specialization_tracks(db)
        seed_programs(db, admin)
        seed_faqs(db)
        db.commit()
        print("seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
