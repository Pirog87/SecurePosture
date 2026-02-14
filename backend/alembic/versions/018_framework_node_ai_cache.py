"""Add framework_node_ai_cache table for persisting AI interpret/translate results

Revision ID: 018_framework_node_ai_cache
Revises: 017_mapping_sets_and_framework_mappings
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "018_framework_node_ai_cache"
down_revision = "017_mapping_sets_and_framework_mappings"
branch_labels = None
depends_on = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_name = :table"
    ), {"table": table})
    return result.scalar() > 0


def upgrade() -> None:
    if _table_exists("framework_node_ai_cache"):
        return

    op.create_table(
        "framework_node_ai_cache",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("node_id", sa.Integer,
                  sa.ForeignKey("framework_nodes.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("action_type", sa.String(20), nullable=False,
                  comment="interpret or translate"),
        sa.Column("language", sa.String(10), nullable=True,
                  comment="Target language code for translations, NULL for interpret"),
        sa.Column("result_json", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("node_id", "action_type", "language",
                            name="uq_node_ai_cache"),
    )

    op.create_index("ix_node_ai_cache_node", "framework_node_ai_cache", ["node_id"])
    op.create_index("ix_node_ai_cache_action", "framework_node_ai_cache",
                    ["node_id", "action_type"])


def downgrade() -> None:
    op.drop_table("framework_node_ai_cache")
