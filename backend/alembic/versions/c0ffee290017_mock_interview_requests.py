"""Mock interview requests: 5 preferred timings per slot from the student.

Revision ID: c0ffee290017
Revises: c0ffee290016
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "c0ffee290017"
down_revision = "c0ffee290016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mock_interview_requests",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("enrollment_id", sa.Integer, sa.ForeignKey("program_enrollments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("interview_number", sa.Integer, nullable=False),
        sa.Column("preferred_times", JSONB, nullable=False),
        sa.Column("note", sa.Text),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("enrollment_id", "interview_number", name="uq_mock_request_slot"),
        sa.CheckConstraint("status in ('pending','scheduled','cancelled')", name="ck_mock_request_status"),
    )


def downgrade() -> None:
    op.drop_table("mock_interview_requests")
