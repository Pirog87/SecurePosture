"""Phase 2: Policies, Policy Exceptions, Audits & Findings

Revision ID: 004_phase2_governance
Revises: 003_phase1_cmdb_vulns_incidents
Create Date: 2026-02-11

Creates:
  - policies table
  - policy_standard_mappings table
  - policy_acknowledgments table
  - policy_exceptions table
  - audits table
  - audit_findings table
  - Seeds: audit_status dictionary
"""
from alembic import op
import sqlalchemy as sa

revision = "004_phase2_governance"
down_revision = "003_phase1_cmdb_vulns_incidents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ══════════════════════════════════════════════
    # 1. Policies table (must come first — exceptions FK to it)
    # ══════════════════════════════════════════════
    op.create_table(
        "policies",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("category_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("owner", sa.String(100), nullable=False),
        sa.Column("approver", sa.String(100), nullable=True),
        sa.Column("status_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("current_version", sa.String(20), nullable=True),
        sa.Column("effective_date", sa.Date, nullable=True),
        sa.Column("review_date", sa.Date, nullable=True),
        sa.Column("last_reviewed_at", sa.DateTime, nullable=True),
        sa.Column("document_url", sa.String(500), nullable=True),
        sa.Column("target_audience_count", sa.Integer, server_default="0", nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )

    # ══════════════════════════════════════════════
    # 2. Policy standard mappings
    # ══════════════════════════════════════════════
    op.create_table(
        "policy_standard_mappings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("policy_id", sa.Integer,
                  sa.ForeignKey("policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("framework_node_id", sa.Integer,
                  sa.ForeignKey("framework_nodes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("standard_name", sa.String(100), nullable=True),
        sa.Column("control_ref", sa.String(50), nullable=True),
        sa.Column("control_description", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    # ══════════════════════════════════════════════
    # 3. Policy acknowledgments
    # ══════════════════════════════════════════════
    op.create_table(
        "policy_acknowledgments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("policy_id", sa.Integer,
                  sa.ForeignKey("policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("org_unit_id", sa.Integer,
                  sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("acknowledged_by", sa.String(100), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("policy_version", sa.String(20), nullable=True),
    )

    # ══════════════════════════════════════════════
    # 4. Policy exceptions
    # ══════════════════════════════════════════════
    op.create_table(
        "policy_exceptions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("policy_id", sa.Integer,
                  sa.ForeignKey("policies.id"), nullable=False),
        sa.Column("category_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("org_unit_id", sa.Integer,
                  sa.ForeignKey("org_units.id"), nullable=False),
        sa.Column("asset_id", sa.Integer,
                  sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("requested_by", sa.String(100), nullable=False),
        sa.Column("approved_by", sa.String(100), nullable=True),
        sa.Column("risk_level_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("compensating_controls", sa.Text, nullable=True),
        sa.Column("status_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("expiry_date", sa.Date, nullable=False),
        sa.Column("review_date", sa.Date, nullable=True),
        sa.Column("closed_at", sa.Date, nullable=True),
        sa.Column("risk_id", sa.Integer,
                  sa.ForeignKey("risks.id"), nullable=True),
        sa.Column("vulnerability_id", sa.Integer,
                  sa.ForeignKey("vulnerabilities_registry.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_exc_status", "policy_exceptions", ["status_id"])
    op.create_index("ix_exc_policy", "policy_exceptions", ["policy_id"])
    op.create_index("ix_exc_org_unit", "policy_exceptions", ["org_unit_id"])

    # ══════════════════════════════════════════════
    # 5. Audits table
    # ══════════════════════════════════════════════
    op.create_table(
        "audits",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("audit_type_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("framework", sa.String(200), nullable=True),
        sa.Column("auditor", sa.String(100), nullable=False),
        sa.Column("org_unit_id", sa.Integer,
                  sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("status", sa.String(50), server_default="planned", nullable=False),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("overall_rating_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )

    # ══════════════════════════════════════════════
    # 6. Audit findings table
    # ══════════════════════════════════════════════
    op.create_table(
        "audit_findings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=True),
        sa.Column("audit_id", sa.Integer,
                  sa.ForeignKey("audits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("finding_type_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("severity_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("security_area_id", sa.Integer,
                  sa.ForeignKey("security_domains.id"), nullable=True),
        sa.Column("framework_node_id", sa.Integer,
                  sa.ForeignKey("framework_nodes.id"), nullable=True),
        sa.Column("remediation_owner", sa.String(100), nullable=True),
        sa.Column("status_id", sa.Integer,
                  sa.ForeignKey("dictionary_entries.id"), nullable=True),
        sa.Column("sla_deadline", sa.Date, nullable=True),
        sa.Column("remediation_plan", sa.Text, nullable=True),
        sa.Column("remediation_evidence", sa.Text, nullable=True),
        sa.Column("risk_id", sa.Integer,
                  sa.ForeignKey("risks.id"), nullable=True),
        sa.Column("vulnerability_id", sa.Integer,
                  sa.ForeignKey("vulnerabilities_registry.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_finding_audit", "audit_findings", ["audit_id"])
    op.create_index("ix_finding_status", "audit_findings", ["status_id"])
    op.create_index("ix_finding_severity", "audit_findings", ["severity_id"])

    # ══════════════════════════════════════════════
    # 7. Seed: audit_status dictionary
    # ══════════════════════════════════════════════
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO dictionary_types (code, name, is_system, created_at, updated_at)
        VALUES ('audit_status', 'Status audytu', 1, NOW(), NOW())
    """))
    type_id = conn.execute(sa.text(
        "SELECT id FROM dictionary_types WHERE code = 'audit_status'"
    )).scalar()
    for code, label, sort in [
        ("planned", "Planowany", 1),
        ("in_progress", "W trakcie", 2),
        ("completed", "Zakończony", 3),
        ("cancelled", "Anulowany", 4),
    ]:
        conn.execute(sa.text("""
            INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order, is_active, created_at, updated_at)
            VALUES (:tid, :code, :label, :sort, 1, NOW(), NOW())
        """), {"tid": type_id, "code": code, "label": label, "sort": sort})


def downgrade() -> None:
    op.drop_index("ix_finding_severity", table_name="audit_findings")
    op.drop_index("ix_finding_status", table_name="audit_findings")
    op.drop_index("ix_finding_audit", table_name="audit_findings")
    op.drop_table("audit_findings")
    op.drop_table("audits")
    op.drop_index("ix_exc_org_unit", table_name="policy_exceptions")
    op.drop_index("ix_exc_policy", table_name="policy_exceptions")
    op.drop_index("ix_exc_status", table_name="policy_exceptions")
    op.drop_table("policy_exceptions")
    op.drop_table("policy_acknowledgments")
    op.drop_table("policy_standard_mappings")
    op.drop_table("policies")
