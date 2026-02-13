-- ============================================================
-- Smart Catalog — MariaDB migration + seed data
-- Run: mysql -u root -p secureposture < 013_smart_catalog_mariadb.sql
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. threat_catalog ──
CREATE TABLE IF NOT EXISTS `threat_catalog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ref_id` VARCHAR(20) NOT NULL,
  `name` VARCHAR(300) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(30) NOT NULL COMMENT 'NATURAL|ENVIRONMENTAL|HUMAN_INTENTIONAL|HUMAN_ACCIDENTAL|TECHNICAL|ORGANIZATIONAL',
  `source` VARCHAR(15) NOT NULL DEFAULT 'BOTH' COMMENT 'INTERNAL|EXTERNAL|BOTH',
  `cia_impact` JSON DEFAULT NULL COMMENT '{"C":true,"I":false,"A":true}',
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `org_unit_id` INT DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_threat_ref_org` (`ref_id`, `org_unit_id`),
  KEY `idx_threat_category` (`category`),
  KEY `idx_threat_active` (`is_active`),
  CONSTRAINT `fk_threat_org` FOREIGN KEY (`org_unit_id`) REFERENCES `org_units`(`id`),
  CONSTRAINT `fk_threat_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. weakness_catalog ──
CREATE TABLE IF NOT EXISTS `weakness_catalog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ref_id` VARCHAR(20) NOT NULL,
  `name` VARCHAR(300) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(20) NOT NULL COMMENT 'HARDWARE|SOFTWARE|NETWORK|PERSONNEL|SITE|ORGANIZATION|PROCESS',
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `org_unit_id` INT DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_weakness_ref_org` (`ref_id`, `org_unit_id`),
  KEY `idx_weakness_category` (`category`),
  KEY `idx_weakness_active` (`is_active`),
  CONSTRAINT `fk_weakness_org` FOREIGN KEY (`org_unit_id`) REFERENCES `org_units`(`id`),
  CONSTRAINT `fk_weakness_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. control_catalog ──
CREATE TABLE IF NOT EXISTS `control_catalog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ref_id` VARCHAR(20) NOT NULL,
  `name` VARCHAR(300) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(20) NOT NULL COMMENT 'TECHNICAL|ORGANIZATIONAL|PHYSICAL|LEGAL',
  `implementation_type` VARCHAR(20) NOT NULL COMMENT 'PREVENTIVE|DETECTIVE|CORRECTIVE|DETERRENT|COMPENSATING',
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `org_unit_id` INT DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_control_ref_org` (`ref_id`, `org_unit_id`),
  KEY `idx_control_category` (`category`),
  KEY `idx_control_impl` (`implementation_type`),
  KEY `idx_control_active` (`is_active`),
  CONSTRAINT `fk_control_org` FOREIGN KEY (`org_unit_id`) REFERENCES `org_units`(`id`),
  CONSTRAINT `fk_control_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. M2M: catalog ↔ asset_category ──
