"""006_project_student_resources

Revision ID: fde335244c70
Revises: 9b1f2a7c5e3d
Create Date: 2026-08-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fde335244c70'
down_revision: Union[str, None] = '9b1f2a7c5e3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('project_student_resources',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('student_id', sa.Integer(), nullable=False),
    sa.Column('file_path', sa.String(length=500), nullable=False),
    sa.Column('file_name', sa.String(length=300), nullable=False),
    sa.Column('file_size_bytes', sa.Integer(), nullable=False),
    sa.Column('uploaded_by', sa.Integer(), nullable=False),
    sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.ForeignKeyConstraint(['uploaded_by'], ['admins.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_project_student_resources_project_student', 'project_student_resources', ['project_id', 'student_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_project_student_resources_project_student', table_name='project_student_resources')
    op.drop_table('project_student_resources')
