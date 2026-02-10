"""
Security areas module — /api/v1/security-areas
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.security_area import SecurityArea
from app.schemas.security_area import SecurityAreaCreate, SecurityAreaOut, SecurityAreaUpdate

router = APIRouter(prefix="/api/v1/security-areas", tags=["Obszary bezpieczeństwa"])


@router.get("", response_model=list[SecurityAreaOut], summary="Lista obszarów bezpieczeństwa")
async def list_areas(
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(SecurityArea)
    if not include_archived:
        q = q.where(SecurityArea.is_active.is_(True))
    q = q.order_by(SecurityArea.sort_order, SecurityArea.name)
    return (await s.execute(q)).scalars().all()


@router.get("/{area_id}", response_model=SecurityAreaOut, summary="Pobierz obszar")
async def get_area(area_id: int, s: AsyncSession = Depends(get_session)):
    area = await s.get(SecurityArea, area_id)
    if not area:
        raise HTTPException(404, "Obszar nie istnieje")
    return area


@router.post("", response_model=SecurityAreaOut, status_code=201, summary="Utwórz obszar")
async def create_area(body: SecurityAreaCreate, s: AsyncSession = Depends(get_session)):
    area = SecurityArea(**body.model_dump())
    s.add(area)
    await s.commit()
    await s.refresh(area)
    return area


@router.put("/{area_id}", response_model=SecurityAreaOut, summary="Edytuj obszar")
async def update_area(area_id: int, body: SecurityAreaUpdate, s: AsyncSession = Depends(get_session)):
    area = await s.get(SecurityArea, area_id)
    if not area:
        raise HTTPException(404, "Obszar nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(area, k, v)
    await s.commit()
    await s.refresh(area)
    return area


@router.delete("/{area_id}", summary="Archiwizuj obszar (soft delete)")
async def archive_area(area_id: int, s: AsyncSession = Depends(get_session)):
    area = await s.get(SecurityArea, area_id)
    if not area:
        raise HTTPException(404, "Obszar nie istnieje")
    area.is_active = False
    await s.commit()
    return {"status": "archived", "id": area_id}
