"""015_proctoring_violations

Revision ID: a1b2c3d4e5f6
Revises: a9c3e7f24d18
Create Date: 2026-08-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'a9c3e7f24d18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'proctoring_violations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('enrollment_id', sa.Integer(), nullable=True),
        sa.Column('assessment_type', sa.String(length=30), nullable=True),
        sa.Column('assessment_id', sa.Integer(), nullable=True),
        sa.Column('attempt_id', sa.Integer(), nullable=True),
        sa.Column('resource_id', sa.String(length=100), nullable=True),
        sa.Column('violation_type', sa.String(length=50), nullable=False),
        sa.Column('category', sa.String(length=20), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('route', sa.String(length=300), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('violation_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reviewed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.ForeignKeyConstraint(['enrollment_id'], ['program_enrollments.id']),
        sa.ForeignKeyConstraint(['reviewed_by'], ['admins.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_proctoring_violations_student_id', 'proctoring_violations', ['student_id'])
    op.create_index('ix_proctoring_violations_created_at', 'proctoring_violations', ['created_at'])
    op.create_index(
        'ix_proctoring_violations_dedupe',
        'proctoring_violations',
        ['student_id', 'violation_type', 'assessment_type', 'assessment_id', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_proctoring_violations_dedupe', table_name='proctoring_violations')
    op.drop_index('ix_proctoring_violations_created_at', table_name='proctoring_violations')
    op.drop_index('ix_proctoring_violations_student_id', table_name='proctoring_violations')
    op.drop_table('proctoring_violations')
