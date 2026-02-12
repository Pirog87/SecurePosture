-- ═══════════════════════════════════════════════════════════════
-- Planowane zabezpieczenie w ramach postepowania z ryzykiem
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE risks ADD COLUMN planned_safeguard_id INT NULL AFTER treatment_plan;
