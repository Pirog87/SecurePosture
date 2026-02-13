"""Security Score calculation engine — computes all 10 pillar scores."""
from datetime import date, datetime, timedelta

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk import Risk
from app.models.vulnerability import VulnerabilityRecord
from app.models.incident import Incident
from app.models.policy_exception import PolicyException
from app.models.policy import Policy, PolicyStandardMapping, PolicyAcknowledgment
from app.models.audit_register import Audit, AuditFinding
from app.models.asset import Asset
from app.models.vendor import Vendor
from app.models.awareness import AwarenessCampaign, AwarenessResult
from app.models.dictionary import DictionaryEntry, DictionaryType
from app.models.framework import Assessment, AssessmentAnswer, DimensionLevel
from app.models.security_score import SecurityScoreConfig


def _clamp(v: float) -> float:
    return max(0.0, min(100.0, v))


async def _de_label(s: AsyncSession, entry_id: int | None) -> str | None:
    if entry_id is None:
        return None
    e = await s.get(DictionaryEntry, entry_id)
    return (e.label or "").lower() if e else None


async def get_active_config(s: AsyncSession) -> SecurityScoreConfig:
    q = select(SecurityScoreConfig).where(SecurityScoreConfig.is_active.is_(True)).order_by(SecurityScoreConfig.version.desc())
    cfg = (await s.execute(q)).scalars().first()
    if not cfg:
        cfg = SecurityScoreConfig()
    return cfg


# ═══════════════════ PILLAR 1: RISK ═══════════════════

async def calc_risk_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    q = select(Risk).where(Risk.is_active.is_(True))
    risks = (await s.execute(q)).scalars().all()
    if not risks:
        return 100.0

    status_weights = {
        "zidentyfikowane": 1.0, "identified": 1.0,
        "w analizie": 0.9, "in analysis": 0.9,
        "w mitygacji": 0.5, "in mitigation": 0.5,
        "zaakceptowane": 0.3, "accepted": 0.3,
        "zamknięte": 0.0, "closed": 0.0,
    }
    max_r = 602.6
    total_impact = 0.0
    for r in risks:
        score = float(r.risk_score) if r.risk_score else 0
        normalized = score / max_r
        status_label = await _de_label(s, r.status_id)
        sw = status_weights.get(status_label or "", 0.5)
        total_impact += normalized * sw

    max_possible = len(risks)
    return _clamp(100 - (total_impact / max(max_possible, 1)) * 100)


# ═══════════════════ PILLAR 2: VULNERABILITY ═══════════════════

async def calc_vulnerability_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    q = select(VulnerabilityRecord).where(VulnerabilityRecord.is_active.is_(True))
    vulns = (await s.execute(q)).scalars().all()
    if not vulns:
        return 100.0

    sev_weights = {"krytyczna": 10, "critical": 10, "wysoka": 5, "high": 5,
                   "średnia": 2, "medium": 2, "niska": 0.5, "low": 0.5}
    thresholds = {"krytyczna": cfg.vuln_threshold_critical or 3, "critical": cfg.vuln_threshold_critical or 3,
                  "wysoka": cfg.vuln_threshold_high or 10, "high": cfg.vuln_threshold_high or 10,
                  "średnia": cfg.vuln_threshold_medium or 30, "medium": cfg.vuln_threshold_medium or 30,
                  "niska": cfg.vuln_threshold_low or 100, "low": cfg.vuln_threshold_low or 100}

    # Count open vulns by severity
    open_vulns = [v for v in vulns if (await _de_label(s, v.status_id) or "") not in ("zamknięte", "closed")]
    sev_counts: dict[str, int] = {}
    for v in open_vulns:
        sev = await _de_label(s, v.severity_id) or "medium"
        sev_counts[sev] = sev_counts.get(sev, 0) + 1

    penalty = 0.0
    for sev, count in sev_counts.items():
        w = sev_weights.get(sev, 1)
        t = thresholds.get(sev, 30)
        penalty += w * min(count, t) / t

    base_score = 100 - penalty * 100

    # SLA multiplier
    total_v = len(vulns)
    on_time = sum(1 for v in vulns if v.sla_deadline and v.sla_deadline >= date.today())
    sla_pct = (on_time / total_v * 100) if total_v > 0 else 100
    if sla_pct > 80:
        mult = 1.05
    elif sla_pct >= 60:
        mult = 1.0
    else:
        mult = 0.90

    return _clamp(base_score * mult)


# ═══════════════════ PILLAR 3: INCIDENT ═══════════════════

