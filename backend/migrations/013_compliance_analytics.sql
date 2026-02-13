-- ═══════════════════════════════════════════════════════════════════════
-- Migration 013: Compliance Analytics — All v2.0 Modules
-- For existing SecurePosture DB on Synology (MariaDB 10.6+)
--
-- Prerequisites: 002_framework_engine.sql already run
--                add_assets_table.sql already run
--                012_cmdb_categories.sql already run
--
-- Modules covered:
--   13 – Vulnerability Register
--   14 – Incident Register
--   15 – Policy Exceptions
--   16 – Audits & Findings
--   18 – Vendors (TPRM)
--   19 – Security Awareness
--   20 – Policies
--   21 – Security Score (config + snapshots)
--   + All new dictionaries + risks table extensions
--
-- Run each KROK section separately in phpMyAdmin SQL tab.
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- KROK 1: NEW DICTIONARY TYPES
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO dictionary_types (code, name, description, is_system) VALUES
    ('vuln_source',           'Źródło podatności',                   'Skąd pochodzi informacja o podatności',                  TRUE),
    ('vuln_category',         'Kategoria podatności',                'Klasyfikacja techniczna podatności',                     TRUE),
    ('severity_universal',    'Poziom krytyczności (uniwersalny)',    'Wspólna skala krytyczności dla podatności i incydentów', TRUE),
    ('remediation_priority',  'Priorytet remediacji',                'SLA remediacji podatności',                             TRUE),
    ('vuln_status',           'Status podatności',                   'Cykl życia podatności',                                 TRUE),
    ('incident_category',     'Kategoria incydentu',                 'Klasyfikacja typu incydentu bezpieczeństwa',            TRUE),
    ('incident_status',       'Status incydentu',                    'Cykl życia incydentu',                                  TRUE),
    ('incident_impact',       'Wpływ incydentu',                    'Skala wpływu incydentu na organizację',                 TRUE),
    ('exception_category',    'Kategoria wyjątku',                   'Klasyfikacja wyjątku od polityki',                      TRUE),
    ('exception_status',      'Status wyjątku',                      'Cykl życia wyjątku od polityki',                        TRUE),
    ('audit_type',            'Typ audytu',                          'Rodzaj audytu lub kontroli',                            TRUE),
    ('audit_status',          'Status audytu',                       'Cykl życia audytu',                                     TRUE),
    ('audit_rating',          'Ocena ogólna audytu',                 'Wynik końcowy audytu',                                  TRUE),
    ('finding_type',          'Typ findingu',                        'Klasyfikacja wyniku audytu',                            TRUE),
    ('finding_status',        'Status findingu',                     'Cykl życia findingu audytowego',                        TRUE),
    ('asset_status',          'Status aktywa',                       'Cykl życia aktywa w CMDB',                              TRUE),
    ('asset_environment',     'Środowisko aktywa',                   'Typ środowiska IT',                                    TRUE),
    ('data_sensitivity',      'Wrażliwość danych',                   'Klasyfikacja wrażliwości danych',                       TRUE),
    ('vendor_category',       'Kategoria dostawcy',                  'Typ dostawcy IT',                                       TRUE),
    ('vendor_status',         'Status dostawcy',                     'Cykl życia relacji z dostawcą',                         TRUE),
    ('vendor_data_access',    'Dostęp dostawcy do danych',           'Poziom dostępu dostawcy do danych organizacji',         TRUE),
    ('vendor_risk_rating',    'Rating ryzyka dostawcy',              'Klasyfikacja ryzyka dostawcy (A/B/C/D)',                TRUE),
    ('campaign_type',         'Typ kampanii awareness',              'Rodzaj kampanii świadomościowej',                       TRUE),
    ('campaign_status',       'Status kampanii',                     'Cykl życia kampanii awareness',                         TRUE),
    ('policy_category',       'Kategoria polityki',                  'Klasyfikacja polityki bezpieczeństwa',                  TRUE),
    ('policy_status',         'Status polityki',                     'Cykl życia polityki bezpieczeństwa',                    TRUE);


-- ─────────────────────────────────────────────────────────────────────
-- KROK 2: DICTIONARY ENTRIES — Vulnerability Register
-- ─────────────────────────────────────────────────────────────────────

-- vuln_source
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='vuln_source'), 'scanner',        'Skaner automatyczny',    1),
    ((SELECT id FROM dictionary_types WHERE code='vuln_source'), 'pentest',        'Pen-test',               2),
    ((SELECT id FROM dictionary_types WHERE code='vuln_source'), 'internal_audit', 'Audyt wewnętrzny',       3),
    ((SELECT id FROM dictionary_types WHERE code='vuln_source'), 'external_audit', 'Audyt zewnętrzny',       4),
    ((SELECT id FROM dictionary_types WHERE code='vuln_source'), 'manual',         'Zgłoszenie ręczne',      5);

-- vuln_category
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='vuln_category'), 'configuration', 'Konfiguracja',     1),
    ((SELECT id FROM dictionary_types WHERE code='vuln_category'), 'patching',      'Patching',         2),
    ((SELECT id FROM dictionary_types WHERE code='vuln_category'), 'code',          'Kod',              3),
    ((SELECT id FROM dictionary_types WHERE code='vuln_category'), 'network',       'Sieć',             4),
    ((SELECT id FROM dictionary_types WHERE code='vuln_category'), 'identity',      'Tożsamość',        5),
    ((SELECT id FROM dictionary_types WHERE code='vuln_category'), 'cryptography',  'Kryptografia',     6),
    ((SELECT id FROM dictionary_types WHERE code='vuln_category'), 'other',         'Inne',             7);

-- severity_universal
INSERT INTO dictionary_entries (dict_type_id, code, label, color, numeric_value, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='severity_universal'), 'critical',      'Krytyczny',      '#991B1B', 5, 1),
    ((SELECT id FROM dictionary_types WHERE code='severity_universal'), 'high',          'Wysoki',         '#DC2626', 4, 2),
    ((SELECT id FROM dictionary_types WHERE code='severity_universal'), 'medium',        'Średni',         '#F59E0B', 3, 3),
    ((SELECT id FROM dictionary_types WHERE code='severity_universal'), 'low',           'Niski',          '#22C55E', 2, 4),
    ((SELECT id FROM dictionary_types WHERE code='severity_universal'), 'informational', 'Informacyjny',   '#6B7280', 1, 5);

