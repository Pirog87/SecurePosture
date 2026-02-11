-- ═══════════════════════════════════════════════════════════════
-- SecurePosture — CISO Security Platform
-- Database Schema v1.1 for MariaDB 10.6+
-- Generated: 2026-02-09
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS secureposture
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE secureposture;

-- ═══════════════════════════════════════════════════════════════
-- MODULE 0: SYSTEM / USERS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    display_name    VARCHAR(200) NOT NULL,
    email           VARCHAR(200),
    password_hash   VARCHAR(255),          -- bcrypt hash
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default user for single-user mode
INSERT INTO users (username, display_name, email) VALUES ('admin', 'Administrator', 'ciso@company.com');

-- ═══════════════════════════════════════════════════════════════
-- MODULE 5: DICTIONARIES (Słowniki)
-- Generic dictionary system — each dictionary is a "type",
-- each entry belongs to a type.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE dictionary_types (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,     -- e.g. 'asset_category', 'risk_status'
    name            VARCHAR(200) NOT NULL,            -- e.g. 'Kategorie aktywów'
    description     TEXT,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE = cannot delete type
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE dictionary_entries (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    dict_type_id    INT NOT NULL,
    code            VARCHAR(50),                      -- optional machine-readable code
    label           VARCHAR(300) NOT NULL,             -- display label
    description     TEXT,                              -- longer description (e.g. impact level description)
    numeric_value   DECIMAL(10,4),                     -- e.g. 0.95, 0.70, 0.25, 0.10 for safeguard levels
    color           VARCHAR(20),                       -- hex color for UI rendering
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,     -- FALSE = archived
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (dict_type_id) REFERENCES dictionary_types(id),
    INDEX idx_dict_entries_type (dict_type_id),
    INDEX idx_dict_entries_active (dict_type_id, is_active)
) ENGINE=InnoDB;

-- ── Seed dictionary types ──
INSERT INTO dictionary_types (code, name, is_system) VALUES
    ('asset_category',       'Kategorie aktywów',               TRUE),
    ('sensitivity',          'Wrażliwość',                       TRUE),
    ('criticality',          'Krytyczność',                      TRUE),
    ('impact_level',         'Poziomy wpływu',                   TRUE),
    ('probability_level',    'Poziomy prawdopodobieństwa',       TRUE),
    ('safeguard_rating',     'Ocena zabezpieczeń',               TRUE),
    ('risk_status',          'Statusy ryzyka',                   TRUE),
    ('risk_strategy',        'Strategie postępowania z ryzykiem', TRUE),
    ('threat_category',      'Kategorie zagrożeń',               TRUE),
    ('safeguard_type',       'Typy zabezpieczeń',                TRUE),
    ('cis_policy_status',    'Status polityki (CIS)',             TRUE),
    ('cis_impl_status',      'Status wdrożenia (CIS)',           TRUE),
    ('cis_auto_status',      'Status automatyzacji (CIS)',       TRUE),
    ('cis_report_status',    'Status raportowania (CIS)',        TRUE),
    ('cis_assessment_status','Status oceny CIS',                 TRUE);

-- ── Seed dictionary entries ──

-- Asset categories
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='asset_category'), 'hardware',     'Sprzęt IT',                1),
    ((SELECT id FROM dictionary_types WHERE code='asset_category'), 'software',     'Oprogramowanie',           2),
    ((SELECT id FROM dictionary_types WHERE code='asset_category'), 'data',         'Dane',                     3),
    ((SELECT id FROM dictionary_types WHERE code='asset_category'), 'people',       'Ludzie',                   4),
    ((SELECT id FROM dictionary_types WHERE code='asset_category'), 'processes',    'Procesy',                  5),
    ((SELECT id FROM dictionary_types WHERE code='asset_category'), 'physical',     'Infrastruktura fizyczna',  6);

-- Sensitivity
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='sensitivity'), 'normal',       'Zwykłe',    1),
    ((SELECT id FROM dictionary_types WHERE code='sensitivity'), 'confidential', 'Poufne',    2);

