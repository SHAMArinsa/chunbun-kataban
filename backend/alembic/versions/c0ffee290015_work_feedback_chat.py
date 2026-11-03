"""Chat-style feedback (text + image) on project work.

Revision ID: c0ffee290015
Revises: c0ffee290014
"""
import sqlalchemy as sa
from alembic import op

revision = "c0ffee290015"
down_revision = "c0ffee290014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_feedback_messages",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("enrollment_id", sa.Integer, sa.ForeignKey("program_enrollments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("submission_id", sa.Integer, sa.ForeignKey("project_submissions.id", ondelete="SET NULL")),
        sa.Column("sender_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("sender_role", sa.String(10), nullable=False),
        sa.Column("body", sa.Text),
        sa.Column("image_path", sa.String(500)),
        sa.Column("image_name", sa.String(300)),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("sender_role in ('staff','student')", name="ck_work_feedback_role"),
        sa.CheckConstraint("body is not null or image_path is not null", name="ck_work_feedback_content"),
    )
    op.create_index("ix_work_feedback_thread", "work_feedback_messages", ["enrollment_id", "project_id"])


def downgrade() -> None:
    op.drop_index("ix_work_feedback_thread", "work_feedback_messages")
    op.drop_table("work_feedback_messages")
