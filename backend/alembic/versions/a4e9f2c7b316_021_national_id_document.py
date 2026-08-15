"""021_national_id_document

Revision ID: a4e9f2c7b316
Revises: f1b3c6d8e024
Create Date: 2026-08-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4e9f2c7b316'
down_revision: Union[str, None] = 'f1b3c6d8e024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('students', 'national_id_type', type_=sa.String(length=50))
    op.add_column('students', sa.Column('national_id_document_path', sa.String(length=500), nullable=True))
    op.add_column('students', sa.Column('national_id_document_name', sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column('students', 'national_id_document_name')
    op.drop_column('students', 'national_id_document_path')
    op.alter_column('students', 'national_id_type', type_=sa.String(length=20))
