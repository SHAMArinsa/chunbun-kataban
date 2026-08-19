"""Replace a Platinum quiz bank with JSON questions supplied on standard input.

Each JSON object must contain: question, a, b, c, d, answer.
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, func, select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models.assessment import Quiz, QuizQuestion  # noqa: E402
from app.models.program import InternshipProgram  # noqa: E402

MARKDOWN_HEADER_PATTERN = re.compile(r"^\*\*Q(?P<number>\d+)\.\s*(?P<heading>.*?)\*\*\s*(?P<body>.*)", re.DOTALL)
MARKDOWN_OPTIONS_PATTERN = re.compile(
    r"(?ms)^A\.\s*(?P<a>.*?)\s*^B\.\s*(?P<b>.*?)\s*^C\.\s*(?P<c>.*?)\s*"
    r"^D\.\s*(?P<d>.*?)\s*^\*\*Answer:\s*(?P<answer>[A-D])\*\*"
)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_markdown_questions(path: Path, min_question_number: int) -> list[dict[str, str]]:
    questions = []
    blocks = re.split(r"(?m)(?=^\*\*Q\d+\.)", path.read_text(encoding="utf-8"))
    for block in blocks:
        header = MARKDOWN_HEADER_PATTERN.match(block)
        if header is None or int(header.group("number")) <= min_question_number:
            continue
        options = MARKDOWN_OPTIONS_PATTERN.search(header.group("body"))
        if options is None:
            raise RuntimeError(f"could not parse options for question {header.group('number')}")
        question_prefix = header.group("body")[:options.start()]
        question = f"{header.group('heading')}\n{question_prefix}" if question_prefix.strip() else header.group("heading")
        questions.append({"question": clean(question), **{key: clean(value) for key, value in options.groupdict().items()}})
    return questions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", required=True)
    parser.add_argument("--input-file", type=Path)
    parser.add_argument("--markdown-file", type=Path)
    parser.add_argument("--min-question-number", type=int, default=0)
    args = parser.parse_args()
    if args.markdown_file:
        questions = parse_markdown_questions(args.markdown_file, args.min_question_number)
    else:
        questions = json.loads(args.input_file.read_text(encoding="utf-8")) if args.input_file else json.load(sys.stdin)
    required_keys = {"question", "a", "b", "c", "d", "answer"}
    if not questions or any(not required_keys.issubset(question) or question["answer"] not in "ABCD" for question in questions):
        raise SystemExit("input must be a non-empty JSON list of complete four-option questions")

    db = SessionLocal()
    try:
        platinum = db.scalar(select(InternshipProgram).where(InternshipProgram.code == "platinum"))
        quiz = db.scalar(select(Quiz).where(Quiz.program_id == platinum.id, Quiz.title == args.title)) if platinum else None
        if quiz is None:
            raise RuntimeError(f"Platinum quiz not found: {args.title}")

        db.execute(delete(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id))
        quiz.question_bank_size = len(questions)
        quiz.questions_per_attempt = 25
        db.add_all([
            QuizQuestion(
                quiz_id=quiz.id,
                question_text=question["question"],
                option_a=question["a"],
                option_b=question["b"],
                option_c=question["c"],
                option_d=question["d"],
                correct_option=question["answer"],
            )
            for question in questions
        ])
        db.commit()
        count = db.scalar(select(func.count()).select_from(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id))
        print(f"loaded {count} questions into {quiz.title}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
