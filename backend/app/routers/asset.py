"""
Asset registry module — /api/v1/assets
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.database import get_session
from app.models.asset import Asset
from app.models.dictionary import DictionaryEntry
from app.models.org_unit import OrgUnit
from app.models.risk import Risk
from app.schemas.asset import AssetCreate, AssetOut, AssetUpdate

router = APIRouter(prefix="/api/v1/assets", tags=["Rejestr aktywów"])


# ── helper: build full AssetOut from row ──

async def _asset_out(s: AsyncSession, asset: Asset) -> AssetOut:
    """Load all joined names for a single Asset entity."""
    async def _de_label(entry_id: int | None) -> str | None:
        if entry_id is None:
            return None
        e = await s.get(DictionaryEntry, entry_id)
        return e.label if e else None

    org = await s.get(OrgUnit, asset.org_unit_id) if asset.org_unit_id else None
    parent = await s.get(Asset, asset.parent_id) if asset.parent_id else None

    # Count linked risks
    risk_count_q = select(func.count()).select_from(Risk).where(Risk.asset_id == asset.id)
    risk_count = (await s.execute(risk_count_q)).scalar() or 0

    return AssetOut(
        id=asset.id,
        name=asset.name,
        asset_type_id=asset.asset_type_id,
        asset_type_name=await _de_label(asset.asset_type_id),
        category_id=asset.category_id,
        category_name=await _de_label(asset.category_id),
        org_unit_id=asset.org_unit_id,
        org_unit_name=org.name if org else None,
        parent_id=asset.parent_id,
        parent_name=parent.name if parent else None,
        owner=asset.owner,
        description=asset.description,
        location=asset.location,
        sensitivity_id=asset.sensitivity_id,
        sensitivity_name=await _de_label(asset.sensitivity_id),
        criticality_id=asset.criticality_id,
        criticality_name=await _de_label(asset.criticality_id),
        is_active=asset.is_active,
        risk_count=risk_count,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


# ═══════════════════ LIST ═══════════════════

@router.get("", response_model=list[AssetOut], summary="Lista aktywów")
async def list_assets(
    org_unit_id: int | None = Query(None),
    category_id: int | None = Query(None),
    asset_type_id: int | None = Query(None),
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(Asset)
    if not include_archived:
        q = q.where(Asset.is_active.is_(True))
    if org_unit_id is not None:
        q = q.where(Asset.org_unit_id == org_unit_id)
    if category_id is not None:
        q = q.where(Asset.category_id == category_id)
    if asset_type_id is not None:
        q = q.where(Asset.asset_type_id == asset_type_id)
    q = q.order_by(Asset.name)
    assets = (await s.execute(q)).scalars().all()
    return [await _asset_out(s, a) for a in assets]


# ═══════════════════ GET ═══════════════════

@router.get("/{asset_id}", response_model=AssetOut, summary="Pobierz aktyw")
async def get_asset(asset_id: int, s: AsyncSession = Depends(get_session)):
    asset = await s.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Aktyw nie istnieje")
    return await _asset_out(s, asset)


# ═══════════════════ CREATE ═══════════════════

@router.post("", response_model=AssetOut, status_code=201, summary="Utwórz aktyw")
async def create_asset(body: AssetCreate, s: AsyncSession = Depends(get_session)):
    asset = Asset(**body.model_dump())
    s.add(asset)
    await s.commit()
    await s.refresh(asset)
    return await _asset_out(s, asset)


# ═══════════════════ UPDATE ═══════════════════

@router.put("/{asset_id}", response_model=AssetOut, summary="Edytuj aktyw")
async def update_asset(asset_id: int, body: AssetUpdate, s: AsyncSession = Depends(get_session)):
    asset = await s.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Aktyw nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(asset, k, v)
    await s.commit()
    await s.refresh(asset)
    return await _asset_out(s, asset)


# ═══════════════════ ARCHIVE ═══════════════════

@router.delete("/{asset_id}", summary="Archiwizuj aktyw")
async def archive_asset(asset_id: int, s: AsyncSession = Depends(get_session)):
    asset = await s.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Aktyw nie istnieje")
    asset.is_active = False
    await s.commit()
    return {"status": "archived", "id": asset_id}
