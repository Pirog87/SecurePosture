-- ============================================================
-- Migration 007: Make frameworks.urn and frameworks.ref_id nullable
-- Supports YAML imports where URN/ref_id may be absent
-- MariaDB 10.6+
-- ============================================================

-- Guard: only alter if NOT NULL
SET @db_name = DATABASE();

-- Make urn nullable
SET @sql = (
    SELECT IF(
        (SELECT IS_NULLABLE FROM information_schema.columns
         WHERE table_schema = @db_name AND table_name = 'frameworks' AND column_name = 'urn') = 'NO',
        'ALTER TABLE frameworks MODIFY COLUMN urn VARCHAR(500) NULL',
        'SELECT ''urn already nullable'' AS info'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make ref_id nullable
SET @sql = (
    SELECT IF(
        (SELECT IS_NULLABLE FROM information_schema.columns
         WHERE table_schema = @db_name AND table_name = 'frameworks' AND column_name = 'ref_id') = 'NO',
        'ALTER TABLE frameworks MODIFY COLUMN ref_id VARCHAR(100) NULL',
        'SELECT ''ref_id already nullable'' AS info'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
