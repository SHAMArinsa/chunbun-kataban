"""Admin access areas + make admin@arinsaaiminds.com a super admin"""
import sqlalchemy as sa
from alembic import op

revision = "c0ffee290020"
down_revision = "c0ffee290019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("admins", sa.Column("permissions", sa.JSON(), nullable=True))
    op.execute(
        "UPDATE admins SET is_super_admin = TRUE "
        "WHERE user_id IN (SELECT id FROM users WHERE lower(email) = 'admin@arinsaaiminds.com')"
    )


def downgrade() -> None:
    op.drop_column("admins", "permissions")
