"""014_coding_sheet_source_file

Revision ID: a9c3e7f24d18
Revises: f7a2d8e6c193
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9c3e7f24d18'
down_revision: Union[str, None] = 'f7a2d8e6c193'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('coding_problem_sheets', sa.Column('source_file_path', sa.String(length=500), nullable=True))
    op.add_column('coding_problem_sheets', sa.Column('source_file_name', sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column('coding_problem_sheets', 'source_file_name')
    op.drop_column('coding_problem_sheets', 'source_file_path')
