-- ═══════════════════════════════════════════════════════════════
-- ISO 27005 / ISO 31000 — rozszerzenie tabeli risks
-- Uruchom na MariaDB (phpMyAdmin)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Nowe kolumny: Kontekst (ISO 31000 §5.3) ──
ALTER TABLE risks ADD COLUMN risk_category_id INT NULL AFTER org_unit_id;
ALTER TABLE risks ADD COLUMN risk_source TEXT NULL AFTER risk_category_id;

-- ── 2. Nowe kolumny: Identyfikacja (ISO 27005 §8.2) ──
ALTER TABLE risks ADD COLUMN existing_controls TEXT NULL AFTER vulnerability_id;
ALTER TABLE risks ADD COLUMN control_effectiveness_id INT NULL AFTER existing_controls;
ALTER TABLE risks ADD COLUMN consequence_description TEXT NULL AFTER control_effectiveness_id;

-- ── 3. Nowe kolumny: Postepowanie (ISO 27005 §8.5) ──
ALTER TABLE risks ADD COLUMN treatment_plan TEXT NULL AFTER planned_actions;
ALTER TABLE risks ADD COLUMN treatment_deadline DATE NULL AFTER treatment_plan;
ALTER TABLE risks ADD COLUMN treatment_resources TEXT NULL AFTER treatment_deadline;

-- ── 4. Nowe kolumny: Akceptacja (ISO 27005 §8.6) ──
ALTER TABLE risks ADD COLUMN accepted_by VARCHAR(200) NULL AFTER target_safeguard;
ALTER TABLE risks ADD COLUMN accepted_at DATETIME NULL AFTER accepted_by;
ALTER TABLE risks ADD COLUMN acceptance_justification TEXT NULL AFTER accepted_at;

-- ── 5. Nowe kolumny: Monitorowanie (ISO 27005 §9) ──
ALTER TABLE risks ADD COLUMN next_review_date DATE NULL AFTER acceptance_justification;
ALTER TABLE risks ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER last_review_at;

-- ═══════════════════════════════════════════════════════════════
-- Nowe slowniki (dictionary_types + dictionary_entries)
-- ═══════════════════════════════════════════════════════════════

-- ── 6. Typ slownika: risk_category (kategorie ryzyka ISO 31000) ──
INSERT INTO dictionary_types (code, name, description, is_system) VALUES
('risk_category', 'Kategoria ryzyka', 'Kategorie ryzyk wg ISO 31000', 0);

INSERT INTO dictionary_entries (dict_type_id, code, label, description, sort_order, is_active)
SELECT dt.id, e.code, e.label, e.description, e.sort_order, 1
FROM (SELECT id FROM dictionary_types WHERE code = 'risk_category') dt
CROSS JOIN (
  SELECT 'strategic' AS code, 'Strategiczne' AS label, 'Ryzyka strategiczne organizacji' AS description, 1 AS sort_order
  UNION ALL SELECT 'operational', 'Operacyjne', 'Ryzyka operacyjne w biezacej dzialalnosci', 2
  UNION ALL SELECT 'financial', 'Finansowe', 'Ryzyka finansowe i budzetowe', 3
  UNION ALL SELECT 'compliance', 'Zgodnosci', 'Ryzyka regulacyjne i prawne (RODO, KRI, NIS2)', 4
  UNION ALL SELECT 'technological', 'Technologiczne', 'Ryzyka technologiczne i IT', 5
  UNION ALL SELECT 'reputational', 'Reputacyjne', 'Ryzyka wizerunkowe i reputacyjne', 6
  UNION ALL SELECT 'third_party', 'Stron trzecich', 'Ryzyka lancucha dostaw i podwykonawcow', 7
  UNION ALL SELECT 'physical', 'Fizyczne', 'Ryzyka fizyczne i srodowiskowe', 8
) e;

-- ── 7. Typ slownika: control_effectiveness (skutecznosc kontroli) ──
INSERT INTO dictionary_types (code, name, description, is_system) VALUES
('control_effectiveness', 'Skutecznosc kontroli', 'Ocena skutecznosci istniejacych zabezpieczen', 0);

INSERT INTO dictionary_entries (dict_type_id, code, label, description, numeric_value, sort_order, is_active)
SELECT dt.id, e.code, e.label, e.description, e.numeric_value, e.sort_order, 1
FROM (SELECT id FROM dictionary_types WHERE code = 'control_effectiveness') dt
CROSS JOIN (
  SELECT 'none' AS code, 'Brak kontroli' AS label, 'Brak jakichkolwiek zabezpieczen' AS description, 0 AS numeric_value, 1 AS sort_order
  UNION ALL SELECT 'minimal', 'Minimalna', 'Kontrole istnieja ale sa niekompletne lub nietestowane', 1, 2
  UNION ALL SELECT 'partial', 'Czesciowa', 'Kontrole pokrywaja czesc ryzyk, czesciowo skuteczne', 2, 3
  UNION ALL SELECT 'adequate', 'Wystarczajaca', 'Kontrole sa wdrozone i skuteczne w wiekszosci scenariuszy', 3, 4
  UNION ALL SELECT 'effective', 'Skuteczna', 'Kontrole sa w pelni wdrozone, testowane i skuteczne', 4, 5
) e;

-- ── 8. Wpis "accepted" w risk_status (jesli brak) ──
INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, description, sort_order, is_active)
SELECT dt.id, 'accepted', 'Zaakceptowane', 'Ryzyko formalnie zaakceptowane (ISO 27005 §8.6)', 5, 1
FROM dictionary_types dt WHERE dt.code = 'risk_status';

-- ── 9. Wpisy ISO w risk_strategy (jesli brak) ──
INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, description, sort_order, is_active)
SELECT dt.id, e.code, e.label, e.description, e.sort_order, 1
FROM (SELECT id FROM dictionary_types WHERE code = 'risk_strategy') dt
CROSS JOIN (
  SELECT 'modify' AS code, 'Modyfikacja ryzyka' AS label, 'Wdrozenie kontroli redukujacych prawdopodobienstwo lub wplyw (ISO 27005 §8.5.2)' AS description, 1 AS sort_order
  UNION ALL SELECT 'retain', 'Utrzymanie ryzyka', 'Swiadome utrzymanie ryzyka na obecnym poziomie (ISO 27005 §8.5.3)', 2
  UNION ALL SELECT 'avoid', 'Unikanie ryzyka', 'Rezygnacja z dzialalnosci generujacej ryzyko (ISO 27005 §8.5.4)', 3
  UNION ALL SELECT 'share', 'Transfer ryzyka', 'Przeniesienie ryzyka na strone trzecia — ubezpieczenie, outsourcing (ISO 27005 §8.5.5)', 4
) e;
