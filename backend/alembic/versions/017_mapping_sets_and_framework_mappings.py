"""Create mapping_sets and framework_mappings tables

Revision ID: 017_mapping_sets_and_framework_mappings
Revises: 016_framework_versioning_lifecycle
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "017_mapping_sets_and_framework_mappings"
down_revision = "016_framework_versioning_lifecycle"
branch_labels = None
depends_on = None


def _table_exists(table: str) -> bool:
    """Check if a table already exists (MariaDB / MySQL)."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_name = :table"
    ), {"table": table})
    return result.scalar() > 0


def _index_exists(index_name: str) -> bool:
    """Check if an index already exists (MariaDB / MySQL)."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.statistics "
        "WHERE table_schema = DATABASE() AND index_name = :idx"
    ), {"idx": index_name})
    return result.scalar() > 0


def upgrade() -> None:
    # ── 1. mapping_sets ──
    if not _table_exists("mapping_sets"):
        op.create_table(
            "mapping_sets",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("source_framework_id", sa.Integer,
                      sa.ForeignKey("frameworks.id"), nullable=False),
            sa.Column("target_framework_id", sa.Integer,
                      sa.ForeignKey("frameworks.id"), nullable=False),
            sa.Column("name", sa.String(500), nullable=True),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
            sa.Column("revert_set_id", sa.Integer,
                      sa.ForeignKey("mapping_sets.id"), nullable=True),
            sa.Column("mapping_count", sa.Integer, nullable=False, server_default="0"),
            sa.Column("coverage_percent", sa.Numeric(5, 2), nullable=True),
            sa.Column("created_by", sa.String(200), nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("source_framework_id", "target_framework_id", name="uq_ms_src_tgt"),
        )

    # ── 2. framework_mappings ──
    if not _table_exists("framework_mappings"):
        op.create_table(
            "framework_mappings",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("mapping_set_id", sa.Integer,
                      sa.ForeignKey("mapping_sets.id", ondelete="SET NULL"), nullable=True),
            sa.Column("source_framework_id", sa.Integer,
                      sa.ForeignKey("frameworks.id"), nullable=False),
            sa.Column("source_requirement_id", sa.Integer,
                      sa.ForeignKey("framework_nodes.id"), nullable=False),
            sa.Column("target_framework_id", sa.Integer,
                      sa.ForeignKey("frameworks.id"), nullable=False),
            sa.Column("target_requirement_id", sa.Integer,
                      sa.ForeignKey("framework_nodes.id"), nullable=False),
            sa.Column("relationship_type", sa.String(20), nullable=False, server_default="intersect"),
            sa.Column("strength", sa.Integer, nullable=False, server_default="2"),
            sa.Column("rationale_type", sa.String(20), nullable=True),
            sa.Column("rationale", sa.Text, nullable=True),
            sa.Column("mapping_source", sa.String(20), nullable=False, server_default="manual"),
            sa.Column("mapping_status", sa.String(20), nullable=False, server_default="draft"),
            sa.Column("ai_score", sa.Numeric(4, 3), nullable=True),
            sa.Column("ai_model", sa.String(100), nullable=True),
            sa.Column("confirmed_by", sa.String(200), nullable=True),
            sa.Column("confirmed_at", sa.DateTime, nullable=True),
            sa.Column("created_by", sa.String(200), nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("source_requirement_id", "target_requirement_id", name="uq_fm"),
        )

    # ── 3. Indexes ──
    if not _index_exists("ix_fm_set"):
        op.create_index("ix_fm_set", "framework_mappings", ["mapping_set_id"])
    if not _index_exists("ix_fm_src_fw"):
        op.create_index("ix_fm_src_fw", "framework_mappings", ["source_framework_id"])
    if not _index_exists("ix_fm_tgt_fw"):
        op.create_index("ix_fm_tgt_fw", "framework_mappings", ["target_framework_id"])


def downgrade() -> None:
    if _table_exists("framework_mappings"):
        op.drop_table("framework_mappings")
    if _table_exists("mapping_sets"):
        op.drop_table("mapping_sets")
