-- ============================================================
-- Migration 008: Seed missing dictionary types and entries
-- Idempotent — safe to re-run
-- MariaDB 10.6+
-- ============================================================

SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_dict$$

CREATE PROCEDURE seed_dict(
    IN p_type_code VARCHAR(50),
    IN p_type_name VARCHAR(200),
    IN p_entry_code VARCHAR(50),
    IN p_entry_label VARCHAR(300),
    IN p_sort INT
)
BEGIN
    DECLARE v_type_id INT;

    -- Ensure dictionary type exists
    SELECT id INTO v_type_id FROM dictionary_types WHERE code = p_type_code;
    IF v_type_id IS NULL THEN
        INSERT INTO dictionary_types (code, name, is_system, created_at, updated_at)
        VALUES (p_type_code, p_type_name, 1, NOW(), NOW());
        SET v_type_id = LAST_INSERT_ID();
    END IF;

    -- Ensure dictionary entry exists
    IF NOT EXISTS (
        SELECT 1 FROM dictionary_entries
        WHERE dict_type_id = v_type_id AND code = p_entry_code
    ) THEN
        INSERT INTO dictionary_entries (dict_type_id, code, label, sort_order, is_active, created_at, updated_at)
        VALUES (v_type_id, p_entry_code, p_entry_label, p_sort, 1, NOW(), NOW());
    END IF;
END$$

DELIMITER ;

-- ── exception_category ──
CALL seed_dict('exception_category', 'Kategoria wyjatku', 'config',   'Konfiguracja',   1);
CALL seed_dict('exception_category', 'Kategoria wyjatku', 'access',   'Dostep',         2);
CALL seed_dict('exception_category', 'Kategoria wyjatku', 'network',  'Siec',           3);
CALL seed_dict('exception_category', 'Kategoria wyjatku', 'data',     'Dane',           4);
CALL seed_dict('exception_category', 'Kategoria wyjatku', 'crypto',   'Kryptografia',   5);
CALL seed_dict('exception_category', 'Kategoria wyjatku', 'physical', 'Fizyczne',       6);
CALL seed_dict('exception_category', 'Kategoria wyjatku', 'other',    'Inne',           7);

-- ── exception_status ──
CALL seed_dict('exception_status', 'Status wyjatku', 'requested', 'Wnioskowany', 1);
CALL seed_dict('exception_status', 'Status wyjatku', 'approved',  'Zatwierdzony', 2);
CALL seed_dict('exception_status', 'Status wyjatku', 'active',    'Aktywny',      3);
CALL seed_dict('exception_status', 'Status wyjatku', 'expired',   'Wygasly',      4);
CALL seed_dict('exception_status', 'Status wyjatku', 'renewed',   'Odnowiony',    5);
CALL seed_dict('exception_status', 'Status wyjatku', 'closed',    'Zamkniety',    6);
CALL seed_dict('exception_status', 'Status wyjatku', 'rejected',  'Odrzucony',    7);

-- ── severity_universal ──
CALL seed_dict('severity_universal', 'Waznosc (uniwersalna)', 'critical', 'Krytyczny',     1);
CALL seed_dict('severity_universal', 'Waznosc (uniwersalna)', 'high',     'Wysoki',        2);
CALL seed_dict('severity_universal', 'Waznosc (uniwersalna)', 'medium',   'Sredni',        3);
CALL seed_dict('severity_universal', 'Waznosc (uniwersalna)', 'low',      'Niski',         4);
CALL seed_dict('severity_universal', 'Waznosc (uniwersalna)', 'info',     'Informacyjny',  5);

-- ── vuln_source ──
CALL seed_dict('vuln_source', 'Zrodlo podatnosci', 'scanner',   'Skaner automatyczny', 1);
CALL seed_dict('vuln_source', 'Zrodlo podatnosci', 'pentest',   'Pen-test',            2);
CALL seed_dict('vuln_source', 'Zrodlo podatnosci', 'audit_int', 'Audyt wewnetrzny',    3);
CALL seed_dict('vuln_source', 'Zrodlo podatnosci', 'audit_ext', 'Audyt zewnetrzny',    4);
CALL seed_dict('vuln_source', 'Zrodlo podatnosci', 'manual',    'Zgloszenie reczne',   5);

