-- ═══════════════════════════════════════════════════════════════════
-- 014: Seed korelacji Smart Catalog + migracja FK tablic ryzyka
-- Uruchom w MariaDB po migracji 013 (smart_catalog)
-- ═══════════════════════════════════════════════════════════════════

-- Wyczyszczenie istniejacych linkow (na wypadek czesciowego seeda)
DELETE FROM threat_weakness_link WHERE is_system = 1;
DELETE FROM threat_control_link WHERE is_system = 1;
DELETE FROM weakness_control_link WHERE is_system = 1;

-- ═══════════════════════════════════════════════════════════════════
-- 1. THREAT ↔ WEAKNESS (95 korelacji)
-- ═══════════════════════════════════════════════════════════════════

INSERT IGNORE INTO threat_weakness_link (threat_id, weakness_id, relevance, is_system)
SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-001' AND w.ref_id='W-043'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-001' AND w.ref_id='W-060'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-001' AND w.ref_id='W-050'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-002' AND w.ref_id='W-044'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-002' AND w.ref_id='W-060'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-003' AND w.ref_id='W-001'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-003' AND w.ref_id='W-003'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-003' AND w.ref_id='W-060'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-005' AND w.ref_id='W-001'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-006' AND w.ref_id='W-044'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-010' AND w.ref_id='W-022'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-010' AND w.ref_id='W-050'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-010' AND w.ref_id='W-030'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-010' AND w.ref_id='W-010'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-010' AND w.ref_id='W-029'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-011' AND w.ref_id='W-030'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-011' AND w.ref_id='W-029'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-011' AND w.ref_id='W-020'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-012' AND w.ref_id='W-030'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-012' AND w.ref_id='W-029'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-013' AND w.ref_id='W-030'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-013' AND w.ref_id='W-031'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-014' AND w.ref_id='W-022'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-014' AND w.ref_id='W-030'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-014' AND w.ref_id='W-010'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-015' AND w.ref_id='W-020'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-015' AND w.ref_id='W-021'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-015' AND w.ref_id='W-029'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-015' AND w.ref_id='W-034'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-016' AND w.ref_id='W-024'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-016' AND w.ref_id='W-023'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-016' AND w.ref_id='W-027'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-017' AND w.ref_id='W-024'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-017' AND w.ref_id='W-026'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-018' AND w.ref_id='W-013'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-018' AND w.ref_id='W-015'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-018' AND w.ref_id='W-014'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-019' AND w.ref_id='W-022'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-019' AND w.ref_id='W-012'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-019' AND w.ref_id='W-027'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-019' AND w.ref_id='W-010'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-020' AND w.ref_id='W-004'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-020' AND w.ref_id='W-041'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-020' AND w.ref_id='W-042'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-021' AND w.ref_id='W-041'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-021' AND w.ref_id='W-042'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-021' AND w.ref_id='W-043'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-022' AND w.ref_id='W-028'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-022' AND w.ref_id='W-027'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-022' AND w.ref_id='W-053'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-022' AND w.ref_id='W-063'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-030' AND w.ref_id='W-023'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-030' AND w.ref_id='W-052'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-030' AND w.ref_id='W-027'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-031' AND w.ref_id='W-050'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-031' AND w.ref_id='W-051'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-031' AND w.ref_id='W-028'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-032' AND w.ref_id='W-052'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-033' AND w.ref_id='W-030'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-033' AND w.ref_id='W-062'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-033' AND w.ref_id='W-061'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-040' AND w.ref_id='W-028'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-040' AND w.ref_id='W-062'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-040' AND w.ref_id='W-027'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-040' AND w.ref_id='W-032'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-041' AND w.ref_id='W-062'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-041' AND w.ref_id='W-065'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-042' AND w.ref_id='W-040'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-042' AND w.ref_id='W-041'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-050' AND w.ref_id='W-060'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-050' AND w.ref_id='W-033'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-051' AND w.ref_id='W-030'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-060' AND w.ref_id='W-010'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-060' AND w.ref_id='W-003'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-061' AND w.ref_id='W-003'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-061' AND w.ref_id='W-001'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-062' AND w.ref_id='W-050'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-062' AND w.ref_id='W-051'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-063' AND w.ref_id='W-003'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-063' AND w.ref_id='W-010'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-064' AND w.ref_id='W-052'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-064' AND w.ref_id='W-022'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-065' AND w.ref_id='W-052'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-070' AND w.ref_id='W-062'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-070' AND w.ref_id='W-061'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-070' AND w.ref_id='W-025'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-071' AND w.ref_id='W-065'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-072' AND w.ref_id='W-065'
UNION ALL SELECT t.id, w.id, 'MEDIUM', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-072' AND w.ref_id='W-022'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-080' AND w.ref_id='W-014'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-081' AND w.ref_id='W-028'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-081' AND w.ref_id='W-023'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-082' AND w.ref_id='W-022'
UNION ALL SELECT t.id, w.id, 'HIGH', 1 FROM threat_catalog t, weakness_catalog w WHERE t.ref_id='T-082' AND w.ref_id='W-012';


