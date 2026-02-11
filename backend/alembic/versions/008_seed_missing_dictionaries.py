"""Ensure all dictionary types and entries exist (idempotent seed).

Revision ID: 008_seed_missing_dictionaries
Revises: 007_nullable_framework_urn_ref_id
"""
from alembic import op
import sqlalchemy as sa

revision = "008_seed_missing_dictionaries"
down_revision = "007_nullable_framework_urn_ref_id"

_DICTS = {
    "exception_category": {
        "name": "Kategoria wyjatku",
        "entries": [
            ("config", "Konfiguracja", 1),
            ("access", "Dostep", 2),
            ("network", "Siec", 3),
            ("data", "Dane", 4),
            ("crypto", "Kryptografia", 5),
            ("physical", "Fizyczne", 6),
            ("other", "Inne", 7),
        ],
    },
    "exception_status": {
        "name": "Status wyjatku",
        "entries": [
            ("requested", "Wnioskowany", 1),
            ("approved", "Zatwierdzony", 2),
            ("active", "Aktywny", 3),
            ("expired", "Wygasly", 4),
            ("renewed", "Odnowiony", 5),
            ("closed", "Zamkniety", 6),
            ("rejected", "Odrzucony", 7),
        ],
    },
    "severity_universal": {
        "name": "Waznosc (uniwersalna)",
        "entries": [
            ("critical", "Krytyczny", 1),
            ("high", "Wysoki", 2),
            ("medium", "Sredni", 3),
            ("low", "Niski", 4),
            ("info", "Informacyjny", 5),
        ],
    },
    "vuln_source": {
        "name": "Zrodlo podatnosci",
        "entries": [
            ("scanner", "Skaner automatyczny", 1),
            ("pentest", "Pen-test", 2),
            ("audit_int", "Audyt wewnetrzny", 3),
            ("audit_ext", "Audyt zewnetrzny", 4),
            ("manual", "Zgloszenie reczne", 5),
        ],
    },
    "vuln_category": {
        "name": "Kategoria podatnosci",
        "entries": [
            ("config", "Konfiguracja", 1),
            ("patching", "Patching", 2),
            ("code", "Kod", 3),
            ("network", "Siec", 4),
            ("identity", "Tozsamosc", 5),
            ("crypto", "Kryptografia", 6),
            ("other", "Inne", 7),
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
        "name": "Status podatnosci",
        "entries": [
            ("new", "Nowa", 1),
            ("analysis", "W analizie", 2),
            ("remediation", "W remediacji", 3),
            ("closed", "Zamknieta", 4),
            ("accepted", "Zaakceptowana", 5),
        ],
    },
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
            ("reported", "Zgloszony", 1),
            ("analysis", "W analizie", 2),
            ("handling", "W obsludze", 3),
            ("closed", "Zamkniety", 4),
        ],
    },
    "incident_impact": {
        "name": "Wplyw incydentu",
        "entries": [
            ("none", "Brak wplywu", 1),
            ("minimal", "Minimalny", 2),
            ("limited", "Ograniczony", 3),
            ("significant", "Znaczacy", 4),
            ("critical", "Krytyczny", 5),
        ],
    },
    "audit_type": {
        "name": "Typ audytu",
        "entries": [
            ("internal", "Wewnetrzny", 1),
            ("external", "Zewnetrzny", 2),
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
            ("major_nc", "Niezgodnosc glowna", 1),
            ("minor_nc", "Niezgodnosc drobna", 2),
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
            ("closed", "Zamkniety", 4),
            ("accepted", "Zaakceptowany", 5),
        ],
    },
    "policy_category": {
        "name": "Kategoria polityki",
        "entries": [
            ("it_security", "Bezpieczenstwo IT", 1),
            ("data_protection", "Ochrona danych", 2),
            ("access", "Dostep", 3),
            ("network", "Siec", 4),
            ("physical", "Fizyczne", 5),
            ("bcp", "Ciaglosc dzialania", 6),
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
            ("completed", "Zakonczona", 3),
        ],
    },
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
            ("terminated", "Zakonczony", 4),
        ],
    },
    "vendor_data_access": {
        "name": "Dostep dostawcy do danych",
        "entries": [
            ("none", "Brak dostepu", 1),
            ("internal", "Dane wewnetrzne", 2),
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
    "asset_type": {
        "name": "Typ aktywa",
        "entries": [
            ("server", "Serwer", 1),
            ("application", "Aplikacja", 2),
            ("database", "Baza danych", 3),
            ("workstation", "Stacja robocza", 4),
            ("network_device", "Urzadzenie sieciowe", 5),
            ("mobile_device", "Urzadzenie mobilne", 6),
            ("cloud_service", "Usluga chmurowa", 7),
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
        "name": "Srodowisko aktywa",
        "entries": [
            ("production", "Produkcja", 1),
            ("staging", "Staging", 2),
            ("development", "Development", 3),
            ("test", "Test", 4),
        ],
    },
    "data_sensitivity": {
        "name": "Wrazliwosc danych",
        "entries": [
            ("public", "Publiczne", 1),
            ("internal", "Wewnetrzne", 2),
            ("confidential", "Poufne", 3),
            ("top_secret", "Scisle tajne", 4),
        ],
    },
}


def upgrade() -> None:
    conn = op.get_bind()
    for type_code, type_data in _DICTS.items():
        existing_id = conn.execute(sa.text(
            "SELECT id FROM dictionary_types WHERE code = :code"
        ), {"code": type_code}).scalar()

        if not existing_id:
            conn.execute(sa.text(
                "INSERT INTO dictionary_types (code, name, is_system, created_at, updated_at) "
                "VALUES (:code, :name, 1, NOW(), NOW())"
            ), {"code": type_code, "name": type_data["name"]})
            existing_id = conn.execute(sa.text(
                "SELECT id FROM dictionary_types WHERE code = :code"
            ), {"code": type_code}).scalar()

        for entry_code, entry_label, sort_order in type_data["entries"]:
            entry_exists = conn.execute(sa.text(
                "SELECT id FROM dictionary_entries "
                "WHERE dict_type_id = :tid AND code = :code"
            ), {"tid": existing_id, "code": entry_code}).scalar()

            if not entry_exists:
                conn.execute(sa.text(
                    "INSERT INTO dictionary_entries "
                    "(dict_type_id, code, label, sort_order, is_active, created_at, updated_at) "
                    "VALUES (:tid, :code, :label, :sort, 1, NOW(), NOW())"
                ), {
                    "tid": existing_id,
                    "code": entry_code,
                    "label": entry_label,
                    "sort": sort_order,
                })


def downgrade() -> None:
    pass
