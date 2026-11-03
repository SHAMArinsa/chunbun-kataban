"""Detailed Internship Information Form (Advanced & Career): structured answers.

Revision ID: c0ffee290016
Revises: c0ffee290015
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "c0ffee290016"
down_revision = "c0ffee290015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("internship_forms", sa.Column("details", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("internship_forms", "details")
