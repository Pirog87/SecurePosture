"""Audit Programs V2 — full versioning, items, CR, history, diffs, suppliers, locations.

Revision ID: 024_audit_programs_v2
Revises: 023_ai_report_history
"""
from alembic import op
import sqlalchemy as sa

revision = "024_audit_programs_v2"
down_revision = "023_ai_report_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── audit_programs_v2 ──
    op.create_table(
        "audit_programs_v2",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(30), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("version_group_id", sa.Integer, nullable=False),
        sa.Column("is_current_version", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("previous_version_id", sa.Integer, sa.ForeignKey("audit_programs_v2.id", ondelete="SET NULL")),
        sa.Column("period_type", sa.String(20), nullable=False, server_default="annual"),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("year", sa.Integer),
        sa.Column("strategic_objectives", sa.Text),
        sa.Column("risks_and_opportunities", sa.Text),
        sa.Column("scope_description", sa.Text),
        sa.Column("audit_criteria", sa.Text),
        sa.Column("methods", sa.Text),
        sa.Column("risk_assessment_ref", sa.Text),
        sa.Column("budget_planned_days", sa.Numeric(8, 1)),
        sa.Column("budget_actual_days", sa.Numeric(8, 1), server_default="0"),
        sa.Column("budget_planned_cost", sa.Numeric(12, 2)),
        sa.Column("budget_actual_cost", sa.Numeric(12, 2), server_default="0"),
        sa.Column("budget_currency", sa.String(3), server_default="PLN"),
        sa.Column("kpis", sa.JSON),
        sa.Column("previous_program_id", sa.Integer),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("status_changed_at", sa.DateTime),
        sa.Column("status_changed_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("submitted_at", sa.DateTime),
        sa.Column("submitted_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("approval_justification", sa.Text),
        sa.Column("approved_at", sa.DateTime),
        sa.Column("approved_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("rejection_reason", sa.Text),
        sa.Column("rejected_at", sa.DateTime),
        sa.Column("rejected_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("correction_reason", sa.Text),
        sa.Column("correction_initiated_at", sa.DateTime),
        sa.Column("correction_initiated_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approver_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id", ondelete="SET NULL")),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        sa.CheckConstraint("period_end > period_start", name="chk_ap_period"),
        sa.CheckConstraint("version >= 1", name="chk_ap_version"),
    )
    op.create_index("idx_apv2_version_group", "audit_programs_v2", ["version_group_id"])
    op.create_index("idx_apv2_status", "audit_programs_v2", ["status"])
    op.create_index("idx_apv2_owner", "audit_programs_v2", ["owner_id"])
    op.create_index("idx_apv2_year", "audit_programs_v2", ["year"])
    op.create_index("idx_apv2_period", "audit_programs_v2", ["period_start", "period_end"])

    # ── audit_program_items ──
    op.create_table(
        "audit_program_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("audit_program_id", sa.Integer, sa.ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ref_id", sa.String(30)),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("audit_type", sa.String(20), nullable=False, server_default="compliance"),
        sa.Column("planned_quarter", sa.Integer),
        sa.Column("planned_month", sa.Integer),
        sa.Column("planned_start", sa.Date),
        sa.Column("planned_end", sa.Date),
        sa.Column("scope_type", sa.String(30)),
        sa.Column("scope_id", sa.Integer),
        sa.Column("scope_name", sa.String(300)),
        sa.Column("framework_ids", sa.JSON),
        sa.Column("criteria_description", sa.Text),
        sa.Column("planned_days", sa.Numeric(6, 1)),
        sa.Column("planned_cost", sa.Numeric(10, 2)),
        sa.Column("priority", sa.String(10), server_default="medium"),
        sa.Column("risk_rating", sa.String(10)),
        sa.Column("risk_justification", sa.Text),
        sa.Column("lead_auditor_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("auditor_ids", sa.JSON),
        sa.Column("audit_engagement_id", sa.Integer),
        sa.Column("item_status", sa.String(20), server_default="planned"),
        sa.Column("cancellation_reason", sa.Text),
        sa.Column("deferral_reason", sa.Text),
        sa.Column("deferred_to_program_id", sa.Integer, sa.ForeignKey("audit_programs_v2.id", ondelete="SET NULL")),
        sa.Column("audit_method", sa.String(20), server_default="on_site"),
        sa.Column("display_order", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_api_program", "audit_program_items", ["audit_program_id"])
    op.create_index("idx_api_type", "audit_program_items", ["audit_type"])
    op.create_index("idx_api_status", "audit_program_items", ["item_status"])
    op.create_index("idx_api_quarter", "audit_program_items", ["planned_quarter"])

    # ── audit_program_change_requests ──
    op.create_table(
        "audit_program_change_requests",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("audit_program_id", sa.Integer, sa.ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ref_id", sa.String(30), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("change_type", sa.String(20), nullable=False),
        sa.Column("justification", sa.Text, nullable=False),
        sa.Column("change_description", sa.Text, nullable=False),
        sa.Column("impact_assessment", sa.Text),
        sa.Column("affected_item_id", sa.Integer, sa.ForeignKey("audit_program_items.id", ondelete="SET NULL")),
        sa.Column("proposed_changes", sa.JSON),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("status_changed_at", sa.DateTime),
        sa.Column("requested_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("requested_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("submitted_at", sa.DateTime),
        sa.Column("reviewed_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reviewed_at", sa.DateTime),
        sa.Column("review_comment", sa.Text),
        sa.Column("resulting_version_id", sa.Integer, sa.ForeignKey("audit_programs_v2.id", ondelete="SET NULL")),
        sa.Column("implemented_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_apcr_program", "audit_program_change_requests", ["audit_program_id"])
    op.create_index("idx_apcr_status", "audit_program_change_requests", ["status"])

    # ── audit_program_history ──
    op.create_table(
        "audit_program_history",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("entity_id", sa.Integer, nullable=False),
        sa.Column("audit_program_id", sa.Integer, sa.ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("field_changes", sa.JSON),
        sa.Column("description", sa.Text),
        sa.Column("justification", sa.Text),
        sa.Column("change_request_id", sa.Integer, sa.ForeignKey("audit_program_change_requests.id", ondelete="SET NULL")),
        sa.Column("related_program_id", sa.Integer),
        sa.Column("performed_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("performed_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.String(500)),
    )
    op.create_index("idx_aph_program", "audit_program_history", ["audit_program_id"])
    op.create_index("idx_aph_entity", "audit_program_history", ["entity_type", "entity_id"])
    op.create_index("idx_aph_action", "audit_program_history", ["action"])
    op.create_index("idx_aph_date", "audit_program_history", ["performed_at"])

    # ── audit_program_version_diffs ──
    op.create_table(
        "audit_program_version_diffs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("version_group_id", sa.Integer, nullable=False),
        sa.Column("from_version_id", sa.Integer, sa.ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_version_id", sa.Integer, sa.ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_version", sa.Integer, nullable=False),
        sa.Column("to_version", sa.Integer, nullable=False),
        sa.Column("program_field_changes", sa.JSON),
        sa.Column("items_added", sa.JSON),
        sa.Column("items_removed", sa.JSON),
        sa.Column("items_modified", sa.JSON),
        sa.Column("items_unchanged", sa.Integer, server_default="0"),
        sa.Column("summary", sa.Text),
        sa.Column("change_request_ids", sa.JSON),
        sa.Column("generated_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("from_version_id", "to_version_id", name="uq_apvd_versions"),
    )
    op.create_index("idx_apvd_group", "audit_program_version_diffs", ["version_group_id"])

    # ── suppliers ──
    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("contact_info", sa.Text),
        sa.Column("criticality", sa.String(10), server_default="medium"),
        sa.Column("data_classification", sa.String(20), server_default="internal"),
        sa.Column("contract_ref", sa.String(100)),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id", ondelete="SET NULL")),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ── locations ──
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("location_type", sa.String(20), nullable=False, server_default="office"),
        sa.Column("address", sa.Text),
        sa.Column("city", sa.String(100)),
        sa.Column("country", sa.String(100)),
        sa.Column("criticality", sa.String(10), server_default="medium"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id", ondelete="SET NULL")),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("locations")
    op.drop_table("suppliers")
    op.drop_table("audit_program_version_diffs")
    op.drop_table("audit_program_history")
    op.drop_table("audit_program_change_requests")
    op.drop_table("audit_program_items")
    op.drop_table("audit_programs_v2")