-- ═══════════════════════════════════════════════════════════════════
-- 2. THREAT ↔ CONTROL (65 korelacji)
-- ═══════════════════════════════════════════════════════════════════

INSERT IGNORE INTO threat_control_link (threat_id, control_id, effectiveness, is_system)
SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-001' AND c.ref_id='C-043'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-001' AND c.ref_id='C-060'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-001' AND c.ref_id='C-050'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-002' AND c.ref_id='C-044'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-002' AND c.ref_id='C-060'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-003' AND c.ref_id='C-001'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-003' AND c.ref_id='C-002'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-003' AND c.ref_id='C-060'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-005' AND c.ref_id='C-001'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-006' AND c.ref_id='C-044'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-010' AND c.ref_id='C-050'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-010' AND c.ref_id='C-075'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-010' AND c.ref_id='C-073'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-010' AND c.ref_id='C-010'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-010' AND c.ref_id='C-030'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-011' AND c.ref_id='C-030'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-011' AND c.ref_id='C-031'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-011' AND c.ref_id='C-020'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-011' AND c.ref_id='C-075'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-012' AND c.ref_id='C-030'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-012' AND c.ref_id='C-020'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-013' AND c.ref_id='C-030'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-013' AND c.ref_id='C-032'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-014' AND c.ref_id='C-075'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-014' AND c.ref_id='C-073'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-014' AND c.ref_id='C-010'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-015' AND c.ref_id='C-020'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-015' AND c.ref_id='C-022'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-015' AND c.ref_id='C-021'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-015' AND c.ref_id='C-070'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-016' AND c.ref_id='C-074'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-016' AND c.ref_id='C-072'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-017' AND c.ref_id='C-074'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-018' AND c.ref_id='C-012'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-018' AND c.ref_id='C-013'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-019' AND c.ref_id='C-070'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-019' AND c.ref_id='C-011'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-019' AND c.ref_id='C-073'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-019' AND c.ref_id='C-010'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-020' AND c.ref_id='C-003'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-020' AND c.ref_id='C-041'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-020' AND c.ref_id='C-042'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-021' AND c.ref_id='C-041'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-021' AND c.ref_id='C-042'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-022' AND c.ref_id='C-024'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-022' AND c.ref_id='C-070'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-022' AND c.ref_id='C-025'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-030' AND c.ref_id='C-052'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-030' AND c.ref_id='C-070'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-031' AND c.ref_id='C-050'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-031' AND c.ref_id='C-051'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-031' AND c.ref_id='C-024'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-032' AND c.ref_id='C-052'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-033' AND c.ref_id='C-062'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-033' AND c.ref_id='C-071'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-033' AND c.ref_id='C-030'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-040' AND c.ref_id='C-071'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-040' AND c.ref_id='C-024'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-040' AND c.ref_id='C-070'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-040' AND c.ref_id='C-025'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-041' AND c.ref_id='C-062'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-041' AND c.ref_id='C-071'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-042' AND c.ref_id='C-040'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-042' AND c.ref_id='C-041'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-050' AND c.ref_id='C-060'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-051' AND c.ref_id='C-030'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-060' AND c.ref_id='C-010'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-060' AND c.ref_id='C-002'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-061' AND c.ref_id='C-002'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-061' AND c.ref_id='C-001'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-062' AND c.ref_id='C-050'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-062' AND c.ref_id='C-051'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-063' AND c.ref_id='C-002'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-063' AND c.ref_id='C-010'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-064' AND c.ref_id='C-052'
UNION ALL SELECT t.id, c.id, 'MEDIUM', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-064' AND c.ref_id='C-073'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-065' AND c.ref_id='C-076'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-070' AND c.ref_id='C-062'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-070' AND c.ref_id='C-061'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-072' AND c.ref_id='C-072'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-072' AND c.ref_id='C-073'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-080' AND c.ref_id='C-014'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-081' AND c.ref_id='C-024'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-081' AND c.ref_id='C-023'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-082' AND c.ref_id='C-072'
UNION ALL SELECT t.id, c.id, 'HIGH', 1 FROM threat_catalog t, control_catalog c WHERE t.ref_id='T-082' AND c.ref_id='C-011';