-- Criticality
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='criticality'), 'low',    'Niska',   1),
    ((SELECT id FROM dictionary_types WHERE code='criticality'), 'medium', 'Średnia',  2),
    ((SELECT id FROM dictionary_types WHERE code='criticality'), 'high',   'Wysoka',  3);

-- Impact levels
INSERT INTO dictionary_entries (dict_type_id, code, label, numeric_value, color, description, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='impact_level'), 'low',    '1 — Niski',   1, '#22c55e',
     'Wystąpienie zagrożenia nie powoduje utraty poufności, dostępności i integralności informacji, nie ma wpływu na realizację procesów krytycznych. W przypadku danych osobowych — brak lub niewielki negatywny wpływ na osobę.', 1),
    ((SELECT id FROM dictionary_types WHERE code='impact_level'), 'medium', '2 — Średni',  2, '#eab308',
     'Wystąpienie zagrożenia utrudnia realizację przynajmniej jednego procesu krytycznego (ale nie powoduje jego przerwania), może spowodować straty finansowe (>1 mln) lub utratę poufności, integralności informacji. W przypadku danych osobowych — negatywny wpływ na osobę.', 2),
    ((SELECT id FROM dictionary_types WHERE code='impact_level'), 'high',   '3 — Wysoki',  3, '#ef4444',
     'Wystąpienie zagrożenia przerywa realizację przynajmniej jednego procesu krytycznego lub powoduje utratę poufności, integralności informacji, straty finansowe (>10 mln) bądź znaczącą utratę reputacji. W przypadku danych osobowych — znaczący negatywny wpływ.', 3);

-- Probability levels
INSERT INTO dictionary_entries (dict_type_id, code, label, numeric_value, color, description, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='probability_level'), 'low',    '1 — Niskie',   1, '#22c55e',
     'Zagrożenie nie zmaterializowało się w okresie ostatniego roku. Źródło zagrożenia nie jest zmotywowane lub nie posiada zdolności do wykorzystania zagrożenia.', 1),
    ((SELECT id FROM dictionary_types WHERE code='probability_level'), 'medium', '2 — Średnie',  2, '#eab308',
     'Zagrożenie zmaterializowało się w przeciągu ostatniego roku. Źródło zagrożenia jest zmotywowane i posiada zdolności do wykorzystania zagrożenia.', 2),
    ((SELECT id FROM dictionary_types WHERE code='probability_level'), 'high',   '3 — Wysokie',  3, '#ef4444',
     'Zagrożenie zmaterializowało się w przeciągu ostatniego pół roku. Źródło zagrożenia jest wysoce zmotywowane i posiada zdolności do wykorzystania zagrożenia.', 3);

-- Safeguard rating
INSERT INTO dictionary_entries (dict_type_id, code, label, numeric_value, color, description, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='safeguard_rating'), 'effective',  '0,95 — Skuteczne',    0.9500, '#22c55e', 'Skuteczne, kompletne, regularnie testowane zabezpieczenia', 1),
    ((SELECT id FROM dictionary_types WHERE code='safeguard_rating'), 'good',       '0,70 — Dobra jakość', 0.7000, '#eab308', 'Zabezpieczenia o dobrej jakości, których skuteczność nie jest regularnie testowana', 2),
    ((SELECT id FROM dictionary_types WHERE code='safeguard_rating'), 'partial',    '0,25 — Częściowe',    0.2500, '#f97316', 'Częściowe zabezpieczenia, chroniące tylko wybrane obszary/zagrożenia lub nie w pełni skuteczne', 3),
    ((SELECT id FROM dictionary_types WHERE code='safeguard_rating'), 'none',       '0,10 — Brak',         0.1000, '#ef4444', 'Brak zabezpieczeń lub są one nieskuteczne', 4);

