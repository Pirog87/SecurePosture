"""Framework Engine: new tables + CIS data migration

Revision ID: 001_framework_engine
Revises:
Create Date: 2026-02-11

Creates: frameworks, framework_nodes, assessment_dimensions, dimension_levels,
         framework_node_security_areas, assessments, assessment_answers

Migrates data from: cis_controls, cis_sub_controls, cis_assessments,
                     cis_assessment_answers → new universal tables.

Adds columns to security_areas: code, icon, color, parent_id, order_id.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import JSON

revision = "001_framework_engine"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Extend security_areas ──────────────────────────────────
    op.add_column("security_areas", sa.Column("code", sa.String(50), unique=True, nullable=True))
    op.add_column("security_areas", sa.Column("icon", sa.String(50), nullable=True))
    op.add_column("security_areas", sa.Column("color", sa.String(7), nullable=True))
    op.add_column("security_areas", sa.Column(
        "parent_id", sa.Integer,
        sa.ForeignKey("security_areas.id", ondelete="SET NULL"),
        nullable=True,
    ))
    op.add_column("security_areas", sa.Column("order_id", sa.Integer, server_default="0", nullable=False))

    # ── 2. Create: frameworks ─────────────────────────────────────
    op.create_table(
        "frameworks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("urn", sa.String(500), unique=True, nullable=False),
        sa.Column("ref_id", sa.String(100), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("version", sa.String(50), nullable=True),
        sa.Column("provider", sa.String(200), nullable=True),
        sa.Column("packager", sa.String(200), nullable=True),
        sa.Column("copyright", sa.Text, nullable=True),
        sa.Column("source_format", sa.Enum(
            "ciso_assistant_excel", "ciso_assistant_yaml", "custom_import", "manual",
            name="source_format_enum",
        ), nullable=True),
        sa.Column("source_url", sa.String(1000), nullable=True),
        sa.Column("locale", sa.String(10), server_default="en", nullable=False),
        sa.Column("implementation_groups_definition", JSON, nullable=True),
        sa.Column("total_nodes", sa.Integer, server_default="0", nullable=False),
        sa.Column("total_assessable", sa.Integer, server_default="0", nullable=False),
        sa.Column("imported_at", sa.DateTime, nullable=True),
        sa.Column("imported_by", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )

    # ── 3. Create: framework_nodes ────────────────────────────────
    op.create_table(
        "framework_nodes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("framework_id", sa.Integer,
                  sa.ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", sa.Integer,
                  sa.ForeignKey("framework_nodes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("urn", sa.String(500), nullable=True),
        sa.Column("ref_id", sa.String(100), nullable=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("name_pl", sa.String(500), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("description_pl", sa.Text, nullable=True),
        sa.Column("depth", sa.Integer, server_default="1", nullable=False),
        sa.Column("order_id", sa.Integer, server_default="0", nullable=False),
        sa.Column("assessable", sa.Boolean, server_default=sa.text("0"), nullable=False),
        sa.Column("implementation_groups", sa.String(100), nullable=True),
        sa.Column("weight", sa.Integer, server_default="1", nullable=False),
        sa.Column("importance", sa.Enum(
            "mandatory", "recommended", "nice_to_have", "undefined",
            name="importance_enum",
        ), nullable=True),
        sa.Column("maturity_level", sa.Integer, nullable=True),
        sa.Column("annotation", sa.Text, nullable=True),
        sa.Column("threats", JSON, nullable=True),
        sa.Column("reference_controls", JSON, nullable=True),
        sa.Column("typical_evidence", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_fwnode_framework_parent", "framework_nodes", ["framework_id", "parent_id"])
    op.create_index("ix_fwnode_framework_depth", "framework_nodes", ["framework_id", "depth"])
    op.create_index("ix_fwnode_framework_assessable", "framework_nodes", ["framework_id", "assessable"])
    op.create_index("ix_fwnode_urn", "framework_nodes", ["urn"])

    # ── 4. Create: assessment_dimensions ──────────────────────────
    op.create_table(
        "assessment_dimensions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("framework_id", sa.Integer,
                  sa.ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dimension_key", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("name_pl", sa.String(200), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("order_id", sa.Integer, server_default="0", nullable=False),
        sa.Column("weight", sa.Numeric(3, 2), server_default="1.00", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
    )

    # ── 5. Create: dimension_levels ───────────────────────────────
    op.create_table(
        "dimension_levels",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("dimension_id", sa.Integer,
                  sa.ForeignKey("assessment_dimensions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("level_order", sa.Integer, nullable=False),
        sa.Column("value", sa.Numeric(5, 2), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("label_pl", sa.String(200), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
    )

    # ── 6. Create: framework_node_security_areas (M2M) ────────────
    op.create_table(
        "framework_node_security_areas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("framework_node_id", sa.Integer,
                  sa.ForeignKey("framework_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("security_area_id", sa.Integer,
                  sa.ForeignKey("security_areas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.Enum("seed", "manual", "ai_suggested",
                                     name="mapping_source_enum"),
                  server_default="manual", nullable=False),
        sa.Column("created_by", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("framework_node_id", "security_area_id", name="uq_fwnode_secarea"),
    )

    # ── 7. Create: assessments ────────────────────────────────────
    op.create_table(
        "assessments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=True),
        sa.Column("framework_id", sa.Integer,
                  sa.ForeignKey("frameworks.id"), nullable=False),
        sa.Column("org_unit_id", sa.Integer,
                  sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("security_area_id", sa.Integer,
                  sa.ForeignKey("security_areas.id"), nullable=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("assessor", sa.String(200), nullable=True),
        sa.Column("assessment_date", sa.Date, nullable=False),
        sa.Column("status", sa.Enum(
            "draft", "in_progress", "completed", "approved", "archived",
            name="assessment_status_enum",
        ), server_default="draft", nullable=False),
        sa.Column("implementation_group_filter", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("completion_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("overall_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("approved_by", sa.String(200), nullable=True),
        sa.Column("approved_at", sa.DateTime, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )

    # ── 8. Create: assessment_answers ─────────────────────────────
    op.create_table(
        "assessment_answers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("assessment_id", sa.Integer,
                  sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("framework_node_id", sa.Integer,
                  sa.ForeignKey("framework_nodes.id"), nullable=False),
        sa.Column("dimension_id", sa.Integer,
                  sa.ForeignKey("assessment_dimensions.id"), nullable=False),
        sa.Column("level_id", sa.Integer,
                  sa.ForeignKey("dimension_levels.id"), nullable=True),
        sa.Column("not_applicable", sa.Boolean, server_default=sa.text("0"), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("evidence", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("assessment_id", "framework_node_id", "dimension_id",
                            name="uq_assess_node_dim"),
    )

    # ── 9. Seed CIS v8 into new tables ───────────────────────────
    # This is the data migration step: we use raw SQL to transfer data
    # from legacy cis_* tables into the new framework engine tables.

    conn = op.get_bind()

    # 9a. Insert CIS v8 framework
    conn.execute(sa.text("""
        INSERT INTO frameworks (urn, ref_id, name, description, version, provider, packager,
                                source_format, locale,
                                implementation_groups_definition,
                                imported_at, imported_by, is_active)
        VALUES (
            'urn:intuitem:risk:framework:cis-controls-v8',
            'cis-controls-v8',
            'CIS Controls v8',
            'CIS Critical Security Controls Version 8 — 18 controls, 153 sub-controls',
            '8.0', 'CIS', 'secureposture', 'manual', 'en',
            '{"IG1": "Basic Cyber Hygiene", "IG2": "Foundational", "IG3": "Organizational"}',
            NOW(), 'system-migration', 1
        )
    """))

    fw_id_row = conn.execute(sa.text(
        "SELECT id FROM frameworks WHERE urn = 'urn:intuitem:risk:framework:cis-controls-v8'"
    )).fetchone()
    fw_id = fw_id_row[0]

    # 9b. Migrate cis_controls → framework_nodes (depth=1, assessable=false)
    conn.execute(sa.text("""
        INSERT INTO framework_nodes
            (framework_id, parent_id, urn, ref_id, name, name_pl,
             depth, order_id, assessable, is_active)
        SELECT
            :fw_id,
            NULL,
            CONCAT('urn:intuitem:risk:req_node:cis-controls-v8:', control_number),
            CAST(control_number AS CHAR),
            name_en,
            name_pl,
            1,
            control_number,
            0,
            1
        FROM cis_controls
        ORDER BY control_number
    """), {"fw_id": fw_id})

    # 9c. Migrate cis_sub_controls → framework_nodes (depth=2, assessable=true)
    conn.execute(sa.text("""
        INSERT INTO framework_nodes
            (framework_id, parent_id, urn, ref_id, name, name_pl, description, description_pl,
             depth, order_id, assessable, implementation_groups, is_active)
        SELECT
            :fw_id,
            fn_parent.id,
            CONCAT('urn:intuitem:risk:req_node:cis-controls-v8:', sc.sub_id),
            sc.sub_id,
            sc.detail_en,
            COALESCE(sc.detail_pl, ''),
            sc.detail_en,
            sc.detail_pl,
            2,
            CAST(SUBSTRING_INDEX(sc.sub_id, '.', -1) AS UNSIGNED),
            1,
            sc.implementation_groups,
            1
        FROM cis_sub_controls sc
        JOIN cis_controls cc ON cc.id = sc.control_id
        JOIN framework_nodes fn_parent
            ON fn_parent.framework_id = :fw_id
            AND fn_parent.ref_id = CAST(cc.control_number AS CHAR)
            AND fn_parent.depth = 1
        ORDER BY sc.sub_id
    """), {"fw_id": fw_id})

    # 9d. Update framework node counts
    node_count = conn.execute(sa.text(
        "SELECT COUNT(*) FROM framework_nodes WHERE framework_id = :fw_id"
    ), {"fw_id": fw_id}).scalar()
    assessable_count = conn.execute(sa.text(
        "SELECT COUNT(*) FROM framework_nodes WHERE framework_id = :fw_id AND assessable = 1"
    ), {"fw_id": fw_id}).scalar()
    conn.execute(sa.text(
        "UPDATE frameworks SET total_nodes = :tn, total_assessable = :ta WHERE id = :fw_id"
    ), {"tn": node_count, "ta": assessable_count, "fw_id": fw_id})

    # 9e. Create 4 CIS assessment dimensions
    cis_dimensions = [
        ("policy_defined",      "Policy Defined",      "Polityka zdefiniowana",      1),
        ("control_implemented", "Control Implemented",  "Kontrola wdrożona",          2),
        ("control_automated",   "Control Automated",    "Kontrola zautomatyzowana",   3),
        ("control_reported",    "Control Reported",     "Kontrola raportowana",       4),
    ]
    for dim_key, dim_name, dim_name_pl, dim_order in cis_dimensions:
        conn.execute(sa.text("""
            INSERT INTO assessment_dimensions
                (framework_id, dimension_key, name, name_pl, order_id, weight, is_active)
            VALUES (:fw_id, :key, :name, :name_pl, :ord, 1.00, 1)
        """), {"fw_id": fw_id, "key": dim_key, "name": dim_name,
               "name_pl": dim_name_pl, "ord": dim_order})

    # 9f. Create 5 levels per dimension (CIS standard 0.00-1.00)
    cis_levels = [
        (0, "0.00", "Not done",                         "Brak",                              "#EF4444"),
        (1, "0.25", "Informal / Parts",                  "Nieformalnie / Częściowo",          "#F97316"),
        (2, "0.50", "Partial / Some Systems",             "Częściowo / Część systemów",        "#EAB308"),
        (3, "0.75", "Written / Most Systems",             "Zapisane / Większość systemów",     "#22C55E"),
        (4, "1.00", "Approved / All Systems",             "Zatwierdzone / Wszystkie systemy",  "#16A34A"),
    ]

    dim_rows = conn.execute(sa.text(
        "SELECT id FROM assessment_dimensions WHERE framework_id = :fw_id ORDER BY order_id"
    ), {"fw_id": fw_id}).fetchall()

    for dim_row in dim_rows:
        dim_id = dim_row[0]
        for lvl_order, lvl_value, lvl_label, lvl_label_pl, lvl_color in cis_levels:
            conn.execute(sa.text("""
                INSERT INTO dimension_levels
                    (dimension_id, level_order, value, label, label_pl, color)
                VALUES (:dim_id, :ord, :val, :label, :label_pl, :color)
            """), {"dim_id": dim_id, "ord": lvl_order, "val": lvl_value,
                   "label": lvl_label, "label_pl": lvl_label_pl, "color": lvl_color})

    # 9g. Migrate cis_assessments → assessments
    conn.execute(sa.text("""
        INSERT INTO assessments
            (ref_id, framework_id, org_unit_id, title, assessor,
             assessment_date, status, notes,
             completion_pct, overall_score,
             is_active, created_at, updated_at)
        SELECT
            CONCAT('ASM-', LPAD(ca.id, 4, '0')),
            :fw_id,
            ca.org_unit_id,
            CONCAT('CIS v8 Assessment #', ca.id),
            ca.assessor_name,
            ca.assessment_date,
            CASE
                WHEN de.code = 'approved' THEN 'approved'
                ELSE 'draft'
            END,
            ca.notes,
            ca.risk_addressed_pct,
            ca.risk_addressed_pct,
            1,
            ca.created_at,
            ca.updated_at
        FROM cis_assessments ca
        LEFT JOIN dictionary_entries de ON de.id = ca.status_id
    """), {"fw_id": fw_id})

    # 9h. Migrate cis_assessment_answers → assessment_answers
    # Each old answer has 4 dimension values → 4 new rows
    # We need mapping: dimension_key → dimension_id, value → level_id

    dim_map = conn.execute(sa.text("""
        SELECT id, dimension_key FROM assessment_dimensions WHERE framework_id = :fw_id
    """), {"fw_id": fw_id}).fetchall()
    dim_id_map = {row[1]: row[0] for row in dim_map}

    # Build level_id lookup: (dimension_id, value) → level_id
    all_levels = conn.execute(sa.text("""
        SELECT dl.id, dl.dimension_id, dl.value
        FROM dimension_levels dl
        JOIN assessment_dimensions ad ON ad.id = dl.dimension_id
        WHERE ad.framework_id = :fw_id
    """), {"fw_id": fw_id}).fetchall()
    level_map = {}
    for lvl_id, dim_id, val in all_levels:
        level_map[(dim_id, str(val))] = lvl_id

    # Map old column → dimension_key
    old_cols = [
        ("policy_value", "policy_defined"),
        ("impl_value",   "control_implemented"),
        ("auto_value",   "control_automated"),
        ("report_value", "control_reported"),
    ]

    for old_col, dim_key in old_cols:
        dim_id = dim_id_map[dim_key]
        conn.execute(sa.text(f"""
            INSERT INTO assessment_answers
                (assessment_id, framework_node_id, dimension_id, level_id,
                 not_applicable, created_at, updated_at)
            SELECT
                a_new.id,
                fn.id,
                :dim_id,
                (SELECT dl.id FROM dimension_levels dl
                 WHERE dl.dimension_id = :dim_id
                 AND dl.value = COALESCE(caa.{old_col}, 0.00)
                 LIMIT 1),
                caa.is_not_applicable,
                caa.created_at,
                caa.updated_at
            FROM cis_assessment_answers caa
            JOIN cis_sub_controls sc ON sc.id = caa.sub_control_id
            JOIN framework_nodes fn
                ON fn.framework_id = :fw_id
                AND fn.ref_id = sc.sub_id
                AND fn.assessable = 1
            JOIN cis_assessments ca_old ON ca_old.id = caa.assessment_id
            JOIN assessments a_new
                ON a_new.framework_id = :fw_id
                AND a_new.ref_id = CONCAT('ASM-', LPAD(ca_old.id, 4, '0'))
        """), {"dim_id": dim_id, "fw_id": fw_id})

    # 9i. Set security_areas codes for default 13 areas
    area_codes = [
        (1, "WORKSTATIONS",         "monitor",   "#3B82F6"),
        (2, "MOBILE_DEVICES",       "smartphone","#8B5CF6"),
        (3, "DATA_PROTECTION",      "shield",    "#EF4444"),
        (4, "MFP_DEVICES",          "printer",   "#6B7280"),
        (5, "PAPER_DOCS",           "file-text", "#A3A3A3"),
        (6, "SECURITY_AWARENESS",   "users",     "#F59E0B"),
        (7, "PEOPLE",               "user",      "#EC4899"),
        (8, "NETWORK_INFRA",        "wifi",      "#10B981"),
        (9, "SERVER_INFRA",         "server",    "#0EA5E9"),
        (10,"TECH_INFRA",           "cpu",       "#6366F1"),
        (11,"M365_CLOUD",           "cloud",     "#2563EB"),
        (12,"ACCESS_CONTROL",       "lock",      "#DC2626"),
        (13,"PUBLIC_CLOUD",         "cloud",     "#7C3AED"),
    ]
    for sort_order, code, icon, color in area_codes:
        conn.execute(sa.text("""
            UPDATE security_areas
            SET code = :code, icon = :icon, color = :color, order_id = :order_id
            WHERE sort_order = :sort_order
        """), {"code": code, "icon": icon, "color": color,
               "order_id": sort_order, "sort_order": sort_order})


def downgrade() -> None:
    op.drop_table("assessment_answers")
    op.drop_table("assessments")
    op.drop_table("framework_node_security_areas")
    op.drop_table("dimension_levels")
    op.drop_table("assessment_dimensions")
    op.drop_index("ix_fwnode_urn", table_name="framework_nodes")
    op.drop_index("ix_fwnode_framework_assessable", table_name="framework_nodes")
    op.drop_index("ix_fwnode_framework_depth", table_name="framework_nodes")
    op.drop_index("ix_fwnode_framework_parent", table_name="framework_nodes")
    op.drop_table("framework_nodes")
    op.drop_table("frameworks")

    op.drop_column("security_areas", "order_id")
    op.drop_column("security_areas", "parent_id")
    op.drop_column("security_areas", "color")
    op.drop_column("security_areas", "icon")
    op.drop_column("security_areas", "code")
