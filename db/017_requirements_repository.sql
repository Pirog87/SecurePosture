-- ============================================================
-- Migration 017: Requirements Repository (Repozytorium Wymagań)
-- Extends frameworks table to serve as universal document repository
-- Adds document type, origin, review management, versioning, org unit linking
-- ============================================================

-- ── 1. Add new columns to frameworks table ──

ALTER TABLE frameworks
  ADD COLUMN document_type_id INT DEFAULT NULL
    COMMENT 'FK to dictionary_entries: Norma, Standard, Rozporządzenie, Polityka, Procedura, Regulamin, Instrukcja, Umowa',
  ADD COLUMN document_origin VARCHAR(20) NOT NULL DEFAULT 'external'
    COMMENT 'internal = wewnętrzny, external = zewnętrzny',
  ADD COLUMN owner VARCHAR(200) DEFAULT NULL
    COMMENT 'Document owner / responsible person',
  ADD COLUMN approved_by VARCHAR(200) DEFAULT NULL,
  ADD COLUMN approved_at DATETIME DEFAULT NULL,
  ADD COLUMN requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN review_frequency_months INT NOT NULL DEFAULT 12,
  ADD COLUMN next_review_date DATE DEFAULT NULL,
  ADD COLUMN last_reviewed_at DATETIME DEFAULT NULL,
  ADD COLUMN reviewed_by VARCHAR(200) DEFAULT NULL,
  ADD COLUMN major_version INT NOT NULL DEFAULT 1,
  ADD COLUMN minor_version INT NOT NULL DEFAULT 0,
  ADD COLUMN updates_document_id INT DEFAULT NULL
    COMMENT 'If set, this is a draft update proposal for the referenced document';

ALTER TABLE frameworks
  ADD CONSTRAINT fk_fw_document_type FOREIGN KEY (document_type_id)
    REFERENCES dictionary_entries(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_fw_updates_document FOREIGN KEY (updates_document_id)
    REFERENCES frameworks(id) ON DELETE SET NULL;

CREATE INDEX ix_fw_document_type ON frameworks(document_type_id);
CREATE INDEX ix_fw_document_origin ON frameworks(document_origin);
CREATE INDEX ix_fw_lifecycle ON frameworks(lifecycle_status);
CREATE INDEX ix_fw_updates_doc ON frameworks(updates_document_id);

-- ── 2. Add point_type_id to framework_nodes ──

ALTER TABLE framework_nodes
  ADD COLUMN point_type_id INT DEFAULT NULL
    COMMENT 'Node type from dictionary: Rozdział, Pkt, Ppkt, Art., Rekomendacja';

ALTER TABLE framework_nodes
  ADD CONSTRAINT fk_fwnode_point_type FOREIGN KEY (point_type_id)
    REFERENCES dictionary_entries(id) ON DELETE SET NULL;

-- ── 3. Create framework_org_units table (M2M) ──

CREATE TABLE framework_org_units (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. Create framework_reviews table ──

CREATE TABLE framework_reviews (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_fwrev_framework ON framework_reviews(framework_id);
CREATE INDEX ix_fwrev_status ON framework_reviews(status);

-- ── 5. Seed document_type dictionary ──

INSERT INTO dictionary_types (code, name, description, is_system)
VALUES ('document_type', 'Typ dokumentu referencyjnego', 'Typy dokumentów w Repozytorium Wymagań', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

SET @dt_type_id = (SELECT id FROM dictionary_types WHERE code = 'document_type');

INSERT INTO dictionary_entries (dict_type_id, code, label, description, sort_order, is_active) VALUES
(@dt_type_id, 'norma',              'Norma',              'Norma międzynarodowa lub krajowa (np. ISO, PN)', 1, TRUE),
(@dt_type_id, 'standard',           'Standard',           'Standard branżowy lub techniczny (np. CIS, NIST)', 2, TRUE),
(@dt_type_id, 'rozporzadzenie',     'Rozporządzenie',     'Rozporządzenie prawne, dyrektywa, ustawa', 3, TRUE),
(@dt_type_id, 'polityka_wewnetrzna','Polityka wewnętrzna','Wewnętrzna polityka organizacji', 4, TRUE),
(@dt_type_id, 'procedura',          'Procedura',          'Procedura operacyjna', 5, TRUE),
(@dt_type_id, 'regulamin',          'Regulamin',          'Regulamin wewnętrzny', 6, TRUE),
(@dt_type_id, 'instrukcja',         'Instrukcja',         'Instrukcja operacyjna lub techniczna', 7, TRUE),
(@dt_type_id, 'umowa',              'Umowa',              'Umowa lub kontrakt z wymogami bezpieczeństwa', 8, TRUE);

-- ── 6. Seed point_type dictionary for document structure ──

INSERT INTO dictionary_types (code, name, description, is_system)
VALUES ('point_type', 'Rodzaj punktatora', 'Typy punktów w strukturze dokumentu referencyjnego', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

SET @pt_type_id = (SELECT id FROM dictionary_types WHERE code = 'point_type');

INSERT INTO dictionary_entries (dict_type_id, code, label, description, sort_order, is_active) VALUES
(@pt_type_id, 'rozdzial',     'Rozdział',      'Główny rozdział dokumentu', 1, TRUE),
(@pt_type_id, 'punkt',        'Pkt',           'Punkt w dokumencie', 2, TRUE),
(@pt_type_id, 'podpunkt',     'Ppkt',          'Podpunkt w dokumencie', 3, TRUE),
(@pt_type_id, 'artykul',      'Art.',          'Artykuł (akty prawne)', 4, TRUE),
(@pt_type_id, 'rekomendacja', 'Rekomendacja',  'Rekomendacja lub zalecenie', 5, TRUE),
(@pt_type_id, 'paragraf',     'Paragraf',      'Paragraf dokumentu', 6, TRUE),
(@pt_type_id, 'ustep',        'Ustęp',         'Ustęp w dokumencie', 7, TRUE),
(@pt_type_id, 'zalacznik',    'Załącznik',     'Załącznik do dokumentu', 8, TRUE);