-- ── vuln_category ──
CALL seed_dict('vuln_category', 'Kategoria podatnosci', 'config',   'Konfiguracja',   1);
CALL seed_dict('vuln_category', 'Kategoria podatnosci', 'patching', 'Patching',       2);
CALL seed_dict('vuln_category', 'Kategoria podatnosci', 'code',     'Kod',            3);
CALL seed_dict('vuln_category', 'Kategoria podatnosci', 'network',  'Siec',           4);
CALL seed_dict('vuln_category', 'Kategoria podatnosci', 'identity', 'Tozsamosc',      5);
CALL seed_dict('vuln_category', 'Kategoria podatnosci', 'crypto',   'Kryptografia',   6);
CALL seed_dict('vuln_category', 'Kategoria podatnosci', 'other',    'Inne',           7);

-- ── remediation_priority ──
CALL seed_dict('remediation_priority', 'Priorytet remediacji', 'P1', 'P1 (7 dni)',   1);
CALL seed_dict('remediation_priority', 'Priorytet remediacji', 'P2', 'P2 (30 dni)',  2);
CALL seed_dict('remediation_priority', 'Priorytet remediacji', 'P3', 'P3 (90 dni)',  3);
CALL seed_dict('remediation_priority', 'Priorytet remediacji', 'P4', 'P4 (180 dni)', 4);

-- ── vuln_status ──
CALL seed_dict('vuln_status', 'Status podatnosci', 'new',         'Nowa',           1);
CALL seed_dict('vuln_status', 'Status podatnosci', 'analysis',    'W analizie',     2);
CALL seed_dict('vuln_status', 'Status podatnosci', 'remediation', 'W remediacji',   3);
CALL seed_dict('vuln_status', 'Status podatnosci', 'closed',      'Zamknieta',      4);
CALL seed_dict('vuln_status', 'Status podatnosci', 'accepted',    'Zaakceptowana',  5);

-- ── incident_category ──
CALL seed_dict('incident_category', 'Kategoria incydentu', 'phishing',      'Phishing',              1);
CALL seed_dict('incident_category', 'Kategoria incydentu', 'malware',       'Malware',               2);
CALL seed_dict('incident_category', 'Kategoria incydentu', 'data_leak',     'Data Leak',             3);
CALL seed_dict('incident_category', 'Kategoria incydentu', 'unauth_access', 'Unauthorized Access',   4);
CALL seed_dict('incident_category', 'Kategoria incydentu', 'ddos',          'DDoS',                  5);
CALL seed_dict('incident_category', 'Kategoria incydentu', 'insider',       'Insider Threat',        6);
CALL seed_dict('incident_category', 'Kategoria incydentu', 'social_eng',    'Social Engineering',    7);
CALL seed_dict('incident_category', 'Kategoria incydentu', 'physical',      'Physical',              8);
CALL seed_dict('incident_category', 'Kategoria incydentu', 'config_error',  'Configuration Error',   9);
CALL seed_dict('incident_category', 'Kategoria incydentu', 'other',         'Inne',                  10);

-- ── incident_status ──
CALL seed_dict('incident_status', 'Status incydentu', 'reported', 'Zgloszony',  1);
CALL seed_dict('incident_status', 'Status incydentu', 'analysis', 'W analizie', 2);
CALL seed_dict('incident_status', 'Status incydentu', 'handling', 'W obsludze', 3);
CALL seed_dict('incident_status', 'Status incydentu', 'closed',   'Zamkniety',  4);

-- ── incident_impact ──
CALL seed_dict('incident_impact', 'Wplyw incydentu', 'none',        'Brak wplywu', 1);
CALL seed_dict('incident_impact', 'Wplyw incydentu', 'minimal',     'Minimalny',   2);
CALL seed_dict('incident_impact', 'Wplyw incydentu', 'limited',     'Ograniczony', 3);
CALL seed_dict('incident_impact', 'Wplyw incydentu', 'significant', 'Znaczacy',    4);
CALL seed_dict('incident_impact', 'Wplyw incydentu', 'critical',    'Krytyczny',   5);

-- ── audit_type ──
CALL seed_dict('audit_type', 'Typ audytu', 'internal',      'Wewnetrzny',     1);
CALL seed_dict('audit_type', 'Typ audytu', 'external',      'Zewnetrzny',     2);
CALL seed_dict('audit_type', 'Typ audytu', 'regulatory',    'Regulacyjny',    3);
CALL seed_dict('audit_type', 'Typ audytu', 'certification', 'Certyfikacyjny', 4);
CALL seed_dict('audit_type', 'Typ audytu', 'pentest',       'Pen-test',       5);