-- Risk statuses
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='risk_status'), 'identified',  'Zidentyfikowane', '#3b82f6', 1),
    ((SELECT id FROM dictionary_types WHERE code='risk_status'), 'analyzing',   'W analizie',      '#8b5cf6', 2),
    ((SELECT id FROM dictionary_types WHERE code='risk_status'), 'accepted',    'Zaakceptowane',   '#eab308', 3),
    ((SELECT id FROM dictionary_types WHERE code='risk_status'), 'mitigating',  'W mitygacji',     '#f97316', 4),
    ((SELECT id FROM dictionary_types WHERE code='risk_status'), 'closed',      'Zamknięte',       '#22c55e', 5);

-- Risk strategies
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='risk_strategy'), 'mitigate', 'Mitygacja',   1),
    ((SELECT id FROM dictionary_types WHERE code='risk_strategy'), 'accept',   'Akceptacja',  2),
    ((SELECT id FROM dictionary_types WHERE code='risk_strategy'), 'transfer', 'Transfer',    3),
    ((SELECT id FROM dictionary_types WHERE code='risk_strategy'), 'avoid',    'Unikanie',    4);

-- Threat categories
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='threat_category'), 'cyber',    'Cybernetyczne', 1),
    ((SELECT id FROM dictionary_types WHERE code='threat_category'), 'physical', 'Fizyczne',      2),
    ((SELECT id FROM dictionary_types WHERE code='threat_category'), 'human',    'Ludzkie',       3);

-- Safeguard types
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='safeguard_type'), 'preventive', 'Prewencyjne', 1),
    ((SELECT id FROM dictionary_types WHERE code='safeguard_type'), 'detective',  'Detekcyjne',  2),
    ((SELECT id FROM dictionary_types WHERE code='safeguard_type'), 'corrective', 'Korekcyjne',  3);

-- CIS Policy status
INSERT INTO dictionary_entries (dict_type_id, code, label, numeric_value, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='cis_policy_status'), 'no_policy',       'No Policy',                0.00, 1),
    ((SELECT id FROM dictionary_types WHERE code='cis_policy_status'), 'informal',        'Informal Policy',          0.25, 2),
    ((SELECT id FROM dictionary_types WHERE code='cis_policy_status'), 'partial_written',  'Partial Written Policy',   0.50, 3),
    ((SELECT id FROM dictionary_types WHERE code='cis_policy_status'), 'written',          'Written Policy',           0.75, 4),
    ((SELECT id FROM dictionary_types WHERE code='cis_policy_status'), 'approved_written', 'Approved Written Policy',  1.00, 5);

-- CIS Implementation status
INSERT INTO dictionary_entries (dict_type_id, code, label, numeric_value, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='cis_impl_status'), 'not_implemented',  'Not Implemented',               0.00, 1),
    ((SELECT id FROM dictionary_types WHERE code='cis_impl_status'), 'parts_impl',       'Parts of Policy Implemented',   0.25, 2),
    ((SELECT id FROM dictionary_types WHERE code='cis_impl_status'), 'some_systems',     'Implemented on Some Systems',   0.50, 3),
    ((SELECT id FROM dictionary_types WHERE code='cis_impl_status'), 'most_systems',     'Implemented on Most Systems',   0.75, 4),
    ((SELECT id FROM dictionary_types WHERE code='cis_impl_status'), 'all_systems',      'Implemented on All Systems',    1.00, 5);

-- CIS Automation status
INSERT INTO dictionary_entries (dict_type_id, code, label, numeric_value, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='cis_auto_status'), 'not_automated',    'Not Automated',                 0.00, 1),
    ((SELECT id FROM dictionary_types WHERE code='cis_auto_status'), 'parts_auto',       'Parts of Policy Automated',     0.25, 2),
    ((SELECT id FROM dictionary_types WHERE code='cis_auto_status'), 'some_auto',        'Automated on Some Systems',     0.50, 3),
    ((SELECT id FROM dictionary_types WHERE code='cis_auto_status'), 'most_auto',        'Automated on Most Systems',     0.75, 4),
    ((SELECT id FROM dictionary_types WHERE code='cis_auto_status'), 'all_auto',         'Automated on All Systems',      1.00, 5);

