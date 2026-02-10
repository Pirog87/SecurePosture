"""
Dashboard API — /api/v1/dashboard

All endpoints accept optional `org_unit_id` query param.
Omit it (or pass null) for whole-organization perspective.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.dashboard import (
    CisComparison,
    CisDashboard,
    CisTrend,
    ExecutiveSummary,
    PostureScoreResponse,
    RiskDashboard,
)
from app.services import dashboard as svc

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get(
    "/executive-summary",
    response_model=ExecutiveSummary,
    summary="Executive Summary — KPI, ryzyka, CIS maturity, posture score",
)
async def executive_summary(
    org_unit_id: int | None = Query(None, description="ID jednostki org. (puste = cała organizacja)"),
    s: AsyncSession = Depends(get_session),
):
    return await svc.get_executive_summary(s, org_unit_id)


@router.get(
    "/risks",
    response_model=RiskDashboard,
    summary="Risk Dashboard — rozkład, macierz, trend, przeterminowane",
)
async def risk_dashboard(
    org_unit_id: int | None = Query(None, description="ID jednostki org. (puste = cała organizacja)"),
    s: AsyncSession = Depends(get_session),
):
    return await svc.get_risk_dashboard(s, org_unit_id)


@router.get(
    "/cis",
    response_model=CisDashboard,
    summary="CIS Dashboard — 18 kontroli, 4 wymiary, IG scores, ATT&CK",
)
async def cis_dashboard(
    org_unit_id: int | None = Query(None, description="ID jednostki org. (puste = cała organizacja)"),
    s: AsyncSession = Depends(get_session),
):
    return await svc.get_cis_dashboard(s, org_unit_id)


@router.get(
    "/cis/comparison",
    response_model=CisComparison,
    summary="CIS Comparison — porównanie jednostek side-by-side",
)
async def cis_comparison(
    org_unit_ids: str = Query(
        ...,
        description="Comma-separated IDs jednostek org. Użyj 'null' dla całej organizacji, np. 'null,1,2,3'",
    ),
    s: AsyncSession = Depends(get_session),
):
    parsed: list[int | None] = []
    for part in org_unit_ids.split(","):
        part = part.strip()
        if part.lower() in ("null", "none", ""):
            parsed.append(None)
        else:
            parsed.append(int(part))
    units = await svc.get_cis_comparison(s, parsed)
    return CisComparison(units=units)


@router.get(
    "/cis/trend",
    response_model=CisTrend,
    summary="CIS Trend — trend maturity w czasie (reoceny)",
)
async def cis_trend(
    org_unit_id: int | None = Query(None, description="ID jednostki org. (puste = cała organizacja)"),
    s: AsyncSession = Depends(get_session),
):
    return await svc.get_cis_trend(s, org_unit_id)


@router.get(
    "/posture-score",
    response_model=PostureScoreResponse,
    summary="Security Posture Score — zintegrowana ocena bezpieczeństwa",
)
async def posture_score(
    org_unit_id: int | None = Query(None, description="ID jednostki org. (puste = cała organizacja)"),
    s: AsyncSession = Depends(get_session),
):
    return await svc.get_posture_score(s, org_unit_id)
