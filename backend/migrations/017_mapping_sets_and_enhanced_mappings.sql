-- Migration 017: Mapping Sets & Enhanced Framework Mappings
-- Inspired by CISO Assistant's set-theoretic mapping model

-- 1. Create mapping_sets table (groups mappings between framework pairs)
CREATE TABLE IF NOT EXISTS mapping_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_framework_id INT NOT NULL,
    target_framework_id INT NOT NULL,
    name VARCHAR(500),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    revert_set_id INT NULL,
    mapping_count INT NOT NULL DEFAULT 0,
    coverage_percent DECIMAL(5,2),
    created_by VARCHAR(200),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ms_source FOREIGN KEY (source_framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_ms_target FOREIGN KEY (target_framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_ms_revert FOREIGN KEY (revert_set_id) REFERENCES mapping_sets(id) ON DELETE SET NULL,
    CONSTRAINT uq_ms_src_tgt UNIQUE (source_framework_id, target_framework_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add new columns to framework_mappings
ALTER TABLE framework_mappings
    ADD COLUMN mapping_set_id INT NULL AFTER id,
    ADD COLUMN rationale_type VARCHAR(20) NULL AFTER rationale,
    ADD COLUMN ai_score DECIMAL(4,3) NULL AFTER mapping_status,
    ADD COLUMN ai_model VARCHAR(100) NULL AFTER ai_score,
    ADD CONSTRAINT fk_fm_set FOREIGN KEY (mapping_set_id) REFERENCES mapping_sets(id) ON DELETE SET NULL;

-- 3. Convert strength from VARCHAR to INT (1-3 scale)
-- First add a temp column, migrate data, then swap
ALTER TABLE framework_mappings ADD COLUMN strength_int INT NOT NULL DEFAULT 2 AFTER strength;

UPDATE framework_mappings SET strength_int = CASE
    WHEN strength = 'strong' THEN 3
    WHEN strength = 'moderate' THEN 2
    WHEN strength = 'weak' THEN 1
    ELSE 2
END;

ALTER TABLE framework_mappings DROP COLUMN strength;
ALTER TABLE framework_mappings CHANGE strength_int strength INT NOT NULL DEFAULT 2;

-- 4. Update relationship_type values to CISO Assistant types
UPDATE framework_mappings SET relationship_type = CASE
    WHEN relationship_type = 'equivalent' THEN 'equal'
    WHEN relationship_type = 'covers' THEN 'superset'
    WHEN relationship_type = 'covered_by' THEN 'subset'
    WHEN relationship_type = 'partial_overlap' THEN 'intersect'
    WHEN relationship_type = 'related' THEN 'intersect'
    ELSE relationship_type
END;

-- 5. Add indexes for query performance
CREATE INDEX ix_fm_set ON framework_mappings (mapping_set_id);
CREATE INDEX ix_fm_src_fw ON framework_mappings (source_framework_id);
CREATE INDEX ix_fm_tgt_fw ON framework_mappings (target_framework_id);
