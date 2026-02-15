"""Add AI feature toggles for Audit Program module.

Revision ID: 025_ai_audit_program_features
Revises: 024_audit_programs_v2
"""
from alembic import op
import sqlalchemy as sa

revision = "025_ai_audit_program_features"
down_revision = "024_audit_programs_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_provider_config",
        sa.Column("feature_audit_program_suggest", sa.Boolean, nullable=False, server_default="1"),
    )
    op.add_column(
        "ai_provider_config",
        sa.Column("feature_audit_program_review", sa.Boolean, nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("ai_provider_config", "feature_audit_program_review")
    op.drop_column("ai_provider_config", "feature_audit_program_suggest")
