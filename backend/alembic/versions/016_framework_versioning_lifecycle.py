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


def upgrade() -> None:
    # ── 1. Add lifecycle + versioning columns to frameworks ──
    op.add_column("frameworks", sa.Column(
        "lifecycle_status", sa.String(30),
        server_default="draft", nullable=False,
    ))
    op.add_column("frameworks", sa.Column(
        "edit_version", sa.Integer,
        server_default="1", nullable=False,
    ))
    op.add_column("frameworks", sa.Column(
        "published_version", sa.String(100), nullable=True,
    ))
    op.add_column("frameworks", sa.Column(
        "last_edited_by", sa.String(200), nullable=True,
    ))
    op.add_column("frameworks", sa.Column(
        "last_edited_at", sa.DateTime, nullable=True,
    ))

    op.create_index("ix_fw_lifecycle", "frameworks", ["lifecycle_status"])

    # ── 2. Framework version history ──
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
    op.create_index("ix_fwv_framework", "framework_versions", ["framework_id"])
    op.create_index("ix_fwv_version", "framework_versions", ["framework_id", "edit_version"])


def downgrade() -> None:
    op.drop_table("framework_versions")
    op.drop_index("ix_fw_lifecycle", table_name="frameworks")
    op.drop_column("frameworks", "last_edited_at")
    op.drop_column("frameworks", "last_edited_by")
    op.drop_column("frameworks", "published_version")
    op.drop_column("frameworks", "edit_version")
    op.drop_column("frameworks", "lifecycle_status")
