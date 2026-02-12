"""Create catalog tables (threats, vulnerabilities, safeguards), risk M2M junction
tables, actions system, and risk review tables.

Revision ID: 009_risk_catalogs_actions
Revises: 008_seed_missing_dictionaries
Create Date: 2026-02-12

These tables are required by the risk module for:
  - threats / vulnerabilities / safeguards catalogs
  - risk_threats / risk_vulnerabilities / risk_safeguards M2M links
  - actions + action_links + action_history
  - risk_reviews + risk_review_config
"""
from alembic import op
import sqlalchemy as sa

revision = "009_risk_catalogs_actions"
down_revision = "008_seed_missing_dictionaries"
branch_labels = None
depends_on = None


def _tbl_exists(conn, table):
    """Check if table exists (works for both MySQL/MariaDB and SQLite)."""
    dialect = conn.dialect.name
    if dialect in ("mysql", "mariadb"):
        return conn.execute(sa.text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = :tbl"
        ), {"tbl": table}).scalar()
    else:
        # SQLite
        return conn.execute(sa.text(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = :tbl"
        ), {"tbl": table}).scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # ══════════════════════════════════════════════
    # 1. Catalog: threats
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "threats"):
        op.create_table(
            "threats",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(400), nullable=False),
            sa.Column("category_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("asset_type_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                      onupdate=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 2. Catalog: vulnerabilities
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "vulnerabilities"):
        op.create_table(
            "vulnerabilities",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(400), nullable=False),
            sa.Column("security_area_id", sa.Integer,
                      sa.ForeignKey("security_domains.id"), nullable=True),
            sa.Column("asset_type_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                      onupdate=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 3. Catalog: safeguards
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "safeguards"):
        op.create_table(
            "safeguards",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(400), nullable=False),
            sa.Column("type_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("asset_type_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                      onupdate=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 4. M2M: risk_threats
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "risk_threats"):
        op.create_table(
            "risk_threats",
            sa.Column("risk_id", sa.Integer,
                      sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("threat_id", sa.Integer,
                      sa.ForeignKey("threats.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 5. M2M: risk_vulnerabilities
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "risk_vulnerabilities"):
        op.create_table(
            "risk_vulnerabilities",
            sa.Column("risk_id", sa.Integer,
                      sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("vulnerability_id", sa.Integer,
                      sa.ForeignKey("vulnerabilities.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 6. M2M: risk_safeguards
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "risk_safeguards"):
        op.create_table(
            "risk_safeguards",
            sa.Column("risk_id", sa.Integer,
                      sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("safeguard_id", sa.Integer,
                      sa.ForeignKey("safeguards.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 7. Actions system
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "actions"):
        op.create_table(
            "actions",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("title", sa.String(500), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("org_unit_id", sa.Integer,
                      sa.ForeignKey("org_units.id"), nullable=True),
            sa.Column("owner", sa.String(200), nullable=True),
            sa.Column("responsible", sa.String(200), nullable=True),
            sa.Column("priority_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("status_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("source_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("due_date", sa.DateTime, nullable=True),
            sa.Column("completed_at", sa.DateTime, nullable=True),
            sa.Column("effectiveness_rating", sa.Integer, nullable=True),
            sa.Column("effectiveness_notes", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                      onupdate=sa.func.now(), nullable=False),
        )

    if not _tbl_exists(conn, "action_links"):
        op.create_table(
            "action_links",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("action_id", sa.Integer,
                      sa.ForeignKey("actions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("entity_type", sa.String(50), nullable=False),
            sa.Column("entity_id", sa.Integer, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )

    if not _tbl_exists(conn, "action_history"):
        op.create_table(
            "action_history",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("action_id", sa.Integer,
                      sa.ForeignKey("actions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("field_name", sa.String(100), nullable=False),
            sa.Column("old_value", sa.Text, nullable=True),
            sa.Column("new_value", sa.Text, nullable=True),
            sa.Column("changed_by", sa.String(200), nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 8. Risk reviews
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "risk_review_config"):
        op.create_table(
            "risk_review_config",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("review_interval_days", sa.Integer, server_default="90", nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                      onupdate=sa.func.now(), nullable=False),
        )

    if not _tbl_exists(conn, "risk_reviews"):
        op.create_table(
            "risk_reviews",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("risk_id", sa.Integer,
                      sa.ForeignKey("risks.id", ondelete="CASCADE"), nullable=False),
            sa.Column("reviewed_by", sa.Integer,
                      sa.ForeignKey("users.id"), nullable=True),
            sa.Column("review_date", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("risk_reviews")
    op.drop_table("risk_review_config")
    op.drop_table("action_history")
    op.drop_table("action_links")
    op.drop_table("actions")
    op.drop_table("risk_safeguards")
    op.drop_table("risk_vulnerabilities")
    op.drop_table("risk_threats")
    op.drop_table("safeguards")
    op.drop_table("vulnerabilities")
    op.drop_table("threats")
