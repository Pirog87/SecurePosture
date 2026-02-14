-- ============================================================
-- Migration 017: Mapping Sets & Framework Mappings (czysty)
-- Tworzy tabele od zera — bez ALTER (dla nowej instalacji)
-- ============================================================

-- 1. Drop stare wersje (jesli istnialy w innym formacie)
DROP TABLE IF EXISTS framework_mappings;
DROP TABLE IF EXISTS mapping_sets;

-- 2. mapping_sets — grupy mapowań między parami frameworków
CREATE TABLE mapping_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_framework_id INT NOT NULL,
    target_framework_id INT NOT NULL,
    name VARCHAR(500) NULL,
    description TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    revert_set_id INT NULL,
    mapping_count INT NOT NULL DEFAULT 0,
    coverage_percent DECIMAL(5,2) NULL,
    created_by VARCHAR(200) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ms_source FOREIGN KEY (source_framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_ms_target FOREIGN KEY (target_framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_ms_revert FOREIGN KEY (revert_set_id) REFERENCES mapping_sets(id) ON DELETE SET NULL,
    CONSTRAINT uq_ms_src_tgt UNIQUE (source_framework_id, target_framework_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. framework_mappings — mapowania między wymaganiami
CREATE TABLE framework_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mapping_set_id INT NULL,
    source_framework_id INT NOT NULL,
    source_requirement_id INT NOT NULL,
    target_framework_id INT NOT NULL,
    target_requirement_id INT NOT NULL,
    relationship_type VARCHAR(20) NOT NULL DEFAULT 'intersect',
    strength INT NOT NULL DEFAULT 2,
    rationale_type VARCHAR(20) NULL,
    rationale TEXT NULL,
    mapping_source VARCHAR(20) NOT NULL DEFAULT 'manual',
    mapping_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    ai_score DECIMAL(4,3) NULL,
    ai_model VARCHAR(100) NULL,
    confirmed_by VARCHAR(200) NULL,
    confirmed_at DATETIME NULL,
    created_by VARCHAR(200) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fm_set FOREIGN KEY (mapping_set_id) REFERENCES mapping_sets(id) ON DELETE SET NULL,
    CONSTRAINT fk_fm_src_fw FOREIGN KEY (source_framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_fm_src_req FOREIGN KEY (source_requirement_id) REFERENCES framework_nodes(id),
    CONSTRAINT fk_fm_tgt_fw FOREIGN KEY (target_framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_fm_tgt_req FOREIGN KEY (target_requirement_id) REFERENCES framework_nodes(id),
    CONSTRAINT uq_fm UNIQUE (source_requirement_id, target_requirement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Indeksy dla wydajności zapytań
CREATE INDEX ix_fm_set ON framework_mappings (mapping_set_id);
CREATE INDEX ix_fm_src_fw ON framework_mappings (source_framework_id);
CREATE INDEX ix_fm_tgt_fw ON framework_mappings (target_framework_id);
