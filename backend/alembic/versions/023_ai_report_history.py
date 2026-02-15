"""Create ai_management_reports table for report history.

Revision ID: 023_ai_report_history
Revises: 022_ai_management_report
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa

revision = "023_ai_report_history"
down_revision = "022_ai_management_report"


def upgrade() -> None:
    op.create_table(
        "ai_management_reports",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("report_json", sa.JSON, nullable=False),
        sa.Column("generated_at", sa.DateTime, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ai_management_reports")
