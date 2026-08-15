"""027_uppercase_platinum_quiz_titles

Revision ID: a4c6e8f0b123
Revises: f3a5b7c9d012
Create Date: 2026-08-12 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = "a4c6e8f0b123"
down_revision: Union[str, None] = "f3a5b7c9d012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE quizzes SET title = UPPER(title) WHERE category IN ('python', 'web_dev', 'database', 'ai', 'ovr1', 'ovr2')")


def downgrade() -> None:
    pass
