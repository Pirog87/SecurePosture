-- ============================================================
-- Migration 016: Framework Versioning & Lifecycle
-- Adds lifecycle status, version tracking, and version history
-- MariaDB 10.6+
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ═══════════════════════════════════════════════════════════════
-- 1. Add lifecycle + versioning columns to frameworks
--    MariaDB 10.2+ supports ADD COLUMN IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS
    lifecycle_status VARCHAR(30) NOT NULL DEFAULT 'draft'
    COMMENT 'draft|published|archived|retired';

ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS
    edit_version INT NOT NULL DEFAULT 1;

ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS
    published_version VARCHAR(100) NULL;

ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS
    last_edited_by VARCHAR(200) NULL;

ALTER TABLE frameworks ADD COLUMN IF NOT EXISTS
    last_edited_at DATETIME NULL;

-- Index on lifecycle_status (idempotent via IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS ix_fw_lifecycle
    ON frameworks (lifecycle_status);


-- ═══════════════════════════════════════════════════════════════
-- 2. Framework version history
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS framework_versions (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    framework_id                INT NOT NULL,
    edit_version                INT NOT NULL,
    lifecycle_status            VARCHAR(30) NOT NULL,
    change_summary              TEXT,
    changed_by                  VARCHAR(200) NULL,
    changed_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    snapshot_nodes_count        INT NULL,
    snapshot_assessable_count   INT NULL,

    INDEX ix_fwv_framework (framework_id),
    INDEX ix_fwv_version   (framework_id, edit_version),

    CONSTRAINT fk_fwv_framework FOREIGN KEY (framework_id)
        REFERENCES frameworks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SET FOREIGN_KEY_CHECKS = 1;
