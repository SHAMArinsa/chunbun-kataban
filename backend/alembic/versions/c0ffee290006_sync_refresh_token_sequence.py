"""Synchronize the refresh-token ID sequence with existing rows.

Revision ID: c0ffee290006
Revises: c0ffee290005
"""
from alembic import op


revision = "c0ffee290006"
down_revision = "c0ffee290005"
branch_labels = None
depends_on = None


def upgrade():
    # A restored/imported PostgreSQL database can retain rows while its serial
    # sequence remains behind. Advance it beyond the highest persisted ID.
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('refresh_tokens', 'id'),
            COALESCE((SELECT MAX(id) FROM refresh_tokens), 1),
            true
        )
        """
    )


def downgrade():
    pass
