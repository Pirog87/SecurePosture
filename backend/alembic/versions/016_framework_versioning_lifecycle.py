"""Framework versioning, lifecycle statuses, and version history

Revision ID: 016_framework_versioning_lifecycle
Revises: 015_control_effectiveness
Create Date: 2026-02-13
"""
from alembic import op
import sqlalchemy as sa

revision = "016_framework_versioning_lifecycle"
down_revision = "015_control_effectiveness"
branch_labels = None
depends_on = None


def _is_mysql() -> bool:
    return op.get_bind().dialect.name in ("mysql", "mariadb")


def _column_exists(table: str, column: str) -> bool:
    """Check if a column already exists in a table."""
    conn = op.get_bind()
    if _is_mysql():
        result = conn.execute(sa.text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = DATABASE() "
            "AND table_name = :table AND column_name = :column"
        ), {"table": table, "column": column})
        return result.scalar() > 0
    else:
        result = conn.execute(sa.text(f"PRAGMA table_info('{table}')"))
        return any(row[1] == column for row in result.fetchall())


def _table_exists(table: str) -> bool:
    """Check if a table already exists."""
    conn = op.get_bind()
    if _is_mysql():
        result = conn.execute(sa.text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = :table"
        ), {"table": table})
        return result.scalar() > 0
    else:
        result = conn.execute(sa.text(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = :table"
        ), {"table": table})
        return result.scalar() > 0


def _index_exists(index_name: str) -> bool:
    """Check if an index already exists."""
    conn = op.get_bind()
    if _is_mysql():
        result = conn.execute(sa.text(
            "SELECT COUNT(*) FROM information_schema.statistics "
            "WHERE table_schema = DATABASE() AND index_name = :idx"
        ), {"idx": index_name})
        return result.scalar() > 0
    else:
        result = conn.execute(sa.text(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name = :idx"
        ), {"idx": index_name})
        return result.scalar() > 0


def upgrade() -> None:
    # ── 1. Add lifecycle + versioning columns to frameworks ──
    if not _column_exists("frameworks", "lifecycle_status"):
        op.add_column("frameworks", sa.Column(
            "lifecycle_status", sa.String(30),
            server_default="draft", nullable=False,
        ))

    if not _column_exists("frameworks", "edit_version"):
        op.add_column("frameworks", sa.Column(
            "edit_version", sa.Integer,
            server_default="1", nullable=False,
        ))

    if not _column_exists("frameworks", "published_version"):
        op.add_column("frameworks", sa.Column(
            "published_version", sa.String(100), nullable=True,
        ))

    if not _column_exists("frameworks", "last_edited_by"):
        op.add_column("frameworks", sa.Column(
            "last_edited_by", sa.String(200), nullable=True,
        ))

    if not _column_exists("frameworks", "last_edited_at"):
        op.add_column("frameworks", sa.Column(
            "last_edited_at", sa.DateTime, nullable=True,
        ))

    if not _index_exists("ix_fw_lifecycle"):
        op.create_index("ix_fw_lifecycle", "frameworks", ["lifecycle_status"])

    # ── 2. Framework version history ──
    if not _table_exists("framework_versions"):
        op.create_table(
            "framework_versions",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("framework_id", sa.Integer,
                      sa.ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False),
            sa.Column("edit_version", sa.Integer, nullable=False),
            sa.Column("lifecycle_status", sa.String(30), nullable=False),
            sa.Column("change_summary", sa.Text, nullable=True),
            sa.Column("changed_by", sa.String(200), nullable=True),
            sa.Column("changed_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("snapshot_nodes_count", sa.Integer, nullable=True),
            sa.Column("snapshot_assessable_count", sa.Integer, nullable=True),
        )

    if not _index_exists("ix_fwv_framework"):
        op.create_index("ix_fwv_framework", "framework_versions", ["framework_id"])

    if not _index_exists("ix_fwv_version"):
        op.create_index("ix_fwv_version", "framework_versions", ["framework_id", "edit_version"])


def downgrade() -> None:
    if _table_exists("framework_versions"):
        op.drop_table("framework_versions")
    if _index_exists("ix_fw_lifecycle"):
        op.drop_index("ix_fw_lifecycle", table_name="frameworks")
    if _column_exists("frameworks", "last_edited_at"):
        op.drop_column("frameworks", "last_edited_at")
    if _column_exists("frameworks", "last_edited_by"):
        op.drop_column("frameworks", "last_edited_by")
    if _column_exists("frameworks", "published_version"):
        op.drop_column("frameworks", "published_version")
    if _column_exists("frameworks", "edit_version"):
        op.drop_column("frameworks", "edit_version")
    if _column_exists("frameworks", "lifecycle_status"):
        op.drop_column("frameworks", "lifecycle_status")
