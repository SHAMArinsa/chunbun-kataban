"""017_enrollment_suspension_reason

Revision ID: c8f2a4e6d901
Revises: b7e1f9a2c4d6
Create Date: 2026-08-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f2a4e6d901'
down_revision: Union[str, None] = 'b7e1f9a2c4d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('program_enrollments', sa.Column('suspension_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('program_enrollments', 'suspension_reason')
