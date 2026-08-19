"""Synchronize all PostgreSQL ID sequences with existing rows.

Revision ID: c0ffee290007
Revises: c0ffee290006
"""
from alembic import op


revision = "c0ffee290007"
down_revision = "c0ffee290006"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        DO $$
        DECLARE sequence_record RECORD;
        BEGIN
            FOR sequence_record IN
                SELECT
                    pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name,
                    table_schema,
                    table_name,
                    column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND column_name = 'id'
            LOOP
                IF sequence_record.sequence_name IS NOT NULL THEN
                    EXECUTE format(
                        'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1), true)',
                        sequence_record.sequence_name,
                        sequence_record.column_name,
                        sequence_record.table_schema,
                        sequence_record.table_name
                    );
                END IF;
            END LOOP;
        END $$;
        """
    )


def downgrade():
    pass
