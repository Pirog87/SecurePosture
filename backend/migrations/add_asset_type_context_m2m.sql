-- ═══════════════════════════════════════════════════════════════
-- Kontekstowe zagrożenia / podatności / zabezpieczenia
-- Powiązanie z typem aktywa + relacje M2M z ryzykami
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Dodaj asset_type_id do tabel katalogowych ──
ALTER TABLE threats ADD COLUMN asset_type_id INT NULL AFTER category_id;
ALTER TABLE vulnerabilities ADD COLUMN asset_type_id INT NULL AFTER security_area_id;
ALTER TABLE safeguards ADD COLUMN asset_type_id INT NULL AFTER type_id;

-- ── 2. Nowe tabele junction: risk_threats, risk_vulnerabilities ──
CREATE TABLE IF NOT EXISTS risk_threats (
  risk_id INT NOT NULL,
  threat_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (risk_id, threat_id),
  CONSTRAINT fk_rt_risk FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE,
  CONSTRAINT fk_rt_threat FOREIGN KEY (threat_id) REFERENCES threats(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS risk_vulnerabilities (
  risk_id INT NOT NULL,
  vulnerability_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (risk_id, vulnerability_id),
  CONSTRAINT fk_rv_risk FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE,
  CONSTRAINT fk_rv_vuln FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Migracja istniejących danych do M2M ──
INSERT IGNORE INTO risk_threats (risk_id, threat_id)
SELECT id, threat_id FROM risks WHERE threat_id IS NOT NULL;

INSERT IGNORE INTO risk_vulnerabilities (risk_id, vulnerability_id)
SELECT id, vulnerability_id FROM risks WHERE vulnerability_id IS NOT NULL;

-- ── 4. Usunięcie starych kolumn FK z risks ──
ALTER TABLE risks DROP FOREIGN KEY IF EXISTS risks_ibfk_3;
ALTER TABLE risks DROP COLUMN IF EXISTS threat_id;
ALTER TABLE risks DROP FOREIGN KEY IF EXISTS risks_ibfk_4;
ALTER TABLE risks DROP COLUMN IF EXISTS vulnerability_id;
ALTER TABLE risks DROP COLUMN IF EXISTS control_effectiveness_id;
