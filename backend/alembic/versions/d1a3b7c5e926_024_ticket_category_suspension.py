"""024_ticket_category_suspension

Revision ID: d1a3b7c5e926
Revises: c9e2f6a4d158
Create Date: 2026-08-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd1a3b7c5e926'
down_revision: Union[str, None] = 'c9e2f6a4d158'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'suspension'")


def downgrade() -> None:
    # Postgres does not support removing enum values; this migration is not reversible.
    pass
