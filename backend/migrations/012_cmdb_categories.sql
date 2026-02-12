-- ============================================================
-- Migration 012: CMDB Categories, Field Definitions, Relationship Types
-- Database: MariaDB 10.x+
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. TABELA: asset_categories (drzewo hierarchiczne kategorii)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS asset_categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    parent_id   INT NULL,
    name        VARCHAR(200) NOT NULL,
    name_plural VARCHAR(200) NULL,
    code        VARCHAR(100) NOT NULL,
    icon        VARCHAR(50)  NULL,
    color       VARCHAR(7)   NULL,
    description TEXT         NULL,
    is_abstract TINYINT(1)   NOT NULL DEFAULT 0,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_asset_categories_code (code),
    CONSTRAINT fk_asset_categories_parent
        FOREIGN KEY (parent_id) REFERENCES asset_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ══════════════════════════════════════════════════════════════
-- 2. TABELA: category_field_definitions (dynamiczne pola formularzy)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS category_field_definitions (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    category_id           INT          NOT NULL,
    inherited_from_id     INT          NULL,
    field_key             VARCHAR(100) NOT NULL,
    label                 VARCHAR(200) NOT NULL,
    label_en              VARCHAR(200) NULL,
    field_type            VARCHAR(50)  NOT NULL COMMENT 'text|number|date|boolean|select|multiselect|reference|textarea|url|email',
    tab_name              VARCHAR(100) NOT NULL DEFAULT 'Informacje',
    section_name          VARCHAR(200) NULL,
    is_required           TINYINT(1)   NOT NULL DEFAULT 0,
    is_unique             TINYINT(1)   NOT NULL DEFAULT 0,
    default_value         VARCHAR(500) NULL,
    placeholder           VARCHAR(300) NULL,
    help_text             TEXT         NULL,
    min_value             DECIMAL(15,2) NULL,
    max_value             DECIMAL(15,2) NULL,
    max_length            INT          NULL,
    regex_pattern         VARCHAR(500) NULL,
    options_json          JSON         NULL COMMENT 'Opcje dla select/multiselect',
    reference_category_id INT          NULL,
    show_in_list          TINYINT(1)   NOT NULL DEFAULT 0,
    sort_order            INT          NOT NULL DEFAULT 0,
    column_width          INT          NOT NULL DEFAULT 150,
    is_active             TINYINT(1)   NOT NULL DEFAULT 1,
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_category_field_key (category_id, field_key),
    CONSTRAINT fk_cfd_category
        FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE,
    CONSTRAINT fk_cfd_inherited
        FOREIGN KEY (inherited_from_id) REFERENCES asset_categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_cfd_ref_category
        FOREIGN KEY (reference_category_id) REFERENCES asset_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ══════════════════════════════════════════════════════════════
-- 3. TABELA: relationship_types (konfigurowalne typy relacji)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS relationship_types (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    code         VARCHAR(100) NOT NULL,
    name         VARCHAR(200) NOT NULL,
    name_reverse VARCHAR(200) NULL,
    color        VARCHAR(7)   NULL,
    icon         VARCHAR(50)  NULL,
    description  TEXT         NULL,
    sort_order   INT          NOT NULL DEFAULT 0,
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,

    UNIQUE KEY uq_relationship_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ══════════════════════════════════════════════════════════════
-- 4. ALTER TABLE assets — nowe kolumny CMDB
-- ══════════════════════════════════════════════════════════════
ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS asset_category_id INT NULL AFTER notes,
    ADD COLUMN IF NOT EXISTS custom_attributes JSON NULL AFTER asset_category_id;

ALTER TABLE assets
    ADD CONSTRAINT fk_assets_asset_category
        FOREIGN KEY (asset_category_id) REFERENCES asset_categories(id) ON DELETE SET NULL;


-- ══════════════════════════════════════════════════════════════
-- 5. SEED: Typy relacji
-- ══════════════════════════════════════════════════════════════
INSERT IGNORE INTO relationship_types (code, name, name_reverse, color, sort_order) VALUES
    ('depends_on',   'Zalezy od',             'Jest wymagany przez',  '#F59E0B', 1),
    ('supports',     'Wspiera',               'Jest wspierany przez', '#3B82F6', 2),
    ('connects_to',  'Laczy sie z',           'Jest polaczony z',     '#8B5CF6', 3),
    ('contains',     'Zawiera',               'Jest zawarty w',       '#10B981', 4),
    ('backup_of',    'Jest backupem',         'Ma backup',            '#06B6D4', 5),
    ('replaces',     'Zastepuje',             'Jest zastapiony przez','#EF4444', 6),
    ('runs_on',      'Dziala na',             'Uruchamia',            '#F97316', 7),
    ('managed_by',   'Zarzadzany przez',      'Zarzadza',             '#6366F1', 8),
    ('used_by',      'Uzywany przez',         'Uzywa',               '#EC4899', 9),
    ('hosted_on',    'Hostowany na',          'Hostuje',              '#14B8A6', 10);


-- ══════════════════════════════════════════════════════════════
-- 6. SEED: Kategorie aktywow (drzewo hierarchiczne)
-- ══════════════════════════════════════════════════════════════

-- Poziom 1: grupy nadrzedne (abstract)
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order) VALUES
    ('hardware',    'Sprzet IT',        'Sprzet IT',        'HardDrive', '#3B82F6', NULL, 1, 1),
    ('networking',  'Sieci',            'Sieci',            'Network',   '#8B5CF6', NULL, 1, 2),
    ('software',    'Oprogramowanie',   'Oprogramowanie',   'Code',      '#10B981', NULL, 1, 3),
    ('people',      'Ludzie',           'Ludzie',           'Users',     '#F59E0B', NULL, 1, 4),
    ('information', 'Informacje',       'Informacje',       'FileText',  '#EF4444', NULL, 1, 5),
    ('physical',    'Obiekty fizyczne', 'Obiekty fizyczne', 'Building',  '#06B6D4', NULL, 1, 6),
    ('processes',   'Procesy',          'Procesy',          'Workflow',  '#EC4899', NULL, 1, 7);

-- Poziom 2: konkretne kategorie
-- Sprzet IT
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'servers', 'Serwery', 'Serwery', 'Server', '#2563EB', id, 0, 1 FROM asset_categories WHERE code='hardware';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'desktops', 'Komputery stacjonarne', 'Komputery stacjonarne', 'Monitor', '#3B82F6', id, 0, 2 FROM asset_categories WHERE code='hardware';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'laptops', 'Laptopy', 'Laptopy', 'Laptop', '#60A5FA', id, 0, 3 FROM asset_categories WHERE code='hardware';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'mobile_devices', 'Urzadzenia mobilne', 'Urzadzenia mobilne', 'Smartphone', '#93C5FD', id, 0, 4 FROM asset_categories WHERE code='hardware';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'peripherals', 'Urzadzenia peryferyjne', 'Urzadzenia peryferyjne', 'Printer', '#BFDBFE', id, 0, 5 FROM asset_categories WHERE code='hardware';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'storage_media', 'Nosniki danych', 'Nosniki danych', 'Database', '#1D4ED8', id, 0, 6 FROM asset_categories WHERE code='hardware';

-- Sieci
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'networks', 'Sieci', 'Sieci', 'Globe', '#7C3AED', id, 0, 1 FROM asset_categories WHERE code='networking';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'network_devices', 'Urzadzenia sieciowe', 'Urzadzenia sieciowe', 'Router', '#8B5CF6', id, 0, 2 FROM asset_categories WHERE code='networking';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'security_appliances', 'Urzadzenia bezpieczenstwa', 'Urzadzenia bezpieczenstwa', 'Shield', '#A78BFA', id, 0, 3 FROM asset_categories WHERE code='networking';

-- Oprogramowanie
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'information_systems', 'Systemy informatyczne', 'Systemy informatyczne', 'Layers', '#059669', id, 0, 1 FROM asset_categories WHERE code='software';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'applications', 'Aplikacje', 'Aplikacje', 'AppWindow', '#10B981', id, 0, 2 FROM asset_categories WHERE code='software';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'databases', 'Bazy danych', 'Bazy danych', 'Database', '#34D399', id, 0, 3 FROM asset_categories WHERE code='software';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'cloud_services', 'Uslugi chmurowe', 'Uslugi chmurowe', 'Cloud', '#6EE7B7', id, 0, 4 FROM asset_categories WHERE code='software';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'environments', 'Srodowiska', 'Srodowiska', 'Settings', '#047857', id, 0, 5 FROM asset_categories WHERE code='software';

-- Ludzie
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'employees', 'Pracownicy', 'Pracownicy', 'User', '#D97706', id, 0, 1 FROM asset_categories WHERE code='people';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'teams', 'Zespoly', 'Zespoly', 'UsersGroup', '#F59E0B', id, 0, 2 FROM asset_categories WHERE code='people';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'ext_vendors', 'Dostawcy zewnetrzni', 'Dostawcy zewnetrzni', 'Briefcase', '#FBBF24', id, 0, 3 FROM asset_categories WHERE code='people';

-- Informacje
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'documents', 'Dokumenty', 'Dokumenty', 'File', '#DC2626', id, 0, 1 FROM asset_categories WHERE code='information';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'datasets', 'Zbiory danych', 'Zbiory danych', 'Table', '#EF4444', id, 0, 2 FROM asset_categories WHERE code='information';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'certificates', 'Certyfikaty i klucze', 'Certyfikaty i klucze', 'Key', '#F87171', id, 0, 3 FROM asset_categories WHERE code='information';

-- Obiekty fizyczne
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'locations', 'Lokalizacje', 'Lokalizacje', 'MapPin', '#0891B2', id, 0, 1 FROM asset_categories WHERE code='physical';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'rooms', 'Pomieszczenia', 'Pomieszczenia', 'Door', '#06B6D4', id, 0, 2 FROM asset_categories WHERE code='physical';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'racks', 'Szafy serwerowe', 'Szafy serwerowe', 'Server', '#22D3EE', id, 0, 3 FROM asset_categories WHERE code='physical';

-- Procesy
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'business_processes', 'Procesy biznesowe', 'Procesy biznesowe', 'GitBranch', '#DB2777', id, 0, 1 FROM asset_categories WHERE code='processes';
INSERT IGNORE INTO asset_categories (code, name, name_plural, icon, color, parent_id, is_abstract, sort_order)
SELECT 'it_services', 'Uslugi IT', 'Uslugi IT', 'Headphones', '#EC4899', id, 0, 2 FROM asset_categories WHERE code='processes';


-- ══════════════════════════════════════════════════════════════
-- 7. SEED: Definicje pol formularzy per kategoria
-- ══════════════════════════════════════════════════════════════

-- ── Serwery ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'hostname', 'Hostname', 'Hostname', 'text', 'Informacje', 1, 'np. srv-db-01', NULL, 1, 1 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'ip_address', 'Adres IP', 'IP Address', 'text', 'Informacje', 0, 'np. 10.0.0.1', NULL, 1, 2 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'os_name', 'System operacyjny', 'Operating System', 'text', 'Informacje', 0, 'np. Ubuntu 22.04', NULL, 0, 3 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'cpu_cores', 'CPU (rdzenie)', 'CPU Cores', 'number', 'Informacje', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'ram_gb', 'RAM (GB)', 'RAM (GB)', 'number', 'Informacje', 0, NULL, NULL, 0, 5 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'disk_gb', 'Dysk (GB)', 'Disk (GB)', 'number', 'Informacje', 0, NULL, NULL, 0, 6 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'vendor', 'Producent', 'Vendor', 'text', 'Informacje', 0, 'np. Dell, HP', NULL, 0, 7 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'model', 'Model', 'Model', 'text', 'Informacje', 0, NULL, NULL, 0, 8 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'serial_number', 'Numer seryjny', 'Serial Number', 'text', 'Informacje', 0, NULL, NULL, 0, 9 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'environment', 'Srodowisko', 'Environment', 'select', 'Zarzadzanie', 0, NULL, '["Produkcja","Staging","Development","Test"]', 1, 1 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Zarzadzanie', 0, NULL, '["Aktywny","W budowie","Wycofywany","Wycofany"]', 1, 2 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'technical_owner', 'Wlasciciel techniczny', 'Technical Owner', 'text', 'Zarzadzanie', 0, NULL, NULL, 0, 3 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'purchase_date', 'Data zakupu', 'Purchase Date', 'date', 'Zarzadzanie', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'support_end', 'Koniec wsparcia', 'Support End Date', 'date', 'Zarzadzanie', 0, NULL, NULL, 0, 5 FROM asset_categories WHERE code='servers';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'rack_position', 'Pozycja w szafie (U)', 'Rack Position (U)', 'number', 'Lokalizacja', 0, NULL, NULL, 0, 1 FROM asset_categories WHERE code='servers';

-- ── Laptopy ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'hostname', 'Hostname', 'Hostname', 'text', 'Informacje', 0, NULL, NULL, 1, 1 FROM asset_categories WHERE code='laptops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'serial_number', 'Numer seryjny', 'Serial Number', 'text', 'Informacje', 0, NULL, NULL, 1, 2 FROM asset_categories WHERE code='laptops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'vendor', 'Producent', 'Vendor', 'text', 'Informacje', 0, NULL, NULL, 0, 3 FROM asset_categories WHERE code='laptops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'model', 'Model', 'Model', 'text', 'Informacje', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='laptops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'os_name', 'System operacyjny', 'Operating System', 'text', 'Informacje', 0, NULL, NULL, 0, 5 FROM asset_categories WHERE code='laptops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'assigned_to', 'Przypisany do', 'Assigned To', 'text', 'Informacje', 0, NULL, NULL, 1, 6 FROM asset_categories WHERE code='laptops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Zarzadzanie', 0, NULL, '["Aktywny","W naprawie","Wycofany","Zagubiony"]', 1, 1 FROM asset_categories WHERE code='laptops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'purchase_date', 'Data zakupu', 'Purchase Date', 'date', 'Zarzadzanie', 0, NULL, NULL, 0, 2 FROM asset_categories WHERE code='laptops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'warranty_end', 'Koniec gwarancji', 'Warranty End', 'date', 'Zarzadzanie', 0, NULL, NULL, 0, 3 FROM asset_categories WHERE code='laptops';

-- ── Komputery stacjonarne ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'hostname', 'Hostname', 'Hostname', 'text', 'Informacje', 0, NULL, NULL, 1, 1 FROM asset_categories WHERE code='desktops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'ip_address', 'Adres IP', 'IP Address', 'text', 'Informacje', 0, NULL, NULL, 1, 2 FROM asset_categories WHERE code='desktops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'serial_number', 'Numer seryjny', 'Serial Number', 'text', 'Informacje', 0, NULL, NULL, 0, 3 FROM asset_categories WHERE code='desktops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'vendor', 'Producent', 'Vendor', 'text', 'Informacje', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='desktops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'model', 'Model', 'Model', 'text', 'Informacje', 0, NULL, NULL, 0, 5 FROM asset_categories WHERE code='desktops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'os_name', 'System operacyjny', 'Operating System', 'text', 'Informacje', 0, NULL, NULL, 0, 6 FROM asset_categories WHERE code='desktops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'assigned_to', 'Przypisany do', 'Assigned To', 'text', 'Informacje', 0, NULL, NULL, 1, 7 FROM asset_categories WHERE code='desktops';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Zarzadzanie', 0, NULL, '["Aktywny","W naprawie","Wycofany"]', 1, 1 FROM asset_categories WHERE code='desktops';

-- ── Urzadzenia sieciowe ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'hostname', 'Hostname', 'Hostname', 'text', 'Informacje', 0, NULL, NULL, 1, 1 FROM asset_categories WHERE code='network_devices';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'ip_address', 'Adres IP', 'IP Address', 'text', 'Informacje', 0, NULL, NULL, 1, 2 FROM asset_categories WHERE code='network_devices';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'device_type', 'Typ urzadzenia', 'Device Type', 'select', 'Informacje', 0, NULL, '["Router","Switch","Firewall","Access Point","Load Balancer","Inne"]', 1, 3 FROM asset_categories WHERE code='network_devices';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'vendor', 'Producent', 'Vendor', 'text', 'Informacje', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='network_devices';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'model', 'Model', 'Model', 'text', 'Informacje', 0, NULL, NULL, 0, 5 FROM asset_categories WHERE code='network_devices';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'firmware_ver', 'Wersja firmware', 'Firmware Version', 'text', 'Informacje', 0, NULL, NULL, 0, 6 FROM asset_categories WHERE code='network_devices';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'serial_number', 'Numer seryjny', 'Serial Number', 'text', 'Informacje', 0, NULL, NULL, 0, 7 FROM asset_categories WHERE code='network_devices';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'port_count', 'Liczba portow', 'Port Count', 'number', 'Informacje', 0, NULL, NULL, 0, 8 FROM asset_categories WHERE code='network_devices';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Zarzadzanie', 0, NULL, '["Aktywny","W budowie","Wycofywany","Wycofany"]', 1, 1 FROM asset_categories WHERE code='network_devices';

-- ── Sieci ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'network_cidr', 'CIDR', 'Network CIDR', 'text', 'Informacje', 0, 'np. 10.0.0.0/24', NULL, 1, 1 FROM asset_categories WHERE code='networks';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'vlan_id', 'VLAN ID', 'VLAN ID', 'number', 'Informacje', 0, NULL, NULL, 1, 2 FROM asset_categories WHERE code='networks';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'network_type', 'Typ sieci', 'Network Type', 'select', 'Informacje', 0, NULL, '["LAN","WAN","DMZ","VPN","WiFi","Inne"]', 1, 3 FROM asset_categories WHERE code='networks';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'gateway', 'Brama', 'Gateway', 'text', 'Informacje', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='networks';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'dns_servers', 'Serwery DNS', 'DNS Servers', 'text', 'Informacje', 0, NULL, NULL, 0, 5 FROM asset_categories WHERE code='networks';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Zarzadzanie', 0, NULL, '["Aktywna","Planowana","Wycofana"]', 1, 1 FROM asset_categories WHERE code='networks';

-- ── Aplikacje ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'app_version', 'Wersja', 'Version', 'text', 'Informacje', 0, NULL, NULL, 1, 1 FROM asset_categories WHERE code='applications';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'app_url', 'URL', 'URL', 'url', 'Informacje', 0, 'https://...', NULL, 0, 2 FROM asset_categories WHERE code='applications';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'technology', 'Technologia', 'Technology Stack', 'text', 'Informacje', 0, 'np. Python, React, PostgreSQL', NULL, 0, 3 FROM asset_categories WHERE code='applications';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'vendor', 'Dostawca', 'Vendor', 'text', 'Informacje', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='applications';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'license_type', 'Typ licencji', 'License Type', 'select', 'Informacje', 0, NULL, '["Open Source","Komercyjna","SaaS","Wewnetrzna"]', 0, 5 FROM asset_categories WHERE code='applications';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'environment', 'Srodowisko', 'Environment', 'select', 'Zarzadzanie', 0, NULL, '["Produkcja","Staging","Development","Test"]', 1, 1 FROM asset_categories WHERE code='applications';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Zarzadzanie', 0, NULL, '["Aktywna","W rozwoju","Wycofywana","Wycofana"]', 1, 2 FROM asset_categories WHERE code='applications';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'business_owner', 'Wlasciciel biznesowy', 'Business Owner', 'text', 'Zarzadzanie', 0, NULL, NULL, 0, 3 FROM asset_categories WHERE code='applications';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'users_count', 'Liczba uzytkownikow', 'Users Count', 'number', 'Zarzadzanie', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='applications';

-- ── Bazy danych ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'db_engine', 'Silnik bazy', 'Database Engine', 'select', 'Informacje', 0, NULL, '["MySQL","PostgreSQL","MariaDB","Oracle","SQL Server","MongoDB","Redis","Elasticsearch","Inne"]', 1, 1 FROM asset_categories WHERE code='databases';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'db_version', 'Wersja', 'Version', 'text', 'Informacje', 0, NULL, NULL, 0, 2 FROM asset_categories WHERE code='databases';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'hostname', 'Host', 'Hostname', 'text', 'Informacje', 0, NULL, NULL, 1, 3 FROM asset_categories WHERE code='databases';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'port', 'Port', 'Port', 'number', 'Informacje', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='databases';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'size_gb', 'Rozmiar (GB)', 'Size (GB)', 'number', 'Informacje', 0, NULL, NULL, 0, 5 FROM asset_categories WHERE code='databases';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'backup_schedule', 'Harmonogram backupu', 'Backup Schedule', 'text', 'Zarzadzanie', 0, NULL, NULL, 0, 1 FROM asset_categories WHERE code='databases';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'environment', 'Srodowisko', 'Environment', 'select', 'Zarzadzanie', 0, NULL, '["Produkcja","Staging","Development","Test"]', 1, 2 FROM asset_categories WHERE code='databases';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Zarzadzanie', 0, NULL, '["Aktywna","W budowie","Wycofywana","Wycofana"]', 1, 3 FROM asset_categories WHERE code='databases';

-- ── Uslugi chmurowe ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'provider', 'Dostawca chmury', 'Cloud Provider', 'select', 'Informacje', 0, NULL, '["AWS","Azure","GCP","OVH","Hetzner","DigitalOcean","Inne"]', 1, 1 FROM asset_categories WHERE code='cloud_services';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'service_type', 'Typ uslugi', 'Service Type', 'select', 'Informacje', 0, NULL, '["IaaS","PaaS","SaaS","FaaS"]', 1, 2 FROM asset_categories WHERE code='cloud_services';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'region', 'Region', 'Region', 'text', 'Informacje', 0, 'np. eu-central-1', NULL, 0, 3 FROM asset_categories WHERE code='cloud_services';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'account_id', 'ID konta', 'Account ID', 'text', 'Informacje', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='cloud_services';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'monthly_cost', 'Koszt miesieczny', 'Monthly Cost', 'number', 'Zarzadzanie', 0, NULL, NULL, 0, 1 FROM asset_categories WHERE code='cloud_services';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Zarzadzanie', 0, NULL, '["Aktywna","W budowie","Wycofywana","Wycofana"]', 1, 2 FROM asset_categories WHERE code='cloud_services';

-- ── Systemy informatyczne ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'system_type', 'Typ systemu', 'System Type', 'select', 'Informacje', 0, NULL, '["ERP","CRM","HRM","ITSM","SCM","BI","DMS","Inne"]', 1, 1 FROM asset_categories WHERE code='information_systems';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'vendor', 'Dostawca', 'Vendor', 'text', 'Informacje', 0, NULL, NULL, 0, 2 FROM asset_categories WHERE code='information_systems';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'version', 'Wersja', 'Version', 'text', 'Informacje', 0, NULL, NULL, 0, 3 FROM asset_categories WHERE code='information_systems';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'app_url', 'URL', 'URL', 'url', 'Informacje', 0, NULL, NULL, 0, 4 FROM asset_categories WHERE code='information_systems';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'users_count', 'Liczba uzytkownikow', 'Users Count', 'number', 'Informacje', 0, NULL, NULL, 0, 5 FROM asset_categories WHERE code='information_systems';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'business_owner', 'Wlasciciel biznesowy', 'Business Owner', 'text', 'Zarzadzanie', 0, NULL, NULL, 1, 1 FROM asset_categories WHERE code='information_systems';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'environment', 'Srodowisko', 'Environment', 'select', 'Zarzadzanie', 0, NULL, '["Produkcja","Staging","Development","Test"]', 1, 2 FROM asset_categories WHERE code='information_systems';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Zarzadzanie', 0, NULL, '["Aktywny","Wdrazany","Wycofywany","Wycofany"]', 1, 3 FROM asset_categories WHERE code='information_systems';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'sla_level', 'Poziom SLA', 'SLA Level', 'select', 'Zarzadzanie', 0, NULL, '["Platynowy","Zloty","Srebrny","Brazowy"]', 0, 4 FROM asset_categories WHERE code='information_systems';

-- ── Pracownicy ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'email', 'Email', 'Email', 'email', 'Informacje', 0, NULL, NULL, 1, 1 FROM asset_categories WHERE code='employees';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'phone', 'Telefon', 'Phone', 'text', 'Informacje', 0, NULL, NULL, 0, 2 FROM asset_categories WHERE code='employees';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'position', 'Stanowisko', 'Position', 'text', 'Informacje', 0, NULL, NULL, 1, 3 FROM asset_categories WHERE code='employees';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'department', 'Dzial', 'Department', 'text', 'Informacje', 0, NULL, NULL, 1, 4 FROM asset_categories WHERE code='employees';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'employment_date', 'Data zatrudnienia', 'Employment Date', 'date', 'Informacje', 0, NULL, NULL, 0, 5 FROM asset_categories WHERE code='employees';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'access_level', 'Poziom dostepu', 'Access Level', 'select', 'Bezpieczenstwo', 0, NULL, '["Podstawowy","Rozszerzony","Administracyjny","Uprzywilejowany"]', 0, 1 FROM asset_categories WHERE code='employees';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'security_training', 'Szkolenie bezp.', 'Security Training', 'boolean', 'Bezpieczenstwo', 0, NULL, NULL, 0, 2 FROM asset_categories WHERE code='employees';

-- ── Lokalizacje ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'address', 'Adres', 'Address', 'textarea', 'Informacje', 0, NULL, NULL, 1, 1 FROM asset_categories WHERE code='locations';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'city', 'Miasto', 'City', 'text', 'Informacje', 0, NULL, NULL, 1, 2 FROM asset_categories WHERE code='locations';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'country', 'Kraj', 'Country', 'text', 'Informacje', 0, NULL, NULL, 0, 3 FROM asset_categories WHERE code='locations';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'building_type', 'Typ budynku', 'Building Type', 'select', 'Informacje', 0, NULL, '["Biuro","Serwerownia","Magazyn","Centrum danych","Inne"]', 0, 4 FROM asset_categories WHERE code='locations';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'access_control', 'Kontrola dostepu', 'Access Control', 'select', 'Bezpieczenstwo', 0, NULL, '["Karta","Biometria","PIN","Klucz","Brak"]', 0, 1 FROM asset_categories WHERE code='locations';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'fire_protection', 'Ochrona p.poz.', 'Fire Protection', 'boolean', 'Bezpieczenstwo', 0, NULL, NULL, 0, 2 FROM asset_categories WHERE code='locations';

-- ── Srodowiska ──
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'env_type', 'Typ srodowiska', 'Environment Type', 'select', 'Informacje', 0, NULL, '["Produkcja","Pre-produkcja","Staging","Development","Test","DR"]', 1, 1 FROM asset_categories WHERE code='environments';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'infrastructure', 'Infrastruktura', 'Infrastructure', 'select', 'Informacje', 0, NULL, '["On-premise","Cloud","Hybrid"]', 1, 2 FROM asset_categories WHERE code='environments';
INSERT IGNORE INTO category_field_definitions (category_id, field_key, label, label_en, field_type, tab_name, is_required, placeholder, options_json, show_in_list, sort_order)
SELECT id, 'status', 'Status', 'Status', 'select', 'Informacje', 0, NULL, '["Aktywne","W budowie","Wycofywane"]', 1, 3 FROM asset_categories WHERE code='environments';


-- ══════════════════════════════════════════════════════════════
-- 8. Weryfikacja
-- ══════════════════════════════════════════════════════════════
SELECT 'asset_categories' AS tbl, COUNT(*) AS cnt FROM asset_categories
UNION ALL
SELECT 'category_field_definitions', COUNT(*) FROM category_field_definitions
UNION ALL
SELECT 'relationship_types', COUNT(*) FROM relationship_types;
