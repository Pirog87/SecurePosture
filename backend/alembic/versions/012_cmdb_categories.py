"""CMDB: asset_categories tree, category_field_definitions, relationship_types

Revision ID: 012_cmdb_categories
Revises: 011_add_it_coordinator
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

revision = "012_cmdb_categories"
down_revision = "011_add_it_coordinator"
branch_labels = None
depends_on = None


def _table_exists(conn, table):
    return conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_name = :tbl"
    ), {"tbl": table}).scalar() > 0


def _col_exists(conn, table, column):
    return conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_schema = DATABASE() AND table_name = :tbl AND column_name = :col"
    ), {"tbl": table, "col": column}).scalar() > 0


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. asset_categories (hierarchical tree) ──
    if not _table_exists(conn, "asset_categories"):
        op.create_table(
            "asset_categories",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("parent_id", sa.Integer, sa.ForeignKey("asset_categories.id", ondelete="SET NULL"), nullable=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("name_plural", sa.String(200), nullable=True),
            sa.Column("code", sa.String(100), nullable=False, unique=True),
            sa.Column("icon", sa.String(50), nullable=True),
            sa.Column("color", sa.String(7), nullable=True),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("is_abstract", sa.Boolean, default=False, nullable=False),
            sa.Column("sort_order", sa.Integer, default=0, nullable=False),
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

    # ── 2. category_field_definitions ──
    if not _table_exists(conn, "category_field_definitions"):
        op.create_table(
            "category_field_definitions",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("category_id", sa.Integer, sa.ForeignKey("asset_categories.id", ondelete="CASCADE"), nullable=False),
            sa.Column("inherited_from_id", sa.Integer, sa.ForeignKey("asset_categories.id", ondelete="SET NULL"), nullable=True),
            sa.Column("field_key", sa.String(100), nullable=False),
            sa.Column("label", sa.String(200), nullable=False),
            sa.Column("label_en", sa.String(200), nullable=True),
            sa.Column("field_type", sa.String(50), nullable=False),
            sa.Column("tab_name", sa.String(100), server_default="Informacje", nullable=False),
            sa.Column("section_name", sa.String(200), nullable=True),
            sa.Column("is_required", sa.Boolean, default=False, nullable=False),
            sa.Column("is_unique", sa.Boolean, default=False, nullable=False),
            sa.Column("default_value", sa.String(500), nullable=True),
            sa.Column("placeholder", sa.String(300), nullable=True),
            sa.Column("help_text", sa.Text, nullable=True),
            sa.Column("min_value", sa.Numeric(15, 2), nullable=True),
            sa.Column("max_value", sa.Numeric(15, 2), nullable=True),
            sa.Column("max_length", sa.Integer, nullable=True),
            sa.Column("regex_pattern", sa.String(500), nullable=True),
            sa.Column("options_json", sa.JSON, nullable=True),
            sa.Column("reference_category_id", sa.Integer, sa.ForeignKey("asset_categories.id", ondelete="SET NULL"), nullable=True),
            sa.Column("show_in_list", sa.Boolean, default=False, nullable=False),
            sa.Column("sort_order", sa.Integer, default=0, nullable=False),
            sa.Column("column_width", sa.Integer, default=150, nullable=False),
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )
        op.create_unique_constraint(
            "uq_category_field_key", "category_field_definitions",
            ["category_id", "field_key"],
        )

    # ── 3. relationship_types ──
    if not _table_exists(conn, "relationship_types"):
        op.create_table(
            "relationship_types",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(100), nullable=False, unique=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("name_reverse", sa.String(200), nullable=True),
            sa.Column("color", sa.String(7), nullable=True),
            sa.Column("icon", sa.String(50), nullable=True),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("sort_order", sa.Integer, default=0, nullable=False),
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        )

    # ── 4. Add asset_category_id + custom_attributes to assets ──
    if not _col_exists(conn, "assets", "asset_category_id"):
        op.add_column("assets", sa.Column(
            "asset_category_id", sa.Integer,
            sa.ForeignKey("asset_categories.id", ondelete="SET NULL"),
            nullable=True,
        ))

    if not _col_exists(conn, "assets", "custom_attributes"):
        op.add_column("assets", sa.Column(
            "custom_attributes", sa.JSON, nullable=True,
        ))

    # ── 5. Seed: relationship types ──
    conn.execute(sa.text("""
        INSERT IGNORE INTO relationship_types (code, name, name_reverse, color, sort_order)
        VALUES
            ('depends_on',   'Zalezy od',          'Jest wymagany przez', '#F59E0B', 1),
            ('supports',     'Wspiera',             'Jest wspierany przez', '#3B82F6', 2),
            ('connects_to',  'Laczy sie z',         'Jest polaczony z',    '#8B5CF6', 3),
            ('contains',     'Zawiera',             'Jest zawarty w',      '#10B981', 4),
            ('backup_of',    'Jest backupem',       'Ma backup',           '#06B6D4', 5),
            ('replaces',     'Zastepuje',           'Jest zastapiony przez','#EF4444', 6),
            ('runs_on',      'Dziala na',           'Uruchamia',           '#F97316', 7),
            ('managed_by',   'Zarzadzany przez',    'Zarzadza',            '#6366F1', 8),
            ('used_by',      'Uzywany przez',       'Uzywa',              '#EC4899', 9),
            ('hosted_on',    'Hostowany na',        'Hostuje',             '#14B8A6', 10)
    """))

    # ── 6. Seed: asset categories (tree) ──
    # Top-level abstract categories
    _seed_categories(conn)


def _seed_categories(conn):
    """Insert predefined CMDB category tree."""
    cats = [
        # (code, name, name_plural, icon, color, parent_code, is_abstract, sort_order)
        ("hardware",           "Sprzet IT",               "Sprzet IT",               "HardDrive",   "#3B82F6", None,         True,  1),
        ("servers",            "Serwery",                 "Serwery",                 "Server",      "#2563EB", "hardware",   False, 1),
        ("desktops",           "Komputery stacjonarne",   "Komputery stacjonarne",   "Monitor",     "#3B82F6", "hardware",   False, 2),
        ("laptops",            "Laptopy",                 "Laptopy",                 "Laptop",      "#60A5FA", "hardware",   False, 3),
        ("mobile_devices",     "Urzadzenia mobilne",      "Urzadzenia mobilne",      "Smartphone",  "#93C5FD", "hardware",   False, 4),
        ("peripherals",        "Urzadzenia peryferyjne",  "Urzadzenia peryferyjne",  "Printer",     "#BFDBFE", "hardware",   False, 5),
        ("storage_media",      "Nosniki danych",          "Nosniki danych",          "Database",    "#1D4ED8", "hardware",   False, 6),

        ("networking",         "Sieci",                   "Sieci",                   "Network",     "#8B5CF6", None,         True,  2),
        ("networks",           "Sieci",                   "Sieci",                   "Globe",       "#7C3AED", "networking", False, 1),
        ("network_devices",    "Urzadzenia sieciowe",     "Urzadzenia sieciowe",     "Router",      "#8B5CF6", "networking", False, 2),
        ("security_appliances","Urzadzenia bezpieczenstwa","Urzadzenia bezpieczenstwa","Shield",    "#A78BFA", "networking", False, 3),

        ("software",           "Oprogramowanie",          "Oprogramowanie",          "Code",        "#10B981", None,         True,  3),
        ("information_systems","Systemy informatyczne",    "Systemy informatyczne",   "Layers",      "#059669", "software",   False, 1),
        ("applications",       "Aplikacje",               "Aplikacje",               "AppWindow",   "#10B981", "software",   False, 2),
        ("databases",          "Bazy danych",             "Bazy danych",             "Database",    "#34D399", "software",   False, 3),
        ("cloud_services",     "Uslugi chmurowe",         "Uslugi chmurowe",         "Cloud",       "#6EE7B7", "software",   False, 4),
        ("environments",       "Srodowiska",              "Srodowiska",              "Settings",    "#047857", "software",   False, 5),

        ("people",             "Ludzie",                  "Ludzie",                  "Users",       "#F59E0B", None,         True,  4),
        ("employees",          "Pracownicy",              "Pracownicy",              "User",        "#D97706", "people",     False, 1),
        ("teams",              "Zespoly",                 "Zespoly",                 "UsersGroup",  "#F59E0B", "people",     False, 2),
        ("ext_vendors",        "Dostawcy zewnetrzni",     "Dostawcy zewnetrzni",     "Briefcase",   "#FBBF24", "people",     False, 3),

        ("information",        "Informacje",              "Informacje",              "FileText",    "#EF4444", None,         True,  5),
        ("documents",          "Dokumenty",               "Dokumenty",               "File",        "#DC2626", "information",False, 1),
        ("datasets",           "Zbiory danych",           "Zbiory danych",           "Table",       "#EF4444", "information",False, 2),
        ("certificates",       "Certyfikaty i klucze",    "Certyfikaty i klucze",    "Key",         "#F87171", "information",False, 3),

        ("physical",           "Obiekty fizyczne",        "Obiekty fizyczne",        "Building",    "#06B6D4", None,         True,  6),
        ("locations",          "Lokalizacje",             "Lokalizacje",             "MapPin",      "#0891B2", "physical",   False, 1),
        ("rooms",              "Pomieszczenia",           "Pomieszczenia",           "Door",        "#06B6D4", "physical",   False, 2),
        ("racks",              "Szafy serwerowe",         "Szafy serwerowe",         "Server",      "#22D3EE", "physical",   False, 3),

        ("processes",          "Procesy",                 "Procesy",                 "Workflow",    "#EC4899", None,         True,  7),
        ("business_processes", "Procesy biznesowe",       "Procesy biznesowe",       "GitBranch",   "#DB2777", "processes",  False, 1),
        ("it_services",        "Uslugi IT",               "Uslugi IT",               "Headphones",  "#EC4899", "processes",  False, 2),
    ]

    # Insert parents first (parent_code=None), then children
    for code, name, name_plural, icon, color, parent_code, is_abstract, sort_order in cats:
        if parent_code is None:
            conn.execute(sa.text("""
                INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
                VALUES (:code, :name, :name_plural, :icon, :color, NULL, :is_abstract, :sort_order)
            """), {"code": code, "name": name, "name_plural": name_plural,
                   "icon": icon, "color": color, "is_abstract": is_abstract, "sort_order": sort_order})

    for code, name, name_plural, icon, color, parent_code, is_abstract, sort_order in cats:
        if parent_code is not None:
            conn.execute(sa.text("""
                INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
                SELECT :code, :name, :name_plural, :icon, :color, p.id, :is_abstract, :sort_order
                FROM asset_categories p WHERE p.code = :parent_code
                AND NOT EXISTS (SELECT 1 FROM asset_categories WHERE code = :code)
            """), {"code": code, "name": name, "name_plural": name_plural,
                   "icon": icon, "color": color, "parent_code": parent_code,
                   "is_abstract": is_abstract, "sort_order": sort_order})

    # ── Seed field definitions for key categories ──
    _seed_fields(conn)


def _seed_fields(conn):
    """Insert default field definitions for common categories."""

    def _add_fields(category_code, fields):
        for f in fields:
            conn.execute(sa.text("""
                INSERT IGNORE INTO category_field_definitions
                    (category_id, field_key, label, label_en, field_type, tab_name, section_name,
                     is_required, placeholder, options_json, show_in_list, sort_order, reference_category_id)
                SELECT c.id, :field_key, :label, :label_en, :field_type, :tab_name, :section_name,
                       :is_required, :placeholder, :options_json, :show_in_list, :sort_order,
                       :ref_cat_id
                FROM asset_categories c WHERE c.code = :cat_code
                AND NOT EXISTS (
                    SELECT 1 FROM category_field_definitions
                    WHERE category_id = c.id AND field_key = :field_key
                )
            """), {
                "cat_code": category_code,
                "field_key": f["key"], "label": f["label"], "label_en": f.get("label_en"),
                "field_type": f["type"], "tab_name": f.get("tab", "Informacje"),
                "section_name": f.get("section"),
                "is_required": f.get("required", False),
                "placeholder": f.get("placeholder"),
                "options_json": f.get("options"),
                "show_in_list": f.get("show_in_list", False),
                "sort_order": f.get("sort", 0),
                "ref_cat_id": None,
            })

    # ── Servers ──
    _add_fields("servers", [
        {"key": "hostname",       "label": "Hostname",           "label_en": "Hostname",          "type": "text",   "tab": "Informacje", "required": True,  "placeholder": "np. srv-db-01", "show_in_list": True, "sort": 1},
        {"key": "ip_address",     "label": "Adres IP",           "label_en": "IP Address",        "type": "text",   "tab": "Informacje", "placeholder": "np. 10.0.0.1", "show_in_list": True, "sort": 2},
        {"key": "os_name",        "label": "System operacyjny",  "label_en": "Operating System",  "type": "text",   "tab": "Informacje", "placeholder": "np. Ubuntu 22.04", "sort": 3},
        {"key": "cpu_cores",      "label": "CPU (rdzenie)",      "label_en": "CPU Cores",         "type": "number", "tab": "Informacje", "sort": 4},
        {"key": "ram_gb",         "label": "RAM (GB)",           "label_en": "RAM (GB)",          "type": "number", "tab": "Informacje", "sort": 5},
        {"key": "disk_gb",        "label": "Dysk (GB)",          "label_en": "Disk (GB)",         "type": "number", "tab": "Informacje", "sort": 6},
        {"key": "vendor",         "label": "Producent",          "label_en": "Vendor",            "type": "text",   "tab": "Informacje", "placeholder": "np. Dell, HP", "sort": 7},
        {"key": "model",          "label": "Model",              "label_en": "Model",             "type": "text",   "tab": "Informacje", "sort": 8},
        {"key": "serial_number",  "label": "Numer seryjny",      "label_en": "Serial Number",     "type": "text",   "tab": "Informacje", "sort": 9},
        {"key": "environment",    "label": "Srodowisko",         "label_en": "Environment",       "type": "select", "tab": "Zarzadzanie", "options": '["Produkcja","Staging","Development","Test"]', "show_in_list": True, "sort": 1},
        {"key": "status",         "label": "Status",             "label_en": "Status",            "type": "select", "tab": "Zarzadzanie", "options": '["Aktywny","W budowie","Wycofywany","Wycofany"]', "show_in_list": True, "sort": 2},
        {"key": "technical_owner","label": "Wlasciciel techniczny","label_en": "Technical Owner",  "type": "text",   "tab": "Zarzadzanie", "sort": 3},
        {"key": "purchase_date",  "label": "Data zakupu",        "label_en": "Purchase Date",     "type": "date",   "tab": "Zarzadzanie", "sort": 4},
        {"key": "support_end",    "label": "Koniec wsparcia",    "label_en": "Support End Date",  "type": "date",   "tab": "Zarzadzanie", "sort": 5},
        {"key": "rack_position",  "label": "Pozycja w szafie (U)","label_en": "Rack Position (U)","type": "number", "tab": "Lokalizacja", "sort": 1},
    ])

    # ── Laptops ──
    _add_fields("laptops", [
        {"key": "hostname",       "label": "Hostname",           "label_en": "Hostname",          "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 1},
        {"key": "serial_number",  "label": "Numer seryjny",      "label_en": "Serial Number",     "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 2},
        {"key": "vendor",         "label": "Producent",          "label_en": "Vendor",            "type": "text",   "tab": "Informacje", "sort": 3},
        {"key": "model",          "label": "Model",              "label_en": "Model",             "type": "text",   "tab": "Informacje", "sort": 4},
        {"key": "os_name",        "label": "System operacyjny",  "label_en": "Operating System",  "type": "text",   "tab": "Informacje", "sort": 5},
        {"key": "assigned_to",    "label": "Przypisany do",      "label_en": "Assigned To",       "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 6},
        {"key": "status",         "label": "Status",             "label_en": "Status",            "type": "select", "tab": "Zarzadzanie", "options": '["Aktywny","W naprawie","Wycofany","Zagubiony"]', "show_in_list": True, "sort": 1},
        {"key": "purchase_date",  "label": "Data zakupu",        "label_en": "Purchase Date",     "type": "date",   "tab": "Zarzadzanie", "sort": 2},
        {"key": "warranty_end",   "label": "Koniec gwarancji",   "label_en": "Warranty End",      "type": "date",   "tab": "Zarzadzanie", "sort": 3},
    ])

    # ── Desktops ──
    _add_fields("desktops", [
        {"key": "hostname",       "label": "Hostname",           "label_en": "Hostname",          "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 1},
        {"key": "ip_address",     "label": "Adres IP",           "label_en": "IP Address",        "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 2},
        {"key": "serial_number",  "label": "Numer seryjny",      "label_en": "Serial Number",     "type": "text",   "tab": "Informacje", "sort": 3},
        {"key": "vendor",         "label": "Producent",          "label_en": "Vendor",            "type": "text",   "tab": "Informacje", "sort": 4},
        {"key": "model",          "label": "Model",              "label_en": "Model",             "type": "text",   "tab": "Informacje", "sort": 5},
        {"key": "os_name",        "label": "System operacyjny",  "label_en": "Operating System",  "type": "text",   "tab": "Informacje", "sort": 6},
        {"key": "assigned_to",    "label": "Przypisany do",      "label_en": "Assigned To",       "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 7},
        {"key": "status",         "label": "Status",             "label_en": "Status",            "type": "select", "tab": "Zarzadzanie", "options": '["Aktywny","W naprawie","Wycofany"]', "show_in_list": True, "sort": 1},
    ])

    # ── Network devices ──
    _add_fields("network_devices", [
        {"key": "hostname",       "label": "Hostname",           "label_en": "Hostname",          "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 1},
        {"key": "ip_address",     "label": "Adres IP",           "label_en": "IP Address",        "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 2},
        {"key": "device_type",    "label": "Typ urzadzenia",     "label_en": "Device Type",       "type": "select", "tab": "Informacje", "options": '["Router","Switch","Firewall","Access Point","Load Balancer","Inne"]', "show_in_list": True, "sort": 3},
        {"key": "vendor",         "label": "Producent",          "label_en": "Vendor",            "type": "text",   "tab": "Informacje", "sort": 4},
        {"key": "model",          "label": "Model",              "label_en": "Model",             "type": "text",   "tab": "Informacje", "sort": 5},
        {"key": "firmware_ver",   "label": "Wersja firmware",    "label_en": "Firmware Version",  "type": "text",   "tab": "Informacje", "sort": 6},
        {"key": "serial_number",  "label": "Numer seryjny",      "label_en": "Serial Number",     "type": "text",   "tab": "Informacje", "sort": 7},
        {"key": "port_count",     "label": "Liczba portow",      "label_en": "Port Count",        "type": "number", "tab": "Informacje", "sort": 8},
        {"key": "status",         "label": "Status",             "label_en": "Status",            "type": "select", "tab": "Zarzadzanie", "options": '["Aktywny","W budowie","Wycofywany","Wycofany"]', "show_in_list": True, "sort": 1},
    ])

    # ── Networks ──
    _add_fields("networks", [
        {"key": "network_cidr",   "label": "CIDR",              "label_en": "Network CIDR",      "type": "text",   "tab": "Informacje", "placeholder": "np. 10.0.0.0/24", "show_in_list": True, "sort": 1},
        {"key": "vlan_id",        "label": "VLAN ID",           "label_en": "VLAN ID",           "type": "number", "tab": "Informacje", "show_in_list": True, "sort": 2},
        {"key": "network_type",   "label": "Typ sieci",         "label_en": "Network Type",      "type": "select", "tab": "Informacje", "options": '["LAN","WAN","DMZ","VPN","WiFi","Inne"]', "show_in_list": True, "sort": 3},
        {"key": "gateway",        "label": "Brama",             "label_en": "Gateway",           "type": "text",   "tab": "Informacje", "sort": 4},
        {"key": "dns_servers",    "label": "Serwery DNS",       "label_en": "DNS Servers",       "type": "text",   "tab": "Informacje", "sort": 5},
        {"key": "status",         "label": "Status",            "label_en": "Status",            "type": "select", "tab": "Zarzadzanie", "options": '["Aktywna","Planowana","Wycofana"]', "show_in_list": True, "sort": 1},
    ])

    # ── Applications ──
    _add_fields("applications", [
        {"key": "app_version",    "label": "Wersja",             "label_en": "Version",           "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 1},
        {"key": "app_url",        "label": "URL",                "label_en": "URL",               "type": "url",    "tab": "Informacje", "placeholder": "https://...", "sort": 2},
        {"key": "technology",     "label": "Technologia",        "label_en": "Technology Stack",  "type": "text",   "tab": "Informacje", "placeholder": "np. Python, React, PostgreSQL", "sort": 3},
        {"key": "vendor",         "label": "Dostawca",           "label_en": "Vendor",            "type": "text",   "tab": "Informacje", "sort": 4},
        {"key": "license_type",   "label": "Typ licencji",       "label_en": "License Type",      "type": "select", "tab": "Informacje", "options": '["Open Source","Komercyjna","SaaS","Wewnetrzna"]', "sort": 5},
        {"key": "environment",    "label": "Srodowisko",         "label_en": "Environment",       "type": "select", "tab": "Zarzadzanie", "options": '["Produkcja","Staging","Development","Test"]', "show_in_list": True, "sort": 1},
        {"key": "status",         "label": "Status",             "label_en": "Status",            "type": "select", "tab": "Zarzadzanie", "options": '["Aktywna","W rozwoju","Wycofywana","Wycofana"]', "show_in_list": True, "sort": 2},
        {"key": "business_owner", "label": "Wlasciciel biznesowy","label_en": "Business Owner",   "type": "text",   "tab": "Zarzadzanie", "sort": 3},
        {"key": "users_count",    "label": "Liczba uzytkownikow","label_en": "Users Count",       "type": "number", "tab": "Zarzadzanie", "sort": 4},
    ])

    # ── Databases ──
    _add_fields("databases", [
        {"key": "db_engine",      "label": "Silnik bazy",        "label_en": "Database Engine",   "type": "select", "tab": "Informacje", "options": '["MySQL","PostgreSQL","MariaDB","Oracle","SQL Server","MongoDB","Redis","Elasticsearch","Inne"]', "show_in_list": True, "sort": 1},
        {"key": "db_version",     "label": "Wersja",             "label_en": "Version",           "type": "text",   "tab": "Informacje", "sort": 2},
        {"key": "hostname",       "label": "Host",               "label_en": "Hostname",          "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 3},
        {"key": "port",           "label": "Port",               "label_en": "Port",              "type": "number", "tab": "Informacje", "sort": 4},
        {"key": "size_gb",        "label": "Rozmiar (GB)",       "label_en": "Size (GB)",         "type": "number", "tab": "Informacje", "sort": 5},
        {"key": "backup_schedule","label": "Harmonogram backupu","label_en": "Backup Schedule",   "type": "text",   "tab": "Zarzadzanie", "sort": 1},
        {"key": "environment",    "label": "Srodowisko",         "label_en": "Environment",       "type": "select", "tab": "Zarzadzanie", "options": '["Produkcja","Staging","Development","Test"]', "show_in_list": True, "sort": 2},
        {"key": "status",         "label": "Status",             "label_en": "Status",            "type": "select", "tab": "Zarzadzanie", "options": '["Aktywna","W budowie","Wycofywana","Wycofana"]', "show_in_list": True, "sort": 3},
    ])

    # ── Cloud services ──
    _add_fields("cloud_services", [
        {"key": "provider",       "label": "Dostawca chmury",    "label_en": "Cloud Provider",    "type": "select", "tab": "Informacje", "options": '["AWS","Azure","GCP","OVH","Hetzner","DigitalOcean","Inne"]', "show_in_list": True, "sort": 1},
        {"key": "service_type",   "label": "Typ uslugi",         "label_en": "Service Type",      "type": "select", "tab": "Informacje", "options": '["IaaS","PaaS","SaaS","FaaS"]', "show_in_list": True, "sort": 2},
        {"key": "region",         "label": "Region",             "label_en": "Region",            "type": "text",   "tab": "Informacje", "placeholder": "np. eu-central-1", "sort": 3},
        {"key": "account_id",     "label": "ID konta",           "label_en": "Account ID",        "type": "text",   "tab": "Informacje", "sort": 4},
        {"key": "monthly_cost",   "label": "Koszt miesiczny",    "label_en": "Monthly Cost",      "type": "number", "tab": "Zarzadzanie", "sort": 1},
        {"key": "status",         "label": "Status",             "label_en": "Status",            "type": "select", "tab": "Zarzadzanie", "options": '["Aktywna","W budowie","Wycofywana","Wycofana"]', "show_in_list": True, "sort": 2},
    ])

    # ── Information systems ──
    _add_fields("information_systems", [
        {"key": "system_type",    "label": "Typ systemu",        "label_en": "System Type",       "type": "select", "tab": "Informacje", "options": '["ERP","CRM","HRM","ITSM","SCM","BI","DMS","Inne"]', "show_in_list": True, "sort": 1},
        {"key": "vendor",         "label": "Dostawca",           "label_en": "Vendor",            "type": "text",   "tab": "Informacje", "sort": 2},
        {"key": "version",        "label": "Wersja",             "label_en": "Version",           "type": "text",   "tab": "Informacje", "sort": 3},
        {"key": "app_url",        "label": "URL",                "label_en": "URL",               "type": "url",    "tab": "Informacje", "sort": 4},
        {"key": "users_count",    "label": "Liczba uzytkownikow","label_en": "Users Count",       "type": "number", "tab": "Informacje", "sort": 5},
        {"key": "business_owner", "label": "Wlasciciel biznesowy","label_en": "Business Owner",   "type": "text",   "tab": "Zarzadzanie", "show_in_list": True, "sort": 1},
        {"key": "environment",    "label": "Srodowisko",         "label_en": "Environment",       "type": "select", "tab": "Zarzadzanie", "options": '["Produkcja","Staging","Development","Test"]', "show_in_list": True, "sort": 2},
        {"key": "status",         "label": "Status",             "label_en": "Status",            "type": "select", "tab": "Zarzadzanie", "options": '["Aktywny","Wdrazany","Wycofywany","Wycofany"]', "show_in_list": True, "sort": 3},
        {"key": "sla_level",      "label": "Poziom SLA",         "label_en": "SLA Level",         "type": "select", "tab": "Zarzadzanie", "options": '["Platynowy","Zloty","Srebrny","Brazowy"]', "sort": 4},
    ])

    # ── Employees ──
    _add_fields("employees", [
        {"key": "email",          "label": "Email",              "label_en": "Email",             "type": "email",  "tab": "Informacje", "show_in_list": True, "sort": 1},
        {"key": "phone",          "label": "Telefon",            "label_en": "Phone",             "type": "text",   "tab": "Informacje", "sort": 2},
        {"key": "position",       "label": "Stanowisko",         "label_en": "Position",          "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 3},
        {"key": "department",     "label": "Dzial",              "label_en": "Department",        "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 4},
        {"key": "employment_date","label": "Data zatrudnienia",  "label_en": "Employment Date",   "type": "date",   "tab": "Informacje", "sort": 5},
        {"key": "access_level",   "label": "Poziom dostepu",     "label_en": "Access Level",      "type": "select", "tab": "Bezpieczenstwo", "options": '["Podstawowy","Rozszerzony","Administracyjny","Uprzywilejowany"]', "sort": 1},
        {"key": "security_training","label": "Szkolenie bezp.",  "label_en": "Security Training", "type": "boolean","tab": "Bezpieczenstwo", "sort": 2},
    ])

    # ── Locations ──
    _add_fields("locations", [
        {"key": "address",        "label": "Adres",              "label_en": "Address",           "type": "textarea","tab": "Informacje", "show_in_list": True, "sort": 1},
        {"key": "city",           "label": "Miasto",             "label_en": "City",              "type": "text",   "tab": "Informacje", "show_in_list": True, "sort": 2},
        {"key": "country",        "label": "Kraj",               "label_en": "Country",           "type": "text",   "tab": "Informacje", "sort": 3},
        {"key": "building_type",  "label": "Typ budynku",        "label_en": "Building Type",     "type": "select", "tab": "Informacje", "options": '["Biuro","Serwerownia","Magazyn","Centrum danych","Inne"]', "sort": 4},
        {"key": "access_control", "label": "Kontrola dostepu",   "label_en": "Access Control",    "type": "select", "tab": "Bezpieczenstwo", "options": '["Karta","Biometria","PIN","Klucz","Brak"]', "sort": 1},
        {"key": "fire_protection","label": "Ochrona p.poz.",     "label_en": "Fire Protection",   "type": "boolean","tab": "Bezpieczenstwo", "sort": 2},
    ])

    # ── Environments ──
    _add_fields("environments", [
        {"key": "env_type",       "label": "Typ srodowiska",     "label_en": "Environment Type",  "type": "select", "tab": "Informacje", "options": '["Produkcja","Pre-produkcja","Staging","Development","Test","DR"]', "show_in_list": True, "sort": 1},
        {"key": "infrastructure", "label": "Infrastruktura",     "label_en": "Infrastructure",    "type": "select", "tab": "Informacje", "options": '["On-premise","Cloud","Hybrid"]', "show_in_list": True, "sort": 2},
        {"key": "status",         "label": "Status",             "label_en": "Status",            "type": "select", "tab": "Informacje", "options": '["Aktywne","W budowie","Wycofywane"]', "show_in_list": True, "sort": 3},
    ])


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "assets", "custom_attributes"):
        op.drop_column("assets", "custom_attributes")
    if _col_exists(conn, "assets", "asset_category_id"):
        op.drop_column("assets", "asset_category_id")
    if _table_exists(conn, "category_field_definitions"):
        op.drop_table("category_field_definitions")
    if _table_exists(conn, "relationship_types"):
        op.drop_table("relationship_types")
    if _table_exists(conn, "asset_categories"):
        op.drop_table("asset_categories")