-- remediation_priority
INSERT INTO dictionary_entries (dict_type_id, code, label, description, numeric_value, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='remediation_priority'), 'p1', 'P1 (7 dni)',   'Remediacja w ciągu 7 dni',   7,   1),
    ((SELECT id FROM dictionary_types WHERE code='remediation_priority'), 'p2', 'P2 (30 dni)',  'Remediacja w ciągu 30 dni',  30,  2),
    ((SELECT id FROM dictionary_types WHERE code='remediation_priority'), 'p3', 'P3 (90 dni)',  'Remediacja w ciągu 90 dni',  90,  3),
    ((SELECT id FROM dictionary_types WHERE code='remediation_priority'), 'p4', 'P4 (180 dni)', 'Remediacja w ciągu 180 dni', 180, 4);

-- vuln_status
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='vuln_status'), 'new',        'Nowa',            '#3B82F6', 1),
    ((SELECT id FROM dictionary_types WHERE code='vuln_status'), 'analyzing',  'W analizie',      '#8B5CF6', 2),
    ((SELECT id FROM dictionary_types WHERE code='vuln_status'), 'remediating','W remediacji',     '#F59E0B', 3),
    ((SELECT id FROM dictionary_types WHERE code='vuln_status'), 'closed',     'Zamknięta',       '#22C55E', 4),
    ((SELECT id FROM dictionary_types WHERE code='vuln_status'), 'accepted',   'Zaakceptowana',   '#6B7280', 5);


-- ─────────────────────────────────────────────────────────────────────
-- KROK 3: DICTIONARY ENTRIES — Incident Register
-- ─────────────────────────────────────────────────────────────────────

-- incident_category
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'phishing',          'Phishing',               1),
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'malware',           'Malware',                2),
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'data_leak',         'Data Leak',              3),
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'unauthorized_access','Unauthorized Access',    4),
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'ddos',              'DDoS',                   5),
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'insider_threat',    'Insider Threat',         6),
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'social_engineering','Social Engineering',      7),
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'physical',          'Physical',               8),
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'config_error',      'Configuration Error',    9),
    ((SELECT id FROM dictionary_types WHERE code='incident_category'), 'other',             'Inne',                   10);

-- incident_status
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='incident_status'), 'reported',   'Zgłoszony',    '#3B82F6', 1),
    ((SELECT id FROM dictionary_types WHERE code='incident_status'), 'analyzing',  'W analizie',   '#8B5CF6', 2),
    ((SELECT id FROM dictionary_types WHERE code='incident_status'), 'handling',   'W obsłudze',   '#F59E0B', 3),
    ((SELECT id FROM dictionary_types WHERE code='incident_status'), 'closed',     'Zamknięty',    '#22C55E', 4);

-- incident_impact
INSERT INTO dictionary_entries (dict_type_id, code, label, color, numeric_value, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='incident_impact'), 'none',         'Brak wpływu',   '#6B7280', 0, 1),
    ((SELECT id FROM dictionary_types WHERE code='incident_impact'), 'minimal',      'Minimalny',     '#22C55E', 1, 2),
    ((SELECT id FROM dictionary_types WHERE code='incident_impact'), 'limited',      'Ograniczony',   '#EAB308', 2, 3),
    ((SELECT id FROM dictionary_types WHERE code='incident_impact'), 'significant',  'Znaczący',      '#F97316', 3, 4),
    ((SELECT id FROM dictionary_types WHERE code='incident_impact'), 'critical',     'Krytyczny',     '#EF4444', 4, 5);


-- ─────────────────────────────────────────────────────────────────────
-- KROK 4: DICTIONARY ENTRIES — Policy Exceptions
-- ─────────────────────────────────────────────────────────────────────

-- exception_category
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='exception_category'), 'configuration', 'Konfiguracja',   1),
    ((SELECT id FROM dictionary_types WHERE code='exception_category'), 'access',        'Dostęp',         2),
    ((SELECT id FROM dictionary_types WHERE code='exception_category'), 'network',       'Sieć',           3),
    ((SELECT id FROM dictionary_types WHERE code='exception_category'), 'data',          'Dane',           4),
    ((SELECT id FROM dictionary_types WHERE code='exception_category'), 'cryptography',  'Kryptografia',   5),
    ((SELECT id FROM dictionary_types WHERE code='exception_category'), 'physical',      'Fizyczne',       6),
    ((SELECT id FROM dictionary_types WHERE code='exception_category'), 'other',         'Inne',           7);

-- exception_status
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='exception_status'), 'requested', 'Wnioskowany',  '#3B82F6', 1),
    ((SELECT id FROM dictionary_types WHERE code='exception_status'), 'approved',  'Zatwierdzony', '#22C55E', 2),
    ((SELECT id FROM dictionary_types WHERE code='exception_status'), 'active',    'Aktywny',      '#10B981', 3),
    ((SELECT id FROM dictionary_types WHERE code='exception_status'), 'expired',   'Wygasły',      '#EF4444', 4),
    ((SELECT id FROM dictionary_types WHERE code='exception_status'), 'renewed',   'Odnowiony',    '#8B5CF6', 5),
    ((SELECT id FROM dictionary_types WHERE code='exception_status'), 'closed',    'Zamknięty',    '#6B7280', 6),
    ((SELECT id FROM dictionary_types WHERE code='exception_status'), 'rejected',  'Odrzucony',    '#991B1B', 7);


-- ─────────────────────────────────────────────────────────────────────
-- KROK 5: DICTIONARY ENTRIES — Audits & Findings
-- ─────────────────────────────────────────────────────────────────────

-- audit_type
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='audit_type'), 'internal',       'Wewnętrzny',       1),
    ((SELECT id FROM dictionary_types WHERE code='audit_type'), 'external',       'Zewnętrzny',       2),
    ((SELECT id FROM dictionary_types WHERE code='audit_type'), 'regulatory',     'Regulacyjny',      3),
    ((SELECT id FROM dictionary_types WHERE code='audit_type'), 'certification',  'Certyfikacyjny',   4),
    ((SELECT id FROM dictionary_types WHERE code='audit_type'), 'pentest',        'Pen-test',         5);

