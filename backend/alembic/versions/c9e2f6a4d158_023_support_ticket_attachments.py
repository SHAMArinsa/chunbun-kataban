"""023_support_ticket_attachments

Revision ID: c9e2f6a4d158
Revises: b8d1e5a3c942
Create Date: 2026-08-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9e2f6a4d158'
down_revision: Union[str, None] = 'b8d1e5a3c942'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('support_tickets', sa.Column('attachment_path', sa.String(length=500), nullable=True))
    op.add_column('support_tickets', sa.Column('attachment_name', sa.String(length=300), nullable=True))
    op.add_column('ticket_replies', sa.Column('attachment_name', sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column('ticket_replies', 'attachment_name')
    op.drop_column('support_tickets', 'attachment_name')
    op.drop_column('support_tickets', 'attachment_path')
