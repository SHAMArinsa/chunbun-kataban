"""Project options: separate Instructions PDF next to the Project details PDF.

Revision ID: c0ffee290014
Revises: c0ffee290013
"""
import sqlalchemy as sa
from alembic import op

revision = "c0ffee290014"
down_revision = "c0ffee290013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("guide_file_path", sa.String(500), nullable=True))
    op.add_column("projects", sa.Column("guide_file_name", sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "guide_file_name")
    op.drop_column("projects", "guide_file_path")
