"""
Risk analysis module — /api/v1/risks

ISO 27005 / ISO 31000 compliant risk management process.
R = EXP(W) x (P / Z)   — computed by DB (GENERATED column)
risk_level:  high >=221, medium 31-220, low <31
Residual R = EXP(target_W) x target_P / target_Z
"""
import math
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.database import get_session
from app.models.action import Action, ActionLink
from app.models.asset import Asset
from app.models.catalog import Safeguard, Threat, Vulnerability
from app.models.dictionary import DictionaryEntry
from app.models.org_unit import OrgUnit
from app.models.risk import Risk, RiskThreat, RiskVulnerability, RiskSafeguard
from app.models.security_area import SecurityDomain as SecurityArea
from app.schemas.risk import (
    LinkedActionRef, RiskAcceptRequest, RiskCreate, RiskOut,
    RiskThreatRef, RiskVulnerabilityRef, RiskSafeguardRef, RiskUpdate,
)

router = APIRouter(prefix="/api/v1/risks", tags=["Analiza ryzyka"])


# -- helper: build full RiskOut from row --

async def _risk_out(s: AsyncSession, risk: Risk) -> RiskOut:
    """Load all joined names for a single Risk entity."""
    async def _de_label(entry_id: int | None) -> str | None:
        if entry_id is None:
            return None
        e = await s.get(DictionaryEntry, entry_id)
        return e.label if e else None

    org = await s.get(OrgUnit, risk.org_unit_id)
    asset = await s.get(Asset, risk.asset_id) if risk.asset_id else None
    area = await s.get(SecurityArea, risk.security_area_id) if risk.security_area_id else None

    # threats (M2M)
    th_q = (
        select(RiskThreat.threat_id, Threat.name)
        .join(Threat, RiskThreat.threat_id == Threat.id)
        .where(RiskThreat.risk_id == risk.id)
    )
    th_rows = (await s.execute(th_q)).all()

    # vulnerabilities (M2M)
    vl_q = (
        select(RiskVulnerability.vulnerability_id, Vulnerability.name)
        .join(Vulnerability, RiskVulnerability.vulnerability_id == Vulnerability.id)
        .where(RiskVulnerability.risk_id == risk.id)
    )
    vl_rows = (await s.execute(vl_q)).all()

    # safeguards (M2M)
    sg_q = (
        select(RiskSafeguard.safeguard_id, Safeguard.name)
        .join(Safeguard, RiskSafeguard.safeguard_id == Safeguard.id)
        .where(RiskSafeguard.risk_id == risk.id)
    )
    sg_rows = (await s.execute(sg_q)).all()

    return RiskOut(
        id=risk.id,
        # Kontekst
        org_unit_id=risk.org_unit_id,
        org_unit_name=org.name if org else None,
        risk_category_id=risk.risk_category_id,
        risk_category_name=await _de_label(risk.risk_category_id),
        risk_source=risk.risk_source,
        identification_source_id=risk.identification_source_id,
        identification_source_name=await _de_label(risk.identification_source_id),
        # Identyfikacja
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
        existing_controls=risk.existing_controls,
        consequence_description=risk.consequence_description,
        # Analiza
        impact_level=risk.impact_level,
        probability_level=risk.probability_level,
        safeguard_rating=float(risk.safeguard_rating),
        risk_score=float(risk.risk_score) if risk.risk_score is not None else None,
        risk_level=risk.risk_level,
        # Postepowanie
        status_id=risk.status_id,
        status_name=await _de_label(risk.status_id),
        strategy_id=risk.strategy_id,
        strategy_name=await _de_label(risk.strategy_id),
        owner=risk.owner,
        planned_actions=risk.planned_actions,
        treatment_plan=risk.treatment_plan,
        planned_safeguard_id=risk.planned_safeguard_id,
        planned_safeguard_name=(await s.get(Safeguard, risk.planned_safeguard_id)).name if risk.planned_safeguard_id else None,
        treatment_deadline=risk.treatment_deadline,
        treatment_resources=risk.treatment_resources,
        residual_risk=float(risk.residual_risk) if risk.residual_risk is not None else None,
        target_impact=risk.target_impact,
        target_probability=risk.target_probability,
        target_safeguard=float(risk.target_safeguard) if risk.target_safeguard is not None else None,
        # Akceptacja
        accepted_by=risk.accepted_by,
        accepted_at=risk.accepted_at,
        acceptance_justification=risk.acceptance_justification,
        # Monitorowanie
        next_review_date=risk.next_review_date,
        identified_at=risk.identified_at,
        last_review_at=risk.last_review_at,
        is_active=risk.is_active,
        created_at=risk.created_at,
        updated_at=risk.updated_at,
        threats=[RiskThreatRef(threat_id=tid, threat_name=tn) for tid, tn in th_rows],
        vulnerabilities=[RiskVulnerabilityRef(vulnerability_id=vid, vulnerability_name=vn) for vid, vn in vl_rows],
        safeguards=[RiskSafeguardRef(safeguard_id=sid, safeguard_name=sn) for sid, sn in sg_rows],
        linked_actions=await _get_linked_actions(s, risk.id),
    )


