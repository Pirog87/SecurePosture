"""framework_engine_tables_and_cis_migration

Create Framework Engine tables and migrate existing CIS data.

Revision ID: e5567b7e7738
Revises:
Create Date: 2026-02-11 09:39:21.439139
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = 'e5567b7e7738'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Add new columns to security_domains (if not exist) ──
    # Check existing columns first
    result = conn.execute(text(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'security_domains'"
    ))
    existing_cols = {row[0] for row in result}

    if "code" not in existing_cols:
        op.add_column("security_domains", sa.Column("code", sa.String(50), unique=True))
    if "parent_id" not in existing_cols:
        op.add_column("security_domains", sa.Column("parent_id", sa.Integer,
                       sa.ForeignKey("security_domains.id", ondelete="SET NULL")))
    # icon, color, owner, sort_order, is_active already exist from previous migration

    # ── 2. Create frameworks table ──
    op.create_table(
        "frameworks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("urn", sa.String(500), unique=True),
        sa.Column("ref_id", sa.String(100)),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("version", sa.String(50)),
        sa.Column("provider", sa.String(200)),
        sa.Column("packager", sa.String(200)),
        sa.Column("copyright", sa.Text),
        sa.Column("source_format", sa.Enum(
            "ciso_assistant_excel", "ciso_assistant_yaml", "custom_import", "manual",
            name="framework_source_format")),
        sa.Column("source_url", sa.String(1000)),
        sa.Column("locale", sa.String(10), server_default="en"),
        sa.Column("implementation_groups_definition", sa.JSON),
        sa.Column("total_nodes", sa.Integer, server_default="0"),
        sa.Column("total_assessable", sa.Integer, server_default="0"),
        sa.Column("imported_at", sa.DateTime),
        sa.Column("imported_by", sa.String(200)),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("TRUE"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"), nullable=False),
        mysql_engine="InnoDB",
    )

    # ── 3. Create framework_nodes table ──
    op.create_table(
        "framework_nodes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("framework_id", sa.Integer, sa.ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", sa.Integer, sa.ForeignKey("framework_nodes.id", ondelete="CASCADE")),
        sa.Column("urn", sa.String(500)),
        sa.Column("ref_id", sa.String(100)),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("name_pl", sa.String(500)),
        sa.Column("description", sa.Text),
        sa.Column("description_pl", sa.Text),
        sa.Column("depth", sa.Integer, server_default="1", nullable=False),
        sa.Column("order_id", sa.Integer, server_default="0", nullable=False),
        sa.Column("assessable", sa.Boolean, server_default=sa.text("FALSE"), nullable=False),
        sa.Column("implementation_groups", sa.String(100)),
        sa.Column("weight", sa.Integer, server_default="1", nullable=False),
        sa.Column("importance", sa.Enum("mandatory", "recommended", "nice_to_have", "undefined", name="node_importance")),
        sa.Column("maturity_level", sa.Integer),
        sa.Column("annotation", sa.Text),
        sa.Column("threats", sa.JSON),
        sa.Column("reference_controls", sa.JSON),
        sa.Column("typical_evidence", sa.Text),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("TRUE"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"), nullable=False),
        mysql_engine="InnoDB",
    )
    op.create_index("ix_fwnode_fw_parent", "framework_nodes", ["framework_id", "parent_id"])
    op.create_index("ix_fwnode_fw_depth", "framework_nodes", ["framework_id", "depth"])
    op.create_index("ix_fwnode_fw_assessable", "framework_nodes", ["framework_id", "assessable"])
    op.create_index("ix_fwnode_urn", "framework_nodes", ["urn"])

    # ── 4. Create assessment_dimensions table ──
    op.create_table(
        "assessment_dimensions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("framework_id", sa.Integer, sa.ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dimension_key", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("name_pl", sa.String(200)),
        sa.Column("description", sa.Text),
        sa.Column("order_id", sa.Integer, server_default="0", nullable=False),
        sa.Column("weight", sa.Numeric(3, 2), server_default="1.00", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("TRUE"), nullable=False),
        mysql_engine="InnoDB",
    )

    # ── 5. Create dimension_levels table ──
    op.create_table(
        "dimension_levels",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("dimension_id", sa.Integer, sa.ForeignKey("assessment_dimensions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("level_order", sa.Integer, nullable=False),
        sa.Column("value", sa.Numeric(5, 2), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("label_pl", sa.String(200)),
        sa.Column("description", sa.Text),
        sa.Column("color", sa.String(7)),
        mysql_engine="InnoDB",
    )

    # ── 6. Create framework_node_security_areas table ──
    op.create_table(
        "framework_node_security_areas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("framework_node_id", sa.Integer, sa.ForeignKey("framework_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("security_area_id", sa.Integer, sa.ForeignKey("security_domains.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.Enum("seed", "manual", "ai_suggested", name="area_mapping_source")),
        sa.Column("created_by", sa.String(200)),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("framework_node_id", "security_area_id", name="uq_node_area"),
        mysql_engine="InnoDB",
    )

    # ── 7. Create assessments table (v2 — framework engine) ──
    op.create_table(
        "assessments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20)),
        sa.Column("framework_id", sa.Integer, sa.ForeignKey("frameworks.id"), nullable=False),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id")),
        sa.Column("security_area_id", sa.Integer, sa.ForeignKey("security_domains.id")),
        sa.Column("title", sa.String(500)),
        sa.Column("assessor", sa.String(200)),
        sa.Column("assessment_date", sa.Date, nullable=False),
        sa.Column("status", sa.Enum("draft", "in_progress", "completed", "approved", "archived",
                                     name="assessment_status"),
                  server_default="draft", nullable=False),
        sa.Column("implementation_group_filter", sa.String(100)),
        sa.Column("notes", sa.Text),
        sa.Column("completion_pct", sa.Numeric(5, 2)),
        sa.Column("overall_score", sa.Numeric(5, 2)),
        sa.Column("approved_by", sa.String(200)),
        sa.Column("approved_at", sa.DateTime),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("TRUE"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"), nullable=False),
        mysql_engine="InnoDB",
    )

    # ── 8. Create assessment_answers table (v2) ──
    op.create_table(
        "assessment_answers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("assessment_id", sa.Integer, sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("framework_node_id", sa.Integer, sa.ForeignKey("framework_nodes.id"), nullable=False),
        sa.Column("dimension_id", sa.Integer, sa.ForeignKey("assessment_dimensions.id"), nullable=False),
        sa.Column("level_id", sa.Integer, sa.ForeignKey("dimension_levels.id")),
        sa.Column("not_applicable", sa.Boolean, server_default=sa.text("FALSE"), nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("evidence", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("assessment_id", "framework_node_id", "dimension_id", name="uq_answer"),
        mysql_engine="InnoDB",
    )

    # ══════════════════════════════════════════════════════════
    # DATA MIGRATION: CIS Controls v8 → Framework Engine
    # ══════════════════════════════════════════════════════════

    # ── 9. Insert CIS v8 framework ──
    conn.execute(text("""
        INSERT INTO frameworks (urn, ref_id, name, description, version, provider, packager,
                                source_format, locale, implementation_groups_definition,
                                imported_at, imported_by)
        VALUES (
            'urn:intuitem:risk:framework:cis-controls-v8',
            'cis-controls-v8',
            'CIS Controls v8',
            'Center for Internet Security Controls Version 8 — 18 controls, 153 sub-controls',
            '8.0',
            'CIS',
            'secureposture',
            'manual',
            'en',
            '{"IG1": "Basic Cyber Hygiene", "IG2": "Medium Enterprise", "IG3": "Large Enterprise"}',
            NOW(),
            'migration'
        )
    """))

    # ── 10. Get the framework ID ──
    fw_id_row = conn.execute(text(
        "SELECT id FROM frameworks WHERE ref_id = 'cis-controls-v8'"
    )).fetchone()
    fw_id = fw_id_row[0]

    # ── 11. Migrate cis_controls → framework_nodes (depth=1, assessable=false) ──
    conn.execute(text("""
        INSERT INTO framework_nodes
            (framework_id, parent_id, urn, ref_id, name, name_pl, depth, order_id, assessable)
        SELECT
            :fw_id,
            NULL,
            CONCAT('urn:intuitem:risk:req_node:cis-controls-v8:', control_number),
            CAST(control_number AS CHAR),
            name_en,
            name_pl,
            1,
            control_number,
            FALSE
        FROM cis_controls
        ORDER BY control_number
    """), {"fw_id": fw_id})

    # ── 12. Migrate cis_sub_controls → framework_nodes (depth=2, assessable=true) ──
    conn.execute(text("""
        INSERT INTO framework_nodes
            (framework_id, parent_id, urn, ref_id, name, name_pl, description, description_pl,
             depth, order_id, assessable, implementation_groups, annotation)
        SELECT
            :fw_id,
            fn_parent.id,
            CONCAT('urn:intuitem:risk:req_node:cis-controls-v8:', sc.sub_id),
            sc.sub_id,
            sc.detail_en,
            sc.detail_pl,
            sc.detail_en,
            sc.detail_pl,
            2,
            CAST(SUBSTRING_INDEX(sc.sub_id, '.', -1) AS UNSIGNED),
            TRUE,
            REPLACE(sc.implementation_groups, ' ', ''),
            sc.nist_csf
        FROM cis_sub_controls sc
        JOIN cis_controls c ON c.id = sc.control_id
        JOIN framework_nodes fn_parent
            ON fn_parent.framework_id = :fw_id
            AND fn_parent.ref_id = CAST(c.control_number AS CHAR)
            AND fn_parent.depth = 1
        ORDER BY sc.sub_id
    """), {"fw_id": fw_id})

    # ── 13. Update framework node counts ──
    conn.execute(text("""
        UPDATE frameworks SET
            total_nodes = (SELECT COUNT(*) FROM framework_nodes WHERE framework_id = :fw_id),
            total_assessable = (SELECT COUNT(*) FROM framework_nodes WHERE framework_id = :fw_id AND assessable = TRUE)
        WHERE id = :fw_id
    """), {"fw_id": fw_id})

    # ── 14. Create 4 CIS assessment dimensions ──
    dims = [
        ("policy_defined", "Policy Defined", "Polityka zdefiniowana", 1),
        ("control_implemented", "Control Implemented", "Kontrola wdrożona", 2),
        ("control_automated", "Control Automated", "Kontrola zautomatyzowana", 3),
        ("control_reported", "Control Reported", "Kontrola raportowana", 4),
    ]
    for dim_key, name, name_pl, order in dims:
        conn.execute(text("""
            INSERT INTO assessment_dimensions (framework_id, dimension_key, name, name_pl, order_id, weight)
            VALUES (:fw_id, :dim_key, :name, :name_pl, :order_id, 1.00)
        """), {"fw_id": fw_id, "dim_key": dim_key, "name": name, "name_pl": name_pl, "order_id": order})

    # ── 15. Create 5 levels per dimension (CIS standard scale) ──
    levels_policy = [
        (0, 0.00, "No Policy", "Brak polityki", "#EF4444"),
        (1, 0.25, "Informal Policy", "Polityka nieformalna", "#F97316"),
        (2, 0.50, "Partial Written Policy", "Częściowa polityka pisemna", "#EAB308"),
        (3, 0.75, "Written Policy", "Polityka pisemna", "#22C55E"),
        (4, 1.00, "Approved Written Policy", "Zatwierdzona polityka pisemna", "#16A34A"),
    ]
    levels_impl = [
        (0, 0.00, "Not Implemented", "Niezaimplementowane", "#EF4444"),
        (1, 0.25, "Parts of Policy Implemented", "Częściowo wdrożone", "#F97316"),
        (2, 0.50, "Implemented on Some Systems", "Wdrożone na części systemów", "#EAB308"),
        (3, 0.75, "Implemented on Most Systems", "Wdrożone na większości systemów", "#22C55E"),
        (4, 1.00, "Implemented on All Systems", "Wdrożone na wszystkich systemach", "#16A34A"),
    ]
    levels_auto = [
        (0, 0.00, "Not Automated", "Niezautomatyzowane", "#EF4444"),
        (1, 0.25, "Parts of Policy Automated", "Częściowo zautomatyzowane", "#F97316"),
        (2, 0.50, "Automated on Some Systems", "Zautomatyzowane na części systemów", "#EAB308"),
        (3, 0.75, "Automated on Most Systems", "Zautomatyzowane na większości systemów", "#22C55E"),
        (4, 1.00, "Automated on All Systems", "Zautomatyzowane na wszystkich systemach", "#16A34A"),
    ]
    levels_report = [
        (0, 0.00, "Not Reported", "Nieraportowane", "#EF4444"),
        (1, 0.25, "Parts of Policy Reported", "Częściowo raportowane", "#F97316"),
        (2, 0.50, "Reported on Some Systems", "Raportowane na części systemów", "#EAB308"),
        (3, 0.75, "Reported on Most Systems", "Raportowane na większości systemów", "#22C55E"),
        (4, 1.00, "Reported on All Systems", "Raportowane na wszystkich systemach", "#16A34A"),
    ]

    dim_keys_levels = [
        ("policy_defined", levels_policy),
        ("control_implemented", levels_impl),
        ("control_automated", levels_auto),
        ("control_reported", levels_report),
    ]

    for dim_key, levels in dim_keys_levels:
        dim_id_row = conn.execute(text(
            "SELECT id FROM assessment_dimensions WHERE framework_id = :fw_id AND dimension_key = :dim_key"
        ), {"fw_id": fw_id, "dim_key": dim_key}).fetchone()
        dim_id = dim_id_row[0]

        for lvl_order, value, label, label_pl, color in levels:
            conn.execute(text("""
                INSERT INTO dimension_levels (dimension_id, level_order, value, label, label_pl, color)
                VALUES (:dim_id, :lvl_order, :value, :label, :label_pl, :color)
            """), {
                "dim_id": dim_id, "lvl_order": lvl_order, "value": value,
                "label": label, "label_pl": label_pl, "color": color,
            })

    # ── 16. Migrate cis_assessments → assessments ──
    conn.execute(text("""
        INSERT INTO assessments
            (framework_id, org_unit_id, title, assessor, assessment_date, status,
             notes, overall_score, is_active, created_at, updated_at)
        SELECT
            :fw_id,
            ca.org_unit_id,
            CONCAT('CIS v8 — ', COALESCE(ou.name, 'Cała organizacja'), ' — ',
                   DATE_FORMAT(ca.assessment_date, '%%Y-%%m-%%d')),
            ca.assessor_name,
            ca.assessment_date,
            CASE
                WHEN de.code = 'approved' THEN 'approved'
                ELSE 'draft'
            END,
            ca.notes,
            ca.risk_addressed_pct,
            TRUE,
            ca.created_at,
            ca.updated_at
        FROM cis_assessments ca
        LEFT JOIN org_units ou ON ou.id = ca.org_unit_id
        LEFT JOIN dictionary_entries de ON de.id = ca.status_id
    """), {"fw_id": fw_id})

    # ── 17. Migrate cis_assessment_answers → assessment_answers ──
    # Each old answer had 4 dimension values inline; we split into 4 separate rows.
    # Map old answer to new assessment via date/org_unit matching.

    # First get dimension IDs
    dim_rows = conn.execute(text(
        "SELECT id, dimension_key FROM assessment_dimensions WHERE framework_id = :fw_id"
    ), {"fw_id": fw_id}).fetchall()
    dim_map = {row[1]: row[0] for row in dim_rows}

    # For each old CIS answer, create 4 assessment_answer rows
    old_answers = conn.execute(text("""
        SELECT
            caa.id AS old_id,
            caa.assessment_id AS old_assessment_id,
            caa.sub_control_id,
            caa.is_not_applicable,
            caa.policy_value,
            caa.impl_value,
            caa.auto_value,
            caa.report_value,
            ca.org_unit_id,
            ca.assessment_date
        FROM cis_assessment_answers caa
        JOIN cis_assessments ca ON ca.id = caa.assessment_id
    """)).fetchall()

    if old_answers:
        # Build sub_control_id → framework_node_id map
        node_rows = conn.execute(text("""
            SELECT fn.id AS node_id, sc.id AS sub_control_id
            FROM framework_nodes fn
            JOIN cis_sub_controls sc
                ON fn.ref_id = sc.sub_id
            WHERE fn.framework_id = :fw_id AND fn.assessable = TRUE
        """), {"fw_id": fw_id}).fetchall()
        node_map = {row[1]: row[0] for row in node_rows}

        # Build old_assessment_id → new assessment id map
        new_assessments = conn.execute(text("""
            SELECT a.id, ca.id AS old_id
            FROM assessments a
            JOIN cis_assessments ca
                ON a.framework_id = :fw_id
                AND a.assessment_date = ca.assessment_date
                AND (a.org_unit_id <=> ca.org_unit_id)
        """), {"fw_id": fw_id}).fetchall()
        assess_map = {row[1]: row[0] for row in new_assessments}

        # Map dimension value column → level_id
        # Pre-build value→level_id map per dimension
        level_maps = {}
        for dim_key, dim_id in dim_map.items():
            lvl_rows = conn.execute(text(
                "SELECT id, value FROM dimension_levels WHERE dimension_id = :dim_id"
            ), {"dim_id": dim_id}).fetchall()
            level_maps[dim_key] = {float(row[1]): row[0] for row in lvl_rows}

        for ans in old_answers:
            old_assessment_id = ans[1]
            sub_control_id = ans[2]
            is_na = ans[3]
            policy_val = ans[4]
            impl_val = ans[5]
            auto_val = ans[6]
            report_val = ans[7]

            new_assessment_id = assess_map.get(old_assessment_id)
            node_id = node_map.get(sub_control_id)

            if not new_assessment_id or not node_id:
                continue

            for dim_key, val in [
                ("policy_defined", policy_val),
                ("control_implemented", impl_val),
                ("control_automated", auto_val),
                ("control_reported", report_val),
            ]:
                dim_id = dim_map[dim_key]
                level_id = None
                if val is not None:
                    level_id = level_maps[dim_key].get(float(val))

                conn.execute(text("""
                    INSERT INTO assessment_answers
                        (assessment_id, framework_node_id, dimension_id, level_id,
                         not_applicable, created_at, updated_at)
                    VALUES (:assessment_id, :node_id, :dim_id, :level_id,
                            :not_applicable, NOW(), NOW())
                """), {
                    "assessment_id": new_assessment_id,
                    "node_id": node_id,
                    "dim_id": dim_id,
                    "level_id": level_id,
                    "not_applicable": is_na,
                })


def downgrade() -> None:
    op.drop_table("assessment_answers")
    op.drop_table("assessments")
    op.drop_table("framework_node_security_areas")
    op.drop_table("dimension_levels")
    op.drop_table("assessment_dimensions")
    op.drop_table("framework_nodes")
    op.drop_table("frameworks")
