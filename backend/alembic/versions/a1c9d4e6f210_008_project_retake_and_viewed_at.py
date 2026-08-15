"""008_project_retake_and_viewed_at

Revision ID: a1c9d4e6f210
Revises: 53803e47e228
Create Date: 2026-08-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c9d4e6f210'
down_revision: Union[str, None] = '53803e47e228'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('assignment_submissions', sa.Column('admin_viewed_at', sa.DateTime(timezone=True), nullable=True))

    project_review_outcome = sa.Enum('closed', 'retake', name='project_review_outcome')
    project_review_outcome.create(op.get_bind())
    op.add_column('project_submissions', sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('project_submissions', sa.Column('admin_marked_status', project_review_outcome, nullable=True))
    op.add_column('project_submissions', sa.Column('admin_viewed_at', sa.DateTime(timezone=True), nullable=True))
    op.alter_column('project_submissions', 'attempt_number', server_default=None)


def downgrade() -> None:
    op.drop_column('project_submissions', 'admin_viewed_at')
    op.drop_column('project_submissions', 'admin_marked_status')
    op.drop_column('project_submissions', 'attempt_number')
    sa.Enum(name='project_review_outcome').drop(op.get_bind())
    op.drop_column('assignment_submissions', 'admin_viewed_at')
