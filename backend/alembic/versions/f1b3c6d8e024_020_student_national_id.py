"""020_student_national_id

Revision ID: f1b3c6d8e024
Revises: e7c4d9f2a815
Create Date: 2026-08-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1b3c6d8e024'
down_revision: Union[str, None] = 'e7c4d9f2a815'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('students', sa.Column('national_id_type', sa.String(length=20), nullable=True))
    op.add_column('students', sa.Column('national_id_number', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('students', 'national_id_number')
    op.drop_column('students', 'national_id_type')
