"""
Smart Catalog API — catalogs CRUD, suggestions, correlations, AI config, feature flags.
"""
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, or_
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
    AIAssistOut,
    AIAssistRequest,
    AIConfigOut,
    AIConfigUpdate,
    AICoverageReportOut,
    AICoverageReportRequest,
    AICrossMappingOut,
    AICrossMappingRequest,
    AIEnrichOut,
    AIEnrichRequest,
    AIEvidenceOut,
    AIEvidenceRequest,
    AIGapOut,
    AIGapRequest,
    AIInterpretOut,
    AIInterpretRequest,
    AIScenarioOut,
    AIScenarioRequest,
    AISearchOut,
    AISearchRequest,
    AISecurityAreaMapOut,
    AISecurityAreaMapRequest,
    AITestResult,
    AITranslateOut,
    AITranslateRequest,
    AIUsageStatsOut,
    NodeAiCacheOut,
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
    ThreatControlLinkUpdate,
    ThreatSuggestion,
    ThreatWeaknessLinkCreate,
    ThreatWeaknessLinkUpdate,
    WeaknessCatalogCreate,
    WeaknessCatalogOut,
    WeaknessCatalogUpdate,
    WeaknessControlLinkCreate,
    WeaknessControlLinkUpdate,
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


async def _auto_ref_id(session: AsyncSession, model_class, prefix: str) -> str:
    """Auto-generate a ref_id like T-001, W-001, C-001 when not provided."""
    q = select(func.count()).select_from(model_class)
    count = (await session.execute(q)).scalar() or 0
    return f"{prefix}-{count + 1:03d}"


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
    ref_id = body.ref_id or await _auto_ref_id(s, ThreatCatalog, "T")
    t = ThreatCatalog(
        ref_id=ref_id, name=body.name, description=body.description,
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
    ref_id = body.ref_id or await _auto_ref_id(s, WeaknessCatalog, "W")
    w = WeaknessCatalog(
        ref_id=ref_id, name=body.name, description=body.description,
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
    ref_id = body.ref_id or await _auto_ref_id(s, ControlCatalog, "C")
    c = ControlCatalog(
        ref_id=ref_id, name=body.name, description=body.description,
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


@router.put("/api/v1/links/threat-weakness/{link_id}", response_model=LinkOut)
async def update_threat_weakness_link(link_id: int, body: ThreatWeaknessLinkUpdate, s: AsyncSession = Depends(get_session)):
    lnk = await s.get(ThreatWeaknessLink, link_id)
    if not lnk:
        raise HTTPException(404, "Link nie istnieje")
    if lnk.is_system:
        raise HTTPException(403, "Nie mozna edytowac systemowego powiazania")
    if body.relevance is not None:
        lnk.relevance = body.relevance
    if body.description is not None:
        lnk.description = body.description
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


@router.put("/api/v1/links/threat-control/{link_id}", response_model=LinkOut)
async def update_threat_control_link(link_id: int, body: ThreatControlLinkUpdate, s: AsyncSession = Depends(get_session)):
    lnk = await s.get(ThreatControlLink, link_id)
    if not lnk:
        raise HTTPException(404, "Link nie istnieje")
    if lnk.is_system:
        raise HTTPException(403, "Nie mozna edytowac systemowego powiazania")
    if body.effectiveness is not None:
        lnk.effectiveness = body.effectiveness
    if body.description is not None:
        lnk.description = body.description
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


@router.put("/api/v1/links/weakness-control/{link_id}", response_model=LinkOut)
async def update_weakness_control_link(link_id: int, body: WeaknessControlLinkUpdate, s: AsyncSession = Depends(get_session)):
    lnk = await s.get(WeaknessControlLink, link_id)
    if not lnk:
        raise HTTPException(404, "Link nie istnieje")
    if lnk.is_system:
        raise HTTPException(403, "Nie mozna edytowac systemowego powiazania")
    if body.effectiveness is not None:
        lnk.effectiveness = body.effectiveness
    if body.description is not None:
        lnk.description = body.description
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
            "interpret": config.feature_interpret,
            "translate": config.feature_translate,
            "evidence": config.feature_evidence,
            "security_area_map": config.feature_security_area_map,
            "cross_mapping": config.feature_cross_mapping,
            "coverage_report": config.feature_coverage_report,
            "document_import": config.feature_document_import,
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


# ═══════════════════════════════════════════════════════════════════
# AI-powered endpoints (available only when AI is configured + active)
# Return 503 when AI not configured, 403 when feature disabled,
# 429 when rate limited.
# ═══════════════════════════════════════════════════════════════════

async def _get_ai_svc(s: AsyncSession):
    """Helper: get AI service, raise 503 if not available."""
    from app.services.ai_service import (
        AINotConfiguredException,
        get_ai_service,
    )
    svc = await get_ai_service(s)
    if not svc.is_available:
        raise HTTPException(
            503,
            "AI nie jest skonfigurowane lub wylaczone. "
            "Administrator moze aktywowac AI w Ustawienia > Integracja AI.",
        )
    return svc


def _get_user_id(user_id: int = Query(1, alias="user_id")) -> int:
    return user_id


@router.post("/api/v1/ai/generate-scenarios", response_model=AIScenarioOut)
async def ai_generate_scenarios(
    body: AIScenarioRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI-powered risk scenario generation for an asset category."""
    from app.services.ai_service import (
        AIFeatureDisabledException,
        AIRateLimitException,
    )
    svc = await _get_ai_svc(s)
    try:
        scenarios = await svc.generate_scenarios(
            asset_category_id=body.asset_category_id,
            user_id=user_id,
            org_context=body.org_context,
        )
        await s.commit()
        return AIScenarioOut(scenarios=scenarios)
    except AIFeatureDisabledException as e:
        raise HTTPException(403, str(e))
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.post("/api/v1/ai/enrich-correlations", response_model=AIEnrichOut)
async def ai_enrich_correlations(
    body: AIEnrichRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI suggests missing correlations between catalog entries."""
    from app.services.ai_service import (
        AIFeatureDisabledException,
        AIRateLimitException,
    )
    svc = await _get_ai_svc(s)
    try:
        suggestions = await svc.enrich_correlations(
            user_id=user_id,
            scope=body.scope,
        )
        await s.commit()
        return AIEnrichOut(suggestions=suggestions)
    except AIFeatureDisabledException as e:
        raise HTTPException(403, str(e))
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.post("/api/v1/ai/search", response_model=AISearchOut)
async def ai_search_catalog(
    body: AISearchRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI-powered natural language search in the catalog."""
    from app.services.ai_service import (
        AIFeatureDisabledException,
        AIRateLimitException,
    )
    svc = await _get_ai_svc(s)
    try:
        result = await svc.search_catalog(query=body.query, user_id=user_id)
        await s.commit()
        return AISearchOut(
            asset_category_codes=result.get("asset_category_codes", []),
            threat_categories=result.get("threat_categories", []),
            keywords=result.get("keywords", []),
            interpretation=result.get("interpretation"),
        )
    except AIFeatureDisabledException as e:
        raise HTTPException(403, str(e))
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.post("/api/v1/ai/gap-analysis", response_model=AIGapOut)
async def ai_gap_analysis(
    body: AIGapRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI-powered gap analysis of security coverage."""
    from app.services.ai_service import (
        AIFeatureDisabledException,
        AIRateLimitException,
    )
    svc = await _get_ai_svc(s)
    try:
        result = await svc.gap_analysis(
            user_id=user_id,
            asset_category_id=body.asset_category_id,
        )
        await s.commit()
        return AIGapOut(
            critical_gaps=result.get("critical_gaps", []),
            recommendations=result.get("recommendations", []),
            coverage_pct=result.get("coverage_pct"),
            immediate_actions=result.get("immediate_actions", []),
        )
    except AIFeatureDisabledException as e:
        raise HTTPException(403, str(e))
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.post("/api/v1/ai/assist-entry", response_model=AIAssistOut)
async def ai_assist_entry(
    body: AIAssistRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI suggests classification and correlations for a new catalog entry."""
    from app.services.ai_service import (
        AIFeatureDisabledException,
        AIRateLimitException,
    )
    svc = await _get_ai_svc(s)
    try:
        result = await svc.assist_entry(
            entry_type=body.entry_type,
            name=body.name,
            description=body.description,
            user_id=user_id,
        )
        await s.commit()
        return AIAssistOut(
            applicable_asset_categories=result.get("applicable_asset_categories", []),
            category=result.get("category"),
            cia_impact=result.get("cia_impact"),
            suggested_correlations=result.get("suggested_correlations", []),
        )
    except AIFeatureDisabledException as e:
        raise HTTPException(403, str(e))
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.post("/api/v1/ai/interpret-node", response_model=AIInterpretOut)
async def ai_interpret_node(
    body: AIInterpretRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI-powered interpretation of a framework requirement. Caches results per node."""
    from app.services.ai_service import AIRateLimitException
    from app.models.framework import FrameworkNodeAiCache

    # Check cache first (if node_id provided and not forced)
    if body.node_id and not body.force:
        cached = (await s.execute(
            select(FrameworkNodeAiCache).where(
                FrameworkNodeAiCache.node_id == body.node_id,
                FrameworkNodeAiCache.action_type == "interpret",
                FrameworkNodeAiCache.language.is_(None),
            )
        )).scalar_one_or_none()
        if cached:
            r = cached.result_json
            return AIInterpretOut(
                interpretation=r.get("interpretation", ""),
                practical_examples=r.get("practical_examples", []),
                common_pitfalls=r.get("common_pitfalls", []),
                related_standards=r.get("related_standards", []),
                cached=True,
                cached_at=cached.updated_at,
            )

    svc = await _get_ai_svc(s)
    try:
        result = await svc.interpret_node(
            user_id=user_id,
            framework_name=body.framework_name,
            node_ref_id=body.node_ref_id,
            node_name=body.node_name,
            node_description=body.node_description,
        )

        # Persist to cache
        if body.node_id:
            existing = (await s.execute(
                select(FrameworkNodeAiCache).where(
                    FrameworkNodeAiCache.node_id == body.node_id,
                    FrameworkNodeAiCache.action_type == "interpret",
                    FrameworkNodeAiCache.language.is_(None),
                )
            )).scalar_one_or_none()
            if existing:
                existing.result_json = result
                existing.updated_at = datetime.utcnow()
            else:
                s.add(FrameworkNodeAiCache(
                    node_id=body.node_id,
                    action_type="interpret",
                    language=None,
                    result_json=result,
                ))

        await s.commit()
        return AIInterpretOut(
            interpretation=result.get("interpretation", ""),
            practical_examples=result.get("practical_examples", []),
            common_pitfalls=result.get("common_pitfalls", []),
            related_standards=result.get("related_standards", []),
        )
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.post("/api/v1/ai/translate-node", response_model=AITranslateOut)
async def ai_translate_node(
    body: AITranslateRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI-powered translation of a framework requirement. Caches results per node+language."""
    from app.services.ai_service import AIRateLimitException
    from app.models.framework import FrameworkNodeAiCache

    # Check cache first
    if body.node_id and not body.force:
        cached = (await s.execute(
            select(FrameworkNodeAiCache).where(
                FrameworkNodeAiCache.node_id == body.node_id,
                FrameworkNodeAiCache.action_type == "translate",
                FrameworkNodeAiCache.language == body.target_language,
            )
        )).scalar_one_or_none()
        if cached:
            r = cached.result_json
            return AITranslateOut(
                translated_name=r.get("translated_name", ""),
                translated_description=r.get("translated_description"),
                terminology_notes=r.get("terminology_notes", []),
                cached=True,
                cached_at=cached.updated_at,
            )

    svc = await _get_ai_svc(s)
    try:
        result = await svc.translate_node(
            user_id=user_id,
            framework_name=body.framework_name,
            node_ref_id=body.node_ref_id,
            node_name=body.node_name,
            node_description=body.node_description,
            target_language=body.target_language,
        )

        # Persist to cache
        if body.node_id:
            existing = (await s.execute(
                select(FrameworkNodeAiCache).where(
                    FrameworkNodeAiCache.node_id == body.node_id,
                    FrameworkNodeAiCache.action_type == "translate",
                    FrameworkNodeAiCache.language == body.target_language,
                )
            )).scalar_one_or_none()
            if existing:
                existing.result_json = result
                existing.updated_at = datetime.utcnow()
            else:
                s.add(FrameworkNodeAiCache(
                    node_id=body.node_id,
                    action_type="translate",
                    language=body.target_language,
                    result_json=result,
                ))

        await s.commit()
        return AITranslateOut(
            translated_name=result.get("translated_name", ""),
            translated_description=result.get("translated_description"),
            terminology_notes=result.get("terminology_notes", []),
        )
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.get("/api/v1/ai/node-cache/{framework_id}", response_model=list[NodeAiCacheOut])
async def get_framework_ai_cache(
    framework_id: int,
    action_type: str | None = Query(None, pattern="^(interpret|translate)$"),
    language: str | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    """Get all cached AI results for a framework's nodes."""
    from app.models.framework import FrameworkNode, FrameworkNodeAiCache

    q = (
        select(FrameworkNodeAiCache)
        .join(FrameworkNode, FrameworkNodeAiCache.node_id == FrameworkNode.id)
        .where(FrameworkNode.framework_id == framework_id)
    )
    if action_type:
        q = q.where(FrameworkNodeAiCache.action_type == action_type)
    if language:
        q = q.where(FrameworkNodeAiCache.language == language)

    rows = (await s.execute(q)).scalars().all()
    return [NodeAiCacheOut(
        node_id=r.node_id,
        action_type=r.action_type,
        language=r.language,
        result_json=r.result_json,
        updated_at=r.updated_at,
    ) for r in rows]


@router.post("/api/v1/ai/generate-evidence", response_model=AIEvidenceOut)
async def ai_generate_evidence(
    body: AIEvidenceRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI-powered evidence checklist generation for a framework node. Caches results."""
    from app.services.ai_service import AIRateLimitException
    from app.models.framework import FrameworkNodeAiCache

    # Check cache
    if body.node_id and not body.force:
        cached = (await s.execute(
            select(FrameworkNodeAiCache).where(
                FrameworkNodeAiCache.node_id == body.node_id,
                FrameworkNodeAiCache.action_type == "evidence",
                FrameworkNodeAiCache.language.is_(None),
            )
        )).scalar_one_or_none()
        if cached:
            r = cached.result_json
            return AIEvidenceOut(
                evidence_items=r.get("evidence_items", []),
                audit_tips=r.get("audit_tips", []),
                cached=True,
                cached_at=cached.updated_at,
            )

    svc = await _get_ai_svc(s)
    try:
        result = await svc.generate_evidence(
            user_id=user_id,
            framework_name=body.framework_name,
            node_ref_id=body.node_ref_id,
            node_name=body.node_name,
            node_description=body.node_description,
        )

        # Persist to cache
        if body.node_id:
            existing = (await s.execute(
                select(FrameworkNodeAiCache).where(
                    FrameworkNodeAiCache.node_id == body.node_id,
                    FrameworkNodeAiCache.action_type == "evidence",
                    FrameworkNodeAiCache.language.is_(None),
                )
            )).scalar_one_or_none()
            if existing:
                existing.result_json = result
                existing.updated_at = datetime.utcnow()
            else:
                s.add(FrameworkNodeAiCache(
                    node_id=body.node_id,
                    action_type="evidence",
                    language=None,
                    result_json=result,
                ))

        await s.commit()
        return AIEvidenceOut(
            evidence_items=result.get("evidence_items", []),
            audit_tips=result.get("audit_tips", []),
        )
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.post("/api/v1/ai/suggest-security-areas", response_model=AISecurityAreaMapOut)
async def ai_suggest_security_areas(
    body: AISecurityAreaMapRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI-powered security area suggestion for a framework node."""
    from app.services.ai_service import AIRateLimitException
    from app.models.security_area import SecurityArea
    from app.models.framework import FrameworkNodeSecurityArea

    # Get available security areas
    areas_q = select(SecurityArea).where(SecurityArea.is_active.is_(True))
    areas = (await s.execute(areas_q)).scalars().all()
    if not areas:
        raise HTTPException(400, "Brak zdefiniowanych obszarów bezpieczeństwa")

    areas_list = [{"id": a.id, "name": a.name, "description": a.description} for a in areas]

    svc = await _get_ai_svc(s)
    try:
        result = await svc.suggest_security_areas(
            user_id=user_id,
            framework_name=body.framework_name,
            node_ref_id=body.node_ref_id,
            node_name=body.node_name,
            node_description=body.node_description,
            available_areas=areas_list,
        )

        suggestions = result.get("suggested_areas", [])

        # Auto-create mappings with source="ai_suggested"
        for sug in suggestions:
            area_id = sug.get("area_id")
            if not area_id:
                continue
            # Check if already mapped
            exists = (await s.execute(
                select(FrameworkNodeSecurityArea).where(
                    FrameworkNodeSecurityArea.framework_node_id == body.node_id,
                    FrameworkNodeSecurityArea.security_area_id == area_id,
                )
            )).scalar_one_or_none()
            if not exists:
                s.add(FrameworkNodeSecurityArea(
                    framework_node_id=body.node_id,
                    security_area_id=area_id,
                    source="ai_suggested",
                ))

        await s.commit()
        return AISecurityAreaMapOut(suggested_areas=suggestions)
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.post("/api/v1/ai/cross-mapping", response_model=AICrossMappingOut)
async def ai_cross_mapping(
    body: AICrossMappingRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI-powered cross-framework mapping suggestion for a single source node."""
    from app.services.ai_service import AIRateLimitException
    from app.models.framework import Framework, FrameworkNode
    from app.models.compliance import FrameworkMapping, MappingSet

    sf = await s.get(Framework, body.source_framework_id)
    tf = await s.get(Framework, body.target_framework_id)
    sn = await s.get(FrameworkNode, body.source_node_id)
    if not sf or not tf or not sn:
        raise HTTPException(404, "Framework or node not found")

    # Get target nodes
    target_q = select(FrameworkNode).where(
        FrameworkNode.framework_id == body.target_framework_id,
        FrameworkNode.is_active.is_(True),
    ).order_by(FrameworkNode.sort_order)
    target_nodes = (await s.execute(target_q)).scalars().all()

    target_list = [
        {"ref_id": n.ref_id or f"#{n.id}", "name": n.name, "description": n.description}
        for n in target_nodes
    ]

    svc = await _get_ai_svc(s)
    try:
        result = await svc.suggest_cross_mapping(
            user_id=user_id,
            source_framework_name=sf.name,
            source_node_ref_id=sn.ref_id,
            source_node_name=sn.name,
            source_node_description=sn.description,
            target_framework_name=tf.name,
            target_nodes=target_list,
        )

        suggestions = result.get("mappings", [])

        # Resolve target node IDs from ref_ids
        ref_to_node = {n.ref_id: n for n in target_nodes if n.ref_id}
        enriched = []
        for sug in suggestions:
            tref = sug.get("target_ref_id", "")
            tnode = ref_to_node.get(tref)
            enriched.append({
                "target_ref_id": tref,
                "target_node_id": tnode.id if tnode else None,
                "relationship_type": sug.get("relationship_type", "intersect"),
                "strength": sug.get("strength", 2),
                "rationale": sug.get("rationale", ""),
            })

        # Auto-create if requested
        if body.auto_create:
            # Find or create mapping set
            ms_q = select(MappingSet).where(
                MappingSet.source_framework_id == body.source_framework_id,
                MappingSet.target_framework_id == body.target_framework_id,
            )
            ms = (await s.execute(ms_q)).scalar_one_or_none()
            if not ms:
                ms = MappingSet(
                    source_framework_id=body.source_framework_id,
                    target_framework_id=body.target_framework_id,
                    name=f"{sf.name} <-> {tf.name} (AI)",
                )
                s.add(ms)
                await s.flush()

            for sug in enriched:
                if not sug["target_node_id"]:
                    continue
                # Skip duplicates
                dup = (await s.execute(
                    select(FrameworkMapping).where(
                        FrameworkMapping.source_requirement_id == body.source_node_id,
                        FrameworkMapping.target_requirement_id == sug["target_node_id"],
                    )
                )).scalar_one_or_none()
                if dup:
                    continue
                s.add(FrameworkMapping(
                    mapping_set_id=ms.id,
                    source_framework_id=body.source_framework_id,
                    source_requirement_id=body.source_node_id,
                    target_framework_id=body.target_framework_id,
                    target_requirement_id=sug["target_node_id"],
                    relationship_type=sug["relationship_type"],
                    strength=sug["strength"],
                    rationale=sug["rationale"],
                    mapping_source="ai_assisted",
                    mapping_status="draft",
                ))

        await s.commit()
        return AICrossMappingOut(
            source_node_ref_id=sn.ref_id,
            source_node_name=sn.name,
            suggestions=enriched,
        )
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.post("/api/v1/ai/coverage-report", response_model=AICoverageReportOut)
async def ai_coverage_report(
    body: AICoverageReportRequest,
    s: AsyncSession = Depends(get_session),
    user_id: int = Depends(_get_user_id),
):
    """AI-powered coverage analysis report between two frameworks."""
    from app.services.ai_service import AIRateLimitException
    from app.models.framework import Framework, FrameworkNode
    from app.models.compliance import FrameworkMapping

    sf = await s.get(Framework, body.source_framework_id)
    tf = await s.get(Framework, body.target_framework_id)
    if not sf or not tf:
        raise HTTPException(404, "Framework not found")

    # Calculate coverage data
    tq = select(FrameworkNode).where(
        FrameworkNode.framework_id == body.target_framework_id,
        FrameworkNode.assessable.is_(True),
        FrameworkNode.is_active.is_(True),
    )
    target_reqs = (await s.execute(tq)).scalars().all()

    mq = select(FrameworkMapping).where(
        FrameworkMapping.source_framework_id == body.source_framework_id,
        FrameworkMapping.target_framework_id == body.target_framework_id,
    )
    mappings = (await s.execute(mq)).scalars().all()

    mapped_ids = {m.target_requirement_id for m in mappings}
    total = len(target_reqs)
    covered = sum(1 for r in target_reqs if r.id in mapped_ids)

    by_rel = {}
    for m in mappings:
        by_rel[m.relationship_type] = by_rel.get(m.relationship_type, 0) + 1

    uncovered_reqs = [
        {"ref_id": r.ref_id, "name": r.name}
        for r in target_reqs if r.id not in mapped_ids
    ]

    coverage_data = {
        "total_requirements": total,
        "covered": covered,
        "uncovered": total - covered,
        "coverage_percent": round(covered / total * 100, 1) if total > 0 else 0,
        "by_relationship": by_rel,
        "uncovered_requirements": uncovered_reqs,
    }

    svc = await _get_ai_svc(s)
    try:
        result = await svc.generate_coverage_report(
            user_id=user_id,
            source_framework_name=sf.name,
            target_framework_name=tf.name,
            coverage_data=coverage_data,
        )
        await s.commit()
        return AICoverageReportOut(
            executive_summary=result.get("executive_summary", ""),
            strengths=result.get("strengths", []),
            gaps=result.get("gaps", []),
            recommendations=result.get("recommendations", []),
            risk_level=result.get("risk_level", "medium"),
        )
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))


@router.get("/api/v1/ai/usage-stats", response_model=AIUsageStatsOut)
async def ai_usage_stats(
    days: int = Query(30, ge=1, le=365),
    s: AsyncSession = Depends(get_session),
):
    """Get AI usage statistics for the given period."""
    from sqlalchemy import func as sa_func
    from app.models.smart_catalog import AIAuditLog

    since = datetime.utcnow() - __import__("datetime").timedelta(days=days)

    q_total = select(sa_func.count()).select_from(AIAuditLog).where(
        AIAuditLog.created_at >= since
    )
    total = (await s.execute(q_total)).scalar() or 0

    q_tokens = select(
        sa_func.coalesce(sa_func.sum(AIAuditLog.tokens_input), 0),
        sa_func.coalesce(sa_func.sum(AIAuditLog.tokens_output), 0),
    ).where(AIAuditLog.created_at >= since)
    tok_row = (await s.execute(q_tokens)).one()
    tokens_in = tok_row[0] or 0
    tokens_out = tok_row[1] or 0
    tokens = tokens_in + tokens_out

    q_cost = select(
        sa_func.coalesce(sa_func.sum(AIAuditLog.cost_usd), 0)
    ).where(AIAuditLog.created_at >= since)
    cost = float((await s.execute(q_cost)).scalar() or 0)

    # Count records with token tracking data
    q_tracked = select(sa_func.count()).select_from(AIAuditLog).where(
        AIAuditLog.created_at >= since,
        AIAuditLog.tokens_input.isnot(None),
    )
    tracked = (await s.execute(q_tracked)).scalar() or 0

    # Acceptance rate
    q_accepted = select(sa_func.count()).select_from(AIAuditLog).where(
        AIAuditLog.created_at >= since,
        AIAuditLog.accepted.is_(True),
    )
    accepted = (await s.execute(q_accepted)).scalar() or 0
    q_reviewed = select(sa_func.count()).select_from(AIAuditLog).where(
        AIAuditLog.created_at >= since,
        AIAuditLog.accepted.isnot(None),
    )
    reviewed = (await s.execute(q_reviewed)).scalar() or 0
    acceptance_rate = (accepted / reviewed * 100) if reviewed > 0 else None

    # By action type
    q_by_action = select(
        AIAuditLog.action_type,
        sa_func.count().label("cnt"),
    ).where(AIAuditLog.created_at >= since).group_by(AIAuditLog.action_type)
    rows = (await s.execute(q_by_action)).all()
    by_action = {r.action_type: r.cnt for r in rows}

    return AIUsageStatsOut(
        requests_count=total,
        tokens_used=tokens,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
        cost_usd=cost,
        acceptance_rate=acceptance_rate,
        by_action=by_action,
        requests_with_tracking=tracked,
    )


# ═══════════════════════════════════════════════════════════════════
# AI Prompt Templates CRUD
# ═══════════════════════════════════════════════════════════════════

@router.get("/admin/ai-prompts", summary="Lista edytowalnych promptów AI")
async def list_ai_prompts(s: AsyncSession = Depends(get_session)):
    from app.models.smart_catalog import AIPromptTemplate
    rows = (await s.execute(
        select(AIPromptTemplate).order_by(AIPromptTemplate.function_key)
    )).scalars().all()

    # Auto-seed defaults if table is empty (migration seed may not have run)
    if not rows:
        from app.services.ai_prompts import DEFAULT_PROMPTS
        for p in DEFAULT_PROMPTS:
            s.add(AIPromptTemplate(
                function_key=p["function_key"],
                display_name=p["display_name"],
                description=p.get("description", ""),
                prompt_text=p["prompt_text"],
                is_customized=False,
            ))
        await s.commit()
        rows = (await s.execute(
            select(AIPromptTemplate).order_by(AIPromptTemplate.function_key)
        )).scalars().all()

    return [
        {
            "id": r.id,
            "function_key": r.function_key,
            "display_name": r.display_name,
            "description": r.description,
            "prompt_text": r.prompt_text,
            "is_customized": r.is_customized,
            "updated_by": r.updated_by,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.get("/admin/ai-prompts/{function_key}", summary="Pobierz prompt AI")
async def get_ai_prompt(function_key: str, s: AsyncSession = Depends(get_session)):
    from app.models.smart_catalog import AIPromptTemplate
    row = (await s.execute(
        select(AIPromptTemplate).where(AIPromptTemplate.function_key == function_key)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, f"Prompt '{function_key}' nie istnieje")
    from app.services.ai_prompts import _DEFAULTS_BY_KEY
    return {
        "id": row.id,
        "function_key": row.function_key,
        "display_name": row.display_name,
        "description": row.description,
        "prompt_text": row.prompt_text,
        "is_customized": row.is_customized,
        "default_text": _DEFAULTS_BY_KEY.get(function_key, ""),
        "updated_by": row.updated_by,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.put("/admin/ai-prompts/{function_key}", summary="Edytuj prompt AI")
async def update_ai_prompt(function_key: str, body: dict, s: AsyncSession = Depends(get_session)):
    from app.models.smart_catalog import AIPromptTemplate
    from datetime import datetime

    row = (await s.execute(
        select(AIPromptTemplate).where(AIPromptTemplate.function_key == function_key)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, f"Prompt '{function_key}' nie istnieje")

    prompt_text = body.get("prompt_text", "").strip()
    if not prompt_text:
        raise HTTPException(400, "Treść promptu nie może być pusta")

    row.prompt_text = prompt_text
    row.is_customized = True
    row.updated_by = body.get("updated_by", "admin")
    row.updated_at = datetime.utcnow()
    await s.commit()
    return {"status": "ok", "function_key": function_key}


@router.post("/admin/ai-prompts/{function_key}/reset", summary="Przywróć domyślny prompt")
async def reset_ai_prompt(function_key: str, s: AsyncSession = Depends(get_session)):
    from app.models.smart_catalog import AIPromptTemplate
    from app.services.ai_prompts import _DEFAULTS_BY_KEY
    from datetime import datetime

    row = (await s.execute(
        select(AIPromptTemplate).where(AIPromptTemplate.function_key == function_key)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, f"Prompt '{function_key}' nie istnieje")

    default_text = _DEFAULTS_BY_KEY.get(function_key)
    if not default_text:
        raise HTTPException(404, f"Brak domyślnego promptu dla '{function_key}'")

    row.prompt_text = default_text
    row.is_customized = False
    row.updated_at = datetime.utcnow()
    await s.commit()
    return {"status": "ok", "function_key": function_key, "restored": True}


# ═══════════════════════════════════════════════════════════════════
# DATABASE ADMINISTRATION
# ═══════════════════════════════════════════════════════════════════

def _parse_database_url(url: str) -> dict:
    """Parse DATABASE_URL into components."""
    import re
    # mysql+asyncmy://user:pass@host:port/dbname
    m = re.match(
        r"(?P<driver>[^:]+)://(?P<user>[^:]*):(?P<password>[^@]*)@(?P<host>[^:/]+)(?::(?P<port>\d+))?/(?P<database>\w+)",
        url,
    )
    if not m:
        return {"driver": "", "host": "", "port": 3306, "database": "", "user": "", "raw": url}
    return {
        "driver": m.group("driver"),
        "host": m.group("host"),
        "port": int(m.group("port") or 3306),
        "database": m.group("database"),
        "user": m.group("user"),
    }


def _build_database_url(host: str, port: int, database: str, user: str, password: str,
                         driver: str = "mysql+asyncmy") -> str:
    """Build DATABASE_URL from components."""
    from urllib.parse import quote_plus
    return f"{driver}://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{database}"


@router.get("/admin/db-config", summary="Aktualna konfiguracja bazy danych")
async def get_db_config():
    """Return current DB connection info (password masked)."""
    from app.config import settings
    parsed = _parse_database_url(settings.DATABASE_URL)
    return {
        "host": parsed.get("host", ""),
        "port": parsed.get("port", 3306),
        "database": parsed.get("database", ""),
        "user": parsed.get("user", ""),
        "driver": parsed.get("driver", "mysql+asyncmy"),
        "connected": True,
    }


@router.post("/admin/db-config/test", summary="Testuj połączenie z bazą danych")
async def test_db_connection(body: dict):
    """Test connection to a database with given params. Does NOT save anything."""
    from sqlalchemy.ext.asyncio import create_async_engine as _create_engine
    from sqlalchemy import text as _text

    host = body.get("host", "").strip()
    port = int(body.get("port", 3306))
    database = body.get("database", "").strip()
    user = body.get("user", "").strip()
    password = body.get("password", "")
    driver = body.get("driver", "mysql+asyncmy").strip()

    if not host or not database or not user:
        raise HTTPException(400, "Host, nazwa bazy i użytkownik są wymagane")

    url = _build_database_url(host, port, database, user, password, driver)

    try:
        eng = _create_engine(url, pool_pre_ping=True, pool_size=1, max_overflow=0)
        async with eng.connect() as conn:
            result = await conn.execute(_text("SELECT 1"))
            result.fetchone()

            # Check if schema exists (any tables?)
            if "mysql" in driver:
                rows = (await conn.execute(
                    _text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = :db"),
                    {"db": database},
                )).scalar()
            else:
                rows = 0

        await eng.dispose()
        return {
            "status": "ok",
            "message": f"Połączenie z {host}:{port}/{database} udane",
            "tables_found": rows or 0,
            "schema_initialized": (rows or 0) > 0,
        }
    except Exception as e:
        err = str(e)
        # Provide helpful error messages
        if "Access denied" in err:
            msg = "Odmowa dostępu — sprawdź użytkownika i hasło"
        elif "Unknown database" in err:
            msg = f"Baza danych '{database}' nie istnieje — utwórz ją najpierw (CREATE DATABASE)"
        elif "Can't connect" in err or "Connection refused" in err:
            msg = f"Nie można połączyć się z {host}:{port} — sprawdź adres i port"
        else:
            msg = f"Błąd połączenia: {err[:200]}"
        return {"status": "error", "message": msg}


@router.post("/admin/db-config/init-schema", summary="Zainicjalizuj schemat bazy danych")
async def init_db_schema(body: dict):
    """Run Alembic migrations on target database to create full schema."""
    import subprocess
    import os

    host = body.get("host", "").strip()
    port = int(body.get("port", 3306))
    database = body.get("database", "").strip()
    user = body.get("user", "").strip()
    password = body.get("password", "")
    driver = body.get("driver", "mysql+asyncmy").strip()

    if not host or not database or not user:
        raise HTTPException(400, "Host, nazwa bazy i użytkownik są wymagane")

    url = _build_database_url(host, port, database, user, password, driver)
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

    env = {**os.environ, "DATABASE_URL": url}

    try:
        result = subprocess.run(
            ["python", "-m", "alembic", "upgrade", "head"],
            cwd=backend_dir,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip() or result.stdout.strip()
            # Clean up error message
            if "already exists" in error_msg.lower():
                return {
                    "status": "ok",
                    "message": "Schemat już istnieje — baza jest aktualna",
                    "details": error_msg[-500:],
                }
            return {
                "status": "error",
                "message": "Błąd podczas migracji",
                "details": error_msg[-500:],
            }

        return {
            "status": "ok",
            "message": "Schemat bazy danych został utworzony pomyślnie",
            "details": result.stdout.strip()[-500:] if result.stdout else "Migracje zastosowane",
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Timeout — migracja trwała zbyt długo (>120s)"}
    except Exception as e:
        return {"status": "error", "message": f"Błąd: {e}"}


@router.put("/admin/db-config", summary="Zapisz konfigurację bazy danych")
async def save_db_config(body: dict):
    """Save new database connection to .env and signal that restart is needed."""
    import os
    from pathlib import Path

    host = body.get("host", "").strip()
    port = int(body.get("port", 3306))
    database = body.get("database", "").strip()
    user = body.get("user", "").strip()
    password = body.get("password", "")
    driver = body.get("driver", "mysql+asyncmy").strip()

    if not host or not database or not user:
        raise HTTPException(400, "Host, nazwa bazy i użytkownik są wymagane")

    new_url = _build_database_url(host, port, database, user, password, driver)

    # Read current .env
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        content = env_path.read_text(encoding="utf-8")
    else:
        content = ""

    # Replace or add DATABASE_URL
    lines = content.splitlines()
    new_lines = []
    found = False
    for line in lines:
        if line.startswith("DATABASE_URL="):
            new_lines.append(f"DATABASE_URL={new_url}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.insert(0, f"DATABASE_URL={new_url}")

    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")

    return {
        "status": "ok",
        "message": "Konfiguracja zapisana. Wymagany restart aplikacji aby połączyć się z nową bazą.",
        "restart_required": True,
    }
