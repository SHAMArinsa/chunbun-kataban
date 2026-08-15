"""Remove the original 10 seeded placeholder MCQs from every Platinum question bank.

Any attempt that becomes empty after placeholder answers are removed is discarded as test data.
For a partially affected submitted attempt, its persisted score is recalculated from remaining
answers so its aggregate fields remain truthful.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.assessment import Quiz, QuizAttempt, QuizAttemptAnswer, QuizQuestion

DUMMY_QUESTIONS = {
    "What does CRUD stand for in software development?",
    "Which HTTP method is idempotent and used to update a resource fully?",
    "In PostgreSQL, which clause filters rows after GROUP BY aggregation?",
    "Which Python keyword defines a generator function?",
    "What is the primary purpose of a JWT refresh token?",
    "Which React hook is used to memoize an expensive computation?",
    "What does REST stand for?",
    "Which SQL constraint ensures a column's values are unique across a table?",
    "Which HTTP status code indicates a successful resource creation?",
    "In FastAPI, which library is used for request/response data validation?",
}
PLATINUM_CATEGORIES = ("python", "web_dev", "database", "ai", "ovr1", "ovr2")


def main() -> None:
    db = SessionLocal()
    try:
        quizzes = db.query(Quiz).filter(Quiz.category.in_(PLATINUM_CATEGORIES)).all()
        quiz_ids = [quiz.id for quiz in quizzes]
        dummy_rows = db.query(QuizQuestion).filter(QuizQuestion.quiz_id.in_(quiz_ids), QuizQuestion.question_text.in_(DUMMY_QUESTIONS)).all()
        dummy_ids = [question.id for question in dummy_rows]
        affected_attempt_ids = [
            attempt_id
            for (attempt_id,) in db.query(QuizAttemptAnswer.attempt_id)
            .filter(QuizAttemptAnswer.question_id.in_(dummy_ids))
            .distinct()
        ]

        db.query(QuizAttemptAnswer).filter(QuizAttemptAnswer.question_id.in_(dummy_ids)).delete(synchronize_session=False)
        db.query(QuizQuestion).filter(QuizQuestion.id.in_(dummy_ids)).delete(synchronize_session=False)
        db.flush()

        deleted_attempts = 0
        for attempt_id in affected_attempt_ids:
            attempt = db.get(QuizAttempt, attempt_id)
            if attempt is None:
                continue
            answers = db.query(QuizAttemptAnswer).filter_by(attempt_id=attempt.id).all()
            if not answers:
                db.delete(attempt)
                deleted_attempts += 1
                continue
            total = len(answers)
            correct = sum(bool(answer.is_correct) for answer in answers)
            attempt.total_questions = total
            if attempt.status in ("submitted", "auto_submitted"):
                quiz = db.get(Quiz, attempt.quiz_id)
                score = round(correct / total * 100, 2)
                attempt.correct_answers = correct
                attempt.score_percent = score
                attempt.passed = score >= float(quiz.passing_percent)
            db.add(attempt)

        db.commit()
        print(f"Removed {len(dummy_rows)} dummy questions and {deleted_attempts} empty test attempts.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
