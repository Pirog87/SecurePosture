"""Smart Catalog: catalog tables, correlation links, AI config, seed data

Revision ID: 013_smart_catalog
Revises: 012_cmdb_categories
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

revision = "013_smart_catalog"
down_revision = "012_cmdb_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. threat_catalog ──
    op.create_table(
        "threat_catalog",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("source", sa.String(15), server_default="BOTH", nullable=False),
        sa.Column("cia_impact", sa.JSON, nullable=True),
        sa.Column("is_system", sa.Boolean, server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_threat_ref_org", "threat_catalog", ["ref_id", "org_unit_id"])

    # ── 2. weakness_catalog ──
    op.create_table(
        "weakness_catalog",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("is_system", sa.Boolean, server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_weakness_ref_org", "weakness_catalog", ["ref_id", "org_unit_id"])

    # ── 3. control_catalog ──
    op.create_table(
        "control_catalog",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ref_id", sa.String(20), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("implementation_type", sa.String(20), nullable=False),
        sa.Column("is_system", sa.Boolean, server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_control_ref_org", "control_catalog", ["ref_id", "org_unit_id"])

    # ── 4. M2M: catalog ↔ asset_category ──
    op.create_table(
        "threat_asset_category",
        sa.Column("threat_id", sa.Integer, sa.ForeignKey("threat_catalog.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("asset_category_id", sa.Integer, sa.ForeignKey("asset_categories.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "weakness_asset_category",
        sa.Column("weakness_id", sa.Integer, sa.ForeignKey("weakness_catalog.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("asset_category_id", sa.Integer, sa.ForeignKey("asset_categories.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "control_catalog_asset_category",
        sa.Column("control_id", sa.Integer, sa.ForeignKey("control_catalog.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("asset_category_id", sa.Integer, sa.ForeignKey("asset_categories.id", ondelete="CASCADE"), primary_key=True),
    )

    # ── 5. Correlation link tables ──
    op.create_table(
        "threat_weakness_link",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("threat_id", sa.Integer, sa.ForeignKey("threat_catalog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weakness_id", sa.Integer, sa.ForeignKey("weakness_catalog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relevance", sa.String(10), server_default="MEDIUM", nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_system", sa.Boolean, server_default=sa.text("0"), nullable=False),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_threat_weakness", "threat_weakness_link", ["threat_id", "weakness_id"])

    op.create_table(
        "threat_control_link",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("threat_id", sa.Integer, sa.ForeignKey("threat_catalog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("control_id", sa.Integer, sa.ForeignKey("control_catalog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("effectiveness", sa.String(10), server_default="MEDIUM", nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_system", sa.Boolean, server_default=sa.text("0"), nullable=False),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_threat_control", "threat_control_link", ["threat_id", "control_id"])

    op.create_table(
        "weakness_control_link",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("weakness_id", sa.Integer, sa.ForeignKey("weakness_catalog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("control_id", sa.Integer, sa.ForeignKey("control_catalog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("effectiveness", sa.String(10), server_default="MEDIUM", nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_system", sa.Boolean, server_default=sa.text("0"), nullable=False),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_weakness_control", "weakness_control_link", ["weakness_id", "control_id"])

    # ── 6. AI Provider Config ──
    op.create_table(
        "ai_provider_config",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("provider_type", sa.String(20), server_default="none", nullable=False),
        sa.Column("api_endpoint", sa.String(500), nullable=True),
        sa.Column("api_key_encrypted", sa.LargeBinary, nullable=True),
        sa.Column("model_name", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("0"), nullable=False),
        sa.Column("max_tokens", sa.Integer, server_default="4000", nullable=False),
        sa.Column("temperature", sa.Numeric(3, 2), server_default="0.30", nullable=False),
        sa.Column("max_requests_per_user_per_hour", sa.Integer, server_default="20", nullable=False),
        sa.Column("max_requests_per_user_per_day", sa.Integer, server_default="100", nullable=False),
        sa.Column("max_requests_per_org_per_day", sa.Integer, server_default="500", nullable=False),
        sa.Column("feature_scenario_generation", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("feature_correlation_enrichment", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("feature_natural_language_search", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("feature_gap_analysis", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("feature_entry_assist", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("last_test_at", sa.DateTime, nullable=True),
        sa.Column("last_test_ok", sa.Boolean, nullable=True),
        sa.Column("last_test_error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
    )

    # ── 7. AI Audit Log ──
    op.create_table(
        "ai_audit_log",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("org_unit_id", sa.Integer, sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("action_type", sa.String(30), nullable=False),
        sa.Column("provider_type", sa.String(20), nullable=False),
        sa.Column("model_used", sa.String(100), nullable=False),
        sa.Column("input_summary", sa.Text, nullable=True),
        sa.Column("output_summary", sa.Text, nullable=True),
        sa.Column("tokens_input", sa.Integer, nullable=True),
        sa.Column("tokens_output", sa.Integer, nullable=True),
        sa.Column("cost_usd", sa.Numeric(10, 6), nullable=True),
        sa.Column("accepted", sa.Boolean, nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("success", sa.Boolean, server_default=sa.text("1"), nullable=False),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    # ── 8. Seed data ──
    _seed_catalogs(op.get_bind())


# ═══════════════════════════════════════════════════════════════════
# Seed data
# ═══════════════════════════════════════════════════════════════════

def _seed_catalogs(conn):
    """Insert comprehensive seed data for Smart Catalog."""

    # ── THREATS ──
    threats = [
        # (ref_id, name, description, category, source, cia_C, cia_I, cia_A, asset_category_codes[])
        ("T-001", "Pozar", "Pozar w budynku lub serwerowni powodujacy zniszczenie infrastruktury", "ENVIRONMENTAL", "EXTERNAL", False, False, True, ["servers", "rooms", "racks", "documents", "storage_media"]),
        ("T-002", "Powodz / zalanie", "Zalanie pomieszczen woda z powodu awarii lub zdarzen naturalnych", "ENVIRONMENTAL", "EXTERNAL", False, False, True, ["servers", "rooms", "racks", "documents"]),
        ("T-003", "Awaria zasilania", "Dlugotrawala przerwa w dostawie energii elektrycznej", "TECHNICAL", "EXTERNAL", False, False, True, ["servers", "network_devices", "rooms", "racks"]),
        ("T-004", "Trzesienie ziemi", "Uszkodzenia infrastruktury spowodowane trzesieniem ziemi", "NATURAL", "EXTERNAL", False, False, True, ["servers", "rooms", "locations"]),
        ("T-005", "Wyladowania atmosferyczne", "Uszkodzenia sprzetu spowodowane uderzeniem pioruna", "NATURAL", "EXTERNAL", False, False, True, ["servers", "network_devices", "rooms"]),
        ("T-006", "Ekstremalne temperatury", "Przegrzanie lub przemrozenie sprzetu IT", "ENVIRONMENTAL", "EXTERNAL", False, False, True, ["servers", "rooms", "racks"]),

        ("T-010", "Ransomware", "Zlosliwe oprogramowanie szyfrujace dane i zadajace okupu", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, True, ["servers", "desktops", "laptops", "applications", "databases", "cloud_services"]),
        ("T-011", "Phishing", "Wyludzanie poswiadczen lub danych przez falszywe komunikaty", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, False, ["desktops", "laptops", "mobile_devices", "applications", "employees", "it_services"]),
        ("T-012", "Spear phishing", "Ukierunkowany atak phishingowy na kluczowe osoby", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, False, ["employees", "laptops", "applications"]),
        ("T-013", "Social engineering", "Manipulacja psychologiczna w celu uzyskania dostepu lub informacji", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, False, ["employees"]),
        ("T-014", "Malware (ogolny)", "Wirusy, trojany, robaki i inne zlosliwe oprogramowanie", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, True, ["servers", "desktops", "laptops", "mobile_devices", "applications"]),
        ("T-015", "Atak brute-force", "Proba odgadniecia hasla przez systematyczne probowanie kombinacji", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, False, ["applications", "databases", "cloud_services", "it_services"]),
        ("T-016", "SQL Injection", "Wstrzykniecie zlosliwego kodu SQL do aplikacji", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, True, ["applications", "databases"]),
        ("T-017", "Cross-Site Scripting (XSS)", "Wstrzykniecie zlosliwego skryptu do aplikacji webowej", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, False, ["applications"]),
        ("T-018", "Atak man-in-the-middle", "Przejecie komunikacji miedzy dwoma stronami", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, False, ["networks", "network_devices", "applications"]),
        ("T-019", "Advanced Persistent Threat (APT)", "Zaawansowany, dlugotrawaly atak ukierunkowany", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, True, ["servers", "applications", "databases", "employees"]),

        ("T-020", "Kradziez sprzetu", "Kradziez laptopow, telefonow, nosnikow danych", "HUMAN_INTENTIONAL", "EXTERNAL", True, False, True, ["laptops", "mobile_devices", "storage_media", "rooms"]),
        ("T-021", "Wlamanie fizyczne", "Nieuprawniony dostep fizyczny do pomieszczen", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, True, ["rooms", "racks", "servers", "locations"]),
        ("T-022", "Sabotaz wewnetrzny", "Celowe dzialanie pracownika na szkode organizacji", "HUMAN_INTENTIONAL", "INTERNAL", True, True, True, ["servers", "databases", "applications", "employees"]),

        ("T-030", "Blad konfiguracji", "Nieprawidlowa konfiguracja systemu lub aplikacji", "HUMAN_ACCIDENTAL", "INTERNAL", True, True, True, ["servers", "network_devices", "applications", "cloud_services", "databases"]),
        ("T-031", "Przypadkowe usuniecie danych", "Niezamierzone skasowanie waznych danych", "HUMAN_ACCIDENTAL", "INTERNAL", False, True, True, ["databases", "datasets", "documents", "cloud_services"]),
        ("T-032", "Bledne wdrozenie", "Wdrozenie wadliwej wersji oprogramowania na produkcje", "HUMAN_ACCIDENTAL", "INTERNAL", False, True, True, ["applications", "servers", "cloud_services"]),
        ("T-033", "Wyciek danych przez niedbalstwo", "Przypadkowe ujawnienie poufnych informacji", "HUMAN_ACCIDENTAL", "INTERNAL", True, False, False, ["employees", "datasets", "documents", "it_services"]),

        ("T-040", "Wyciek danych przez pracownika", "Celowe wyniesienie poufnych danych przez pracownika", "HUMAN_INTENTIONAL", "INTERNAL", True, False, False, ["databases", "datasets", "employees", "it_services", "documents"]),
        ("T-041", "Kradziez wlasnosci intelektualnej", "Kradziez tajemnic handlowych lub wlasnosci intelektualnej", "HUMAN_INTENTIONAL", "BOTH", True, False, False, ["datasets", "documents", "employees"]),
        ("T-042", "Kradziez dokumentacji papierowej", "Kradziez lub skopiowanie dokumentow fizycznych", "HUMAN_INTENTIONAL", "BOTH", True, False, True, ["documents", "rooms"]),

        ("T-050", "Utrata kluczowego pracownika", "Odejscie pracownika z unikalna wiedza lub uprawnieniami", "ORGANIZATIONAL", "INTERNAL", False, False, True, ["employees", "teams"]),
        ("T-051", "Brak kompetencji personelu", "Niewystarczajace umiejetnosci techniczne lub bezpieczenstwa", "ORGANIZATIONAL", "INTERNAL", True, True, True, ["employees", "teams"]),

        ("T-060", "Atak DDoS", "Atak odmowy uslugi paralizujacy serwisy", "HUMAN_INTENTIONAL", "EXTERNAL", False, False, True, ["servers", "network_devices", "applications", "cloud_services"]),
        ("T-061", "Awaria sprzetowa", "Fizyczna awaria serwera, dysku, zasilacza", "TECHNICAL", "INTERNAL", False, False, True, ["servers", "network_devices", "racks"]),
        ("T-062", "Awaria dysku / utrata danych", "Uszkodzenie nosnika danych prowadzace do utraty informacji", "TECHNICAL", "INTERNAL", False, True, True, ["servers", "databases", "storage_media"]),
        ("T-063", "Awaria sieci", "Przerwa w dzialaniu infrastruktury sieciowej", "TECHNICAL", "INTERNAL", False, False, True, ["networks", "network_devices"]),
        ("T-064", "Blad oprogramowania", "Krytyczny blad w oprogramowaniu (bug) prowadzacy do awarii", "TECHNICAL", "INTERNAL", False, True, True, ["applications", "databases", "information_systems"]),
        ("T-065", "Wygasniecie certyfikatu SSL/TLS", "Nieodnowiony certyfikat powodujacy przerwy w usludze", "TECHNICAL", "INTERNAL", False, True, True, ["applications", "cloud_services", "certificates"]),

        ("T-070", "Naruszenie przepisow (RODO/GDPR)", "Niezgodnosc z regulacjami ochrony danych osobowych", "ORGANIZATIONAL", "INTERNAL", True, False, False, ["datasets", "applications", "employees"]),
        ("T-071", "Uzaleznienie od dostawcy (vendor lock-in)", "Nadmierna zaleznosc od jednego dostawcy technologii", "ORGANIZATIONAL", "EXTERNAL", False, False, True, ["cloud_services", "applications", "ext_vendors"]),
        ("T-072", "Atak na lancuch dostaw", "Kompromitacja oprogramowania lub uslug dostawcy", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, True, ["applications", "cloud_services", "ext_vendors"]),

        ("T-080", "Nieautoryzowany dostep do Wi-Fi", "Podlaczenie do sieci bezprzewodowej przez nieuprawniona osobe", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, False, ["networks", "network_devices"]),
        ("T-081", "Eskalacja uprawnien", "Uzyskanie wyzszych uprawnien niz przyznane", "HUMAN_INTENTIONAL", "BOTH", True, True, True, ["servers", "applications", "databases"]),
        ("T-082", "Wykorzystanie podatnosci zero-day", "Atak wykorzystujacy nieznaną dotad podatnosc", "HUMAN_INTENTIONAL", "EXTERNAL", True, True, True, ["servers", "applications", "network_devices"]),
    ]

    for ref_id, name, desc, cat, src, cia_c, cia_i, cia_a, _ in threats:
        cia = '{"C": %s, "I": %s, "A": %s}' % (
            "true" if cia_c else "false",
            "true" if cia_i else "false",
            "true" if cia_a else "false",
        )
        conn.execute(sa.text(
            "INSERT INTO threat_catalog (ref_id, name, description, category, source, cia_impact, is_system) "
            "VALUES (:ref_id, :name, :desc, :cat, :src, :cia, 1)"
        ), {"ref_id": ref_id, "name": name, "desc": desc, "cat": cat, "src": src, "cia": cia})

    # ── M2M: threats ↔ asset_categories ──
    for ref_id, _, _, _, _, _, _, _, codes in threats:
        for code in codes:
            conn.execute(sa.text(
                "INSERT INTO threat_asset_category (threat_id, asset_category_id) "
                "SELECT t.id, c.id FROM threat_catalog t, asset_categories c "
                "WHERE t.ref_id = :ref_id AND c.code = :code"
            ), {"ref_id": ref_id, "code": code})

    # ── WEAKNESSES ──
    weaknesses = [
        # (ref_id, name, description, category, asset_category_codes[])
        ("W-001", "Brak redundancji zasilania (UPS)", "Brak zasilania awaryjnego dla krytycznej infrastruktury", "HARDWARE", ["servers", "network_devices", "rooms", "racks"]),
        ("W-002", "Przestarzaly sprzet (EOL)", "Sprzet po zakonczeniu wsparcia producenta", "HARDWARE", ["servers", "desktops", "network_devices"]),
        ("W-003", "Brak redundancji sprzetowej", "Brak zapasowego sprzetu dla krytycznych systemow", "HARDWARE", ["servers", "network_devices"]),
        ("W-004", "Brak szyfrowania dyskow", "Dyski twarde bez szyfrowania (np. BitLocker, LUKS)", "HARDWARE", ["laptops", "desktops", "storage_media"]),

        ("W-010", "Brak segmentacji sieci", "Plaska architektura sieci bez podzialu na strefy", "NETWORK", ["servers", "network_devices", "applications"]),
        ("W-011", "Otwarte niepotrzebne porty", "Nadmiarowe otwarte porty sieciowe na serwerach", "NETWORK", ["servers", "network_devices"]),
        ("W-012", "Brak systemu IDS/IPS", "Brak wykrywania/zapobiegania wlamaniom", "NETWORK", ["networks", "network_devices"]),
        ("W-013", "Brak szyfrowania transmisji", "Komunikacja przesylana otwartym tekstem (bez TLS)", "NETWORK", ["applications", "networks", "it_services"]),
        ("W-014", "Niezabezpieczona siec Wi-Fi", "Siec bezprzewodowa ze slabym lub domyslnym zabezpieczeniem", "NETWORK", ["networks", "network_devices"]),
        ("W-015", "Brak VPN dla dostepu zdalnego", "Dostep zdalny bez tunelu VPN", "NETWORK", ["networks", "applications"]),

        ("W-020", "Brak polityki zlozonosci hasel", "Hasla nie podlegaja wymogom zlozonosci i dlugosci", "SOFTWARE", ["applications", "databases", "cloud_services"]),
        ("W-021", "Brak blokady konta po N probach", "Brak mechanizmu blokowania konta po nieudanych logowaniach", "SOFTWARE", ["applications", "databases", "cloud_services"]),
        ("W-022", "Niezalatane oprogramowanie", "Brak regularnych aktualizacji bezpieczenstwa", "SOFTWARE", ["servers", "desktops", "laptops", "applications"]),
        ("W-023", "Domyslna konfiguracja systemow", "Systemy uzywane z domyslnymi ustawieniami producenta", "SOFTWARE", ["servers", "network_devices", "applications", "databases"]),
        ("W-024", "Brak walidacji danych wejsciowych", "Aplikacje nie waliduja danych od uzytkownikow", "SOFTWARE", ["applications"]),
        ("W-025", "Brak szyfrowania danych w spoczynku", "Dane wrażliwe przechowywane bez szyfrowania", "SOFTWARE", ["databases", "datasets", "cloud_services"]),
        ("W-026", "Slabe zarzadzanie sesjami", "Tokeny sesji bez wygasania, brak ochrony przed przejęciem", "SOFTWARE", ["applications"]),
        ("W-027", "Brak logowania zdarzen bezpieczenstwa", "Brak rejestrow zdarzen do celów audytu", "SOFTWARE", ["servers", "applications", "databases"]),
        ("W-028", "Nadmierne uprawnienia uzytkownikow", "Uzytkowicy maja szersze uprawnienia niz potrzebne", "SOFTWARE", ["servers", "applications", "databases", "cloud_services"]),
        ("W-029", "Brak MFA", "Uwierzytelnianie tylko jednym czynnikiem (haslo)", "SOFTWARE", ["applications", "cloud_services", "it_services"]),

        ("W-030", "Brak szkolenia awareness", "Pracownicy nie przechodza szkolen z bezpieczenstwa", "PERSONNEL", ["employees", "teams"]),
        ("W-031", "Brak weryfikacji pracownikow", "Brak sprawdzania przeszlosci nowo zatrudnianych", "PERSONNEL", ["employees"]),
        ("W-032", "Brak procedury odejscia pracownika", "Brak procedury odbierania dostepow przy zwolnieniu", "PERSONNEL", ["employees"]),
        ("W-033", "Wspoldzielenie kont", "Wielu uzytkowników korzysta z jednego konta", "PERSONNEL", ["employees", "applications"]),
        ("W-034", "Brak monitoringu prób logowania", "Nieudane logowania nie sa monitorowane ani alertowane", "SOFTWARE", ["applications", "servers"]),

        ("W-040", "Brak zamykanych szaf na dokumenty", "Dokumenty poufne przechowywane bez zabezpieczenia", "SITE", ["documents", "rooms"]),
        ("W-041", "Brak kontroli dostepu fizycznego", "Brak systemu kontroli wejsc do pomieszczen", "SITE", ["rooms", "locations", "racks"]),
        ("W-042", "Brak monitoringu CCTV", "Brak kamer bezpieczenstwa w krytycznych lokalizacjach", "SITE", ["rooms", "locations"]),
        ("W-043", "Brak ochrony przeciwpozarowej", "Brak systemu gasniczego lub detekcji dymu", "SITE", ["rooms", "racks"]),
        ("W-044", "Brak kontroli srodowiskowej", "Brak klimatyzacji lub monitorowania warunkow (temp, wilgotnosc)", "SITE", ["rooms", "racks"]),

        ("W-050", "Brak procedury backup", "Brak regularnego tworzenia kopii zapasowych", "PROCESS", ["servers", "applications", "databases", "cloud_services"]),
        ("W-051", "Brak testowania odtwarzania z backupu", "Kopie zapasowe nigdy nie sa testowane pod katem odtwarzalnosci", "PROCESS", ["servers", "databases"]),
        ("W-052", "Brak procedury zarzadzania zmianami", "Zmiany w systemach bez formalnego procesu zatwierdzania", "PROCESS", ["applications", "servers", "network_devices"]),
        ("W-053", "Brak procedury reagowania na incydenty", "Brak zdefiniowanego procesu obslugi incydentow", "PROCESS", ["employees", "teams"]),

        ("W-060", "Brak planu ciaglości dzialania", "Brak BCP/DRP dla krytycznych procesow", "ORGANIZATION", ["servers", "applications", "rooms", "employees"]),
        ("W-061", "Brak polityki bezpieczenstwa", "Brak formalnej polityki bezpieczenstwa informacji", "ORGANIZATION", ["employees", "teams"]),
        ("W-062", "Brak klasyfikacji informacji", "Dane nie sa klasyfikowane wg poziomu poufnosci", "ORGANIZATION", ["datasets", "documents"]),
        ("W-063", "Brak przegladow uprawnien", "Uprawnienia nie sa okresowo weryfikowane", "ORGANIZATION", ["applications", "databases", "cloud_services"]),
        ("W-064", "Brak polityki BYOD", "Brak zasad korzystania z prywatnych urzadzen w pracy", "ORGANIZATION", ["mobile_devices", "laptops"]),
        ("W-065", "Brak umow NDA z dostawcami", "Brak klauzul poufnosci z zewnetrznymi dostawcami", "ORGANIZATION", ["ext_vendors"]),
    ]

    for ref_id, name, desc, cat, _ in weaknesses:
        conn.execute(sa.text(
            "INSERT INTO weakness_catalog (ref_id, name, description, category, is_system) "
            "VALUES (:ref_id, :name, :desc, :cat, 1)"
        ), {"ref_id": ref_id, "name": name, "desc": desc, "cat": cat})

    for ref_id, _, _, _, codes in weaknesses:
        for code in codes:
            conn.execute(sa.text(
                "INSERT INTO weakness_asset_category (weakness_id, asset_category_id) "
                "SELECT w.id, c.id FROM weakness_catalog w, asset_categories c "
                "WHERE w.ref_id = :ref_id AND c.code = :code"
            ), {"ref_id": ref_id, "code": code})

    # ── CONTROLS ──
    controls = [
        # (ref_id, name, description, category, implementation_type, asset_category_codes[])
        ("C-001", "UPS i zasilanie awaryjne", "Systemy zasilania awaryjnego UPS i agregaty pradotworcze", "PHYSICAL", "PREVENTIVE", ["servers", "network_devices", "rooms", "racks"]),
        ("C-002", "Redundancja sprzetowa (HA)", "Klastry wysokiej dostepnosci, zapasowe komponenty", "TECHNICAL", "PREVENTIVE", ["servers", "network_devices"]),
        ("C-003", "Szyfrowanie dyskow (FDE)", "Pelne szyfrowanie dyskow BitLocker/LUKS/FileVault", "TECHNICAL", "PREVENTIVE", ["laptops", "desktops", "storage_media"]),

        ("C-010", "Segmentacja sieci (VLAN/FW)", "Podzial sieci na strefy bezpieczenstwa z firewallami", "TECHNICAL", "PREVENTIVE", ["servers", "network_devices", "applications"]),
        ("C-011", "System IDS/IPS", "Systemy wykrywania i zapobiegania wlamaniom", "TECHNICAL", "DETECTIVE", ["networks", "network_devices"]),
        ("C-012", "Szyfrowanie transmisji (TLS)", "Wymuszanie szyfrowanej komunikacji TLS/SSL", "TECHNICAL", "PREVENTIVE", ["applications", "networks", "it_services"]),
        ("C-013", "VPN dla dostepu zdalnego", "Tunele VPN dla wszystkich polaczen zdalnych", "TECHNICAL", "PREVENTIVE", ["networks", "applications"]),
        ("C-014", "Zabezpieczenie sieci Wi-Fi (WPA3)", "Silne szyfrowanie i uwierzytelnianie sieci bezprzewodowej", "TECHNICAL", "PREVENTIVE", ["networks", "network_devices"]),

        ("C-020", "Uwierzytelnianie wieloskladnikowe (MFA)", "Wymuszenie drugiego skladnika uwierzytelniania", "TECHNICAL", "PREVENTIVE", ["applications", "databases", "cloud_services", "it_services"]),
        ("C-021", "Polityka zlozonosci i rotacji hasel", "Wymogi dotyczace sily hasel i ich regularnej zmiany", "ORGANIZATIONAL", "PREVENTIVE", ["applications", "databases", "cloud_services"]),
        ("C-022", "Automatyczna blokada konta", "Blokowanie konta po kilku nieudanych probach logowania", "TECHNICAL", "PREVENTIVE", ["applications", "databases"]),
        ("C-023", "System zarzadzania tozsamoscia (IAM)", "Centralny system zarzadzania kontami i uprawnieniami", "TECHNICAL", "PREVENTIVE", ["applications", "databases", "cloud_services"]),
        ("C-024", "Zasada najmniejszych uprawnien (POLP)", "Przyznawanie minimalnych uprawnien wymaganych do pracy", "ORGANIZATIONAL", "PREVENTIVE", ["applications", "databases", "servers", "cloud_services"]),
        ("C-025", "Przeglady uprawnien (recertyfikacja)", "Okresowa weryfikacja i aktualizacja uprawnien dostepowych", "ORGANIZATIONAL", "DETECTIVE", ["applications", "databases", "cloud_services"]),

        ("C-030", "Program szkolenia awareness", "Regularne szkolenia z bezpieczenstwa informacji dla pracownikow", "ORGANIZATIONAL", "PREVENTIVE", ["employees", "teams"]),
        ("C-031", "Symulacje phishingowe", "Testowe kampanie phishingowe do oceny swiadomosci", "ORGANIZATIONAL", "DETECTIVE", ["employees"]),
        ("C-032", "Procedura offboardingu", "Formalna procedura odbierania dostepow przy odejsciu", "ORGANIZATIONAL", "PREVENTIVE", ["employees"]),

        ("C-040", "Szafy zamykane na klucz/kod", "Zabezpieczone szafy na dokumenty poufne", "PHYSICAL", "PREVENTIVE", ["documents", "rooms"]),
        ("C-041", "System kontroli dostepu fizycznego", "Karty, biometria lub kody PIN do wejscia", "PHYSICAL", "PREVENTIVE", ["rooms", "locations", "racks"]),
        ("C-042", "Monitoring CCTV", "Kamery bezpieczenstwa w krytycznych lokalizacjach", "PHYSICAL", "DETECTIVE", ["rooms", "locations"]),
        ("C-043", "System gasniczy i detekcja dymu", "Automatyczne systemy gasnicze i czujniki dymu", "PHYSICAL", "PREVENTIVE", ["rooms", "racks"]),
        ("C-044", "Klimatyzacja i monitoring srodowiskowy", "Systemy HVAC i czujniki temperatury/wilgotnosci", "PHYSICAL", "PREVENTIVE", ["rooms", "racks"]),

        ("C-050", "Automatyczny backup (regula 3-2-1)", "Regularne kopie zapasowe wg reguly 3-2-1", "TECHNICAL", "CORRECTIVE", ["servers", "applications", "databases", "cloud_services"]),
        ("C-051", "Testowanie odtwarzania z backupu", "Regularne testy przywracania danych z kopii zapasowych", "ORGANIZATIONAL", "DETECTIVE", ["servers", "databases"]),
        ("C-052", "Zarzadzanie zmianami (change management)", "Formalny proces zatwierdzania i wdrazania zmian", "ORGANIZATIONAL", "PREVENTIVE", ["applications", "servers", "network_devices"]),
        ("C-053", "Plan reagowania na incydenty (IRP)", "Zdefiniowany proces obslugi incydentow bezpieczenstwa", "ORGANIZATIONAL", "CORRECTIVE", ["employees", "teams"]),

        ("C-060", "Plan ciaglości dzialania (BCP/DRP)", "Plany zapewnienia ciaglości i odtwarzania po awarii", "ORGANIZATIONAL", "CORRECTIVE", ["servers", "applications", "rooms", "employees"]),
        ("C-061", "Polityka bezpieczenstwa informacji", "Formalna, zatwierdzona polityka bezpieczenstwa", "ORGANIZATIONAL", "PREVENTIVE", ["employees", "teams"]),
        ("C-062", "Klasyfikacja informacji", "System etykietowania danych wg poziomu poufnosci", "ORGANIZATIONAL", "PREVENTIVE", ["datasets", "documents"]),

        ("C-070", "SIEM / monitoring logow", "Centralne zbieranie i analiza logow bezpieczenstwa", "TECHNICAL", "DETECTIVE", ["servers", "network_devices", "applications", "cloud_services"]),
        ("C-071", "System DLP (Data Loss Prevention)", "Zapobieganie wyciekom danych przez monitorowanie kanalow", "TECHNICAL", "DETECTIVE", ["applications", "it_services", "datasets"]),
        ("C-072", "Skanowanie podatnosci", "Regularne skanowanie infrastruktury pod katem podatnosci", "TECHNICAL", "DETECTIVE", ["servers", "network_devices", "applications"]),
        ("C-073", "Patch management", "Proces regularnego aplikowania poprawek bezpieczenstwa", "TECHNICAL", "CORRECTIVE", ["servers", "desktops", "laptops", "applications"]),
        ("C-074", "WAF (Web Application Firewall)", "Firewall warstwy aplikacji chroniacy aplikacje webowe", "TECHNICAL", "PREVENTIVE", ["applications"]),
        ("C-075", "Anti-malware / EDR", "Ochrona antywirusowa i Endpoint Detection and Response", "TECHNICAL", "DETECTIVE", ["servers", "desktops", "laptops"]),
        ("C-076", "Zarzadzanie certyfikatami", "Monitoring wygasania i automatyczne odnawianie certyfikatow", "TECHNICAL", "PREVENTIVE", ["applications", "cloud_services", "certificates"]),
    ]

    for ref_id, name, desc, cat, impl_type, _ in controls:
        conn.execute(sa.text(
            "INSERT INTO control_catalog (ref_id, name, description, category, implementation_type, is_system) "
            "VALUES (:ref_id, :name, :desc, :cat, :impl_type, 1)"
        ), {"ref_id": ref_id, "name": name, "desc": desc, "cat": cat, "impl_type": impl_type})

    for ref_id, _, _, _, _, codes in controls:
        for code in codes:
            conn.execute(sa.text(
                "INSERT INTO control_catalog_asset_category (control_id, asset_category_id) "
                "SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac "
                "WHERE cc.ref_id = :ref_id AND ac.code = :code"
            ), {"ref_id": ref_id, "code": code})

    # ── THREAT ↔ WEAKNESS CORRELATIONS ──
    tw_links = [
        # (threat_ref, weakness_ref, relevance)
        # Environmental / Technical threats
        ("T-001", "W-043", "HIGH"), ("T-001", "W-060", "HIGH"), ("T-001", "W-050", "MEDIUM"),
        ("T-002", "W-044", "HIGH"), ("T-002", "W-060", "HIGH"),
        ("T-003", "W-001", "HIGH"), ("T-003", "W-003", "MEDIUM"), ("T-003", "W-060", "MEDIUM"),
        ("T-005", "W-001", "HIGH"),
        ("T-006", "W-044", "HIGH"),
        # Ransomware
        ("T-010", "W-022", "HIGH"), ("T-010", "W-050", "HIGH"), ("T-010", "W-030", "HIGH"),
        ("T-010", "W-010", "MEDIUM"), ("T-010", "W-029", "MEDIUM"),
        # Phishing
        ("T-011", "W-030", "HIGH"), ("T-011", "W-029", "HIGH"), ("T-011", "W-020", "MEDIUM"),
        ("T-012", "W-030", "HIGH"), ("T-012", "W-029", "HIGH"),
        ("T-013", "W-030", "HIGH"), ("T-013", "W-031", "MEDIUM"),
        # Malware
        ("T-014", "W-022", "HIGH"), ("T-014", "W-030", "MEDIUM"), ("T-014", "W-010", "MEDIUM"),
        # Brute-force
        ("T-015", "W-020", "HIGH"), ("T-015", "W-021", "HIGH"), ("T-015", "W-029", "HIGH"),
        ("T-015", "W-034", "MEDIUM"),
        # SQL Injection, XSS
        ("T-016", "W-024", "HIGH"), ("T-016", "W-023", "MEDIUM"), ("T-016", "W-027", "MEDIUM"),
        ("T-017", "W-024", "HIGH"), ("T-017", "W-026", "MEDIUM"),
        # MITM
        ("T-018", "W-013", "HIGH"), ("T-018", "W-015", "HIGH"), ("T-018", "W-014", "MEDIUM"),
        # APT
        ("T-019", "W-022", "HIGH"), ("T-019", "W-012", "HIGH"), ("T-019", "W-027", "HIGH"),
        ("T-019", "W-010", "MEDIUM"),
        # Physical
        ("T-020", "W-004", "HIGH"), ("T-020", "W-041", "HIGH"), ("T-020", "W-042", "MEDIUM"),
        ("T-021", "W-041", "HIGH"), ("T-021", "W-042", "HIGH"), ("T-021", "W-043", "MEDIUM"),
        # Sabotage
        ("T-022", "W-028", "HIGH"), ("T-022", "W-027", "HIGH"), ("T-022", "W-053", "MEDIUM"),
        ("T-022", "W-063", "MEDIUM"),
        # Accidental
        ("T-030", "W-023", "HIGH"), ("T-030", "W-052", "HIGH"), ("T-030", "W-027", "MEDIUM"),
        ("T-031", "W-050", "HIGH"), ("T-031", "W-051", "HIGH"), ("T-031", "W-028", "MEDIUM"),
        ("T-032", "W-052", "HIGH"),
        ("T-033", "W-030", "HIGH"), ("T-033", "W-062", "HIGH"), ("T-033", "W-061", "MEDIUM"),
        # Data leak
        ("T-040", "W-028", "HIGH"), ("T-040", "W-062", "HIGH"), ("T-040", "W-027", "HIGH"),
        ("T-040", "W-032", "MEDIUM"),
        ("T-041", "W-062", "HIGH"), ("T-041", "W-065", "HIGH"),
        ("T-042", "W-040", "HIGH"), ("T-042", "W-041", "HIGH"),
        # Personnel
        ("T-050", "W-060", "HIGH"), ("T-050", "W-033", "MEDIUM"),
        ("T-051", "W-030", "HIGH"),
        # DDoS
        ("T-060", "W-010", "HIGH"), ("T-060", "W-003", "HIGH"),
        # Technical failures
        ("T-061", "W-003", "HIGH"), ("T-061", "W-001", "HIGH"),
        ("T-062", "W-050", "HIGH"), ("T-062", "W-051", "HIGH"),
        ("T-063", "W-003", "HIGH"), ("T-063", "W-010", "MEDIUM"),
        ("T-064", "W-052", "HIGH"), ("T-064", "W-022", "MEDIUM"),
        ("T-065", "W-052", "MEDIUM"),
        # Compliance
        ("T-070", "W-062", "HIGH"), ("T-070", "W-061", "HIGH"), ("T-070", "W-025", "MEDIUM"),
        ("T-071", "W-065", "HIGH"),
        ("T-072", "W-065", "HIGH"), ("T-072", "W-022", "MEDIUM"),
        # Network
        ("T-080", "W-014", "HIGH"),
        ("T-081", "W-028", "HIGH"), ("T-081", "W-023", "HIGH"),
        ("T-082", "W-022", "HIGH"), ("T-082", "W-012", "HIGH"),
    ]

    for t_ref, w_ref, rel in tw_links:
        conn.execute(sa.text(
            "INSERT INTO threat_weakness_link (threat_id, weakness_id, relevance, is_system) "
            "SELECT t.id, w.id, :rel, 1 FROM threat_catalog t, weakness_catalog w "
            "WHERE t.ref_id = :t_ref AND w.ref_id = :w_ref"
        ), {"t_ref": t_ref, "w_ref": w_ref, "rel": rel})

    # ── THREAT ↔ CONTROL CORRELATIONS ──
    tc_links = [
        # Environmental
        ("T-001", "C-043", "HIGH"), ("T-001", "C-060", "HIGH"), ("T-001", "C-050", "MEDIUM"),
        ("T-002", "C-044", "HIGH"), ("T-002", "C-060", "HIGH"),
        ("T-003", "C-001", "HIGH"), ("T-003", "C-002", "MEDIUM"), ("T-003", "C-060", "MEDIUM"),
        ("T-005", "C-001", "HIGH"),
        ("T-006", "C-044", "HIGH"),
        # Ransomware
        ("T-010", "C-050", "HIGH"), ("T-010", "C-075", "HIGH"), ("T-010", "C-073", "HIGH"),
        ("T-010", "C-010", "MEDIUM"), ("T-010", "C-030", "MEDIUM"),
        # Phishing
        ("T-011", "C-030", "HIGH"), ("T-011", "C-031", "HIGH"), ("T-011", "C-020", "HIGH"),
        ("T-011", "C-075", "MEDIUM"),
        ("T-012", "C-030", "HIGH"), ("T-012", "C-020", "HIGH"),
        ("T-013", "C-030", "HIGH"), ("T-013", "C-032", "MEDIUM"),
        # Malware
        ("T-014", "C-075", "HIGH"), ("T-014", "C-073", "HIGH"), ("T-014", "C-010", "MEDIUM"),
        # Brute-force
        ("T-015", "C-020", "HIGH"), ("T-015", "C-022", "HIGH"), ("T-015", "C-021", "MEDIUM"),
        ("T-015", "C-070", "MEDIUM"),
        # SQL Injection
        ("T-016", "C-074", "HIGH"), ("T-016", "C-072", "MEDIUM"),
        ("T-017", "C-074", "HIGH"),
        # MITM
        ("T-018", "C-012", "HIGH"), ("T-018", "C-013", "HIGH"),
        # APT
        ("T-019", "C-070", "HIGH"), ("T-019", "C-011", "HIGH"), ("T-019", "C-073", "HIGH"),
        ("T-019", "C-010", "MEDIUM"),
        # Physical
        ("T-020", "C-003", "HIGH"), ("T-020", "C-041", "HIGH"), ("T-020", "C-042", "MEDIUM"),
        ("T-021", "C-041", "HIGH"), ("T-021", "C-042", "HIGH"),
        # Sabotage
        ("T-022", "C-024", "HIGH"), ("T-022", "C-070", "HIGH"), ("T-022", "C-025", "MEDIUM"),
        # Accidental
        ("T-030", "C-052", "HIGH"), ("T-030", "C-070", "MEDIUM"),
        ("T-031", "C-050", "HIGH"), ("T-031", "C-051", "HIGH"), ("T-031", "C-024", "MEDIUM"),
        ("T-032", "C-052", "HIGH"),
        ("T-033", "C-062", "HIGH"), ("T-033", "C-071", "HIGH"), ("T-033", "C-030", "MEDIUM"),
        # Data leak
        ("T-040", "C-071", "HIGH"), ("T-040", "C-024", "HIGH"), ("T-040", "C-070", "HIGH"),
        ("T-040", "C-025", "MEDIUM"),
        ("T-041", "C-062", "HIGH"), ("T-041", "C-071", "HIGH"),
        ("T-042", "C-040", "HIGH"), ("T-042", "C-041", "HIGH"),
        # Personnel
        ("T-050", "C-060", "HIGH"),
        ("T-051", "C-030", "HIGH"),
        # DDoS
        ("T-060", "C-010", "HIGH"), ("T-060", "C-002", "HIGH"),
        # Technical
        ("T-061", "C-002", "HIGH"), ("T-061", "C-001", "HIGH"),
        ("T-062", "C-050", "HIGH"), ("T-062", "C-051", "HIGH"),
        ("T-063", "C-002", "HIGH"), ("T-063", "C-010", "MEDIUM"),
        ("T-064", "C-052", "HIGH"), ("T-064", "C-073", "MEDIUM"),
        ("T-065", "C-076", "HIGH"),
        # Compliance
        ("T-070", "C-062", "HIGH"), ("T-070", "C-061", "HIGH"),
        ("T-072", "C-072", "HIGH"), ("T-072", "C-073", "HIGH"),
        # Network
        ("T-080", "C-014", "HIGH"),
        ("T-081", "C-024", "HIGH"), ("T-081", "C-023", "HIGH"),
        ("T-082", "C-072", "HIGH"), ("T-082", "C-011", "HIGH"),
    ]

    for t_ref, c_ref, eff in tc_links:
        conn.execute(sa.text(
            "INSERT INTO threat_control_link (threat_id, control_id, effectiveness, is_system) "
            "SELECT t.id, c.id, :eff, 1 FROM threat_catalog t, control_catalog c "
            "WHERE t.ref_id = :t_ref AND c.ref_id = :c_ref"
        ), {"t_ref": t_ref, "c_ref": c_ref, "eff": eff})

    # ── WEAKNESS ↔ CONTROL CORRELATIONS ──
    wc_links = [
        # Hardware
        ("W-001", "C-001", "HIGH"),
        ("W-002", "C-073", "HIGH"),
        ("W-003", "C-002", "HIGH"),
        ("W-004", "C-003", "HIGH"),
        # Network
        ("W-010", "C-010", "HIGH"),
        ("W-011", "C-072", "HIGH"), ("W-011", "C-010", "MEDIUM"),
        ("W-012", "C-011", "HIGH"),
        ("W-013", "C-012", "HIGH"),
        ("W-014", "C-014", "HIGH"),
        ("W-015", "C-013", "HIGH"),
        # Software / Access
        ("W-020", "C-021", "HIGH"), ("W-020", "C-020", "HIGH"),
        ("W-021", "C-022", "HIGH"),
        ("W-022", "C-073", "HIGH"), ("W-022", "C-072", "MEDIUM"),
        ("W-023", "C-052", "HIGH"), ("W-023", "C-072", "MEDIUM"),
        ("W-024", "C-074", "HIGH"),
        ("W-025", "C-003", "HIGH"), ("W-025", "C-012", "MEDIUM"),
        ("W-026", "C-020", "HIGH"),
        ("W-027", "C-070", "HIGH"),
        ("W-028", "C-024", "HIGH"), ("W-028", "C-025", "HIGH"), ("W-028", "C-023", "MEDIUM"),
        ("W-029", "C-020", "HIGH"),
        # Personnel
        ("W-030", "C-030", "HIGH"), ("W-030", "C-031", "MEDIUM"),
        ("W-031", "C-032", "MEDIUM"),
        ("W-032", "C-032", "HIGH"),
        ("W-033", "C-023", "HIGH"), ("W-033", "C-024", "MEDIUM"),
        ("W-034", "C-070", "HIGH"),
        # Site
        ("W-040", "C-040", "HIGH"),
        ("W-041", "C-041", "HIGH"),
        ("W-042", "C-042", "HIGH"),
        ("W-043", "C-043", "HIGH"),
        ("W-044", "C-044", "HIGH"),
        # Process
        ("W-050", "C-050", "HIGH"),
        ("W-051", "C-051", "HIGH"),
        ("W-052", "C-052", "HIGH"),
        ("W-053", "C-053", "HIGH"),
        # Organization
        ("W-060", "C-060", "HIGH"),
        ("W-061", "C-061", "HIGH"),
        ("W-062", "C-062", "HIGH"),
        ("W-063", "C-025", "HIGH"),
        ("W-065", "C-061", "MEDIUM"),
    ]

    for w_ref, c_ref, eff in wc_links:
        conn.execute(sa.text(
            "INSERT INTO weakness_control_link (weakness_id, control_id, effectiveness, is_system) "
            "SELECT w.id, c.id, :eff, 1 FROM weakness_catalog w, control_catalog c "
            "WHERE w.ref_id = :w_ref AND c.ref_id = :c_ref"
        ), {"w_ref": w_ref, "c_ref": c_ref, "eff": eff})


def downgrade() -> None:
    op.drop_table("ai_audit_log")
    op.drop_table("ai_provider_config")
    op.drop_table("weakness_control_link")
    op.drop_table("threat_control_link")
    op.drop_table("threat_weakness_link")
    op.drop_table("control_catalog_asset_category")
    op.drop_table("weakness_asset_category")
    op.drop_table("threat_asset_category")
    op.drop_table("control_catalog")
    op.drop_table("weakness_catalog")
    op.drop_table("threat_catalog")