-- CIS Reporting status
INSERT INTO dictionary_entries (dict_type_id, code, label, numeric_value, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='cis_report_status'), 'not_reported',    'Not Reported',                  0.00, 1),
    ((SELECT id FROM dictionary_types WHERE code='cis_report_status'), 'parts_reported',  'Parts of Policy Reported',      0.25, 2),
    ((SELECT id FROM dictionary_types WHERE code='cis_report_status'), 'some_reported',   'Reported on Some Systems',      0.50, 3),
    ((SELECT id FROM dictionary_types WHERE code='cis_report_status'), 'most_reported',   'Reported on Most Systems',      0.75, 4),
    ((SELECT id FROM dictionary_types WHERE code='cis_report_status'), 'all_reported',    'Reported on All Systems',       1.00, 5);

-- CIS Assessment status
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='cis_assessment_status'), 'draft',     'Robocza',       1),
    ((SELECT id FROM dictionary_types WHERE code='cis_assessment_status'), 'approved',  'Zatwierdzona',  2);


-- ═══════════════════════════════════════════════════════════════
-- MODULE 4: ORGANIZATIONAL STRUCTURE
-- ═══════════════════════════════════════════════════════════════

-- Configurable hierarchy level definitions
CREATE TABLE org_levels (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    level_number    INT NOT NULL UNIQUE,              -- 1, 2, 3, 4...
    name            VARCHAR(100) NOT NULL,             -- e.g. 'Organizacja', 'Pion', 'Dział', 'Zespół'
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO org_levels (level_number, name) VALUES
    (1, 'Organizacja'),
    (2, 'Pion'),
    (3, 'Dział'),
    (4, 'Zespół');

-- Organizational units (hierarchical via parent_id)
CREATE TABLE org_units (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    parent_id       INT,                               -- NULL for root
    level_id        INT NOT NULL,                      -- references org_levels
    name            VARCHAR(300) NOT NULL,
    symbol          VARCHAR(30) NOT NULL,
    owner           VARCHAR(200),                      -- business owner
    security_contact VARCHAR(200),                     -- security champion
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deactivated_at  DATETIME,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (parent_id) REFERENCES org_units(id) ON DELETE SET NULL,
    FOREIGN KEY (level_id) REFERENCES org_levels(id),
    INDEX idx_org_units_parent (parent_id),
    INDEX idx_org_units_active (is_active)
) ENGINE=InnoDB;


-- ═══════════════════════════════════════════════════════════════
-- MODULE 6: SECURITY AREAS (Obszary Bezpieczeństwa)
-- Also serves as "Obszary raportowania" dictionary (single source)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE security_domains (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO security_domains (name, sort_order) VALUES
    ('Stacje robocze', 1),
    ('Urządzenia mobilne', 2),
    ('Ochrona przed utratą/wyciekiem danych (DLP)', 3),
    ('Urządzenia wielofunkcyjne', 4),
    ('Dokumentacja papierowa', 5),
    ('Budowanie świadomości bezpieczeństwa', 6),
    ('Ludzie', 7),
    ('Infrastruktura sieciowa', 8),
    ('Infrastruktura serwerowa', 9),
    ('Infrastruktura techniczna', 10),
    ('Usługi M365', 11),
    ('Kontrola dostępu', 12),
    ('Chmury publiczne', 13);


-- ═══════════════════════════════════════════════════════════════
-- MODULE 7: CATALOGS (Zagrożenia, Podatności, Zabezpieczenia)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE threats (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(400) NOT NULL,
    category_id     INT,                               -- → dictionary_entries (threat_category)
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES dictionary_entries(id)
) ENGINE=InnoDB;

CREATE TABLE vulnerabilities (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(400) NOT NULL,
    security_area_id INT,                              -- → security_domains
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (security_area_id) REFERENCES security_domains(id)
) ENGINE=InnoDB;

CREATE TABLE safeguards (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(400) NOT NULL,
    type_id         INT,                               -- → dictionary_entries (safeguard_type)
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (type_id) REFERENCES dictionary_entries(id)
) ENGINE=InnoDB;


-- ═══════════════════════════════════════════════════════════════
-- MODULE 8: RISK ANALYSIS (Analiza Ryzyka)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE risks (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    org_unit_id     INT NOT NULL,                      -- → org_units
    asset_category_id INT,                             -- → dictionary_entries (asset_category)
    asset_name      VARCHAR(400) NOT NULL,
    sensitivity_id  INT,                               -- → dictionary_entries (sensitivity)
    criticality_id  INT,                               -- → dictionary_entries (criticality)
    security_area_id INT,                              -- → security_domains (reporting area)
    threat_id       INT,                               -- → threats
    vulnerability_id INT,                              -- → vulnerabilities

    -- Risk parameters
    impact_level    INT NOT NULL,                      -- 1, 2, 3 (W)
    probability_level INT NOT NULL,                    -- 1, 2, 3 (P)
    safeguard_rating DECIMAL(4,2) NOT NULL,            -- 0.10, 0.25, 0.70, 0.95 (Z)

    -- Computed risk score: R = EXP(W) * (P / Z)
    risk_score      DECIMAL(10,2) GENERATED ALWAYS AS (
        ROUND(EXP(impact_level) * (probability_level / safeguard_rating), 1)
    ) STORED,

    -- Risk classification derived from score
    risk_level      VARCHAR(20) GENERATED ALWAYS AS (
        CASE
            WHEN ROUND(EXP(impact_level) * (probability_level / safeguard_rating), 1) >= 221 THEN 'high'
            WHEN ROUND(EXP(impact_level) * (probability_level / safeguard_rating), 1) >= 31 THEN 'medium'
            ELSE 'low'
        END
    ) STORED,

    -- Lifecycle
    status_id       INT,                               -- → dictionary_entries (risk_status)
    strategy_id     INT,                               -- → dictionary_entries (risk_strategy)
    owner           VARCHAR(200),                      -- risk owner
    planned_actions TEXT,                               -- mitigation plan
    residual_risk   DECIMAL(10,2),                     -- manual or calculated

    -- Dates
    identified_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_review_at  DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    FOREIGN KEY (asset_category_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (sensitivity_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (criticality_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (security_area_id) REFERENCES security_domains(id),
    FOREIGN KEY (threat_id) REFERENCES threats(id),
    FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id),
    FOREIGN KEY (status_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (strategy_id) REFERENCES dictionary_entries(id),

    INDEX idx_risks_org (org_unit_id),
    INDEX idx_risks_area (security_area_id),
    INDEX idx_risks_level (risk_level),
    INDEX idx_risks_status (status_id),
    INDEX idx_risks_review (last_review_at)
) ENGINE=InnoDB;

-- Many-to-many: risk ↔ safeguards (tagging)
CREATE TABLE risk_safeguards (
    risk_id         INT NOT NULL,
    safeguard_id    INT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (risk_id, safeguard_id),
    FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE,
    FOREIGN KEY (safeguard_id) REFERENCES safeguards(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ═══════════════════════════════════════════════════════════════
-- MODULE 9: RISK REVIEWS (Przeglądy Ryzyka)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE risk_review_config (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    review_interval_days INT NOT NULL DEFAULT 90,      -- global default: 90 days
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO risk_review_config (review_interval_days) VALUES (90);

CREATE TABLE risk_reviews (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    risk_id         INT NOT NULL,
    reviewed_by     INT,                               -- → users
    review_date     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    INDEX idx_risk_reviews_risk (risk_id),
    INDEX idx_risk_reviews_date (review_date)
) ENGINE=InnoDB;

-- View: overdue risks
CREATE OR REPLACE VIEW v_overdue_risks AS
SELECT
    r.*,
    rc.review_interval_days,
    DATEDIFF(NOW(), COALESCE(r.last_review_at, r.identified_at)) AS days_since_review,
    CASE
        WHEN DATEDIFF(NOW(), COALESCE(r.last_review_at, r.identified_at)) > rc.review_interval_days
        THEN TRUE ELSE FALSE
    END AS is_overdue
FROM risks r
CROSS JOIN risk_review_config rc
WHERE r.risk_level != 'closed';


-- ═══════════════════════════════════════════════════════════════
-- MODULE 10: CIS BENCHMARK (CIS Controls v8)
-- ═══════════════════════════════════════════════════════════════

-- Reference data: CIS Controls (18 controls)
CREATE TABLE cis_controls (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    control_number  INT NOT NULL UNIQUE,               -- 1-18
    name_en         VARCHAR(400) NOT NULL,
    name_pl         VARCHAR(400) NOT NULL,
    sub_control_count INT NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Reference data: CIS Sub-Controls (148 sub-controls)
CREATE TABLE cis_sub_controls (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    control_id      INT NOT NULL,                      -- → cis_controls
    sub_id          VARCHAR(10) NOT NULL,               -- e.g. '1.1', '3.14'
    detail_en       TEXT NOT NULL,
    detail_pl       TEXT,
    nist_csf        VARCHAR(20),                       -- Identify/Protect/Detect/Respond/Recover
    implementation_groups VARCHAR(20),                  -- e.g. '1,2,3'
    sensor_baseline VARCHAR(300),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (control_id) REFERENCES cis_controls(id),
    UNIQUE KEY uk_cis_sub (sub_id),
    INDEX idx_cis_sub_control (control_id)
) ENGINE=InnoDB;

-- ATT&CK mapping for sub-controls
CREATE TABLE cis_attack_mapping (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    sub_control_id  INT NOT NULL,
    attack_activity VARCHAR(100) NOT NULL,              -- e.g. 'Initial Access', 'Execution'
    capability_type ENUM('preventive','detective') NOT NULL,

    FOREIGN KEY (sub_control_id) REFERENCES cis_sub_controls(id) ON DELETE CASCADE,
    INDEX idx_attack_sub (sub_control_id),
    INDEX idx_attack_activity (attack_activity)
) ENGINE=InnoDB;

-- Assessment instances (snapshots)
CREATE TABLE cis_assessments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    org_unit_id     INT,                               -- NULL = 'Cała organizacja'
    assessor_id     INT,                               -- → users
    assessor_name   VARCHAR(200),                      -- fallback if not linked to user
    status_id       INT,                               -- → dictionary_entries (cis_assessment_status)
    notes           TEXT,
    assessment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Computed aggregates (cached, recalculated on save)
    maturity_rating DECIMAL(4,2),                      -- 0.00 – 5.00
    risk_addressed_pct DECIMAL(5,2),                   -- 0.00 – 100.00
    ig1_score       DECIMAL(5,2),
    ig2_score       DECIMAL(5,2),
    ig3_score       DECIMAL(5,2),

    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    FOREIGN KEY (assessor_id) REFERENCES users(id),
    FOREIGN KEY (status_id) REFERENCES dictionary_entries(id),
    INDEX idx_cis_assess_org (org_unit_id),
    INDEX idx_cis_assess_date (assessment_date)
) ENGINE=InnoDB;

-- Individual sub-control answers within an assessment
CREATE TABLE cis_assessment_answers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    assessment_id   INT NOT NULL,
    sub_control_id  INT NOT NULL,

    -- 4 dimensions: store dictionary_entry IDs or NULL for N/A
    policy_status_id     INT,                          -- → dictionary_entries (cis_policy_status) or NULL = N/A
    impl_status_id       INT,                          -- → dictionary_entries (cis_impl_status)
    auto_status_id       INT,                          -- → dictionary_entries (cis_auto_status)
    report_status_id     INT,                          -- → dictionary_entries (cis_report_status)

    is_not_applicable    BOOLEAN NOT NULL DEFAULT FALSE,  -- entire sub-control is N/A

    -- Numeric values (denormalized for fast scoring)
    policy_value    DECIMAL(4,2),                      -- 0.00 – 1.00 or NULL
    impl_value      DECIMAL(4,2),
    auto_value      DECIMAL(4,2),
    report_value    DECIMAL(4,2),

    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (assessment_id) REFERENCES cis_assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (sub_control_id) REFERENCES cis_sub_controls(id),
    FOREIGN KEY (policy_status_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (impl_status_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (auto_status_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (report_status_id) REFERENCES dictionary_entries(id),

    UNIQUE KEY uk_assess_sub (assessment_id, sub_control_id),
    INDEX idx_assess_answers_assess (assessment_id)
) ENGINE=InnoDB;

-- View: CIS control-level aggregation for an assessment
CREATE OR REPLACE VIEW v_cis_control_scores AS
SELECT
    a.assessment_id,
    c.id AS control_id,
    c.control_number,
    c.name_pl,
    COUNT(CASE WHEN a.is_not_applicable = FALSE THEN 1 END) AS applicable_subs,
    COUNT(CASE WHEN a.is_not_applicable = TRUE THEN 1 END) AS na_subs,
    ROUND(AVG(CASE WHEN a.is_not_applicable = FALSE THEN
        (COALESCE(a.policy_value,0) + COALESCE(a.impl_value,0) + COALESCE(a.auto_value,0) + COALESCE(a.report_value,0)) / 4
    END) * 100, 1) AS risk_addressed_pct,
    ROUND(AVG(CASE WHEN a.is_not_applicable = FALSE THEN a.policy_value END) * 100, 1) AS policy_pct,
    ROUND(AVG(CASE WHEN a.is_not_applicable = FALSE THEN a.impl_value END) * 100, 1) AS impl_pct,
    ROUND(AVG(CASE WHEN a.is_not_applicable = FALSE THEN a.auto_value END) * 100, 1) AS auto_pct,
    ROUND(AVG(CASE WHEN a.is_not_applicable = FALSE THEN a.report_value END) * 100, 1) AS report_pct
FROM cis_assessment_answers a
JOIN cis_sub_controls sc ON sc.id = a.sub_control_id
JOIN cis_controls c ON c.id = sc.control_id
GROUP BY a.assessment_id, c.id, c.control_number, c.name_pl;


-- ═══════════════════════════════════════════════════════════════
-- MODULE 12: AUDIT TRAIL (Logowanie zmian)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE audit_log (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT,                               -- → users (NULL if system-generated)
    module          VARCHAR(50) NOT NULL,               -- e.g. 'risks', 'cis_benchmark', 'org_structure'
    action          ENUM('create','update','delete','review','approve') NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,               -- e.g. 'risk', 'cis_assessment', 'org_unit'
    entity_id       INT NOT NULL,                      -- ID of the changed record
    field_name      VARCHAR(100),                      -- which field changed (NULL for create/delete)
    old_value       TEXT,                               -- previous value
    new_value       TEXT,                               -- new value
    ip_address      VARCHAR(45),                       -- IPv4 or IPv6
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_module (module),
    INDEX idx_audit_date (created_at),
    INDEX idx_audit_user (user_id)
) ENGINE=InnoDB;


-- ═══════════════════════════════════════════════════════════════
-- SEED: CIS Controls v8 reference data (18 controls)
-- Sub-controls will be imported from the AuditScripts Excel
-- ═══════════════════════════════════════════════════════════════

INSERT INTO cis_controls (control_number, name_en, name_pl, sub_control_count) VALUES
    (1,  'Inventory and Control of Enterprise Assets',              'Inwentaryzacja i kontrola zasobów przedsiębiorstwa',        5),
    (2,  'Inventory and Control of Software Assets',                'Inwentaryzacja i kontrola zasobów oprogramowania',          7),
    (3,  'Data Protection',                                         'Ochrona danych',                                           13),
    (4,  'Secure Configuration of Enterprise Assets and Software',  'Bezpieczna konfiguracja zasobów i oprogramowania',          11),
    (5,  'Account Management',                                      'Zarządzanie kontami',                                      6),
    (6,  'Access Control Management',                               'Zarządzanie kontrolą dostępu',                             8),
    (7,  'Continuous Vulnerability Management',                     'Ciągłe zarządzanie podatnościami',                         7),
    (8,  'Audit Log Management',                                    'Zarządzanie logami',                                       11),
    (9,  'Email and Web Browser Protections',                       'Ochrona poczty i przeglądarki',                            7),
    (10, 'Malware Defenses',                                        'Ochrona przed malware',                                    7),
    (11, 'Data Recovery',                                           'Odzyskiwanie danych',                                      5),
    (12, 'Network Infrastructure Management',                       'Zarządzanie infrastrukturą sieciową',                      8),
    (13, 'Network Monitoring and Defense',                          'Monitorowanie i obrona sieci',                             10),
    (14, 'Security Awareness and Skills Training',                  'Szkolenia świadomości bezpieczeństwa',                     9),
    (15, 'Service Provider Management',                             'Zarządzanie dostawcami usług',                             7),
    (16, 'Application Software Security',                           'Bezpieczeństwo oprogramowania',                            13),
    (17, 'Incident Response Management',                            'Zarządzanie reagowaniem na incydenty',                     9),
    (18, 'Penetration Testing',                                     'Testy penetracyjne',                                       5);


-- ═══════════════════════════════════════════════════════════════
-- UTILITY VIEWS
-- ═══════════════════════════════════════════════════════════════

-- Risk summary per org unit
CREATE OR REPLACE VIEW v_risk_summary_by_org AS
SELECT
    ou.id AS org_unit_id,
    ou.name AS org_unit_name,
    ou.symbol,
    COUNT(r.id) AS total_risks,
    SUM(CASE WHEN r.risk_level = 'high' THEN 1 ELSE 0 END) AS high_risks,
    SUM(CASE WHEN r.risk_level = 'medium' THEN 1 ELSE 0 END) AS medium_risks,
    SUM(CASE WHEN r.risk_level = 'low' THEN 1 ELSE 0 END) AS low_risks,
    ROUND(AVG(r.risk_score), 1) AS avg_risk_score
FROM org_units ou
LEFT JOIN risks r ON r.org_unit_id = ou.id
WHERE ou.is_active = TRUE
GROUP BY ou.id, ou.name, ou.symbol;

-- Risk summary per security area
CREATE OR REPLACE VIEW v_risk_summary_by_area AS
SELECT
    sa.id AS area_id,
    sa.name AS area_name,
    COUNT(r.id) AS total_risks,
    SUM(CASE WHEN r.risk_level = 'high' THEN 1 ELSE 0 END) AS high_risks,
    SUM(CASE WHEN r.risk_level = 'medium' THEN 1 ELSE 0 END) AS medium_risks,
    SUM(CASE WHEN r.risk_level = 'low' THEN 1 ELSE 0 END) AS low_risks,
    ROUND(AVG(r.risk_score), 1) AS avg_risk_score
FROM security_domains sa
LEFT JOIN risks r ON r.security_area_id = sa.id
WHERE sa.is_active = TRUE
GROUP BY sa.id, sa.name;

-- Latest CIS assessment per org unit
CREATE OR REPLACE VIEW v_latest_cis_assessment AS
SELECT ca.*
FROM cis_assessments ca
INNER JOIN (
    SELECT org_unit_id, MAX(assessment_date) AS max_date
    FROM cis_assessments
    GROUP BY org_unit_id
) latest ON ca.org_unit_id <=> latest.org_unit_id AND ca.assessment_date = latest.max_date;
