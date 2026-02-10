"""
Asset registry module — /api/v1/assets
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.database import get_session
from app.models.asset import Asset, AssetRelationship
from app.models.dictionary import DictionaryEntry
from app.models.org_unit import OrgUnit
from app.models.risk import Risk
from app.schemas.asset import (
    AssetCreate, AssetGraph, AssetGraphEdge, AssetGraphNode,
    AssetOut, AssetRelationshipCreate, AssetRelationshipOut, AssetUpdate,
)

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


# ═══════════════════ RELATIONSHIPS ═══════════════════

@router.get("/relationships/all", response_model=list[AssetRelationshipOut], summary="Wszystkie relacje")
async def list_all_relationships(s: AsyncSession = Depends(get_session)):
    q = select(AssetRelationship).order_by(AssetRelationship.created_at.desc())
    rels = (await s.execute(q)).scalars().all()
    result = []
    for r in rels:
        src = await s.get(Asset, r.source_asset_id)
        tgt = await s.get(Asset, r.target_asset_id)
        result.append(AssetRelationshipOut(
            id=r.id, source_asset_id=r.source_asset_id,
            source_asset_name=src.name if src else None,
            target_asset_id=r.target_asset_id,
            target_asset_name=tgt.name if tgt else None,
            relationship_type=r.relationship_type,
            description=r.description, created_at=r.created_at,
        ))
    return result


@router.get("/{asset_id}/relationships", response_model=list[AssetRelationshipOut], summary="Relacje aktywa")
async def list_asset_relationships(asset_id: int, s: AsyncSession = Depends(get_session)):
    q = select(AssetRelationship).where(
        (AssetRelationship.source_asset_id == asset_id) | (AssetRelationship.target_asset_id == asset_id)
    )
    rels = (await s.execute(q)).scalars().all()
    result = []
    for r in rels:
        src = await s.get(Asset, r.source_asset_id)
        tgt = await s.get(Asset, r.target_asset_id)
        result.append(AssetRelationshipOut(
            id=r.id, source_asset_id=r.source_asset_id,
            source_asset_name=src.name if src else None,
            target_asset_id=r.target_asset_id,
            target_asset_name=tgt.name if tgt else None,
            relationship_type=r.relationship_type,
            description=r.description, created_at=r.created_at,
        ))
    return result


@router.post("/relationships", response_model=AssetRelationshipOut, status_code=201, summary="Dodaj relacje")
async def create_relationship(body: AssetRelationshipCreate, s: AsyncSession = Depends(get_session)):
    src = await s.get(Asset, body.source_asset_id)
    tgt = await s.get(Asset, body.target_asset_id)
    if not src or not tgt:
        raise HTTPException(404, "Aktyw nie istnieje")
    if body.source_asset_id == body.target_asset_id:
        raise HTTPException(400, "Nie mozna powiazac aktywa z samym soba")
    rel = AssetRelationship(**body.model_dump())
    s.add(rel)
    await s.commit()
    await s.refresh(rel)
    return AssetRelationshipOut(
        id=rel.id, source_asset_id=rel.source_asset_id,
        source_asset_name=src.name, target_asset_id=rel.target_asset_id,
        target_asset_name=tgt.name, relationship_type=rel.relationship_type,
        description=rel.description, created_at=rel.created_at,
    )


@router.delete("/relationships/{rel_id}", summary="Usun relacje")
async def delete_relationship(rel_id: int, s: AsyncSession = Depends(get_session)):
    rel = await s.get(AssetRelationship, rel_id)
    if not rel:
        raise HTTPException(404, "Relacja nie istnieje")
    await s.delete(rel)
    await s.commit()
    return {"status": "deleted", "id": rel_id}


@router.get("/graph/data", response_model=AssetGraph, summary="Graf relacji aktywow")
async def get_asset_graph(s: AsyncSession = Depends(get_session)):
    # All active assets
    assets_q = select(Asset).where(Asset.is_active.is_(True))
    assets = (await s.execute(assets_q)).scalars().all()
    asset_map = {a.id: a for a in assets}

    # All relationships
    rels_q = select(AssetRelationship)
    rels = (await s.execute(rels_q)).scalars().all()

    # Find connected asset IDs
    connected_ids = set()
    valid_edges = []
    for r in rels:
        if r.source_asset_id in asset_map and r.target_asset_id in asset_map:
            connected_ids.add(r.source_asset_id)
            connected_ids.add(r.target_asset_id)
            valid_edges.append(r)

    # Also add parent-child relationships
    for a in assets:
        if a.parent_id and a.parent_id in asset_map:
            connected_ids.add(a.id)
            connected_ids.add(a.parent_id)

    # Build nodes for connected assets only
    nodes = []
    for aid in connected_ids:
        a = asset_map[aid]
        risk_count_q = select(func.count()).select_from(Risk).where(Risk.asset_id == a.id)
        risk_count = (await s.execute(risk_count_q)).scalar() or 0
        org = await s.get(OrgUnit, a.org_unit_id) if a.org_unit_id else None
        async def _dl(eid):
            if not eid: return None
            e = await s.get(DictionaryEntry, eid)
            return e.label if e else None
        nodes.append(AssetGraphNode(
            id=a.id, name=a.name,
            asset_type_name=await _dl(a.asset_type_id),
            criticality_name=await _dl(a.criticality_id),
            org_unit_name=org.name if org else None,
            risk_count=risk_count,
        ))

    # Build edges
    edges = []
    for r in valid_edges:
        edges.append(AssetGraphEdge(
            id=r.id, source=r.source_asset_id, target=r.target_asset_id,
            type=r.relationship_type, description=r.description,
        ))
    # Parent-child edges
    for a in assets:
        if a.parent_id and a.parent_id in asset_map and a.id in connected_ids:
            edges.append(AssetGraphEdge(
                id=-a.id, source=a.parent_id, target=a.id,
                type="contains", description="Relacja nadrzedny-podrzedny",
            ))

    return AssetGraph(nodes=nodes, edges=edges)
