"""Video curriculum: Module > Chapter > Video, video running time, and watched tracking.

Revision ID: c0ffee290013
Revises: c0ffee290012
"""
import sqlalchemy as sa
from alembic import op

revision = "c0ffee290013"
down_revision = "c0ffee290012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "course_modules",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("program_id", sa.Integer, sa.ForeignKey("internship_programs.id"), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("display_order", sa.Integer, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "course_chapters",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("module_id", sa.Integer, sa.ForeignKey("course_modules.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("display_order", sa.Integer, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.add_column("learning_materials", sa.Column("chapter_id", sa.Integer,
                                                  sa.ForeignKey("course_chapters.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_learning_materials_chapter_id", "learning_materials", ["chapter_id"])
    op.add_column("learning_materials", sa.Column("duration_minutes", sa.Integer, nullable=True))
    op.create_table(
        "material_views",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("material_id", sa.Integer, sa.ForeignKey("learning_materials.id", ondelete="CASCADE"), nullable=False),
        sa.Column("first_viewed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("student_id", "material_id", name="uq_material_view"),
    )


def downgrade() -> None:
    op.drop_table("material_views")
    op.drop_index("ix_learning_materials_chapter_id", table_name="learning_materials")
    op.drop_column("learning_materials", "duration_minutes")
    op.drop_column("learning_materials", "chapter_id")
    op.drop_table("course_chapters")
    op.drop_table("course_modules")