-- ═══════════════════════════════════════════════════════════════════
-- 3. WEAKNESS ↔ CONTROL (48 korelacji)
-- ═══════════════════════════════════════════════════════════════════

INSERT IGNORE INTO weakness_control_link (weakness_id, control_id, effectiveness, is_system)
SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-001' AND c.ref_id='C-001'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-002' AND c.ref_id='C-073'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-003' AND c.ref_id='C-002'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-004' AND c.ref_id='C-003'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-010' AND c.ref_id='C-010'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-011' AND c.ref_id='C-072'
UNION ALL SELECT w.id, c.id, 'MEDIUM', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-011' AND c.ref_id='C-010'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-012' AND c.ref_id='C-011'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-013' AND c.ref_id='C-012'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-014' AND c.ref_id='C-014'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-015' AND c.ref_id='C-013'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-020' AND c.ref_id='C-021'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-020' AND c.ref_id='C-020'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-021' AND c.ref_id='C-022'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-022' AND c.ref_id='C-073'
UNION ALL SELECT w.id, c.id, 'MEDIUM', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-022' AND c.ref_id='C-072'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-023' AND c.ref_id='C-052'
UNION ALL SELECT w.id, c.id, 'MEDIUM', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-023' AND c.ref_id='C-072'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-024' AND c.ref_id='C-074'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-025' AND c.ref_id='C-003'
UNION ALL SELECT w.id, c.id, 'MEDIUM', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-025' AND c.ref_id='C-012'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-026' AND c.ref_id='C-020'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-027' AND c.ref_id='C-070'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-028' AND c.ref_id='C-024'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-028' AND c.ref_id='C-025'
UNION ALL SELECT w.id, c.id, 'MEDIUM', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-028' AND c.ref_id='C-023'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-029' AND c.ref_id='C-020'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-030' AND c.ref_id='C-030'
UNION ALL SELECT w.id, c.id, 'MEDIUM', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-030' AND c.ref_id='C-031'
UNION ALL SELECT w.id, c.id, 'MEDIUM', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-031' AND c.ref_id='C-032'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-032' AND c.ref_id='C-032'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-033' AND c.ref_id='C-023'
UNION ALL SELECT w.id, c.id, 'MEDIUM', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-033' AND c.ref_id='C-024'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-034' AND c.ref_id='C-070'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-040' AND c.ref_id='C-040'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-041' AND c.ref_id='C-041'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-042' AND c.ref_id='C-042'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-043' AND c.ref_id='C-043'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-044' AND c.ref_id='C-044'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-050' AND c.ref_id='C-050'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-051' AND c.ref_id='C-051'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-052' AND c.ref_id='C-052'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-053' AND c.ref_id='C-053'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-060' AND c.ref_id='C-060'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-061' AND c.ref_id='C-061'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-062' AND c.ref_id='C-062'
UNION ALL SELECT w.id, c.id, 'HIGH', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-063' AND c.ref_id='C-025'
UNION ALL SELECT w.id, c.id, 'MEDIUM', 1 FROM weakness_catalog w, control_catalog c WHERE w.ref_id='W-065' AND c.ref_id='C-061';


-- ═══════════════════════════════════════════════════════════════════
-- 4. Migracja FK: risk junction tables → smart catalog
-- ═══════════════════════════════════════════════════════════════════

-- 4a. Backup danych z tablic polaczeniowych ryzyka (jesli istnieja)
CREATE TEMPORARY TABLE _bak_risk_threats AS
  SELECT rt.risk_id, tc.id AS new_threat_id, rt.created_at
  FROM risk_threats rt
  JOIN threats old_t ON old_t.id = rt.threat_id
  JOIN threat_catalog tc ON tc.name = old_t.name;

