-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 002: Framework Engine (SAFE — z walidacjami)
-- Dla SecurePosture DB na MariaDB 10.6+ / 11+
--
-- Bezpieczne do wielokrotnego uruchomienia — sprawdza czy kolumny/tabele istnieją.
-- Wklej CAŁY skrypt w phpMyAdmin → SQL → Wykonaj.
--
-- Prereq: schema.sql + add_security_domains.sql już uruchomione
-- ═══════════════════════════════════════════════════════════════════════════════

USE secureposture;

SET @start_ts = NOW();
SELECT '>>> Framework Engine migration START' AS info, @start_ts AS started_at;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 1: Dodaj brakujące kolumny do security_domains
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a: kolumna code
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'security_domains' AND COLUMN_NAME = 'code'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE security_domains ADD COLUMN code VARCHAR(50) DEFAULT NULL AFTER description',
    'SELECT ''SKIP: security_domains.code already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1b: kolumna parent_id
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'security_domains' AND COLUMN_NAME = 'parent_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE security_domains ADD COLUMN parent_id INT DEFAULT NULL',
    'SELECT ''SKIP: security_domains.parent_id already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1c: kolumna order_id
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'security_domains' AND COLUMN_NAME = 'order_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE security_domains ADD COLUMN order_id INT NOT NULL DEFAULT 0',
    'SELECT ''SKIP: security_domains.order_id already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1d: unique index na code (jeśli nie istnieje)
SET @idx_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'security_domains' AND INDEX_NAME = 'uq_sd_code'
);
SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE security_domains ADD UNIQUE INDEX uq_sd_code (code)',
    'SELECT ''SKIP: index uq_sd_code already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1e: FK parent_id → self (jeśli nie istnieje)
SET @fk_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'security_domains' AND CONSTRAINT_NAME = 'fk_sd_parent'
);
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE security_domains ADD CONSTRAINT fk_sd_parent FOREIGN KEY (parent_id) REFERENCES security_domains(id) ON DELETE SET NULL',
    'SELECT ''SKIP: FK fk_sd_parent already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '  [OK] KROK 1: security_domains columns verified' AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 2: Poszerzenie kolumny color (bezpieczne — nie zmniejszamy)
-- ─────────────────────────────────────────────────────────────────────────────