-- ── audit_rating ──
CALL seed_dict('audit_rating', 'Ocena audytu', 'positive',    'Pozytywna',             1);
CALL seed_dict('audit_rating', 'Ocena audytu', 'conditional', 'Warunkowo pozytywna',   2);
CALL seed_dict('audit_rating', 'Ocena audytu', 'negative',    'Negatywna',             3);
CALL seed_dict('audit_rating', 'Ocena audytu', 'na',          'N/A',                   4);

-- ── finding_type ──
CALL seed_dict('finding_type', 'Typ findingu', 'major_nc',       'Niezgodnosc glowna', 1);
CALL seed_dict('finding_type', 'Typ findingu', 'minor_nc',       'Niezgodnosc drobna', 2);
CALL seed_dict('finding_type', 'Typ findingu', 'observation',    'Obserwacja',         3);
CALL seed_dict('finding_type', 'Typ findingu', 'recommendation', 'Rekomendacja',       4);
CALL seed_dict('finding_type', 'Typ findingu', 'strength',       'Mocna strona',       5);

-- ── finding_status ──
CALL seed_dict('finding_status', 'Status findingu', 'new',          'Nowy',           1);
CALL seed_dict('finding_status', 'Status findingu', 'remediation',  'W remediacji',   2);
CALL seed_dict('finding_status', 'Status findingu', 'verification', 'Do weryfikacji', 3);
CALL seed_dict('finding_status', 'Status findingu', 'closed',       'Zamkniety',      4);
CALL seed_dict('finding_status', 'Status findingu', 'accepted',     'Zaakceptowany',  5);

-- ── policy_category ──
CALL seed_dict('policy_category', 'Kategoria polityki', 'it_security',      'Bezpieczenstwo IT',      1);
CALL seed_dict('policy_category', 'Kategoria polityki', 'data_protection',  'Ochrona danych',         2);
CALL seed_dict('policy_category', 'Kategoria polityki', 'access',           'Dostep',                 3);
CALL seed_dict('policy_category', 'Kategoria polityki', 'network',          'Siec',                   4);
CALL seed_dict('policy_category', 'Kategoria polityki', 'physical',         'Fizyczne',               5);
CALL seed_dict('policy_category', 'Kategoria polityki', 'bcp',              'Ciaglosc dzialania',     6);
CALL seed_dict('policy_category', 'Kategoria polityki', 'hr',               'HR',                     7);
CALL seed_dict('policy_category', 'Kategoria polityki', 'other',            'Inne',                   8);

-- ── policy_status ──
CALL seed_dict('policy_status', 'Status polityki', 'draft',    'Robocza',       1);
CALL seed_dict('policy_status', 'Status polityki', 'review',   'W recenzji',    2);
CALL seed_dict('policy_status', 'Status polityki', 'approved', 'Zatwierdzona',  3);
CALL seed_dict('policy_status', 'Status polityki', 'retired',  'Wycofana',      4);

-- ── campaign_type ──
CALL seed_dict('campaign_type', 'Typ kampanii awareness', 'online_training',  'Szkolenie online',       1);
CALL seed_dict('campaign_type', 'Typ kampanii awareness', 'onsite_training',  'Szkolenie stacjonarne',  2);
CALL seed_dict('campaign_type', 'Typ kampanii awareness', 'phishing_sim',     'Phishing simulation',    3);
CALL seed_dict('campaign_type', 'Typ kampanii awareness', 'knowledge_test',   'Test wiedzy',            4);

-- ── campaign_status ──
CALL seed_dict('campaign_status', 'Status kampanii', 'planned',   'Planowana',   1);
CALL seed_dict('campaign_status', 'Status kampanii', 'ongoing',   'W trakcie',   2);
CALL seed_dict('campaign_status', 'Status kampanii', 'completed', 'Zakonczona',  3);

-- ── vendor_category ──
CALL seed_dict('vendor_category', 'Kategoria dostawcy', 'cloud',       'Cloud Provider',   1);
CALL seed_dict('vendor_category', 'Kategoria dostawcy', 'saas',        'SaaS',             2);
CALL seed_dict('vendor_category', 'Kategoria dostawcy', 'outsourcing', 'Outsourcing IT',   3);
CALL seed_dict('vendor_category', 'Kategoria dostawcy', 'consulting',  'Consulting',       4);
CALL seed_dict('vendor_category', 'Kategoria dostawcy', 'hardware',    'Hardware',         5);
CALL seed_dict('vendor_category', 'Kategoria dostawcy', 'telco',       'Telco',            6);
CALL seed_dict('vendor_category', 'Kategoria dostawcy', 'other',       'Inne',             7);

