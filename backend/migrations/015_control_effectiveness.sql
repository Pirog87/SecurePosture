-- ============================================================
-- Migration 015: Control Effectiveness Assessment
-- Implementation tracking + test records
-- MariaDB 10.6+
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ═══════════════════════════════════════════════════════════════
-- 1. control_implementations
--    Tracks how a control from control_catalog is deployed
--    within a specific org_unit, optionally tied to an asset.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS control_implementations (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    ref_id                      VARCHAR(20) NOT NULL,
    control_id                  INT NOT NULL,
    org_unit_id                 INT NOT NULL,
    asset_id                    INT NULL,
    security_area_id            INT NULL,

    -- Implementation details
    status                      VARCHAR(30) NOT NULL DEFAULT 'planned'
                                COMMENT 'planned|in_progress|implemented|not_applicable',
    responsible                 VARCHAR(200) NULL,
    implementation_date         DATE NULL,
    description                 TEXT,
    evidence_url                VARCHAR(500) NULL,
    evidence_notes              TEXT,

    -- Effectiveness scores (0.00–100.00)
    design_effectiveness        DECIMAL(5,2) NULL COMMENT '0-100 design effectiveness',
    operational_effectiveness   DECIMAL(5,2) NULL COMMENT '0-100 operational effectiveness',
    coverage_percent            DECIMAL(5,2) NULL COMMENT '0-100 coverage %',
    overall_effectiveness       DECIMAL(5,2) NULL COMMENT '0-100 overall',

    -- Testing schedule
    test_frequency_days         INT NULL,
    last_test_date              DATE NULL,
    next_test_date              DATE NULL,

    -- Standard
    is_active                   TINYINT(1) NOT NULL DEFAULT 1,
    created_by                  INT NULL,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX ix_ci_control_id   (control_id),
    INDEX ix_ci_org_unit_id  (org_unit_id),
    INDEX ix_ci_status       (status),

    CONSTRAINT fk_ci_control    FOREIGN KEY (control_id)      REFERENCES control_catalog(id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_org_unit   FOREIGN KEY (org_unit_id)     REFERENCES org_units(id),
    CONSTRAINT fk_ci_asset      FOREIGN KEY (asset_id)        REFERENCES assets(id),
    CONSTRAINT fk_ci_sec_area   FOREIGN KEY (security_area_id) REFERENCES security_domains(id),
    CONSTRAINT fk_ci_created_by FOREIGN KEY (created_by)      REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════
-- 2. control_effectiveness_tests
--    Individual test records for a control implementation.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS control_effectiveness_tests (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    ref_id              VARCHAR(20) NOT NULL,
    implementation_id   INT NOT NULL,
    test_date           DATE NOT NULL,
    test_type           VARCHAR(30) NOT NULL
                        COMMENT 'walkthrough|observation|reperformance|inquiry|inspection|automated',
    tester              VARCHAR(200) NOT NULL,
    result              VARCHAR(20) NOT NULL
                        COMMENT 'effective|partially_effective|ineffective',
    design_score        DECIMAL(5,2) NULL,
    operational_score   DECIMAL(5,2) NULL,
    findings            TEXT,
    recommendations     TEXT,
    evidence_url        VARCHAR(500) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX ix_cet_impl_id   (implementation_id),
    INDEX ix_cet_test_date (test_date),

    CONSTRAINT fk_cet_impl FOREIGN KEY (implementation_id)
        REFERENCES control_implementations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SET FOREIGN_KEY_CHECKS = 1;