async def calc_incident_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    window = cfg.incident_window_days or 90
    cutoff = date.today() - timedelta(days=window)
    q = select(Incident).where(Incident.is_active.is_(True), Incident.reported_at >= cutoff)
    incidents = (await s.execute(q)).scalars().all()
    if not incidents:
        return 100.0

    sev_params = {
        "krytyczny": (25, 2), "critical": (25, 2),
        "wysoki": (10, 5), "high": (10, 5),
        "średni": (3, 15), "medium": (3, 15),
        "niski": (1, 30), "low": (1, 30),
    }
    ttr_targets = {
        "krytyczny": (cfg.incident_ttr_critical or 4), "critical": (cfg.incident_ttr_critical or 4),
        "wysoki": (cfg.incident_ttr_high or 24), "high": (cfg.incident_ttr_high or 24),
        "średni": (cfg.incident_ttr_medium or 72), "medium": (cfg.incident_ttr_medium or 72),
        "niski": (cfg.incident_ttr_low or 168), "low": (cfg.incident_ttr_low or 168),
    }

    sev_counts: dict[str, int] = {}
    sev_ttrs: dict[str, list[float]] = {}
    lessons_total = 0
    lessons_with = 0

    for inc in incidents:
        sev = await _de_label(s, inc.severity_id) or "medium"
        sev_counts[sev] = sev_counts.get(sev, 0) + 1
        if inc.ttr_minutes:
            sev_ttrs.setdefault(sev, []).append(float(inc.ttr_minutes) / 60)
        lessons_total += 1
        if inc.lessons_learned:
            lessons_with += 1

    # Incident penalty
    incident_penalty = 0.0
    for sev, count in sev_counts.items():
        w, t = sev_params.get(sev, (1, 30))
        incident_penalty += w * min(count, t) / t
    incident_penalty *= 50

    # TTR penalty
    ttr_penalty = 0.0
    for sev, ttrs in sev_ttrs.items():
        target = ttr_targets.get(sev, 72)
        avg_ttr = sum(ttrs) / len(ttrs)
        ttr_penalty += max(0, (avg_ttr - target) / target * 10)

    # Lessons bonus
    lessons_bonus = (lessons_with / lessons_total * 10) if lessons_total > 0 else 0

    return _clamp(100 - incident_penalty - ttr_penalty + lessons_bonus)


# ═══════════════════ PILLAR 4: EXCEPTION ═══════════════════

async def calc_exception_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    q = select(PolicyException).where(PolicyException.is_active.is_(True))
    exceptions = (await s.execute(q)).scalars().all()
    if not exceptions:
        return 100.0

    risk_weights = {
        "krytyczne": 15, "critical": 15, "krytyczny": 15,
        "wysokie": 8, "high": 8, "wysoki": 8,
        "średnie": 3, "medium": 3, "średni": 3,
        "niskie": 1, "low": 1, "niski": 1,
    }

    active_penalty = 0.0
    expired_count = 0
    with_compensating = 0

    for ex in exceptions:
        risk_label = await _de_label(s, ex.risk_level_id)
        w = risk_weights.get(risk_label or "", 3)
        status_label = await _de_label(s, ex.status_id)
        if status_label not in ("zamknięte", "closed", "zamknięty"):
            active_penalty += w
            if ex.expiry_date and ex.expiry_date < date.today() and status_label not in ("zamknięte", "closed", "zamknięty"):
                expired_count += 1
        if ex.compensating_controls:
            with_compensating += 1

    expired_penalty = expired_count * 10
    comp_bonus = min(5, (with_compensating / len(exceptions) * 5) if exceptions else 0)

    return _clamp(100 - active_penalty - expired_penalty + comp_bonus)


# ═══════════════════ PILLAR 5: CONTROL MATURITY ═══════════════════

async def calc_maturity_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    # Use approved assessment preferentially, fallback to latest any-status
    q = (select(Assessment)
         .where(Assessment.is_active.is_(True), Assessment.status == "approved")
         .order_by(Assessment.created_at.desc()))
    assessment = (await s.execute(q)).scalars().first()
    if not assessment:
        q = (select(Assessment)
             .where(Assessment.is_active.is_(True))
             .order_by(Assessment.created_at.desc()))
        assessment = (await s.execute(q)).scalars().first()
    if not assessment:
        return 0.0

    # If assessment already has overall_score computed, use it directly
    if assessment.overall_score is not None:
        return _clamp(float(assessment.overall_score))

    answers_q = select(AssessmentAnswer).where(AssessmentAnswer.assessment_id == assessment.id)
    answers = (await s.execute(answers_q)).scalars().all()
    if not answers:
        return 0.0

    scores = []
    for a in answers:
        if a.not_applicable:
            continue
        if a.level_id:
            level = await s.get(DimensionLevel, a.level_id)
            if level and level.value is not None:
                scores.append(float(level.value))

    if not scores:
        return 0.0

    avg = sum(scores) / len(scores)
    # Dimension levels are 0.00–1.00; multiply by 100 for percentage
    return _clamp(avg * 100)


