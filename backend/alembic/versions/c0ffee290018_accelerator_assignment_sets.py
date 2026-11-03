"""Career Accelerator: multiple sets of the 22 assignments; each student gets one set.

Revision ID: c0ffee290018
Revises: c0ffee290017
"""
import sqlalchemy as sa
from alembic import op

revision = "c0ffee290018"
down_revision = "c0ffee290017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("set_number", sa.Integer, nullable=True))
    op.add_column("program_enrollments", sa.Column("assignment_set", sa.Integer, nullable=True))
    # Assignments created before sets existed become Set 1.
    op.execute("UPDATE projects SET set_number = 1 WHERE work_type = 'accelerator_assignment' AND set_number IS NULL")


def downgrade() -> None:
    op.drop_column("program_enrollments", "assignment_set")
    op.drop_column("projects", "set_number")
