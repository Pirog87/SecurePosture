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
from app.models.risk import Risk
from app.schemas.policy_exception import (
    ExceptionWithRiskCreate,
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

    # Load linked risk score/level
    risk_score = None
    risk_level = None
    if ex.risk_id:
        risk = await s.get(Risk, ex.risk_id)
        if risk:
            risk_score = float(risk.risk_score) if risk.risk_score is not None else None
            risk_level = risk.risk_level

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
        risk_id=ex.risk_id, risk_score=risk_score, risk_level=risk_level,
        vulnerability_id=ex.vulnerability_id,
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


# ═══════════════════ CREATE WITH RISK ═══════════════════

@router.post(
    "/with-risk",
    response_model=PolicyExceptionOut,
    status_code=201,
    summary="Nowy wyjątek z obowiązkową oceną ryzyka odstępstwa",
)
async def create_exception_with_risk(
    body: ExceptionWithRiskCreate, s: AsyncSession = Depends(get_session),
):
    """Create a policy exception and register the deviation risk in one transaction.
    The risk is saved to the risk register and linked to the exception.
    """
    # 1. Create the deviation risk
    risk = Risk(
        org_unit_id=body.org_unit_id,
        asset_name=body.risk_asset_name,
        security_area_id=body.risk_security_area_id,
        threat_id=body.risk_threat_id,
        vulnerability_id=body.risk_vulnerability_id,
        consequence_description=body.risk_consequence,
        existing_controls=body.risk_existing_controls,
        impact_level=body.risk_impact_level,
        probability_level=body.risk_probability_level,
        safeguard_rating=body.risk_safeguard_rating,
        owner=body.risk_owner,
        strategy_id=body.risk_strategy_id,
        treatment_plan=body.risk_treatment_plan,
        risk_source=f"Wyjątek od polityki: {body.title}",
        source_type="policy_exception",
    )
    s.add(risk)
    await s.flush()

    # 2. Determine risk_level_id from dictionary based on computed risk_level
    risk_level_id = None
    if risk.risk_level:
        from app.models.dictionary import DictionaryType
        level_code = {"high": "high", "medium": "medium", "low": "low"}.get(risk.risk_level)
        if level_code:
            q = (
                select(DictionaryEntry.id)
                .join(DictionaryType, DictionaryEntry.dict_type_id == DictionaryType.id)
                .where(DictionaryType.code == "risk_level")
                .where(DictionaryEntry.code == level_code)
                .limit(1)
            )
            risk_level_id = (await s.execute(q)).scalar()

    # 3. Create the exception linked to the risk
    ex = PolicyException(
        title=body.title,
        description=body.description,
        policy_id=body.policy_id,
        category_id=body.category_id,
        org_unit_id=body.org_unit_id,
        asset_id=body.asset_id,
        requested_by=body.requested_by,
        approved_by=body.approved_by,
        risk_level_id=risk_level_id,
        compensating_controls=body.compensating_controls,
        status_id=body.status_id,
        start_date=body.start_date,
        expiry_date=body.expiry_date,
        review_date=body.expiry_date - timedelta(days=30),
        vulnerability_id=body.vulnerability_id,
        risk_id=risk.id,
    )
    s.add(ex)
    await s.flush()
    ex.ref_id = f"EXC-{ex.id:04d}"

    # Link the risk back to the exception
    risk.source_id = ex.id

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
