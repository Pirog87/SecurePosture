"""
Security Domains module — /api/v1/domains

CRUD for security domains + CIS control mapping + domain score dashboard.
Replaces /api/v1/security-areas with richer domain concept.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.cis import CisControl
from app.models.risk import Risk
from app.models.security_area import DomainCisControl, SecurityDomain
from app.schemas.domain import (
    CisControlRef,
    DomainDashboardResponse,
    SecurityDomainCreate,
    SecurityDomainOut,
    SecurityDomainUpdate,
)
from app.services.domain_score import get_domain_dashboard

router = APIRouter(prefix="/api/v1/domains", tags=["Domeny bezpieczenstwa"])


# ── helpers ──

async def _domain_out(s: AsyncSession, domain: SecurityDomain) -> SecurityDomainOut:
    """Build full output for a domain with CIS mappings and risk count."""
    # CIS controls mapped
    cis_q = (
        select(DomainCisControl.cis_control_id, CisControl.control_number, CisControl.name_pl)
        .join(CisControl, DomainCisControl.cis_control_id == CisControl.id)
        .where(DomainCisControl.domain_id == domain.id)
        .order_by(CisControl.control_number)
    )
    cis_rows = (await s.execute(cis_q)).all()
    cis_controls = [
        CisControlRef(cis_control_id=r.cis_control_id, control_number=r.control_number, name_pl=r.name_pl)
        for r in cis_rows
    ]

    # Risk count
    risk_cnt = (await s.execute(
        select(func.count()).select_from(Risk)
        .where(Risk.security_area_id == domain.id)
        .where(Risk.is_active.is_(True))
    )).scalar() or 0

    return SecurityDomainOut(
        id=domain.id,
        name=domain.name,
        description=domain.description,
        icon=domain.icon,
        color=domain.color,
        owner=domain.owner,
        sort_order=domain.sort_order,
        is_active=domain.is_active,
        created_at=domain.created_at,
        updated_at=domain.updated_at,
        cis_controls=cis_controls,
        risk_count=risk_cnt,
    )


async def _sync_cis(s: AsyncSession, domain_id: int, cis_control_ids: list[int]):
    """Sync CIS control mappings for a domain."""
    await s.execute(delete(DomainCisControl).where(DomainCisControl.domain_id == domain_id))
    for cid in cis_control_ids:
        s.add(DomainCisControl(domain_id=domain_id, cis_control_id=cid))


# ── DOMAIN DASHBOARD (defined before /{domain_id} to avoid path collision) ──

@router.get(
    "/dashboard/scores",
    response_model=DomainDashboardResponse,
    summary="Dashboard domen — karty z wynikami",
)
async def domain_dashboard(
    org_unit_id: int | None = Query(None, description="ID jednostki org. (puste = cala organizacja)"),
    s: AsyncSession = Depends(get_session),
):
    return await get_domain_dashboard(s, org_unit_id)


# ── LIST ──

@router.get("", response_model=list[SecurityDomainOut], summary="Lista domen bezpieczenstwa")
async def list_domains(
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(SecurityDomain)
    if not include_archived:
        q = q.where(SecurityDomain.is_active.is_(True))
    q = q.order_by(SecurityDomain.sort_order, SecurityDomain.name)
    domains = (await s.execute(q)).scalars().all()
    return [await _domain_out(s, d) for d in domains]


# ── GET single ──

@router.get("/{domain_id}", response_model=SecurityDomainOut, summary="Pobierz domene")
async def get_domain(domain_id: int, s: AsyncSession = Depends(get_session)):
    domain = await s.get(SecurityDomain, domain_id)
    if not domain:
        raise HTTPException(404, "Domena nie istnieje")
    return await _domain_out(s, domain)


# ── CREATE ──

@router.post("", response_model=SecurityDomainOut, status_code=201, summary="Utworz domene")
async def create_domain(body: SecurityDomainCreate, s: AsyncSession = Depends(get_session)):
    data = body.model_dump(exclude={"cis_control_ids"})
    domain = SecurityDomain(**data)
    s.add(domain)
    await s.flush()

    if body.cis_control_ids:
        await _sync_cis(s, domain.id, body.cis_control_ids)

    await s.commit()
    await s.refresh(domain)
    return await _domain_out(s, domain)


# ── UPDATE ──

@router.put("/{domain_id}", response_model=SecurityDomainOut, summary="Edytuj domene")
async def update_domain(
    domain_id: int, body: SecurityDomainUpdate, s: AsyncSession = Depends(get_session)
):
    domain = await s.get(SecurityDomain, domain_id)
    if not domain:
        raise HTTPException(404, "Domena nie istnieje")

    data = body.model_dump(exclude_unset=True, exclude={"cis_control_ids"})
    for k, v in data.items():
        setattr(domain, k, v)

    if body.cis_control_ids is not None:
        await _sync_cis(s, domain_id, body.cis_control_ids)

    await s.commit()
    await s.refresh(domain)
    return await _domain_out(s, domain)


# ── ARCHIVE (soft delete) ──

@router.delete("/{domain_id}", summary="Archiwizuj domene (soft delete)")
async def archive_domain(domain_id: int, s: AsyncSession = Depends(get_session)):
    domain = await s.get(SecurityDomain, domain_id)
    if not domain:
        raise HTTPException(404, "Domena nie istnieje")
    domain.is_active = False
    await s.commit()
    return {"status": "archived", "id": domain_id}
