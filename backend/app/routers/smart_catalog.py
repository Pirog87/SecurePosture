"""
Smart Catalog API — catalogs CRUD, suggestions, correlations, AI config, feature flags.
"""
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.smart_catalog import (
    AIProviderConfig,
    ControlAssetCategory,
    ControlCatalog,
    ThreatAssetCategory,
    ThreatCatalog,
    ThreatControlLink,
    ThreatWeaknessLink,
    WeaknessAssetCategory,
    WeaknessCatalog,
    WeaknessControlLink,
)
from app.schemas.smart_catalog import (
    AIConfigOut,
    AIConfigUpdate,
    AITestResult,
    ControlCatalogCreate,
    ControlCatalogOut,
    ControlCatalogUpdate,
    ControlSuggestion,
    CoverageResult,
    FeatureFlagsOut,
    LinkOut,
    QuickRiskDraft,
    ThreatCatalogCreate,
    ThreatCatalogOut,
    ThreatCatalogUpdate,
    ThreatControlLinkCreate,
    ThreatSuggestion,
    ThreatWeaknessLinkCreate,
    WeaknessCatalogCreate,
    WeaknessCatalogOut,
    WeaknessCatalogUpdate,
    WeaknessControlLinkCreate,
    WeaknessSuggestion,
)
from app.services.suggestion_engine import SuggestionEngine

router = APIRouter(tags=["Smart Catalog"])


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

async def _get_asset_category_ids(session: AsyncSession, model_class, item_id: int) -> list[int]:
    """Get asset_category_ids for a catalog item."""
    id_col = (
        model_class.threat_id if hasattr(model_class, "threat_id")
        else model_class.weakness_id if hasattr(model_class, "weakness_id")
        else model_class.control_id
    )
    q = select(model_class.asset_category_id).where(id_col == item_id)
    rows = (await session.execute(q)).scalars().all()
    return list(rows)


async def _sync_asset_categories(session: AsyncSession, m2m_class, fk_name: str,
                                  item_id: int, category_ids: list[int]):
    """Replace M2M asset category assignments."""
    id_col = getattr(m2m_class, fk_name)
    # Delete existing
    existing = (await session.execute(
        select(m2m_class).where(id_col == item_id)
    )).scalars().all()
    for e in existing:
        await session.delete(e)
    # Insert new
    for cid in category_ids:
        obj = m2m_class(**{fk_name: item_id, "asset_category_id": cid})
        session.add(obj)


# ═══════════════════════════════════════════════════════════════════
# THREAT CATALOG CRUD
# ═══════════════════════════════════════════════════════════════════

@router.get("/api/v1/threat-catalog", response_model=list[ThreatCatalogOut], summary="Lista zagrozenia (Smart Catalog)")
async def list_threat_catalog(
    asset_category_id: int | None = Query(None),
    category: str | None = Query(None),
    cia: str | None = Query(None, description="C,I,A filter e.g. 'C,I'"),
    search: str | None = Query(None),
    is_active: bool = Query(True),
    s: AsyncSession = Depends(get_session),
):
    q = select(ThreatCatalog)
    if is_active:
        q = q.where(ThreatCatalog.is_active.is_(True))
    if category:
        q = q.where(ThreatCatalog.category == category)
    if search:
        pattern = f"%{search}%"
        q = q.where(or_(
            ThreatCatalog.name.ilike(pattern),
            ThreatCatalog.ref_id.ilike(pattern),
            ThreatCatalog.description.ilike(pattern),
        ))
    if asset_category_id:
        q = q.join(ThreatAssetCategory).where(
            ThreatAssetCategory.asset_category_id == asset_category_id
        )
    q = q.order_by(ThreatCatalog.ref_id)
    rows = (await s.execute(q)).scalars().all()

    result = []
    for t in rows:
        cats = await _get_asset_category_ids(s, ThreatAssetCategory, t.id)
        result.append(ThreatCatalogOut(
            id=t.id, ref_id=t.ref_id, name=t.name, description=t.description,
            category=t.category, source=t.source, cia_impact=t.cia_impact,
            is_system=t.is_system, is_active=t.is_active,
            org_unit_id=t.org_unit_id, created_by=t.created_by,
            created_at=t.created_at, updated_at=t.updated_at,
            asset_category_ids=cats,
        ))
    return result


