-- ============================================================
-- SecurePosture — Naprawa uszkodzonych widokow
-- Uruchom:  mariadb -u root -p secureposture < fix_views.sql
-- ============================================================

USE secureposture;

-- 1. Usun stare uszkodzone widoki
DROP VIEW IF EXISTS v_overdue_risks;
DROP VIEW IF EXISTS v_risk_summary_by_area;

-- 2. v_overdue_risks — explicit columns (resilient to ALTER TABLE on risks)
CREATE OR REPLACE VIEW v_overdue_risks AS
SELECT
    r.id,
    r.org_unit_id,
    r.asset_name,
    r.security_area_id,
    r.impact_level,
    r.probability_level,
    r.safeguard_rating,
    r.risk_score,
    r.risk_level,
    r.status_id,
    r.strategy_id,
    r.owner,
    r.identified_at,
    r.last_review_at,
    rc.review_interval_days,
    DATEDIFF(NOW(), COALESCE(r.last_review_at, r.identified_at)) AS days_since_review,
    CASE
        WHEN DATEDIFF(NOW(), COALESCE(r.last_review_at, r.identified_at)) > rc.review_interval_days
        THEN TRUE ELSE FALSE
    END AS is_overdue
FROM risks r
CROSS JOIN risk_review_config rc
WHERE r.risk_level IN ('high', 'medium', 'low');

-- 3. v_risk_summary_by_area — explicit columns
CREATE OR REPLACE VIEW v_risk_summary_by_area AS
SELECT
    sa.id AS area_id,
    sa.name AS area_name,
    COUNT(r.id) AS total_risks,
    SUM(CASE WHEN r.risk_level = 'high' THEN 1 ELSE 0 END) AS high_risks,
    SUM(CASE WHEN r.risk_level = 'medium' THEN 1 ELSE 0 END) AS medium_risks,
    SUM(CASE WHEN r.risk_level = 'low' THEN 1 ELSE 0 END) AS low_risks,
    ROUND(AVG(r.risk_score), 1) AS avg_risk_score
FROM security_domains sa
LEFT JOIN risks r ON r.security_area_id = sa.id
WHERE sa.is_active = 1
GROUP BY sa.id, sa.name;

-- 4. Weryfikacja
SELECT 'v_overdue_risks' AS view_name, COUNT(*) AS row_count FROM v_overdue_risks
UNION ALL
SELECT 'v_risk_summary_by_area', COUNT(*) FROM v_risk_summary_by_area;
