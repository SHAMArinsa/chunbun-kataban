"""Add unique eight-digit public student identifiers.

Revision ID: c0ffee290008
Revises: c0ffee290007
"""
from alembic import op
import sqlalchemy as sa


revision = "c0ffee290008"
down_revision = "c0ffee290007"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE FUNCTION generate_student_number() RETURNS varchar AS $$
        DECLARE candidate varchar(8);
        BEGIN
            LOOP
                candidate := floor(10000000 + random() * 90000000)::bigint::varchar;
                EXIT WHEN NOT EXISTS (SELECT 1 FROM students WHERE student_number = candidate);
            END LOOP;
            RETURN candidate;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.add_column("students", sa.Column("student_number", sa.String(length=8), nullable=True))
    op.execute("UPDATE students SET student_number = generate_student_number() WHERE student_number IS NULL")
    op.alter_column("students", "student_number", nullable=False, server_default=sa.text("generate_student_number()"))
    op.create_unique_constraint("uq_students_student_number", "students", ["student_number"])


def downgrade():
    op.drop_constraint("uq_students_student_number", "students", type_="unique")
    op.drop_column("students", "student_number")
    op.execute("DROP FUNCTION IF EXISTS generate_student_number()")
