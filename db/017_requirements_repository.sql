-- ============================================================
-- Migration 017: Requirements Repository (Repozytorium Wymagań)
--
-- IDEMPOTENT: safe to run multiple times
-- COMPATIBLE: phpMyAdmin + MariaDB 10.0+
-- Only uses: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--            INSERT IGNORE, ON DUPLICATE KEY UPDATE
-- ============================================================


-- ── 0. Prerequisite tables ──

CREATE TABLE IF NOT EXISTS dictionary_types (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dictionary_entries (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    dict_type_id    INT NOT NULL,
    code            VARCHAR(50),
    label           VARCHAR(300) NOT NULL,
    description     TEXT,
    numeric_value   DECIMAL(10,4),
    color           VARCHAR(20),
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dict_entries_type (dict_type_id),
    INDEX idx_dict_entries_active (dict_type_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 1. Add columns to frameworks ──

ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS document_type_id INT DEFAULT NULL;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS document_origin VARCHAR(20) NOT NULL DEFAULT 'external';
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS owner VARCHAR(200) DEFAULT NULL;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS approved_by VARCHAR(200) DEFAULT NULL;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS approved_at DATETIME DEFAULT NULL;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS review_frequency_months INT NOT NULL DEFAULT 12;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS next_review_date DATE DEFAULT NULL;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS last_reviewed_at DATETIME DEFAULT NULL;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(200) DEFAULT NULL;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS major_version INT NOT NULL DEFAULT 1;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS minor_version INT NOT NULL DEFAULT 0;
ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS updates_document_id INT DEFAULT NULL;


-- ── 2. Add point_type_id to framework_nodes ──

ALTER TABLE framework_nodes ADD COLUMN IF NOT EXISTS point_type_id INT DEFAULT NULL;


-- ── 3. New tables ──

CREATE TABLE IF NOT EXISTS framework_org_units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    framework_id INT NOT NULL,
    org_unit_id INT NOT NULL,
    compliance_status VARCHAR(30) NOT NULL DEFAULT 'not_assessed',
    last_assessed_at DATETIME DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fw_orgunit (framework_id, org_unit_id),
    KEY ix_fwou_framework (framework_id),
    KEY ix_fwou_org_unit (org_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS framework_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    framework_id INT NOT NULL,
    reviewer VARCHAR(200) DEFAULT NULL,
    review_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    review_type VARCHAR(30) NOT NULL DEFAULT 'periodic',
    findings TEXT DEFAULT NULL,
    recommendations TEXT DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    next_review_date DATE DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_fwrev_framework (framework_id),
    KEY ix_fwrev_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 4. Seed document_type dictionary ──

INSERT INTO dictionary_types (code, name, description, is_system)
VALUES ('document_type', 'Typ dokumentu referencyjnego', 'Typy dokumentów w Repozytorium Wymagań', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

SET @dt_type_id = (SELECT id FROM dictionary_types WHERE code = 'document_type');

INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, description, sort_order, is_active) VALUES
(@dt_type_id, 'norma',              'Norma',              'Norma międzynarodowa lub krajowa (np. ISO, PN)', 1, TRUE),
(@dt_type_id, 'standard',           'Standard',           'Standard branżowy lub techniczny (np. CIS, NIST)', 2, TRUE),
(@dt_type_id, 'rozporzadzenie',     'Rozporządzenie',     'Rozporządzenie prawne, dyrektywa, ustawa', 3, TRUE),
(@dt_type_id, 'polityka_wewnetrzna','Polityka wewnętrzna','Wewnętrzna polityka organizacji', 4, TRUE),
(@dt_type_id, 'procedura',          'Procedura',          'Procedura operacyjna', 5, TRUE),
(@dt_type_id, 'regulamin',          'Regulamin',          'Regulamin wewnętrzny', 6, TRUE),
(@dt_type_id, 'instrukcja',         'Instrukcja',         'Instrukcja operacyjna lub techniczna', 7, TRUE),
(@dt_type_id, 'umowa',              'Umowa',              'Umowa lub kontrakt z wymogami bezpieczeństwa', 8, TRUE);


-- ── 5. Seed point_type dictionary ──

INSERT INTO dictionary_types (code, name, description, is_system)
VALUES ('point_type', 'Rodzaj punktatora', 'Typy punktów w strukturze dokumentu referencyjnego', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

SET @pt_type_id = (SELECT id FROM dictionary_types WHERE code = 'point_type');

INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, description, sort_order, is_active) VALUES
(@pt_type_id, 'rozdzial',     'Rozdział',      'Główny rozdział dokumentu', 1, TRUE),
(@pt_type_id, 'punkt',        'Pkt',           'Punkt w dokumencie', 2, TRUE),
(@pt_type_id, 'podpunkt',     'Ppkt',          'Podpunkt w dokumencie', 3, TRUE),
(@pt_type_id, 'artykul',      'Art.',          'Artykuł (akty prawne)', 4, TRUE),
(@pt_type_id, 'rekomendacja', 'Rekomendacja',  'Rekomendacja lub zalecenie', 5, TRUE),
(@pt_type_id, 'paragraf',     'Paragraf',      'Paragraf dokumentu', 6, TRUE),
(@pt_type_id, 'ustep',        'Ustęp',         'Ustęp w dokumencie', 7, TRUE),
(@pt_type_id, 'zalacznik',    'Załącznik',     'Załącznik do dokumentu', 8, TRUE);


-- ── 6. Verification (only uses information_schema) ──

SELECT '=== MIGRATION 017 VERIFICATION ===' AS '';

SELECT 'frameworks columns' AS check_type,
       COUNT(*) AS found,
       13 AS expected
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'frameworks'
  AND column_name IN (
    'document_type_id','document_origin','owner','approved_by','approved_at',
    'requires_review','review_frequency_months','next_review_date',
    'last_reviewed_at','reviewed_by','major_version','minor_version','updates_document_id'
  );

SELECT 'framework_nodes.point_type_id' AS check_type,
       COUNT(*) AS found,
       1 AS expected
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'framework_nodes'
  AND column_name = 'point_type_id';

SELECT 'framework_org_units' AS check_type,
       COUNT(*) AS found,
       1 AS expected
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'framework_org_units';

SELECT 'framework_reviews' AS check_type,
       COUNT(*) AS found,
       1 AS expected
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'framework_reviews';

SELECT 'dictionary_types' AS check_type,
       COUNT(*) AS found
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'dictionary_types';

SELECT 'dictionary_entries' AS check_type,
       COUNT(*) AS found
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'dictionary_entries';

SELECT '=== MIGRATION 017 COMPLETE ===' AS '';
