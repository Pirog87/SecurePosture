"""Make frameworks.urn and frameworks.ref_id nullable for YAML imports.

Revision ID: 007_nullable_framework_urn_ref_id
Revises: 006_phase4_security_score
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "007_nullable_framework_urn_ref_id"
down_revision = "006_phase4_security_score"


def _column_is_nullable(table: str, column: str) -> bool:
    """Check if a column already allows NULL (idempotent guard)."""
    bind = op.get_bind()
    insp = sa_inspect(bind)
    for col in insp.get_columns(table):
        if col["name"] == column:
            return col["nullable"]
    return True


def upgrade() -> None:
    if not _column_is_nullable("frameworks", "urn"):
        op.alter_column(
            "frameworks", "urn",
            existing_type=sa.String(500),
            nullable=True,
        )
    if not _column_is_nullable("frameworks", "ref_id"):
        op.alter_column(
            "frameworks", "ref_id",
            existing_type=sa.String(100),
            nullable=True,
        )


def downgrade() -> None:
    op.alter_column(
        "frameworks", "urn",
        existing_type=sa.String(500),
        nullable=False,
    )
    op.alter_column(
        "frameworks", "ref_id",
        existing_type=sa.String(100),
        nullable=False,
    )