CREATE TEMPORARY TABLE _bak_risk_vulns AS
  SELECT rv.risk_id, wc.id AS new_vuln_id, rv.created_at
  FROM risk_vulnerabilities rv
  JOIN vulnerabilities old_v ON old_v.id = rv.vulnerability_id
  JOIN weakness_catalog wc ON wc.name = old_v.name;

CREATE TEMPORARY TABLE _bak_risk_safeguards AS
  SELECT rs.risk_id, cc.id AS new_sg_id, rs.created_at
  FROM risk_safeguards rs
  JOIN safeguards old_s ON old_s.id = rs.safeguard_id
  JOIN control_catalog cc ON cc.name = old_s.name;

-- 4b. Drop stare tablice
DROP TABLE IF EXISTS risk_threats;
DROP TABLE IF EXISTS risk_vulnerabilities;
DROP TABLE IF EXISTS risk_safeguards;

-- 4c. Nowe tablice z FK do smart catalog
CREATE TABLE risk_threats (
    risk_id     INT NOT NULL,
    threat_id   INT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (risk_id, threat_id),
    FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE,
    FOREIGN KEY (threat_id) REFERENCES threat_catalog(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE risk_vulnerabilities (
    risk_id          INT NOT NULL,
    vulnerability_id INT NOT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (risk_id, vulnerability_id),
    FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE,
    FOREIGN KEY (vulnerability_id) REFERENCES weakness_catalog(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE risk_safeguards (
    risk_id       INT NOT NULL,
    safeguard_id  INT NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (risk_id, safeguard_id),
    FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE,
    FOREIGN KEY (safeguard_id) REFERENCES control_catalog(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4d. Przywroc dane z backupu
INSERT IGNORE INTO risk_threats (risk_id, threat_id, created_at)
  SELECT risk_id, new_threat_id, created_at FROM _bak_risk_threats;

INSERT IGNORE INTO risk_vulnerabilities (risk_id, vulnerability_id, created_at)
  SELECT risk_id, new_vuln_id, created_at FROM _bak_risk_vulns;

INSERT IGNORE INTO risk_safeguards (risk_id, safeguard_id, created_at)
  SELECT risk_id, new_sg_id, created_at FROM _bak_risk_safeguards;

-- 4e. Migracja planned_safeguard_id w risks
UPDATE risks r
JOIN safeguards old_s ON old_s.id = r.planned_safeguard_id
JOIN control_catalog cc ON cc.name = old_s.name
SET r.planned_safeguard_id = cc.id
WHERE r.planned_safeguard_id IS NOT NULL;

-- 4f. Zmiana FK na planned_safeguard_id
-- Najpierw znajdz i usun stary FK
SET @fk_name = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'risks'
    AND COLUMN_NAME = 'planned_safeguard_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);

SET @sql = IF(@fk_name IS NOT NULL,
  CONCAT('ALTER TABLE risks DROP FOREIGN KEY ', @fk_name),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Dodaj nowy FK
ALTER TABLE risks
  ADD CONSTRAINT fk_risks_planned_safeguard_control
  FOREIGN KEY (planned_safeguard_id) REFERENCES control_catalog(id);

-- Cleanup
DROP TEMPORARY TABLE IF EXISTS _bak_risk_threats;
DROP TEMPORARY TABLE IF EXISTS _bak_risk_vulns;
DROP TEMPORARY TABLE IF EXISTS _bak_risk_safeguards;


-- ═══════════════════════════════════════════════════════════════════
-- Weryfikacja
-- ═══════════════════════════════════════════════════════════════════
SELECT 'threat_weakness_link' AS tbl, COUNT(*) AS cnt FROM threat_weakness_link
UNION ALL
SELECT 'threat_control_link', COUNT(*) FROM threat_control_link
UNION ALL
SELECT 'weakness_control_link', COUNT(*) FROM weakness_control_link
UNION ALL
SELECT 'risk_threats', COUNT(*) FROM risk_threats
UNION ALL
SELECT 'risk_vulnerabilities', COUNT(*) FROM risk_vulnerabilities
UNION ALL
SELECT 'risk_safeguards', COUNT(*) FROM risk_safeguards;
