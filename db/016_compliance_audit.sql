-- ═══════════════════════════════════════════════════════════════
-- SecurePosture — Compliance & Audit Module
-- Migration 016: Tables for compliance assessment, audit workflow,
--                framework mapping, test templates, evidences
-- ═══════════════════════════════════════════════════════════════

USE secureposture;

-- ───────────────────────────────────────────────────────────────
-- 1. ALTER frameworks — add document_type, scoring_mode fields
-- ───────────────────────────────────────────────────────────────

ALTER TABLE frameworks
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(20) NOT NULL DEFAULT 'standard'
    COMMENT 'standard | regulation | internal_policy',
  ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(20) DEFAULT 'status'
    COMMENT 'status | score | maturity | full',
  ADD COLUMN IF NOT EXISTS min_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_score INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS publication_date DATE NULL,
  ADD COLUMN IF NOT EXISTS effective_date DATE NULL;

-- ───────────────────────────────────────────────────────────────
-- 2. ALTER framework_nodes — add category, tags, cia_impact
-- ───────────────────────────────────────────────────────────────

ALTER TABLE framework_nodes
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) NULL
    COMMENT 'governance | technical | organizational | legal',
  ADD COLUMN IF NOT EXISTS tags JSON NULL,
  ADD COLUMN IF NOT EXISTS cia_impact JSON NULL
    COMMENT '{"C": true, "I": false, "A": true}';

