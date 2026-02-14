-- ============================================================
-- Migration 019: Deduplicate dictionary_entries
-- Removes duplicate (dict_type_id, code) entries, keeping lowest ID.
-- Reassigns FK references from duplicates to the canonical entry.
-- Adds UNIQUE INDEX to prevent future duplicates.
-- MariaDB 10.6+
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Step 1: Create a temp table mapping duplicate IDs to canonical (keep) IDs
CREATE TEMPORARY TABLE IF NOT EXISTS _dedup_map AS
SELECT
    d.id AS dup_id,
    k.keep_id
FROM dictionary_entries d
JOIN (
    SELECT dict_type_id, code, MIN(id) AS keep_id
    FROM dictionary_entries
    WHERE code IS NOT NULL
    GROUP BY dict_type_id, code
    HAVING COUNT(*) > 1
) k ON d.dict_type_id = k.dict_type_id
   AND d.code = k.code
   AND d.id != k.keep_id;

-- Step 2: Reassign FK references from all tables that reference dictionary_entries.id
UPDATE frameworks            SET document_type_id       = (SELECT keep_id FROM _dedup_map WHERE dup_id = frameworks.document_type_id)       WHERE document_type_id       IN (SELECT dup_id FROM _dedup_map);
UPDATE actions               SET priority_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = actions.priority_id)                WHERE priority_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE actions               SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = actions.status_id)                  WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE actions               SET source_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = actions.source_id)                  WHERE source_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE org_context_issues    SET category_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = org_context_issues.category_id)     WHERE category_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE org_context_obligations SET regulation_id        = (SELECT keep_id FROM _dedup_map WHERE dup_id = org_context_obligations.regulation_id) WHERE regulation_id       IN (SELECT dup_id FROM _dedup_map);
UPDATE org_context_stakeholders SET category_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = org_context_stakeholders.category_id) WHERE category_id          IN (SELECT dup_id FROM _dedup_map);
UPDATE org_context_scope     SET management_system_id   = (SELECT keep_id FROM _dedup_map WHERE dup_id = org_context_scope.management_system_id) WHERE management_system_id IN (SELECT dup_id FROM _dedup_map);
UPDATE assets                SET asset_type_id          = (SELECT keep_id FROM _dedup_map WHERE dup_id = assets.asset_type_id)               WHERE asset_type_id          IN (SELECT dup_id FROM _dedup_map);
UPDATE assets                SET category_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = assets.category_id)                 WHERE category_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE assets                SET sensitivity_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = assets.sensitivity_id)              WHERE sensitivity_id         IN (SELECT dup_id FROM _dedup_map);
UPDATE assets                SET criticality_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = assets.criticality_id)              WHERE criticality_id         IN (SELECT dup_id FROM _dedup_map);
UPDATE assets                SET environment_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = assets.environment_id)              WHERE environment_id         IN (SELECT dup_id FROM _dedup_map);
UPDATE assets                SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = assets.status_id)                   WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE risks                 SET risk_category_id       = (SELECT keep_id FROM _dedup_map WHERE dup_id = risks.risk_category_id)             WHERE risk_category_id       IN (SELECT dup_id FROM _dedup_map);
UPDATE risks                 SET identification_source_id = (SELECT keep_id FROM _dedup_map WHERE dup_id = risks.identification_source_id)   WHERE identification_source_id IN (SELECT dup_id FROM _dedup_map);
UPDATE risks                 SET asset_category_id      = (SELECT keep_id FROM _dedup_map WHERE dup_id = risks.asset_category_id)            WHERE asset_category_id      IN (SELECT dup_id FROM _dedup_map);
UPDATE risks                 SET sensitivity_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = risks.sensitivity_id)               WHERE sensitivity_id         IN (SELECT dup_id FROM _dedup_map);
UPDATE risks                 SET criticality_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = risks.criticality_id)               WHERE criticality_id         IN (SELECT dup_id FROM _dedup_map);
UPDATE risks                 SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = risks.status_id)                    WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE risks                 SET strategy_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = risks.strategy_id)                  WHERE strategy_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE threats               SET category_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = threats.category_id)                WHERE category_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE threats               SET asset_type_id          = (SELECT keep_id FROM _dedup_map WHERE dup_id = threats.asset_type_id)              WHERE asset_type_id          IN (SELECT dup_id FROM _dedup_map);
UPDATE vulnerabilities       SET asset_type_id          = (SELECT keep_id FROM _dedup_map WHERE dup_id = vulnerabilities.asset_type_id)      WHERE asset_type_id          IN (SELECT dup_id FROM _dedup_map);
UPDATE safeguards            SET type_id                = (SELECT keep_id FROM _dedup_map WHERE dup_id = safeguards.type_id)                 WHERE type_id                IN (SELECT dup_id FROM _dedup_map);
UPDATE safeguards            SET asset_type_id          = (SELECT keep_id FROM _dedup_map WHERE dup_id = safeguards.asset_type_id)           WHERE asset_type_id          IN (SELECT dup_id FROM _dedup_map);
UPDATE cis_assessments       SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = cis_assessments.status_id)          WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE cis_assessment_answers SET policy_status_id      = (SELECT keep_id FROM _dedup_map WHERE dup_id = cis_assessment_answers.policy_status_id) WHERE policy_status_id   IN (SELECT dup_id FROM _dedup_map);
UPDATE cis_assessment_answers SET impl_status_id        = (SELECT keep_id FROM _dedup_map WHERE dup_id = cis_assessment_answers.impl_status_id)   WHERE impl_status_id     IN (SELECT dup_id FROM _dedup_map);
UPDATE cis_assessment_answers SET auto_status_id        = (SELECT keep_id FROM _dedup_map WHERE dup_id = cis_assessment_answers.auto_status_id)   WHERE auto_status_id     IN (SELECT dup_id FROM _dedup_map);
UPDATE cis_assessment_answers SET report_status_id      = (SELECT keep_id FROM _dedup_map WHERE dup_id = cis_assessment_answers.report_status_id) WHERE report_status_id   IN (SELECT dup_id FROM _dedup_map);
UPDATE audits                SET audit_type_id          = (SELECT keep_id FROM _dedup_map WHERE dup_id = audits.audit_type_id)               WHERE audit_type_id          IN (SELECT dup_id FROM _dedup_map);
UPDATE audits                SET overall_rating_id      = (SELECT keep_id FROM _dedup_map WHERE dup_id = audits.overall_rating_id)           WHERE overall_rating_id      IN (SELECT dup_id FROM _dedup_map);
UPDATE audit_findings        SET finding_type_id        = (SELECT keep_id FROM _dedup_map WHERE dup_id = audit_findings.finding_type_id)     WHERE finding_type_id        IN (SELECT dup_id FROM _dedup_map);
UPDATE audit_findings        SET severity_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = audit_findings.severity_id)         WHERE severity_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE audit_findings        SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = audit_findings.status_id)           WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE policies              SET category_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = policies.category_id)               WHERE category_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE policies              SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = policies.status_id)                 WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE incidents             SET category_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = incidents.category_id)              WHERE category_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE incidents             SET severity_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = incidents.severity_id)              WHERE severity_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE incidents             SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = incidents.status_id)                WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE incidents             SET impact_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = incidents.impact_id)                WHERE impact_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE vulnerabilities_registry SET source_id           = (SELECT keep_id FROM _dedup_map WHERE dup_id = vulnerabilities_registry.source_id) WHERE source_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE vulnerabilities_registry SET category_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = vulnerabilities_registry.category_id) WHERE category_id           IN (SELECT dup_id FROM _dedup_map);
UPDATE vulnerabilities_registry SET severity_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = vulnerabilities_registry.severity_id) WHERE severity_id           IN (SELECT dup_id FROM _dedup_map);
UPDATE vulnerabilities_registry SET status_id           = (SELECT keep_id FROM _dedup_map WHERE dup_id = vulnerabilities_registry.status_id) WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE vulnerabilities_registry SET remediation_priority_id = (SELECT keep_id FROM _dedup_map WHERE dup_id = vulnerabilities_registry.remediation_priority_id) WHERE remediation_priority_id IN (SELECT dup_id FROM _dedup_map);
UPDATE policy_exceptions     SET category_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = policy_exceptions.category_id)     WHERE category_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE policy_exceptions     SET risk_level_id          = (SELECT keep_id FROM _dedup_map WHERE dup_id = policy_exceptions.risk_level_id)   WHERE risk_level_id          IN (SELECT dup_id FROM _dedup_map);
UPDATE policy_exceptions     SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = policy_exceptions.status_id)       WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE awareness_campaigns   SET campaign_type_id       = (SELECT keep_id FROM _dedup_map WHERE dup_id = awareness_campaigns.campaign_type_id) WHERE campaign_type_id     IN (SELECT dup_id FROM _dedup_map);
UPDATE awareness_campaigns   SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = awareness_campaigns.status_id)     WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE vendors               SET category_id            = (SELECT keep_id FROM _dedup_map WHERE dup_id = vendors.category_id)               WHERE category_id            IN (SELECT dup_id FROM _dedup_map);
UPDATE vendors               SET criticality_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = vendors.criticality_id)            WHERE criticality_id         IN (SELECT dup_id FROM _dedup_map);
UPDATE vendors               SET data_access_level_id   = (SELECT keep_id FROM _dedup_map WHERE dup_id = vendors.data_access_level_id)     WHERE data_access_level_id   IN (SELECT dup_id FROM _dedup_map);
UPDATE vendors               SET status_id              = (SELECT keep_id FROM _dedup_map WHERE dup_id = vendors.status_id)                 WHERE status_id              IN (SELECT dup_id FROM _dedup_map);
UPDATE vendors               SET risk_rating_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = vendors.risk_rating_id)            WHERE risk_rating_id         IN (SELECT dup_id FROM _dedup_map);
UPDATE vendor_assessments    SET risk_rating_id         = (SELECT keep_id FROM _dedup_map WHERE dup_id = vendor_assessments.risk_rating_id) WHERE risk_rating_id         IN (SELECT dup_id FROM _dedup_map);

-- Step 3: Delete duplicate entries
DELETE FROM dictionary_entries WHERE id IN (SELECT dup_id FROM _dedup_map);

-- Step 4: Clean up temp table
DROP TEMPORARY TABLE IF EXISTS _dedup_map;

-- Step 5: Add unique index to prevent future duplicates
-- NULL codes are allowed to be non-unique (MariaDB treats NULLs as distinct in UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_dict_entries_type_code
    ON dictionary_entries (dict_type_id, code);

SET FOREIGN_KEY_CHECKS = 1;

-- Verify: should return 0 rows if dedup was successful
SELECT dict_type_id, code, COUNT(*) AS cnt
FROM dictionary_entries
WHERE code IS NOT NULL
GROUP BY dict_type_id, code
HAVING cnt > 1;
