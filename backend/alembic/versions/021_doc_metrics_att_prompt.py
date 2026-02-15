"""Add document metrics, framework attachments, AI prompt templates, and node content field.

New tables:
- document_metrics: Document metrics / metryka dokumentu
- framework_attachments: File attachments for frameworks
- ai_prompt_templates: Editable AI prompt templates per function

New columns:
- framework_nodes.content: Full verbatim text of document section

Revision ID: 021_doc_metrics_att_prompt
Revises: 020_ai_feature_toggles
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa

revision = "021_doc_metrics_att_prompt"
down_revision = "020_ai_feature_toggles"


def upgrade() -> None:
    # 1. Add content column to framework_nodes
    op.add_column(
        "framework_nodes",
        sa.Column("content", sa.Text(), nullable=True,
                  comment="Full verbatim text of this section from the source document"),
    )

    # 2. Create document_metrics table
    op.create_table(
        "document_metrics",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("framework_id", sa.Integer(),
                  sa.ForeignKey("frameworks.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("change_history", sa.JSON(), nullable=True),
        sa.Column("responsibilities", sa.JSON(), nullable=True),
        sa.Column("implementation_date", sa.String(50), nullable=True),
        sa.Column("implementation_method", sa.Text(), nullable=True),
        sa.Column("verification_date", sa.String(50), nullable=True),
        sa.Column("effective_date", sa.String(50), nullable=True),
        sa.Column("distribution_responsible", sa.String(300), nullable=True),
        sa.Column("distribution_date", sa.String(50), nullable=True),
        sa.Column("distribution_list", sa.Text(), nullable=True),
        sa.Column("notification_method", sa.Text(), nullable=True),
        sa.Column("access_level", sa.String(200), nullable=True),
        sa.Column("classification", sa.String(200), nullable=True),
        sa.Column("additional_permissions", sa.Text(), nullable=True),
        sa.Column("applicable_roles", sa.Text(), nullable=True),
        sa.Column("management_approved", sa.String(10), nullable=True),
        sa.Column("extra", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 3. Create framework_attachments table
    op.create_table(
        "framework_attachments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("framework_id", sa.Integer(),
                  sa.ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("original_name", sa.String(500), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(200), nullable=True),
        sa.Column("uploaded_by", sa.String(200), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 4. Create ai_prompt_templates table
    op.create_table(
        "ai_prompt_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("function_key", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("is_customized", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("updated_by", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("function_key", name="uq_prompt_function_key"),
    )

    # 5. Seed default prompt templates
    from app.services.ai_prompts import DEFAULT_PROMPTS
    for p in DEFAULT_PROMPTS:
        op.execute(
            sa.text(
                "INSERT INTO ai_prompt_templates (function_key, display_name, description, prompt_text, is_customized) "
                "VALUES (:key, :name, :desc, :text, 0)"
            ).bindparams(
                key=p["function_key"],
                name=p["display_name"],
                desc=p.get("description", ""),
                text=p["prompt_text"],
            )
        )


def downgrade() -> None:
    op.drop_table("ai_prompt_templates")
    op.drop_table("framework_attachments")
    op.drop_table("document_metrics")
    op.drop_column("framework_nodes", "content")