@router.get("/api/v1/threat-catalog/{item_id}", response_model=ThreatCatalogOut)
async def get_threat_catalog(item_id: int, s: AsyncSession = Depends(get_session)):
    t = await s.get(ThreatCatalog, item_id)
    if not t:
        raise HTTPException(404, "Zagrozenie nie istnieje")
    cats = await _get_asset_category_ids(s, ThreatAssetCategory, t.id)
    return ThreatCatalogOut(
        id=t.id, ref_id=t.ref_id, name=t.name, description=t.description,
        category=t.category, source=t.source, cia_impact=t.cia_impact,
        is_system=t.is_system, is_active=t.is_active,
        org_unit_id=t.org_unit_id, created_by=t.created_by,
        created_at=t.created_at, updated_at=t.updated_at,
        asset_category_ids=cats,
    )


@router.post("/api/v1/threat-catalog", response_model=ThreatCatalogOut, status_code=201)
async def create_threat_catalog(body: ThreatCatalogCreate, s: AsyncSession = Depends(get_session)):
    t = ThreatCatalog(
        ref_id=body.ref_id, name=body.name, description=body.description,
        category=body.category, source=body.source, cia_impact=body.cia_impact,
        org_unit_id=body.org_unit_id,
    )
    s.add(t)
    await s.flush()
    for cid in body.asset_category_ids:
        s.add(ThreatAssetCategory(threat_id=t.id, asset_category_id=cid))
    await s.commit()
    await s.refresh(t)
    return ThreatCatalogOut(
        id=t.id, ref_id=t.ref_id, name=t.name, description=t.description,
        category=t.category, source=t.source, cia_impact=t.cia_impact,
        is_system=t.is_system, is_active=t.is_active,
        org_unit_id=t.org_unit_id, created_by=t.created_by,
        created_at=t.created_at, updated_at=t.updated_at,
        asset_category_ids=body.asset_category_ids,
    )


@router.put("/api/v1/threat-catalog/{item_id}", response_model=ThreatCatalogOut)
async def update_threat_catalog(item_id: int, body: ThreatCatalogUpdate, s: AsyncSession = Depends(get_session)):
    t = await s.get(ThreatCatalog, item_id)
    if not t:
        raise HTTPException(404, "Zagrozenie nie istnieje")
    if t.is_system:
        raise HTTPException(403, "Nie mozna edytowac systemowego wpisu")
    for k, v in body.model_dump(exclude_unset=True, exclude={"asset_category_ids"}).items():
        setattr(t, k, v)
    if body.asset_category_ids is not None:
        await _sync_asset_categories(s, ThreatAssetCategory, "threat_id", item_id, body.asset_category_ids)
    await s.commit()
    await s.refresh(t)
    cats = await _get_asset_category_ids(s, ThreatAssetCategory, t.id)
    return ThreatCatalogOut(
        id=t.id, ref_id=t.ref_id, name=t.name, description=t.description,
        category=t.category, source=t.source, cia_impact=t.cia_impact,
        is_system=t.is_system, is_active=t.is_active,
        org_unit_id=t.org_unit_id, created_by=t.created_by,
        created_at=t.created_at, updated_at=t.updated_at,
        asset_category_ids=cats,
    )


@router.delete("/api/v1/threat-catalog/{item_id}")
async def archive_threat_catalog(item_id: int, s: AsyncSession = Depends(get_session)):
    t = await s.get(ThreatCatalog, item_id)
    if not t:
        raise HTTPException(404, "Zagrozenie nie istnieje")
    t.is_active = False
    await s.commit()
    return {"status": "archived", "id": item_id}


# ═══════════════════════════════════════════════════════════════════
# WEAKNESS CATALOG CRUD
# ═══════════════════════════════════════════════════════════════════

@router.get("/api/v1/weakness-catalog", response_model=list[WeaknessCatalogOut], summary="Lista slabosci")
async def list_weakness_catalog(
    asset_category_id: int | None = Query(None),
    category: str | None = Query(None),
    search: str | None = Query(None),
    is_active: bool = Query(True),
    s: AsyncSession = Depends(get_session),
):
    q = select(WeaknessCatalog)
    if is_active:
        q = q.where(WeaknessCatalog.is_active.is_(True))
    if category:
        q = q.where(WeaknessCatalog.category == category)
    if search:
        pattern = f"%{search}%"
        q = q.where(or_(
            WeaknessCatalog.name.ilike(pattern),
            WeaknessCatalog.ref_id.ilike(pattern),
            WeaknessCatalog.description.ilike(pattern),
        ))
    if asset_category_id:
        q = q.join(WeaknessAssetCategory).where(
            WeaknessAssetCategory.asset_category_id == asset_category_id
        )
    q = q.order_by(WeaknessCatalog.ref_id)
    rows = (await s.execute(q)).scalars().all()

    result = []
    for w in rows:
        cats = await _get_asset_category_ids(s, WeaknessAssetCategory, w.id)
        result.append(WeaknessCatalogOut(
            id=w.id, ref_id=w.ref_id, name=w.name, description=w.description,
            category=w.category, is_system=w.is_system, is_active=w.is_active,
            org_unit_id=w.org_unit_id, created_by=w.created_by,
            created_at=w.created_at, updated_at=w.updated_at,
            asset_category_ids=cats,
        ))
    return result


