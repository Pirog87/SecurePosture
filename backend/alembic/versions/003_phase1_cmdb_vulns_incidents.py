"""Phase 1: CMDB extension, Vulnerabilities, Incidents + 25 new dictionaries

Revision ID: 003_phase1_cmdb_vulns_incidents
Revises: 002_security_domains
Create Date: 2026-02-11

Changes:
  - Extend assets table with CMDB fields (ref_id, asset_subtype, technical_owner,
    environment_id, ip_address, hostname, os_version, vendor, support_end_date,
    status_id, last_scan_date, notes)
  - Extend risks table with vendor_id, source_type, source_id
  - Create vulnerabilities table
  - Create incidents table
  - Create incident_risks (M2M) table
  - Create incident_vulnerabilities (M2M) table
  - Seed 25 new dictionary types with entries
"""
from alembic import op
import sqlalchemy as sa

revision = "003_phase1_cmdb_vulns_incidents"
down_revision = "002_security_domains"
branch_labels = None
depends_on = None


def _col_exists(conn, table, column):
    return conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_schema = DATABASE() AND table_name = :tbl AND column_name = :col"
    ), {"tbl": table, "col": column}).scalar()


def _tbl_exists(conn, table):
    return conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_name = :tbl"
    ), {"tbl": table}).scalar()


