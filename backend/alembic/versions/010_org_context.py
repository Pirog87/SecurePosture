"""Organizational context (ISO 27001/22301 clause 4)

Revision ID: 010_org_context
Revises: 009_risk_catalogs_actions
Create Date: 2026-02-12

Creates:
  - Extends org_units with context fields
  - org_context_issues table
  - org_context_obligations table
  - org_context_stakeholders table
  - org_context_scope table
  - org_context_risk_appetite table
  - org_context_reviews table
  - org_context_snapshots table
  - Seeds 6 new dictionaries
"""
from alembic import op
import sqlalchemy as sa

revision = "010_org_context"
down_revision = "009_risk_catalogs_actions"
branch_labels = None
depends_on = None


def _tbl_exists(conn, table):
    return conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_name = :tbl"
    ), {"tbl": table}).scalar()


def _col_exists(conn, table, column):
    return conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_schema = DATABASE() AND table_name = :tbl AND column_name = :col"
    ), {"tbl": table, "col": column}).scalar()


def _seed_dictionary(conn, code, name, description, entries):
    """Insert a dictionary type + its entries if not already present."""
    existing = conn.execute(sa.text(
        "SELECT id FROM dictionary_types WHERE code = :code"
    ), {"code": code}).scalar()
    if existing:
        return
    conn.execute(sa.text(
        "INSERT INTO dictionary_types (code, name, description, is_system, created_at, updated_at) "
        "VALUES (:code, :name, :desc, 0, NOW(), NOW())"
    ), {"code": code, "name": name, "desc": description})
    dt_id = conn.execute(sa.text("SELECT LAST_INSERT_ID()")).scalar()
    for i, (entry_code, label) in enumerate(entries):
        conn.execute(sa.text(
            "INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order, is_active, created_at, updated_at) "
            "VALUES (:dt_id, :code, :label, :sort, 1, NOW(), NOW())"
        ), {"dt_id": dt_id, "code": entry_code, "label": label, "sort": i * 10})


