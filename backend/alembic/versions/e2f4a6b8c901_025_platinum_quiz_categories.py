"""025_platinum_quiz_categories

Revision ID: e2f4a6b8c901
Revises: d1a3b7c5e926
Create Date: 2026-08-12 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e2f4a6b8c901"
down_revision: Union[str, None] = "d1a3b7c5e926"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("category", sa.String(length=30), nullable=True))
    op.create_index("ix_quizzes_category", "quizzes", ["category"], unique=True)
    # Preserve the existing six Platinum quiz rows and correct their policy in place.
    op.execute("""
        UPDATE quizzes q
        SET category = CASE d.name
            WHEN 'python' THEN 'python'
            WHEN 'web_dev' THEN 'web_dev'
            WHEN 'database' THEN 'database'
            WHEN 'ai' THEN 'ai'
            WHEN 'genai' THEN 'genai'
            WHEN 'software_engineering' THEN 'se'
        END,
        questions_per_attempt = 50,
        passing_percent = 80,
        max_attempts = 5,
        attempts_per_day = 1
        FROM internship_programs p, program_domains d
        WHERE q.program_id = p.id
          AND q.domain_id = d.id
          AND p.code = 'platinum'
          AND d.name IN ('python', 'web_dev', 'database', 'ai', 'genai', 'software_engineering')
    """)


def downgrade() -> None:
    op.drop_index("ix_quizzes_category", table_name="quizzes")
    op.drop_column("quizzes", "category")
