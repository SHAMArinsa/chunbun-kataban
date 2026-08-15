"""012_admin_super_admin_flag

Revision ID: e5f9c1a4b632
Revises: d4e1b6c2a870
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f9c1a4b632'
down_revision: Union[str, None] = 'd4e1b6c2a870'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('admins', sa.Column('is_super_admin', sa.Boolean(), nullable=False, server_default=sa.false()))
    # Bootstrap: promote the earliest-created admin so the system always has at least one
    # super admin able to manage other admin accounts.
    op.execute("""
        UPDATE admins SET is_super_admin = true
        WHERE id = (SELECT id FROM admins ORDER BY id ASC LIMIT 1)
    """)


def downgrade() -> None:
    op.drop_column('admins', 'is_super_admin')