-- ── vendor_status ──
CALL seed_dict('vendor_status', 'Status dostawcy', 'active',     'Aktywny',     1);
CALL seed_dict('vendor_status', 'Status dostawcy', 'evaluation', 'W ocenie',    2);
CALL seed_dict('vendor_status', 'Status dostawcy', 'suspended',  'Zawieszony',  3);
CALL seed_dict('vendor_status', 'Status dostawcy', 'terminated', 'Zakonczony',  4);

-- ── vendor_data_access ──
CALL seed_dict('vendor_data_access', 'Dostep dostawcy do danych', 'none',         'Brak dostepu',     1);
CALL seed_dict('vendor_data_access', 'Dostep dostawcy do danych', 'internal',     'Dane wewnetrzne',  2);
CALL seed_dict('vendor_data_access', 'Dostep dostawcy do danych', 'confidential', 'Dane poufne',      3);
CALL seed_dict('vendor_data_access', 'Dostep dostawcy do danych', 'personal',     'Dane osobowe',     4);

-- ── vendor_risk_rating ──
CALL seed_dict('vendor_risk_rating', 'Ocena ryzyka dostawcy', 'A', 'A (niskie ryzyko)',  1);
CALL seed_dict('vendor_risk_rating', 'Ocena ryzyka dostawcy', 'B', 'B',                  2);
CALL seed_dict('vendor_risk_rating', 'Ocena ryzyka dostawcy', 'C', 'C',                  3);
CALL seed_dict('vendor_risk_rating', 'Ocena ryzyka dostawcy', 'D', 'D (wysokie ryzyko)', 4);

-- ── asset_type ──
CALL seed_dict('asset_type', 'Typ aktywa', 'server',         'Serwer',               1);
CALL seed_dict('asset_type', 'Typ aktywa', 'application',    'Aplikacja',            2);
CALL seed_dict('asset_type', 'Typ aktywa', 'database',       'Baza danych',          3);
CALL seed_dict('asset_type', 'Typ aktywa', 'workstation',    'Stacja robocza',       4);
CALL seed_dict('asset_type', 'Typ aktywa', 'network_device', 'Urzadzenie sieciowe',  5);
CALL seed_dict('asset_type', 'Typ aktywa', 'mobile_device',  'Urzadzenie mobilne',   6);
CALL seed_dict('asset_type', 'Typ aktywa', 'cloud_service',  'Usluga chmurowa',      7);
CALL seed_dict('asset_type', 'Typ aktywa', 'data',           'Dane',                 8);
CALL seed_dict('asset_type', 'Typ aktywa', 'other',          'Inne',                 9);

-- ── asset_status ──
CALL seed_dict('asset_status', 'Status aktywa', 'active',          'Aktywny',       1);
CALL seed_dict('asset_status', 'Status aktywa', 'building',        'W budowie',     2);
CALL seed_dict('asset_status', 'Status aktywa', 'decommissioning', 'Wycofywany',    3);
CALL seed_dict('asset_status', 'Status aktywa', 'decommissioned',  'Wycofany',      4);

-- ── asset_environment ──
CALL seed_dict('asset_environment', 'Srodowisko aktywa', 'production',  'Produkcja',   1);
CALL seed_dict('asset_environment', 'Srodowisko aktywa', 'staging',     'Staging',     2);
CALL seed_dict('asset_environment', 'Srodowisko aktywa', 'development', 'Development', 3);
CALL seed_dict('asset_environment', 'Srodowisko aktywa', 'test',        'Test',        4);

-- ── data_sensitivity ──
CALL seed_dict('data_sensitivity', 'Wrazliwosc danych', 'public',       'Publiczne',    1);
CALL seed_dict('data_sensitivity', 'Wrazliwosc danych', 'internal',     'Wewnetrzne',   2);
CALL seed_dict('data_sensitivity', 'Wrazliwosc danych', 'confidential', 'Poufne',       3);
CALL seed_dict('data_sensitivity', 'Wrazliwosc danych', 'top_secret',   'Scisle tajne', 4);

-- Cleanup
DROP PROCEDURE IF EXISTS seed_dict;
