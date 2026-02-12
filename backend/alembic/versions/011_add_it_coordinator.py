"""Add it_coordinator field to org_units

Revision ID: 011_add_it_coordinator
Revises: 010_org_context
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

revision = "011_add_it_coordinator"
down_revision = "010_org_context"
branch_labels = None
depends_on = None


def _col_exists(conn, table, column):
    return conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_schema = DATABASE() AND table_name = :tbl AND column_name = :col"
    ), {"tbl": table, "col": column}).scalar() > 0


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "org_units", "it_coordinator"):
        op.add_column("org_units", sa.Column("it_coordinator", sa.String(200), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "org_units", "it_coordinator"):
        op.drop_column("org_units", "it_coordinator")
