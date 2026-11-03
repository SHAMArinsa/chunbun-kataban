"""Portal V2 services: tier-separated operational/evaluation tables, catalog activation.

Revision ID: c0ffee290010
Revises: c0ffee290009

Adds (never drops):
- five tier operational tables (one row per V2 enrollment) and five tier
  evaluation tables (append-only history, one row per evaluation save);
- student_admin_notes (append-only) for staff notes on a student;
- program_workflow_policies.mcq_enabled and projects.sequence_number;
- catalog rows for advanced / career / career_accelerator (inactive-price
  placeholders the Admin must confirm) and policy links for the five V2 programs.

Legacy premium/platinum rows are kept but closed for NEW signups
(is_active=false). Their existing enrollments, payments and history are untouched.
Legacy basic/professional enrollments keep workflow_policy_id NULL (legacy UI).
"""
from alembic import op
import sqlalchemy as sa

revision = "c0ffee290010"
down_revision = "c0ffee290009"
branch_labels = None
depends_on = None

TIERS = ("basic", "professional", "advanced", "career", "accelerator")

TRACK_EXTRA = {
    "basic": [
        sa.Column("mcq_score", sa.Numeric(6, 2)), sa.Column("mcq_max_score", sa.Numeric(6, 2)),
        sa.Column("mcq_passed", sa.Boolean()), sa.Column("mcq_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("mcq_completed_at", sa.DateTime(timezone=True)),
        sa.Column("selection_confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("project_status", sa.String(30), server_default="not_selected", nullable=False),
    ],
    "professional": [
        sa.Column("mcq_score", sa.Numeric(6, 2)), sa.Column("mcq_max_score", sa.Numeric(6, 2)),
        sa.Column("mcq_passed", sa.Boolean()), sa.Column("mcq_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("mcq_completed_at", sa.DateTime(timezone=True)),
        sa.Column("selection_confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("project1_status", sa.String(30), server_default="not_selected", nullable=False),
        sa.Column("project2_status", sa.String(30), server_default="not_selected", nullable=False),
    ],
    "advanced": [
        sa.Column("form_submitted_at", sa.DateTime(timezone=True)),
        sa.Column("assigned_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completed_count", sa.Integer(), server_default="0", nullable=False),
    ],
    "career": [
        sa.Column("form_submitted_at", sa.DateTime(timezone=True)),
        sa.Column("assigned_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completed_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("mock_interview_status", sa.String(30), server_default="not_scheduled", nullable=False),
    ],
    "accelerator": [
        sa.Column("internship_form_available_on", sa.Date()),
        sa.Column("form_submitted_at", sa.DateTime(timezone=True)),
        sa.Column("assignments_completed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("projects_completed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("mock_interviews_completed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("internship_tasks_completed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("eligibility_status", sa.String(30), server_default="in_progress", nullable=False),
    ],
}

EVAL_EXTRA = {
    "basic": [sa.Column("mcq_score", sa.Numeric(6, 2)), sa.Column("project_grade", sa.Numeric(6, 2))],
    "professional": [sa.Column("mcq_score", sa.Numeric(6, 2)), sa.Column("project1_grade", sa.Numeric(6, 2)),
                     sa.Column("project2_grade", sa.Numeric(6, 2))],
    "advanced": [sa.Column("form_review", sa.String(30)), sa.Column("work_quality", sa.Integer()),
                 sa.Column("performance_rating", sa.Integer())],
    "career": [sa.Column("work_quality", sa.Integer()), sa.Column("performance_rating", sa.Integer()),
               sa.Column("mock_interview_rating", sa.Integer())],
    "accelerator": [sa.Column("internship_performance", sa.Integer()), sa.Column("deadline_compliance", sa.String(20)),
                    sa.Column("professional_conduct", sa.String(20)), sa.Column("integrity", sa.String(20)),
                    sa.Column("confidentiality", sa.String(20)), sa.Column("eligibility_decision", sa.String(30))],
}

APPEND_ONLY = [f"{t}_evaluations" for t in TIERS] + ["student_admin_notes"]


def upgrade():
    op.add_column("program_workflow_policies", sa.Column("mcq_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("projects", sa.Column("sequence_number", sa.Integer(), nullable=True))
    # Relative schedule for program-wide work (e.g. Accelerator assignments):
    # available/due N days after the student's own start date.
    op.add_column("projects", sa.Column("available_after_days", sa.Integer(), nullable=True))
    op.add_column("projects", sa.Column("due_after_days", sa.Integer(), nullable=True))
    op.add_column("internship_forms", sa.Column("preferred_role", sa.String(300), nullable=True))
    op.create_index("ix_projects_program_work_type", "projects", ["program_id", "work_type"])

    for tier in TIERS:
        op.create_table(
            f"{tier}_tracks",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("enrollment_id", sa.Integer(), sa.ForeignKey("program_enrollments.id"), nullable=False, unique=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False, index=True),
            sa.Column("status", sa.String(30), server_default="in_progress", nullable=False),
            *[c.copy() for c in TRACK_EXTRA[tier]],
            sa.Column("completed_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint("status IN ('in_progress', 'completed', 'incomplete', 'expired')", name=f"ck_{tier}_track_status"),
        )
        op.create_table(
            f"{tier}_evaluations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("enrollment_id", sa.Integer(), sa.ForeignKey("program_enrollments.id"), nullable=False, index=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False, index=True),
            *[c.copy() for c in EVAL_EXTRA[tier]],
            sa.Column("result", sa.String(30), server_default="pending", nullable=False),
            sa.Column("remarks", sa.Text()),
            sa.Column("evaluator_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
            sa.CheckConstraint("result IN ('pending', 'in_progress', 'passed', 'failed', 'completed', 'incomplete')", name=f"ck_{tier}_eval_result"),
        )

    op.create_table(
        "student_admin_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False, index=True),
        sa.Column("author_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(trim(note)) > 0", name="ck_student_note_not_empty"),
    )
    for table in APPEND_ONLY:
        op.execute(f"CREATE TRIGGER v2_history_immutable BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION v2_reject_history_mutation()")
        op.execute(f"CREATE TRIGGER v2_history_no_truncate BEFORE TRUNCATE ON {table} FOR EACH STATEMENT EXECUTE FUNCTION v2_reject_history_mutation()")

    # MCQ on for Basic/Professional; Accelerator "as configured" -> off by default.
    op.execute("UPDATE program_workflow_policies SET mcq_enabled = true WHERE version = 2 AND program_code IN ('basic', 'professional')")

    # Catalog: add the three new programs only if absent. Prices are placeholders
    # to be confirmed by the Admin in Programs; they never overwrite existing rows.
    op.execute("""
        INSERT INTO internship_programs (code, name, description, duration_weeks, duration, duration_unit,
            price_inr, price_usd, gst_percent, platform_fee_percent, features, certificate_types, is_active,
            default_quiz_pass_percent, default_quiz_max_attempts, default_quiz_attempts_per_day,
            default_coding_required_correct, default_coding_max_attempts)
        SELECT v.code, v.name, v.description, v.weeks, v.duration, v.unit, v.inr, v.usd, 18, 10,
               '{}'::jsonb, '[]'::jsonb, true, 80, 5, 1, 4, 5
        FROM (VALUES
          ('advanced', 'Advanced Internship', '12-week internship with ARINSA-assigned tasks and projects based on your resume and area of interest.', 12, 12, 'weeks', 5000, 80),
          ('career', 'Career Internship', '24-week job-assistance internship with assigned work and a mock interview.', 24, 24, 'weeks', 10000, 170),
          ('career_accelerator', 'Career Accelerator Program', '1-year course + internship + placement guarantee (subject to eligibility).', 52, 1, 'years', 25000, 350)
        ) AS v(code, name, description, weeks, duration, unit, inr, usd)
        WHERE NOT EXISTS (SELECT 1 FROM internship_programs p WHERE p.code = v.code)
    """)
    op.execute("""
        UPDATE internship_programs p SET workflow_policy_id = w.id
        FROM program_workflow_policies w
        WHERE w.version = 2 AND w.program_code = p.code AND p.workflow_policy_id IS NULL
    """)
    # Close legacy tiers for new signups only.
    op.execute("UPDATE internship_programs SET is_active = false WHERE code IN ('premium', 'platinum')")

    # Accelerator: three real-world project submission slots (question arrives by email).
    op.execute("""
        INSERT INTO projects (program_id, title, description, project_type, work_type, sequence_number, created_by, is_active)
        SELECT p.id, 'Real-World Project ' || n, 'Request the project question from ARINSA AI MINDS by email, then submit here.',
               'capstone', 'real_world_project', n, a.id, true
        FROM internship_programs p CROSS JOIN generate_series(1, 3) n
        CROSS JOIN LATERAL (SELECT id FROM admins ORDER BY id LIMIT 1) a
        WHERE p.code = 'career_accelerator'
          AND NOT EXISTS (SELECT 1 FROM projects x WHERE x.program_id = p.id AND x.work_type = 'real_world_project' AND x.sequence_number = n)
    """)


def downgrade():
    # Reverse only this revision's catalog activation. Refuse if students already
    # use the new programs - never delete enrollments, payments or submissions.
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM program_enrollments e JOIN internship_programs p ON p.id = e.program_id
                     WHERE p.code IN ('advanced', 'career', 'career_accelerator'))
             OR EXISTS (SELECT 1 FROM program_enrollments WHERE workflow_policy_id IS NOT NULL) THEN
            RAISE EXCEPTION 'Cannot downgrade c0ffee290010: V2 enrollments exist';
          END IF;
        END $$
    """)
    op.execute("""DELETE FROM projects WHERE work_type = 'real_world_project'
                  AND id NOT IN (SELECT project_id FROM project_submissions)""")
    op.execute("UPDATE internship_programs SET workflow_policy_id = NULL")
    op.execute("""DELETE FROM internship_programs p WHERE p.code IN ('advanced', 'career', 'career_accelerator')
                  AND NOT EXISTS (SELECT 1 FROM projects x WHERE x.program_id = p.id)
                  AND NOT EXISTS (SELECT 1 FROM learning_materials m WHERE m.program_id = p.id)
                  AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.program_id = p.id)""")
    # premium/platinum are left as they are (an Admin can re-activate them); the
    # previous flag value is not recorded, so it is not guessed here.
    op.drop_table("student_admin_notes")
    for tier in TIERS:
        op.drop_table(f"{tier}_evaluations")
        op.drop_table(f"{tier}_tracks")
    op.drop_index("ix_projects_program_work_type", table_name="projects")
    op.drop_column("projects", "due_after_days")
    op.drop_column("projects", "available_after_days")
    op.drop_column("projects", "sequence_number")
    op.drop_column("internship_forms", "preferred_role")
    op.drop_column("program_workflow_policies", "mcq_enabled")
