"""Build equally sized, de-duplicated Overall Platinum question banks.

The four source categories remain untouched. Existing Overall 1 questions referenced by a past
attempt are retained, so historical grades stay valid; all other questions are copied from the
unique source pool with a deterministic split.
"""
import hashlib
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.assessment import Quiz, QuizAttemptAnswer, QuizQuestion, QuizQuestionSheet

SOURCE_CATEGORIES = ("ai", "database", "python", "web_dev")
TARGET_CATEGORIES = ("ovr1", "ovr2")


def fingerprint(question: QuizQuestion) -> str:
    def normalize(value: str | None) -> str:
        return re.sub(r"\s+", " ", (value or "").strip()).casefold()

    fields = ("question_text", "option_a", "option_b", "option_c", "option_d", "correct_option")
    payload = "\x1f".join(normalize(getattr(question, field)) for field in fields)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def copy_question(question: QuizQuestion, quiz_id: int, sheet_id: int) -> QuizQuestion:
    return QuizQuestion(
        quiz_id=quiz_id,
        sheet_id=sheet_id,
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
        quizzes = {quiz.category: quiz for quiz in db.query(Quiz).filter(Quiz.category.in_(SOURCE_CATEGORIES + TARGET_CATEGORIES)).all()}
        if set(quizzes) != set(SOURCE_CATEGORIES + TARGET_CATEGORIES):
            raise RuntimeError("One or more required quiz categories are missing")

        # De-duplicate the combined source pool. Sorting by fingerprint keeps the distribution
        # reproducible rather than depending on database row order.
        source_by_fingerprint: dict[str, QuizQuestion] = {}
        for category in SOURCE_CATEGORIES:
            for question in db.query(QuizQuestion).filter_by(quiz_id=quizzes[category].id).all():
                source_by_fingerprint.setdefault(fingerprint(question), question)

        retained_ovr1 = [
            question
            for question in db.query(QuizQuestion).filter_by(quiz_id=quizzes["ovr1"].id).all()
            if db.query(QuizAttemptAnswer.id).filter_by(question_id=question.id).first() is not None
        ]
        retained_keys = {fingerprint(question) for question in retained_ovr1}
        if len(retained_keys) != len(retained_ovr1):
            raise RuntimeError("Existing attempted Overall 1 questions contain a duplicate")

        # Remove unattempted target rows. Attempted Overall 1 rows cannot be deleted because
        # their answer references form part of immutable attempt history.
        for category in TARGET_CATEGORIES:
            target = quizzes[category]
            for question in db.query(QuizQuestion).filter_by(quiz_id=target.id).all():
                if category == "ovr1" and question.id in {item.id for item in retained_ovr1}:
                    continue
                db.delete(question)
        db.flush()

        pool = [(key, question) for key, question in source_by_fingerprint.items() if key not in retained_keys]
        total_unique = len(source_by_fingerprint)
        first_target_size = total_unique // 2
        second_target_size = total_unique - first_target_size
        needed_ovr1 = first_target_size - len(retained_ovr1)
        if needed_ovr1 < 0:
            raise RuntimeError("More attempted Overall 1 questions exist than the equal split allows")

        # Separate sheet records make these generated overall banks easy to audit in Admin.
        sheets = {}
        for category, title in (("ovr1", "Overall 1 shared bank"), ("ovr2", "Overall 2 shared bank")):
            sheet = QuizQuestionSheet(quiz_id=quizzes[category].id, title=title, uploaded_by=quizzes[category].created_by)
            db.add(sheet)
            db.flush()
            sheets[category] = sheet

        for _, question in pool[:needed_ovr1]:
            db.add(copy_question(question, quizzes["ovr1"].id, sheets["ovr1"].id))
        for _, question in pool[needed_ovr1:]:
            db.add(copy_question(question, quizzes["ovr2"].id, sheets["ovr2"].id))
        db.commit()
        print(f"Built Overall 1: {first_target_size} unique questions; Overall 2: {second_target_size} unique questions.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
