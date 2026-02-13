"""
Framework Mapping module — /api/v1/framework-mappings
Cross-framework requirement mapping and coverage analysis.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.compliance import FrameworkMapping
from app.models.framework import Framework, FrameworkNode
from app.schemas.compliance import (
    FrameworkMappingCreate,
    FrameworkMappingOut,
    FrameworkMappingUpdate,
)

router = APIRouter(prefix="/api/v1/framework-mappings", tags=["Framework Mapping"])


async def _mapping_out(s: AsyncSession, m: FrameworkMapping) -> FrameworkMappingOut:
    sf = await s.get(Framework, m.source_framework_id)
    tf = await s.get(Framework, m.target_framework_id)
    sr = await s.get(FrameworkNode, m.source_requirement_id)
    tr = await s.get(FrameworkNode, m.target_requirement_id)
    return FrameworkMappingOut(
        id=m.id,
        source_framework_id=m.source_framework_id,
        source_framework_name=sf.name if sf else None,
        source_requirement_id=m.source_requirement_id,
        source_requirement_ref=sr.ref_id if sr else None,
        source_requirement_name=sr.name if sr else None,
        target_framework_id=m.target_framework_id,
        target_framework_name=tf.name if tf else None,
        target_requirement_id=m.target_requirement_id,
        target_requirement_ref=tr.ref_id if tr else None,
        target_requirement_name=tr.name if tr else None,
        relationship_type=m.relationship_type,
        strength=m.strength,
        rationale=m.rationale,
        mapping_source=m.mapping_source,
        mapping_status=m.mapping_status,
        confirmed_by=m.confirmed_by,
        confirmed_at=m.confirmed_at,
        created_at=m.created_at,
    )


@router.get("/", response_model=list[FrameworkMappingOut])
async def list_mappings(
    source_framework_id: int | None = None,
    target_framework_id: int | None = None,
    mapping_status: str | None = None,
    s: AsyncSession = Depends(get_session),
):
    q = select(FrameworkMapping)
    if source_framework_id:
        q = q.where(FrameworkMapping.source_framework_id == source_framework_id)
    if target_framework_id:
        q = q.where(FrameworkMapping.target_framework_id == target_framework_id)
    if mapping_status:
        q = q.where(FrameworkMapping.mapping_status == mapping_status)
    q = q.order_by(FrameworkMapping.source_requirement_id)
    rows = (await s.execute(q)).scalars().all()
    return [await _mapping_out(s, m) for m in rows]


@router.post("/", response_model=FrameworkMappingOut, status_code=201)
async def create_mapping(body: FrameworkMappingCreate, s: AsyncSession = Depends(get_session)):
    m = FrameworkMapping(**body.model_dump(), mapping_status="confirmed" if body.mapping_source == "manual" else "draft")
    s.add(m)
    await s.commit()
    await s.refresh(m)
    return await _mapping_out(s, m)


@router.put("/{mapping_id}", response_model=FrameworkMappingOut)
async def update_mapping(mapping_id: int, body: FrameworkMappingUpdate, s: AsyncSession = Depends(get_session)):
    m = await s.get(FrameworkMapping, mapping_id)
    if not m:
        raise HTTPException(404, "Mapping not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    await s.commit()
    await s.refresh(m)
    return await _mapping_out(s, m)


@router.delete("/{mapping_id}", status_code=204)
async def delete_mapping(mapping_id: int, s: AsyncSession = Depends(get_session)):
    m = await s.get(FrameworkMapping, mapping_id)
    if not m:
        raise HTTPException(404, "Mapping not found")
    await s.delete(m)
    await s.commit()


# ─── Coverage Analysis ────────────────────────────────────────


@router.get("/coverage")
async def cross_framework_coverage(
    source_framework_id: int = Query(...),
    target_framework_id: int = Query(...),
    s: AsyncSession = Depends(get_session),
):
    """Calculate how much of target framework is covered by mappings from source."""
    # Get all assessable requirements in target framework
    tq = select(FrameworkNode).where(
        FrameworkNode.framework_id == target_framework_id,
        FrameworkNode.assessable == True,  # noqa: E712
        FrameworkNode.is_active == True,  # noqa: E712
    )
    target_reqs = (await s.execute(tq)).scalars().all()

    # Get all mappings from source to target
    mq = select(FrameworkMapping).where(
        FrameworkMapping.source_framework_id == source_framework_id,
        FrameworkMapping.target_framework_id == target_framework_id,
        FrameworkMapping.mapping_status == "confirmed",
    )
    mappings = (await s.execute(mq)).scalars().all()

    mapped_target_ids = {m.target_requirement_id for m in mappings}

    total = len(target_reqs)
    covered = sum(1 for r in target_reqs if r.id in mapped_target_ids)
    uncovered = total - covered

    uncovered_reqs = [
        {"id": r.id, "ref_id": r.ref_id, "name": r.name}
        for r in target_reqs
        if r.id not in mapped_target_ids
    ]

    return {
        "source_framework_id": source_framework_id,
        "target_framework_id": target_framework_id,
        "total_requirements": total,
        "covered": covered,
        "uncovered": uncovered,
        "coverage_percent": round(covered / total * 100, 1) if total > 0 else 0,
        "uncovered_requirements": uncovered_reqs,
    }