def upgrade() -> None:
    conn = op.get_bind()

    # ══════════════════════════════════════════════
    # 1. Extend org_units with context fields
    # ══════════════════════════════════════════════
    new_cols = [
        ("headcount", "INT NULL"),
        ("context_review_date", "DATE NULL"),
        ("context_next_review", "DATE NULL"),
        ("context_reviewer", "VARCHAR(200) NULL"),
        ("context_status", "VARCHAR(20) NULL DEFAULT 'draft'"),
        ("mission_vision", "TEXT NULL"),
        ("key_products_services", "TEXT NULL"),
        ("strategic_objectives", "TEXT NULL"),
        ("key_processes_notes", "TEXT NULL"),
    ]
    for col_name, col_def in new_cols:
        if not _col_exists(conn, "org_units", col_name):
            op.execute(f"ALTER TABLE org_units ADD COLUMN {col_name} {col_def}")

    # ══════════════════════════════════════════════
    # 2. org_context_issues
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "org_context_issues"):
        op.create_table(
            "org_context_issues",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=False),
            sa.Column("issue_type", sa.String(20), nullable=False),  # internal / external
            sa.Column("category_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("title", sa.String(500), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("impact_level", sa.String(20), nullable=True),  # positive / negative / neutral
            sa.Column("relevance", sa.String(20), nullable=True),  # high / medium / low
            sa.Column("response_action", sa.Text, nullable=True),
            sa.Column("review_date", sa.Date, nullable=True),
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )
        op.create_index("ix_ctx_issues_org", "org_context_issues", ["org_unit_id"])

    # ══════════════════════════════════════════════
    # 3. org_context_obligations
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "org_context_obligations"):
        op.create_table(
            "org_context_obligations",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=False),
            sa.Column("obligation_type", sa.String(30), nullable=False),  # legal/regulatory/contractual/standard/internal
            sa.Column("regulation_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("custom_name", sa.String(500), nullable=True),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("responsible_person", sa.String(200), nullable=True),
            sa.Column("compliance_status", sa.String(30), nullable=True, server_default="not_assessed"),
            sa.Column("compliance_evidence", sa.Text, nullable=True),
            sa.Column("effective_from", sa.Date, nullable=True),
            sa.Column("review_date", sa.Date, nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )
        op.create_index("ix_ctx_obligations_org", "org_context_obligations", ["org_unit_id"])

    # ══════════════════════════════════════════════
    # 4. org_context_stakeholders
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "org_context_stakeholders"):
        op.create_table(
            "org_context_stakeholders",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=False),
            sa.Column("stakeholder_type", sa.String(20), nullable=False),  # internal / external
            sa.Column("category_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("name", sa.String(500), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("needs_expectations", sa.Text, nullable=True),
            sa.Column("requirements_type", sa.String(20), nullable=True),  # legal / contractual / voluntary
            sa.Column("requirements_detail", sa.Text, nullable=True),
            sa.Column("communication_channel", sa.String(200), nullable=True),
            sa.Column("influence_level", sa.String(20), nullable=True),  # high / medium / low
            sa.Column("relevance", sa.String(20), nullable=True),  # high / medium / low
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )
        op.create_index("ix_ctx_stakeholders_org", "org_context_stakeholders", ["org_unit_id"])

    # ══════════════════════════════════════════════
    # 5. org_context_scope
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "org_context_scope"):
        op.create_table(
            "org_context_scope",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=False),
            sa.Column("management_system_id", sa.Integer, sa.ForeignKey("dictionary_entries.id"), nullable=True),
            sa.Column("scope_statement", sa.Text, nullable=True),
            sa.Column("in_scope_description", sa.Text, nullable=True),
            sa.Column("out_of_scope_description", sa.Text, nullable=True),
            sa.Column("geographic_boundaries", sa.Text, nullable=True),
            sa.Column("technology_boundaries", sa.Text, nullable=True),
            sa.Column("organizational_boundaries", sa.Text, nullable=True),
            sa.Column("interfaces_dependencies", sa.Text, nullable=True),
            sa.Column("approved_by", sa.String(200), nullable=True),
            sa.Column("approved_date", sa.Date, nullable=True),
            sa.Column("version", sa.Integer, server_default="1", nullable=False),
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )
        op.create_index("ix_ctx_scope_org", "org_context_scope", ["org_unit_id"])

    # ══════════════════════════════════════════════
    # 6. org_context_risk_appetite
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "org_context_risk_appetite"):
        op.create_table(
            "org_context_risk_appetite",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=False, unique=True),
            sa.Column("risk_appetite_statement", sa.Text, nullable=True),
            sa.Column("max_acceptable_risk_level", sa.String(20), nullable=True),  # low / medium / high
            sa.Column("max_acceptable_risk_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("exception_approval_authority", sa.String(200), nullable=True),
            sa.Column("financial_risk_tolerance", sa.Text, nullable=True),
            sa.Column("reputational_risk_tolerance", sa.Text, nullable=True),
            sa.Column("operational_risk_tolerance", sa.Text, nullable=True),
            sa.Column("approved_by", sa.String(200), nullable=True),
            sa.Column("approved_date", sa.Date, nullable=True),
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 7. org_context_reviews
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "org_context_reviews"):
        op.create_table(
            "org_context_reviews",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=False),
            sa.Column("review_date", sa.Date, nullable=False),
            sa.Column("reviewer", sa.String(200), nullable=False),
            sa.Column("review_type", sa.String(20), nullable=False),  # scheduled / triggered / initial
            sa.Column("sections_reviewed", sa.JSON, nullable=True),
            sa.Column("changes_summary", sa.Text, nullable=True),
            sa.Column("approved_by", sa.String(200), nullable=True),
            sa.Column("approved_date", sa.Date, nullable=True),
            sa.Column("next_review_date", sa.Date, nullable=True),
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_ctx_reviews_org", "org_context_reviews", ["org_unit_id"])

    # ══════════════════════════════════════════════
    # 8. org_context_snapshots
    # ══════════════════════════════════════════════
    if not _tbl_exists(conn, "org_context_snapshots"):
        op.create_table(
            "org_context_snapshots",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=False),
            sa.Column("review_id", sa.Integer, sa.ForeignKey("org_context_reviews.id"), nullable=True),
            sa.Column("snapshot_date", sa.Date, nullable=False),
            sa.Column("snapshot_data", sa.JSON, nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )

    # ══════════════════════════════════════════════
    # 9. Seed dictionaries
    # ══════════════════════════════════════════════
    _seed_dictionary(conn, "context_issue_category", "Kategoria czynników kontekstu",
        "Kategorie czynników wewnętrznych i zewnętrznych (ISO 27001 kl. 4.1)", [
            ("CULTURE", "Kultura organizacyjna"),
            ("GOVERNANCE", "Struktura zarządzania i governance"),
            ("HR_COMPETENCE", "Zasoby ludzkie i kompetencje"),
            ("IT_INFRA", "Infrastruktura IT i technologia"),
            ("BUSINESS_PROCESS", "Procesy biznesowe"),
            ("SECURITY_MATURITY", "Dojrzałość bezpieczeństwa"),
            ("BUDGET", "Budżet i finanse"),
            ("CHANGE_MGMT", "Zarządzanie zmianą"),
            ("LEGAL_REGULATORY", "Otoczenie prawne i regulacyjne"),
            ("MARKET", "Otoczenie rynkowe i konkurencja"),
            ("TECHNOLOGY", "Otoczenie technologiczne"),
            ("GEOPOLITICAL", "Otoczenie polityczne i geopolityczne"),
            ("ECONOMIC", "Warunki ekonomiczne"),
            ("SUPPLY_CHAIN", "Łańcuch dostaw"),
            ("CUSTOMER_EXPECT", "Oczekiwania klientów"),
            ("MEDIA_REPUTATION", "Media i reputacja"),
        ])

    _seed_dictionary(conn, "regulation", "Regulacje i standardy",
        "Akty prawne, regulacje i standardy obowiązujące organizację", [
            ("RODO", "RODO / GDPR"),
            ("NIS2", "Dyrektywa NIS2"),
            ("DORA", "Rozporządzenie DORA"),
            ("KSC", "Krajowy System Cyberbezpieczeństwa"),
            ("PCI_DSS", "PCI DSS 4.0"),
            ("ISO27001", "ISO/IEC 27001:2022"),
            ("ISO22301", "ISO 22301:2019"),
            ("ISO9001", "ISO 9001:2015"),
            ("ISO14001", "ISO 14001:2015"),
            ("ISO20000", "ISO/IEC 20000-1:2018"),
            ("SOC2", "SOC 2 Type II"),
            ("KODEKS_PRACY", "Kodeks Pracy"),
        ])

    _seed_dictionary(conn, "stakeholder_category", "Kategoria interesariuszy",
        "Kategorie stron zainteresowanych (ISO 27001 kl. 4.2)", [
            ("BOARD", "Zarząd / Rada Nadzorcza"),
            ("EMPLOYEES", "Pracownicy"),
            ("UNIONS", "Związki zawodowe"),
            ("INTERNAL_AUDIT", "Audyt wewnętrzny"),
            ("LEGAL_DEPT", "Dział prawny"),
            ("IT_SECURITY", "Dział IT / Security"),
            ("CUSTOMERS", "Klienci"),
            ("SUPPLIERS", "Dostawcy i partnerzy biznesowi"),
            ("REGULATORS", "Organy regulacyjne (UODO, KNF, CSIRT, ABW)"),
            ("EXT_AUDITORS", "Audytorzy zewnętrzni / certyfikujący"),
            ("SHAREHOLDERS", "Akcjonariusze / Inwestorzy"),
            ("INSURERS", "Ubezpieczyciele"),
            ("MEDIA", "Media"),
            ("LOCAL_COMMUNITY", "Społeczność lokalna"),
            ("LAW_ENFORCEMENT", "Organy ścigania"),
        ])

    _seed_dictionary(conn, "management_system", "System zarządzania",
        "Systemy zarządzania ISO (zakres ISMS/BCMS/QMS)", [
            ("ISMS", "System Zarządzania Bezpieczeństwem Informacji (ISO 27001)"),
            ("BCMS", "System Zarządzania Ciągłością Działania (ISO 22301)"),
            ("QMS", "System Zarządzania Jakością (ISO 9001)"),
            ("EMS", "System Zarządzania Środowiskowego (ISO 14001)"),
            ("ITSMS", "System Zarządzania Usługami IT (ISO 20000)"),
            ("PIMS", "System Zarządzania Prywatnością (ISO 27701)"),
            ("COMBINED", "Zintegrowany System Zarządzania"),
        ])

    _seed_dictionary(conn, "compliance_status", "Status zgodności",
        "Status zgodności z regulacją / standardem", [
            ("COMPLIANT", "Zgodny"),
            ("PARTIALLY", "Częściowo zgodny"),
            ("NON_COMPLIANT", "Niezgodny"),
            ("NOT_ASSESSED", "Nieoceniany"),
        ])

    _seed_dictionary(conn, "obligation_type", "Typ zobowiązania",
        "Typ zobowiązania prawnego / regulacyjnego", [
            ("LEGAL", "Ustawa / akt prawny"),
            ("REGULATORY", "Wymaganie regulatora"),
            ("CONTRACTUAL", "Zobowiązanie umowne"),
            ("STANDARD", "Norma dobrowolna"),
            ("INTERNAL", "Polityka wewnętrzna"),
        ])


def downgrade() -> None:
    op.drop_table("org_context_snapshots")
    op.drop_table("org_context_reviews")
    op.drop_table("org_context_risk_appetite")
    op.drop_table("org_context_scope")
    op.drop_table("org_context_stakeholders")
    op.drop_table("org_context_obligations")
    op.drop_table("org_context_issues")
    # Note: not dropping org_units columns or dictionary seeds in downgrade
