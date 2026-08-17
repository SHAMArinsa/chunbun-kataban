"""Add automated welcome certificates.

Revision ID: c0ffee290003
Revises: c0ffee290002
"""
from alembic import op


revision = "c0ffee290003"
down_revision = "c0ffee290002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE certificate_type ADD VALUE IF NOT EXISTS 'welcome'")
    op.alter_column("certificates", "issued_by", existing_type=None, nullable=True)


def downgrade():
    # PostgreSQL enum values cannot be removed safely without recreating the type.
    op.alter_column("certificates", "issued_by", existing_type=None, nullable=False)
