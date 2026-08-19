-- DESTRUCTIVE: removes all application data except one selected user, their
-- student/admin profile, and the role definitions required for login.
--
-- Before running: replace the email below with the account you want to keep.
-- Run this script against the Render PostgreSQL database in its SQL console.

BEGIN;

CREATE TEMP TABLE reset_target (email text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO reset_target (email) VALUES ('replace-with-the-user-email@example.com');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE email = (SELECT email FROM reset_target)
    ) THEN
        RAISE EXCEPTION 'No user exists for the email in reset_target';
    END IF;
END $$;

CREATE TEMP TABLE kept_roles ON COMMIT DROP AS
SELECT * FROM roles;

CREATE TEMP TABLE kept_user ON COMMIT DROP AS
SELECT *
FROM users
WHERE email = (SELECT email FROM reset_target);

CREATE TEMP TABLE kept_admin ON COMMIT DROP AS
SELECT admin.*
FROM admins AS admin
JOIN kept_user AS kept ON kept.id = admin.user_id;

CREATE TEMP TABLE kept_student ON COMMIT DROP AS
SELECT student.*
FROM students AS student
JOIN kept_user AS kept ON kept.id = student.user_id;

DO $$
DECLARE tables_to_truncate text;
BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tables_to_truncate
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'alembic_version';

    EXECUTE 'TRUNCATE TABLE ' || tables_to_truncate || ' RESTART IDENTITY CASCADE';
END $$;

INSERT INTO roles SELECT * FROM kept_roles;
INSERT INTO users SELECT * FROM kept_user;
INSERT INTO admins SELECT * FROM kept_admin;
INSERT INTO students SELECT * FROM kept_student;

-- Explicitly inserted preserved IDs need their sequences advanced too.
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

COMMIT;
