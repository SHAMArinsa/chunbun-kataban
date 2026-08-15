"""Add per-student coding supporting files."""
from alembic import op
import sqlalchemy as sa

revision = "b9c1d3e5f708"
down_revision = "a4c6e8f0b123"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "coding_student_resources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coding_assignment_id", sa.Integer(), sa.ForeignKey("coding_assignments.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=300), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("admins.id"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_coding_student_resources_assignment_student", "coding_student_resources", ["coding_assignment_id", "student_id"], unique=True)

def downgrade():
    op.drop_index("ix_coding_student_resources_assignment_student", table_name="coding_student_resources")
    op.drop_table("coding_student_resources")
