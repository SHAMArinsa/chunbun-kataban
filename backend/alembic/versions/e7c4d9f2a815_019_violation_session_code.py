"""019_violation_session_code

Revision ID: e7c4d9f2a815
Revises: d3a5b8c1e7f2
Create Date: 2026-08-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7c4d9f2a815'
down_revision: Union[str, None] = 'd3a5b8c1e7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('proctoring_violations', sa.Column('session_code', sa.String(length=16), nullable=True))
    op.create_index('ix_proctoring_violations_session_code', 'proctoring_violations', ['session_code'])


def downgrade() -> None:
    op.drop_index('ix_proctoring_violations_session_code', table_name='proctoring_violations')
    op.drop_column('proctoring_violations', 'session_code')
