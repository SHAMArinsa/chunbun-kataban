"""Add time-limited offer pricing to internship programs.

Revision ID: c0ffee290001
Revises: b9c1d3e5f708
"""
from alembic import op
import sqlalchemy as sa


revision = "c0ffee290001"
down_revision = "b9c1d3e5f708"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("internship_programs", sa.Column("offer_price_inr", sa.Numeric(10, 2), nullable=True))
    op.add_column("internship_programs", sa.Column("offer_price_usd", sa.Numeric(10, 2), nullable=True))
    op.add_column("internship_programs", sa.Column("offer_start_date", sa.Date(), nullable=True))
    op.add_column("internship_programs", sa.Column("offer_end_date", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("internship_programs", "offer_end_date")
    op.drop_column("internship_programs", "offer_start_date")
    op.drop_column("internship_programs", "offer_price_usd")
    op.drop_column("internship_programs", "offer_price_inr")