def _idx_exists(conn, index_name):
    return conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.statistics "
        "WHERE table_schema = DATABASE() AND index_name = :idx"
    ), {"idx": index_name}).scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # ══════════════════════════════════════════════
    # 1. Extend assets table with CMDB fields
    # ══════════════════════════════════════════════
    asset_cols = [
        ("ref_id", sa.Column("ref_id", sa.String(20), nullable=True)),
        ("asset_subtype", sa.Column("asset_subtype", sa.String(100), nullable=True)),
        ("technical_owner", sa.Column("technical_owner", sa.String(200), nullable=True)),
        ("environment_id", sa.Column("environment_id", sa.Integer,
                                     sa.ForeignKey("dictionary_entries.id"), nullable=True)),
        ("ip_address", sa.Column("ip_address", sa.String(45), nullable=True)),
        ("hostname", sa.Column("hostname", sa.String(255), nullable=True)),
        ("os_version", sa.Column("os_version", sa.String(100), nullable=True)),
        ("vendor", sa.Column("vendor", sa.String(100), nullable=True)),
        ("support_end_date", sa.Column("support_end_date", sa.Date, nullable=True)),
        ("status_id", sa.Column("status_id", sa.Integer,
                                sa.ForeignKey("dictionary_entries.id"), nullable=True)),
        ("last_scan_date", sa.Column("last_scan_date", sa.Date, nullable=True)),
        ("notes", sa.Column("notes", sa.Text, nullable=True)),
    ]
    for col_name, col_def in asset_cols:
        if not _col_exists(conn, "assets", col_name):
            op.add_column("assets", col_def)

    # Auto-populate ref_id for existing assets
    conn.execute(sa.text("""
        UPDATE assets SET ref_id = CONCAT('AST-', LPAD(id, 4, '0'))
        WHERE ref_id IS NULL
    """))

    # ══════════════════════════════════════════════
    # 2. Extend risks table
    # ══════════════════════════════════════════════
    for col_name, col_def in [
        ("vendor_id", sa.Column("vendor_id", sa.Integer, nullable=True)),
        ("source_type", sa.Column("source_type", sa.String(50), nullable=True)),
        ("source_id", sa.Column("source_id", sa.Integer, nullable=True)),
    ]:
        if not _col_exists(conn, "risks", col_name):
            op.add_column("risks", col_def)

    # ══════════════════════════════════════════════
    # 3. Create vulnerabilities table
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "vulnerabilities_registry"):
        op.create_table(
            "vulnerabilities_registry",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("ref_id", sa.String(20), nullable=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("source_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("org_unit_id", sa.Integer,
                      sa.ForeignKey("org_units.id"), nullable=False),
            sa.Column("asset_id", sa.Integer,
                      sa.ForeignKey("assets.id"), nullable=True),
            sa.Column("category_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("severity_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("cvss_score", sa.Numeric(3, 1), nullable=True),
            sa.Column("cvss_vector", sa.String(255), nullable=True),
            sa.Column("cve_id", sa.String(20), nullable=True),
            sa.Column("status_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("remediation_priority_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("owner", sa.String(100), nullable=False),
            sa.Column("detected_at", sa.Date, nullable=False),
            sa.Column("closed_at", sa.Date, nullable=True),
            sa.Column("sla_deadline", sa.Date, nullable=True),
            sa.Column("remediation_notes", sa.Text, nullable=True),
            sa.Column("risk_id", sa.Integer,
                      sa.ForeignKey("risks.id"), nullable=True),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                      onupdate=sa.func.now(), nullable=False),
        )
    for idx in ["ix_vuln_status", "ix_vuln_severity", "ix_vuln_org_unit", "ix_vuln_asset"]:
        if not _idx_exists(conn, idx):
            col = {"ix_vuln_status": "status_id", "ix_vuln_severity": "severity_id",
                   "ix_vuln_org_unit": "org_unit_id", "ix_vuln_asset": "asset_id"}[idx]
            op.create_index(idx, "vulnerabilities_registry", [col])

    # ══════════════════════════════════════════════
    # 4. Create incidents table
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "incidents"):
        op.create_table(
            "incidents",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("ref_id", sa.String(20), nullable=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text, nullable=False),
            sa.Column("category_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("severity_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("org_unit_id", sa.Integer,
                      sa.ForeignKey("org_units.id"), nullable=False),
            sa.Column("asset_id", sa.Integer,
                      sa.ForeignKey("assets.id"), nullable=True),
            sa.Column("reported_by", sa.String(100), nullable=False),
            sa.Column("assigned_to", sa.String(100), nullable=False),
            sa.Column("status_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("reported_at", sa.DateTime, nullable=False),
            sa.Column("detected_at", sa.DateTime, nullable=True),
            sa.Column("closed_at", sa.DateTime, nullable=True),
            sa.Column("ttr_minutes", sa.Integer, nullable=True),
            sa.Column("impact_id", sa.Integer,
                      sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("personal_data_breach", sa.Boolean, server_default=sa.text("0"), nullable=False),
            sa.Column("authority_notification", sa.Boolean, server_default=sa.text("0"), nullable=False),
            sa.Column("actions_taken", sa.Text, nullable=True),
            sa.Column("root_cause", sa.Text, nullable=True),
            sa.Column("lessons_learned", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(),
                      onupdate=sa.func.now(), nullable=False),
        )
    for idx in ["ix_inc_status", "ix_inc_severity", "ix_inc_org_unit"]:
        if not _idx_exists(conn, idx):
            col = {"ix_inc_status": "status_id", "ix_inc_severity": "severity_id",
                   "ix_inc_org_unit": "org_unit_id"}[idx]
            op.create_index(idx, "incidents", [col])

    # ══════════════════════════════════════════════
    # 5. Create M2M tables
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "incident_risks"):
        op.create_table(
            "incident_risks",
            sa.Column("incident_id", sa.Integer,
                      sa.ForeignKey("incidents.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("risk_id", sa.Integer,
                      sa.ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )

    if not _tbl_exists(conn, "incident_vulnerabilities"):
        op.create_table(
            "incident_vulnerabilities",
            sa.Column("incident_id", sa.Integer,
                      sa.ForeignKey("incidents.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("vulnerability_id", sa.Integer,
                      sa.ForeignKey("vulnerabilities_registry.id", ondelete="CASCADE"),
                      primary_key=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 6. Seed 25 new dictionary types + entries
    # ══════════════════════════════════════════════
    _DICTS = {
        # ── Vulnerability dictionaries ──
        "vuln_source": {
            "name": "Źródło podatności",
            "entries": [
                ("scanner", "Skaner automatyczny", 1),
                ("pentest", "Pen-test", 2),
                ("audit_int", "Audyt wewnętrzny", 3),
                ("audit_ext", "Audyt zewnętrzny", 4),
                ("manual", "Zgłoszenie ręczne", 5),
            ],
        },
        "vuln_category": {
            "name": "Kategoria podatności",
            "entries": [
                ("config", "Konfiguracja", 1),
                ("patching", "Patching", 2),
                ("code", "Kod", 3),
                ("network", "Sieć", 4),
                ("identity", "Tożsamość", 5),
                ("crypto", "Kryptografia", 6),
                ("other", "Inne", 7),
            ],
        },
        "severity_universal": {
            "name": "Ważność (uniwersalna)",
            "entries": [
                ("critical", "Krytyczny", 1),
                ("high", "Wysoki", 2),
                ("medium", "Średni", 3),
                ("low", "Niski", 4),
                ("info", "Informacyjny", 5),
            ],
        },
        "remediation_priority": {
            "name": "Priorytet remediacji",
            "entries": [
                ("P1", "P1 (7 dni)", 1),
                ("P2", "P2 (30 dni)", 2),
                ("P3", "P3 (90 dni)", 3),
                ("P4", "P4 (180 dni)", 4),
            ],
        },
        "vuln_status": {
            "name": "Status podatności",
            "entries": [
                ("new", "Nowa", 1),
                ("analysis", "W analizie", 2),
                ("remediation", "W remediacji", 3),
                ("closed", "Zamknięta", 4),
                ("accepted", "Zaakceptowana", 5),
            ],
        },
        # ── Incident dictionaries ──
        "incident_category": {
            "name": "Kategoria incydentu",
            "entries": [
                ("phishing", "Phishing", 1),
                ("malware", "Malware", 2),
                ("data_leak", "Data Leak", 3),
                ("unauth_access", "Unauthorized Access", 4),
                ("ddos", "DDoS", 5),
                ("insider", "Insider Threat", 6),
                ("social_eng", "Social Engineering", 7),
                ("physical", "Physical", 8),
                ("config_error", "Configuration Error", 9),
                ("other", "Inne", 10),
            ],
        },
        "incident_status": {
            "name": "Status incydentu",
            "entries": [
                ("reported", "Zgłoszony", 1),
                ("analysis", "W analizie", 2),
                ("handling", "W obsłudze", 3),
                ("closed", "Zamknięty", 4),
            ],
        },
        "incident_impact": {
            "name": "Wpływ incydentu",
            "entries": [
                ("none", "Brak wpływu", 1),
                ("minimal", "Minimalny", 2),
                ("limited", "Ograniczony", 3),
                ("significant", "Znaczący", 4),
                ("critical", "Krytyczny", 5),
            ],
        },
        # ── Exception dictionaries ──
        "exception_category": {
            "name": "Kategoria wyjątku",
            "entries": [
                ("config", "Konfiguracja", 1),
                ("access", "Dostęp", 2),
                ("network", "Sieć", 3),
                ("data", "Dane", 4),
                ("crypto", "Kryptografia", 5),
                ("physical", "Fizyczne", 6),
                ("other", "Inne", 7),
            ],
        },
        "exception_status": {
            "name": "Status wyjątku",
            "entries": [
                ("requested", "Wnioskowany", 1),
                ("approved", "Zatwierdzony", 2),
                ("active", "Aktywny", 3),
                ("expired", "Wygasły", 4),
                ("renewed", "Odnowiony", 5),
                ("closed", "Zamknięty", 6),
                ("rejected", "Odrzucony", 7),
            ],
        },
        # ── Audit dictionaries ──
        "audit_type": {
            "name": "Typ audytu",
            "entries": [
                ("internal", "Wewnętrzny", 1),
                ("external", "Zewnętrzny", 2),
                ("regulatory", "Regulacyjny", 3),
                ("certification", "Certyfikacyjny", 4),
                ("pentest", "Pen-test", 5),
            ],
        },
        "audit_rating": {
            "name": "Ocena audytu",
            "entries": [
                ("positive", "Pozytywna", 1),
                ("conditional", "Warunkowo pozytywna", 2),
                ("negative", "Negatywna", 3),
                ("na", "N/A", 4),
            ],
        },
        "finding_type": {
            "name": "Typ findingu",
            "entries": [
                ("major_nc", "Niezgodność główna", 1),
                ("minor_nc", "Niezgodność drobna", 2),
                ("observation", "Obserwacja", 3),
                ("recommendation", "Rekomendacja", 4),
                ("strength", "Mocna strona", 5),
            ],
        },
        "finding_status": {
            "name": "Status findingu",
            "entries": [
                ("new", "Nowy", 1),
                ("remediation", "W remediacji", 2),
                ("verification", "Do weryfikacji", 3),
                ("closed", "Zamknięty", 4),
                ("accepted", "Zaakceptowany", 5),
            ],
        },
        # ── Asset dictionaries ──
        "asset_type": {
            "name": "Typ aktywa",
            "entries": [
                ("server", "Serwer", 1),
                ("application", "Aplikacja", 2),
                ("database", "Baza danych", 3),
                ("workstation", "Stacja robocza", 4),
                ("network_device", "Urządzenie sieciowe", 5),
                ("mobile_device", "Urządzenie mobilne", 6),
                ("cloud_service", "Usługa chmurowa", 7),
                ("data", "Dane", 8),
                ("other", "Inne", 9),
            ],
        },
        "asset_status": {
            "name": "Status aktywa",
            "entries": [
                ("active", "Aktywny", 1),
                ("building", "W budowie", 2),
                ("decommissioning", "Wycofywany", 3),
                ("decommissioned", "Wycofany", 4),
            ],
        },
        "asset_environment": {
            "name": "Środowisko aktywa",
            "entries": [
                ("production", "Produkcja", 1),
                ("staging", "Staging", 2),
                ("development", "Development", 3),
                ("test", "Test", 4),
            ],
        },
        "data_sensitivity": {
            "name": "Wrażliwość danych",
            "entries": [
                ("public", "Publiczne", 1),
                ("internal", "Wewnętrzne", 2),
                ("confidential", "Poufne", 3),
                ("top_secret", "Ściśle tajne", 4),
            ],
        },
        # ── Vendor dictionaries ──
        "vendor_category": {
            "name": "Kategoria dostawcy",
            "entries": [
                ("cloud", "Cloud Provider", 1),
                ("saas", "SaaS", 2),
                ("outsourcing", "Outsourcing IT", 3),
                ("consulting", "Consulting", 4),
                ("hardware", "Hardware", 5),
                ("telco", "Telco", 6),
                ("other", "Inne", 7),
            ],
        },
        "vendor_status": {
            "name": "Status dostawcy",
            "entries": [
                ("active", "Aktywny", 1),
                ("evaluation", "W ocenie", 2),
                ("suspended", "Zawieszony", 3),
                ("terminated", "Zakończony", 4),
            ],
        },
        "vendor_data_access": {
            "name": "Dostęp dostawcy do danych",
            "entries": [
                ("none", "Brak dostępu", 1),
                ("internal", "Dane wewnętrzne", 2),
                ("confidential", "Dane poufne", 3),
                ("personal", "Dane osobowe", 4),
            ],
        },
        "vendor_risk_rating": {
            "name": "Ocena ryzyka dostawcy",
            "entries": [
                ("A", "A (niskie ryzyko)", 1),
                ("B", "B", 2),
                ("C", "C", 3),
                ("D", "D (wysokie ryzyko)", 4),
            ],
        },
        # ── Awareness dictionaries ──
        "campaign_type": {
            "name": "Typ kampanii awareness",
            "entries": [
                ("online_training", "Szkolenie online", 1),
                ("onsite_training", "Szkolenie stacjonarne", 2),
                ("phishing_sim", "Phishing simulation", 3),
                ("knowledge_test", "Test wiedzy", 4),
            ],
        },
        "campaign_status": {
            "name": "Status kampanii",
            "entries": [
                ("planned", "Planowana", 1),
                ("ongoing", "W trakcie", 2),
                ("completed", "Zakończona", 3),
            ],
        },
        # ── Policy dictionaries ──
        "policy_category": {
            "name": "Kategoria polityki",
            "entries": [
                ("it_security", "Bezpieczeństwo IT", 1),
                ("data_protection", "Ochrona danych", 2),
                ("access", "Dostęp", 3),
                ("network", "Sieć", 4),
                ("physical", "Fizyczne", 5),
                ("bcp", "Ciągłość działania", 6),
                ("hr", "HR", 7),
                ("other", "Inne", 8),
            ],
        },
        "policy_status": {
            "name": "Status polityki",
            "entries": [
                ("draft", "Robocza", 1),
                ("review", "W recenzji", 2),
                ("approved", "Zatwierdzona", 3),
                ("retired", "Wycofana", 4),
            ],
        },
    }

    for type_code, type_data in _DICTS.items():
        # Insert dictionary type (skip if already exists)
        exists = conn.execute(sa.text(
            "SELECT id FROM dictionary_types WHERE code = :code"
        ), {"code": type_code}).scalar()

        if not exists:
            conn.execute(sa.text("""
                INSERT INTO dictionary_types (code, name, is_system, created_at, updated_at)
                VALUES (:code, :name, 1, NOW(), NOW())
            """), {"code": type_code, "name": type_data["name"]})

        # Get the type id
        type_id = conn.execute(sa.text(
            "SELECT id FROM dictionary_types WHERE code = :code"
        ), {"code": type_code}).scalar()

        # Insert entries (skip duplicates)
        for entry_code, entry_label, sort_order in type_data["entries"]:
            entry_exists = conn.execute(sa.text(
                "SELECT COUNT(*) FROM dictionary_entries "
                "WHERE dict_type_id = :type_id AND code = :code"
            ), {"type_id": type_id, "code": entry_code}).scalar()
            if not entry_exists:
                conn.execute(sa.text("""
                    INSERT INTO dictionary_entries
                        (dict_type_id, code, label, sort_order, is_active, created_at, updated_at)
                    VALUES (:type_id, :code, :label, :sort, 1, NOW(), NOW())
                """), {
                    "type_id": type_id,
                    "code": entry_code,
                    "label": entry_label,
                    "sort": sort_order,
                })


def downgrade() -> None:
    op.drop_table("incident_vulnerabilities")
    op.drop_table("incident_risks")
    op.drop_index("ix_inc_org_unit", table_name="incidents")
    op.drop_index("ix_inc_severity", table_name="incidents")
    op.drop_index("ix_inc_status", table_name="incidents")
    op.drop_table("incidents")
    op.drop_index("ix_vuln_asset", table_name="vulnerabilities_registry")
    op.drop_index("ix_vuln_org_unit", table_name="vulnerabilities_registry")
    op.drop_index("ix_vuln_severity", table_name="vulnerabilities_registry")
    op.drop_index("ix_vuln_status", table_name="vulnerabilities_registry")
    op.drop_table("vulnerabilities_registry")

    op.drop_column("risks", "source_id")
    op.drop_column("risks", "source_type")
    op.drop_column("risks", "vendor_id")

    op.drop_column("assets", "notes")
    op.drop_column("assets", "last_scan_date")
    op.drop_column("assets", "status_id")
    op.drop_column("assets", "support_end_date")
    op.drop_column("assets", "vendor")
    op.drop_column("assets", "os_version")
    op.drop_column("assets", "hostname")
    op.drop_column("assets", "ip_address")
    op.drop_column("assets", "environment_id")
    op.drop_column("assets", "technical_owner")
    op.drop_column("assets", "asset_subtype")
    op.drop_column("assets", "ref_id")

    # Note: dictionary seed data removal is not done in downgrade
    # as it would require knowing exact IDs
