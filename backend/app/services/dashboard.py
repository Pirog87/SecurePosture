"""
Dashboard aggregation service.

Every public function accepts an AsyncSession and an optional org_unit_id.
When org_unit_id is None the query covers the whole organisation.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.cis import (
    CisAssessment,
    CisAssessmentAnswer,
    CisAttackMapping,
    CisControl,
    CisSubControl,
)
from app.models.dictionary import DictionaryEntry
from app.models.framework import Assessment, Framework
from app.models.org_unit import OrgUnit
from app.models.risk import Risk, RiskReviewConfig
from app.models.asset import Asset
from app.models.asset_category import AssetCategory
from app.models.incident import Incident
from app.models.vulnerability import VulnerabilityRecord
from app.models.security_area import SecurityDomain as SecurityArea
from app.services.score_engine import calculate_all_pillars
from app.schemas.dashboard import (
    AttackCapability,
    CisComparisonUnit,
    CisControlScore,
    CisDashboard,
    CisDimensionScores,
    CisIGScores,
    CisTrend,
    CisTrendPoint,
    ExecutiveKPI,
    ExecutiveSummary,
    OrgUnitRef,
    OverdueRiskItem,
    PostureDimension,
    PostureScoreResponse,
    RiskByArea,
    RiskByOrgUnit,
    RiskByStatus,
    RiskDashboard,
    RiskLevelCounts,
    RiskMatrixCell,
    RiskTrendPoint,
    TopRiskItem,
)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _d(v: Decimal | None) -> float | None:
    """Decimal → float or None."""
    return float(v) if v is not None else None


def _grade(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 55:
        return "C"
    if score >= 35:
        return "D"
    return "F"


def _attack_level(score: float | None) -> str:
    if score is None:
        return "Low"
    if score >= 0.70:
        return "High"
    if score >= 0.40:
        return "Moderate"
    return "Low"


def _org_filter(col, org_unit_id: int | None):
    """Return a WHERE clause fragment filtering by org_unit, or True (no filter)."""
    if org_unit_id is not None:
        return col == org_unit_id
    return True


async def _get_org_ref(s: AsyncSession, org_unit_id: int | None) -> OrgUnitRef | None:
    if org_unit_id is None:
        return None
    row = (await s.execute(
        select(OrgUnit.id, OrgUnit.name, OrgUnit.symbol)
        .where(OrgUnit.id == org_unit_id)
    )).first()
    if row:
        return OrgUnitRef(id=row.id, name=row.name, symbol=row.symbol)
    return None


# ══════════════════════════════════════════════
#  RISK DASHBOARD
# ══════════════════════════════════════════════

async def get_risk_dashboard(s: AsyncSession, org_unit_id: int | None = None) -> RiskDashboard:
    org_ref = await _get_org_ref(s, org_unit_id)
    flt = _org_filter(Risk.org_unit_id, org_unit_id)

    # --- counts by level ---
    level_q = (
        select(
            Risk.risk_level,
            func.count().label("cnt"),
        )
        .where(flt)
        .group_by(Risk.risk_level)
    )
    level_rows = (await s.execute(level_q)).all()
    counts = RiskLevelCounts()
    for row in level_rows:
        setattr(counts, row.risk_level, row.cnt)
    counts.total = counts.high + counts.medium + counts.low

    # --- avg score ---
    avg_q = select(func.avg(Risk.risk_score)).where(flt)
    avg_score = _d((await s.execute(avg_q)).scalar())

    # --- by status ---
    status_alias = aliased(DictionaryEntry)
    status_q = (
        select(
            status_alias.label,
            status_alias.color,
            func.count().label("cnt"),
        )
        .select_from(Risk)
        .join(status_alias, Risk.status_id == status_alias.id, isouter=True)
        .where(flt)
        .group_by(status_alias.label, status_alias.color)
    )
    status_rows = (await s.execute(status_q)).all()
    by_status = [
        RiskByStatus(status=r.label or "Brak statusu", status_color=r.color, count=r.cnt)
        for r in status_rows
    ]

    # --- by security area ---
    area_q = (
        select(
            SecurityArea.id,
            SecurityArea.name,
            func.sum(case((Risk.risk_level == "high", 1), else_=0)).label("high"),
            func.sum(case((Risk.risk_level == "medium", 1), else_=0)).label("medium"),
            func.sum(case((Risk.risk_level == "low", 1), else_=0)).label("low"),
            func.count(Risk.id).label("total"),
            func.round(func.avg(Risk.risk_score), 1).label("avg"),
        )
        .join(Risk, Risk.security_area_id == SecurityArea.id, isouter=True)
        .where(_org_filter(Risk.org_unit_id, org_unit_id) | (Risk.id.is_(None)))
        .where(SecurityArea.is_active.is_(True))
        .group_by(SecurityArea.id, SecurityArea.name)
        .order_by(SecurityArea.sort_order)
    )
    area_rows = (await s.execute(area_q)).all()
    by_area = [
        RiskByArea(
            area_id=r.id, area_name=r.name,
            high=r.high or 0, medium=r.medium or 0, low=r.low or 0,
            total=r.total or 0, avg_score=_d(r.avg),
        )
        for r in area_rows
    ]

    # --- by org unit ---
    by_org: list[RiskByOrgUnit] = []
    if org_unit_id is None:
        org_q = (
            select(
                OrgUnit.id,
                OrgUnit.name,
                OrgUnit.symbol,
                func.sum(case((Risk.risk_level == "high", 1), else_=0)).label("high"),
                func.sum(case((Risk.risk_level == "medium", 1), else_=0)).label("medium"),
                func.sum(case((Risk.risk_level == "low", 1), else_=0)).label("low"),
                func.count(Risk.id).label("total"),
                func.round(func.avg(Risk.risk_score), 1).label("avg"),
            )
            .join(Risk, Risk.org_unit_id == OrgUnit.id, isouter=True)
            .where(OrgUnit.is_active.is_(True))
            .group_by(OrgUnit.id, OrgUnit.name, OrgUnit.symbol)
        )
        org_rows = (await s.execute(org_q)).all()
        by_org = [
            RiskByOrgUnit(
                org_unit_id=r.id, org_unit_name=r.name, symbol=r.symbol,
                high=r.high or 0, medium=r.medium or 0, low=r.low or 0,
                total=r.total or 0, avg_score=_d(r.avg),
            )
            for r in org_rows
        ]

    # --- risk matrix (3×3) ---
    matrix_q = (
        select(
            Risk.impact_level,
            Risk.probability_level,
            func.count().label("cnt"),
            func.group_concat(Risk.id).label("ids"),
        )
        .where(flt)
        .group_by(Risk.impact_level, Risk.probability_level)
    )
    matrix_rows = (await s.execute(matrix_q)).all()
    matrix = [
        RiskMatrixCell(
            impact=r.impact_level,
            probability=r.probability_level,
            count=r.cnt,
            risk_ids=[int(x) for x in r.ids.split(",")] if r.ids else [],
        )
        for r in matrix_rows
    ]

    # --- trend by month (last 12) ---
    trend_q = (
        select(
            func.date_format(Risk.identified_at, "%Y-%m").label("period"),
            func.sum(case((Risk.risk_level == "high", 1), else_=0)).label("high"),
            func.sum(case((Risk.risk_level == "medium", 1), else_=0)).label("medium"),
            func.sum(case((Risk.risk_level == "low", 1), else_=0)).label("low"),
            func.count().label("total"),
            func.round(func.avg(Risk.risk_score), 1).label("avg"),
        )
        .where(flt)
        .group_by(text("period"))
        .order_by(text("period"))
        .limit(12)
    )
    trend_rows = (await s.execute(trend_q)).all()
    trend = [
        RiskTrendPoint(
            period=r.period, high=r.high, medium=r.medium,
            low=r.low, total=r.total, avg_score=_d(r.avg),
        )
        for r in trend_rows
    ]

    # --- overdue reviews ---
    overdue = await _get_overdue_risks(s, org_unit_id)

    return RiskDashboard(
        org_unit=org_ref,
        risk_counts=counts,
        avg_risk_score=avg_score,
        by_status=by_status,
        by_area=by_area,
        by_org_unit=by_org,
        matrix=matrix,
        trend=trend,
        overdue_reviews=overdue,
    )


async def _get_overdue_risks(
    s: AsyncSession, org_unit_id: int | None
) -> list[OverdueRiskItem]:
    cfg_row = (await s.execute(select(RiskReviewConfig.review_interval_days))).scalar()
    interval = cfg_row or 90

    flt = _org_filter(Risk.org_unit_id, org_unit_id)
    overdue_q = (
        select(
            Risk.id,
            Risk.asset_name,
            OrgUnit.name.label("org_unit"),
            Risk.risk_score,
            Risk.risk_level,
            Risk.owner,
            func.datediff(func.now(), func.coalesce(Risk.last_review_at, Risk.identified_at)).label("days"),
        )
        .join(OrgUnit, Risk.org_unit_id == OrgUnit.id)
        .where(flt)
        .where(
            func.datediff(func.now(), func.coalesce(Risk.last_review_at, Risk.identified_at)) > interval
        )
        .order_by(Risk.risk_score.desc())
    )
    rows = (await s.execute(overdue_q)).all()
    return [
        OverdueRiskItem(
            id=r.id, asset_name=r.asset_name, org_unit=r.org_unit,
            risk_score=float(r.risk_score), risk_level=r.risk_level,
            days_since_review=r.days, owner=r.owner,
        )
        for r in rows
    ]


# ══════════════════════════════════════════════
#  CIS DASHBOARD
# ══════════════════════════════════════════════

async def _latest_assessment(
    s: AsyncSession, org_unit_id: int | None
) -> CisAssessment | None:
    q = (
        select(CisAssessment)
        .where(CisAssessment.org_unit_id == org_unit_id if org_unit_id is not None else CisAssessment.org_unit_id.is_(None))
        .order_by(CisAssessment.assessment_date.desc())
        .limit(1)
    )
    return (await s.execute(q)).scalar_one_or_none()


async def _control_scores(
    s: AsyncSession, assessment_id: int
) -> list[CisControlScore]:
    q = (
        select(
            CisControl.control_number,
            CisControl.name_pl,
            CisControl.name_en,
            func.count(case((CisAssessmentAnswer.is_not_applicable.is_(False), 1))).label("applicable"),
            func.count(case((CisAssessmentAnswer.is_not_applicable.is_(True), 1))).label("na"),
            func.round(
                func.avg(case((
                    CisAssessmentAnswer.is_not_applicable.is_(False),
                    (
                        func.coalesce(CisAssessmentAnswer.policy_value, 0)
                        + func.coalesce(CisAssessmentAnswer.impl_value, 0)
                        + func.coalesce(CisAssessmentAnswer.auto_value, 0)
                        + func.coalesce(CisAssessmentAnswer.report_value, 0)
                    ) / 4,
                ))) * 100, 1
            ).label("risk_addressed"),
            func.round(func.avg(case((CisAssessmentAnswer.is_not_applicable.is_(False), CisAssessmentAnswer.policy_value))) * 100, 1).label("policy"),
            func.round(func.avg(case((CisAssessmentAnswer.is_not_applicable.is_(False), CisAssessmentAnswer.impl_value))) * 100, 1).label("impl"),
            func.round(func.avg(case((CisAssessmentAnswer.is_not_applicable.is_(False), CisAssessmentAnswer.auto_value))) * 100, 1).label("auto"),
            func.round(func.avg(case((CisAssessmentAnswer.is_not_applicable.is_(False), CisAssessmentAnswer.report_value))) * 100, 1).label("report"),
        )
        .join(CisSubControl, CisAssessmentAnswer.sub_control_id == CisSubControl.id)
        .join(CisControl, CisSubControl.control_id == CisControl.id)
        .where(CisAssessmentAnswer.assessment_id == assessment_id)
        .group_by(CisControl.id, CisControl.control_number, CisControl.name_pl, CisControl.name_en)
        .order_by(CisControl.control_number)
    )
    rows = (await s.execute(q)).all()
    return [
        CisControlScore(
            control_number=r.control_number,
            name_pl=r.name_pl,
            name_en=r.name_en,
            applicable_subs=r.applicable,
            na_subs=r.na,
            risk_addressed_pct=_d(r.risk_addressed),
            dimensions=CisDimensionScores(
                policy_pct=_d(r.policy),
                implementation_pct=_d(r.impl),
                automation_pct=_d(r.auto),
                reporting_pct=_d(r.report),
            ),
        )
        for r in rows
    ]


async def _ig_scores(s: AsyncSession, assessment_id: int) -> CisIGScores:
    """Compute IG1/IG2/IG3 scores from assessment answers."""
    scores = CisIGScores()
    for ig_label, ig_value in [("ig1", "1"), ("ig2", "2"), ("ig3", "3")]:
        q = (
            select(
                func.round(
                    func.avg(
                        (
                            func.coalesce(CisAssessmentAnswer.policy_value, 0)
                            + func.coalesce(CisAssessmentAnswer.impl_value, 0)
                            + func.coalesce(CisAssessmentAnswer.auto_value, 0)
                            + func.coalesce(CisAssessmentAnswer.report_value, 0)
                        ) / 4
                    ) * 100, 1
                )
            )
            .join(CisSubControl, CisAssessmentAnswer.sub_control_id == CisSubControl.id)
            .where(CisAssessmentAnswer.assessment_id == assessment_id)
            .where(CisAssessmentAnswer.is_not_applicable.is_(False))
            .where(func.find_in_set(ig_value, CisSubControl.implementation_groups) > 0)
        )
        val = (await s.execute(q)).scalar()
        setattr(scores, ig_label, _d(val))
    return scores


async def _attack_capabilities(
    s: AsyncSession, assessment_id: int
) -> list[AttackCapability]:
    q = (
        select(
            CisAttackMapping.attack_activity,
            CisAttackMapping.capability_type,
            func.avg(
                (
                    func.coalesce(CisAssessmentAnswer.policy_value, 0)
                    + func.coalesce(CisAssessmentAnswer.impl_value, 0)
                    + func.coalesce(CisAssessmentAnswer.auto_value, 0)
                    + func.coalesce(CisAssessmentAnswer.report_value, 0)
                ) / 4
            ).label("avg_score"),
        )
        .join(CisSubControl, CisAttackMapping.sub_control_id == CisSubControl.id)
        .join(CisAssessmentAnswer, CisAssessmentAnswer.sub_control_id == CisSubControl.id)
        .where(CisAssessmentAnswer.assessment_id == assessment_id)
        .where(CisAssessmentAnswer.is_not_applicable.is_(False))
        .group_by(CisAttackMapping.attack_activity, CisAttackMapping.capability_type)
        .order_by(CisAttackMapping.attack_activity)
    )
    rows = (await s.execute(q)).all()

    # Merge preventive + detective per activity
    activities: dict[str, dict] = {}
    for r in rows:
        entry = activities.setdefault(r.attack_activity, {})
        score = _d(r.avg_score)
        if r.capability_type == "preventive":
            entry["preventive_score"] = score
        else:
            entry["detective_score"] = score

    return [
        AttackCapability(
            activity=act,
            preventive_score=vals.get("preventive_score"),
            detective_score=vals.get("detective_score"),
            preventive_level=_attack_level(vals.get("preventive_score")),
            detective_level=_attack_level(vals.get("detective_score")),
        )
        for act, vals in activities.items()
    ]


async def get_cis_dashboard(
    s: AsyncSession, org_unit_id: int | None = None
) -> CisDashboard:
    org_ref = await _get_org_ref(s, org_unit_id)
    assessment = await _latest_assessment(s, org_unit_id)

    if assessment is None:
        return CisDashboard(org_unit=org_ref)

    controls = await _control_scores(s, assessment.id)
    ig = await _ig_scores(s, assessment.id)
    attack = await _attack_capabilities(s, assessment.id)

    # Overall dimensions — average over all controls
    all_p = [c.dimensions.policy_pct for c in controls if c.dimensions.policy_pct is not None]
    all_i = [c.dimensions.implementation_pct for c in controls if c.dimensions.implementation_pct is not None]
    all_a = [c.dimensions.automation_pct for c in controls if c.dimensions.automation_pct is not None]
    all_r = [c.dimensions.reporting_pct for c in controls if c.dimensions.reporting_pct is not None]

    overall = CisDimensionScores(
        policy_pct=round(sum(all_p) / len(all_p), 1) if all_p else None,
        implementation_pct=round(sum(all_i) / len(all_i), 1) if all_i else None,
        automation_pct=round(sum(all_a) / len(all_a), 1) if all_a else None,
        reporting_pct=round(sum(all_r) / len(all_r), 1) if all_r else None,
    )

    return CisDashboard(
        org_unit=org_ref,
        assessment_id=assessment.id,
        assessment_date=assessment.assessment_date,
        maturity_rating=_d(assessment.maturity_rating),
        risk_addressed_pct=_d(assessment.risk_addressed_pct),
        overall_dimensions=overall,
        ig_scores=ig,
        controls=controls,
        attack_capabilities=attack,
    )


# ══════════════════════════════════════════════
#  CIS COMPARISON  (side-by-side)
# ══════════════════════════════════════════════

async def get_cis_comparison(
    s: AsyncSession, org_unit_ids: list[int | None]
) -> list[CisComparisonUnit]:
    result: list[CisComparisonUnit] = []
    for uid in org_unit_ids:
        org_ref = await _get_org_ref(s, uid)
        assessment = await _latest_assessment(s, uid)
        if assessment is None:
            result.append(CisComparisonUnit(org_unit=org_ref))
            continue
        controls = await _control_scores(s, assessment.id)
        ig = await _ig_scores(s, assessment.id)
        result.append(CisComparisonUnit(
            org_unit=org_ref,
            assessment_id=assessment.id,
            assessment_date=assessment.assessment_date,
            maturity_rating=_d(assessment.maturity_rating),
            risk_addressed_pct=_d(assessment.risk_addressed_pct),
            ig_scores=ig,
            controls=controls,
        ))
    return result


# ══════════════════════════════════════════════
#  CIS TREND
# ══════════════════════════════════════════════

async def get_cis_trend(
    s: AsyncSession, org_unit_id: int | None = None
) -> CisTrend:
    org_ref = await _get_org_ref(s, org_unit_id)
    q = (
        select(CisAssessment)
        .where(CisAssessment.org_unit_id == org_unit_id if org_unit_id is not None else CisAssessment.org_unit_id.is_(None))
        .order_by(CisAssessment.assessment_date.asc())
    )
    assessments = (await s.execute(q)).scalars().all()

    points: list[CisTrendPoint] = []
    for a in assessments:
        ig = await _ig_scores(s, a.id)
        points.append(CisTrendPoint(
            assessment_id=a.id,
            assessment_date=a.assessment_date,
            maturity_rating=_d(a.maturity_rating),
            risk_addressed_pct=_d(a.risk_addressed_pct),
            ig1=ig.ig1,
            ig2=ig.ig2,
            ig3=ig.ig3,
        ))

    return CisTrend(org_unit=org_ref, points=points)


# ══════════════════════════════════════════════
#  SECURITY POSTURE SCORE (10-pillar Security Score engine)
# ══════════════════════════════════════════════

_PILLAR_NAMES = {
    "risk": "Ryzyka",
    "vulnerability": "Podatności",
    "incident": "Incydenty",
    "exception": "Wyjątki od polityk",
    "maturity": "Control Maturity",
    "audit": "Audyty / Findings",
    "asset": "Aktywa (CMDB)",
    "tprm": "Dostawcy (TPRM)",
    "policy": "Polityki",
    "awareness": "Awareness",
}

_PILLAR_COLORS = {
    "risk": "#ef4444",
    "vulnerability": "#f97316",
    "incident": "#dc2626",
    "exception": "#eab308",
    "maturity": "#8b5cf6",
    "audit": "#a855f7",
    "asset": "#6366f1",
    "tprm": "#0ea5e9",
    "policy": "#22c55e",
    "awareness": "#14b8a6",
}


def _score_rating(score: float) -> str:
    if score >= 80:
        return "Dobry"
    elif score >= 60:
        return "Zadowalający"
    elif score >= 40:
        return "Wymaga poprawy"
    return "Krytyczny"


async def get_posture_score(
    s: AsyncSession, org_unit_id: int | None = None
) -> PostureScoreResponse:
    org_ref = await _get_org_ref(s, org_unit_id)

    # Use the 10-pillar Security Score engine
    result = await calculate_all_pillars(s)

    total = result["total_score"]
    dims = []
    for key in result["pillars"]:
        score = result["pillars"][key]
        weight = result["weights"][key] / 100  # fraction
        dims.append(PostureDimension(
            name=_PILLAR_NAMES.get(key, key),
            score=round(score, 1),
            weight=weight,
            color=_PILLAR_COLORS.get(key),
        ))

    # Sort by weight descending for display
    dims.sort(key=lambda d: d.weight, reverse=True)

    return PostureScoreResponse(
        org_unit=org_ref,
        score=total,
        grade=_grade(total),
        rating=_score_rating(total),
        dimensions=dims,
        config_version=result["config_version"],
        benchmark_avg=None,
    )


# ══════════════════════════════════════════════
#  EXECUTIVE SUMMARY
# ══════════════════════════════════════════════

async def get_executive_summary(
    s: AsyncSession, org_unit_id: int | None = None
) -> ExecutiveSummary:
    org_ref = await _get_org_ref(s, org_unit_id)
    flt = _org_filter(Risk.org_unit_id, org_unit_id)

    # Risk counts
    level_q = select(Risk.risk_level, func.count().label("cnt")).where(flt).group_by(Risk.risk_level)
    level_rows = (await s.execute(level_q)).all()
    counts = RiskLevelCounts()
    for r in level_rows:
        setattr(counts, r.risk_level, r.cnt)
    counts.total = counts.high + counts.medium + counts.low

    avg_score = _d((await s.execute(select(func.avg(Risk.risk_score)).where(flt))).scalar())

    # Framework Engine maturity (replaces old CIS-only data)
    fw_maturity_score: float | None = None
    fw_maturity_name: str | None = None
    fw_completion_pct: float | None = None

    # Try Framework Engine first — find latest approved (or any) assessment
    fw_q = (
        select(Assessment)
        .where(Assessment.is_active.is_(True), Assessment.status == "approved")
        .order_by(Assessment.created_at.desc())
    )
    fw_assessment = (await s.execute(fw_q)).scalars().first()
    if not fw_assessment:
        fw_q = (
            select(Assessment)
            .where(Assessment.is_active.is_(True))
            .order_by(Assessment.created_at.desc())
        )
        fw_assessment = (await s.execute(fw_q)).scalars().first()

    if fw_assessment:
        fw_maturity_score = float(fw_assessment.overall_score) if fw_assessment.overall_score else None
        fw_completion_pct = float(fw_assessment.completion_pct) if fw_assessment.completion_pct else None
        # Get framework name
        fw = await s.get(Framework, fw_assessment.framework_id)
        fw_maturity_name = fw.name if fw else None

    # Legacy CIS fallback — only used if Framework Engine has no data
    cis_maturity: float | None = None
    cis_pct: float | None = None
    if fw_maturity_score is not None:
        # Map framework score (0–100) to old CIS maturity scale (0–5) for backward compat
        cis_maturity = round(fw_maturity_score / 20, 2)
        cis_pct = fw_completion_pct
    else:
        # Fallback to old CIS tables
        old_assessment = await _latest_assessment(s, org_unit_id)
        cis_maturity = _d(old_assessment.maturity_rating) if old_assessment else None
        cis_pct = _d(old_assessment.risk_addressed_pct) if old_assessment else None

    # Posture (uses new 10-pillar Security Score engine)
    posture = await get_posture_score(s, org_unit_id)

    # Overdue
    overdue = await _get_overdue_risks(s, org_unit_id)

    # Top 5 risks
    top_q = (
        select(
            Risk.id,
            Risk.asset_name,
            Risk.risk_score,
            Risk.risk_level,
            OrgUnit.name.label("org_unit"),
            SecurityArea.name.label("area"),
            DictionaryEntry.label.label("status"),
        )
        .select_from(Risk)
        .join(OrgUnit, Risk.org_unit_id == OrgUnit.id)
        .join(SecurityArea, Risk.security_area_id == SecurityArea.id, isouter=True)
        .join(DictionaryEntry, Risk.status_id == DictionaryEntry.id, isouter=True)
        .where(flt)
        .order_by(Risk.risk_score.desc())
        .limit(5)
    )
    top_rows = (await s.execute(top_q)).all()
    top_risks = [
        TopRiskItem(
            id=r.id, asset_name=r.asset_name, risk_score=float(r.risk_score),
            risk_level=r.risk_level, org_unit=r.org_unit,
            security_area=r.area, status=r.status,
        )
        for r in top_rows
    ]

    # CMDB KPIs
    total_assets = (await s.execute(
        select(func.count()).select_from(Asset).where(Asset.is_active.is_(True))
    )).scalar() or 0
    assets_with_category = (await s.execute(
        select(func.count()).select_from(Asset).where(
            Asset.is_active.is_(True), Asset.asset_category_id.isnot(None)
        )
    )).scalar() or 0
    cmdb_coverage_pct = round(assets_with_category / max(total_assets, 1) * 100) if total_assets > 0 else 0

    # Vulnerability KPIs
    open_vulns = (await s.execute(
        select(func.count()).select_from(VulnerabilityRecord).where(VulnerabilityRecord.is_active.is_(True))
    )).scalar() or 0

    # Incident KPIs
    open_incidents = (await s.execute(
        select(func.count()).select_from(Incident).where(Incident.is_active.is_(True))
    )).scalar() or 0

    # KPIs — updated with Framework Engine maturity
    maturity_label = fw_maturity_name or "Control Maturity"
    maturity_val = round(fw_maturity_score, 1) if fw_maturity_score is not None else (cis_maturity or 0)
    maturity_unit = "/100" if fw_maturity_score is not None else "/5.0"

    kpis = [
        ExecutiveKPI(label="Ryzyka ogółem", value=counts.total, color="#3b82f6"),
        ExecutiveKPI(label="Ryzyka krytyczne", value=counts.high, color="#ef4444"),
        ExecutiveKPI(label="Średni score ryzyka", value=round(avg_score, 1) if avg_score else 0, color="#f97316"),
        ExecutiveKPI(label="Aktywa (CMDB)", value=total_assets, color="#8b5cf6"),
        ExecutiveKPI(label="CMDB Coverage", value=cmdb_coverage_pct, unit="%", color="#8b5cf6"),
        ExecutiveKPI(label="Otwarte podatności", value=open_vulns, color="#ea580c" if open_vulns > 5 else "#22c55e"),
        ExecutiveKPI(label="Otwarte incydenty", value=open_incidents, color="#ef4444" if open_incidents > 0 else "#22c55e"),
        ExecutiveKPI(label=maturity_label, value=maturity_val, unit=maturity_unit, color="#8b5cf6"),
        ExecutiveKPI(label="Security Score", value=posture.score, unit="/100", color="#22c55e"),
        ExecutiveKPI(label="Przeterminowane przeglądy", value=len(overdue), color="#ef4444" if overdue else "#22c55e"),
    ]

    return ExecutiveSummary(
        org_unit=org_ref,
        kpis=kpis,
        risk_counts=counts,
        avg_risk_score=avg_score,
        maturity_score=fw_maturity_score,
        maturity_framework_name=fw_maturity_name,
        maturity_completion_pct=fw_completion_pct,
        cis_maturity_rating=cis_maturity,
        cis_risk_addressed_pct=cis_pct,
        posture_score=posture.score,
        posture_grade=posture.grade,
        overdue_reviews_count=len(overdue),
        top_risks=top_risks,
    )