CREATE TABLE IF NOT EXISTS `threat_asset_category` (
  `threat_id` INT NOT NULL,
  `asset_category_id` INT NOT NULL,
  PRIMARY KEY (`threat_id`, `asset_category_id`),
  CONSTRAINT `fk_tac_threat` FOREIGN KEY (`threat_id`) REFERENCES `threat_catalog`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tac_cat` FOREIGN KEY (`asset_category_id`) REFERENCES `asset_categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `weakness_asset_category` (
  `weakness_id` INT NOT NULL,
  `asset_category_id` INT NOT NULL,
  PRIMARY KEY (`weakness_id`, `asset_category_id`),
  CONSTRAINT `fk_wac_weakness` FOREIGN KEY (`weakness_id`) REFERENCES `weakness_catalog`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wac_cat` FOREIGN KEY (`asset_category_id`) REFERENCES `asset_categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `control_catalog_asset_category` (
  `control_id` INT NOT NULL,
  `asset_category_id` INT NOT NULL,
  PRIMARY KEY (`control_id`, `asset_category_id`),
  CONSTRAINT `fk_ccac_control` FOREIGN KEY (`control_id`) REFERENCES `control_catalog`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ccac_cat` FOREIGN KEY (`asset_category_id`) REFERENCES `asset_categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. Correlation link tables ──
CREATE TABLE IF NOT EXISTS `threat_weakness_link` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `threat_id` INT NOT NULL,
  `weakness_id` INT NOT NULL,
  `relevance` VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' COMMENT 'HIGH|MEDIUM|LOW',
  `description` TEXT,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_threat_weakness` (`threat_id`, `weakness_id`),
  CONSTRAINT `fk_twl_threat` FOREIGN KEY (`threat_id`) REFERENCES `threat_catalog`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_twl_weakness` FOREIGN KEY (`weakness_id`) REFERENCES `weakness_catalog`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_twl_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `threat_control_link` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `threat_id` INT NOT NULL,
  `control_id` INT NOT NULL,
  `effectiveness` VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' COMMENT 'HIGH|MEDIUM|LOW',
  `description` TEXT,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_threat_control` (`threat_id`, `control_id`),
  CONSTRAINT `fk_tcl_threat` FOREIGN KEY (`threat_id`) REFERENCES `threat_catalog`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tcl_control` FOREIGN KEY (`control_id`) REFERENCES `control_catalog`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tcl_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `weakness_control_link` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `weakness_id` INT NOT NULL,
  `control_id` INT NOT NULL,
  `effectiveness` VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' COMMENT 'HIGH|MEDIUM|LOW',
  `description` TEXT,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_weakness_control` (`weakness_id`, `control_id`),
  CONSTRAINT `fk_wcl_weakness` FOREIGN KEY (`weakness_id`) REFERENCES `weakness_catalog`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wcl_control` FOREIGN KEY (`control_id`) REFERENCES `control_catalog`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wcl_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. AI Provider Config ──
CREATE TABLE IF NOT EXISTS `ai_provider_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_unit_id` INT DEFAULT NULL,
  `provider_type` VARCHAR(20) NOT NULL DEFAULT 'none' COMMENT 'none|anthropic|openai_compatible',
  `api_endpoint` VARCHAR(500) DEFAULT NULL,
  `api_key_encrypted` BLOB DEFAULT NULL,
  `model_name` VARCHAR(100) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0,
  `max_tokens` INT NOT NULL DEFAULT 4000,
  `temperature` DECIMAL(3,2) NOT NULL DEFAULT 0.30,
  `max_requests_per_user_per_hour` INT NOT NULL DEFAULT 20,
  `max_requests_per_user_per_day` INT NOT NULL DEFAULT 100,
  `max_requests_per_org_per_day` INT NOT NULL DEFAULT 500,
  `feature_scenario_generation` TINYINT(1) NOT NULL DEFAULT 1,
  `feature_correlation_enrichment` TINYINT(1) NOT NULL DEFAULT 1,
  `feature_natural_language_search` TINYINT(1) NOT NULL DEFAULT 1,
  `feature_gap_analysis` TINYINT(1) NOT NULL DEFAULT 1,
  `feature_entry_assist` TINYINT(1) NOT NULL DEFAULT 1,
  `last_test_at` DATETIME DEFAULT NULL,
  `last_test_ok` TINYINT(1) DEFAULT NULL,
  `last_test_error` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` INT DEFAULT NULL,
  CONSTRAINT `fk_aiconf_org` FOREIGN KEY (`org_unit_id`) REFERENCES `org_units`(`id`),
  CONSTRAINT `fk_aiconf_user` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 7. AI Audit Log ──
CREATE TABLE IF NOT EXISTS `ai_audit_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `org_unit_id` INT DEFAULT NULL,
  `action_type` VARCHAR(30) NOT NULL COMMENT 'SCENARIO_GEN|ENRICHMENT|SEARCH|GAP_ANALYSIS|ASSIST|TEST_CONNECTION',
  `provider_type` VARCHAR(20) NOT NULL,
  `model_used` VARCHAR(100) NOT NULL,
  `input_summary` TEXT,
  `output_summary` TEXT,
  `tokens_input` INT DEFAULT NULL,
  `tokens_output` INT DEFAULT NULL,
  `cost_usd` DECIMAL(10,6) DEFAULT NULL,
  `accepted` TINYINT(1) DEFAULT NULL,
  `duration_ms` INT DEFAULT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 1,
  `error` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_ailog_user` (`user_id`),
  KEY `idx_ailog_date` (`created_at`),
  CONSTRAINT `fk_ailog_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_ailog_org` FOREIGN KEY (`org_unit_id`) REFERENCES `org_units`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEED DATA: THREATS (42)
-- ============================================================

INSERT IGNORE INTO `threat_catalog` (`ref_id`, `name`, `description`, `category`, `source`, `cia_impact`, `is_system`) VALUES
('T-001','Pozar','Pozar w budynku lub serwerowni powodujacy zniszczenie infrastruktury','ENVIRONMENTAL','EXTERNAL','{"C":false,"I":false,"A":true}',1),
('T-002','Powodz / zalanie','Zalanie pomieszczen woda z powodu awarii lub zdarzen naturalnych','ENVIRONMENTAL','EXTERNAL','{"C":false,"I":false,"A":true}',1),
('T-003','Awaria zasilania','Dlugotrawala przerwa w dostawie energii elektrycznej','TECHNICAL','EXTERNAL','{"C":false,"I":false,"A":true}',1),
('T-004','Trzesienie ziemi','Uszkodzenia infrastruktury spowodowane trzesieniem ziemi','NATURAL','EXTERNAL','{"C":false,"I":false,"A":true}',1),
('T-005','Wyladowania atmosferyczne','Uszkodzenia sprzetu spowodowane uderzeniem pioruna','NATURAL','EXTERNAL','{"C":false,"I":false,"A":true}',1),
('T-006','Ekstremalne temperatury','Przegrzanie lub przemrozenie sprzetu IT','ENVIRONMENTAL','EXTERNAL','{"C":false,"I":false,"A":true}',1),
('T-010','Ransomware','Zlosliwe oprogramowanie szyfrujace dane i zadajace okupu','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":true}',1),
('T-011','Phishing','Wyludzanie poswiadczen lub danych przez falszywe komunikaty','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":false}',1),
('T-012','Spear phishing','Ukierunkowany atak phishingowy na kluczowe osoby','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":false}',1),
('T-013','Social engineering','Manipulacja psychologiczna w celu uzyskania dostepu lub informacji','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":false}',1),
('T-014','Malware (ogolny)','Wirusy, trojany, robaki i inne zlosliwe oprogramowanie','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":true}',1),
('T-015','Atak brute-force','Proba odgadniecia hasla przez systematyczne probowanie kombinacji','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":false}',1),
('T-016','SQL Injection','Wstrzykniecie zlosliwego kodu SQL do aplikacji','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":true}',1),
('T-017','Cross-Site Scripting (XSS)','Wstrzykniecie zlosliwego skryptu do aplikacji webowej','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":false}',1),
('T-018','Atak man-in-the-middle','Przejecie komunikacji miedzy dwoma stronami','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":false}',1),
('T-019','Advanced Persistent Threat (APT)','Zaawansowany, dlugotrawaly atak ukierunkowany','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":true}',1),
('T-020','Kradziez sprzetu','Kradziez laptopow, telefonow, nosnikow danych','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":false,"A":true}',1),
('T-021','Wlamanie fizyczne','Nieuprawniony dostep fizyczny do pomieszczen','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":true}',1),
('T-022','Sabotaz wewnetrzny','Celowe dzialanie pracownika na szkode organizacji','HUMAN_INTENTIONAL','INTERNAL','{"C":true,"I":true,"A":true}',1),
('T-030','Blad konfiguracji','Nieprawidlowa konfiguracja systemu lub aplikacji','HUMAN_ACCIDENTAL','INTERNAL','{"C":true,"I":true,"A":true}',1),
('T-031','Przypadkowe usuniecie danych','Niezamierzone skasowanie waznych danych','HUMAN_ACCIDENTAL','INTERNAL','{"C":false,"I":true,"A":true}',1),
('T-032','Bledne wdrozenie','Wdrozenie wadliwej wersji oprogramowania na produkcje','HUMAN_ACCIDENTAL','INTERNAL','{"C":false,"I":true,"A":true}',1),
('T-033','Wyciek danych przez niedbalstwo','Przypadkowe ujawnienie poufnych informacji','HUMAN_ACCIDENTAL','INTERNAL','{"C":true,"I":false,"A":false}',1),
('T-040','Wyciek danych przez pracownika','Celowe wyniesienie poufnych danych przez pracownika','HUMAN_INTENTIONAL','INTERNAL','{"C":true,"I":false,"A":false}',1),
('T-041','Kradziez wlasnosci intelektualnej','Kradziez tajemnic handlowych lub wlasnosci intelektualnej','HUMAN_INTENTIONAL','BOTH','{"C":true,"I":false,"A":false}',1),
('T-042','Kradziez dokumentacji papierowej','Kradziez lub skopiowanie dokumentow fizycznych','HUMAN_INTENTIONAL','BOTH','{"C":true,"I":false,"A":true}',1),
('T-050','Utrata kluczowego pracownika','Odejscie pracownika z unikalna wiedza lub uprawnieniami','ORGANIZATIONAL','INTERNAL','{"C":false,"I":false,"A":true}',1),
('T-051','Brak kompetencji personelu','Niewystarczajace umiejetnosci techniczne lub bezpieczenstwa','ORGANIZATIONAL','INTERNAL','{"C":true,"I":true,"A":true}',1),
('T-060','Atak DDoS','Atak odmowy uslugi paralizujacy serwisy','HUMAN_INTENTIONAL','EXTERNAL','{"C":false,"I":false,"A":true}',1),
('T-061','Awaria sprzetowa','Fizyczna awaria serwera, dysku, zasilacza','TECHNICAL','INTERNAL','{"C":false,"I":false,"A":true}',1),
('T-062','Awaria dysku / utrata danych','Uszkodzenie nosnika danych prowadzace do utraty informacji','TECHNICAL','INTERNAL','{"C":false,"I":true,"A":true}',1),
('T-063','Awaria sieci','Przerwa w dzialaniu infrastruktury sieciowej','TECHNICAL','INTERNAL','{"C":false,"I":false,"A":true}',1),
('T-064','Blad oprogramowania','Krytyczny blad w oprogramowaniu (bug) prowadzacy do awarii','TECHNICAL','INTERNAL','{"C":false,"I":true,"A":true}',1),
('T-065','Wygasniecie certyfikatu SSL/TLS','Nieodnowiony certyfikat powodujacy przerwy w usludze','TECHNICAL','INTERNAL','{"C":false,"I":true,"A":true}',1),
('T-070','Naruszenie przepisow (RODO/GDPR)','Niezgodnosc z regulacjami ochrony danych osobowych','ORGANIZATIONAL','INTERNAL','{"C":true,"I":false,"A":false}',1),
('T-071','Uzaleznienie od dostawcy (vendor lock-in)','Nadmierna zaleznosc od jednego dostawcy technologii','ORGANIZATIONAL','EXTERNAL','{"C":false,"I":false,"A":true}',1),
('T-072','Atak na lancuch dostaw','Kompromitacja oprogramowania lub uslug dostawcy','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":true}',1),
('T-080','Nieautoryzowany dostep do Wi-Fi','Podlaczenie do sieci bezprzewodowej przez nieuprawniona osobe','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":false}',1),
('T-081','Eskalacja uprawnien','Uzyskanie wyzszych uprawnien niz przyznane','HUMAN_INTENTIONAL','BOTH','{"C":true,"I":true,"A":true}',1),
('T-082','Wykorzystanie podatnosci zero-day','Atak wykorzystujacy nieznana dotad podatnosc','HUMAN_INTENTIONAL','EXTERNAL','{"C":true,"I":true,"A":true}',1);

-- ============================================================
-- SEED DATA: WEAKNESSES (45)
-- ============================================================

INSERT IGNORE INTO `weakness_catalog` (`ref_id`, `name`, `description`, `category`, `is_system`) VALUES
('W-001','Brak redundancji zasilania (UPS)','Brak zasilania awaryjnego dla krytycznej infrastruktury','HARDWARE',1),
('W-002','Przestarzaly sprzet (EOL)','Sprzet po zakonczeniu wsparcia producenta','HARDWARE',1),
('W-003','Brak redundancji sprzetowej','Brak zapasowego sprzetu dla krytycznych systemow','HARDWARE',1),
('W-004','Brak szyfrowania dyskow','Dyski twarde bez szyfrowania (np. BitLocker, LUKS)','HARDWARE',1),
('W-010','Brak segmentacji sieci','Plaska architektura sieci bez podzialu na strefy','NETWORK',1),
('W-011','Otwarte niepotrzebne porty','Nadmiarowe otwarte porty sieciowe na serwerach','NETWORK',1),
('W-012','Brak systemu IDS/IPS','Brak wykrywania/zapobiegania wlamaniom','NETWORK',1),
('W-013','Brak szyfrowania transmisji','Komunikacja przesylana otwartym tekstem (bez TLS)','NETWORK',1),
('W-014','Niezabezpieczona siec Wi-Fi','Siec bezprzewodowa ze slabym lub domyslnym zabezpieczeniem','NETWORK',1),
('W-015','Brak VPN dla dostepu zdalnego','Dostep zdalny bez tunelu VPN','NETWORK',1),
('W-020','Brak polityki zlozonosci hasel','Hasla nie podlegaja wymogom zlozonosci i dlugosci','SOFTWARE',1),
('W-021','Brak blokady konta po N probach','Brak mechanizmu blokowania konta po nieudanych logowaniach','SOFTWARE',1),
('W-022','Niezalatane oprogramowanie','Brak regularnych aktualizacji bezpieczenstwa','SOFTWARE',1),
('W-023','Domyslna konfiguracja systemow','Systemy uzywane z domyslnymi ustawieniami producenta','SOFTWARE',1),
('W-024','Brak walidacji danych wejsciowych','Aplikacje nie waliduja danych od uzytkownikow','SOFTWARE',1),
('W-025','Brak szyfrowania danych w spoczynku','Dane wrazliwe przechowywane bez szyfrowania','SOFTWARE',1),
('W-026','Slabe zarzadzanie sesjami','Tokeny sesji bez wygasania, brak ochrony przed przejsciem','SOFTWARE',1),
('W-027','Brak logowania zdarzen bezpieczenstwa','Brak rejestrow zdarzen do celow audytu','SOFTWARE',1),
('W-028','Nadmierne uprawnienia uzytkownikow','Uzytkownicy maja szersze uprawnienia niz potrzebne','SOFTWARE',1),
('W-029','Brak MFA','Uwierzytelnianie tylko jednym czynnikiem (haslo)','SOFTWARE',1),
('W-030','Brak szkolenia awareness','Pracownicy nie przechodza szkolen z bezpieczenstwa','PERSONNEL',1),
('W-031','Brak weryfikacji pracownikow','Brak sprawdzania przeszlosci nowo zatrudnianych','PERSONNEL',1),
('W-032','Brak procedury odejscia pracownika','Brak procedury odbierania dostepow przy zwolnieniu','PERSONNEL',1),
('W-033','Wspoldzielenie kont','Wielu uzytkownikow korzysta z jednego konta','PERSONNEL',1),
('W-034','Brak monitoringu prob logowania','Nieudane logowania nie sa monitorowane ani alertowane','SOFTWARE',1),
('W-040','Brak zamykanych szaf na dokumenty','Dokumenty poufne przechowywane bez zabezpieczenia','SITE',1),
('W-041','Brak kontroli dostepu fizycznego','Brak systemu kontroli wejsc do pomieszczen','SITE',1),
('W-042','Brak monitoringu CCTV','Brak kamer bezpieczenstwa w krytycznych lokalizacjach','SITE',1),
('W-043','Brak ochrony przeciwpozarowej','Brak systemu gasniczego lub detekcji dymu','SITE',1),
('W-044','Brak kontroli srodowiskowej','Brak klimatyzacji lub monitorowania warunkow (temp, wilgotnosc)','SITE',1),
('W-050','Brak procedury backup','Brak regularnego tworzenia kopii zapasowych','PROCESS',1),
('W-051','Brak testowania odtwarzania z backupu','Kopie zapasowe nigdy nie sa testowane pod katem odtwarzalnosci','PROCESS',1),
('W-052','Brak procedury zarzadzania zmianami','Zmiany w systemach bez formalnego procesu zatwierdzania','PROCESS',1),
('W-053','Brak procedury reagowania na incydenty','Brak zdefiniowanego procesu obslugi incydentow','PROCESS',1),
('W-060','Brak planu ciaglości dzialania','Brak BCP/DRP dla krytycznych procesow','ORGANIZATION',1),
('W-061','Brak polityki bezpieczenstwa','Brak formalnej polityki bezpieczenstwa informacji','ORGANIZATION',1),
('W-062','Brak klasyfikacji informacji','Dane nie sa klasyfikowane wg poziomu poufnosci','ORGANIZATION',1),
('W-063','Brak przegladow uprawnien','Uprawnienia nie sa okresowo weryfikowane','ORGANIZATION',1),
('W-064','Brak polityki BYOD','Brak zasad korzystania z prywatnych urzadzen w pracy','ORGANIZATION',1),
('W-065','Brak umow NDA z dostawcami','Brak klauzul poufnosci z zewnetrznymi dostawcami','ORGANIZATION',1);

-- ============================================================
-- SEED DATA: CONTROLS (37)
-- ============================================================

INSERT IGNORE INTO `control_catalog` (`ref_id`, `name`, `description`, `category`, `implementation_type`, `is_system`) VALUES
('C-001','UPS i zasilanie awaryjne','Systemy zasilania awaryjnego UPS i agregaty pradotworcze','PHYSICAL','PREVENTIVE',1),
('C-002','Redundancja sprzetowa (HA)','Klastry wysokiej dostepnosci, zapasowe komponenty','TECHNICAL','PREVENTIVE',1),
('C-003','Szyfrowanie dyskow (FDE)','Pelne szyfrowanie dyskow BitLocker/LUKS/FileVault','TECHNICAL','PREVENTIVE',1),
('C-010','Segmentacja sieci (VLAN/FW)','Podzial sieci na strefy bezpieczenstwa z firewallami','TECHNICAL','PREVENTIVE',1),
('C-011','System IDS/IPS','Systemy wykrywania i zapobiegania wlamaniom','TECHNICAL','DETECTIVE',1),
('C-012','Szyfrowanie transmisji (TLS)','Wymuszanie szyfrowanej komunikacji TLS/SSL','TECHNICAL','PREVENTIVE',1),
('C-013','VPN dla dostepu zdalnego','Tunele VPN dla wszystkich polaczen zdalnych','TECHNICAL','PREVENTIVE',1),
('C-014','Zabezpieczenie sieci Wi-Fi (WPA3)','Silne szyfrowanie i uwierzytelnianie sieci bezprzewodowej','TECHNICAL','PREVENTIVE',1),
('C-020','Uwierzytelnianie wieloskladnikowe (MFA)','Wymuszenie drugiego skladnika uwierzytelniania','TECHNICAL','PREVENTIVE',1),
('C-021','Polityka zlozonosci i rotacji hasel','Wymogi dotyczace sily hasel i ich regularnej zmiany','ORGANIZATIONAL','PREVENTIVE',1),
('C-022','Automatyczna blokada konta','Blokowanie konta po kilku nieudanych probach logowania','TECHNICAL','PREVENTIVE',1),
('C-023','System zarzadzania tozsamoscia (IAM)','Centralny system zarzadzania kontami i uprawnieniami','TECHNICAL','PREVENTIVE',1),
('C-024','Zasada najmniejszych uprawnien (POLP)','Przyznawanie minimalnych uprawnien wymaganych do pracy','ORGANIZATIONAL','PREVENTIVE',1),
('C-025','Przeglady uprawnien (recertyfikacja)','Okresowa weryfikacja i aktualizacja uprawnien dostepowych','ORGANIZATIONAL','DETECTIVE',1),
('C-030','Program szkolenia awareness','Regularne szkolenia z bezpieczenstwa informacji dla pracownikow','ORGANIZATIONAL','PREVENTIVE',1),
('C-031','Symulacje phishingowe','Testowe kampanie phishingowe do oceny swiadomosci','ORGANIZATIONAL','DETECTIVE',1),
('C-032','Procedura offboardingu','Formalna procedura odbierania dostepow przy odejsciu','ORGANIZATIONAL','PREVENTIVE',1),
('C-040','Szafy zamykane na klucz/kod','Zabezpieczone szafy na dokumenty poufne','PHYSICAL','PREVENTIVE',1),
('C-041','System kontroli dostepu fizycznego','Karty, biometria lub kody PIN do wejscia','PHYSICAL','PREVENTIVE',1),
('C-042','Monitoring CCTV','Kamery bezpieczenstwa w krytycznych lokalizacjach','PHYSICAL','DETECTIVE',1),
('C-043','System gasniczy i detekcja dymu','Automatyczne systemy gasnicze i czujniki dymu','PHYSICAL','PREVENTIVE',1),
('C-044','Klimatyzacja i monitoring srodowiskowy','Systemy HVAC i czujniki temperatury/wilgotnosci','PHYSICAL','PREVENTIVE',1),
('C-050','Automatyczny backup (regula 3-2-1)','Regularne kopie zapasowe wg reguly 3-2-1','TECHNICAL','CORRECTIVE',1),
('C-051','Testowanie odtwarzania z backupu','Regularne testy przywracania danych z kopii zapasowych','ORGANIZATIONAL','DETECTIVE',1),
('C-052','Zarzadzanie zmianami (change management)','Formalny proces zatwierdzania i wdrazania zmian','ORGANIZATIONAL','PREVENTIVE',1),
('C-053','Plan reagowania na incydenty (IRP)','Zdefiniowany proces obslugi incydentow bezpieczenstwa','ORGANIZATIONAL','CORRECTIVE',1),
('C-060','Plan ciaglości dzialania (BCP/DRP)','Plany zapewnienia ciaglości i odtwarzania po awarii','ORGANIZATIONAL','CORRECTIVE',1),
('C-061','Polityka bezpieczenstwa informacji','Formalna, zatwierdzona polityka bezpieczenstwa','ORGANIZATIONAL','PREVENTIVE',1),
('C-062','Klasyfikacja informacji','System etykietowania danych wg poziomu poufnosci','ORGANIZATIONAL','PREVENTIVE',1),
('C-070','SIEM / monitoring logow','Centralne zbieranie i analiza logow bezpieczenstwa','TECHNICAL','DETECTIVE',1),
('C-071','System DLP (Data Loss Prevention)','Zapobieganie wyciekom danych przez monitorowanie kanalow','TECHNICAL','DETECTIVE',1),
('C-072','Skanowanie podatnosci','Regularne skanowanie infrastruktury pod katem podatnosci','TECHNICAL','DETECTIVE',1),
('C-073','Patch management','Proces regularnego aplikowania poprawek bezpieczenstwa','TECHNICAL','CORRECTIVE',1),
('C-074','WAF (Web Application Firewall)','Firewall warstwy aplikacji chroniacy aplikacje webowe','TECHNICAL','PREVENTIVE',1),
('C-075','Anti-malware / EDR','Ochrona antywirusowa i Endpoint Detection and Response','TECHNICAL','DETECTIVE',1),
('C-076','Zarzadzanie certyfikatami','Monitoring wygasania i automatyczne odnawianie certyfikatow','TECHNICAL','PREVENTIVE',1);

-- ============================================================
-- M2M: THREATS ↔ ASSET CATEGORIES
-- ============================================================

INSERT IGNORE INTO `threat_asset_category` (`threat_id`, `asset_category_id`)
SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-001' AND c.code IN ('servers','rooms','racks','documents','storage_media')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-002' AND c.code IN ('servers','rooms','racks','documents')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-003' AND c.code IN ('servers','network_devices','rooms','racks')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-004' AND c.code IN ('servers','rooms','locations')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-005' AND c.code IN ('servers','network_devices','rooms')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-006' AND c.code IN ('servers','rooms','racks')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-010' AND c.code IN ('servers','desktops','laptops','applications','databases','cloud_services')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-011' AND c.code IN ('desktops','laptops','mobile_devices','applications','employees','it_services')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-012' AND c.code IN ('employees','laptops','applications')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-013' AND c.code IN ('employees')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-014' AND c.code IN ('servers','desktops','laptops','mobile_devices','applications')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-015' AND c.code IN ('applications','databases','cloud_services','it_services')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-016' AND c.code IN ('applications','databases')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-017' AND c.code IN ('applications')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-018' AND c.code IN ('networks','network_devices','applications')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-019' AND c.code IN ('servers','applications','databases','employees')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-020' AND c.code IN ('laptops','mobile_devices','storage_media','rooms')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-021' AND c.code IN ('rooms','racks','servers','locations')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-022' AND c.code IN ('servers','databases','applications','employees')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-030' AND c.code IN ('servers','network_devices','applications','cloud_services','databases')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-031' AND c.code IN ('databases','datasets','documents','cloud_services')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-032' AND c.code IN ('applications','servers','cloud_services')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-033' AND c.code IN ('employees','datasets','documents','it_services')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-040' AND c.code IN ('databases','datasets','employees','it_services','documents')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-041' AND c.code IN ('datasets','documents','employees')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-042' AND c.code IN ('documents','rooms')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-050' AND c.code IN ('employees','teams')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-051' AND c.code IN ('employees','teams')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-060' AND c.code IN ('servers','network_devices','applications','cloud_services')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-061' AND c.code IN ('servers','network_devices','racks')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-062' AND c.code IN ('servers','databases','storage_media')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-063' AND c.code IN ('networks','network_devices')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-064' AND c.code IN ('applications','databases','information_systems')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-065' AND c.code IN ('applications','cloud_services','certificates')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-070' AND c.code IN ('datasets','applications','employees')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-071' AND c.code IN ('cloud_services','applications','ext_vendors')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-072' AND c.code IN ('applications','cloud_services','ext_vendors')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-080' AND c.code IN ('networks','network_devices')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-081' AND c.code IN ('servers','applications','databases')
UNION ALL SELECT t.id, c.id FROM threat_catalog t, asset_categories c WHERE t.ref_id='T-082' AND c.code IN ('servers','applications','network_devices');

-- ============================================================
-- M2M: WEAKNESSES ↔ ASSET CATEGORIES
-- ============================================================

INSERT IGNORE INTO `weakness_asset_category` (`weakness_id`, `asset_category_id`)
SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-001' AND c.code IN ('servers','network_devices','rooms','racks')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-002' AND c.code IN ('servers','desktops','network_devices')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-003' AND c.code IN ('servers','network_devices')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-004' AND c.code IN ('laptops','desktops','storage_media')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-010' AND c.code IN ('servers','network_devices','applications')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-011' AND c.code IN ('servers','network_devices')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-012' AND c.code IN ('networks','network_devices')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-013' AND c.code IN ('applications','networks','it_services')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-014' AND c.code IN ('networks','network_devices')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-015' AND c.code IN ('networks','applications')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-020' AND c.code IN ('applications','databases','cloud_services')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-021' AND c.code IN ('applications','databases','cloud_services')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-022' AND c.code IN ('servers','desktops','laptops','applications')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-023' AND c.code IN ('servers','network_devices','applications','databases')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-024' AND c.code IN ('applications')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-025' AND c.code IN ('databases','datasets','cloud_services')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-026' AND c.code IN ('applications')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-027' AND c.code IN ('servers','applications','databases')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-028' AND c.code IN ('servers','applications','databases','cloud_services')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-029' AND c.code IN ('applications','cloud_services','it_services')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-030' AND c.code IN ('employees','teams')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-031' AND c.code IN ('employees')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-032' AND c.code IN ('employees')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-033' AND c.code IN ('employees','applications')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-034' AND c.code IN ('applications','servers')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-040' AND c.code IN ('documents','rooms')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-041' AND c.code IN ('rooms','locations','racks')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-042' AND c.code IN ('rooms','locations')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-043' AND c.code IN ('rooms','racks')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-044' AND c.code IN ('rooms','racks')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-050' AND c.code IN ('servers','applications','databases','cloud_services')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-051' AND c.code IN ('servers','databases')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-052' AND c.code IN ('applications','servers','network_devices')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-053' AND c.code IN ('employees','teams')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-060' AND c.code IN ('servers','applications','rooms','employees')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-061' AND c.code IN ('employees','teams')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-062' AND c.code IN ('datasets','documents')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-063' AND c.code IN ('applications','databases','cloud_services')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-064' AND c.code IN ('mobile_devices','laptops')
UNION ALL SELECT w.id, c.id FROM weakness_catalog w, asset_categories c WHERE w.ref_id='W-065' AND c.code IN ('ext_vendors');

-- ============================================================
-- M2M: CONTROLS ↔ ASSET CATEGORIES
-- ============================================================

INSERT IGNORE INTO `control_catalog_asset_category` (`control_id`, `asset_category_id`)
SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-001' AND ac.code IN ('servers','network_devices','rooms','racks')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-002' AND ac.code IN ('servers','network_devices')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-003' AND ac.code IN ('laptops','desktops','storage_media')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-010' AND ac.code IN ('servers','network_devices','applications')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-011' AND ac.code IN ('networks','network_devices')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-012' AND ac.code IN ('applications','networks','it_services')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-013' AND ac.code IN ('networks','applications')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-014' AND ac.code IN ('networks','network_devices')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-020' AND ac.code IN ('applications','databases','cloud_services','it_services')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-021' AND ac.code IN ('applications','databases','cloud_services')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-022' AND ac.code IN ('applications','databases')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-023' AND ac.code IN ('applications','databases','cloud_services')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-024' AND ac.code IN ('applications','databases','servers','cloud_services')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-025' AND ac.code IN ('applications','databases','cloud_services')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-030' AND ac.code IN ('employees','teams')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-031' AND ac.code IN ('employees')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-032' AND ac.code IN ('employees')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-040' AND ac.code IN ('documents','rooms')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-041' AND ac.code IN ('rooms','locations','racks')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-042' AND ac.code IN ('rooms','locations')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-043' AND ac.code IN ('rooms','racks')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-044' AND ac.code IN ('rooms','racks')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-050' AND ac.code IN ('servers','applications','databases','cloud_services')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-051' AND ac.code IN ('servers','databases')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-052' AND ac.code IN ('applications','servers','network_devices')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-053' AND ac.code IN ('employees','teams')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-060' AND ac.code IN ('servers','applications','rooms','employees')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-061' AND ac.code IN ('employees','teams')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-062' AND ac.code IN ('datasets','documents')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-070' AND ac.code IN ('servers','network_devices','applications','cloud_services')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-071' AND ac.code IN ('applications','it_services','datasets')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-072' AND ac.code IN ('servers','network_devices','applications')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-073' AND ac.code IN ('servers','desktops','laptops','applications')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-074' AND ac.code IN ('applications')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-075' AND ac.code IN ('servers','desktops','laptops')
UNION ALL SELECT cc.id, ac.id FROM control_catalog cc, asset_categories ac WHERE cc.ref_id='C-076' AND ac.code IN ('applications','cloud_services','certificates');

-- ============================================================
-- CORRELATIONS: THREAT ↔ WEAKNESS (~95 links)
-- ============================================================

INSERT IGNORE INTO `threat_weakness_link` (`threat_id`, `weakness_id`, `relevance`, `is_system`)
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

-- ============================================================
-- CORRELATIONS: THREAT ↔ CONTROL (~85 links)
-- ============================================================

INSERT IGNORE INTO `threat_control_link` (`threat_id`, `control_id`, `effectiveness`, `is_system`)
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

-- ============================================================
-- CORRELATIONS: WEAKNESS ↔ CONTROL (~55 links)
-- ============================================================

INSERT IGNORE INTO `weakness_control_link` (`weakness_id`, `control_id`, `effectiveness`, `is_system`)
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

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT 'threat_catalog' AS tbl, COUNT(*) AS cnt FROM threat_catalog
-- UNION ALL SELECT 'weakness_catalog', COUNT(*) FROM weakness_catalog
-- UNION ALL SELECT 'control_catalog', COUNT(*) FROM control_catalog
-- UNION ALL SELECT 'threat_weakness_link', COUNT(*) FROM threat_weakness_link
-- UNION ALL SELECT 'threat_control_link', COUNT(*) FROM threat_control_link
-- UNION ALL SELECT 'weakness_control_link', COUNT(*) FROM weakness_control_link
-- UNION ALL SELECT 'threat_asset_category', COUNT(*) FROM threat_asset_category
-- UNION ALL SELECT 'weakness_asset_category', COUNT(*) FROM weakness_asset_category
-- UNION ALL SELECT 'control_catalog_asset_category', COUNT(*) FROM control_catalog_asset_category;