@router.get("/api/v1/weakness-catalog/{item_id}", response_model=WeaknessCatalogOut)
async def get_weakness_catalog(item_id: int, s: AsyncSession = Depends(get_session)):
    w = await s.get(WeaknessCatalog, item_id)
    if not w:
        raise HTTPException(404, "Slabosc nie istnieje")
    cats = await _get_asset_category_ids(s, WeaknessAssetCategory, w.id)
    return WeaknessCatalogOut(
        id=w.id, ref_id=w.ref_id, name=w.name, description=w.description,
        category=w.category, is_system=w.is_system, is_active=w.is_active,
        org_unit_id=w.org_unit_id, created_by=w.created_by,
        created_at=w.created_at, updated_at=w.updated_at,
        asset_category_ids=cats,
    )


@router.post("/api/v1/weakness-catalog", response_model=WeaknessCatalogOut, status_code=201)
async def create_weakness_catalog(body: WeaknessCatalogCreate, s: AsyncSession = Depends(get_session)):
    w = WeaknessCatalog(
        ref_id=body.ref_id, name=body.name, description=body.description,
        category=body.category, org_unit_id=body.org_unit_id,
    )
    s.add(w)
    await s.flush()
    for cid in body.asset_category_ids:
        s.add(WeaknessAssetCategory(weakness_id=w.id, asset_category_id=cid))
    await s.commit()
    await s.refresh(w)
    return WeaknessCatalogOut(
        id=w.id, ref_id=w.ref_id, name=w.name, description=w.description,
        category=w.category, is_system=w.is_system, is_active=w.is_active,
        org_unit_id=w.org_unit_id, created_by=w.created_by,
        created_at=w.created_at, updated_at=w.updated_at,
        asset_category_ids=body.asset_category_ids,
    )


@router.put("/api/v1/weakness-catalog/{item_id}", response_model=WeaknessCatalogOut)
async def update_weakness_catalog(item_id: int, body: WeaknessCatalogUpdate, s: AsyncSession = Depends(get_session)):
    w = await s.get(WeaknessCatalog, item_id)
    if not w:
        raise HTTPException(404, "Slabosc nie istnieje")
    if w.is_system:
        raise HTTPException(403, "Nie mozna edytowac systemowego wpisu")
    for k, v in body.model_dump(exclude_unset=True, exclude={"asset_category_ids"}).items():
        setattr(w, k, v)
    if body.asset_category_ids is not None:
        await _sync_asset_categories(s, WeaknessAssetCategory, "weakness_id", item_id, body.asset_category_ids)
    await s.commit()
    await s.refresh(w)
    cats = await _get_asset_category_ids(s, WeaknessAssetCategory, w.id)
    return WeaknessCatalogOut(
        id=w.id, ref_id=w.ref_id, name=w.name, description=w.description,
        category=w.category, is_system=w.is_system, is_active=w.is_active,
        org_unit_id=w.org_unit_id, created_by=w.created_by,
        created_at=w.created_at, updated_at=w.updated_at,
        asset_category_ids=cats,
    )


@router.delete("/api/v1/weakness-catalog/{item_id}")
async def archive_weakness_catalog(item_id: int, s: AsyncSession = Depends(get_session)):
    w = await s.get(WeaknessCatalog, item_id)
    if not w:
        raise HTTPException(404, "Slabosc nie istnieje")
    w.is_active = False
    await s.commit()
    return {"status": "archived", "id": item_id}


# ═══════════════════════════════════════════════════════════════════
# CONTROL CATALOG CRUD
# ═══════════════════════════════════════════════════════════════════

