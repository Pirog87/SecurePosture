"""Phase 4: Security Score — snapshots & configuration

Revision ID: 006_phase4_security_score
Revises: 005_phase3_vendors_awareness
Create Date: 2026-02-11

Creates:
  - security_score_config table
  - security_score_snapshots table
"""
from alembic import op
import sqlalchemy as sa

revision = "006_phase4_security_score"
down_revision = "005_phase3_vendors_awareness"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ══════════════════════════════════════════════
    # 1. Security Score Configuration
    # ══════════════════════════════════════════════
    op.create_table(
        "security_score_config",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("version", sa.Integer, nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("1")),
        # Pillar weights (must sum to 100)
        sa.Column("w_risk", sa.Numeric(5, 2), nullable=False, server_default=sa.text("20")),
        sa.Column("w_vulnerability", sa.Numeric(5, 2), nullable=False, server_default=sa.text("15")),
        sa.Column("w_incident", sa.Numeric(5, 2), nullable=False, server_default=sa.text("12")),
        sa.Column("w_exception", sa.Numeric(5, 2), nullable=False, server_default=sa.text("10")),
        sa.Column("w_maturity", sa.Numeric(5, 2), nullable=False, server_default=sa.text("10")),
        sa.Column("w_audit", sa.Numeric(5, 2), nullable=False, server_default=sa.text("10")),
        sa.Column("w_asset", sa.Numeric(5, 2), nullable=False, server_default=sa.text("8")),
        sa.Column("w_tprm", sa.Numeric(5, 2), nullable=False, server_default=sa.text("6")),
        sa.Column("w_policy", sa.Numeric(5, 2), nullable=False, server_default=sa.text("5")),
        sa.Column("w_awareness", sa.Numeric(5, 2), nullable=False, server_default=sa.text("4")),
        # Vulnerability thresholds
        sa.Column("vuln_threshold_critical", sa.Integer, server_default=sa.text("3")),
        sa.Column("vuln_threshold_high", sa.Integer, server_default=sa.text("10")),
        sa.Column("vuln_threshold_medium", sa.Integer, server_default=sa.text("30")),
        sa.Column("vuln_threshold_low", sa.Integer, server_default=sa.text("100")),
        # Incident target TTR (hours)
        sa.Column("incident_ttr_critical", sa.Integer, server_default=sa.text("4")),
        sa.Column("incident_ttr_high", sa.Integer, server_default=sa.text("24")),
        sa.Column("incident_ttr_medium", sa.Integer, server_default=sa.text("72")),
        sa.Column("incident_ttr_low", sa.Integer, server_default=sa.text("168")),
        sa.Column("incident_window_days", sa.Integer, server_default=sa.text("90")),
        # Audit SLA (days)
        sa.Column("audit_sla_critical", sa.Integer, server_default=sa.text("14")),
        sa.Column("audit_sla_high", sa.Integer, server_default=sa.text("30")),
        sa.Column("audit_sla_medium", sa.Integer, server_default=sa.text("60")),
        sa.Column("audit_sla_low", sa.Integer, server_default=sa.text("90")),
        # Snapshot frequency
        sa.Column("snapshot_frequency", sa.String(20), server_default=sa.text("'daily'")),
        sa.Column("changed_by", sa.String(100), nullable=True),
        sa.Column("change_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ══════════════════════════════════════════════
    # 2. Security Score Snapshots
    # ══════════════════════════════════════════════
    op.create_table(
        "security_score_snapshots",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("snapshot_date", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("total_score", sa.Numeric(5, 2), nullable=False),
        # Individual pillar scores
        sa.Column("risk_score", sa.Numeric(5, 2)),
        sa.Column("vulnerability_score", sa.Numeric(5, 2)),
        sa.Column("incident_score", sa.Numeric(5, 2)),
        sa.Column("exception_score", sa.Numeric(5, 2)),
        sa.Column("maturity_score", sa.Numeric(5, 2)),
        sa.Column("audit_score", sa.Numeric(5, 2)),
        sa.Column("asset_score", sa.Numeric(5, 2)),
        sa.Column("tprm_score", sa.Numeric(5, 2)),
        sa.Column("policy_score", sa.Numeric(5, 2)),
        sa.Column("awareness_score", sa.Numeric(5, 2)),
        # Weights at time of snapshot
        sa.Column("w_risk", sa.Numeric(5, 2)),
        sa.Column("w_vulnerability", sa.Numeric(5, 2)),
        sa.Column("w_incident", sa.Numeric(5, 2)),
        sa.Column("w_exception", sa.Numeric(5, 2)),
        sa.Column("w_maturity", sa.Numeric(5, 2)),
        sa.Column("w_audit", sa.Numeric(5, 2)),
        sa.Column("w_asset", sa.Numeric(5, 2)),
        sa.Column("w_tprm", sa.Numeric(5, 2)),
        sa.Column("w_policy", sa.Numeric(5, 2)),
        sa.Column("w_awareness", sa.Numeric(5, 2)),
        # Meta
        sa.Column("config_version", sa.Integer),
        sa.Column("triggered_by", sa.String(50)),
        sa.Column("created_by", sa.String(100)),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Seed default config
    config_table = sa.table(
        "security_score_config",
        sa.Column("version", sa.Integer),
        sa.Column("is_active", sa.Boolean),
        sa.Column("changed_by", sa.String),
        sa.Column("change_reason", sa.String),
    )
    op.execute(config_table.insert().values(
        version=1, is_active=True, changed_by="system", change_reason="Initial default configuration",
    ))


def downgrade() -> None:
    op.drop_table("security_score_snapshots")
    op.drop_table("security_score_config")
