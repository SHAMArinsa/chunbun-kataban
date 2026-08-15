"""Import a pasted A-D MCQ document into a Platinum shared category bank.

Usage:
  venv/Scripts/python.exe scripts/import_pasted_platinum_mcqs.py <category> <text-file> <sheet-title>
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.assessment import Quiz, QuizQuestion, QuizQuestionSheet


QUESTION_PATTERN = re.compile(
    r"^\*\*Q\d+\.\s*(.*?)\n"
    r"A\.\s*(.*?)\nB\.\s*(.*?)\nC\.\s*(.*?)\nD\.\s*(.*?)\n"
    r"\*\*Answer:\s*([ABCD])\*\*",
    re.MULTILINE | re.DOTALL,
)


def parse_questions(text: str) -> list[dict]:
    questions = []
    for match in QUESTION_PATTERN.finditer(text):
        question, option_a, option_b, option_c, option_d, correct_option = match.groups()
        # Remove the Markdown bold terminator after the question heading while preserving any
        # code block that follows it as part of the question text.
        question = question.rstrip()
        if question.endswith("**"):
            question = question[:-2].rstrip()
        questions.append(
            {
                "question_text": question.strip(),
                "option_a": option_a.strip(),
                "option_b": option_b.strip(),
                "option_c": option_c.strip(),
                "option_d": option_d.strip(),
                "correct_option": correct_option,
            }
        )
    return questions


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("Usage: import_pasted_platinum_mcqs.py <category> <text-file> <sheet-title>")

    category, text_file, sheet_title = sys.argv[1:]
    questions = parse_questions(Path(text_file).read_text(encoding="utf-8"))
    if not questions:
        raise SystemExit("No valid questions found. Expected Q/A-D/**Answer: X** format.")

    db = SessionLocal()
    try:
        quiz = db.query(Quiz).filter(Quiz.category == category).one_or_none()
        if quiz is None:
            raise SystemExit(f"No Platinum quiz found for category: {category}")
        if db.query(QuizQuestionSheet).filter(QuizQuestionSheet.quiz_id == quiz.id, QuizQuestionSheet.title == sheet_title).first():
            raise SystemExit(f"An import sheet named '{sheet_title}' already exists for category '{category}'.")

        existing_questions = {
            question_text
            for (question_text,) in db.query(QuizQuestion.question_text).filter(QuizQuestion.quiz_id == quiz.id)
        }
        questions = [question for question in questions if question["question_text"] not in existing_questions]
        if not questions:
            raise SystemExit("All parsed questions are already in this category's question bank.")

        sheet = QuizQuestionSheet(quiz_id=quiz.id, title=sheet_title, uploaded_by=quiz.created_by)
        db.add(sheet)
        db.flush()
        for question in questions:
            db.add(QuizQuestion(quiz_id=quiz.id, sheet_id=sheet.id, **question))
        db.commit()
        print(f"Imported {len(questions)} questions into category '{category}', quiz #{quiz.id}, sheet #{sheet.id}.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