@router.get("/api/v1/control-catalog", response_model=list[ControlCatalogOut], summary="Lista zabezpieczen")
async def list_control_catalog(
    asset_category_id: int | None = Query(None),
    category: str | None = Query(None),
    implementation_type: str | None = Query(None),
    search: str | None = Query(None),
    is_active: bool = Query(True),
    s: AsyncSession = Depends(get_session),
):
    q = select(ControlCatalog)
    if is_active:
        q = q.where(ControlCatalog.is_active.is_(True))
    if category:
        q = q.where(ControlCatalog.category == category)
    if implementation_type:
        q = q.where(ControlCatalog.implementation_type == implementation_type)
    if search:
        pattern = f"%{search}%"
        q = q.where(or_(
            ControlCatalog.name.ilike(pattern),
            ControlCatalog.ref_id.ilike(pattern),
            ControlCatalog.description.ilike(pattern),
        ))
    if asset_category_id:
        q = q.join(ControlAssetCategory).where(
            ControlAssetCategory.asset_category_id == asset_category_id
        )
    q = q.order_by(ControlCatalog.ref_id)
    rows = (await s.execute(q)).scalars().all()

    result = []
    for c in rows:
        cats = await _get_asset_category_ids(s, ControlAssetCategory, c.id)
        result.append(ControlCatalogOut(
            id=c.id, ref_id=c.ref_id, name=c.name, description=c.description,
            category=c.category, implementation_type=c.implementation_type,
            is_system=c.is_system, is_active=c.is_active,
            org_unit_id=c.org_unit_id, created_by=c.created_by,
            created_at=c.created_at, updated_at=c.updated_at,
            asset_category_ids=cats,
        ))
    return result


@router.get("/api/v1/control-catalog/{item_id}", response_model=ControlCatalogOut)
async def get_control_catalog(item_id: int, s: AsyncSession = Depends(get_session)):
    c = await s.get(ControlCatalog, item_id)
    if not c:
        raise HTTPException(404, "Zabezpieczenie nie istnieje")
    cats = await _get_asset_category_ids(s, ControlAssetCategory, c.id)
    return ControlCatalogOut(
        id=c.id, ref_id=c.ref_id, name=c.name, description=c.description,
        category=c.category, implementation_type=c.implementation_type,
        is_system=c.is_system, is_active=c.is_active,
        org_unit_id=c.org_unit_id, created_by=c.created_by,
        created_at=c.created_at, updated_at=c.updated_at,
        asset_category_ids=cats,
    )


@router.post("/api/v1/control-catalog", response_model=ControlCatalogOut, status_code=201)
async def create_control_catalog(body: ControlCatalogCreate, s: AsyncSession = Depends(get_session)):
    c = ControlCatalog(
        ref_id=body.ref_id, name=body.name, description=body.description,
        category=body.category, implementation_type=body.implementation_type,
        org_unit_id=body.org_unit_id,
    )
    s.add(c)
    await s.flush()
    for cid in body.asset_category_ids:
        s.add(ControlAssetCategory(control_id=c.id, asset_category_id=cid))
    await s.commit()
    await s.refresh(c)
    return ControlCatalogOut(
        id=c.id, ref_id=c.ref_id, name=c.name, description=c.description,
        category=c.category, implementation_type=c.implementation_type,
        is_system=c.is_system, is_active=c.is_active,
        org_unit_id=c.org_unit_id, created_by=c.created_by,
        created_at=c.created_at, updated_at=c.updated_at,
        asset_category_ids=body.asset_category_ids,
    )


@router.put("/api/v1/control-catalog/{item_id}", response_model=ControlCatalogOut)
async def update_control_catalog(item_id: int, body: ControlCatalogUpdate, s: AsyncSession = Depends(get_session)):
    c = await s.get(ControlCatalog, item_id)
    if not c:
        raise HTTPException(404, "Zabezpieczenie nie istnieje")
    if c.is_system:
        raise HTTPException(403, "Nie mozna edytowac systemowego wpisu")
    for k, v in body.model_dump(exclude_unset=True, exclude={"asset_category_ids"}).items():
        setattr(c, k, v)
    if body.asset_category_ids is not None:
        await _sync_asset_categories(s, ControlAssetCategory, "control_id", item_id, body.asset_category_ids)
    await s.commit()
    await s.refresh(c)
    cats = await _get_asset_category_ids(s, ControlAssetCategory, c.id)
    return ControlCatalogOut(
        id=c.id, ref_id=c.ref_id, name=c.name, description=c.description,
        category=c.category, implementation_type=c.implementation_type,
        is_system=c.is_system, is_active=c.is_active,
        org_unit_id=c.org_unit_id, created_by=c.created_by,
        created_at=c.created_at, updated_at=c.updated_at,
        asset_category_ids=cats,
    )


