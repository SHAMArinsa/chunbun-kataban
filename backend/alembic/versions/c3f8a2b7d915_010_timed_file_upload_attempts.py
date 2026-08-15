"""010_timed_file_upload_attempts

Revision ID: c3f8a2b7d915
Revises: b2d7e9f1a3c4
Create Date: 2026-08-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f8a2b7d915'
down_revision: Union[str, None] = 'b2d7e9f1a3c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE assignment_submission_status ADD VALUE IF NOT EXISTS 'in_progress'")

    op.add_column('assignment_submissions', sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('assignment_submissions', sa.Column('time_limit_minutes', sa.Integer(), nullable=True))
    op.execute('UPDATE assignment_submissions SET started_at = submitted_at WHERE submitted_at IS NOT NULL')
    op.alter_column('assignment_submissions', 'submitted_at', nullable=True, server_default=None)

    op.create_table(
        'assignment_submission_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_name', sa.String(length=300), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['submission_id'], ['assignment_submissions.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('assignment_submission_files')
    op.alter_column('assignment_submissions', 'submitted_at', nullable=False, server_default=sa.text('now()'))
    op.drop_column('assignment_submissions', 'time_limit_minutes')
    op.drop_column('assignment_submissions', 'started_at')
    # Postgres doesn't support removing an enum value; downgrade leaves 'in_progress' in place.
