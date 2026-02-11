"""Phase 3: Vendors (TPRM) & Security Awareness

Revision ID: 005_phase3_vendors_awareness
Revises: 004_phase2_governance
Create Date: 2026-02-11

Creates:
  - vendors table
  - vendor_assessments table
  - vendor_assessment_answers table
  - awareness_campaigns table
  - awareness_results table
  - awareness_employee_reports table
"""
from alembic import op
import sqlalchemy as sa

revision = "005_phase3_vendors_awareness"
down_revision = "004_phase2_governance"
branch_labels = None
depends_on = None


def _tbl_exists(conn, table):
    return conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_name = :tbl"
    ), {"tbl": table}).scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # ══════════════════════════════════════════════
    # 1. Vendors table
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "vendors"):
        op.create_table(
            "vendors",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("ref_id", sa.String(20), unique=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("category_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("criticality_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("services_provided", sa.Text, nullable=True),
            sa.Column("data_access_level_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("contract_owner", sa.String(100), nullable=True),
            sa.Column("security_contact", sa.String(100), nullable=True),
            sa.Column("contract_start", sa.Date, nullable=True),
            sa.Column("contract_end", sa.Date, nullable=True),
            sa.Column("sla_description", sa.Text, nullable=True),
            sa.Column("status_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("last_assessment_date", sa.Date, nullable=True),
            sa.Column("next_assessment_date", sa.Date, nullable=True),
            sa.Column("risk_rating_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("risk_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("questionnaire_completed", sa.Boolean, default=False),
            sa.Column("certifications", sa.Text, nullable=True),
            sa.Column("risk_id", sa.Integer, sa.ForeignKey("risks.id"), nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        )

    # ══════════════════════════════════════════════
    # 2. Vendor assessments table
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "vendor_assessments"):
        op.create_table(
            "vendor_assessments",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("vendor_id", sa.Integer, sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
            sa.Column("assessment_date", sa.Date, nullable=False),
            sa.Column("assessed_by", sa.String(100), nullable=False),
            sa.Column("total_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("risk_rating_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        )

    # ══════════════════════════════════════════════
    # 3. Vendor assessment answers table
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "vendor_assessment_answers"):
        op.create_table(
            "vendor_assessment_answers",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("assessment_id", sa.Integer, sa.ForeignKey("vendor_assessments.id", ondelete="CASCADE"), nullable=False),
            sa.Column("question_code", sa.String(20), nullable=False),
            sa.Column("question_text", sa.Text, nullable=False),
            sa.Column("answer", sa.Integer, nullable=False),
            sa.Column("notes", sa.Text, nullable=True),
        )

    # ══════════════════════════════════════════════
    # 4. Awareness campaigns table
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "awareness_campaigns"):
        op.create_table(
            "awareness_campaigns",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("ref_id", sa.String(20), unique=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("campaign_type_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=True),
            sa.Column("target_audience_count", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("start_date", sa.Date, nullable=True),
            sa.Column("end_date", sa.Date, nullable=True),
            sa.Column("status_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("owner", sa.String(100), nullable=True),
            sa.Column("content_url", sa.String(500), nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        )

    # ══════════════════════════════════════════════
    # 5. Awareness results table
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "awareness_results"):
        op.create_table(
            "awareness_results",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("campaign_id", sa.Integer, sa.ForeignKey("awareness_campaigns.id", ondelete="CASCADE"), nullable=False),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=True),
            sa.Column("participants_count", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("completed_count", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("failed_count", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("reported_count", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("avg_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("completion_rate", sa.Numeric(5, 2), nullable=True),
            sa.Column("click_rate", sa.Numeric(5, 2), nullable=True),
            sa.Column("report_rate", sa.Numeric(5, 2), nullable=True),
            sa.Column("recorded_at", sa.DateTime, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        )

    # ══════════════════════════════════════════════
    # 6. Awareness employee reports table
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "awareness_employee_reports"):
        op.create_table(
            "awareness_employee_reports",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("month", sa.Date, nullable=False),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=True),
            sa.Column("reports_count", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("confirmed_count", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("recorded_at", sa.DateTime, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        )

    # ══════════════════════════════════════════════
    # 7. Dictionary seeding — skipped
    # These 6 dictionary types (vendor_category, vendor_status,
    # vendor_data_access, vendor_risk_rating, campaign_type,
    # campaign_status) were already seeded in migration 003.
    # ══════════════════════════════════════════════


def downgrade() -> None:
    op.drop_table("awareness_employee_reports")
    op.drop_table("awareness_results")
    op.drop_table("awareness_campaigns")
    op.drop_table("vendor_assessment_answers")
    op.drop_table("vendor_assessments")
    op.drop_table("vendors")
    # Dictionary cleanup handled by migration 003 downgrade
