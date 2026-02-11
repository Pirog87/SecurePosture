-- ═══════════════════════════════════════════════════════════════════════
-- Migration 002: Framework Engine
-- For existing SecurePosture DB on Synology (MariaDB)
--
-- Prerequisites: add_security_domains.sql already run
--   (security_domains table exists with icon, color, owner columns)
--   (domain_cis_controls table exists)
--
-- Run each section (KROK) separately in phpMyAdmin SQL tab.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── KROK 1: Add missing columns to security_domains ───────────────

ALTER TABLE security_domains
  ADD COLUMN code VARCHAR(50) DEFAULT NULL AFTER description,
  ADD COLUMN parent_id INT DEFAULT NULL AFTER owner,
  ADD COLUMN order_id INT NOT NULL DEFAULT 0 AFTER parent_id,
  ADD UNIQUE INDEX uq_sd_code (code),
  ADD CONSTRAINT fk_sd_parent FOREIGN KEY (parent_id) REFERENCES security_domains(id) ON DELETE SET NULL;


-- ─── KROK 2: Widen color column (if still VARCHAR(7)) ──────────────
-- (safe to run — if already VARCHAR(30), this is a no-op effectively)

ALTER TABLE security_domains MODIFY COLUMN color VARCHAR(30) DEFAULT NULL;


-- ─── KROK 3: Create frameworks table ───────────────────────────────

