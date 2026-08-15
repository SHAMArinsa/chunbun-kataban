"""022_national_id_front_back

Revision ID: b8d1e5a3c942
Revises: a4e9f2c7b316
Create Date: 2026-08-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8d1e5a3c942'
down_revision: Union[str, None] = 'a4e9f2c7b316'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('students', 'national_id_document_name')
    op.drop_column('students', 'national_id_document_path')
    op.add_column('students', sa.Column('national_id_document_front_path', sa.String(length=500), nullable=True))
    op.add_column('students', sa.Column('national_id_document_front_name', sa.String(length=300), nullable=True))
    op.add_column('students', sa.Column('national_id_document_back_path', sa.String(length=500), nullable=True))
    op.add_column('students', sa.Column('national_id_document_back_name', sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column('students', 'national_id_document_back_name')
    op.drop_column('students', 'national_id_document_back_path')
    op.drop_column('students', 'national_id_document_front_name')
    op.drop_column('students', 'national_id_document_front_path')
    op.add_column('students', sa.Column('national_id_document_path', sa.String(length=500), nullable=True))
    op.add_column('students', sa.Column('national_id_document_name', sa.String(length=300), nullable=True))
