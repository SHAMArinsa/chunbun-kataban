"""018_watermark_sessions

Revision ID: d3a5b8c1e7f2
Revises: c8f2a4e6d901
Create Date: 2026-08-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3a5b8c1e7f2'
down_revision: Union[str, None] = 'c8f2a4e6d901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'watermark_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_code', sa.String(length=16), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('enrollment_id', sa.Integer(), nullable=True),
        sa.Column('assessment_type', sa.String(length=30), nullable=True),
        sa.Column('assessment_id', sa.Integer(), nullable=True),
        sa.Column('resource_id', sa.String(length=100), nullable=True),
        sa.Column('route', sa.String(length=300), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.ForeignKeyConstraint(['enrollment_id'], ['program_enrollments.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_watermark_sessions_session_code', 'watermark_sessions', ['session_code'], unique=True)
    op.create_index('ix_watermark_sessions_student_id', 'watermark_sessions', ['student_id'])


def downgrade() -> None:
    op.drop_index('ix_watermark_sessions_student_id', table_name='watermark_sessions')
    op.drop_index('ix_watermark_sessions_session_code', table_name='watermark_sessions')
    op.drop_table('watermark_sessions')
