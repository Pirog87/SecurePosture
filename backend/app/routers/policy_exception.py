"""
Policy exception registry module — /api/v1/exceptions
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.policy_exception import PolicyException
from app.models.policy import Policy
from app.models.asset import Asset
from app.models.dictionary import DictionaryEntry
from app.models.org_unit import OrgUnit
from app.schemas.policy_exception import (
    PolicyExceptionCreate, PolicyExceptionOut,
    PolicyExceptionStatusChange, PolicyExceptionUpdate,
)

router = APIRouter(prefix="/api/v1/exceptions", tags=["Rejestr wyjątków"])


async def _de_label(s: AsyncSession, entry_id: int | None) -> str | None:
    if entry_id is None:
        return None
    e = await s.get(DictionaryEntry, entry_id)
    return e.label if e else None


async def _exc_out(s: AsyncSession, ex: PolicyException) -> PolicyExceptionOut:
    org = await s.get(OrgUnit, ex.org_unit_id) if ex.org_unit_id else None
    asset = await s.get(Asset, ex.asset_id) if ex.asset_id else None
    pol = await s.get(Policy, ex.policy_id) if ex.policy_id else None
    return PolicyExceptionOut(
        id=ex.id, ref_id=ex.ref_id, title=ex.title, description=ex.description,
        policy_id=ex.policy_id, policy_title=pol.title if pol else None,
        category_id=ex.category_id, category_name=await _de_label(s, ex.category_id),
        org_unit_id=ex.org_unit_id, org_unit_name=org.name if org else None,
        asset_id=ex.asset_id, asset_name=asset.name if asset else None,
        requested_by=ex.requested_by, approved_by=ex.approved_by,
        risk_level_id=ex.risk_level_id, risk_level_name=await _de_label(s, ex.risk_level_id),
        compensating_controls=ex.compensating_controls,
        status_id=ex.status_id, status_name=await _de_label(s, ex.status_id),
        start_date=ex.start_date, expiry_date=ex.expiry_date,
        review_date=ex.review_date, closed_at=ex.closed_at,
        risk_id=ex.risk_id, vulnerability_id=ex.vulnerability_id,
        is_active=ex.is_active, created_at=ex.created_at, updated_at=ex.updated_at,
    )


# ═══════════════════ LIST ═══════════════════

@router.get("", response_model=list[PolicyExceptionOut], summary="Lista wyjątków")
async def list_exceptions(
    org_unit_id: int | None = Query(None),
    status_id: int | None = Query(None),
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(PolicyException)
    if not include_archived:
        q = q.where(PolicyException.is_active.is_(True))
    if org_unit_id is not None:
        q = q.where(PolicyException.org_unit_id == org_unit_id)
    if status_id is not None:
        q = q.where(PolicyException.status_id == status_id)
    q = q.order_by(PolicyException.expiry_date)
    excs = (await s.execute(q)).scalars().all()
    return [await _exc_out(s, ex) for ex in excs]


@router.get("/{exc_id}", response_model=PolicyExceptionOut, summary="Szczegóły wyjątku")
async def get_exception(exc_id: int, s: AsyncSession = Depends(get_session)):
    ex = await s.get(PolicyException, exc_id)
    if not ex:
        raise HTTPException(404, "Wyjątek nie istnieje")
    return await _exc_out(s, ex)


@router.post("", response_model=PolicyExceptionOut, status_code=201, summary="Nowy wyjątek")
async def create_exception(body: PolicyExceptionCreate, s: AsyncSession = Depends(get_session)):
    ex = PolicyException(**body.model_dump())
    # Auto-calculate review_date = expiry_date - 30 days
    ex.review_date = ex.expiry_date - timedelta(days=30)
    s.add(ex)
    await s.flush()
    ex.ref_id = f"EXC-{ex.id:04d}"
    await s.commit()
    await s.refresh(ex)
    return await _exc_out(s, ex)


@router.put("/{exc_id}", response_model=PolicyExceptionOut, summary="Edycja wyjątku")
async def update_exception(exc_id: int, body: PolicyExceptionUpdate, s: AsyncSession = Depends(get_session)):
    ex = await s.get(PolicyException, exc_id)
    if not ex:
        raise HTTPException(404, "Wyjątek nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ex, k, v)
    # Recalculate review_date if expiry changed
    if body.expiry_date is not None:
        ex.review_date = body.expiry_date - timedelta(days=30)
    await s.commit()
    await s.refresh(ex)
    return await _exc_out(s, ex)


@router.patch("/{exc_id}/status", response_model=PolicyExceptionOut, summary="Zmiana statusu wyjątku")
async def change_exception_status(
    exc_id: int, body: PolicyExceptionStatusChange, s: AsyncSession = Depends(get_session),
):
    ex = await s.get(PolicyException, exc_id)
    if not ex:
        raise HTTPException(404, "Wyjątek nie istnieje")
    ex.status_id = body.status_id

    status_entry = await s.get(DictionaryEntry, body.status_id)
    if status_entry and status_entry.code == "closed" and ex.closed_at is None:
        ex.closed_at = date.today()

    await s.commit()
    await s.refresh(ex)
    return await _exc_out(s, ex)


@router.delete("/{exc_id}", summary="Archiwizuj wyjątek")
async def archive_exception(exc_id: int, s: AsyncSession = Depends(get_session)):
    ex = await s.get(PolicyException, exc_id)
    if not ex:
        raise HTTPException(404, "Wyjątek nie istnieje")
    ex.is_active = False
    await s.commit()
    return {"status": "archived", "id": exc_id}
