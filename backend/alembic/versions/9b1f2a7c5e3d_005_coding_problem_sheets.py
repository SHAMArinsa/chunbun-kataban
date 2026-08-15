"""005_coding_problem_sheets

Revision ID: 9b1f2a7c5e3d
Revises: 3e93fc0c41a9
Create Date: 2026-08-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b1f2a7c5e3d'
down_revision: Union[str, None] = '3e93fc0c41a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('coding_problem_sheets',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('coding_assignment_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('uploaded_by', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['coding_assignment_id'], ['coding_assignments.id'], ),
    sa.ForeignKeyConstraint(['uploaded_by'], ['admins.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('coding_sheet_assignments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('sheet_id', sa.Integer(), nullable=False),
    sa.Column('student_id', sa.Integer(), nullable=False),
    sa.Column('assigned_by', sa.Integer(), nullable=False),
    sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['assigned_by'], ['admins.id'], ),
    sa.ForeignKeyConstraint(['sheet_id'], ['coding_problem_sheets.id'], ),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_coding_sheet_assignments_sheet_student', 'coding_sheet_assignments', ['sheet_id', 'student_id'], unique=True)
    op.add_column('coding_problems', sa.Column('sheet_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'coding_problems', 'coding_problem_sheets', ['sheet_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'coding_problems', type_='foreignkey')
    op.drop_column('coding_problems', 'sheet_id')
    op.drop_index('ix_coding_sheet_assignments_sheet_student', table_name='coding_sheet_assignments')
    op.drop_table('coding_sheet_assignments')
    op.drop_table('coding_problem_sheets')
