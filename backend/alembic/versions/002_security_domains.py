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
    conn = op.get_bind()

    # Add owner column to security_domains (skip if already exists)
    col_exists = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_schema = DATABASE() AND table_name = 'security_domains' AND column_name = 'owner'"
    )).scalar()
    if not col_exists:
        op.add_column("security_domains", sa.Column("owner", sa.String(200), nullable=True))

    # Widen color column (model uses String(30), migration had String(7))
    op.alter_column("security_domains", "color",
                    existing_type=sa.String(7),
                    type_=sa.String(30),
                    existing_nullable=True)

    # Create domain_cis_controls (M:N mapping) — skip if already exists
    tbl_exists = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_name = 'domain_cis_controls'"
    )).scalar()
    if not tbl_exists:
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
