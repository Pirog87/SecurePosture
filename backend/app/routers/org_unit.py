"""
Org structure module — /api/v1/org-levels + /api/v1/org-units
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.org_unit import OrgLevel, OrgUnit
from app.schemas.org_unit import (
    OrgLevelCreate,
    OrgLevelOut,
    OrgLevelUpdate,
    OrgUnitCreate,
    OrgUnitOut,
    OrgUnitTreeNode,
    OrgUnitUpdate,
)

router = APIRouter(tags=["Struktura organizacyjna"])


# ═══════════════════ ORG LEVELS ═══════════════════

@router.get("/api/v1/org-levels", response_model=list[OrgLevelOut], summary="Lista poziomów organizacyjnych")
async def list_levels(s: AsyncSession = Depends(get_session)):
    q = select(OrgLevel).order_by(OrgLevel.level_number)
    return (await s.execute(q)).scalars().all()


@router.post("/api/v1/org-levels", response_model=OrgLevelOut, status_code=201, summary="Utwórz poziom")
async def create_level(body: OrgLevelCreate, s: AsyncSession = Depends(get_session)):
    level = OrgLevel(level_number=body.level_number, name=body.name)
    s.add(level)
    await s.commit()
    await s.refresh(level)
    return level


@router.put("/api/v1/org-levels/{level_id}", response_model=OrgLevelOut, summary="Edytuj poziom")
async def update_level(level_id: int, body: OrgLevelUpdate, s: AsyncSession = Depends(get_session)):
    level = await s.get(OrgLevel, level_id)
    if not level:
        raise HTTPException(404, "Poziom nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(level, k, v)
    await s.commit()
    await s.refresh(level)
    return level


# ═══════════════════ ORG UNITS ═══════════════════

@router.get("/api/v1/org-units", response_model=list[OrgUnitOut], summary="Lista jednostek organizacyjnych")
async def list_units(
    is_active: bool | None = Query(None),
    level_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = select(OrgUnit, OrgLevel.name.label("level_name")).join(OrgLevel, OrgUnit.level_id == OrgLevel.id)
    if is_active is not None:
        q = q.where(OrgUnit.is_active == is_active)
    if level_id is not None:
        q = q.where(OrgUnit.level_id == level_id)
    q = q.order_by(OrgUnit.name)
    rows = (await s.execute(q)).all()
    return [
        OrgUnitOut(
            id=u.id, parent_id=u.parent_id, level_id=u.level_id, level_name=ln,
            name=u.name, symbol=u.symbol, owner=u.owner,
            security_contact=u.security_contact, description=u.description,
            is_active=u.is_active, created_at=u.created_at,
            deactivated_at=u.deactivated_at, updated_at=u.updated_at,
        )
        for u, ln in rows
    ]


@router.get("/api/v1/org-units/flat", summary="Plaska lista jednostek (id + name)")
async def list_units_flat(
    is_active: bool = Query(True),
    s: AsyncSession = Depends(get_session),
):
    q = select(OrgUnit.id, OrgUnit.name).order_by(OrgUnit.name)
    if is_active is not None:
        q = q.where(OrgUnit.is_active == is_active)
    rows = (await s.execute(q)).all()
    return [{"id": r.id, "name": r.name} for r in rows]


@router.get("/api/v1/org-units/tree", response_model=list[OrgUnitTreeNode], summary="Drzewo jednostek")
async def get_tree(
    include_inactive: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(OrgUnit, OrgLevel.name.label("level_name")).join(OrgLevel, OrgUnit.level_id == OrgLevel.id)
    if not include_inactive:
        q = q.where(OrgUnit.is_active.is_(True))
    q = q.order_by(OrgUnit.name)
    rows = (await s.execute(q)).all()

    nodes: dict[int, OrgUnitTreeNode] = {}
    for u, ln in rows:
        nodes[u.id] = OrgUnitTreeNode(
            id=u.id, parent_id=u.parent_id, level_id=u.level_id,
            level_name=ln, name=u.name, symbol=u.symbol,
            owner=u.owner, is_active=u.is_active,
        )
    roots: list[OrgUnitTreeNode] = []
    for node in nodes.values():
        if node.parent_id and node.parent_id in nodes:
            nodes[node.parent_id].children.append(node)
        else:
            roots.append(node)
    return roots


@router.get("/api/v1/org-units/{unit_id}", response_model=OrgUnitOut, summary="Pobierz jednostkę")
async def get_unit(unit_id: int, s: AsyncSession = Depends(get_session)):
    q = select(OrgUnit, OrgLevel.name.label("level_name")).join(OrgLevel, OrgUnit.level_id == OrgLevel.id).where(OrgUnit.id == unit_id)
    row = (await s.execute(q)).first()
    if not row:
        raise HTTPException(404, "Jednostka nie istnieje")
    u, ln = row
    return OrgUnitOut(
        id=u.id, parent_id=u.parent_id, level_id=u.level_id, level_name=ln,
        name=u.name, symbol=u.symbol, owner=u.owner,
        security_contact=u.security_contact, description=u.description,
        is_active=u.is_active, created_at=u.created_at,
        deactivated_at=u.deactivated_at, updated_at=u.updated_at,
    )


@router.post("/api/v1/org-units", response_model=OrgUnitOut, status_code=201, summary="Utwórz jednostkę")
async def create_unit(body: OrgUnitCreate, s: AsyncSession = Depends(get_session)):
    unit = OrgUnit(**body.model_dump())
    s.add(unit)
    await s.commit()
    await s.refresh(unit)
    level = await s.get(OrgLevel, unit.level_id)
    return OrgUnitOut(
        id=unit.id, parent_id=unit.parent_id, level_id=unit.level_id,
        level_name=level.name if level else None,
        name=unit.name, symbol=unit.symbol, owner=unit.owner,
        security_contact=unit.security_contact, description=unit.description,
        is_active=unit.is_active, created_at=unit.created_at,
        deactivated_at=unit.deactivated_at, updated_at=unit.updated_at,
    )


@router.put("/api/v1/org-units/{unit_id}", response_model=OrgUnitOut, summary="Edytuj jednostkę")
async def update_unit(unit_id: int, body: OrgUnitUpdate, s: AsyncSession = Depends(get_session)):
    unit = await s.get(OrgUnit, unit_id)
    if not unit:
        raise HTTPException(404, "Jednostka nie istnieje")
    data = body.model_dump(exclude_unset=True)
    if "is_active" in data and data["is_active"] is False and unit.is_active:
        data["deactivated_at"] = datetime.utcnow()
    elif "is_active" in data and data["is_active"] is True:
        data["deactivated_at"] = None
    for k, v in data.items():
        setattr(unit, k, v)
    await s.commit()
    await s.refresh(unit)
    level = await s.get(OrgLevel, unit.level_id)
    return OrgUnitOut(
        id=unit.id, parent_id=unit.parent_id, level_id=unit.level_id,
        level_name=level.name if level else None,
        name=unit.name, symbol=unit.symbol, owner=unit.owner,
        security_contact=unit.security_contact, description=unit.description,
        is_active=unit.is_active, created_at=unit.created_at,
        deactivated_at=unit.deactivated_at, updated_at=unit.updated_at,
    )


@router.delete("/api/v1/org-units/{unit_id}", summary="Dezaktywuj jednostkę (soft delete)")
async def deactivate_unit(unit_id: int, s: AsyncSession = Depends(get_session)):
    unit = await s.get(OrgUnit, unit_id)
    if not unit:
        raise HTTPException(404, "Jednostka nie istnieje")
    unit.is_active = False
    unit.deactivated_at = datetime.utcnow()
    await s.commit()
    return {"status": "deactivated", "id": unit_id}