-- audit_status
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='audit_status'), 'planned',      'Zaplanowany',      '#6B7280', 1),
    ((SELECT id FROM dictionary_types WHERE code='audit_status'), 'in_progress',  'W trakcie',        '#3B82F6', 2),
    ((SELECT id FROM dictionary_types WHERE code='audit_status'), 'completed',    'Zakończony',       '#22C55E', 3),
    ((SELECT id FROM dictionary_types WHERE code='audit_status'), 'cancelled',    'Anulowany',        '#EF4444', 4);

-- audit_rating
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='audit_rating'), 'positive',             'Pozytywna',              '#22C55E', 1),
    ((SELECT id FROM dictionary_types WHERE code='audit_rating'), 'conditionally_positive','Warunkowo pozytywna',    '#EAB308', 2),
    ((SELECT id FROM dictionary_types WHERE code='audit_rating'), 'negative',             'Negatywna',              '#EF4444', 3),
    ((SELECT id FROM dictionary_types WHERE code='audit_rating'), 'na',                   'N/A',                    '#6B7280', 4);

-- finding_type
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='finding_type'), 'major_nc',       'Niezgodność główna',   '#EF4444', 1),
    ((SELECT id FROM dictionary_types WHERE code='finding_type'), 'minor_nc',       'Niezgodność drobna',   '#F97316', 2),
    ((SELECT id FROM dictionary_types WHERE code='finding_type'), 'observation',    'Obserwacja',           '#EAB308', 3),
    ((SELECT id FROM dictionary_types WHERE code='finding_type'), 'recommendation', 'Rekomendacja',         '#3B82F6', 4),
    ((SELECT id FROM dictionary_types WHERE code='finding_type'), 'strength',       'Mocna strona',         '#22C55E', 5);

-- finding_status
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='finding_status'), 'new',           'Nowy',              '#3B82F6', 1),
    ((SELECT id FROM dictionary_types WHERE code='finding_status'), 'remediating',   'W remediacji',      '#F59E0B', 2),
    ((SELECT id FROM dictionary_types WHERE code='finding_status'), 'verification',  'Do weryfikacji',    '#8B5CF6', 3),
    ((SELECT id FROM dictionary_types WHERE code='finding_status'), 'closed',        'Zamknięty',         '#22C55E', 4),
    ((SELECT id FROM dictionary_types WHERE code='finding_status'), 'accepted',      'Zaakceptowany',     '#6B7280', 5);


-- ─────────────────────────────────────────────────────────────────────
-- KROK 6: DICTIONARY ENTRIES — Assets (CMDB extensions)
-- ─────────────────────────────────────────────────────────────────────

-- asset_status
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='asset_status'), 'active',       'Aktywny',       '#22C55E', 1),
    ((SELECT id FROM dictionary_types WHERE code='asset_status'), 'building',     'W budowie',     '#3B82F6', 2),
    ((SELECT id FROM dictionary_types WHERE code='asset_status'), 'decommissioning','Wycofywany',  '#F59E0B', 3),
    ((SELECT id FROM dictionary_types WHERE code='asset_status'), 'decommissioned','Wycofany',     '#6B7280', 4);

-- asset_environment
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='asset_environment'), 'production',  'Produkcja',    1),
    ((SELECT id FROM dictionary_types WHERE code='asset_environment'), 'staging',     'Staging',      2),
    ((SELECT id FROM dictionary_types WHERE code='asset_environment'), 'development', 'Development',  3),
    ((SELECT id FROM dictionary_types WHERE code='asset_environment'), 'test',        'Test',         4);

-- data_sensitivity
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='data_sensitivity'), 'public',       'Publiczne',      '#22C55E', 1),
    ((SELECT id FROM dictionary_types WHERE code='data_sensitivity'), 'internal',     'Wewnętrzne',     '#3B82F6', 2),
    ((SELECT id FROM dictionary_types WHERE code='data_sensitivity'), 'confidential', 'Poufne',         '#F59E0B', 3),
    ((SELECT id FROM dictionary_types WHERE code='data_sensitivity'), 'top_secret',   'Ściśle tajne',   '#EF4444', 4);


-- ─────────────────────────────────────────────────────────────────────
-- KROK 7: DICTIONARY ENTRIES — Vendors (TPRM)
-- ─────────────────────────────────────────────────────────────────────

-- vendor_category
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='vendor_category'), 'cloud_provider', 'Cloud Provider',    1),
    ((SELECT id FROM dictionary_types WHERE code='vendor_category'), 'saas',           'SaaS',              2),
    ((SELECT id FROM dictionary_types WHERE code='vendor_category'), 'outsourcing',    'Outsourcing IT',    3),
    ((SELECT id FROM dictionary_types WHERE code='vendor_category'), 'consulting',     'Consulting',        4),
    ((SELECT id FROM dictionary_types WHERE code='vendor_category'), 'hardware',       'Hardware',          5),
    ((SELECT id FROM dictionary_types WHERE code='vendor_category'), 'telco',          'Telco',             6),
    ((SELECT id FROM dictionary_types WHERE code='vendor_category'), 'other',          'Inne',              7);

-- vendor_status
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='vendor_status'), 'active',     'Aktywny',      '#22C55E', 1),
    ((SELECT id FROM dictionary_types WHERE code='vendor_status'), 'assessing',  'W ocenie',     '#3B82F6', 2),
    ((SELECT id FROM dictionary_types WHERE code='vendor_status'), 'suspended',  'Zawieszony',   '#F59E0B', 3),
    ((SELECT id FROM dictionary_types WHERE code='vendor_status'), 'terminated', 'Zakończony',   '#6B7280', 4);

-- vendor_data_access
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='vendor_data_access'), 'none',         'Brak dostępu',      '#22C55E', 1),
    ((SELECT id FROM dictionary_types WHERE code='vendor_data_access'), 'internal',     'Dane wewnętrzne',   '#3B82F6', 2),
    ((SELECT id FROM dictionary_types WHERE code='vendor_data_access'), 'confidential', 'Dane poufne',       '#F59E0B', 3),
    ((SELECT id FROM dictionary_types WHERE code='vendor_data_access'), 'personal',     'Dane osobowe',      '#EF4444', 4);

