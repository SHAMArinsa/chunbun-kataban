"""009_sheet_due_date_duration

Revision ID: b2d7e9f1a3c4
Revises: a1c9d4e6f210
Create Date: 2026-08-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2d7e9f1a3c4'
down_revision: Union[str, None] = 'a1c9d4e6f210'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('coding_problem_sheets', sa.Column('due_date', sa.Date(), nullable=True))
    op.add_column('coding_problem_sheets', sa.Column('duration_minutes', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('coding_problem_sheets', 'duration_minutes')
    op.drop_column('coding_problem_sheets', 'due_date')
