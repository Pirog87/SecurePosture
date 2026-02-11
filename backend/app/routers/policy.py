"""
Policy registry module — /api/v1/policies
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.policy import Policy, PolicyStandardMapping, PolicyAcknowledgment
from app.models.dictionary import DictionaryEntry
from app.schemas.policy import (
    PolicyAcknowledgmentCreate, PolicyAcknowledgmentOut,
    PolicyCreate, PolicyMappingCreate, PolicyMappingOut,
    PolicyOut, PolicyUpdate,
)

router = APIRouter(prefix="/api/v1/policies", tags=["Rejestr polityk"])


async def _de_label(s: AsyncSession, entry_id: int | None) -> str | None:
    if entry_id is None:
        return None
    e = await s.get(DictionaryEntry, entry_id)
    return e.label if e else None


async def _policy_out(s: AsyncSession, p: Policy) -> PolicyOut:
    ack_count = (await s.execute(
        select(func.count()).select_from(PolicyAcknowledgment).where(PolicyAcknowledgment.policy_id == p.id)
    )).scalar() or 0

    ack_rate = None
    if p.target_audience_count and p.target_audience_count > 0:
        ack_rate = round(ack_count / p.target_audience_count * 100, 1)

    return PolicyOut(
        id=p.id, ref_id=p.ref_id, title=p.title,
        category_id=p.category_id, category_name=await _de_label(s, p.category_id),
        owner=p.owner, approver=p.approver,
        status_id=p.status_id, status_name=await _de_label(s, p.status_id),
        current_version=p.current_version,
        effective_date=p.effective_date, review_date=p.review_date,
        last_reviewed_at=p.last_reviewed_at, document_url=p.document_url,
        target_audience_count=p.target_audience_count,
        acknowledgment_count=ack_count, acknowledgment_rate=ack_rate,
        description=p.description,
        is_active=p.is_active, created_at=p.created_at, updated_at=p.updated_at,
    )


# ═══════════════════ LIST ═══════════════════

@router.get("", response_model=list[PolicyOut], summary="Lista polityk")
async def list_policies(
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(Policy)
    if not include_archived:
        q = q.where(Policy.is_active.is_(True))
    q = q.order_by(Policy.title)
    policies = (await s.execute(q)).scalars().all()
    return [await _policy_out(s, p) for p in policies]


@router.get("/{pol_id}", response_model=PolicyOut, summary="Szczegóły polityki")
async def get_policy(pol_id: int, s: AsyncSession = Depends(get_session)):
    p = await s.get(Policy, pol_id)
    if not p:
        raise HTTPException(404, "Polityka nie istnieje")
    return await _policy_out(s, p)


@router.post("", response_model=PolicyOut, status_code=201, summary="Nowa polityka")
async def create_policy(body: PolicyCreate, s: AsyncSession = Depends(get_session)):
    p = Policy(**body.model_dump())
    s.add(p)
    await s.flush()
    p.ref_id = f"POL-{p.id:04d}"
    await s.commit()
    await s.refresh(p)
    return await _policy_out(s, p)


@router.put("/{pol_id}", response_model=PolicyOut, summary="Edycja polityki")
async def update_policy(pol_id: int, body: PolicyUpdate, s: AsyncSession = Depends(get_session)):
    p = await s.get(Policy, pol_id)
    if not p:
        raise HTTPException(404, "Polityka nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await s.commit()
    await s.refresh(p)
    return await _policy_out(s, p)


@router.delete("/{pol_id}", summary="Archiwizuj politykę")
async def archive_policy(pol_id: int, s: AsyncSession = Depends(get_session)):
    p = await s.get(Policy, pol_id)
    if not p:
        raise HTTPException(404, "Polityka nie istnieje")
    p.is_active = False
    await s.commit()
    return {"status": "archived", "id": pol_id}


# ═══════════════════ MAPPINGS ═══════════════════

@router.get("/{pol_id}/mappings", response_model=list[PolicyMappingOut], summary="Mapowania polityki")
async def list_mappings(pol_id: int, s: AsyncSession = Depends(get_session)):
    q = select(PolicyStandardMapping).where(PolicyStandardMapping.policy_id == pol_id)
    return (await s.execute(q)).scalars().all()


@router.post("/{pol_id}/mappings", response_model=PolicyMappingOut, status_code=201, summary="Dodaj mapowanie")
async def create_mapping(pol_id: int, body: PolicyMappingCreate, s: AsyncSession = Depends(get_session)):
    p = await s.get(Policy, pol_id)
    if not p:
        raise HTTPException(404, "Polityka nie istnieje")
    m = PolicyStandardMapping(policy_id=pol_id, **body.model_dump())
    s.add(m)
    await s.commit()
    await s.refresh(m)
    return m


@router.delete("/{pol_id}/mappings/{map_id}", summary="Usuń mapowanie")
async def delete_mapping(pol_id: int, map_id: int, s: AsyncSession = Depends(get_session)):
    m = await s.get(PolicyStandardMapping, map_id)
    if not m or m.policy_id != pol_id:
        raise HTTPException(404, "Mapowanie nie istnieje")
    await s.delete(m)
    await s.commit()
    return {"status": "deleted", "id": map_id}


# ═══════════════════ ACKNOWLEDGMENTS ═══════════════════

@router.get("/{pol_id}/acknowledgments", response_model=list[PolicyAcknowledgmentOut], summary="Potwierdzenia polityki")
async def list_acknowledgments(pol_id: int, s: AsyncSession = Depends(get_session)):
    q = select(PolicyAcknowledgment).where(PolicyAcknowledgment.policy_id == pol_id)
    return (await s.execute(q)).scalars().all()


@router.post("/{pol_id}/acknowledgments", response_model=PolicyAcknowledgmentOut, status_code=201, summary="Dodaj potwierdzenie")
async def create_acknowledgment(pol_id: int, body: PolicyAcknowledgmentCreate, s: AsyncSession = Depends(get_session)):
    p = await s.get(Policy, pol_id)
    if not p:
        raise HTTPException(404, "Polityka nie istnieje")
    ack = PolicyAcknowledgment(policy_id=pol_id, **body.model_dump())
    s.add(ack)
    await s.commit()
    await s.refresh(ack)
    return ack
