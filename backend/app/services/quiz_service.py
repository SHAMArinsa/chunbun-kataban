import random
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.assessment import Quiz, QuizAttempt, QuizAttemptAnswer, QuizQuestion, QuizQuestionSheet, QuizSheetAssignment


def check_attempt_eligibility(db: Session, quiz: Quiz, student_id: int) -> int:
    """Raise 400 when the total or daily attempt limit has been reached."""
    total_attempts = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz.id, QuizAttempt.student_id == student_id).count()
    if total_attempts >= quiz.max_attempts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Maximum attempts ({quiz.max_attempts}) reached for this quiz")

    today_attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz.id, QuizAttempt.student_id == student_id, QuizAttempt.attempt_date == date.today())
        .count()
    )
    if today_attempts >= quiz.attempts_per_day:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Daily attempt limit ({quiz.attempts_per_day}) reached for this quiz. Try again tomorrow.")
    return total_attempts + 1


def select_random_questions(db: Session, quiz: Quiz, student_id: int) -> list[QuizQuestion]:
    """Select a randomized attempt from the eligible question bank.

    Platinum category quizzes use shared category banks. A sheet is only an admin upload batch
    for those quizzes, so every eligible Platinum student can draw from it. Other sheet-based
    quizzes retain their existing per-student assignment behavior.
    """
    if quiz.category:
        all_questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).all()
    else:
        has_sheets = db.query(QuizQuestionSheet.id).filter(QuizQuestionSheet.quiz_id == quiz.id).first() is not None
        if has_sheets:
            assigned_sheet_ids = [
                row.sheet_id
                for row in db.query(QuizSheetAssignment.sheet_id)
                .join(QuizQuestionSheet, QuizQuestionSheet.id == QuizSheetAssignment.sheet_id)
                .filter(QuizQuestionSheet.quiz_id == quiz.id, QuizSheetAssignment.student_id == student_id)
            ]
            if not assigned_sheet_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions have been assigned to you yet for this quiz. Contact your administrator.")
            all_questions = db.query(QuizQuestion).filter(QuizQuestion.sheet_id.in_(assigned_sheet_ids)).all()
        else:
            all_questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).all()

    if not all_questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This quiz has no questions yet")
    if len(all_questions) < quiz.questions_per_attempt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This quiz needs {quiz.questions_per_attempt} questions before it can start; only {len(all_questions)} have been uploaded.",
        )
    return random.sample(all_questions, quiz.questions_per_attempt)


def grade_attempt(db: Session, attempt: QuizAttempt, quiz: Quiz, answers: dict[int, str]) -> None:
    attempt_questions = db.query(QuizAttemptAnswer).filter(QuizAttemptAnswer.attempt_id == attempt.id).all()
    correct_count = 0
    for attempt_answer in attempt_questions:
        question = db.get(QuizQuestion, attempt_answer.question_id)
        selected = answers.get(attempt_answer.question_id)
        attempt_answer.selected_option = selected
        attempt_answer.is_correct = selected is not None and selected == question.correct_option
        attempt_answer.answered_at = datetime.now(timezone.utc)
        if attempt_answer.is_correct:
            correct_count += 1
        db.add(attempt_answer)

    total = len(attempt_questions)
    score_percent = (correct_count / total * 100) if total else 0
    attempt.correct_answers = correct_count
    attempt.score_percent = round(score_percent, 2)
    attempt.passed = score_percent >= float(quiz.passing_percent)
    attempt.status = "submitted"
    attempt.submitted_at = datetime.now(timezone.utc)
    db.add(attempt)