@router.delete("/api/v1/control-catalog/{item_id}")
async def archive_control_catalog(item_id: int, s: AsyncSession = Depends(get_session)):
    c = await s.get(ControlCatalog, item_id)
    if not c:
        raise HTTPException(404, "Zabezpieczenie nie istnieje")
    c.is_active = False
    await s.commit()
    return {"status": "archived", "id": item_id}


# ═══════════════════════════════════════════════════════════════════
# CORRELATION LINKS
# ═══════════════════════════════════════════════════════════════════

@router.get("/api/v1/links/threat-weakness", response_model=list[LinkOut])
async def list_threat_weakness_links(
    threat_id: int | None = Query(None),
    weakness_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = (
        select(
            ThreatWeaknessLink,
            ThreatCatalog.ref_id.label("t_ref"), ThreatCatalog.name.label("t_name"),
            WeaknessCatalog.ref_id.label("w_ref"), WeaknessCatalog.name.label("w_name"),
        )
        .join(ThreatCatalog, ThreatWeaknessLink.threat_id == ThreatCatalog.id)
        .join(WeaknessCatalog, ThreatWeaknessLink.weakness_id == WeaknessCatalog.id)
    )
    if threat_id:
        q = q.where(ThreatWeaknessLink.threat_id == threat_id)
    if weakness_id:
        q = q.where(ThreatWeaknessLink.weakness_id == weakness_id)
    rows = (await s.execute(q)).all()
    return [
        LinkOut(
            id=lnk.id, relevance=lnk.relevance, description=lnk.description,
            is_system=lnk.is_system, created_at=lnk.created_at,
            threat_id=lnk.threat_id, threat_ref_id=t_ref, threat_name=t_name,
            weakness_id=lnk.weakness_id, weakness_ref_id=w_ref, weakness_name=w_name,
        )
        for lnk, t_ref, t_name, w_ref, w_name in rows
    ]


@router.post("/api/v1/links/threat-weakness", response_model=LinkOut, status_code=201)
async def create_threat_weakness_link(body: ThreatWeaknessLinkCreate, s: AsyncSession = Depends(get_session)):
    lnk = ThreatWeaknessLink(
        threat_id=body.threat_id, weakness_id=body.weakness_id,
        relevance=body.relevance, description=body.description,
    )
    s.add(lnk)
    await s.commit()
    await s.refresh(lnk)
    t = await s.get(ThreatCatalog, lnk.threat_id)
    w = await s.get(WeaknessCatalog, lnk.weakness_id)
    return LinkOut(
        id=lnk.id, relevance=lnk.relevance, description=lnk.description,
        is_system=lnk.is_system, created_at=lnk.created_at,
        threat_id=lnk.threat_id, threat_ref_id=t.ref_id, threat_name=t.name,
        weakness_id=lnk.weakness_id, weakness_ref_id=w.ref_id, weakness_name=w.name,
    )


@router.delete("/api/v1/links/threat-weakness/{link_id}")
async def delete_threat_weakness_link(link_id: int, s: AsyncSession = Depends(get_session)):
    lnk = await s.get(ThreatWeaknessLink, link_id)
    if not lnk:
        raise HTTPException(404, "Link nie istnieje")
    if lnk.is_system:
        raise HTTPException(403, "Nie mozna usunac systemowego powiazania")
    await s.delete(lnk)
    await s.commit()
    return {"status": "deleted", "id": link_id}


@router.get("/api/v1/links/threat-control", response_model=list[LinkOut])
async def list_threat_control_links(
    threat_id: int | None = Query(None),
    control_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = (
        select(
            ThreatControlLink,
            ThreatCatalog.ref_id.label("t_ref"), ThreatCatalog.name.label("t_name"),
            ControlCatalog.ref_id.label("c_ref"), ControlCatalog.name.label("c_name"),
        )
        .join(ThreatCatalog, ThreatControlLink.threat_id == ThreatCatalog.id)
        .join(ControlCatalog, ThreatControlLink.control_id == ControlCatalog.id)
    )
    if threat_id:
        q = q.where(ThreatControlLink.threat_id == threat_id)
    if control_id:
        q = q.where(ThreatControlLink.control_id == control_id)
    rows = (await s.execute(q)).all()
    return [
        LinkOut(
            id=lnk.id, effectiveness=lnk.effectiveness, description=lnk.description,
            is_system=lnk.is_system, created_at=lnk.created_at,
            threat_id=lnk.threat_id, threat_ref_id=t_ref, threat_name=t_name,
            control_id=lnk.control_id, control_ref_id=c_ref, control_name=c_name,
        )
        for lnk, t_ref, t_name, c_ref, c_name in rows
    ]


@router.post("/api/v1/links/threat-control", response_model=LinkOut, status_code=201)
async def create_threat_control_link(body: ThreatControlLinkCreate, s: AsyncSession = Depends(get_session)):
    lnk = ThreatControlLink(
        threat_id=body.threat_id, control_id=body.control_id,
        effectiveness=body.effectiveness, description=body.description,
    )
    s.add(lnk)
    await s.commit()
    await s.refresh(lnk)
    t = await s.get(ThreatCatalog, lnk.threat_id)
    c = await s.get(ControlCatalog, lnk.control_id)
    return LinkOut(
        id=lnk.id, effectiveness=lnk.effectiveness, description=lnk.description,
        is_system=lnk.is_system, created_at=lnk.created_at,
        threat_id=lnk.threat_id, threat_ref_id=t.ref_id, threat_name=t.name,
        control_id=lnk.control_id, control_ref_id=c.ref_id, control_name=c.name,
    )


@router.delete("/api/v1/links/threat-control/{link_id}")
async def delete_threat_control_link(link_id: int, s: AsyncSession = Depends(get_session)):
    lnk = await s.get(ThreatControlLink, link_id)
    if not lnk:
        raise HTTPException(404, "Link nie istnieje")
    if lnk.is_system:
        raise HTTPException(403, "Nie mozna usunac systemowego powiazania")
    await s.delete(lnk)
    await s.commit()
    return {"status": "deleted", "id": link_id}


@router.get("/api/v1/links/weakness-control", response_model=list[LinkOut])
async def list_weakness_control_links(
    weakness_id: int | None = Query(None),
    control_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = (
        select(
            WeaknessControlLink,
            WeaknessCatalog.ref_id.label("w_ref"), WeaknessCatalog.name.label("w_name"),
            ControlCatalog.ref_id.label("c_ref"), ControlCatalog.name.label("c_name"),
        )
        .join(WeaknessCatalog, WeaknessControlLink.weakness_id == WeaknessCatalog.id)
        .join(ControlCatalog, WeaknessControlLink.control_id == ControlCatalog.id)
    )
    if weakness_id:
        q = q.where(WeaknessControlLink.weakness_id == weakness_id)
    if control_id:
        q = q.where(WeaknessControlLink.control_id == control_id)
    rows = (await s.execute(q)).all()
    return [
        LinkOut(
            id=lnk.id, effectiveness=lnk.effectiveness, description=lnk.description,
            is_system=lnk.is_system, created_at=lnk.created_at,
            weakness_id=lnk.weakness_id, weakness_ref_id=w_ref, weakness_name=w_name,
            control_id=lnk.control_id, control_ref_id=c_ref, control_name=c_name,
        )
        for lnk, w_ref, w_name, c_ref, c_name in rows
    ]


@router.post("/api/v1/links/weakness-control", response_model=LinkOut, status_code=201)
async def create_weakness_control_link(body: WeaknessControlLinkCreate, s: AsyncSession = Depends(get_session)):
    lnk = WeaknessControlLink(
        weakness_id=body.weakness_id, control_id=body.control_id,
        effectiveness=body.effectiveness, description=body.description,
    )
    s.add(lnk)
    await s.commit()
    await s.refresh(lnk)
    w = await s.get(WeaknessCatalog, lnk.weakness_id)
    c = await s.get(ControlCatalog, lnk.control_id)
    return LinkOut(
        id=lnk.id, effectiveness=lnk.effectiveness, description=lnk.description,
        is_system=lnk.is_system, created_at=lnk.created_at,
        weakness_id=lnk.weakness_id, weakness_ref_id=w.ref_id, weakness_name=w.name,
        control_id=lnk.control_id, control_ref_id=c.ref_id, control_name=c.name,
    )


@router.delete("/api/v1/links/weakness-control/{link_id}")
async def delete_weakness_control_link(link_id: int, s: AsyncSession = Depends(get_session)):
    lnk = await s.get(WeaknessControlLink, link_id)
    if not lnk:
        raise HTTPException(404, "Link nie istnieje")
    if lnk.is_system:
        raise HTTPException(403, "Nie mozna usunac systemowego powiazania")
    await s.delete(lnk)
    await s.commit()
    return {"status": "deleted", "id": link_id}


# ═══════════════════════════════════════════════════════════════════
# SUGGESTIONS (rule-based, always available)
# ═══════════════════════════════════════════════════════════════════

@router.get("/api/v1/suggestions/weaknesses", response_model=list[WeaknessSuggestion])
async def suggest_weaknesses(threat_id: int, s: AsyncSession = Depends(get_session)):
    engine = SuggestionEngine(s)
    items = await engine.suggest_weaknesses(threat_id)
    return [WeaknessSuggestion(**i) for i in items]


@router.get("/api/v1/suggestions/controls", response_model=list[ControlSuggestion])
async def suggest_controls(threat_id: int, s: AsyncSession = Depends(get_session)):
    engine = SuggestionEngine(s)
    items = await engine.suggest_controls(threat_id)
    return [ControlSuggestion(**i) for i in items]


@router.get("/api/v1/suggestions/controls-for-weakness", response_model=list[ControlSuggestion])
async def suggest_controls_for_weakness(weakness_id: int, s: AsyncSession = Depends(get_session)):
    engine = SuggestionEngine(s)
    items = await engine.suggest_controls_for_weakness(weakness_id)
    return [ControlSuggestion(**i) for i in items]


@router.get("/api/v1/suggestions/threats-for-control", response_model=list[ThreatSuggestion])
async def suggest_threats_for_control(control_id: int, s: AsyncSession = Depends(get_session)):
    engine = SuggestionEngine(s)
    items = await engine.reverse_lookup(control_id)
    return [ThreatSuggestion(**i) for i in items]


@router.get("/api/v1/coverage/asset-category/{category_id}", response_model=CoverageResult)
async def coverage_analysis(category_id: int, s: AsyncSession = Depends(get_session)):
    engine = SuggestionEngine(s)
    result = await engine.coverage_analysis(category_id)
    return CoverageResult(**result)


@router.post("/api/v1/suggestions/quick-risk", response_model=list[QuickRiskDraft])
async def quick_risk(asset_category_id: int, s: AsyncSession = Depends(get_session)):
    engine = SuggestionEngine(s)
    drafts = await engine.quick_risk(asset_category_id)
    return [QuickRiskDraft(**d) for d in drafts]


# ═══════════════════════════════════════════════════════════════════
# FEATURE FLAGS
# ═══════════════════════════════════════════════════════════════════

@router.get("/api/v1/config/features", response_model=FeatureFlagsOut)
async def get_feature_flags(s: AsyncSession = Depends(get_session)):
    q = select(AIProviderConfig).where(AIProviderConfig.is_active.is_(True)).limit(1)
    config = (await s.execute(q)).scalar_one_or_none()
    if not config:
        return FeatureFlagsOut(ai_enabled=False, ai_features={})
    return FeatureFlagsOut(
        ai_enabled=True,
        ai_features={
            "scenario_generation": config.feature_scenario_generation,
            "correlation_enrichment": config.feature_correlation_enrichment,
            "natural_language_search": config.feature_natural_language_search,
            "gap_analysis": config.feature_gap_analysis,
            "entry_assist": config.feature_entry_assist,
        },
    )


# ═══════════════════════════════════════════════════════════════════
# AI CONFIG (admin)
# ═══════════════════════════════════════════════════════════════════

def _mask_key(encrypted: bytes | None) -> str | None:
    if not encrypted:
        return None
    import base64
    try:
        key = base64.b64decode(encrypted).decode("utf-8")
        if len(key) > 8:
            return key[:4] + "..." + key[-4:]
        return "***"
    except Exception:
        return "***"


@router.get("/api/v1/admin/ai-config", response_model=AIConfigOut)
async def get_ai_config(s: AsyncSession = Depends(get_session)):
    q = select(AIProviderConfig).limit(1)
    config = (await s.execute(q)).scalar_one_or_none()
    if not config:
        # Return default empty config
        return AIConfigOut(id=0, provider_type="none")
    return AIConfigOut(
        id=config.id,
        provider_type=config.provider_type,
        api_endpoint=config.api_endpoint,
        api_key_masked=_mask_key(config.api_key_encrypted),
        model_name=config.model_name,
        is_active=config.is_active,
        max_tokens=config.max_tokens,
        temperature=float(config.temperature),
        max_requests_per_user_per_hour=config.max_requests_per_user_per_hour,
        max_requests_per_user_per_day=config.max_requests_per_user_per_day,
        max_requests_per_org_per_day=config.max_requests_per_org_per_day,
        feature_scenario_generation=config.feature_scenario_generation,
        feature_correlation_enrichment=config.feature_correlation_enrichment,
        feature_natural_language_search=config.feature_natural_language_search,
        feature_gap_analysis=config.feature_gap_analysis,
        feature_entry_assist=config.feature_entry_assist,
        last_test_at=config.last_test_at,
        last_test_ok=config.last_test_ok,
        last_test_error=config.last_test_error,
    )


@router.put("/api/v1/admin/ai-config", response_model=AIConfigOut)
async def update_ai_config(body: AIConfigUpdate, s: AsyncSession = Depends(get_session)):
    from app.services.ai_adapters import encrypt_api_key

    q = select(AIProviderConfig).limit(1)
    config = (await s.execute(q)).scalar_one_or_none()
    if not config:
        config = AIProviderConfig()
        s.add(config)

    for k, v in body.model_dump(exclude_unset=True, exclude={"api_key"}).items():
        setattr(config, k, v)

    if body.api_key is not None:
        config.api_key_encrypted = encrypt_api_key(body.api_key)

    await s.commit()
    await s.refresh(config)
    return AIConfigOut(
        id=config.id,
        provider_type=config.provider_type,
        api_endpoint=config.api_endpoint,
        api_key_masked=_mask_key(config.api_key_encrypted),
        model_name=config.model_name,
        is_active=config.is_active,
        max_tokens=config.max_tokens,
        temperature=float(config.temperature),
        max_requests_per_user_per_hour=config.max_requests_per_user_per_hour,
        max_requests_per_user_per_day=config.max_requests_per_user_per_day,
        max_requests_per_org_per_day=config.max_requests_per_org_per_day,
        feature_scenario_generation=config.feature_scenario_generation,
        feature_correlation_enrichment=config.feature_correlation_enrichment,
        feature_natural_language_search=config.feature_natural_language_search,
        feature_gap_analysis=config.feature_gap_analysis,
        feature_entry_assist=config.feature_entry_assist,
        last_test_at=config.last_test_at,
        last_test_ok=config.last_test_ok,
        last_test_error=config.last_test_error,
    )


@router.post("/api/v1/admin/ai-config/test", response_model=AITestResult)
async def test_ai_connection(s: AsyncSession = Depends(get_session)):
    from app.services.ai_adapters import get_ai_adapter

    q = select(AIProviderConfig).limit(1)
    config = (await s.execute(q)).scalar_one_or_none()
    if not config or config.provider_type == "none":
        return AITestResult(success=False, message="AI nie jest skonfigurowane")

    # Temporarily treat as active for testing
    adapter = get_ai_adapter(config) if config.is_active else None
    if not adapter:
        # Force create adapter for test even if not active
        from app.services.ai_adapters import (
            AnthropicAdapter,
            OpenAICompatibleAdapter,
            _decrypt_api_key,
        )
        api_key = _decrypt_api_key(config.api_key_encrypted)
        if config.provider_type == "anthropic":
            adapter = AnthropicAdapter(config.api_endpoint, api_key, config.model_name)
        elif config.provider_type == "openai_compatible":
            adapter = OpenAICompatibleAdapter(config.api_endpoint, api_key, config.model_name)

    if not adapter:
        return AITestResult(success=False, message="Nie mozna utworzyc adaptera AI")

    start = time.time()
    success, message = await adapter.test_connection()
    elapsed_ms = int((time.time() - start) * 1000)

    config.last_test_at = datetime.utcnow()
    config.last_test_ok = success
    config.last_test_error = None if success else message
    await s.commit()

    return AITestResult(success=success, message=message, response_time_ms=elapsed_ms)


@router.post("/api/v1/admin/ai-config/activate")
async def activate_ai(s: AsyncSession = Depends(get_session)):
    q = select(AIProviderConfig).limit(1)
    config = (await s.execute(q)).scalar_one_or_none()
    if not config:
        raise HTTPException(404, "AI nie jest skonfigurowane")
    config.is_active = True
    await s.commit()
    return {"status": "activated"}


@router.post("/api/v1/admin/ai-config/deactivate")
async def deactivate_ai(s: AsyncSession = Depends(get_session)):
    q = select(AIProviderConfig).limit(1)
    config = (await s.execute(q)).scalar_one_or_none()
    if not config:
        raise HTTPException(404, "AI nie jest skonfigurowane")
    config.is_active = False
    await s.commit()
    return {"status": "deactivated"}
