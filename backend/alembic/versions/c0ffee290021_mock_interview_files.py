"""mock_interview_files: feedback attachments for mock interviews"""
import sqlalchemy as sa
from alembic import op

revision = "c0ffee290021"
down_revision = "c0ffee290020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mock_interview_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mock_interview_id", sa.Integer(), sa.ForeignKey("mock_interviews.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(300), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_mock_interview_files_mock_interview_id", "mock_interview_files", ["mock_interview_id"])


def downgrade() -> None:
    op.drop_index("ix_mock_interview_files_mock_interview_id", table_name="mock_interview_files")
    op.drop_table("mock_interview_files")