CREATE TABLE frameworks (
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


-- ─── KROK 4: Create framework_nodes table ──────────────────────────

CREATE TABLE framework_nodes (
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


-- ─── KROK 5: Create assessment_dimensions table ────────────────────

CREATE TABLE assessment_dimensions (
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


-- ─── KROK 6: Create dimension_levels table ─────────────────────────

CREATE TABLE dimension_levels (
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


-- ─── KROK 7: Create framework_node_security_areas (M2M) ───────────

CREATE TABLE framework_node_security_areas (
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


-- ─── KROK 8: Create assessments table ──────────────────────────────

CREATE TABLE assessments (
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


-- ─── KROK 9: Create assessment_answers table ───────────────────────

CREATE TABLE assessment_answers (
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


-- ─── KROK 10: Seed CIS v8 framework ───────────────────────────────

INSERT INTO frameworks (urn, ref_id, name, description, version, provider, packager,
                        source_format, locale,
                        implementation_groups_definition,
                        imported_at, imported_by, is_active)
VALUES (
    'urn:intuitem:risk:framework:cis-controls-v8',
    'cis-controls-v8',
    'CIS Controls v8',
    'CIS Critical Security Controls Version 8 — 18 controls, 153 sub-controls',
    '8.0', 'CIS', 'secureposture', 'manual', 'en',
    '{"IG1": "Basic Cyber Hygiene", "IG2": "Foundational", "IG3": "Organizational"}',
    NOW(), 'system-migration', 1
);

SET @fw_id = (SELECT id FROM frameworks WHERE urn = 'urn:intuitem:risk:framework:cis-controls-v8');


-- ─── KROK 11: Migrate cis_controls → framework_nodes (depth=1) ────

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
FROM cis_controls
ORDER BY control_number;


-- ─── KROK 12: Migrate cis_sub_controls → framework_nodes (depth=2) ─

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
ORDER BY sc.sub_id;


-- ─── KROK 13: Update framework node counts ────────────────────────

UPDATE frameworks SET
    total_nodes = (SELECT COUNT(*) FROM framework_nodes WHERE framework_id = @fw_id),
    total_assessable = (SELECT COUNT(*) FROM framework_nodes WHERE framework_id = @fw_id AND assessable = 1)
WHERE id = @fw_id;


-- ─── KROK 14: Create 4 CIS assessment dimensions ──────────────────

INSERT INTO assessment_dimensions (framework_id, dimension_key, name, name_pl, order_id, weight, is_active) VALUES
(@fw_id, 'policy_defined',      'Policy Defined',      'Polityka zdefiniowana',    1, 1.00, 1),
(@fw_id, 'control_implemented', 'Control Implemented',  'Kontrola wdrożona',       2, 1.00, 1),
(@fw_id, 'control_automated',   'Control Automated',    'Kontrola zautomatyzowana', 3, 1.00, 1),
(@fw_id, 'control_reported',    'Control Reported',     'Kontrola raportowana',     4, 1.00, 1);


-- ─── KROK 15: Create 5 levels per dimension ───────────────────────

INSERT INTO dimension_levels (dimension_id, level_order, value, label, label_pl, color)
SELECT ad.id, lv.level_order, lv.value, lv.label, lv.label_pl, lv.color
FROM assessment_dimensions ad
CROSS JOIN (
    SELECT 0 AS level_order, 0.00 AS value, 'Not done'                AS label, 'Brak'                            AS label_pl, '#EF4444' AS color
    UNION ALL SELECT 1, 0.25, 'Informal / Parts',                'Nieformalnie / Częściowo',          '#F97316'
    UNION ALL SELECT 2, 0.50, 'Partial / Some Systems',           'Częściowo / Część systemów',        '#EAB308'
    UNION ALL SELECT 3, 0.75, 'Written / Most Systems',           'Zapisane / Większość systemów',     '#22C55E'
    UNION ALL SELECT 4, 1.00, 'Approved / All Systems',           'Zatwierdzone / Wszystkie systemy',  '#16A34A'
) lv
WHERE ad.framework_id = @fw_id;


-- ─── KROK 16: Set security_domains codes for default areas ────────
-- (only updates if sort_order matches existing rows)

UPDATE security_domains SET code = 'WORKSTATIONS',       icon = COALESCE(icon, 'monitor'),    color = COALESCE(color, '#3B82F6'), order_id = 1  WHERE sort_order = 1;
UPDATE security_domains SET code = 'MOBILE_DEVICES',     icon = COALESCE(icon, 'smartphone'), color = COALESCE(color, '#8B5CF6'), order_id = 2  WHERE sort_order = 2;
UPDATE security_domains SET code = 'DATA_PROTECTION',    icon = COALESCE(icon, 'shield'),     color = COALESCE(color, '#EF4444'), order_id = 3  WHERE sort_order = 3;
UPDATE security_domains SET code = 'MFP_DEVICES',        icon = COALESCE(icon, 'printer'),    color = COALESCE(color, '#6B7280'), order_id = 4  WHERE sort_order = 4;
UPDATE security_domains SET code = 'PAPER_DOCS',         icon = COALESCE(icon, 'file-text'),  color = COALESCE(color, '#A3A3A3'), order_id = 5  WHERE sort_order = 5;
UPDATE security_domains SET code = 'SECURITY_AWARENESS', icon = COALESCE(icon, 'users'),      color = COALESCE(color, '#F59E0B'), order_id = 6  WHERE sort_order = 6;
UPDATE security_domains SET code = 'PEOPLE',             icon = COALESCE(icon, 'user'),       color = COALESCE(color, '#EC4899'), order_id = 7  WHERE sort_order = 7;
UPDATE security_domains SET code = 'NETWORK_INFRA',      icon = COALESCE(icon, 'wifi'),       color = COALESCE(color, '#10B981'), order_id = 8  WHERE sort_order = 8;
UPDATE security_domains SET code = 'SERVER_INFRA',       icon = COALESCE(icon, 'server'),     color = COALESCE(color, '#0EA5E9'), order_id = 9  WHERE sort_order = 9;
UPDATE security_domains SET code = 'TECH_INFRA',         icon = COALESCE(icon, 'cpu'),        color = COALESCE(color, '#6366F1'), order_id = 10 WHERE sort_order = 10;
UPDATE security_domains SET code = 'M365_CLOUD',         icon = COALESCE(icon, 'cloud'),      color = COALESCE(color, '#2563EB'), order_id = 11 WHERE sort_order = 11;
UPDATE security_domains SET code = 'ACCESS_CONTROL',     icon = COALESCE(icon, 'lock'),       color = COALESCE(color, '#DC2626'), order_id = 12 WHERE sort_order = 12;
UPDATE security_domains SET code = 'PUBLIC_CLOUD',       icon = COALESCE(icon, 'cloud'),      color = COALESCE(color, '#7C3AED'), order_id = 13 WHERE sort_order = 13;


-- ─── KROK 17: Migrate cis_assessments → assessments ───────────────
-- (skip this step if you have no data in cis_assessments)

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
LEFT JOIN dictionary_entries de ON de.id = ca.status_id;


-- ─── KROK 18: Migrate cis_assessment_answers → assessment_answers ──
-- (4 separate INSERTs — one per dimension)
-- (skip this step if you have no data in cis_assessment_answers)

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
    ON fn.framework_id = @fw_id
    AND fn.ref_id = sc.sub_id
    AND fn.assessable = 1
JOIN cis_assessments ca_old ON ca_old.id = caa.assessment_id
JOIN assessments a_new
    ON a_new.framework_id = @fw_id
    AND a_new.ref_id = CONCAT('ASM-', LPAD(ca_old.id, 4, '0'));

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
    ON fn.framework_id = @fw_id
    AND fn.ref_id = sc.sub_id
    AND fn.assessable = 1
JOIN cis_assessments ca_old ON ca_old.id = caa.assessment_id
JOIN assessments a_new
    ON a_new.framework_id = @fw_id
    AND a_new.ref_id = CONCAT('ASM-', LPAD(ca_old.id, 4, '0'));

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
    ON fn.framework_id = @fw_id
    AND fn.ref_id = sc.sub_id
    AND fn.assessable = 1
JOIN cis_assessments ca_old ON ca_old.id = caa.assessment_id
JOIN assessments a_new
    ON a_new.framework_id = @fw_id
    AND a_new.ref_id = CONCAT('ASM-', LPAD(ca_old.id, 4, '0'));

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
    ON fn.framework_id = @fw_id
    AND fn.ref_id = sc.sub_id
    AND fn.assessable = 1
JOIN cis_assessments ca_old ON ca_old.id = caa.assessment_id
JOIN assessments a_new
    ON a_new.framework_id = @fw_id
    AND a_new.ref_id = CONCAT('ASM-', LPAD(ca_old.id, 4, '0'));


-- ═══════════════════════════════════════════════════════════════════════
-- GOTOWE! Sprawdź: SELECT COUNT(*) FROM frameworks;
--                   SELECT COUNT(*) FROM framework_nodes;
--                   SELECT COUNT(*) FROM assessment_dimensions;
--                   SELECT COUNT(*) FROM dimension_levels;
-- ═══════════════════════════════════════════════════════════════════════
