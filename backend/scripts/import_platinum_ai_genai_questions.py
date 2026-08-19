"""Load the Platinum AI / GenAI Markdown MCQ bank into the local database.

Run from ``backend``:
    venv/Scripts/python.exe scripts/import_platinum_ai_genai_questions.py <path-to-bank.txt>
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, func, select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models.assessment import Quiz, QuizAttempt, QuizAttemptAnswer, QuizQuestion  # noqa: E402
from app.models.program import InternshipProgram  # noqa: E402


QUESTION_PATTERN = re.compile(
    r"\*\*Q\d+\.\s*(?P<question>.*?)\*\*\s*"
    r"A\.\s*(?P<a>.*?)\s*"
    r"B\.\s*(?P<b>.*?)\s*"
    r"C\.\s*(?P<c>.*?)\s*"
    r"D\.\s*(?P<d>.*?)\s*"
    r"\*\*Answer:\s*(?P<answer>[A-D])\*\*",
    re.DOTALL,
)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_questions(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    questions = [
        {key: clean(value) for key, value in match.groupdict().items()}
        for match in QUESTION_PATTERN.finditer(text)
    ]
    if len(questions) != 1045:
        raise RuntimeError(f"expected 1,045 complete questions, found {len(questions)}")
    return questions


def delete_quiz(db, quiz: Quiz) -> None:
    attempt_ids = db.scalars(select(QuizAttempt.id).where(QuizAttempt.quiz_id == quiz.id)).all()
    if attempt_ids:
        db.execute(delete(QuizAttemptAnswer).where(QuizAttemptAnswer.attempt_id.in_(attempt_ids)))
        db.execute(delete(QuizAttempt).where(QuizAttempt.id.in_(attempt_ids)))
    db.execute(delete(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id))
    db.delete(quiz)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("provide the path to Platinum_Program_AI_GenAI_1045_MCQs.txt")

    questions = parse_questions(Path(sys.argv[1]))
    db = SessionLocal()
    try:
        platinum = db.scalar(select(InternshipProgram).where(InternshipProgram.code == "platinum"))
        if platinum is None:
            raise RuntimeError("Platinum program was not found")

        ai_quiz = db.scalar(
            select(Quiz).where(
                Quiz.program_id == platinum.id,
                Quiz.title == "Platinum Program MCQ Assessment - ai",
            )
        )
        if ai_quiz is None:
            raise RuntimeError("existing Platinum AI quiz was not found")

        # The old GenAI and software-engineering quizzes are intentionally removed: AI and
        # GenAI are now a single assessment, and software engineering is no longer offered.
        legacy_quizzes = db.scalars(
            select(Quiz).where(
                Quiz.program_id == platinum.id,
                Quiz.title.in_((
                    "Platinum Program MCQ Assessment - genai",
                    "Platinum Program MCQ Assessment - software_engineering",
                )),
            )
        ).all()
        for legacy_quiz in legacy_quizzes:
            delete_quiz(db, legacy_quiz)

        db.execute(delete(QuizQuestion).where(QuizQuestion.quiz_id == ai_quiz.id))
        ai_quiz.title = "Platinum Program MCQ Assessment - ai/genai"
        ai_quiz.question_bank_size = len(questions)
        ai_quiz.questions_per_attempt = 25
        ai_quiz.is_active = True
        db.add_all(
            [
                QuizQuestion(
                    quiz_id=ai_quiz.id,
                    question_text=question["question"],
                    option_a=question["a"],
                    option_b=question["b"],
                    option_c=question["c"],
                    option_d=question["d"],
                    correct_option=question["answer"],
                )
                for question in questions
            ]
        )
        db.commit()

        stored_count = db.scalar(select(func.count()).select_from(QuizQuestion).where(QuizQuestion.quiz_id == ai_quiz.id))
        print(f"loaded {stored_count} AI / GenAI questions into quiz {ai_quiz.id}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
