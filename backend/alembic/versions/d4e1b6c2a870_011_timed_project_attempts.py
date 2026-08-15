"""011_timed_project_attempts

Revision ID: d4e1b6c2a870
Revises: c3f8a2b7d915
Create Date: 2026-08-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e1b6c2a870'
down_revision: Union[str, None] = 'c3f8a2b7d915'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE project_submission_status ADD VALUE IF NOT EXISTS 'in_progress'")

    op.add_column('project_submissions', sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('project_submissions', sa.Column('time_limit_minutes', sa.Integer(), nullable=True))
    op.execute('UPDATE project_submissions SET started_at = submitted_at WHERE submitted_at IS NOT NULL')
    op.alter_column('project_submissions', 'submitted_at', nullable=True, server_default=None)


def downgrade() -> None:
    op.alter_column('project_submissions', 'submitted_at', nullable=False, server_default=sa.text('now()'))
    op.drop_column('project_submissions', 'time_limit_minutes')
    op.drop_column('project_submissions', 'started_at')
    # Postgres doesn't support removing an enum value; downgrade leaves 'in_progress' in place.
