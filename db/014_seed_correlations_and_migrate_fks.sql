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

INSERT INTO threat_weakness_link (threat_id, weakness_id, relevance, is_system)
SELECT t.id, w.id, v.relevance, 1
FROM (VALUES
  ROW('T-001','W-043','HIGH'), ROW('T-001','W-060','HIGH'), ROW('T-001','W-050','MEDIUM'),
  ROW('T-002','W-044','HIGH'), ROW('T-002','W-060','HIGH'),
  ROW('T-003','W-001','HIGH'), ROW('T-003','W-003','MEDIUM'), ROW('T-003','W-060','MEDIUM'),
  ROW('T-005','W-001','HIGH'),
  ROW('T-006','W-044','HIGH'),
  ROW('T-010','W-022','HIGH'), ROW('T-010','W-050','HIGH'), ROW('T-010','W-030','HIGH'),
  ROW('T-010','W-010','MEDIUM'), ROW('T-010','W-029','MEDIUM'),
  ROW('T-011','W-030','HIGH'), ROW('T-011','W-029','HIGH'), ROW('T-011','W-020','MEDIUM'),
  ROW('T-012','W-030','HIGH'), ROW('T-012','W-029','HIGH'),
  ROW('T-013','W-030','HIGH'), ROW('T-013','W-031','MEDIUM'),
  ROW('T-014','W-022','HIGH'), ROW('T-014','W-030','MEDIUM'), ROW('T-014','W-010','MEDIUM'),
  ROW('T-015','W-020','HIGH'), ROW('T-015','W-021','HIGH'), ROW('T-015','W-029','HIGH'),
  ROW('T-015','W-034','MEDIUM'),
  ROW('T-016','W-024','HIGH'), ROW('T-016','W-023','MEDIUM'), ROW('T-016','W-027','MEDIUM'),
  ROW('T-017','W-024','HIGH'), ROW('T-017','W-026','MEDIUM'),
  ROW('T-018','W-013','HIGH'), ROW('T-018','W-015','HIGH'), ROW('T-018','W-014','MEDIUM'),
  ROW('T-019','W-022','HIGH'), ROW('T-019','W-012','HIGH'), ROW('T-019','W-027','HIGH'),
  ROW('T-019','W-010','MEDIUM'),
  ROW('T-020','W-004','HIGH'), ROW('T-020','W-041','HIGH'), ROW('T-020','W-042','MEDIUM'),
  ROW('T-021','W-041','HIGH'), ROW('T-021','W-042','HIGH'), ROW('T-021','W-043','MEDIUM'),
  ROW('T-022','W-028','HIGH'), ROW('T-022','W-027','HIGH'), ROW('T-022','W-053','MEDIUM'),
  ROW('T-022','W-063','MEDIUM'),
  ROW('T-030','W-023','HIGH'), ROW('T-030','W-052','HIGH'), ROW('T-030','W-027','MEDIUM'),
  ROW('T-031','W-050','HIGH'), ROW('T-031','W-051','HIGH'), ROW('T-031','W-028','MEDIUM'),
  ROW('T-032','W-052','HIGH'),
  ROW('T-033','W-030','HIGH'), ROW('T-033','W-062','HIGH'), ROW('T-033','W-061','MEDIUM'),
  ROW('T-040','W-028','HIGH'), ROW('T-040','W-062','HIGH'), ROW('T-040','W-027','HIGH'),
  ROW('T-040','W-032','MEDIUM'),
  ROW('T-041','W-062','HIGH'), ROW('T-041','W-065','HIGH'),
  ROW('T-042','W-040','HIGH'), ROW('T-042','W-041','HIGH'),
  ROW('T-050','W-060','HIGH'), ROW('T-050','W-033','MEDIUM'),
  ROW('T-051','W-030','HIGH'),
  ROW('T-060','W-010','HIGH'), ROW('T-060','W-003','HIGH'),
  ROW('T-061','W-003','HIGH'), ROW('T-061','W-001','HIGH'),
  ROW('T-062','W-050','HIGH'), ROW('T-062','W-051','HIGH'),
  ROW('T-063','W-003','HIGH'), ROW('T-063','W-010','MEDIUM'),
  ROW('T-064','W-052','HIGH'), ROW('T-064','W-022','MEDIUM'),
  ROW('T-065','W-052','MEDIUM'),
  ROW('T-070','W-062','HIGH'), ROW('T-070','W-061','HIGH'), ROW('T-070','W-025','MEDIUM'),
  ROW('T-071','W-065','HIGH'),
  ROW('T-072','W-065','HIGH'), ROW('T-072','W-022','MEDIUM'),
  ROW('T-080','W-014','HIGH'),
  ROW('T-081','W-028','HIGH'), ROW('T-081','W-023','HIGH'),
  ROW('T-082','W-022','HIGH'), ROW('T-082','W-012','HIGH')
) AS v(t_ref, w_ref, relevance)
JOIN threat_catalog t ON t.ref_id = v.t_ref
JOIN weakness_catalog w ON w.ref_id = v.w_ref;


