-- ═══════════════════════════════════════════════════════════
-- Migration: Security Areas → Security Domains
-- Run steps 1-5 in phpMyAdmin SQL tab, one at a time
-- ═══════════════════════════════════════════════════════════

-- ─── KROK 1: Rename table security_areas → security_domains ───
ALTER TABLE security_areas RENAME TO security_domains;

-- ─── KROK 2: Add new columns to security_domains ───
ALTER TABLE security_domains
  ADD COLUMN icon VARCHAR(50) DEFAULT NULL AFTER description,
  ADD COLUMN color VARCHAR(30) DEFAULT NULL AFTER icon,
  ADD COLUMN owner VARCHAR(200) DEFAULT NULL AFTER color;

-- ─── KROK 3: Create domain_cis_controls mapping table ───
CREATE TABLE domain_cis_controls (
  domain_id INT NOT NULL,
  cis_control_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (domain_id, cis_control_id),
  CONSTRAINT fk_dcc_domain FOREIGN KEY (domain_id) REFERENCES security_domains(id) ON DELETE CASCADE,
  CONSTRAINT fk_dcc_cis FOREIGN KEY (cis_control_id) REFERENCES cis_controls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── KROK 4: Update FKs on risks and vulnerabilities ───
-- First drop old FKs, then recreate pointing to security_domains
-- (Find your FK names with: SHOW CREATE TABLE risks; / SHOW CREATE TABLE vulnerabilities;)
-- Replace 'risks_ibfk_X' / 'vulnerabilities_ibfk_X' with your actual FK names

-- 4a: risks table
ALTER TABLE risks DROP FOREIGN KEY risks_ibfk_6;
ALTER TABLE risks ADD CONSTRAINT fk_risk_domain
  FOREIGN KEY (security_area_id) REFERENCES security_domains(id);

-- 4b: vulnerabilities table
ALTER TABLE vulnerabilities DROP FOREIGN KEY vulnerabilities_ibfk_1;
ALTER TABLE vulnerabilities ADD CONSTRAINT fk_vuln_domain
  FOREIGN KEY (security_area_id) REFERENCES security_domains(id);

-- ─── KROK 5: Seed default domains with CIS mappings ───
-- Basic domains covering CIS 18 controls + custom ones
INSERT INTO security_domains (name, description, icon, color, sort_order) VALUES
('Inwentaryzacja i kontrola aktywow', 'Zarzadzanie aktywami sprzetowymi i programowymi', 'monitor', '#3b82f6', 1),
('Ochrona danych', 'Klasyfikacja, ochrona i zarzadzanie danymi', 'database', '#8b5cf6', 2),
('Bezpieczna konfiguracja', 'Konfiguracja bezpieczenstwa systemow i oprogramowania', 'settings', '#06b6d4', 3),
('Zarzadzanie kontami i dostepem', 'Kontrola dostepu i zarzadzanie kontami', 'users', '#f59e0b', 4),
('Zarzadzanie podatnosciami', 'Wykrywanie i usuwanie podatnosci', 'shield-alert', '#ef4444', 5),
('Zarzadzanie logami i audyt', 'Gromadzenie i analiza logow', 'file-text', '#22c55e', 6),
('Ochrona poczty i przegladarek', 'Bezpieczenstwo poczty elektronicznej i przegladania', 'mail', '#f97316', 7),
('Ochrona przed malware', 'Zabezpieczenia przed zlosliwym oprogramowaniem', 'bug', '#dc2626', 8),
('Bezpieczenstwo sieci', 'Monitoring i ochrona infrastruktury sieciowej', 'wifi', '#0ea5e9', 9),
('Odzyskiwanie danych', 'Kopie zapasowe i odzyskiwanie po awarii', 'hard-drive', '#64748b', 10),
('Bezpieczenstwo fizyczne', 'Ochrona fizyczna obiektow i infrastruktury', 'building', '#78716c', 11),
('Zgodnosc i regulacje', 'Zgodnosc z przepisami i regulacjami branżowymi', 'scale', '#a855f7', 12),
('Ciaglosc dzialania', 'Planowanie ciaglosci dzialania organizacji', 'activity', '#14b8a6', 13),
('Swiadomosc i szkolenia', 'Programy swiadomosci bezpieczenstwa', 'graduation-cap', '#eab308', 14),
('Zarzadzanie incydentami', 'Reagowanie na incydenty bezpieczenstwa', 'alert-triangle', '#e11d48', 15);

-- ─── KROK 5b: Map CIS controls to domains ───
-- CIS 1,2 → Inwentaryzacja aktywow (domain 1)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 1), id FROM cis_controls WHERE control_number IN (1, 2);

-- CIS 3 → Ochrona danych (domain 2)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 2), id FROM cis_controls WHERE control_number = 3;

-- CIS 4 → Bezpieczna konfiguracja (domain 3)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 3), id FROM cis_controls WHERE control_number = 4;

-- CIS 5,6 → Zarzadzanie kontami (domain 4)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 4), id FROM cis_controls WHERE control_number IN (5, 6);

-- CIS 7 → Zarzadzanie podatnosciami (domain 5)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 5), id FROM cis_controls WHERE control_number = 7;

-- CIS 8 → Zarzadzanie logami (domain 6)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 6), id FROM cis_controls WHERE control_number = 8;

-- CIS 9 → Poczta i przegladarki (domain 7)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 7), id FROM cis_controls WHERE control_number = 9;

-- CIS 10 → Ochrona przed malware (domain 8)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 8), id FROM cis_controls WHERE control_number = 10;

-- CIS 11,12,13 → Bezpieczenstwo sieci (domain 9)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 9), id FROM cis_controls WHERE control_number IN (11, 12, 13);

-- CIS 11 (also) → Odzyskiwanie danych (domain 10)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 10), id FROM cis_controls WHERE control_number = 11;

-- CIS 14 → Swiadomosc i szkolenia (domain 14)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 14), id FROM cis_controls WHERE control_number = 14;

-- CIS 15,16 → Bezpieczenstwo sieci (domain 9) — additional
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 9), id FROM cis_controls WHERE control_number IN (15, 16);

-- CIS 17 → Zarzadzanie incydentami (domain 15)
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 15), id FROM cis_controls WHERE control_number = 17;

-- CIS 18 → Zarzadzanie podatnosciami (domain 5) — penetration testing
INSERT INTO domain_cis_controls (domain_id, cis_control_id)
SELECT (SELECT id FROM security_domains WHERE sort_order = 5), id FROM cis_controls WHERE control_number = 18;