-- ───────────────────────────────────────────────────────────────
-- 3. compliance_assessments — Continuous + planned assessments
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_assessments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    framework_id        INT NOT NULL,
    scope_type          VARCHAR(20) NOT NULL DEFAULT 'organization'
                        COMMENT 'organization | org_unit | project | service | process',
    scope_id            INT NULL,
    scope_name          VARCHAR(300) NULL,
    assessment_type     VARCHAR(20) NOT NULL DEFAULT 'continuous'
                        COMMENT 'continuous | audit_snapshot',
    scoring_mode        VARCHAR(20) NULL COMMENT 'NULL = inherit from framework',
    selected_impl_groups JSON NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        COMMENT 'draft | in_progress | completed | archived',
    name                VARCHAR(300) NULL,
    description         TEXT NULL,

    -- Computed scores (recalculated on change)
    compliance_score    DECIMAL(5,2) NULL,
    total_requirements  INT NOT NULL DEFAULT 0,
    assessed_count      INT NOT NULL DEFAULT 0,
    compliant_count     INT NOT NULL DEFAULT 0,
    partially_count     INT NOT NULL DEFAULT 0,
    non_compliant_count INT NOT NULL DEFAULT 0,
    not_applicable_count INT NOT NULL DEFAULT 0,

    created_by          VARCHAR(200) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ca_framework FOREIGN KEY (framework_id) REFERENCES frameworks(id),
    INDEX idx_ca_framework (framework_id),
    INDEX idx_ca_scope (scope_type, scope_id),
    INDEX idx_ca_status (status)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 4. requirement_assessments — Per-requirement assessment result
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS requirement_assessments (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    compliance_assessment_id INT NOT NULL,
    requirement_node_id     INT NOT NULL,

    result                  VARCHAR(20) NOT NULL DEFAULT 'not_assessed'
                            COMMENT 'compliant | partially_compliant | non_compliant | not_applicable | not_assessed',
    score                   INT NULL,
    maturity_level          VARCHAR(30) NULL
                            COMMENT 'initial | managed | defined | quantitatively_managed | optimizing',

    assessor_name           VARCHAR(200) NULL,
    assessed_at             DATETIME NULL,
    last_audited_at         DATETIME NULL,
    last_audited_by         VARCHAR(200) NULL,

    notes                   TEXT NULL,
    justification           TEXT NULL,
    selected                BOOLEAN NOT NULL DEFAULT TRUE
                            COMMENT 'in scope based on impl groups',

    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ra_assessment FOREIGN KEY (compliance_assessment_id)
        REFERENCES compliance_assessments(id) ON DELETE CASCADE,
    CONSTRAINT fk_ra_node FOREIGN KEY (requirement_node_id)
        REFERENCES framework_nodes(id),
    UNIQUE KEY uq_ra_assess_node (compliance_assessment_id, requirement_node_id),
    INDEX idx_ra_result (result)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 5. evidences — Shared evidence store
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidences (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(300) NOT NULL,
    description         TEXT NULL,
    evidence_type       VARCHAR(20) NOT NULL DEFAULT 'description'
                        COMMENT 'file | url | description | screenshot',
    file_path           VARCHAR(500) NULL,
    file_name           VARCHAR(300) NULL,
    file_size           BIGINT NULL,
    mime_type           VARCHAR(100) NULL,
    url                 VARCHAR(500) NULL,
    valid_from          DATE NULL,
    valid_until         DATE NULL,
    uploaded_by         VARCHAR(200) NULL,
    org_unit_id         INT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ev_orgunit FOREIGN KEY (org_unit_id) REFERENCES org_units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- M2M: evidence <-> requirement_assessment
CREATE TABLE IF NOT EXISTS requirement_assessment_evidences (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    requirement_assessment_id INT NOT NULL,
    evidence_id             INT NOT NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rae_ra FOREIGN KEY (requirement_assessment_id)
        REFERENCES requirement_assessments(id) ON DELETE CASCADE,
    CONSTRAINT fk_rae_ev FOREIGN KEY (evidence_id)
        REFERENCES evidences(id) ON DELETE CASCADE,
    UNIQUE KEY uq_rae (requirement_assessment_id, evidence_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 6. assessment_history — Audit trail for assessment changes
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_assessment_history (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    requirement_assessment_id INT NOT NULL,
    field_name              VARCHAR(50) NOT NULL,
    old_value               TEXT NULL,
    new_value               TEXT NULL,
    change_reason           VARCHAR(20) NULL COMMENT 'manual | audit | import | ai_suggestion_accepted',
    change_source           VARCHAR(200) NULL,
    changed_by              VARCHAR(200) NULL,
    changed_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cah_ra FOREIGN KEY (requirement_assessment_id)
        REFERENCES requirement_assessments(id) ON DELETE CASCADE,
    INDEX idx_cah_ra (requirement_assessment_id),
    INDEX idx_cah_date (changed_at)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 7. audit_programs — Annual audit planning
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_programs (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(300) NOT NULL,
    year                INT NOT NULL,
    description         TEXT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        COMMENT 'draft | submitted | approved | active | completed | archived',
    prepared_by         VARCHAR(200) NULL,
    approved_by         VARCHAR(200) NULL,
    approved_at         DATETIME NULL,
    org_unit_id         INT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ap_orgunit FOREIGN KEY (org_unit_id) REFERENCES org_units(id) ON DELETE SET NULL,
    INDEX idx_ap_year (year)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 8. audit_engagements — Individual audit tasks
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_engagements (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    audit_program_id        INT NULL,
    ref_id                  VARCHAR(20) NOT NULL,
    name                    VARCHAR(300) NOT NULL,
    framework_id            INT NOT NULL,
    compliance_assessment_id INT NULL,
    scope_type              VARCHAR(20) NOT NULL DEFAULT 'organization',
    scope_id                INT NULL,
    scope_name              VARCHAR(300) NULL,

    objective               TEXT NOT NULL,
    methodology             TEXT NULL,
    criteria                TEXT NULL,

    planned_quarter         INT NULL,
    planned_start           DATE NULL,
    planned_end             DATE NULL,
    actual_start            DATE NULL,
    actual_end              DATE NULL,

    lead_auditor            VARCHAR(200) NOT NULL,
    supervisor              VARCHAR(200) NULL,

    status                  VARCHAR(20) NOT NULL DEFAULT 'planned'
                            COMMENT 'planned | scoping | fieldwork | reporting | review | completed | closed | cancelled',
    status_changed_at       DATETIME NULL,
    priority                VARCHAR(10) NOT NULL DEFAULT 'medium'
                            COMMENT 'critical | high | medium | low',

    created_by              VARCHAR(200) NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ae_program FOREIGN KEY (audit_program_id) REFERENCES audit_programs(id) ON DELETE SET NULL,
    CONSTRAINT fk_ae_framework FOREIGN KEY (framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_ae_ca FOREIGN KEY (compliance_assessment_id) REFERENCES compliance_assessments(id) ON DELETE SET NULL,
    INDEX idx_ae_program (audit_program_id),
    INDEX idx_ae_framework (framework_id),
    INDEX idx_ae_status (status)
) ENGINE=InnoDB;

-- M2M: engagement <-> auditors
CREATE TABLE IF NOT EXISTS audit_engagement_auditors (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    audit_engagement_id INT NOT NULL,
    auditor_name        VARCHAR(200) NOT NULL,
    role                VARCHAR(20) NOT NULL DEFAULT 'auditor'
                        COMMENT 'lead | auditor | observer | specialist',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_aea_engagement FOREIGN KEY (audit_engagement_id)
        REFERENCES audit_engagements(id) ON DELETE CASCADE,
    UNIQUE KEY uq_aea (audit_engagement_id, auditor_name)
) ENGINE=InnoDB;

-- M2M: engagement <-> requirement_nodes (scope)
CREATE TABLE IF NOT EXISTS audit_engagement_scope (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    audit_engagement_id INT NOT NULL,
    requirement_node_id INT NOT NULL,
    in_scope            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_aes_engagement FOREIGN KEY (audit_engagement_id)
        REFERENCES audit_engagements(id) ON DELETE CASCADE,
    CONSTRAINT fk_aes_node FOREIGN KEY (requirement_node_id)
        REFERENCES framework_nodes(id),
    UNIQUE KEY uq_aes (audit_engagement_id, requirement_node_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 9. test_templates — Reusable audit test catalog
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS test_templates (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    ref_id              VARCHAR(20) NULL,
    name                VARCHAR(300) NOT NULL,
    description         TEXT NULL,
    test_steps          JSON NOT NULL DEFAULT ('[]'),
    expected_evidence   JSON NULL DEFAULT ('[]'),
    success_criteria    TEXT NULL,
    failure_criteria    TEXT NULL,
    test_type           VARCHAR(20) NOT NULL DEFAULT 'both'
                        COMMENT 'design | operating | both',
    category            VARCHAR(30) NULL
                        COMMENT 'technical | organizational | legal | physical',
    difficulty          VARCHAR(15) NOT NULL DEFAULT 'basic'
                        COMMENT 'basic | intermediate | advanced',
    estimated_hours     DECIMAL(4,1) NULL,
    tags                JSON NULL DEFAULT ('[]'),
    is_system           BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_by          VARCHAR(200) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tt_category (category),
    INDEX idx_tt_active (is_active)
) ENGINE=InnoDB;

-- M2M: test_template <-> requirement_nodes
CREATE TABLE IF NOT EXISTS test_template_requirements (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    test_template_id    INT NOT NULL,
    requirement_node_id INT NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ttr_template FOREIGN KEY (test_template_id)
        REFERENCES test_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_ttr_node FOREIGN KEY (requirement_node_id)
        REFERENCES framework_nodes(id),
    UNIQUE KEY uq_ttr (test_template_id, requirement_node_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 10. audit_tests — Tests within an engagement
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_tests (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    audit_engagement_id     INT NOT NULL,
    test_template_id        INT NULL,
    requirement_node_id     INT NULL,

    ref_id                  VARCHAR(20) NULL,
    name                    VARCHAR(300) NOT NULL,
    description             TEXT NULL,
    test_steps              TEXT NULL,
    expected_result         TEXT NULL,
    test_type               VARCHAR(20) NOT NULL DEFAULT 'design'
                            COMMENT 'design | operating | both',

    actual_result           TEXT NULL,
    test_result             VARCHAR(20) NOT NULL DEFAULT 'not_tested'
                            COMMENT 'pass | fail | partial | not_tested | inconclusive',
    auditor_name            VARCHAR(200) NULL,
    tested_at               DATETIME NULL,

    workpaper_ref           VARCHAR(50) NULL,
    workpaper_notes         TEXT NULL,
    sample_size             INT NULL,
    sample_description      TEXT NULL,
    exceptions_count        INT NOT NULL DEFAULT 0,

    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_at_engagement FOREIGN KEY (audit_engagement_id)
        REFERENCES audit_engagements(id) ON DELETE CASCADE,
    CONSTRAINT fk_at_template FOREIGN KEY (test_template_id)
        REFERENCES test_templates(id) ON DELETE SET NULL,
    CONSTRAINT fk_at_node FOREIGN KEY (requirement_node_id)
        REFERENCES framework_nodes(id) ON DELETE SET NULL,
    INDEX idx_at_engagement (audit_engagement_id),
    INDEX idx_at_result (test_result)
) ENGINE=InnoDB;

-- M2M: audit_test <-> evidences
CREATE TABLE IF NOT EXISTS audit_test_evidences (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    audit_test_id   INT NOT NULL,
    evidence_id     INT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ate_test FOREIGN KEY (audit_test_id)
        REFERENCES audit_tests(id) ON DELETE CASCADE,
    CONSTRAINT fk_ate_evidence FOREIGN KEY (evidence_id)
        REFERENCES evidences(id) ON DELETE CASCADE,
    UNIQUE KEY uq_ate (audit_test_id, evidence_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 11. audit_findings_v2 — IIA-format findings for engagements
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_audit_findings (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    audit_engagement_id     INT NOT NULL,
    ref_id                  VARCHAR(20) NOT NULL,
    title                   VARCHAR(500) NOT NULL,

    -- IIA 4-element format
    condition_text          TEXT NOT NULL COMMENT 'What is (actual state)',
    criteria_text           TEXT NOT NULL COMMENT 'What should be (requirement)',
    cause_text              TEXT NULL COMMENT 'Why it happened',
    effect_text             TEXT NULL COMMENT 'Impact / risk',

    severity                VARCHAR(15) NOT NULL DEFAULT 'medium'
                            COMMENT 'critical | high | medium | low | informational',
    recommendation          TEXT NULL,

    -- Management response
    management_response     TEXT NULL,
    management_response_by  VARCHAR(200) NULL,
    management_response_at  DATETIME NULL,
    agreed                  BOOLEAN NULL,

    status                  VARCHAR(20) NOT NULL DEFAULT 'draft'
                            COMMENT 'draft | open | acknowledged | in_remediation | remediated | verified | closed',
    status_changed_at       DATETIME NULL,
    target_date             DATE NULL,
    actual_close_date       DATE NULL,
    verified_by             VARCHAR(200) NULL,
    verified_at             DATETIME NULL,
    verification_notes      TEXT NULL,

    created_by              VARCHAR(200) NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_caf_engagement FOREIGN KEY (audit_engagement_id)
        REFERENCES audit_engagements(id) ON DELETE CASCADE,
    INDEX idx_caf_engagement (audit_engagement_id),
    INDEX idx_caf_severity (severity),
    INDEX idx_caf_status (status)
) ENGINE=InnoDB;

-- M2M: finding <-> requirement_nodes
CREATE TABLE IF NOT EXISTS compliance_finding_requirements (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    finding_id          INT NOT NULL,
    requirement_node_id INT NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cfr_finding FOREIGN KEY (finding_id)
        REFERENCES compliance_audit_findings(id) ON DELETE CASCADE,
    CONSTRAINT fk_cfr_node FOREIGN KEY (requirement_node_id)
        REFERENCES framework_nodes(id),
    UNIQUE KEY uq_cfr (finding_id, requirement_node_id)
) ENGINE=InnoDB;

-- M2M: finding <-> audit_tests
CREATE TABLE IF NOT EXISTS compliance_finding_tests (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    finding_id      INT NOT NULL,
    audit_test_id   INT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cft_finding FOREIGN KEY (finding_id)
        REFERENCES compliance_audit_findings(id) ON DELETE CASCADE,
    CONSTRAINT fk_cft_test FOREIGN KEY (audit_test_id)
        REFERENCES audit_tests(id),
    UNIQUE KEY uq_cft (finding_id, audit_test_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 12. audit_reports — Generated reports for engagements
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_reports (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    audit_engagement_id     INT NOT NULL,
    report_type             VARCHAR(10) NOT NULL DEFAULT 'draft'
                            COMMENT 'draft | final',
    version                 INT NOT NULL DEFAULT 1,

    executive_summary       TEXT NULL,
    scope_description       TEXT NULL,
    methodology_description TEXT NULL,
    findings_summary        TEXT NULL,
    conclusion              TEXT NULL,
    opinion                 VARCHAR(20) NULL
                            COMMENT 'positive | qualified | adverse | disclaimer',
    opinion_rationale       TEXT NULL,

    prepared_by             VARCHAR(200) NULL,
    prepared_at             DATETIME NULL,
    reviewed_by             VARCHAR(200) NULL,
    reviewed_at             DATETIME NULL,
    review_notes            TEXT NULL,
    approved_by             VARCHAR(200) NULL,
    approved_at             DATETIME NULL,

    distributed             BOOLEAN NOT NULL DEFAULT FALSE,
    distributed_at          DATETIME NULL,

    pdf_file_path           VARCHAR(500) NULL,
    docx_file_path          VARCHAR(500) NULL,

    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ar_engagement FOREIGN KEY (audit_engagement_id)
        REFERENCES audit_engagements(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 13. framework_mappings — Cross-framework requirement mapping
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS framework_mappings (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    source_framework_id     INT NOT NULL,
    source_requirement_id   INT NOT NULL,
    target_framework_id     INT NOT NULL,
    target_requirement_id   INT NOT NULL,

    relationship_type       VARCHAR(20) NOT NULL DEFAULT 'related'
                            COMMENT 'equal | subset | superset | intersect | related',
    strength                VARCHAR(10) NOT NULL DEFAULT 'moderate'
                            COMMENT 'strong | moderate | weak',
    rationale               TEXT NULL,
    mapping_source          VARCHAR(20) NOT NULL DEFAULT 'manual'
                            COMMENT 'manual | imported_ciso | imported_scf | ai_suggested',
    mapping_status          VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                            COMMENT 'draft | confirmed | rejected | ai_pending_review',
    confirmed_by            VARCHAR(200) NULL,
    confirmed_at            DATETIME NULL,

    created_by              VARCHAR(200) NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_fm_src_fw FOREIGN KEY (source_framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_fm_src_req FOREIGN KEY (source_requirement_id) REFERENCES framework_nodes(id),
    CONSTRAINT fk_fm_tgt_fw FOREIGN KEY (target_framework_id) REFERENCES frameworks(id),
    CONSTRAINT fk_fm_tgt_req FOREIGN KEY (target_requirement_id) REFERENCES framework_nodes(id),
    UNIQUE KEY uq_fm (source_requirement_id, target_requirement_id),
    INDEX idx_fm_source (source_framework_id),
    INDEX idx_fm_target (target_framework_id),
    INDEX idx_fm_status (mapping_status)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- 14. AI feature toggles for Compliance & Audit module
-- ───────────────────────────────────────────────────────────────

ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS feature_framework_mapping BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feature_test_generation BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feature_gap_analysis_ai BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feature_finding_formulation BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feature_report_summary BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feature_trend_analysis BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feature_requirement_classify BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feature_translation BOOLEAN NOT NULL DEFAULT TRUE;