-- ═══════════════════════════════════════════════════════════════════
-- 2. THREAT ↔ CONTROL (65 korelacji)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO threat_control_link (threat_id, control_id, effectiveness, is_system)
SELECT t.id, c.id, v.effectiveness, 1
FROM (VALUES
  ROW('T-001','C-043','HIGH'), ROW('T-001','C-060','HIGH'), ROW('T-001','C-050','MEDIUM'),
  ROW('T-002','C-044','HIGH'), ROW('T-002','C-060','HIGH'),
  ROW('T-003','C-001','HIGH'), ROW('T-003','C-002','MEDIUM'), ROW('T-003','C-060','MEDIUM'),
  ROW('T-005','C-001','HIGH'),
  ROW('T-006','C-044','HIGH'),
  ROW('T-010','C-050','HIGH'), ROW('T-010','C-075','HIGH'), ROW('T-010','C-073','HIGH'),
  ROW('T-010','C-010','MEDIUM'), ROW('T-010','C-030','MEDIUM'),
  ROW('T-011','C-030','HIGH'), ROW('T-011','C-031','HIGH'), ROW('T-011','C-020','HIGH'),
  ROW('T-011','C-075','MEDIUM'),
  ROW('T-012','C-030','HIGH'), ROW('T-012','C-020','HIGH'),
  ROW('T-013','C-030','HIGH'), ROW('T-013','C-032','MEDIUM'),
  ROW('T-014','C-075','HIGH'), ROW('T-014','C-073','HIGH'), ROW('T-014','C-010','MEDIUM'),
  ROW('T-015','C-020','HIGH'), ROW('T-015','C-022','HIGH'), ROW('T-015','C-021','MEDIUM'),
  ROW('T-015','C-070','MEDIUM'),
  ROW('T-016','C-074','HIGH'), ROW('T-016','C-072','MEDIUM'),
  ROW('T-017','C-074','HIGH'),
  ROW('T-018','C-012','HIGH'), ROW('T-018','C-013','HIGH'),
  ROW('T-019','C-070','HIGH'), ROW('T-019','C-011','HIGH'), ROW('T-019','C-073','HIGH'),
  ROW('T-019','C-010','MEDIUM'),
  ROW('T-020','C-003','HIGH'), ROW('T-020','C-041','HIGH'), ROW('T-020','C-042','MEDIUM'),
  ROW('T-021','C-041','HIGH'), ROW('T-021','C-042','HIGH'),
  ROW('T-022','C-024','HIGH'), ROW('T-022','C-070','HIGH'), ROW('T-022','C-025','MEDIUM'),
  ROW('T-030','C-052','HIGH'), ROW('T-030','C-070','MEDIUM'),
  ROW('T-031','C-050','HIGH'), ROW('T-031','C-051','HIGH'), ROW('T-031','C-024','MEDIUM'),
  ROW('T-032','C-052','HIGH'),
  ROW('T-033','C-062','HIGH'), ROW('T-033','C-071','HIGH'), ROW('T-033','C-030','MEDIUM'),
  ROW('T-040','C-071','HIGH'), ROW('T-040','C-024','HIGH'), ROW('T-040','C-070','HIGH'),
  ROW('T-040','C-025','MEDIUM'),
  ROW('T-041','C-062','HIGH'), ROW('T-041','C-071','HIGH'),
  ROW('T-042','C-040','HIGH'), ROW('T-042','C-041','HIGH'),
  ROW('T-050','C-060','HIGH'),
  ROW('T-051','C-030','HIGH'),
  ROW('T-060','C-010','HIGH'), ROW('T-060','C-002','HIGH'),
  ROW('T-061','C-002','HIGH'), ROW('T-061','C-001','HIGH'),
  ROW('T-062','C-050','HIGH'), ROW('T-062','C-051','HIGH'),
  ROW('T-063','C-002','HIGH'), ROW('T-063','C-010','MEDIUM'),
  ROW('T-064','C-052','HIGH'), ROW('T-064','C-073','MEDIUM'),
  ROW('T-065','C-076','HIGH'),
  ROW('T-070','C-062','HIGH'), ROW('T-070','C-061','HIGH'),
  ROW('T-072','C-072','HIGH'), ROW('T-072','C-073','HIGH'),
  ROW('T-080','C-014','HIGH'),
  ROW('T-081','C-024','HIGH'), ROW('T-081','C-023','HIGH'),
  ROW('T-082','C-072','HIGH'), ROW('T-082','C-011','HIGH')
) AS v(t_ref, c_ref, effectiveness)
JOIN threat_catalog t ON t.ref_id = v.t_ref
JOIN control_catalog c ON c.ref_id = v.c_ref;


