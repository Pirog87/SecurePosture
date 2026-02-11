"""
Incident registry module — /api/v1/incidents
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.incident import Incident, IncidentRisk, IncidentVulnerability
from app.models.asset import Asset
from app.models.dictionary import DictionaryEntry
from app.models.org_unit import OrgUnit
from app.schemas.incident import (
    IncidentCreate,
    IncidentLinkRisk,
    IncidentLinkVulnerability,
    IncidentMetrics,
    IncidentOut,
    IncidentStatusChange,
    IncidentUpdate,
)

router = APIRouter(prefix="/api/v1/incidents", tags=["Rejestr incydentów"])


# ── helper ──

async def _de_label(s: AsyncSession, entry_id: int | None) -> str | None:
    if entry_id is None:
        return None
    e = await s.get(DictionaryEntry, entry_id)
    return e.label if e else None


async def _inc_out(s: AsyncSession, i: Incident) -> IncidentOut:
    org = await s.get(OrgUnit, i.org_unit_id) if i.org_unit_id else None
    asset = await s.get(Asset, i.asset_id) if i.asset_id else None
    return IncidentOut(
        id=i.id,
        ref_id=i.ref_id,
        title=i.title,
        description=i.description,
        category_id=i.category_id,
        category_name=await _de_label(s, i.category_id),
        severity_id=i.severity_id,
        severity_name=await _de_label(s, i.severity_id),
        org_unit_id=i.org_unit_id,
        org_unit_name=org.name if org else None,
        asset_id=i.asset_id,
        asset_name=asset.name if asset else None,
        reported_by=i.reported_by,
        assigned_to=i.assigned_to,
        status_id=i.status_id,
        status_name=await _de_label(s, i.status_id),
        reported_at=i.reported_at,
        detected_at=i.detected_at,
        closed_at=i.closed_at,
        ttr_minutes=i.ttr_minutes,
        impact_id=i.impact_id,
        impact_name=await _de_label(s, i.impact_id),
        personal_data_breach=i.personal_data_breach,
        authority_notification=i.authority_notification,
        actions_taken=i.actions_taken,
        root_cause=i.root_cause,
        lessons_learned=i.lessons_learned,
        is_active=i.is_active,
        created_at=i.created_at,
        updated_at=i.updated_at,
    )


# ═══════════════════ METRICS (before {id}) ═══════════════════

@router.get("/metrics", response_model=IncidentMetrics, summary="Metryki incydentów")
async def get_incident_metrics(s: AsyncSession = Depends(get_session)):
    # Total open
    open_q = (
        select(func.count())
        .select_from(Incident)
        .where(Incident.is_active.is_(True))
        .outerjoin(DictionaryEntry, DictionaryEntry.id == Incident.status_id)
        .where(DictionaryEntry.code != "closed")
    )
    total_open = (await s.execute(open_q)).scalar() or 0

    # Total in last 90 days
    cutoff = datetime.utcnow() - timedelta(days=90)
    total_90d = (await s.execute(
        select(func.count())
        .select_from(Incident)
        .where(Incident.is_active.is_(True))
        .where(Incident.reported_at >= cutoff)
    )).scalar() or 0

    # By severity
    sev_q = (
        select(DictionaryEntry.label, func.count())
        .select_from(Incident)
        .join(DictionaryEntry, DictionaryEntry.id == Incident.severity_id)
        .where(Incident.is_active.is_(True))
        .group_by(DictionaryEntry.label)
    )
    sev_rows = (await s.execute(sev_q)).all()
    by_severity = {label: count for label, count in sev_rows}

    # Average TTR
    avg_ttr = (await s.execute(
        select(func.avg(Incident.ttr_minutes))
        .where(Incident.is_active.is_(True))
        .where(Incident.ttr_minutes.isnot(None))
    )).scalar()

    # Lessons learned %
    closed_count = (await s.execute(
        select(func.count())
        .select_from(Incident)
        .where(Incident.is_active.is_(True))
        .where(Incident.closed_at.isnot(None))
    )).scalar() or 0

    with_lessons = 0
    if closed_count > 0:
        with_lessons = (await s.execute(
            select(func.count())
            .select_from(Incident)
            .where(Incident.is_active.is_(True))
            .where(Incident.closed_at.isnot(None))
            .where(Incident.lessons_learned.isnot(None))
            .where(Incident.lessons_learned != "")
        )).scalar() or 0

    ll_pct = (with_lessons / closed_count * 100) if closed_count > 0 else None

    return IncidentMetrics(
        total_open=total_open,
        total_90d=total_90d,
        by_severity=by_severity,
        avg_ttr_minutes=round(float(avg_ttr), 1) if avg_ttr is not None else None,
        lessons_learned_pct=round(ll_pct, 1) if ll_pct is not None else None,
    )


# ═══════════════════ LIST ═══════════════════

@router.get("", response_model=list[IncidentOut], summary="Lista incydentów")
async def list_incidents(
    org_unit_id: int | None = Query(None),
    severity_id: int | None = Query(None),
    status_id: int | None = Query(None),
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(Incident)
    if not include_archived:
        q = q.where(Incident.is_active.is_(True))
    if org_unit_id is not None:
        q = q.where(Incident.org_unit_id == org_unit_id)
    if severity_id is not None:
        q = q.where(Incident.severity_id == severity_id)
    if status_id is not None:
        q = q.where(Incident.status_id == status_id)
    q = q.order_by(Incident.reported_at.desc())
    incidents = (await s.execute(q)).scalars().all()
    return [await _inc_out(s, i) for i in incidents]


# ═══════════════════ GET ═══════════════════

@router.get("/{inc_id}", response_model=IncidentOut, summary="Szczegóły incydentu")
async def get_incident(inc_id: int, s: AsyncSession = Depends(get_session)):
    i = await s.get(Incident, inc_id)
    if not i:
        raise HTTPException(404, "Incydent nie istnieje")
    return await _inc_out(s, i)


# ═══════════════════ CREATE ═══════════════════

@router.post("", response_model=IncidentOut, status_code=201, summary="Nowy incydent")
async def create_incident(body: IncidentCreate, s: AsyncSession = Depends(get_session)):
    i = Incident(**body.model_dump())
    s.add(i)
    await s.flush()
    i.ref_id = f"INC-{i.id:04d}"
    await s.commit()
    await s.refresh(i)
    return await _inc_out(s, i)


# ═══════════════════ UPDATE ═══════════════════

@router.put("/{inc_id}", response_model=IncidentOut, summary="Edycja incydentu")
async def update_incident(
    inc_id: int, body: IncidentUpdate, s: AsyncSession = Depends(get_session),
):
    i = await s.get(Incident, inc_id)
    if not i:
        raise HTTPException(404, "Incydent nie istnieje")
    for k, val in body.model_dump(exclude_unset=True).items():
        setattr(i, k, val)
    await s.commit()
    await s.refresh(i)
    return await _inc_out(s, i)


# ═══════════════════ STATUS CHANGE ═══════════════════

@router.patch("/{inc_id}/status", response_model=IncidentOut, summary="Zmiana statusu incydentu")
async def change_incident_status(
    inc_id: int, body: IncidentStatusChange, s: AsyncSession = Depends(get_session),
):
    i = await s.get(Incident, inc_id)
    if not i:
        raise HTTPException(404, "Incydent nie istnieje")
    i.status_id = body.status_id
    if body.actions_taken:
        i.actions_taken = body.actions_taken
    if body.root_cause:
        i.root_cause = body.root_cause
    if body.lessons_learned:
        i.lessons_learned = body.lessons_learned

    # Auto-set closed_at and TTR when status is "closed"
    status_entry = await s.get(DictionaryEntry, body.status_id)
    if status_entry and status_entry.code == "closed" and i.closed_at is None:
        i.closed_at = datetime.utcnow()
        if i.reported_at:
            delta = i.closed_at - i.reported_at
            i.ttr_minutes = int(delta.total_seconds() / 60)

    await s.commit()
    await s.refresh(i)
    return await _inc_out(s, i)


# ═══════════════════ LINK RISK ═══════════════════

@router.post("/{inc_id}/risks", status_code=201, summary="Powiąż ryzyko z incydentem")
async def link_risk(
    inc_id: int, body: IncidentLinkRisk, s: AsyncSession = Depends(get_session),
):
    i = await s.get(Incident, inc_id)
    if not i:
        raise HTTPException(404, "Incydent nie istnieje")
    link = IncidentRisk(incident_id=inc_id, risk_id=body.risk_id)
    s.add(link)
    await s.commit()
    return {"status": "linked", "incident_id": inc_id, "risk_id": body.risk_id}


@router.delete("/{inc_id}/risks/{risk_id}", summary="Odłącz ryzyko od incydentu")
async def unlink_risk(inc_id: int, risk_id: int, s: AsyncSession = Depends(get_session)):
    q = select(IncidentRisk).where(
        IncidentRisk.incident_id == inc_id,
        IncidentRisk.risk_id == risk_id,
    )
    link = (await s.execute(q)).scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Powiązanie nie istnieje")
    await s.delete(link)
    await s.commit()
    return {"status": "unlinked", "incident_id": inc_id, "risk_id": risk_id}


# ═══════════════════ LINK VULNERABILITY ═══════════════════

@router.post("/{inc_id}/vulnerabilities", status_code=201, summary="Powiąż podatność z incydentem")
async def link_vulnerability(
    inc_id: int, body: IncidentLinkVulnerability, s: AsyncSession = Depends(get_session),
):
    i = await s.get(Incident, inc_id)
    if not i:
        raise HTTPException(404, "Incydent nie istnieje")
    link = IncidentVulnerability(incident_id=inc_id, vulnerability_id=body.vulnerability_id)
    s.add(link)
    await s.commit()
    return {"status": "linked", "incident_id": inc_id, "vulnerability_id": body.vulnerability_id}


@router.delete("/{inc_id}/vulnerabilities/{vuln_id}", summary="Odłącz podatność od incydentu")
async def unlink_vulnerability(inc_id: int, vuln_id: int, s: AsyncSession = Depends(get_session)):
    q = select(IncidentVulnerability).where(
        IncidentVulnerability.incident_id == inc_id,
        IncidentVulnerability.vulnerability_id == vuln_id,
    )
    link = (await s.execute(q)).scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Powiązanie nie istnieje")
    await s.delete(link)
    await s.commit()
    return {"status": "unlinked", "incident_id": inc_id, "vulnerability_id": vuln_id}


# ═══════════════════ ARCHIVE ═══════════════════

@router.delete("/{inc_id}", summary="Archiwizuj incydent")
async def archive_incident(inc_id: int, s: AsyncSession = Depends(get_session)):
    i = await s.get(Incident, inc_id)
    if not i:
        raise HTTPException(404, "Incydent nie istnieje")
    i.is_active = False
    await s.commit()
    return {"status": "archived", "id": inc_id}
