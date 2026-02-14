-- ============================================================
-- Migration 017: Requirements Repository (Repozytorium Wymagań)
-- Extends frameworks table to serve as universal document repository
-- Adds document type, origin, review management, versioning, org unit linking
--
-- IDEMPOTENT: safe to run multiple times
-- ============================================================

DELIMITER $$

-- ── 1. Add new columns to frameworks table ──

DROP PROCEDURE IF EXISTS _m017_frameworks_columns$$
CREATE PROCEDURE _m017_frameworks_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'document_type_id'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN document_type_id INT DEFAULT NULL
      COMMENT 'FK to dictionary_entries: Norma, Standard, Rozporządzenie, Polityka, Procedura, Regulamin, Instrukcja, Umowa';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'document_origin'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN document_origin VARCHAR(20) NOT NULL DEFAULT 'external'
      COMMENT 'internal = wewnętrzny, external = zewnętrzny';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'owner'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN owner VARCHAR(200) DEFAULT NULL
      COMMENT 'Document owner / responsible person';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN approved_by VARCHAR(200) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN approved_at DATETIME DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'requires_review'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN requires_review BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'review_frequency_months'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN review_frequency_months INT NOT NULL DEFAULT 12;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'next_review_date'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN next_review_date DATE DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'last_reviewed_at'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN last_reviewed_at DATETIME DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN reviewed_by VARCHAR(200) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'major_version'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN major_version INT NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'minor_version'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN minor_version INT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND column_name = 'updates_document_id'
  ) THEN
    ALTER TABLE frameworks ADD COLUMN updates_document_id INT DEFAULT NULL
      COMMENT 'If set, this is a draft update proposal for the referenced document';
  END IF;
END$$

CALL _m017_frameworks_columns()$$
DROP PROCEDURE IF EXISTS _m017_frameworks_columns$$


-- ── 2. Foreign keys on frameworks ──

DROP PROCEDURE IF EXISTS _m017_frameworks_fks$$
CREATE PROCEDURE _m017_frameworks_fks()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND constraint_name = 'fk_fw_document_type'
  ) THEN
    ALTER TABLE frameworks
      ADD CONSTRAINT fk_fw_document_type FOREIGN KEY (document_type_id)
        REFERENCES dictionary_entries(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND constraint_name = 'fk_fw_updates_document'
  ) THEN
    ALTER TABLE frameworks
      ADD CONSTRAINT fk_fw_updates_document FOREIGN KEY (updates_document_id)
        REFERENCES frameworks(id) ON DELETE SET NULL;
  END IF;
END$$

CALL _m017_frameworks_fks()$$
DROP PROCEDURE IF EXISTS _m017_frameworks_fks$$


-- ── 3. Indexes on frameworks ──

DROP PROCEDURE IF EXISTS _m017_frameworks_idx$$
CREATE PROCEDURE _m017_frameworks_idx()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND index_name = 'ix_fw_document_type'
  ) THEN
    CREATE INDEX ix_fw_document_type ON frameworks(document_type_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND index_name = 'ix_fw_document_origin'
  ) THEN
    CREATE INDEX ix_fw_document_origin ON frameworks(document_origin);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND index_name = 'ix_fw_lifecycle'
  ) THEN
    CREATE INDEX ix_fw_lifecycle ON frameworks(lifecycle_status);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'frameworks' AND index_name = 'ix_fw_updates_doc'
  ) THEN
    CREATE INDEX ix_fw_updates_doc ON frameworks(updates_document_id);
  END IF;
END$$

CALL _m017_frameworks_idx()$$
DROP PROCEDURE IF EXISTS _m017_frameworks_idx$$


-- ── 4. Add point_type_id to framework_nodes ──

DROP PROCEDURE IF EXISTS _m017_nodes_point_type$$
CREATE PROCEDURE _m017_nodes_point_type()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'framework_nodes' AND column_name = 'point_type_id'
  ) THEN
    ALTER TABLE framework_nodes ADD COLUMN point_type_id INT DEFAULT NULL
      COMMENT 'Node type from dictionary: Rozdział, Pkt, Ppkt, Art., Rekomendacja';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'framework_nodes' AND constraint_name = 'fk_fwnode_point_type'
  ) THEN
    ALTER TABLE framework_nodes
      ADD CONSTRAINT fk_fwnode_point_type FOREIGN KEY (point_type_id)
        REFERENCES dictionary_entries(id) ON DELETE SET NULL;
  END IF;
END$$

CALL _m017_nodes_point_type()$$
DROP PROCEDURE IF EXISTS _m017_nodes_point_type$$


-- ── 5. Create framework_org_units table (M2M) ──

CREATE TABLE IF NOT EXISTS framework_org_units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  framework_id INT NOT NULL,
  org_unit_id INT NOT NULL,
  compliance_status VARCHAR(30) NOT NULL DEFAULT 'not_assessed'
    COMMENT 'not_assessed, compliant, partially_compliant, non_compliant, requires_update',
  last_assessed_at DATETIME DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fwou_framework FOREIGN KEY (framework_id) REFERENCES frameworks(id) ON DELETE CASCADE,
  CONSTRAINT fk_fwou_org_unit FOREIGN KEY (org_unit_id) REFERENCES org_units(id) ON DELETE CASCADE,
  CONSTRAINT uq_fw_orgunit UNIQUE (framework_id, org_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4$$


-- ── 6. Create framework_reviews table ──

CREATE TABLE IF NOT EXISTS framework_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  framework_id INT NOT NULL,
  reviewer VARCHAR(200) DEFAULT NULL,
  review_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  review_type VARCHAR(30) NOT NULL DEFAULT 'periodic'
    COMMENT 'periodic, ad_hoc, update_review',
  findings TEXT DEFAULT NULL,
  recommendations TEXT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed'
    COMMENT 'pending, completed, overdue',
  next_review_date DATE DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fwrev_framework FOREIGN KEY (framework_id) REFERENCES frameworks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4$$

DROP PROCEDURE IF EXISTS _m017_reviews_idx$$
CREATE PROCEDURE _m017_reviews_idx()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'framework_reviews' AND index_name = 'ix_fwrev_framework'
  ) THEN
    CREATE INDEX ix_fwrev_framework ON framework_reviews(framework_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'framework_reviews' AND index_name = 'ix_fwrev_status'
  ) THEN
    CREATE INDEX ix_fwrev_status ON framework_reviews(status);
  END IF;
END$$

CALL _m017_reviews_idx()$$
DROP PROCEDURE IF EXISTS _m017_reviews_idx$$

DELIMITER ;


-- ── 7. Seed document_type dictionary ──

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


-- ── 8. Seed point_type dictionary for document structure ──

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


-- ── 9. Verification ──

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

SELECT 'framework_org_units table' AS check_type,
       COUNT(*) AS found,
       1 AS expected
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'framework_org_units';

SELECT 'framework_reviews table' AS check_type,
       COUNT(*) AS found,
       1 AS expected
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'framework_reviews';

SELECT 'document_type dict entries' AS check_type,
       COUNT(*) AS found,
       8 AS expected
FROM dictionary_entries de
JOIN dictionary_types dt ON dt.id = de.dict_type_id
WHERE dt.code = 'document_type';

SELECT 'point_type dict entries' AS check_type,
       COUNT(*) AS found,
       8 AS expected
FROM dictionary_entries de
JOIN dictionary_types dt ON dt.id = de.dict_type_id
WHERE dt.code = 'point_type';

SELECT '=== MIGRATION 017 COMPLETE ===' AS '';
