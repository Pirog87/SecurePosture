"""
Risk analysis module — /api/v1/risks

R = EXP(W) × (P / Z)   — computed by DB (GENERATED column)
risk_level:  high ≥221, medium 31–220, low <31
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.database import get_session
from app.models.asset import Asset
from app.models.catalog import Safeguard, Threat, Vulnerability
from app.models.dictionary import DictionaryEntry
from app.models.org_unit import OrgUnit
from app.models.risk import Risk, RiskSafeguard
from app.models.security_area import SecurityArea
from app.schemas.risk import RiskCreate, RiskOut, RiskSafeguardRef, RiskUpdate

router = APIRouter(prefix="/api/v1/risks", tags=["Analiza ryzyka"])


# ── helper: build full RiskOut from row ──

async def _risk_out(s: AsyncSession, risk: Risk) -> RiskOut:
    """Load all joined names for a single Risk entity."""
    # dict entry names
    async def _de_label(entry_id: int | None) -> str | None:
        if entry_id is None:
            return None
        e = await s.get(DictionaryEntry, entry_id)
        return e.label if e else None

    org = await s.get(OrgUnit, risk.org_unit_id)
    asset = await s.get(Asset, risk.asset_id) if risk.asset_id else None
    area = await s.get(SecurityArea, risk.security_area_id) if risk.security_area_id else None
    threat = await s.get(Threat, risk.threat_id) if risk.threat_id else None
    vuln = await s.get(Vulnerability, risk.vulnerability_id) if risk.vulnerability_id else None

    # safeguards
    sg_q = (
        select(RiskSafeguard.safeguard_id, Safeguard.name)
        .join(Safeguard, RiskSafeguard.safeguard_id == Safeguard.id)
        .where(RiskSafeguard.risk_id == risk.id)
    )
    sg_rows = (await s.execute(sg_q)).all()

    return RiskOut(
        id=risk.id,
        org_unit_id=risk.org_unit_id,
        org_unit_name=org.name if org else None,
        asset_id=risk.asset_id,
        asset_id_name=asset.name if asset else None,
        asset_category_id=risk.asset_category_id,
        asset_category_name=await _de_label(risk.asset_category_id),
        asset_name=risk.asset_name,
        sensitivity_id=risk.sensitivity_id,
        sensitivity_name=await _de_label(risk.sensitivity_id),
        criticality_id=risk.criticality_id,
        criticality_name=await _de_label(risk.criticality_id),
        security_area_id=risk.security_area_id,
        security_area_name=area.name if area else None,
        threat_id=risk.threat_id,
        threat_name=threat.name if threat else None,
        vulnerability_id=risk.vulnerability_id,
        vulnerability_name=vuln.name if vuln else None,
        impact_level=risk.impact_level,
        probability_level=risk.probability_level,
        safeguard_rating=float(risk.safeguard_rating),
        risk_score=float(risk.risk_score) if risk.risk_score is not None else None,
        risk_level=risk.risk_level,
        status_id=risk.status_id,
        status_name=await _de_label(risk.status_id),
        strategy_id=risk.strategy_id,
        strategy_name=await _de_label(risk.strategy_id),
        owner=risk.owner,
        planned_actions=risk.planned_actions,
        residual_risk=float(risk.residual_risk) if risk.residual_risk is not None else None,
        identified_at=risk.identified_at,
        last_review_at=risk.last_review_at,
        created_at=risk.created_at,
        updated_at=risk.updated_at,
        safeguards=[RiskSafeguardRef(safeguard_id=sid, safeguard_name=sn) for sid, sn in sg_rows],
    )


async def _sync_safeguards(s: AsyncSession, risk_id: int, safeguard_ids: list[int]):
    await s.execute(delete(RiskSafeguard).where(RiskSafeguard.risk_id == risk_id))
    for sid in safeguard_ids:
        s.add(RiskSafeguard(risk_id=risk_id, safeguard_id=sid))


# ═══════════════════ LIST ═══════════════════

@router.get("", response_model=list[RiskOut], summary="Lista ryzyk z filtrami")
async def list_risks(
    org_unit_id: int | None = Query(None),
    security_area_id: int | None = Query(None),
    status_id: int | None = Query(None),
    risk_level: str | None = Query(None, description="high / medium / low"),
    s: AsyncSession = Depends(get_session),
):
    q = select(Risk)
    if org_unit_id is not None:
        q = q.where(Risk.org_unit_id == org_unit_id)
    if security_area_id is not None:
        q = q.where(Risk.security_area_id == security_area_id)
    if status_id is not None:
        q = q.where(Risk.status_id == status_id)
    if risk_level is not None:
        q = q.where(Risk.risk_level == risk_level)
    q = q.order_by(Risk.risk_score.desc())
    risks = (await s.execute(q)).scalars().all()
    return [await _risk_out(s, r) for r in risks]


# ═══════════════════ GET ═══════════════════

@router.get("/{risk_id}", response_model=RiskOut, summary="Pobierz ryzyko")
async def get_risk(risk_id: int, s: AsyncSession = Depends(get_session)):
    risk = await s.get(Risk, risk_id)
    if not risk:
        raise HTTPException(404, "Ryzyko nie istnieje")
    return await _risk_out(s, risk)


# ═══════════════════ CREATE ═══════════════════

@router.post("", response_model=RiskOut, status_code=201, summary="Utwórz ryzyko")
async def create_risk(body: RiskCreate, s: AsyncSession = Depends(get_session)):
    data = body.model_dump(exclude={"safeguard_ids"})
    risk = Risk(**data)
    s.add(risk)
    await s.flush()  # get id

    if body.safeguard_ids:
        await _sync_safeguards(s, risk.id, body.safeguard_ids)

    await s.commit()
    # Re-read to pick up GENERATED columns computed by DB
    await s.refresh(risk)
    return await _risk_out(s, risk)


# ═══════════════════ UPDATE ═══════════════════

@router.put("/{risk_id}", response_model=RiskOut, summary="Edytuj ryzyko")
async def update_risk(risk_id: int, body: RiskUpdate, s: AsyncSession = Depends(get_session)):
    risk = await s.get(Risk, risk_id)
    if not risk:
        raise HTTPException(404, "Ryzyko nie istnieje")

    data = body.model_dump(exclude_unset=True, exclude={"safeguard_ids"})
    for k, v in data.items():
        setattr(risk, k, v)

    if body.safeguard_ids is not None:
        await _sync_safeguards(s, risk_id, body.safeguard_ids)

    await s.commit()
    await s.refresh(risk)
    return await _risk_out(s, risk)


# ═══════════════════ DELETE (soft) ═══════════════════

@router.delete("/{risk_id}", summary="Zamknij ryzyko (status → Zamknięte)")
async def close_risk(risk_id: int, s: AsyncSession = Depends(get_session)):
    risk = await s.get(Risk, risk_id)
    if not risk:
        raise HTTPException(404, "Ryzyko nie istnieje")
    # Find "Zamknięte" status entry
    from sqlalchemy import and_
    from app.models.dictionary import DictionaryType
    q = (
        select(DictionaryEntry.id)
        .join(DictionaryType, DictionaryEntry.dict_type_id == DictionaryType.id)
        .where(DictionaryType.code == "risk_status")
        .where(DictionaryEntry.code == "closed")
        .limit(1)
    )
    closed_id = (await s.execute(q)).scalar()
    if closed_id:
        risk.status_id = closed_id
    await s.commit()
    return {"status": "closed", "id": risk_id}
