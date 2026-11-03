"""Study materials: allow PowerPoint/Word/Excel/text files and uploaded videos.

Revision ID: c0ffee290012
Revises: c0ffee290011
"""
from alembic import op

revision = "c0ffee290012"
down_revision = "c0ffee290011"
branch_labels = None
depends_on = None

NEW = ("xlsx", "xls", "txt", "rar", "pptx", "ppt", "doc", "mp4", "webm", "mov", "m4v")


def upgrade() -> None:
    for value in NEW:
        op.execute(f"ALTER TYPE material_file_type ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # PostgreSQL cannot drop enum values; the extra values are harmless to older code.
    pass
