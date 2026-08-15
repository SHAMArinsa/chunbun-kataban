"""016_project_instructions_file_name

Revision ID: b7e1f9a2c4d6
Revises: a1b2c3d4e5f6
Create Date: 2026-08-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e1f9a2c4d6'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('instructions_file_name', sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'instructions_file_name')