-- ═══════════════════════════════════════════════════════════════════
-- 3. WEAKNESS ↔ CONTROL (48 korelacji)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO weakness_control_link (weakness_id, control_id, effectiveness, is_system)
SELECT w.id, c.id, v.effectiveness, 1
FROM (VALUES
  ROW('W-001','C-001','HIGH'),
  ROW('W-002','C-073','HIGH'),
  ROW('W-003','C-002','HIGH'),
  ROW('W-004','C-003','HIGH'),
  ROW('W-010','C-010','HIGH'),
  ROW('W-011','C-072','HIGH'), ROW('W-011','C-010','MEDIUM'),
  ROW('W-012','C-011','HIGH'),
  ROW('W-013','C-012','HIGH'),
  ROW('W-014','C-014','HIGH'),
  ROW('W-015','C-013','HIGH'),
  ROW('W-020','C-021','HIGH'), ROW('W-020','C-020','HIGH'),
  ROW('W-021','C-022','HIGH'),
  ROW('W-022','C-073','HIGH'), ROW('W-022','C-072','MEDIUM'),
  ROW('W-023','C-052','HIGH'), ROW('W-023','C-072','MEDIUM'),
  ROW('W-024','C-074','HIGH'),
  ROW('W-025','C-003','HIGH'), ROW('W-025','C-012','MEDIUM'),
  ROW('W-026','C-020','HIGH'),
  ROW('W-027','C-070','HIGH'),
  ROW('W-028','C-024','HIGH'), ROW('W-028','C-025','HIGH'), ROW('W-028','C-023','MEDIUM'),
  ROW('W-029','C-020','HIGH'),
  ROW('W-030','C-030','HIGH'), ROW('W-030','C-031','MEDIUM'),
  ROW('W-031','C-032','MEDIUM'),
  ROW('W-032','C-032','HIGH'),
  ROW('W-033','C-023','HIGH'), ROW('W-033','C-024','MEDIUM'),
  ROW('W-034','C-070','HIGH'),
  ROW('W-040','C-040','HIGH'),
  ROW('W-041','C-041','HIGH'),
  ROW('W-042','C-042','HIGH'),
  ROW('W-043','C-043','HIGH'),
  ROW('W-044','C-044','HIGH'),
  ROW('W-050','C-050','HIGH'),
  ROW('W-051','C-051','HIGH'),
  ROW('W-052','C-052','HIGH'),
  ROW('W-053','C-053','HIGH'),
  ROW('W-060','C-060','HIGH'),
  ROW('W-061','C-061','HIGH'),
  ROW('W-062','C-062','HIGH'),
  ROW('W-063','C-025','HIGH'),
  ROW('W-065','C-061','MEDIUM')
) AS v(w_ref, c_ref, effectiveness)
JOIN weakness_catalog w ON w.ref_id = v.w_ref
JOIN control_catalog c ON c.ref_id = v.c_ref;


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
