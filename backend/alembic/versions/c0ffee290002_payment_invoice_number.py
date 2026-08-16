"""Add persistent random invoice numbers to payments.

Revision ID: c0ffee290002
Revises: c0ffee290001
"""
from alembic import op
import sqlalchemy as sa


revision = "c0ffee290002"
down_revision = "c0ffee290001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("payments", sa.Column("invoice_number", sa.String(length=16), nullable=True))
    op.create_unique_constraint("uq_payments_invoice_number", "payments", ["invoice_number"])


def downgrade():
    op.drop_constraint("uq_payments_invoice_number", "payments", type_="unique")
    op.drop_column("payments", "invoice_number")
