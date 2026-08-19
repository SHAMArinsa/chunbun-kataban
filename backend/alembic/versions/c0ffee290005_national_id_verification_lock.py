"""Add an admin verification lock for student national IDs.

Revision ID: c0ffee290005
Revises: c0ffee290004
"""
from alembic import op
import sqlalchemy as sa


revision = "c0ffee290005"
down_revision = "c0ffee290004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "students",
        sa.Column("national_id_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("students", "national_id_verified", server_default=None)


def downgrade():
    op.drop_column("students", "national_id_verified")
