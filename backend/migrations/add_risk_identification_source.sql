-- ═══════════════════════════════════════════════════════════════
-- Slownik: risk_identification_source (zrodlo identyfikacji ryzyka)
-- + kolumna identification_source_id w tabeli risks
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Nowy typ slownika ──
INSERT INTO dictionary_types (code, name, description, is_system) VALUES
('risk_identification_source', 'Zrodlo identyfikacji ryzyka', 'Sposob w jaki ryzyko zostalo zidentyfikowane', 0);

-- ── 2. Wpisy slownika ──
INSERT INTO dictionary_entries (dict_type_id, code, label, description, sort_order, is_active)
SELECT dt.id, e.code, e.label, e.description, e.sort_order, 1
FROM (SELECT id FROM dictionary_types WHERE code = 'risk_identification_source') dt
CROSS JOIN (
  SELECT 'internal_audit'  AS code, 'Audyt wewnetrzny'  AS label, 'Ryzyko zidentyfikowane podczas audytu wewnetrznego'  AS description, 1 AS sort_order
  UNION ALL SELECT 'external_audit',  'Audyt zewnetrzny',  'Ryzyko zidentyfikowane podczas audytu zewnetrznego',  2
  UNION ALL SELECT 'control',         'Kontrola',          'Ryzyko zidentyfikowane w wyniku kontroli',             3
  UNION ALL SELECT 'metric_result',   'Wynik miernika',    'Ryzyko zidentyfikowane na podstawie wyniku miernika',  4
  UNION ALL SELECT 'observation',     'Obserwacja',        'Ryzyko zidentyfikowane przez obserwacje',              5
  UNION ALL SELECT 'report',          'Zgloszenie',        'Ryzyko zidentyfikowane na podstawie zgloszenia',       6
  UNION ALL SELECT 'incident',        'Incydent',          'Ryzyko zidentyfikowane w wyniku incydentu',            7
) e;

-- ── 3. Nowa kolumna w tabeli risks ──
ALTER TABLE risks ADD COLUMN identification_source_id INT NULL AFTER risk_source;
