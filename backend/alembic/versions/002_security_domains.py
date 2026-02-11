"""Security Domains: domain_cis_controls table + owner column

Revision ID: 002_security_domains
Revises: 001_framework_engine
Create Date: 2026-02-11

Adds:
  - security_domains.owner column
  - domain_cis_controls table (M:N security_domains ↔ cis_controls)
"""
from alembic import op
import sqlalchemy as sa

revision = "002_security_domains"
down_revision = "001_framework_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add owner column to security_domains
    op.add_column("security_domains", sa.Column("owner", sa.String(200), nullable=True))

    # Widen color column (model uses String(30), migration had String(7))
    op.alter_column("security_domains", "color",
                    existing_type=sa.String(7),
                    type_=sa.String(30),
                    existing_nullable=True)

    # Create domain_cis_controls (M:N mapping)
    op.create_table(
        "domain_cis_controls",
        sa.Column("domain_id", sa.Integer,
                  sa.ForeignKey("security_domains.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("cis_control_id", sa.Integer,
                  sa.ForeignKey("cis_controls.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("domain_cis_controls")
    op.alter_column("security_domains", "color",
                    existing_type=sa.String(30),
                    type_=sa.String(7),
                    existing_nullable=True)
    op.drop_column("security_domains", "owner")
