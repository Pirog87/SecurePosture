"""
Domain Score Calculation Service.

Domain Score (0-100) — weighted average of:
  - Risk dimension (60%): based on active risks in domain
  - CIS dimension (40%): only if domain has CIS control mappings

Risk dimension = 100 - min(100, avg_risk_score / 3)
  (score 300 → 0 pts, score 0 → 100 pts; no risks → 100)

CIS dimension = avg risk_addressed_pct across mapped CIS controls

Final:
  - With CIS: score = 0.6 * risk_dim + 0.4 * cis_dim
  - Without CIS: score = risk_dim

Grade: A(≥90) B(≥75) C(≥60) D(≥40) F(<40)
"""
from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cis import CisAssessment, CisAssessmentAnswer, CisControl, CisSubControl
from app.models.org_unit import OrgUnit
from app.models.risk import Risk
from app.models.security_area import DomainCisControl, SecurityDomain
from app.schemas.domain import (
    DomainDashboardResponse,
    DomainScoreOut,
    DomainTopRisk,
)


def _grade(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"


async def _latest_assessment_id(s: AsyncSession, org_unit_id: int | None) -> int | None:
    """Get latest CIS assessment for the org scope."""
    q = (
        select(CisAssessment.id)
        .where(
            CisAssessment.org_unit_id == org_unit_id
            if org_unit_id is not None
            else CisAssessment.org_unit_id.is_(None)
        )
        .order_by(CisAssessment.assessment_date.desc())
        .limit(1)
    )
    return (await s.execute(q)).scalar()


async def _cis_score_for_controls(
    s: AsyncSession, cis_control_ids: list[int], assessment_id: int
) -> float | None:
    """Average risk_addressed_pct for specific CIS controls in an assessment."""
    if not cis_control_ids:
        return None

    q = (
        select(
            func.round(
                func.avg(
                    case(
                        (
                            CisAssessmentAnswer.is_not_applicable.is_(False),
                            (
                                func.coalesce(CisAssessmentAnswer.policy_value, 0)
                                + func.coalesce(CisAssessmentAnswer.impl_value, 0)
                                + func.coalesce(CisAssessmentAnswer.auto_value, 0)
                                + func.coalesce(CisAssessmentAnswer.report_value, 0)
                            ) / 4,
                        )
                    )
                )
                * 100,
                1,
            )
        )
        .join(CisSubControl, CisAssessmentAnswer.sub_control_id == CisSubControl.id)
        .where(CisAssessmentAnswer.assessment_id == assessment_id)
        .where(CisSubControl.control_id.in_(cis_control_ids))
    )
    val = (await s.execute(q)).scalar()
    return float(val) if val is not None else None


async def get_domain_dashboard(
    s: AsyncSession, org_unit_id: int | None = None
) -> DomainDashboardResponse:
    """Build the full domain dashboard with score cards."""

    # Org info
    org_name = None
    if org_unit_id is not None:
        ou = await s.get(OrgUnit, org_unit_id)
        org_name = ou.name if ou else None

    # Get active domains
    domains_q = (
        select(SecurityDomain)
        .where(SecurityDomain.is_active.is_(True))
        .order_by(SecurityDomain.sort_order, SecurityDomain.name)
    )
    domains = (await s.execute(domains_q)).scalars().all()

    # Latest CIS assessment
    assessment_id = await _latest_assessment_id(s, org_unit_id)

    # Org filter for risks
    risk_flt = Risk.is_active.is_(True)
    if org_unit_id is not None:
        risk_flt = risk_flt & (Risk.org_unit_id == org_unit_id)

    cards: list[DomainScoreOut] = []

    for domain in domains:
        # Risk stats for this domain
        risk_stats_q = (
            select(
                func.count(Risk.id).label("cnt"),
                func.sum(case((Risk.risk_level == "high", 1), else_=0)).label("high"),
                func.sum(case((Risk.risk_level == "medium", 1), else_=0)).label("medium"),
                func.sum(case((Risk.risk_level == "low", 1), else_=0)).label("low"),
                func.avg(Risk.risk_score).label("avg"),
            )
            .where(risk_flt)
            .where(Risk.security_area_id == domain.id)
        )
        stats = (await s.execute(risk_stats_q)).first()
        risk_count = stats.cnt or 0
        risk_high = stats.high or 0
        risk_medium = stats.medium or 0
        risk_low = stats.low or 0
        avg_risk = float(stats.avg) if stats.avg is not None else None

        # Risk dimension
        if avg_risk is not None:
            risk_dim = max(0, 100 - min(100, avg_risk / 3))
        else:
            risk_dim = 100.0  # No risks = perfect score

        # CIS dimension
        cis_control_ids_q = (
            select(DomainCisControl.cis_control_id)
            .where(DomainCisControl.domain_id == domain.id)
        )
        cis_control_ids = list((await s.execute(cis_control_ids_q)).scalars().all())
        cis_pct = None

        if cis_control_ids and assessment_id:
            cis_pct = await _cis_score_for_controls(s, cis_control_ids, assessment_id)

        # Final score
        if cis_pct is not None:
            score = 0.6 * risk_dim + 0.4 * cis_pct
        else:
            score = risk_dim

        score = round(min(100, max(0, score)), 1)

        # Top 3 risks in this domain
        top_q = (
            select(
                Risk.id,
                Risk.asset_name,
                Risk.risk_score,
                Risk.risk_level,
                OrgUnit.name.label("org_unit_name"),
            )
            .join(OrgUnit, Risk.org_unit_id == OrgUnit.id)
            .where(risk_flt)
            .where(Risk.security_area_id == domain.id)
            .order_by(Risk.risk_score.desc())
            .limit(3)
        )
        top_rows = (await s.execute(top_q)).all()
        top_risks = [
            DomainTopRisk(
                id=r.id,
                asset_name=r.asset_name,
                risk_score=float(r.risk_score),
                risk_level=r.risk_level,
                org_unit_name=r.org_unit_name,
            )
            for r in top_rows
        ]

        cards.append(DomainScoreOut(
            domain_id=domain.id,
            domain_name=domain.name,
            icon=domain.icon,
            color=domain.color,
            owner=domain.owner,
            score=score,
            grade=_grade(score),
            risk_count=risk_count,
            risk_high=risk_high,
            risk_medium=risk_medium,
            risk_low=risk_low,
            avg_risk_score=round(avg_risk, 1) if avg_risk is not None else None,
            cis_pct=cis_pct,
            cis_control_count=len(cis_control_ids),
            top_risks=top_risks,
        ))

    # Overall score = weighted average by risk count (min weight 1 per domain)
    if cards:
        weights = [(max(1, c.risk_count), c.score) for c in cards]
        total_w = sum(w for w, _ in weights)
        overall = sum(w * s for w, s in weights) / total_w if total_w > 0 else 0
    else:
        overall = 0

    overall = round(min(100, max(0, overall)), 1)

    return DomainDashboardResponse(
        org_unit_id=org_unit_id,
        org_unit_name=org_name,
        domains=cards,
        overall_score=overall,
        overall_grade=_grade(overall),
    )
