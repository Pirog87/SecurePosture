"""Control Effectiveness Assessment: implementation tracking + test records

Revision ID: 015_control_effectiveness
Revises: 014_unify_catalogs
Create Date: 2026-02-13
"""
from alembic import op
import sqlalchemy as sa

revision = "015_control_effectiveness"
down_revision = "014_unify_catalogs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. control_implementations ──
    op.create_table(
        "control_implementations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=False),
        sa.Column("control_id", sa.Integer, sa.ForeignKey("control_catalog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=False),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("security_area_id", sa.Integer, sa.ForeignKey("security_domains.id"), nullable=True),
        # Implementation details
        sa.Column("status", sa.String(30), server_default="planned", nullable=False),
        sa.Column("responsible", sa.String(200), nullable=True),
        sa.Column("implementation_date", sa.Date, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("evidence_url", sa.String(500), nullable=True),
        sa.Column("evidence_notes", sa.Text, nullable=True),
        # Effectiveness scores (0–100)
        sa.Column("design_effectiveness", sa.Numeric(5, 2), nullable=True),
        sa.Column("operational_effectiveness", sa.Numeric(5, 2), nullable=True),
        sa.Column("coverage_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("overall_effectiveness", sa.Numeric(5, 2), nullable=True),
        # Testing schedule
        sa.Column("test_frequency_days", sa.Integer, nullable=True),
        sa.Column("last_test_date", sa.Date, nullable=True),
        sa.Column("next_test_date", sa.Date, nullable=True),
        # Standard
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ci_control_id", "control_implementations", ["control_id"])
    op.create_index("ix_ci_org_unit_id", "control_implementations", ["org_unit_id"])
    op.create_index("ix_ci_status", "control_implementations", ["status"])

    # ── 2. control_effectiveness_tests ──
    op.create_table(
        "control_effectiveness_tests",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=False),
        sa.Column("implementation_id", sa.Integer, sa.ForeignKey("control_implementations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_date", sa.Date, nullable=False),
        sa.Column("test_type", sa.String(30), nullable=False),
        sa.Column("tester", sa.String(200), nullable=False),
        sa.Column("result", sa.String(20), nullable=False),
        sa.Column("design_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("operational_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("findings", sa.Text, nullable=True),
        sa.Column("recommendations", sa.Text, nullable=True),
        sa.Column("evidence_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cet_impl_id", "control_effectiveness_tests", ["implementation_id"])
    op.create_index("ix_cet_test_date", "control_effectiveness_tests", ["test_date"])


def downgrade() -> None:
    op.drop_table("control_effectiveness_tests")
    op.drop_table("control_implementations")
