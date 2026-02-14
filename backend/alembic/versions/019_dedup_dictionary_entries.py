"""Deduplicate dictionary_entries and add unique constraint on (dict_type_id, code).

Multiple runs of seed scripts (e.g. 017_requirements_repository.sql) created duplicate
entries because INSERT IGNORE requires a unique key to actually prevent duplicates.

This migration:
1. Reassigns FK references from duplicate entries to the canonical (lowest-id) entry
2. Deletes duplicate entries
3. Adds a UNIQUE INDEX on (dict_type_id, code) WHERE code IS NOT NULL

Revision ID: 019_dedup_dictionary_entries
Revises: 018_framework_node_ai_cache
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "019_dedup_dictionary_entries"
down_revision = "018_framework_node_ai_cache"

# All tables/columns that have FK references to dictionary_entries.id
_FK_REFS = [
    ("frameworks", "document_type_id"),
    ("actions", "priority_id"),
    ("actions", "status_id"),
    ("actions", "source_id"),
    ("org_context_issues", "category_id"),
    ("org_context_obligations", "regulation_id"),
    ("org_context_stakeholders", "category_id"),
    ("org_context_scope", "management_system_id"),
    ("assets", "asset_type_id"),
    ("assets", "category_id"),
    ("assets", "sensitivity_id"),
    ("assets", "criticality_id"),
    ("assets", "environment_id"),
    ("assets", "status_id"),
    ("risks", "risk_category_id"),
    ("risks", "identification_source_id"),
    ("risks", "asset_category_id"),
    ("risks", "sensitivity_id"),
    ("risks", "criticality_id"),
    ("risks", "status_id"),
    ("risks", "strategy_id"),
    ("threats", "category_id"),
    ("threats", "asset_type_id"),
    ("vulnerabilities", "asset_type_id"),
    ("safeguards", "type_id"),
    ("safeguards", "asset_type_id"),
    ("cis_assessments", "status_id"),
    ("cis_assessment_answers", "policy_status_id"),
    ("cis_assessment_answers", "impl_status_id"),
    ("cis_assessment_answers", "auto_status_id"),
    ("cis_assessment_answers", "report_status_id"),
    ("audits", "audit_type_id"),
    ("audits", "overall_rating_id"),
    ("audit_findings", "finding_type_id"),
    ("audit_findings", "severity_id"),
    ("audit_findings", "status_id"),
    ("policies", "category_id"),
    ("policies", "status_id"),
    ("incidents", "category_id"),
    ("incidents", "severity_id"),
    ("incidents", "status_id"),
    ("incidents", "impact_id"),
    ("vulnerabilities_registry", "source_id"),
    ("vulnerabilities_registry", "category_id"),
    ("vulnerabilities_registry", "severity_id"),
    ("vulnerabilities_registry", "status_id"),
    ("vulnerabilities_registry", "remediation_priority_id"),
    ("policy_exceptions", "category_id"),
    ("policy_exceptions", "risk_level_id"),
    ("policy_exceptions", "status_id"),
    ("awareness_campaigns", "campaign_type_id"),
    ("awareness_campaigns", "status_id"),
    ("vendors", "category_id"),
    ("vendors", "criticality_id"),
    ("vendors", "data_access_level_id"),
    ("vendors", "status_id"),
    ("vendors", "risk_rating_id"),
    ("vendor_assessments", "risk_rating_id"),
]


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: Find all duplicate groups: (dict_type_id, code) with more than one entry
    dupes = conn.execute(sa.text(
        "SELECT dict_type_id, code, MIN(id) AS keep_id "
        "FROM dictionary_entries "
        "WHERE code IS NOT NULL "
        "GROUP BY dict_type_id, code "
        "HAVING COUNT(*) > 1"
    )).fetchall()

    if dupes:
        for row in dupes:
            dt_id = row[0]
            code = row[1]
            keep_id = row[2]

            # Get IDs of duplicates to remove
            dup_ids = conn.execute(sa.text(
                "SELECT id FROM dictionary_entries "
                "WHERE dict_type_id = :dt_id AND code = :code AND id != :keep_id"
            ), {"dt_id": dt_id, "code": code, "keep_id": keep_id}).fetchall()

            dup_id_list = [r[0] for r in dup_ids]
            if not dup_id_list:
                continue

            # Step 2: Reassign all FK references from duplicate IDs to keep_id
            for table, column in _FK_REFS:
                # Check if table exists first (some tables might not exist yet)
                try:
                    for dup_id in dup_id_list:
                        conn.execute(sa.text(
                            f"UPDATE `{table}` SET `{column}` = :keep_id "
                            f"WHERE `{column}` = :dup_id"
                        ), {"keep_id": keep_id, "dup_id": dup_id})
                except Exception:
                    # Table might not exist
                    pass

            # Step 3: Delete duplicate entries
            for dup_id in dup_id_list:
                conn.execute(sa.text(
                    "DELETE FROM dictionary_entries WHERE id = :dup_id"
                ), {"dup_id": dup_id})

    # Step 4: Add unique index to prevent future duplicates
    # In MariaDB, NULL values are treated as distinct in UNIQUE indexes,
    # so entries without a code won't conflict.
    conn.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_dict_entries_type_code "
        "ON dictionary_entries (dict_type_id, code)"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    try:
        conn.execute(sa.text(
            "DROP INDEX uq_dict_entries_type_code ON dictionary_entries"
        ))
    except Exception:
        pass
