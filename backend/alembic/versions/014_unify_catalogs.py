"""Unify catalogs: migrate risk FKs from legacy tables to smart catalog tables.

Revision ID: 014_unify_catalogs
Revises: 013_smart_catalog
Create Date: 2026-02-13

Moves risk module foreign keys from legacy catalog tables (threats, vulnerabilities,
safeguards) to smart catalog tables (threat_catalog, weakness_catalog, control_catalog).

Steps:
  1. Copy any user-created entries from legacy tables into smart catalog tables
  2. Build old→new ID mappings
  3. Recreate junction tables (risk_threats, risk_vulnerabilities, risk_safeguards)
     with FKs pointing to smart catalog
  4. Update risks.planned_safeguard_id FK to control_catalog
"""
from alembic import op
import sqlalchemy as sa

revision = "014_unify_catalogs"
down_revision = "013_smart_catalog"
branch_labels = None
depends_on = None


def _tbl_exists(conn, table):
    dialect = conn.dialect.name
    if dialect in ("mysql", "mariadb"):
        return conn.execute(sa.text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = :tbl"
        ), {"tbl": table}).scalar()
    else:
        return conn.execute(sa.text(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = :tbl"
        ), {"tbl": table}).scalar()


def _next_ref_id(conn, table, prefix):
    """Get next available ref_id counter for a smart catalog table."""
    row = conn.execute(sa.text(
        f"SELECT MAX(CAST(SUBSTR(ref_id, {len(prefix) + 2}) AS INTEGER)) FROM {table} "
        f"WHERE ref_id LIKE :pattern"
    ), {"pattern": f"{prefix}-%"}).scalar()
    return (row or 0) + 1


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    # ══════════════════════════════════════════════════════════════
    # Step 1: Migrate legacy catalog entries → smart catalog
    # ══════════════════════════════════════════════════════════════

    # --- threats → threat_catalog ---
    if _tbl_exists(conn, "threats"):
        legacy_threats = conn.execute(sa.text(
            "SELECT id, name, description, is_active FROM threats"
        )).fetchall()

        counter = _next_ref_id(conn, "threat_catalog", "T")
        threat_id_map = {}  # old_id → new_id

        for old_id, name, desc, is_active in legacy_threats:
            # Check if already exists in smart catalog by exact name
            existing = conn.execute(sa.text(
                "SELECT id FROM threat_catalog WHERE name = :name LIMIT 1"
            ), {"name": name}).scalar()

            if existing:
                threat_id_map[old_id] = existing
            else:
                ref_id = f"T-{counter:03d}"
                counter += 1
                conn.execute(sa.text(
                    "INSERT INTO threat_catalog (ref_id, name, description, category, source, is_system, is_active) "
                    "VALUES (:ref_id, :name, :desc, 'ORGANIZATIONAL', 'BOTH', 0, :active)"
                ), {"ref_id": ref_id, "name": name, "desc": desc, "active": is_active})
                new_id = conn.execute(sa.text(
                    "SELECT id FROM threat_catalog WHERE ref_id = :ref_id"
                ), {"ref_id": ref_id}).scalar()
                threat_id_map[old_id] = new_id

    # --- vulnerabilities → weakness_catalog ---
    if _tbl_exists(conn, "vulnerabilities"):
        legacy_vulns = conn.execute(sa.text(
            "SELECT id, name, description, is_active FROM vulnerabilities"
        )).fetchall()

        counter = _next_ref_id(conn, "weakness_catalog", "W")
        vuln_id_map = {}

        for old_id, name, desc, is_active in legacy_vulns:
            existing = conn.execute(sa.text(
                "SELECT id FROM weakness_catalog WHERE name = :name LIMIT 1"
            ), {"name": name}).scalar()

            if existing:
                vuln_id_map[old_id] = existing
            else:
                ref_id = f"W-{counter:03d}"
                counter += 1
                conn.execute(sa.text(
                    "INSERT INTO weakness_catalog (ref_id, name, description, category, is_system, is_active) "
                    "VALUES (:ref_id, :name, :desc, 'PROCESS', 0, :active)"
                ), {"ref_id": ref_id, "name": name, "desc": desc, "active": is_active})
                new_id = conn.execute(sa.text(
                    "SELECT id FROM weakness_catalog WHERE ref_id = :ref_id"
                ), {"ref_id": ref_id}).scalar()
                vuln_id_map[old_id] = new_id

    # --- safeguards → control_catalog ---
    if _tbl_exists(conn, "safeguards"):
        legacy_safeguards = conn.execute(sa.text(
            "SELECT id, name, description, is_active FROM safeguards"
        )).fetchall()

        counter = _next_ref_id(conn, "control_catalog", "C")
        sg_id_map = {}

        for old_id, name, desc, is_active in legacy_safeguards:
            existing = conn.execute(sa.text(
                "SELECT id FROM control_catalog WHERE name = :name LIMIT 1"
            ), {"name": name}).scalar()

            if existing:
                sg_id_map[old_id] = existing
            else:
                ref_id = f"C-{counter:03d}"
                counter += 1
                conn.execute(sa.text(
                    "INSERT INTO control_catalog (ref_id, name, description, category, implementation_type, is_system, is_active) "
                    "VALUES (:ref_id, :name, :desc, 'ORGANIZATIONAL', 'PREVENTIVE', 0, :active)"
                ), {"ref_id": ref_id, "name": name, "desc": desc, "active": is_active})
                new_id = conn.execute(sa.text(
                    "SELECT id FROM control_catalog WHERE ref_id = :ref_id"
                ), {"ref_id": ref_id}).scalar()
                sg_id_map[old_id] = new_id

    # ══════════════════════════════════════════════════════════════
    # Step 2: Save existing junction table data with mapped IDs
    # ══════════════════════════════════════════════════════════════

    risk_threats_data = []
    if _tbl_exists(conn, "risk_threats"):
        rows = conn.execute(sa.text("SELECT risk_id, threat_id, created_at FROM risk_threats")).fetchall()
        for risk_id, old_tid, created_at in rows:
            new_tid = threat_id_map.get(old_tid)
            if new_tid:
                risk_threats_data.append((risk_id, new_tid, created_at))

    risk_vulns_data = []
    if _tbl_exists(conn, "risk_vulnerabilities"):
        rows = conn.execute(sa.text("SELECT risk_id, vulnerability_id, created_at FROM risk_vulnerabilities")).fetchall()
        for risk_id, old_vid, created_at in rows:
            new_vid = vuln_id_map.get(old_vid)
            if new_vid:
                risk_vulns_data.append((risk_id, new_vid, created_at))

    risk_safeguards_data = []
    if _tbl_exists(conn, "risk_safeguards"):
        rows = conn.execute(sa.text("SELECT risk_id, safeguard_id, created_at FROM risk_safeguards")).fetchall()
        for risk_id, old_sid, created_at in rows:
            new_sid = sg_id_map.get(old_sid)
            if new_sid:
                risk_safeguards_data.append((risk_id, new_sid, created_at))

    # Save planned_safeguard_id mappings from risks table
    planned_sg_updates = []
    if _tbl_exists(conn, "risks"):
        rows = conn.execute(sa.text(
            "SELECT id, planned_safeguard_id FROM risks WHERE planned_safeguard_id IS NOT NULL"
        )).fetchall()
        for risk_id, old_sg_id in rows:
            new_sg_id = sg_id_map.get(old_sg_id)
            if new_sg_id:
                planned_sg_updates.append((risk_id, new_sg_id))

    # ══════════════════════════════════════════════════════════════
    # Step 3: Drop and recreate junction tables with new FKs
    # ══════════════════════════════════════════════════════════════

    # Drop old junction tables
    op.drop_table("risk_threats")
    op.drop_table("risk_vulnerabilities")
    op.drop_table("risk_safeguards")

    # Recreate with smart catalog FKs
    op.create_table(
        "risk_threats",
        sa.Column("risk_id", sa.Integer,
                  sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("threat_id", sa.Integer,
                  sa.ForeignKey("threat_catalog.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "risk_vulnerabilities",
        sa.Column("risk_id", sa.Integer,
                  sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("vulnerability_id", sa.Integer,
                  sa.ForeignKey("weakness_catalog.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "risk_safeguards",
        sa.Column("risk_id", sa.Integer,
                  sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("safeguard_id", sa.Integer,
                  sa.ForeignKey("control_catalog.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    # ══════════════════════════════════════════════════════════════
    # Step 4: Restore junction data with mapped IDs
    # ══════════════════════════════════════════════════════════════

    for risk_id, threat_id, created_at in risk_threats_data:
        conn.execute(sa.text(
            "INSERT INTO risk_threats (risk_id, threat_id, created_at) VALUES (:r, :t, :c)"
        ), {"r": risk_id, "t": threat_id, "c": created_at})

    for risk_id, vuln_id, created_at in risk_vulns_data:
        conn.execute(sa.text(
            "INSERT INTO risk_vulnerabilities (risk_id, vulnerability_id, created_at) VALUES (:r, :v, :c)"
        ), {"r": risk_id, "v": vuln_id, "c": created_at})

    for risk_id, sg_id, created_at in risk_safeguards_data:
        conn.execute(sa.text(
            "INSERT INTO risk_safeguards (risk_id, safeguard_id, created_at) VALUES (:r, :s, :c)"
        ), {"r": risk_id, "s": sg_id, "c": created_at})

    # ══════════════════════════════════════════════════════════════
    # Step 5: Update risks.planned_safeguard_id FK
    # ══════════════════════════════════════════════════════════════

    # Clear unmapped planned_safeguard_id values first
    if planned_sg_updates:
        mapped_risk_ids = [r for r, _ in planned_sg_updates]
        conn.execute(sa.text(
            "UPDATE risks SET planned_safeguard_id = NULL WHERE planned_safeguard_id IS NOT NULL"
        ))

    # Change FK constraint on risks.planned_safeguard_id
    if dialect in ("mysql", "mariadb"):
        # Find and drop the existing FK constraint
        fk_rows = conn.execute(sa.text(
            "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'risks' "
            "AND COLUMN_NAME = 'planned_safeguard_id' AND REFERENCED_TABLE_NAME IS NOT NULL"
        )).fetchall()
        for (fk_name,) in fk_rows:
            conn.execute(sa.text(f"ALTER TABLE risks DROP FOREIGN KEY {fk_name}"))
        # Add new FK
        conn.execute(sa.text(
            "ALTER TABLE risks ADD CONSTRAINT fk_risks_planned_safeguard_control "
            "FOREIGN KEY (planned_safeguard_id) REFERENCES control_catalog(id)"
        ))
    else:
        # SQLite: use batch mode to recreate the table with new FK
        with op.batch_alter_table("risks") as batch_op:
            batch_op.drop_constraint("fk_risks_planned_safeguard", type_="foreignkey")
            batch_op.create_foreign_key(
                "fk_risks_planned_safeguard_control",
                "control_catalog", ["planned_safeguard_id"], ["id"],
            )

    # Restore mapped planned_safeguard_id values
    for risk_id, new_sg_id in planned_sg_updates:
        conn.execute(sa.text(
            "UPDATE risks SET planned_safeguard_id = :sg WHERE id = :rid"
        ), {"sg": new_sg_id, "rid": risk_id})


def downgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    # Reverse: drop new junction tables, recreate with old FKs
    op.drop_table("risk_safeguards")
    op.drop_table("risk_vulnerabilities")
    op.drop_table("risk_threats")

    op.create_table(
        "risk_threats",
        sa.Column("risk_id", sa.Integer,
                  sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("threat_id", sa.Integer,
                  sa.ForeignKey("threats.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "risk_vulnerabilities",
        sa.Column("risk_id", sa.Integer,
                  sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("vulnerability_id", sa.Integer,
                  sa.ForeignKey("vulnerabilities.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "risk_safeguards",
        sa.Column("risk_id", sa.Integer,
                  sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("safeguard_id", sa.Integer,
                  sa.ForeignKey("safeguards.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    # Revert planned_safeguard_id FK
    if dialect in ("mysql", "mariadb"):
        fk_rows = conn.execute(sa.text(
            "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'risks' "
            "AND COLUMN_NAME = 'planned_safeguard_id' AND REFERENCED_TABLE_NAME IS NOT NULL"
        )).fetchall()
        for (fk_name,) in fk_rows:
            conn.execute(sa.text(f"ALTER TABLE risks DROP FOREIGN KEY {fk_name}"))
        conn.execute(sa.text(
            "ALTER TABLE risks ADD CONSTRAINT fk_risks_planned_safeguard "
            "FOREIGN KEY (planned_safeguard_id) REFERENCES safeguards(id)"
        ))
    else:
        with op.batch_alter_table("risks") as batch_op:
            batch_op.drop_constraint("fk_risks_planned_safeguard_control", type_="foreignkey")
            batch_op.create_foreign_key(
                "fk_risks_planned_safeguard",
                "safeguards", ["planned_safeguard_id"], ["id"],
            )