# ═══════════════════ PILLAR 6: AUDIT ═══════════════════

async def calc_audit_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    q = select(AuditFinding).where(AuditFinding.is_active.is_(True))
    findings = (await s.execute(q)).scalars().all()
    if not findings:
        return 100.0

    sev_weights = {
        "krytyczny": 20, "critical": 20, "krytyczna": 20,
        "wysoki": 10, "high": 10, "wysoka": 10,
        "średni": 4, "medium": 4, "średnia": 4,
        "niski": 1, "low": 1, "niska": 1,
    }

    open_findings = []
    for f in findings:
        status_label = await _de_label(s, f.status_id)
        if status_label not in ("zamknięte", "closed", "zamknięty"):
            open_findings.append(f)

    penalty = 0.0
    on_time = 0
    total_with_sla = 0
    for f in open_findings:
        sev = await _de_label(s, f.severity_id) or "medium"
        w = sev_weights.get(sev, 4)
        penalty += w
        if f.sla_deadline:
            total_with_sla += 1
            if f.sla_deadline >= date.today():
                on_time += 1

    base_score = 100 - penalty

    sla_pct = (on_time / total_with_sla * 100) if total_with_sla > 0 else 100
    if sla_pct > 90:
        mult = 1.05
    elif sla_pct >= 70:
        mult = 1.0
    elif sla_pct >= 50:
        mult = 0.90
    else:
        mult = 0.80

    return _clamp(base_score * mult)


# ═══════════════════ PILLAR 7: ASSET ═══════════════════

async def calc_asset_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    q = select(Asset).where(Asset.is_active.is_(True))
    assets = (await s.execute(q)).scalars().all()
    total = len(assets)
    if total == 0:
        return 100.0

    with_owner_crit = sum(1 for a in assets if a.owner and a.criticality_id)
    coverage = (with_owner_crit / total) * 100

    eol_count = sum(1 for a in assets if a.support_end_date and a.support_end_date < date.today())
    eol_score = 100 - (eol_count / total * 100)

    scanned_30d = sum(1 for a in assets if a.last_scan_date and a.last_scan_date >= date.today() - timedelta(days=30))
    scan_score = (scanned_30d / total) * 100

    orphan = sum(1 for a in assets if not a.owner)
    hygiene = 100 - (orphan / total * 100)

    return _clamp(coverage * 0.4 + eol_score * 0.25 + scan_score * 0.2 + hygiene * 0.15)


# ═══════════════════ PILLAR 8: TPRM ═══════════════════

async def calc_tprm_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    q = select(Vendor).where(Vendor.is_active.is_(True))
    vendors = (await s.execute(q)).scalars().all()
    total = len(vendors)
    if total == 0:
        return 100.0

    one_year_ago = date.today() - timedelta(days=365)
    assessed = sum(1 for v in vendors if v.last_assessment_date and v.last_assessment_date >= one_year_ago)
    coverage = (assessed / total) * 100

    crit_weights = {"krytyczny": 4, "wysoki": 3, "średni": 2, "niski": 1}
    weighted_sum = 0.0
    weight_total = 0.0
    for v in vendors:
        if v.risk_score is not None and v.criticality_id:
            crit_label = await _de_label(s, v.criticality_id)
            w = crit_weights.get(crit_label or "", 1)
            weighted_sum += float(v.risk_score) * w
            weight_total += w
    rating = (weighted_sum / weight_total) if weight_total > 0 else 0

    overdue = sum(1 for v in vendors if v.next_assessment_date and v.next_assessment_date < date.today())
    timeliness = 100 - (overdue / total * 100)

    return _clamp(coverage * 0.4 + rating * 0.4 + timeliness * 0.2)


# ═══════════════════ PILLAR 9: POLICY ═══════════════════