SET @col_type = (
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'security_domains' AND COLUMN_NAME = 'color'
);
SET @sql = IF(@col_type IS NOT NULL AND @col_type NOT LIKE '%30%',
    'ALTER TABLE security_domains MODIFY COLUMN color VARCHAR(30) DEFAULT NULL',
    'SELECT ''SKIP: color already VARCHAR(30) or wider'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '  [OK] KROK 2: color column width verified' AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 3: Tabela frameworks
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS frameworks (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    urn             VARCHAR(500) NOT NULL UNIQUE,
    ref_id          VARCHAR(100) NOT NULL,
    name            VARCHAR(500) NOT NULL,
    description     TEXT,
    version         VARCHAR(50),
    provider        VARCHAR(200),
    packager        VARCHAR(200),
    copyright       TEXT,
    source_format   ENUM('ciso_assistant_excel','ciso_assistant_yaml','custom_import','manual'),
    source_url      VARCHAR(1000),
    locale          VARCHAR(10)  NOT NULL DEFAULT 'en',
    implementation_groups_definition JSON,
    total_nodes     INT NOT NULL DEFAULT 0,
    total_assessable INT NOT NULL DEFAULT 0,
    imported_at     DATETIME,
    imported_by     VARCHAR(200),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT '  [OK] KROK 3: frameworks table ready' AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 4: Tabela framework_nodes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS framework_nodes (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    framework_id            INT NOT NULL,
    parent_id               INT,
    urn                     VARCHAR(500),
    ref_id                  VARCHAR(100),
    name                    VARCHAR(500) NOT NULL,
    name_pl                 VARCHAR(500),
    description             TEXT,
    description_pl          TEXT,
    depth                   INT NOT NULL DEFAULT 1,
    order_id                INT NOT NULL DEFAULT 0,
    assessable              BOOLEAN NOT NULL DEFAULT FALSE,
    implementation_groups   VARCHAR(100),
    weight                  INT NOT NULL DEFAULT 1,
    importance              ENUM('mandatory','recommended','nice_to_have','undefined'),
    maturity_level          INT,
    annotation              TEXT,
    threats                 JSON,
    reference_controls      JSON,
    typical_evidence        TEXT,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fwnode_framework FOREIGN KEY (framework_id) REFERENCES frameworks(id) ON DELETE CASCADE,
    CONSTRAINT fk_fwnode_parent FOREIGN KEY (parent_id) REFERENCES framework_nodes(id) ON DELETE SET NULL,
    INDEX ix_fwnode_framework_parent (framework_id, parent_id),
    INDEX ix_fwnode_framework_depth (framework_id, depth),
    INDEX ix_fwnode_framework_assessable (framework_id, assessable),
    INDEX ix_fwnode_urn (urn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT '  [OK] KROK 4: framework_nodes table ready' AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 5: Tabela assessment_dimensions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessment_dimensions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    framework_id    INT NOT NULL,
    dimension_key   VARCHAR(50) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    name_pl         VARCHAR(200),
    description     TEXT,
    order_id        INT NOT NULL DEFAULT 0,
    weight          DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_dim_framework FOREIGN KEY (framework_id) REFERENCES frameworks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT '  [OK] KROK 5: assessment_dimensions table ready' AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 6: Tabela dimension_levels
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dimension_levels (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    dimension_id    INT NOT NULL,
    level_order     INT NOT NULL,
    value           DECIMAL(5,2) NOT NULL,
    label           VARCHAR(200) NOT NULL,
    label_pl        VARCHAR(200),
    description     TEXT,
    color           VARCHAR(7),
    CONSTRAINT fk_lvl_dimension FOREIGN KEY (dimension_id) REFERENCES assessment_dimensions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT '  [OK] KROK 6: dimension_levels table ready' AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 7: Tabela framework_node_security_areas (M2M)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS framework_node_security_areas (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    framework_node_id   INT NOT NULL,
    security_area_id    INT NOT NULL,
    source              ENUM('seed','manual','ai_suggested') NOT NULL DEFAULT 'manual',
    created_by          VARCHAR(200),
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fwnode_secarea (framework_node_id, security_area_id),
    CONSTRAINT fk_fnsa_node FOREIGN KEY (framework_node_id) REFERENCES framework_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_fnsa_domain FOREIGN KEY (security_area_id) REFERENCES security_domains(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT '  [OK] KROK 7: framework_node_security_areas table ready' AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 8: Tabela assessments (v2)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessments (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    ref_id                      VARCHAR(20),
    framework_id                INT NOT NULL,
    org_unit_id                 INT,
    security_area_id            INT,
    title                       VARCHAR(500),
    assessor                    VARCHAR(200),
    assessment_date             DATE NOT NULL,
    status                      ENUM('draft','in_progress','completed','approved','archived') NOT NULL DEFAULT 'draft',
    implementation_group_filter VARCHAR(100),
    notes                       TEXT,
    completion_pct              DECIMAL(5,2),
    overall_score               DECIMAL(5,2),
    approved_by                 VARCHAR(200),
    approved_at                 DATETIME,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_asm_framework FOREIGN KEY (framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_asm_orgunit FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    CONSTRAINT fk_asm_domain FOREIGN KEY (security_area_id) REFERENCES security_domains(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT '  [OK] KROK 8: assessments table ready' AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 9: Tabela assessment_answers (v2)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessment_answers (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    assessment_id       INT NOT NULL,
    framework_node_id   INT NOT NULL,
    dimension_id        INT NOT NULL,
    level_id            INT,
    not_applicable      BOOLEAN NOT NULL DEFAULT FALSE,
    notes               TEXT,
    evidence            TEXT,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_assess_node_dim (assessment_id, framework_node_id, dimension_id),
    CONSTRAINT fk_ans_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    CONSTRAINT fk_ans_node FOREIGN KEY (framework_node_id) REFERENCES framework_nodes(id),
    CONSTRAINT fk_ans_dimension FOREIGN KEY (dimension_id) REFERENCES assessment_dimensions(id),
    CONSTRAINT fk_ans_level FOREIGN KEY (level_id) REFERENCES dimension_levels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT '  [OK] KROK 9: assessment_answers table ready' AS status;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA — CIS Controls v8 jako pierwszy framework
-- Każdy INSERT sprawdza czy dane już istnieją
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 10: Seed framework CIS v8
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO frameworks (urn, ref_id, name, description, version, provider, packager,
                        source_format, locale,
                        implementation_groups_definition,
                        imported_at, imported_by, is_active)
SELECT
    'urn:intuitem:risk:framework:cis-controls-v8',
    'cis-controls-v8',
    'CIS Controls v8',
    'CIS Critical Security Controls Version 8 — 18 controls, 153 sub-controls',
    '8.0', 'CIS', 'secureposture', 'manual', 'en',
    '{"IG1": "Basic Cyber Hygiene", "IG2": "Foundational", "IG3": "Organizational"}',
    NOW(), 'system-migration', 1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM frameworks WHERE urn = 'urn:intuitem:risk:framework:cis-controls-v8'
);

SET @fw_id = (SELECT id FROM frameworks WHERE urn = 'urn:intuitem:risk:framework:cis-controls-v8');

SELECT CONCAT('  [OK] KROK 10: CIS v8 framework id = ', @fw_id) AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 11: Migracja cis_controls → framework_nodes (depth=1)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO framework_nodes
    (framework_id, parent_id, urn, ref_id, name, name_pl,
     depth, order_id, assessable, is_active)
SELECT
    @fw_id,
    NULL,
    CONCAT('urn:intuitem:risk:req_node:cis-controls-v8:', control_number),
    CAST(control_number AS CHAR),
    name_en,
    name_pl,
    1,
    control_number,
    0,
    1
FROM cis_controls cc
WHERE NOT EXISTS (
    SELECT 1 FROM framework_nodes fn
    WHERE fn.framework_id = @fw_id
      AND fn.ref_id = CAST(cc.control_number AS CHAR)
      AND fn.depth = 1
)
ORDER BY control_number;

SELECT CONCAT('  [OK] KROK 11: framework_nodes depth=1 → ',
    (SELECT COUNT(*) FROM framework_nodes WHERE framework_id = @fw_id AND depth = 1),
    ' controls') AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 12: Migracja cis_sub_controls → framework_nodes (depth=2)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO framework_nodes
    (framework_id, parent_id, urn, ref_id, name, name_pl, description, description_pl,
     depth, order_id, assessable, implementation_groups, is_active)
SELECT
    @fw_id,
    fn_parent.id,
    CONCAT('urn:intuitem:risk:req_node:cis-controls-v8:', sc.sub_id),
    sc.sub_id,
    sc.detail_en,
    COALESCE(sc.detail_pl, ''),
    sc.detail_en,
    sc.detail_pl,
    2,
    CAST(SUBSTRING_INDEX(sc.sub_id, '.', -1) AS UNSIGNED),
    1,
    sc.implementation_groups,
    1
FROM cis_sub_controls sc
JOIN cis_controls cc ON cc.id = sc.control_id
JOIN framework_nodes fn_parent
    ON fn_parent.framework_id = @fw_id
    AND fn_parent.ref_id = CAST(cc.control_number AS CHAR)
    AND fn_parent.depth = 1
WHERE NOT EXISTS (
    SELECT 1 FROM framework_nodes fn
    WHERE fn.framework_id = @fw_id
      AND fn.ref_id = sc.sub_id
      AND fn.depth = 2
)
ORDER BY sc.sub_id;

SELECT CONCAT('  [OK] KROK 12: framework_nodes depth=2 → ',
    (SELECT COUNT(*) FROM framework_nodes WHERE framework_id = @fw_id AND depth = 2),
    ' sub-controls') AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 13: Aktualizacja liczników w frameworks
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE frameworks SET
    total_nodes     = (SELECT COUNT(*) FROM framework_nodes WHERE framework_id = @fw_id AND is_active = 1),
    total_assessable = (SELECT COUNT(*) FROM framework_nodes WHERE framework_id = @fw_id AND assessable = 1 AND is_active = 1)
WHERE id = @fw_id;

SELECT CONCAT('  [OK] KROK 13: total_nodes = ',
    (SELECT total_nodes FROM frameworks WHERE id = @fw_id),
    ', total_assessable = ',
    (SELECT total_assessable FROM frameworks WHERE id = @fw_id)) AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 14: 4 wymiary oceny CIS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO assessment_dimensions (framework_id, dimension_key, name, name_pl, order_id, weight, is_active)
SELECT @fw_id, v.dimension_key, v.name, v.name_pl, v.order_id, 1.00, 1
FROM (
    SELECT 'policy_defined'      AS dimension_key, 'Policy Defined'      AS name, 'Polityka zdefiniowana'     AS name_pl, 1 AS order_id
    UNION ALL
    SELECT 'control_implemented',                   'Control Implemented',         'Kontrola wdrożona',                    2
    UNION ALL
    SELECT 'control_automated',                     'Control Automated',           'Kontrola zautomatyzowana',             3
    UNION ALL
    SELECT 'control_reported',                      'Control Reported',            'Kontrola raportowana',                 4
) v
WHERE NOT EXISTS (
    SELECT 1 FROM assessment_dimensions ad
    WHERE ad.framework_id = @fw_id AND ad.dimension_key = v.dimension_key
);

SELECT CONCAT('  [OK] KROK 14: assessment_dimensions → ',
    (SELECT COUNT(*) FROM assessment_dimensions WHERE framework_id = @fw_id),
    ' dimensions') AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 15: 5 poziomów × 4 wymiary = 20 wierszy dimension_levels
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dimension_levels (dimension_id, level_order, value, label, label_pl, color)
SELECT ad.id, lv.level_order, lv.value, lv.label, lv.label_pl, lv.color
FROM assessment_dimensions ad
CROSS JOIN (
    SELECT 0 AS level_order, 0.00 AS value, 'Not done'               AS label, 'Brak'                           AS label_pl, '#EF4444' AS color
    UNION ALL SELECT 1, 0.25, 'Informal / Parts',               'Nieformalnie / Częściowo',         '#F97316'
    UNION ALL SELECT 2, 0.50, 'Partial / Some Systems',          'Częściowo / Część systemów',       '#EAB308'
    UNION ALL SELECT 3, 0.75, 'Written / Most Systems',          'Zapisane / Większość systemów',    '#22C55E'
    UNION ALL SELECT 4, 1.00, 'Approved / All Systems',          'Zatwierdzone / Wszystkie systemy', '#16A34A'
) lv
WHERE ad.framework_id = @fw_id
  AND NOT EXISTS (
    SELECT 1 FROM dimension_levels dl
    WHERE dl.dimension_id = ad.id AND dl.level_order = lv.level_order
);

SELECT CONCAT('  [OK] KROK 15: dimension_levels → ',
    (SELECT COUNT(*) FROM dimension_levels dl
     JOIN assessment_dimensions ad ON ad.id = dl.dimension_id
     WHERE ad.framework_id = @fw_id),
    ' levels (expected: 20)') AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 16: Uzupełnij kody security_domains (match po sort_order)
-- Używa COALESCE żeby NIE nadpisywać ręcznych zmian icon/color
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE security_domains SET code = 'WORKSTATIONS',       icon = COALESCE(icon, 'monitor'),    color = COALESCE(color, '#3B82F6'), order_id = 1  WHERE sort_order = 1  AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'MOBILE_DEVICES',     icon = COALESCE(icon, 'smartphone'), color = COALESCE(color, '#8B5CF6'), order_id = 2  WHERE sort_order = 2  AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'DATA_PROTECTION',    icon = COALESCE(icon, 'shield'),     color = COALESCE(color, '#EF4444'), order_id = 3  WHERE sort_order = 3  AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'MFP_DEVICES',        icon = COALESCE(icon, 'printer'),    color = COALESCE(color, '#6B7280'), order_id = 4  WHERE sort_order = 4  AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'PAPER_DOCS',         icon = COALESCE(icon, 'file-text'),  color = COALESCE(color, '#A3A3A3'), order_id = 5  WHERE sort_order = 5  AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'SECURITY_AWARENESS', icon = COALESCE(icon, 'users'),      color = COALESCE(color, '#F59E0B'), order_id = 6  WHERE sort_order = 6  AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'PEOPLE',             icon = COALESCE(icon, 'user'),       color = COALESCE(color, '#EC4899'), order_id = 7  WHERE sort_order = 7  AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'NETWORK_INFRA',      icon = COALESCE(icon, 'wifi'),       color = COALESCE(color, '#10B981'), order_id = 8  WHERE sort_order = 8  AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'SERVER_INFRA',       icon = COALESCE(icon, 'server'),     color = COALESCE(color, '#0EA5E9'), order_id = 9  WHERE sort_order = 9  AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'TECH_INFRA',         icon = COALESCE(icon, 'cpu'),        color = COALESCE(color, '#6366F1'), order_id = 10 WHERE sort_order = 10 AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'M365_CLOUD',         icon = COALESCE(icon, 'cloud'),      color = COALESCE(color, '#2563EB'), order_id = 11 WHERE sort_order = 11 AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'ACCESS_CONTROL',     icon = COALESCE(icon, 'lock'),       color = COALESCE(color, '#DC2626'), order_id = 12 WHERE sort_order = 12 AND (code IS NULL OR code = '');
UPDATE security_domains SET code = 'PUBLIC_CLOUD',       icon = COALESCE(icon, 'cloud'),      color = COALESCE(color, '#7C3AED'), order_id = 13 WHERE sort_order = 13 AND (code IS NULL OR code = '');

SELECT CONCAT('  [OK] KROK 16: security_domains codes → ',
    (SELECT COUNT(*) FROM security_domains WHERE code IS NOT NULL AND code != ''),
    ' domains with codes') AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 17: Migracja cis_assessments → assessments
-- (pomija jeśli brak danych lub już zmigrowane)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO assessments
    (ref_id, framework_id, org_unit_id, title, assessor,
     assessment_date, status, notes,
     completion_pct, overall_score,
     is_active, created_at, updated_at)
SELECT
    CONCAT('ASM-', LPAD(ca.id, 4, '0')),
    @fw_id,
    ca.org_unit_id,
    CONCAT('CIS v8 Assessment #', ca.id),
    ca.assessor_name,
    ca.assessment_date,
    CASE
        WHEN de.code = 'approved' THEN 'approved'
        ELSE 'draft'
    END,
    ca.notes,
    ca.risk_addressed_pct,
    ca.risk_addressed_pct,
    1,
    ca.created_at,
    ca.updated_at
FROM cis_assessments ca
LEFT JOIN dictionary_entries de ON de.id = ca.status_id
WHERE NOT EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.framework_id = @fw_id
      AND a.ref_id = CONCAT('ASM-', LPAD(ca.id, 4, '0'))
);

SELECT CONCAT('  [OK] KROK 17: assessments migrated → ',
    (SELECT COUNT(*) FROM assessments WHERE framework_id = @fw_id),
    ' assessments') AS status;


-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 18: Migracja cis_assessment_answers → assessment_answers
-- 4 INSERTy (po jednym na wymiar), każdy z NOT EXISTS guard
-- ─────────────────────────────────────────────────────────────────────────────

-- 18a: policy_defined
INSERT INTO assessment_answers
    (assessment_id, framework_node_id, dimension_id, level_id,
     not_applicable, created_at, updated_at)
SELECT
    a_new.id,
    fn.id,
    (SELECT id FROM assessment_dimensions WHERE framework_id = @fw_id AND dimension_key = 'policy_defined'),
    (SELECT dl.id FROM dimension_levels dl
     JOIN assessment_dimensions ad ON ad.id = dl.dimension_id
     WHERE ad.framework_id = @fw_id AND ad.dimension_key = 'policy_defined'
       AND dl.value = COALESCE(caa.policy_value, 0.00)
     LIMIT 1),
    caa.is_not_applicable,
    caa.created_at,
    caa.updated_at
FROM cis_assessment_answers caa
JOIN cis_sub_controls sc ON sc.id = caa.sub_control_id
JOIN framework_nodes fn
    ON fn.framework_id = @fw_id AND fn.ref_id = sc.sub_id AND fn.assessable = 1
JOIN cis_assessments ca_old ON ca_old.id = caa.assessment_id
JOIN assessments a_new
    ON a_new.framework_id = @fw_id AND a_new.ref_id = CONCAT('ASM-', LPAD(ca_old.id, 4, '0'))
WHERE NOT EXISTS (
    SELECT 1 FROM assessment_answers aa
    WHERE aa.assessment_id = a_new.id
      AND aa.framework_node_id = fn.id
      AND aa.dimension_id = (SELECT id FROM assessment_dimensions WHERE framework_id = @fw_id AND dimension_key = 'policy_defined')
);

-- 18b: control_implemented
INSERT INTO assessment_answers
    (assessment_id, framework_node_id, dimension_id, level_id,
     not_applicable, created_at, updated_at)
SELECT
    a_new.id,
    fn.id,
    (SELECT id FROM assessment_dimensions WHERE framework_id = @fw_id AND dimension_key = 'control_implemented'),
    (SELECT dl.id FROM dimension_levels dl
     JOIN assessment_dimensions ad ON ad.id = dl.dimension_id
     WHERE ad.framework_id = @fw_id AND ad.dimension_key = 'control_implemented'
       AND dl.value = COALESCE(caa.impl_value, 0.00)
     LIMIT 1),
    caa.is_not_applicable,
    caa.created_at,
    caa.updated_at
FROM cis_assessment_answers caa
JOIN cis_sub_controls sc ON sc.id = caa.sub_control_id
JOIN framework_nodes fn
    ON fn.framework_id = @fw_id AND fn.ref_id = sc.sub_id AND fn.assessable = 1
JOIN cis_assessments ca_old ON ca_old.id = caa.assessment_id
JOIN assessments a_new
    ON a_new.framework_id = @fw_id AND a_new.ref_id = CONCAT('ASM-', LPAD(ca_old.id, 4, '0'))
WHERE NOT EXISTS (
    SELECT 1 FROM assessment_answers aa
    WHERE aa.assessment_id = a_new.id
      AND aa.framework_node_id = fn.id
      AND aa.dimension_id = (SELECT id FROM assessment_dimensions WHERE framework_id = @fw_id AND dimension_key = 'control_implemented')
);

-- 18c: control_automated
INSERT INTO assessment_answers
    (assessment_id, framework_node_id, dimension_id, level_id,
     not_applicable, created_at, updated_at)
SELECT
    a_new.id,
    fn.id,
    (SELECT id FROM assessment_dimensions WHERE framework_id = @fw_id AND dimension_key = 'control_automated'),
    (SELECT dl.id FROM dimension_levels dl
     JOIN assessment_dimensions ad ON ad.id = dl.dimension_id
     WHERE ad.framework_id = @fw_id AND ad.dimension_key = 'control_automated'
       AND dl.value = COALESCE(caa.auto_value, 0.00)
     LIMIT 1),
    caa.is_not_applicable,
    caa.created_at,
    caa.updated_at
FROM cis_assessment_answers caa
JOIN cis_sub_controls sc ON sc.id = caa.sub_control_id
JOIN framework_nodes fn
    ON fn.framework_id = @fw_id AND fn.ref_id = sc.sub_id AND fn.assessable = 1
JOIN cis_assessments ca_old ON ca_old.id = caa.assessment_id
JOIN assessments a_new
    ON a_new.framework_id = @fw_id AND a_new.ref_id = CONCAT('ASM-', LPAD(ca_old.id, 4, '0'))
WHERE NOT EXISTS (
    SELECT 1 FROM assessment_answers aa
    WHERE aa.assessment_id = a_new.id
      AND aa.framework_node_id = fn.id
      AND aa.dimension_id = (SELECT id FROM assessment_dimensions WHERE framework_id = @fw_id AND dimension_key = 'control_automated')
);

-- 18d: control_reported
INSERT INTO assessment_answers
    (assessment_id, framework_node_id, dimension_id, level_id,
     not_applicable, created_at, updated_at)
SELECT
    a_new.id,
    fn.id,
    (SELECT id FROM assessment_dimensions WHERE framework_id = @fw_id AND dimension_key = 'control_reported'),
    (SELECT dl.id FROM dimension_levels dl
     JOIN assessment_dimensions ad ON ad.id = dl.dimension_id
     WHERE ad.framework_id = @fw_id AND ad.dimension_key = 'control_reported'
       AND dl.value = COALESCE(caa.report_value, 0.00)
     LIMIT 1),
    caa.is_not_applicable,
    caa.created_at,
    caa.updated_at
FROM cis_assessment_answers caa
JOIN cis_sub_controls sc ON sc.id = caa.sub_control_id
JOIN framework_nodes fn
    ON fn.framework_id = @fw_id AND fn.ref_id = sc.sub_id AND fn.assessable = 1
JOIN cis_assessments ca_old ON ca_old.id = caa.assessment_id
JOIN assessments a_new
    ON a_new.framework_id = @fw_id AND a_new.ref_id = CONCAT('ASM-', LPAD(ca_old.id, 4, '0'))
WHERE NOT EXISTS (
    SELECT 1 FROM assessment_answers aa
    WHERE aa.assessment_id = a_new.id
      AND aa.framework_node_id = fn.id
      AND aa.dimension_id = (SELECT id FROM assessment_dimensions WHERE framework_id = @fw_id AND dimension_key = 'control_reported')
);

SELECT CONCAT('  [OK] KROK 18: assessment_answers migrated → ',
    (SELECT COUNT(*) FROM assessment_answers aa
     JOIN assessments a ON a.id = aa.assessment_id
     WHERE a.framework_id = @fw_id),
    ' answers') AS status;


-- ═══════════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA KOŃCOWA
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════════════════' AS '';
SELECT '  FRAMEWORK ENGINE MIGRATION — SUMMARY' AS '';
SELECT '═══════════════════════════════════════════════════' AS '';

SELECT 'frameworks'               AS `table`, COUNT(*) AS `rows` FROM frameworks
UNION ALL
SELECT 'framework_nodes',                     COUNT(*)           FROM framework_nodes
UNION ALL
SELECT '  └─ depth=1 (controls)',             COUNT(*)           FROM framework_nodes WHERE depth = 1
UNION ALL
SELECT '  └─ depth=2 (sub-controls)',         COUNT(*)           FROM framework_nodes WHERE depth = 2
UNION ALL
SELECT 'assessment_dimensions',               COUNT(*)           FROM assessment_dimensions
UNION ALL
SELECT 'dimension_levels',                    COUNT(*)           FROM dimension_levels
UNION ALL
SELECT 'framework_node_security_areas',       COUNT(*)           FROM framework_node_security_areas
UNION ALL
SELECT 'assessments (v2)',                    COUNT(*)           FROM assessments
UNION ALL
SELECT 'assessment_answers (v2)',             COUNT(*)           FROM assessment_answers
UNION ALL
SELECT 'security_domains (with code)',        COUNT(*)           FROM security_domains WHERE code IS NOT NULL AND code != '';

SELECT CONCAT('>>> Migration completed in ', TIMESTAMPDIFF(SECOND, @start_ts, NOW()), 's') AS info;
