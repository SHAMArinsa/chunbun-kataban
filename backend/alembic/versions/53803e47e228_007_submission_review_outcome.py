"""007_submission_review_outcome

Revision ID: 53803e47e228
Revises: fde335244c70
Create Date: 2026-08-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '53803e47e228'
down_revision: Union[str, None] = 'fde335244c70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    review_outcome = sa.Enum('closed', 'retake', name='submission_review_outcome')
    review_outcome.create(op.get_bind())
    op.add_column('assignment_submissions', sa.Column('admin_marked_status', review_outcome, nullable=True))


def downgrade() -> None:
    op.drop_column('assignment_submissions', 'admin_marked_status')
    sa.Enum(name='submission_review_outcome').drop(op.get_bind())