-- vendor_risk_rating
INSERT INTO dictionary_entries (dict_type_id, code, label, color, description, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='vendor_risk_rating'), 'a', 'A (niskie ryzyko)',      '#22C55E', 'Dostawca spełnia wszystkie wymagania bezpieczeństwa',                1),
    ((SELECT id FROM dictionary_types WHERE code='vendor_risk_rating'), 'b', 'B (umiarkowane ryzyko)', '#EAB308', 'Dostawca spełnia większość wymagań, drobne braki',                  2),
    ((SELECT id FROM dictionary_types WHERE code='vendor_risk_rating'), 'c', 'C (podwyższone ryzyko)', '#F97316', 'Dostawca ma istotne braki w zabezpieczeniach',                      3),
    ((SELECT id FROM dictionary_types WHERE code='vendor_risk_rating'), 'd', 'D (wysokie ryzyko)',     '#EF4444', 'Dostawca nie spełnia kluczowych wymagań bezpieczeństwa',             4);


-- ─────────────────────────────────────────────────────────────────────
-- KROK 8: DICTIONARY ENTRIES — Awareness & Policies
-- ─────────────────────────────────────────────────────────────────────

-- campaign_type
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='campaign_type'), 'training_online',    'Szkolenie online',        1),
    ((SELECT id FROM dictionary_types WHERE code='campaign_type'), 'training_onsite',    'Szkolenie stacjonarne',   2),
    ((SELECT id FROM dictionary_types WHERE code='campaign_type'), 'phishing_simulation','Phishing simulation',     3),
    ((SELECT id FROM dictionary_types WHERE code='campaign_type'), 'knowledge_test',     'Test wiedzy',             4);

-- campaign_status
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='campaign_status'), 'planned',     'Planowana',     '#6B7280', 1),
    ((SELECT id FROM dictionary_types WHERE code='campaign_status'), 'in_progress', 'W trakcie',     '#3B82F6', 2),
    ((SELECT id FROM dictionary_types WHERE code='campaign_status'), 'completed',   'Zakończona',    '#22C55E', 3);

-- policy_category
INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='policy_category'), 'it_security',   'Bezpieczeństwo IT',       1),
    ((SELECT id FROM dictionary_types WHERE code='policy_category'), 'data_protection','Ochrona danych',         2),
    ((SELECT id FROM dictionary_types WHERE code='policy_category'), 'access',        'Dostęp',                  3),
    ((SELECT id FROM dictionary_types WHERE code='policy_category'), 'network',       'Sieć',                    4),
    ((SELECT id FROM dictionary_types WHERE code='policy_category'), 'physical',      'Fizyczne',                5),
    ((SELECT id FROM dictionary_types WHERE code='policy_category'), 'bcp',           'Ciągłość działania',      6),
    ((SELECT id FROM dictionary_types WHERE code='policy_category'), 'hr',            'HR',                      7),
    ((SELECT id FROM dictionary_types WHERE code='policy_category'), 'other',         'Inne',                    8);

