"""013_email_otps

Revision ID: f7a2d8e6c193
Revises: e5f9c1a4b632
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a2d8e6c193'
down_revision: Union[str, None] = 'e5f9c1a4b632'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'email_otps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('code_hash', sa.String(length=255), nullable=False),
        sa.Column('purpose', sa.String(length=30), nullable=False, server_default='signup'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_email_otps_email', 'email_otps', ['email'])


def downgrade() -> None:
    op.drop_index('ix_email_otps_email', table_name='email_otps')
    op.drop_table('email_otps')
