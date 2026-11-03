"""Read-only views: one per program tier, listing that tier's students.

Revision ID: c0ffee290011
Revises: c0ffee290010
"""
from alembic import op

revision = "c0ffee290011"
down_revision = "c0ffee290010"
branch_labels = None
depends_on = None

# view name -> (program code, track table, tier-specific track columns)
VIEWS = {
    "basic_students": ("basic", "basic_tracks",
                       "t.mcq_score, t.mcq_max_score, t.project_status"),
    "professional_students": ("professional", "professional_tracks",
                              "t.mcq_score, t.mcq_max_score, t.project1_status, t.project2_status"),
    "advanced_students": ("advanced", "advanced_tracks",
                          "t.form_submitted_at, t.assigned_count, t.completed_count"),
    "career_students": ("career", "career_tracks",
                        "t.form_submitted_at, t.assigned_count, t.completed_count, t.mock_interview_status"),
    "accelerator_students": ("career_accelerator", "accelerator_tracks",
                             "t.internship_form_available_on, t.form_submitted_at, t.assignments_completed, "
                             "t.projects_completed, t.mock_interviews_completed, t.internship_tasks_completed, "
                             "t.eligibility_status"),
}


def upgrade() -> None:
    for view, (code, track, cols) in VIEWS.items():
        op.execute(f"""
            CREATE VIEW {view} AS
            SELECT s.student_number, s.full_name, u.email, s.phone, s.citizenship_status, s.country,
                   e.id AS enrollment_id, e.status AS enrollment_status, e.enrolled_at, e.start_date,
                   e.expected_end_date AS end_date, e.suspension_reason AS status_note,
                   pay.status AS payment_status, pay.currency, pay.total_amount AS amount_paid, pay.paid_at,
                   pay.invoice_number, t.status AS progress_status, {cols},
                   s.id AS student_id, u.id AS user_id
            FROM program_enrollments e
            JOIN internship_programs p ON p.id = e.program_id AND p.code = '{code}'
            JOIN students s ON s.id = e.student_id
            JOIN users u ON u.id = s.user_id
            LEFT JOIN {track} t ON t.enrollment_id = e.id
            LEFT JOIN LATERAL (SELECT * FROM payments x WHERE x.enrollment_id = e.id ORDER BY x.id DESC LIMIT 1) pay ON true
            WHERE e.workflow_policy_id IS NOT NULL
        """)
    op.execute("""
        CREATE VIEW staff_accounts AS
        SELECT a.id AS admin_id, a.full_name, u.email, r.name AS role, a.is_super_admin, u.is_active,
               u.last_login_at, u.created_at, u.id AS user_id
        FROM admins a JOIN users u ON u.id = a.user_id JOIN roles r ON r.id = u.role_id
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS staff_accounts")
    for view in VIEWS:
        op.execute(f"DROP VIEW IF EXISTS {view}")
