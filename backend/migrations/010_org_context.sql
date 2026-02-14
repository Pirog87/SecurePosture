-- ============================================================
-- Migration 010: Organizational Context (ISO 27001/22301 clause 4)
-- Extends org_units, creates context tables, seeds dictionaries
-- MariaDB 10.6+
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ═══════════════════════════════════════════════════════════════
-- 1. Extend org_units with context fields
-- ═══════════════════════════════════════════════════════════════

SET @db_name = DATABASE();

-- Helper: add column if not exists (MariaDB 10.2+ supports IF NOT EXISTS)
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS headcount             INT          NULL;
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS context_review_date   DATE         NULL;
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS context_next_review   DATE         NULL;
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS context_reviewer      VARCHAR(200) NULL;
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS context_status        VARCHAR(20)  NULL DEFAULT 'draft';
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS mission_vision        TEXT         NULL;
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS key_products_services TEXT         NULL;
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS strategic_objectives  TEXT         NULL;
ALTER TABLE org_units ADD COLUMN IF NOT EXISTS key_processes_notes   TEXT         NULL;


-- ═══════════════════════════════════════════════════════════════
-- 2. org_context_issues
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_context_issues (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    org_unit_id     INT NOT NULL,
    issue_type      VARCHAR(20) NOT NULL COMMENT 'internal / external',
    category_id     INT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    impact_level    VARCHAR(20) NULL COMMENT 'positive / negative / neutral',
    relevance       VARCHAR(20) NULL COMMENT 'high / medium / low',
    response_action TEXT,
    review_date     DATE NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ctx_issues_org FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    CONSTRAINT fk_ctx_issues_cat FOREIGN KEY (category_id) REFERENCES dictionary_entries(id),
    INDEX ix_ctx_issues_org (org_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════
-- 3. org_context_obligations
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_context_obligations (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    org_unit_id         INT NOT NULL,
    obligation_type     VARCHAR(30) NOT NULL COMMENT 'legal / regulatory / contractual / standard / internal',
    regulation_id       INT NULL,
    custom_name         VARCHAR(500) NULL,
    description         TEXT,
    responsible_person  VARCHAR(200) NULL,
    compliance_status   VARCHAR(30) NULL DEFAULT 'not_assessed',
    compliance_evidence TEXT,
    effective_from      DATE NULL,
    review_date         DATE NULL,
    notes               TEXT,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ctx_oblig_org FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    CONSTRAINT fk_ctx_oblig_reg FOREIGN KEY (regulation_id) REFERENCES dictionary_entries(id),
    INDEX ix_ctx_obligations_org (org_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════
-- 4. org_context_stakeholders
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_context_stakeholders (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    org_unit_id             INT NOT NULL,
    stakeholder_type        VARCHAR(20) NOT NULL COMMENT 'internal / external',
    category_id             INT NULL,
    name                    VARCHAR(500) NOT NULL,
    description             TEXT,
    needs_expectations      TEXT,
    requirements_type       VARCHAR(20) NULL COMMENT 'legal / contractual / voluntary',
    requirements_detail     TEXT,
    communication_channel   VARCHAR(200) NULL,
    influence_level         VARCHAR(20) NULL COMMENT 'high / medium / low',
    relevance               VARCHAR(20) NULL COMMENT 'high / medium / low',
    is_active               TINYINT(1) NOT NULL DEFAULT 1,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ctx_stakeh_org FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    CONSTRAINT fk_ctx_stakeh_cat FOREIGN KEY (category_id) REFERENCES dictionary_entries(id),
    INDEX ix_ctx_stakeholders_org (org_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════
-- 5. org_context_scope
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_context_scope (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    org_unit_id                 INT NOT NULL,
    management_system_id        INT NULL,
    scope_statement             TEXT,
    in_scope_description        TEXT,
    out_of_scope_description    TEXT,
    geographic_boundaries       TEXT,
    technology_boundaries       TEXT,
    organizational_boundaries   TEXT,
    interfaces_dependencies     TEXT,
    approved_by                 VARCHAR(200) NULL,
    approved_date               DATE NULL,
    version                     INT NOT NULL DEFAULT 1,
    is_active                   TINYINT(1) NOT NULL DEFAULT 1,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ctx_scope_org FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    CONSTRAINT fk_ctx_scope_ms  FOREIGN KEY (management_system_id) REFERENCES dictionary_entries(id),
    INDEX ix_ctx_scope_org (org_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════
-- 6. org_context_risk_appetite
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_context_risk_appetite (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    org_unit_id                 INT NOT NULL,
    risk_appetite_statement     TEXT,
    max_acceptable_risk_level   VARCHAR(20) NULL COMMENT 'low / medium / high',
    max_acceptable_risk_score   DECIMAL(5,2) NULL,
    exception_approval_authority VARCHAR(200) NULL,
    financial_risk_tolerance    TEXT,
    reputational_risk_tolerance TEXT,
    operational_risk_tolerance  TEXT,
    approved_by                 VARCHAR(200) NULL,
    approved_date               DATE NULL,
    is_active                   TINYINT(1) NOT NULL DEFAULT 1,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_risk_appetite_org (org_unit_id),
    CONSTRAINT fk_ctx_appetite_org FOREIGN KEY (org_unit_id) REFERENCES org_units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════
-- 7. org_context_reviews
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_context_reviews (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    org_unit_id         INT NOT NULL,
    review_date         DATE NOT NULL,
    reviewer            VARCHAR(200) NOT NULL,
    review_type         VARCHAR(20) NOT NULL COMMENT 'scheduled / triggered / initial',
    sections_reviewed   JSON NULL,
    changes_summary     TEXT,
    approved_by         VARCHAR(200) NULL,
    approved_date       DATE NULL,
    next_review_date    DATE NULL,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ctx_reviews_org FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    INDEX ix_ctx_reviews_org (org_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════
-- 8. org_context_snapshots
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_context_snapshots (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    org_unit_id     INT NOT NULL,
    review_id       INT NULL,
    snapshot_date   DATE NOT NULL,
    snapshot_data   JSON NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ctx_snap_org FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    CONSTRAINT fk_ctx_snap_rev FOREIGN KEY (review_id) REFERENCES org_context_reviews(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════
-- 9. Seed dictionaries for organizational context
-- ═══════════════════════════════════════════════════════════════

-- ── context_issue_category ──
INSERT IGNORE INTO dictionary_types (code, name, description, is_system) VALUES
    ('context_issue_category', 'Kategoria czynników kontekstu',
     'Kategorie czynników wewnętrznych i zewnętrznych (ISO 27001 kl. 4.1)', 0);

SET @dt_id = (SELECT id FROM dictionary_types WHERE code = 'context_issue_category');

INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, sort_order, is_active) VALUES
    (@dt_id, 'CULTURE',           'Kultura organizacyjna',                      0,  1),
    (@dt_id, 'GOVERNANCE',        'Struktura zarządzania i governance',          10, 1),
    (@dt_id, 'HR_COMPETENCE',     'Zasoby ludzkie i kompetencje',               20, 1),
    (@dt_id, 'IT_INFRA',          'Infrastruktura IT i technologia',             30, 1),
    (@dt_id, 'BUSINESS_PROCESS',  'Procesy biznesowe',                           40, 1),
    (@dt_id, 'SECURITY_MATURITY', 'Dojrzałość bezpieczeństwa',                  50, 1),
    (@dt_id, 'BUDGET',            'Budżet i finanse',                           60, 1),
    (@dt_id, 'CHANGE_MGMT',       'Zarządzanie zmianą',                         70, 1),
    (@dt_id, 'LEGAL_REGULATORY',  'Otoczenie prawne i regulacyjne',              80, 1),
    (@dt_id, 'MARKET',            'Otoczenie rynkowe i konkurencja',             90, 1),
    (@dt_id, 'TECHNOLOGY',        'Otoczenie technologiczne',                    100, 1),
    (@dt_id, 'GEOPOLITICAL',      'Otoczenie polityczne i geopolityczne',        110, 1),
    (@dt_id, 'ECONOMIC',          'Warunki ekonomiczne',                         120, 1),
    (@dt_id, 'SUPPLY_CHAIN',      'Łańcuch dostaw',                             130, 1),
    (@dt_id, 'CUSTOMER_EXPECT',   'Oczekiwania klientów',                       140, 1),
    (@dt_id, 'MEDIA_REPUTATION',  'Media i reputacja',                           150, 1);


-- ── regulation ──
INSERT IGNORE INTO dictionary_types (code, name, description, is_system) VALUES
    ('regulation', 'Regulacje i standardy',
     'Akty prawne, regulacje i standardy obowiązujące organizację', 0);

SET @dt_id = (SELECT id FROM dictionary_types WHERE code = 'regulation');

INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, sort_order, is_active) VALUES
    (@dt_id, 'RODO',         'RODO / GDPR',                 0,  1),
    (@dt_id, 'NIS2',         'Dyrektywa NIS2',              10, 1),
    (@dt_id, 'DORA',         'Rozporządzenie DORA',         20, 1),
    (@dt_id, 'KSC',          'Krajowy System Cyberbezpieczeństwa', 30, 1),
    (@dt_id, 'PCI_DSS',      'PCI DSS 4.0',                40, 1),
    (@dt_id, 'ISO27001',     'ISO/IEC 27001:2022',          50, 1),
    (@dt_id, 'ISO22301',     'ISO 22301:2019',              60, 1),
    (@dt_id, 'ISO9001',      'ISO 9001:2015',               70, 1),
    (@dt_id, 'ISO14001',     'ISO 14001:2015',              80, 1),
    (@dt_id, 'ISO20000',     'ISO/IEC 20000-1:2018',        90, 1),
    (@dt_id, 'SOC2',         'SOC 2 Type II',               100, 1),
    (@dt_id, 'KODEKS_PRACY', 'Kodeks Pracy',                110, 1);


-- ── stakeholder_category ──
INSERT IGNORE INTO dictionary_types (code, name, description, is_system) VALUES
    ('stakeholder_category', 'Kategoria interesariuszy',
     'Kategorie stron zainteresowanych (ISO 27001 kl. 4.2)', 0);

SET @dt_id = (SELECT id FROM dictionary_types WHERE code = 'stakeholder_category');

INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, sort_order, is_active) VALUES
    (@dt_id, 'BOARD',          'Zarząd / Rada Nadzorcza',                      0,  1),
    (@dt_id, 'EMPLOYEES',      'Pracownicy',                                   10, 1),
    (@dt_id, 'UNIONS',         'Związki zawodowe',                             20, 1),
    (@dt_id, 'INTERNAL_AUDIT', 'Audyt wewnętrzny',                             30, 1),
    (@dt_id, 'LEGAL_DEPT',     'Dział prawny',                                 40, 1),
    (@dt_id, 'IT_SECURITY',    'Dział IT / Security',                          50, 1),
    (@dt_id, 'CUSTOMERS',      'Klienci',                                      60, 1),
    (@dt_id, 'SUPPLIERS',      'Dostawcy i partnerzy biznesowi',                70, 1),
    (@dt_id, 'REGULATORS',     'Organy regulacyjne (UODO, KNF, CSIRT, ABW)',   80, 1),
    (@dt_id, 'EXT_AUDITORS',   'Audytorzy zewnętrzni / certyfikujący',         90, 1),
    (@dt_id, 'SHAREHOLDERS',   'Akcjonariusze / Inwestorzy',                   100, 1),
    (@dt_id, 'INSURERS',       'Ubezpieczyciele',                              110, 1),
    (@dt_id, 'MEDIA',          'Media',                                        120, 1),
    (@dt_id, 'LOCAL_COMMUNITY','Społeczność lokalna',                          130, 1),
    (@dt_id, 'LAW_ENFORCEMENT','Organy ścigania',                              140, 1);


-- ── management_system ──
INSERT IGNORE INTO dictionary_types (code, name, description, is_system) VALUES
    ('management_system', 'System zarządzania',
     'Systemy zarządzania ISO (zakres ISMS/BCMS/QMS)', 0);

SET @dt_id = (SELECT id FROM dictionary_types WHERE code = 'management_system');

INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, sort_order, is_active) VALUES
    (@dt_id, 'ISMS',     'System Zarządzania Bezpieczeństwem Informacji (ISO 27001)', 0,  1),
    (@dt_id, 'BCMS',     'System Zarządzania Ciągłością Działania (ISO 22301)',       10, 1),
    (@dt_id, 'QMS',      'System Zarządzania Jakością (ISO 9001)',                    20, 1),
    (@dt_id, 'EMS',      'System Zarządzania Środowiskowego (ISO 14001)',             30, 1),
    (@dt_id, 'ITSMS',    'System Zarządzania Usługami IT (ISO 20000)',                40, 1),
    (@dt_id, 'PIMS',     'System Zarządzania Prywatnością (ISO 27701)',               50, 1),
    (@dt_id, 'COMBINED', 'Zintegrowany System Zarządzania',                           60, 1);


-- ── compliance_status ──
INSERT IGNORE INTO dictionary_types (code, name, description, is_system) VALUES
    ('compliance_status', 'Status zgodności',
     'Status zgodności z regulacją / standardem', 0);

SET @dt_id = (SELECT id FROM dictionary_types WHERE code = 'compliance_status');

INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, sort_order, is_active) VALUES
    (@dt_id, 'COMPLIANT',     'Zgodny',             0,  1),
    (@dt_id, 'PARTIALLY',     'Częściowo zgodny',   10, 1),
    (@dt_id, 'NON_COMPLIANT', 'Niezgodny',          20, 1),
    (@dt_id, 'NOT_ASSESSED',  'Nieoceniany',        30, 1);


-- ── obligation_type ──
INSERT IGNORE INTO dictionary_types (code, name, description, is_system) VALUES
    ('obligation_type', 'Typ zobowiązania',
     'Typ zobowiązania prawnego / regulacyjnego', 0);

SET @dt_id = (SELECT id FROM dictionary_types WHERE code = 'obligation_type');

INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, sort_order, is_active) VALUES
    (@dt_id, 'LEGAL',       'Ustawa / akt prawny',       0,  1),
    (@dt_id, 'REGULATORY',  'Wymaganie regulatora',      10, 1),
    (@dt_id, 'CONTRACTUAL', 'Zobowiązanie umowne',       20, 1),
    (@dt_id, 'STANDARD',    'Norma dobrowolna',          30, 1),
    (@dt_id, 'INTERNAL',    'Polityka wewnętrzna',       40, 1);


SET FOREIGN_KEY_CHECKS = 1;
