"""026_rename_platinum_quiz_categories

Revision ID: f3a5b7c9d012
Revises: e2f4a6b8c901
Create Date: 2026-08-12 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = "f3a5b7c9d012"
down_revision: Union[str, None] = "e2f4a6b8c901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE quizzes
        SET title = 'Platinum Program MCQ Assessment - ai & genai', category = 'ai'
        WHERE category = 'ai'
    """)
    op.execute("""
        UPDATE quizzes
        SET title = 'Platinum Program MCQ Assessment - Overall 1', category = 'ovr1'
        WHERE category = 'genai'
    """)
    op.execute("""
        UPDATE quizzes
        SET title = 'Platinum Program MCQ Assessment - Overall 2', category = 'ovr2'
        WHERE category = 'se'
    """)


def downgrade() -> None:
    op.execute("UPDATE quizzes SET title = 'Platinum Program MCQ Assessment - ai', category = 'ai' WHERE category = 'ai'")
    op.execute("UPDATE quizzes SET title = 'Platinum Program MCQ Assessment - genai', category = 'genai' WHERE category = 'ovr1'")
    op.execute("UPDATE quizzes SET title = 'Platinum Program MCQ Assessment - software_engineering', category = 'se' WHERE category = 'ovr2'")
