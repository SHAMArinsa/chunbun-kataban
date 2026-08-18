"""Add admin-uploaded student invoices and certificates.

Revision ID: c0ffee290004
Revises: c0ffee290003
"""
from alembic import op
import sqlalchemy as sa


revision = "c0ffee290004"
down_revision = "c0ffee290003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "student_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("document_type", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["admins.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_student_documents_student_id", "student_documents", ["student_id"])


def downgrade():
    op.drop_index("ix_student_documents_student_id", table_name="student_documents")
    op.drop_table("student_documents")
