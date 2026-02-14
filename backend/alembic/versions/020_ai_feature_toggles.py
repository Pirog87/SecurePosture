"""Add missing AI feature toggle columns to ai_provider_config.

Adds 7 new feature_* boolean columns for framework/document AI features:
- feature_interpret
- feature_translate
- feature_evidence
- feature_security_area_map
- feature_cross_mapping
- feature_coverage_report
- feature_document_import

Revision ID: 020_ai_feature_toggles
Revises: 019_dedup_dictionary_entries
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "020_ai_feature_toggles"
down_revision = "019_dedup_dictionary_entries"

_NEW_COLS = [
    "feature_interpret",
    "feature_translate",
    "feature_evidence",
    "feature_security_area_map",
    "feature_cross_mapping",
    "feature_coverage_report",
    "feature_document_import",
]


def upgrade() -> None:
    for col in _NEW_COLS:
        op.add_column(
            "ai_provider_config",
            sa.Column(col, sa.Boolean(), nullable=False, server_default="1"),
        )


def downgrade() -> None:
    for col in _NEW_COLS:
        op.drop_column("ai_provider_config", col)