-- policy_status
INSERT INTO dictionary_entries (dict_type_id, code, label, color, sort_order) VALUES
    ((SELECT id FROM dictionary_types WHERE code='policy_status'), 'draft',     'Robocza',      '#6B7280', 1),
    ((SELECT id FROM dictionary_types WHERE code='policy_status'), 'review',    'W recenzji',   '#3B82F6', 2),
    ((SELECT id FROM dictionary_types WHERE code='policy_status'), 'approved',  'Zatwierdzona', '#22C55E', 3),
    ((SELECT id FROM dictionary_types WHERE code='policy_status'), 'withdrawn', 'Wycofana',     '#EF4444', 4);


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 9: TABLE — policies (Module 20, needed before exceptions)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE policies (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    ref_id                  VARCHAR(20) NOT NULL,
    title                   VARCHAR(500) NOT NULL,
    description             TEXT,
    category_id             INT,
    owner                   VARCHAR(200),
    approver                VARCHAR(200),
    status_id               INT,
    current_version         VARCHAR(50),
    effective_date          DATE,
    review_date             DATE,
    last_reviewed_at        DATETIME,
    document_url            VARCHAR(1000),
    target_audience_count   INT NOT NULL DEFAULT 0,
    acknowledgment_count    INT NOT NULL DEFAULT 0,
    acknowledgment_rate     DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN target_audience_count > 0
             THEN ROUND(acknowledgment_count / target_audience_count * 100, 2)
             ELSE 0.00
        END
    ) STORED,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_policies_category FOREIGN KEY (category_id) REFERENCES dictionary_entries(id),
    CONSTRAINT fk_policies_status   FOREIGN KEY (status_id)   REFERENCES dictionary_entries(id),
    INDEX ix_policies_status (status_id),
    INDEX ix_policies_review (review_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 10: TABLE — policy_standard_mappings (Module 20)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE policy_standard_mappings (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    policy_id           INT NOT NULL,
    framework_node_id   INT,
    standard_name       VARCHAR(200),
    control_ref         VARCHAR(100),
    control_description TEXT,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_psm_policy    FOREIGN KEY (policy_id)         REFERENCES policies(id) ON DELETE CASCADE,
    CONSTRAINT fk_psm_fwnode    FOREIGN KEY (framework_node_id) REFERENCES framework_nodes(id) ON DELETE SET NULL,
    INDEX ix_psm_policy (policy_id),
    INDEX ix_psm_fwnode (framework_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 11: TABLE — policy_acknowledgments (Module 20)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE policy_acknowledgments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    policy_id       INT NOT NULL,
    org_unit_id     INT,
    acknowledged_by VARCHAR(200) NOT NULL,
    acknowledged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    policy_version  VARCHAR(50),

    CONSTRAINT fk_pack_policy   FOREIGN KEY (policy_id)   REFERENCES policies(id) ON DELETE CASCADE,
    CONSTRAINT fk_pack_orgunit  FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    INDEX ix_pack_policy (policy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 12: TABLE — vulnerabilities_registry (Module 13)
-- Note: Separate from existing `vulnerabilities` catalog table
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE vulnerabilities_registry (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    ref_id                  VARCHAR(20) NOT NULL,
    title                   VARCHAR(500) NOT NULL,
    description             TEXT,
    source_id               INT,
    org_unit_id             INT NOT NULL,
    asset_id                INT,
    category_id             INT,
    severity_id             INT,
    cvss_score              DECIMAL(3,1),
    cvss_vector             VARCHAR(255),
    cve_id                  VARCHAR(30),
    status_id               INT,
    remediation_priority_id INT,
    owner                   VARCHAR(200) NOT NULL,
    detected_at             DATE NOT NULL,
    closed_at               DATE,
    sla_deadline            DATE,
    remediation_notes       TEXT,
    risk_id                 INT,
    finding_id              INT,
    exception_id            INT,
    created_by              VARCHAR(200) NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_vulnreg_source    FOREIGN KEY (source_id)               REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vulnreg_orgunit   FOREIGN KEY (org_unit_id)             REFERENCES org_units(id),
    CONSTRAINT fk_vulnreg_asset     FOREIGN KEY (asset_id)                REFERENCES assets(id),
    CONSTRAINT fk_vulnreg_category  FOREIGN KEY (category_id)             REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vulnreg_severity  FOREIGN KEY (severity_id)             REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vulnreg_status    FOREIGN KEY (status_id)               REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vulnreg_priority  FOREIGN KEY (remediation_priority_id) REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vulnreg_risk      FOREIGN KEY (risk_id)                 REFERENCES risks(id),
    INDEX ix_vulnreg_status    (status_id),
    INDEX ix_vulnreg_severity  (severity_id),
    INDEX ix_vulnreg_orgunit   (org_unit_id),
    INDEX ix_vulnreg_asset     (asset_id),
    INDEX ix_vulnreg_sla       (sla_deadline),
    INDEX ix_vulnreg_cve       (cve_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 13: TABLE — incidents (Module 14)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE incidents (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    ref_id                      VARCHAR(20) NOT NULL,
    title                       VARCHAR(500) NOT NULL,
    description                 TEXT NOT NULL,
    category_id                 INT,
    severity_id                 INT,
    org_unit_id                 INT NOT NULL,
    asset_id                    INT,
    reported_by                 VARCHAR(200) NOT NULL,
    assigned_to                 VARCHAR(200) NOT NULL,
    status_id                   INT,
    reported_at                 DATETIME NOT NULL,
    detected_at                 DATETIME,
    closed_at                   DATETIME,
    ttr_minutes                 INT GENERATED ALWAYS AS (
        CASE WHEN closed_at IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, reported_at, closed_at)
             ELSE NULL
        END
    ) STORED,
    impact_id                   INT,
    personal_data_breach        BOOLEAN NOT NULL DEFAULT FALSE,
    authority_notification      BOOLEAN NOT NULL DEFAULT FALSE,
    actions_taken               TEXT,
    root_cause                  TEXT,
    lessons_learned             TEXT,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_increg_category   FOREIGN KEY (category_id)  REFERENCES dictionary_entries(id),
    CONSTRAINT fk_increg_severity   FOREIGN KEY (severity_id)  REFERENCES dictionary_entries(id),
    CONSTRAINT fk_increg_orgunit    FOREIGN KEY (org_unit_id)  REFERENCES org_units(id),
    CONSTRAINT fk_increg_asset      FOREIGN KEY (asset_id)     REFERENCES assets(id),
    CONSTRAINT fk_increg_status     FOREIGN KEY (status_id)    REFERENCES dictionary_entries(id),
    CONSTRAINT fk_increg_impact     FOREIGN KEY (impact_id)    REFERENCES dictionary_entries(id),
    INDEX ix_increg_status     (status_id),
    INDEX ix_increg_severity   (severity_id),
    INDEX ix_increg_orgunit    (org_unit_id),
    INDEX ix_increg_reported   (reported_at),
    INDEX ix_increg_personal   (personal_data_breach)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 14: M2M TABLES — incident_risks, incident_vulnerabilities
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE incident_risks (
    incident_id     INT NOT NULL,
    risk_id         INT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (incident_id, risk_id),
    CONSTRAINT fk_incr_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    CONSTRAINT fk_incr_risk     FOREIGN KEY (risk_id)     REFERENCES risks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE incident_vulnerabilities (
    incident_id         INT NOT NULL,
    vulnerability_id    INT NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (incident_id, vulnerability_id),
    CONSTRAINT fk_incv_incident FOREIGN KEY (incident_id)      REFERENCES incidents(id) ON DELETE CASCADE,
    CONSTRAINT fk_incv_vuln     FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities_registry(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 15: TABLE — policy_exceptions (Module 15)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE policy_exceptions (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    ref_id                      VARCHAR(20) NOT NULL,
    title                       VARCHAR(500) NOT NULL,
    description                 TEXT NOT NULL,
    policy_id                   INT NOT NULL,
    category_id                 INT,
    org_unit_id                 INT NOT NULL,
    asset_id                    INT,
    requested_by                VARCHAR(200) NOT NULL,
    approved_by                 VARCHAR(200),
    risk_level_id               INT,
    compensating_controls       TEXT,
    status_id                   INT,
    start_date                  DATE NOT NULL,
    expiry_date                 DATE NOT NULL,
    review_date                 DATE GENERATED ALWAYS AS (
        DATE_SUB(expiry_date, INTERVAL 30 DAY)
    ) STORED,
    closed_at                   DATE,
    risk_id                     INT,
    vulnerability_id            INT,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_pexc_policy       FOREIGN KEY (policy_id)         REFERENCES policies(id),
    CONSTRAINT fk_pexc_category     FOREIGN KEY (category_id)       REFERENCES dictionary_entries(id),
    CONSTRAINT fk_pexc_orgunit      FOREIGN KEY (org_unit_id)       REFERENCES org_units(id),
    CONSTRAINT fk_pexc_asset        FOREIGN KEY (asset_id)          REFERENCES assets(id),
    CONSTRAINT fk_pexc_risklevel    FOREIGN KEY (risk_level_id)     REFERENCES dictionary_entries(id),
    CONSTRAINT fk_pexc_status       FOREIGN KEY (status_id)         REFERENCES dictionary_entries(id),
    CONSTRAINT fk_pexc_risk         FOREIGN KEY (risk_id)           REFERENCES risks(id),
    CONSTRAINT fk_pexc_vuln         FOREIGN KEY (vulnerability_id)  REFERENCES vulnerabilities_registry(id),
    INDEX ix_pexc_status    (status_id),
    INDEX ix_pexc_expiry    (expiry_date),
    INDEX ix_pexc_policy    (policy_id),
    INDEX ix_pexc_orgunit   (org_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 16: TABLE — audits (Module 16)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE audits (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    ref_id              VARCHAR(20) NOT NULL,
    title               VARCHAR(500) NOT NULL,
    audit_type_id       INT,
    framework           VARCHAR(200),
    auditor             VARCHAR(200) NOT NULL,
    org_unit_id         INT,
    status_id           INT,
    start_date          DATE NOT NULL,
    end_date            DATE,
    summary             TEXT,
    overall_rating_id   INT,
    findings_count      INT NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_audits_type       FOREIGN KEY (audit_type_id)     REFERENCES dictionary_entries(id),
    CONSTRAINT fk_audits_orgunit    FOREIGN KEY (org_unit_id)       REFERENCES org_units(id),
    CONSTRAINT fk_audits_status     FOREIGN KEY (status_id)         REFERENCES dictionary_entries(id),
    CONSTRAINT fk_audits_rating     FOREIGN KEY (overall_rating_id) REFERENCES dictionary_entries(id),
    INDEX ix_audits_status  (status_id),
    INDEX ix_audits_type    (audit_type_id),
    INDEX ix_audits_dates   (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 17: TABLE — audit_findings (Module 16)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE audit_findings (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    ref_id                  VARCHAR(20) NOT NULL,
    audit_id                INT NOT NULL,
    title                   VARCHAR(500) NOT NULL,
    description             TEXT,
    finding_type_id         INT,
    severity_id             INT,
    security_area_id        INT,
    framework_node_id       INT,
    remediation_owner       VARCHAR(200),
    status_id               INT,
    sla_deadline            DATE,
    remediation_plan        TEXT,
    remediation_evidence    TEXT,
    risk_id                 INT,
    vulnerability_id        INT,
    closed_at               DATE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_afind_audit       FOREIGN KEY (audit_id)          REFERENCES audits(id) ON DELETE CASCADE,
    CONSTRAINT fk_afind_type        FOREIGN KEY (finding_type_id)   REFERENCES dictionary_entries(id),
    CONSTRAINT fk_afind_severity    FOREIGN KEY (severity_id)       REFERENCES dictionary_entries(id),
    CONSTRAINT fk_afind_area        FOREIGN KEY (security_area_id)  REFERENCES security_domains(id),
    CONSTRAINT fk_afind_fwnode      FOREIGN KEY (framework_node_id) REFERENCES framework_nodes(id) ON DELETE SET NULL,
    CONSTRAINT fk_afind_status      FOREIGN KEY (status_id)         REFERENCES dictionary_entries(id),
    CONSTRAINT fk_afind_risk        FOREIGN KEY (risk_id)           REFERENCES risks(id),
    CONSTRAINT fk_afind_vuln        FOREIGN KEY (vulnerability_id)  REFERENCES vulnerabilities_registry(id),
    INDEX ix_afind_audit    (audit_id),
    INDEX ix_afind_status   (status_id),
    INDEX ix_afind_severity (severity_id),
    INDEX ix_afind_sla      (sla_deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 18: Add finding_id and exception_id FKs to vulnerability_register
-- (Deferred because audit_findings/policy_exceptions created above)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE vulnerabilities_registry
    ADD CONSTRAINT fk_vulnreg_finding   FOREIGN KEY (finding_id)   REFERENCES audit_findings(id),
    ADD CONSTRAINT fk_vulnreg_exception FOREIGN KEY (exception_id) REFERENCES policy_exceptions(id);


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 19: TABLE — vendors (Module 18 — TPRM)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE vendors (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    ref_id                  VARCHAR(20) NOT NULL,
    name                    VARCHAR(500) NOT NULL,
    category_id             INT,
    criticality_id          INT,
    services_provided       TEXT,
    data_access_level_id    INT,
    contract_owner          VARCHAR(200),
    security_contact        VARCHAR(200),
    contract_start          DATE,
    contract_end            DATE,
    sla_description         TEXT,
    status_id               INT,
    last_assessment_date    DATE,
    next_assessment_date    DATE,
    risk_rating_id          INT,
    risk_score              DECIMAL(5,2),
    questionnaire_completed BOOLEAN NOT NULL DEFAULT FALSE,
    certifications          TEXT,
    risk_id                 INT,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_vendors_category      FOREIGN KEY (category_id)         REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vendors_criticality   FOREIGN KEY (criticality_id)      REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vendors_data_access   FOREIGN KEY (data_access_level_id)REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vendors_status        FOREIGN KEY (status_id)           REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vendors_rating        FOREIGN KEY (risk_rating_id)      REFERENCES dictionary_entries(id),
    CONSTRAINT fk_vendors_risk          FOREIGN KEY (risk_id)             REFERENCES risks(id),
    INDEX ix_vendors_status     (status_id),
    INDEX ix_vendors_rating     (risk_rating_id),
    INDEX ix_vendors_next_assess (next_assessment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 20: TABLE — vendor_assessments + vendor_assessment_answers
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE vendor_assessments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id           INT NOT NULL,
    assessment_date     DATE NOT NULL,
    assessed_by         VARCHAR(200) NOT NULL,
    total_score         DECIMAL(5,2),
    risk_rating_id      INT,
    notes               TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_vassess_vendor FOREIGN KEY (vendor_id)      REFERENCES vendors(id) ON DELETE CASCADE,
    CONSTRAINT fk_vassess_rating FOREIGN KEY (risk_rating_id) REFERENCES dictionary_entries(id),
    INDEX ix_vassess_vendor (vendor_id),
    INDEX ix_vassess_date   (assessment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vendor_assessment_answers (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    assessment_id       INT NOT NULL,
    question_code       VARCHAR(100) NOT NULL,
    question_text       VARCHAR(500) NOT NULL,
    answer              INT NOT NULL DEFAULT 0,
    notes               TEXT,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_vaanswer_assess FOREIGN KEY (assessment_id) REFERENCES vendor_assessments(id) ON DELETE CASCADE,
    INDEX ix_vaanswer_assess (assessment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 21: TABLE — awareness_campaigns + results + reports (Module 19)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE awareness_campaigns (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    ref_id                  VARCHAR(20) NOT NULL,
    title                   VARCHAR(500) NOT NULL,
    description             TEXT,
    campaign_type_id        INT,
    org_unit_id             INT,
    target_audience_count   INT NOT NULL DEFAULT 0,
    start_date              DATE NOT NULL,
    end_date                DATE,
    status_id               INT,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_acamp_type    FOREIGN KEY (campaign_type_id) REFERENCES dictionary_entries(id),
    CONSTRAINT fk_acamp_orgunit FOREIGN KEY (org_unit_id)      REFERENCES org_units(id),
    CONSTRAINT fk_acamp_status  FOREIGN KEY (status_id)        REFERENCES dictionary_entries(id),
    INDEX ix_acamp_status (status_id),
    INDEX ix_acamp_dates  (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE awareness_results (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id         INT NOT NULL,
    org_unit_id         INT,
    participants_count  INT NOT NULL DEFAULT 0,
    completed_count     INT NOT NULL DEFAULT 0,
    failed_count        INT NOT NULL DEFAULT 0,
    reported_count      INT NOT NULL DEFAULT 0,
    avg_score           DECIMAL(5,2),
    completion_rate     DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN participants_count > 0
             THEN ROUND(completed_count / participants_count * 100, 2)
             ELSE 0.00
        END
    ) STORED,
    click_rate          DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN participants_count > 0
             THEN ROUND(failed_count / participants_count * 100, 2)
             ELSE 0.00
        END
    ) STORED,
    report_rate         DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN participants_count > 0
             THEN ROUND(reported_count / participants_count * 100, 2)
             ELSE 0.00
        END
    ) STORED,
    recorded_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_aresult_campaign FOREIGN KEY (campaign_id) REFERENCES awareness_campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_aresult_orgunit  FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    INDEX ix_aresult_campaign (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE awareness_employee_reports (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    month           DATE NOT NULL,
    org_unit_id     INT,
    reports_count   INT NOT NULL DEFAULT 0,
    confirmed_count INT NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_aemprep_orgunit FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    UNIQUE KEY uq_awareness_month_org (month, org_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 22: ALTER risks — new FKs: vendor_id, source_type, source_id
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE risks
    ADD COLUMN IF NOT EXISTS vendor_id   INT          NULL AFTER asset_id,
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(50)  NULL AFTER vendor_id,
    ADD COLUMN IF NOT EXISTS source_id   INT          NULL AFTER source_type;

-- vendor FK (only add if not already existing)
ALTER TABLE risks
    ADD CONSTRAINT fk_risks_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id);


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 23: CMDB — extend assets table for v2.0 fields
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS ref_id             VARCHAR(20)     NULL AFTER id,
    ADD COLUMN IF NOT EXISTS technical_owner    VARCHAR(200)    NULL AFTER owner,
    ADD COLUMN IF NOT EXISTS data_sensitivity_id INT            NULL AFTER criticality_id,
    ADD COLUMN IF NOT EXISTS environment_id     INT             NULL AFTER data_sensitivity_id,
    ADD COLUMN IF NOT EXISTS ip_address         VARCHAR(45)     NULL AFTER environment_id,
    ADD COLUMN IF NOT EXISTS hostname           VARCHAR(255)    NULL AFTER ip_address,
    ADD COLUMN IF NOT EXISTS os_version         VARCHAR(100)    NULL AFTER hostname,
    ADD COLUMN IF NOT EXISTS vendor             VARCHAR(200)    NULL AFTER os_version,
    ADD COLUMN IF NOT EXISTS support_end_date   DATE            NULL AFTER vendor,
    ADD COLUMN IF NOT EXISTS status_id          INT             NULL AFTER support_end_date,
    ADD COLUMN IF NOT EXISTS last_scan_date     DATE            NULL AFTER status_id;

-- FKs for new columns
ALTER TABLE assets
    ADD CONSTRAINT fk_assets_data_sens  FOREIGN KEY (data_sensitivity_id) REFERENCES dictionary_entries(id),
    ADD CONSTRAINT fk_assets_env        FOREIGN KEY (environment_id)      REFERENCES dictionary_entries(id),
    ADD CONSTRAINT fk_assets_status     FOREIGN KEY (status_id)           REFERENCES dictionary_entries(id);


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 24: TABLE — security_score_config (Module 21)
-- Flat column model matching SecurityScoreConfig ORM
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE security_score_config (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    version                     INT NOT NULL DEFAULT 1,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    -- Pillar weights (sum must = 100)
    w_risk                      DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    w_vulnerability             DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    w_incident                  DECIMAL(5,2) NOT NULL DEFAULT 12.00,
    w_exception                 DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    w_maturity                  DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    w_audit                     DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    w_asset                     DECIMAL(5,2) NOT NULL DEFAULT 8.00,
    w_tprm                      DECIMAL(5,2) NOT NULL DEFAULT 6.00,
    w_policy                    DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    w_awareness                 DECIMAL(5,2) NOT NULL DEFAULT 4.00,
    -- Vulnerability thresholds
    vuln_threshold_critical     INT NOT NULL DEFAULT 3,
    vuln_threshold_high         INT NOT NULL DEFAULT 10,
    vuln_threshold_medium       INT NOT NULL DEFAULT 30,
    vuln_threshold_low          INT NOT NULL DEFAULT 100,
    -- Incident TTR targets (hours)
    incident_ttr_critical       INT NOT NULL DEFAULT 4,
    incident_ttr_high           INT NOT NULL DEFAULT 24,
    incident_ttr_medium         INT NOT NULL DEFAULT 72,
    incident_ttr_low            INT NOT NULL DEFAULT 168,
    incident_window_days        INT NOT NULL DEFAULT 90,
    -- Audit finding SLA (days)
    audit_sla_critical          INT NOT NULL DEFAULT 14,
    audit_sla_high              INT NOT NULL DEFAULT 30,
    audit_sla_medium            INT NOT NULL DEFAULT 60,
    audit_sla_low               INT NOT NULL DEFAULT 90,
    -- Meta
    snapshot_frequency          VARCHAR(20) NOT NULL DEFAULT 'daily',
    changed_by                  VARCHAR(200),
    change_reason               TEXT,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default v1 config
INSERT INTO security_score_config (version, is_active, changed_by, change_reason) VALUES
    (1, TRUE, 'system-migration', 'Domyślna konfiguracja Security Score v2.0');


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 25: TABLE — security_score_snapshots (Module 21)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE security_score_snapshots (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    snapshot_date           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_score             DECIMAL(5,2) NOT NULL,
    -- 10 pillar scores (matching ORM SecurityScoreSnapshot)
    risk_score              DECIMAL(5,2),
    vulnerability_score     DECIMAL(5,2),
    incident_score          DECIMAL(5,2),
    exception_score         DECIMAL(5,2),
    maturity_score          DECIMAL(5,2),
    audit_score             DECIMAL(5,2),
    asset_score             DECIMAL(5,2),
    tprm_score              DECIMAL(5,2),
    policy_score            DECIMAL(5,2),
    awareness_score         DECIMAL(5,2),
    -- Weights at time of snapshot
    w_risk                  DECIMAL(5,2),
    w_vulnerability         DECIMAL(5,2),
    w_incident              DECIMAL(5,2),
    w_exception             DECIMAL(5,2),
    w_maturity              DECIMAL(5,2),
    w_audit                 DECIMAL(5,2),
    w_asset                 DECIMAL(5,2),
    w_tprm                  DECIMAL(5,2),
    w_policy                DECIMAL(5,2),
    w_awareness             DECIMAL(5,2),
    -- Meta
    config_version          INT,
    triggered_by            VARCHAR(50),
    created_by              VARCHAR(200),
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX ix_sssnapshot_date (snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════
-- KROK 26: UTILITY VIEWS
-- ═══════════════════════════════════════════════════════════════════════

-- Vulnerability summary per severity (open only)
CREATE OR REPLACE VIEW v_vuln_summary AS
SELECT
    de_sev.code AS severity_code,
    de_sev.label AS severity_label,
    COUNT(vr.id) AS open_count,
    SUM(CASE WHEN vr.sla_deadline IS NOT NULL AND vr.sla_deadline < CURDATE() THEN 1 ELSE 0 END) AS overdue_count
FROM vulnerabilities_registry vr
JOIN dictionary_entries de_sev ON de_sev.id = vr.severity_id
JOIN dictionary_entries de_st  ON de_st.id = vr.status_id
WHERE vr.is_active = TRUE
  AND de_st.code IN ('new', 'analyzing', 'remediating')
GROUP BY de_sev.code, de_sev.label, de_sev.sort_order
ORDER BY de_sev.sort_order;

-- Incident summary (last 90 days)
CREATE OR REPLACE VIEW v_incident_summary_90d AS
SELECT
    de_sev.code AS severity_code,
    de_sev.label AS severity_label,
    COUNT(ir.id) AS incident_count,
    ROUND(AVG(ir.ttr_minutes), 0) AS avg_ttr_minutes,
    SUM(CASE WHEN ir.lessons_learned IS NOT NULL AND ir.lessons_learned != '' THEN 1 ELSE 0 END) AS with_lessons
FROM incidents ir
JOIN dictionary_entries de_sev ON de_sev.id = ir.severity_id
WHERE ir.is_active = TRUE
  AND ir.reported_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
GROUP BY de_sev.code, de_sev.label, de_sev.sort_order
ORDER BY de_sev.sort_order;

-- Active policy exceptions summary
CREATE OR REPLACE VIEW v_active_exceptions AS
SELECT
    pe.*,
    p.title AS policy_title,
    de_risk.label AS risk_level_label,
    de_st.code AS status_code,
    DATEDIFF(pe.expiry_date, CURDATE()) AS days_until_expiry
FROM policy_exceptions pe
JOIN policies p ON p.id = pe.policy_id
LEFT JOIN dictionary_entries de_risk ON de_risk.id = pe.risk_level_id
LEFT JOIN dictionary_entries de_st ON de_st.id = pe.status_id
WHERE pe.is_active = TRUE
  AND de_st.code IN ('approved', 'active', 'renewed');

-- Open audit findings summary
CREATE OR REPLACE VIEW v_open_findings AS
SELECT
    de_type.code AS finding_type_code,
    de_type.label AS finding_type_label,
    de_sev.code AS severity_code,
    COUNT(af.id) AS open_count,
    SUM(CASE WHEN af.sla_deadline IS NOT NULL AND af.sla_deadline < CURDATE() THEN 1 ELSE 0 END) AS overdue_count
FROM audit_findings af
JOIN dictionary_entries de_st ON de_st.id = af.status_id
LEFT JOIN dictionary_entries de_type ON de_type.id = af.finding_type_id
LEFT JOIN dictionary_entries de_sev ON de_sev.id = af.severity_id
WHERE af.is_active = TRUE
  AND de_st.code IN ('new', 'remediating', 'verification')
GROUP BY de_type.code, de_type.label, de_sev.code
ORDER BY de_type.sort_order;


-- ═══════════════════════════════════════════════════════════════════════
-- GOTOWE! Weryfikacja:
--
--   SELECT 'vulnerabilities_registry' AS t, COUNT(*) AS c FROM vulnerabilities_registry
--   UNION ALL SELECT 'incidents', COUNT(*) FROM incidents
--   UNION ALL SELECT 'policy_exceptions', COUNT(*) FROM policy_exceptions
--   UNION ALL SELECT 'audits', COUNT(*) FROM audits
--   UNION ALL SELECT 'audit_findings', COUNT(*) FROM audit_findings
--   UNION ALL SELECT 'vendors', COUNT(*) FROM vendors
--   UNION ALL SELECT 'awareness_campaigns', COUNT(*) FROM awareness_campaigns
--   UNION ALL SELECT 'policies', COUNT(*) FROM policies
--   UNION ALL SELECT 'security_score_config', COUNT(*) FROM security_score_config
--   UNION ALL SELECT 'security_score_snapshots', COUNT(*) FROM security_score_snapshots;
--
-- Nowe tabele: 17
-- Nowe słowniki: 26 typów
-- ═══════════════════════════════════════════════════════════════════════