async def _get_linked_actions(s: AsyncSession, risk_id: int) -> list[LinkedActionRef]:
    """Get actions linked to this risk via action_links table."""
    q = (
        select(
            Action.id,
            Action.title,
            Action.owner,
            Action.due_date,
            DictionaryEntry.label.label("status_name"),
        )
        .join(ActionLink, ActionLink.action_id == Action.id)
        .join(DictionaryEntry, Action.status_id == DictionaryEntry.id, isouter=True)
        .where(ActionLink.entity_type == "risk")
        .where(ActionLink.entity_id == risk_id)
        .where(Action.is_active.is_(True))
        .order_by(Action.due_date.asc().nulls_last())
    )
    rows = (await s.execute(q)).all()
    today = date.today()
    return [
        LinkedActionRef(
            action_id=r.id,
            title=r.title,
            status_name=r.status_name,
            owner=r.owner,
            due_date=r.due_date,
            is_overdue=r.due_date is not None and r.due_date < today,
        )
        for r in rows
    ]


def _calc_residual(tw: int | None, tp: int | None, tz: float | None) -> float | None:
    """Calculate residual risk from target components: R_res = EXP(W_t) * P_t / Z_t"""
    if tw is not None and tp is not None and tz is not None and tz > 0:
        return math.exp(tw) * tp / tz
    return None


async def _sync_threats(s: AsyncSession, risk_id: int, threat_ids: list[int]):
    await s.execute(delete(RiskThreat).where(RiskThreat.risk_id == risk_id))
    for tid in threat_ids:
        s.add(RiskThreat(risk_id=risk_id, threat_id=tid))


async def _sync_vulnerabilities(s: AsyncSession, risk_id: int, vulnerability_ids: list[int]):
    await s.execute(delete(RiskVulnerability).where(RiskVulnerability.risk_id == risk_id))
    for vid in vulnerability_ids:
        s.add(RiskVulnerability(risk_id=risk_id, vulnerability_id=vid))


async def _sync_safeguards(s: AsyncSession, risk_id: int, safeguard_ids: list[int]):
    await s.execute(delete(RiskSafeguard).where(RiskSafeguard.risk_id == risk_id))
    for sid in safeguard_ids:
        s.add(RiskSafeguard(risk_id=risk_id, safeguard_id=sid))


# =================== LIST ===================