async def calc_policy_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    q = select(Policy).where(Policy.is_active.is_(True))
    policies = (await s.execute(q)).scalars().all()
    total = len(policies)
    if total == 0:
        return 100.0

    # Acknowledgment score
    ack_rates = []
    for p in policies:
        if p.target_audience_count and p.target_audience_count > 0:
            ack_q = select(func.count()).select_from(PolicyAcknowledgment).where(PolicyAcknowledgment.policy_id == p.id)
            ack_count = (await s.execute(ack_q)).scalar() or 0
            ack_rates.append(ack_count / p.target_audience_count * 100)
    ack_score = (sum(ack_rates) / len(ack_rates)) if ack_rates else 0

    # Review score
    overdue_review = sum(1 for p in policies if p.review_date and p.review_date < date.today())
    review_score = 100 - (overdue_review / total * 100)

    # Coverage (mapped to standard)
    mapped = 0
    for p in policies:
        map_q = select(func.count()).select_from(PolicyStandardMapping).where(PolicyStandardMapping.policy_id == p.id)
        count = (await s.execute(map_q)).scalar() or 0
        if count > 0:
            mapped += 1
    coverage = (mapped / total) * 100

    # Approval score
    approved = 0
    for p in policies:
        status_label = await _de_label(s, p.status_id)
        if status_label in ("zatwierdzona", "approved", "zatwierdzony"):
            approved += 1
    approval = (approved / total) * 100

    return _clamp(ack_score * 0.35 + review_score * 0.30 + coverage * 0.20 + approval * 0.15)


# ═══════════════════ PILLAR 10: AWARENESS ═══════════════════

async def calc_awareness_score(s: AsyncSession, cfg: SecurityScoreConfig) -> float:
    one_year_ago = date.today() - timedelta(days=365)
    q = select(AwarenessCampaign).where(
        AwarenessCampaign.is_active.is_(True),
        AwarenessCampaign.start_date >= one_year_ago,
    )
    campaigns = (await s.execute(q)).scalars().all()
    if not campaigns:
        return 0.0

    training_rates = []
    click_rates = []
    report_rates = []

    for c in campaigns:
        type_label = await _de_label(s, c.campaign_type_id)
        results_q = select(AwarenessResult).where(AwarenessResult.campaign_id == c.id)
        results = (await s.execute(results_q)).scalars().all()
        if not results:
            continue

        if type_label in ("szkolenie online", "szkolenie stacjonarne"):
            rates = [float(r.completion_rate) for r in results if r.completion_rate is not None]
            if rates:
                training_rates.append(sum(rates) / len(rates))
        elif type_label == "phishing simulation":
            clicks = [float(r.click_rate) for r in results if r.click_rate is not None]
            reports = [float(r.report_rate) for r in results if r.report_rate is not None]
            if clicks:
                click_rates.append(sum(clicks) / len(clicks))
            if reports:
                report_rates.append(sum(reports) / len(reports))

    training = (sum(training_rates) / len(training_rates)) if training_rates else 0
    avg_click = (sum(click_rates) / len(click_rates)) if click_rates else 0
    phishing = max(0, 100 - avg_click * 2)
    avg_report = (sum(report_rates) / len(report_rates)) if report_rates else 0
    reporting = min(100, avg_report * 3)

    return _clamp(training * 0.4 + phishing * 0.4 + reporting * 0.2)


# ═══════════════════ MAIN CALCULATION ═══════════════════

async def calculate_all_pillars(s: AsyncSession) -> dict:
    cfg = await get_active_config(s)

    scores = {
        "risk": await calc_risk_score(s, cfg),
        "vulnerability": await calc_vulnerability_score(s, cfg),
        "incident": await calc_incident_score(s, cfg),
        "exception": await calc_exception_score(s, cfg),
        "maturity": await calc_maturity_score(s, cfg),
        "audit": await calc_audit_score(s, cfg),
        "asset": await calc_asset_score(s, cfg),
        "tprm": await calc_tprm_score(s, cfg),
        "policy": await calc_policy_score(s, cfg),
        "awareness": await calc_awareness_score(s, cfg),
    }

    weights = {
        "risk": float(cfg.w_risk or 20),
        "vulnerability": float(cfg.w_vulnerability or 15),
        "incident": float(cfg.w_incident or 12),
        "exception": float(cfg.w_exception or 10),
        "maturity": float(cfg.w_maturity or 10),
        "audit": float(cfg.w_audit or 10),
        "asset": float(cfg.w_asset or 8),
        "tprm": float(cfg.w_tprm or 6),
        "policy": float(cfg.w_policy or 5),
        "awareness": float(cfg.w_awareness or 4),
    }

    total = sum(scores[k] * weights[k] / 100 for k in scores)

    return {
        "total_score": round(total, 1),
        "pillars": {k: round(v, 1) for k, v in scores.items()},
        "weights": weights,
        "config_version": cfg.version,
    }
