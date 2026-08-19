"""Configure the six Platinum MCQ assessments and build both overall banks.

Run from ``backend``:
    venv/Scripts/python.exe scripts/configure_platinum_quizzes.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, func, select

from app.core.database import SessionLocal
from app.models.assessment import Quiz, QuizAttempt, QuizQuestion
from app.models.program import InternshipProgram


DOMAIN_QUIZ_TITLES = (
    "Platinum Program MCQ Assessment - python",
    "Platinum Program MCQ Assessment - web_dev",
    "Platinum Program MCQ Assessment - database",
    "Platinum Program MCQ Assessment - ai/genai",
)
OVERALL_QUIZZES = (
    ("Platinum Program MCQ Assessment - overall 1", "platinum_overall_1"),
    ("Platinum Program MCQ Assessment - overall 2", "platinum_overall_2"),
)


def copy_question(question: QuizQuestion, quiz_id: int) -> QuizQuestion:
    return QuizQuestion(
        quiz_id=quiz_id,
        question_text=question.question_text,
        option_a=question.option_a,
        option_b=question.option_b,
        option_c=question.option_c,
        option_d=question.option_d,
        correct_option=question.correct_option,
        explanation=question.explanation,
    )


def main() -> None:
    db = SessionLocal()
    try:
        platinum = db.scalar(select(InternshipProgram).where(InternshipProgram.code == "platinum"))
        if platinum is None:
            raise RuntimeError("Platinum program was not found")

        domain_quizzes = db.scalars(
            select(Quiz).where(Quiz.program_id == platinum.id, Quiz.title.in_(DOMAIN_QUIZ_TITLES))
        ).all()
        by_title = {quiz.title: quiz for quiz in domain_quizzes}
        missing = set(DOMAIN_QUIZ_TITLES) - set(by_title)
        if missing:
            raise RuntimeError(f"missing Platinum domain quizzes: {', '.join(sorted(missing))}")

        source_questions = []
        for title in DOMAIN_QUIZ_TITLES:
            quiz = by_title[title]
            quiz.passing_percent = 80
            quiz.max_attempts = 3
            quiz.attempts_per_day = 1
            quiz.questions_per_attempt = 25
            quiz.time_limit_minutes = 20
            quiz.question_bank_size = db.scalar(
                select(func.count()).select_from(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id)
            )
            source_questions.extend(
                db.scalars(select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id).order_by(QuizQuestion.id)).all()
            )

        if not source_questions:
            raise RuntimeError("no Platinum domain questions are available for the overall assessments")

        admin_id = domain_quizzes[0].created_by
        for title, category in OVERALL_QUIZZES:
            quiz = db.scalar(select(Quiz).where(Quiz.program_id == platinum.id, Quiz.title == title))
            if quiz is None:
                quiz = Quiz(title=title, program_id=platinum.id, category=category, created_by=admin_id)
                db.add(quiz)
                db.flush()
            if db.scalar(select(func.count()).select_from(QuizAttempt).where(QuizAttempt.quiz_id == quiz.id)):
                raise RuntimeError(f"cannot rebuild {title}: it already has student attempts")

            db.execute(delete(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id))
            quiz.passing_percent = 80
            quiz.max_attempts = 3
            quiz.attempts_per_day = 1
            quiz.questions_per_attempt = 100
            quiz.time_limit_minutes = 60
            quiz.question_bank_size = len(source_questions)
            quiz.is_active = True
            db.add_all([copy_question(question, quiz.id) for question in source_questions])

        db.commit()
        print(f"configured four domain quizzes and built two overall banks with {len(source_questions)} questions each")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