@router.get("", response_model=list[RiskOut], summary="Lista ryzyk z filtrami")
async def list_risks(
    org_unit_id: int | None = Query(None),
    security_area_id: int | None = Query(None),
    status_id: int | None = Query(None),
    risk_level: str | None = Query(None, description="high / medium / low"),
    risk_category_id: int | None = Query(None),
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(Risk)
    if not include_archived:
        q = q.where(Risk.is_active.is_(True))
    if org_unit_id is not None:
        q = q.where(Risk.org_unit_id == org_unit_id)
    if security_area_id is not None:
        q = q.where(Risk.security_area_id == security_area_id)
    if status_id is not None:
        q = q.where(Risk.status_id == status_id)
    if risk_level is not None:
        q = q.where(Risk.risk_level == risk_level)
    if risk_category_id is not None:
        q = q.where(Risk.risk_category_id == risk_category_id)
    q = q.order_by(Risk.risk_score.desc())
    risks = (await s.execute(q)).scalars().all()
    return [await _risk_out(s, r) for r in risks]


# =================== GET ===================

@router.get("/{risk_id}", response_model=RiskOut, summary="Pobierz ryzyko")
async def get_risk(risk_id: int, s: AsyncSession = Depends(get_session)):
    risk = await s.get(Risk, risk_id)
    if not risk:
        raise HTTPException(404, "Ryzyko nie istnieje")
    return await _risk_out(s, risk)


# =================== CREATE ===================

@router.post("", response_model=RiskOut, status_code=201, summary="Utworz ryzyko")
async def create_risk(body: RiskCreate, s: AsyncSession = Depends(get_session)):
    data = body.model_dump(exclude={"threat_ids", "vulnerability_ids", "safeguard_ids"})
    # Auto-calculate residual risk from target components
    calc = _calc_residual(data.get("target_impact"), data.get("target_probability"), data.get("target_safeguard"))
    if calc is not None:
        data["residual_risk"] = round(calc, 2)
    risk = Risk(**data)
    risk.recompute_score()
    s.add(risk)
    await s.flush()

    if body.threat_ids:
        await _sync_threats(s, risk.id, body.threat_ids)
    if body.vulnerability_ids:
        await _sync_vulnerabilities(s, risk.id, body.vulnerability_ids)
    if body.safeguard_ids:
        await _sync_safeguards(s, risk.id, body.safeguard_ids)

    await s.commit()
    await s.refresh(risk)
    return await _risk_out(s, risk)


# =================== UPDATE ===================

@router.put("/{risk_id}", response_model=RiskOut, summary="Edytuj ryzyko")
async def update_risk(risk_id: int, body: RiskUpdate, s: AsyncSession = Depends(get_session)):
    risk = await s.get(Risk, risk_id)
    if not risk:
        raise HTTPException(404, "Ryzyko nie istnieje")

    data = body.model_dump(exclude_unset=True, exclude={"threat_ids", "vulnerability_ids", "safeguard_ids"})
    for k, v in data.items():
        setattr(risk, k, v)

    # Recompute risk score after field changes
    risk.recompute_score()

    # Recalculate residual risk if target components changed
    tw = risk.target_impact
    tp = risk.target_probability
    tz = float(risk.target_safeguard) if risk.target_safeguard is not None else None
    calc = _calc_residual(tw, tp, tz)
    if calc is not None:
        risk.residual_risk = round(calc, 2)

    if body.threat_ids is not None:
        await _sync_threats(s, risk_id, body.threat_ids)
    if body.vulnerability_ids is not None:
        await _sync_vulnerabilities(s, risk_id, body.vulnerability_ids)
    if body.safeguard_ids is not None:
        await _sync_safeguards(s, risk_id, body.safeguard_ids)

    await s.commit()
    await s.refresh(risk)
    return await _risk_out(s, risk)


# =================== ACCEPT (ISO 27005 8.6) ===================

@router.post("/{risk_id}/accept", response_model=RiskOut, summary="Formalna akceptacja ryzyka (ISO 27005 8.6)")
async def accept_risk(risk_id: int, body: RiskAcceptRequest, s: AsyncSession = Depends(get_session)):
    risk = await s.get(Risk, risk_id)
    if not risk:
        raise HTTPException(404, "Ryzyko nie istnieje")
    risk.accepted_by = body.accepted_by
    risk.accepted_at = datetime.utcnow()
    risk.acceptance_justification = body.acceptance_justification

    # Set status to "accepted" if exists
    from app.models.dictionary import DictionaryType
    q = (
        select(DictionaryEntry.id)
        .select_from(DictionaryEntry)
        .join(DictionaryType, DictionaryEntry.dict_type_id == DictionaryType.id)
        .where(DictionaryType.code == "risk_status")
        .where(DictionaryEntry.code == "accepted")
        .limit(1)
    )
    accepted_id = (await s.execute(q)).scalar()
    if accepted_id:
        risk.status_id = accepted_id

    await s.commit()
    await s.refresh(risk)
    return await _risk_out(s, risk)


# =================== CLOSE (soft) ===================

@router.delete("/{risk_id}", summary="Zamknij ryzyko (status -> Zamkniete)")
async def close_risk(risk_id: int, s: AsyncSession = Depends(get_session)):
    risk = await s.get(Risk, risk_id)
    if not risk:
        raise HTTPException(404, "Ryzyko nie istnieje")
    from app.models.dictionary import DictionaryType
    q = (
        select(DictionaryEntry.id)
        .select_from(DictionaryEntry)
        .join(DictionaryType, DictionaryEntry.dict_type_id == DictionaryType.id)
        .where(DictionaryType.code == "risk_status")
        .where(DictionaryEntry.code == "closed")
        .limit(1)
    )
    closed_id = (await s.execute(q)).scalar()
    if closed_id:
        risk.status_id = closed_id
    risk.is_active = False
    await s.commit()
    return {"status": "closed", "id": risk_id}
