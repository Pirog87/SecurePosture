"""
Framework Mapping module — /api/v1/framework-mappings
Cross-framework requirement mapping and coverage analysis.

Inspired by CISO Assistant's set-theoretic mapping model:
- Relationship types: equal, subset, superset, intersect, not_related
- Numeric strength (1-3) and rationale classification
- Mapping sets grouping mappings between framework pairs
- Auto-revert (bidirectional) mapping generation
- Bulk import & confirmation workflow
"""
from datetime import datetime
import io

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.compliance import (
    FrameworkMapping,
    MappingSet,
    revert_relationship,
    RELATIONSHIP_TYPES,
)
from app.models.framework import Framework, FrameworkNode
from app.schemas.compliance import (
    FrameworkMappingCreate,
    FrameworkMappingOut,
    FrameworkMappingUpdate,
    FrameworkMappingBulkCreate,
    FrameworkMappingConfirm,
    MappingSetOut,
    MappingSetCreate,
    MappingSetUpdate,
    MappingMatrixOut,
    MappingMatrixCell,
)

router = APIRouter(prefix="/api/v1/framework-mappings", tags=["Framework Mapping"])


# ─── Helper ────────────────────────────────────────────────────

async def _mapping_out(s: AsyncSession, m: FrameworkMapping) -> FrameworkMappingOut:
    sf = await s.get(Framework, m.source_framework_id)
    tf = await s.get(Framework, m.target_framework_id)
    sr = await s.get(FrameworkNode, m.source_requirement_id)
    tr = await s.get(FrameworkNode, m.target_requirement_id)
    return FrameworkMappingOut(
        id=m.id,
        mapping_set_id=m.mapping_set_id,
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
        rationale_type=m.rationale_type,
        rationale=m.rationale,
        mapping_source=m.mapping_source,
        mapping_status=m.mapping_status,
        ai_score=m.ai_score,
        ai_model=m.ai_model,
        confirmed_by=m.confirmed_by,
        confirmed_at=m.confirmed_at,
        created_at=m.created_at,
    )


async def _set_out(s: AsyncSession, ms: MappingSet) -> MappingSetOut:
    sf = await s.get(Framework, ms.source_framework_id)
    tf = await s.get(Framework, ms.target_framework_id)
    return MappingSetOut(
        id=ms.id,
        source_framework_id=ms.source_framework_id,
        source_framework_name=sf.name if sf else None,
        target_framework_id=ms.target_framework_id,
        target_framework_name=tf.name if tf else None,
        name=ms.name,
        description=ms.description,
        status=ms.status,
        revert_set_id=ms.revert_set_id,
        mapping_count=ms.mapping_count,
        coverage_percent=ms.coverage_percent,
        created_by=ms.created_by,
        created_at=ms.created_at,
        updated_at=ms.updated_at,
    )


async def _recalc_set_stats(s: AsyncSession, mapping_set_id: int):
    """Recalculate mapping_count and coverage_percent for a mapping set."""
    ms = await s.get(MappingSet, mapping_set_id)
    if not ms:
        return
    count_q = select(func.count()).where(FrameworkMapping.mapping_set_id == mapping_set_id)
    ms.mapping_count = (await s.execute(count_q)).scalar() or 0

    # Coverage: how many target assessable nodes are covered
    tq = select(func.count()).where(
        FrameworkNode.framework_id == ms.target_framework_id,
        FrameworkNode.assessable == True,  # noqa: E712
        FrameworkNode.is_active == True,  # noqa: E712
    )
    total_target = (await s.execute(tq)).scalar() or 0

    if total_target > 0:
        covered_q = select(func.count(func.distinct(FrameworkMapping.target_requirement_id))).where(
            FrameworkMapping.mapping_set_id == mapping_set_id,
        )
        covered = (await s.execute(covered_q)).scalar() or 0
        ms.coverage_percent = round(covered / total_target * 100, 2)
    else:
        ms.coverage_percent = None


# ═══ Mapping Sets ═══════════════════════════════════════════════


@router.get("/sets", response_model=list[MappingSetOut])
async def list_mapping_sets(s: AsyncSession = Depends(get_session)):
    q = select(MappingSet).order_by(MappingSet.created_at.desc())
    rows = (await s.execute(q)).scalars().all()
    return [await _set_out(s, ms) for ms in rows]


@router.post("/sets", response_model=MappingSetOut, status_code=201)
async def create_mapping_set(body: MappingSetCreate, s: AsyncSession = Depends(get_session)):
    sf = await s.get(Framework, body.source_framework_id)
    tf = await s.get(Framework, body.target_framework_id)
    if not sf or not tf:
        raise HTTPException(404, "Source or target framework not found")
    name = body.name or f"{sf.name} <-> {tf.name}"
    ms = MappingSet(
        source_framework_id=body.source_framework_id,
        target_framework_id=body.target_framework_id,
        name=name,
        description=body.description,
    )
    s.add(ms)
    await s.commit()
    await s.refresh(ms)
    return await _set_out(s, ms)


@router.put("/sets/{set_id}", response_model=MappingSetOut)
async def update_mapping_set(set_id: int, body: MappingSetUpdate, s: AsyncSession = Depends(get_session)):
    ms = await s.get(MappingSet, set_id)
    if not ms:
        raise HTTPException(404, "Mapping set not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ms, k, v)
    await s.commit()
    await s.refresh(ms)
    return await _set_out(s, ms)


@router.delete("/sets/{set_id}", status_code=204)
async def delete_mapping_set(set_id: int, s: AsyncSession = Depends(get_session)):
    ms = await s.get(MappingSet, set_id)
    if not ms:
        raise HTTPException(404, "Mapping set not found")
    await s.delete(ms)
    await s.commit()


# ═══ Mappings CRUD ══════════════════════════════════════════════


@router.get("/", response_model=list[FrameworkMappingOut])
async def list_mappings(
    source_framework_id: int | None = None,
    target_framework_id: int | None = None,
    mapping_status: str | None = None,
    mapping_set_id: int | None = None,
    relationship_type: str | None = None,
    s: AsyncSession = Depends(get_session),
):
    q = select(FrameworkMapping)
    if source_framework_id:
        q = q.where(FrameworkMapping.source_framework_id == source_framework_id)
    if target_framework_id:
        q = q.where(FrameworkMapping.target_framework_id == target_framework_id)
    if mapping_status:
        q = q.where(FrameworkMapping.mapping_status == mapping_status)
    if mapping_set_id:
        q = q.where(FrameworkMapping.mapping_set_id == mapping_set_id)
    if relationship_type:
        q = q.where(FrameworkMapping.relationship_type == relationship_type)
    q = q.order_by(FrameworkMapping.source_requirement_id)
    rows = (await s.execute(q)).scalars().all()
    return [await _mapping_out(s, m) for m in rows]


@router.post("/", response_model=FrameworkMappingOut, status_code=201)
async def create_mapping(body: FrameworkMappingCreate, s: AsyncSession = Depends(get_session)):
    # Validate relationship type
    if body.relationship_type not in RELATIONSHIP_TYPES:
        raise HTTPException(400, f"Invalid relationship_type. Must be one of: {', '.join(RELATIONSHIP_TYPES)}")

    m = FrameworkMapping(
        **body.model_dump(),
        mapping_status="confirmed" if body.mapping_source == "manual" else "draft",
    )
    s.add(m)
    await s.commit()
    await s.refresh(m)

    if m.mapping_set_id:
        await _recalc_set_stats(s, m.mapping_set_id)
        await s.commit()

    return await _mapping_out(s, m)


@router.put("/{mapping_id}", response_model=FrameworkMappingOut)
async def update_mapping(mapping_id: int, body: FrameworkMappingUpdate, s: AsyncSession = Depends(get_session)):
    m = await s.get(FrameworkMapping, mapping_id)
    if not m:
        raise HTTPException(404, "Mapping not found")

    updates = body.model_dump(exclude_unset=True)
    if "relationship_type" in updates and updates["relationship_type"] not in RELATIONSHIP_TYPES:
        raise HTTPException(400, f"Invalid relationship_type. Must be one of: {', '.join(RELATIONSHIP_TYPES)}")

    for k, v in updates.items():
        setattr(m, k, v)
    await s.commit()
    await s.refresh(m)
    return await _mapping_out(s, m)


@router.delete("/{mapping_id}", status_code=204)
async def delete_mapping(mapping_id: int, s: AsyncSession = Depends(get_session)):
    m = await s.get(FrameworkMapping, mapping_id)
    if not m:
        raise HTTPException(404, "Mapping not found")
    set_id = m.mapping_set_id
    await s.delete(m)
    await s.commit()
    if set_id:
        await _recalc_set_stats(s, set_id)
        await s.commit()


# ═══ Confirmation Workflow ══════════════════════════════════════


@router.post("/{mapping_id}/confirm", response_model=FrameworkMappingOut)
async def confirm_mapping(mapping_id: int, body: FrameworkMappingConfirm, s: AsyncSession = Depends(get_session)):
    m = await s.get(FrameworkMapping, mapping_id)
    if not m:
        raise HTTPException(404, "Mapping not found")
    m.mapping_status = "confirmed"
    m.confirmed_by = body.confirmed_by
    m.confirmed_at = datetime.utcnow()
    await s.commit()
    await s.refresh(m)
    return await _mapping_out(s, m)


@router.post("/bulk-confirm")
async def bulk_confirm(
    mapping_ids: list[int],
    confirmed_by: str = Query(...),
    s: AsyncSession = Depends(get_session),
):
    """Confirm multiple draft mappings at once."""
    now = datetime.utcnow()
    count = 0
    for mid in mapping_ids:
        m = await s.get(FrameworkMapping, mid)
        if m and m.mapping_status == "draft":
            m.mapping_status = "confirmed"
            m.confirmed_by = confirmed_by
            m.confirmed_at = now
            count += 1
    await s.commit()
    return {"confirmed": count}


# ═══ Bulk Import ════════════════════════════════════════════════


@router.post("/bulk-import")
async def bulk_import_mappings(body: FrameworkMappingBulkCreate, s: AsyncSession = Depends(get_session)):
    """Bulk import mappings with optional auto-revert (CISO Assistant pattern).

    Each item in `mappings` should have:
      source_ref_id, target_ref_id, relationship_type, strength (optional)
    """
    sf = await s.get(Framework, body.source_framework_id)
    tf = await s.get(Framework, body.target_framework_id)
    if not sf or not tf:
        raise HTTPException(404, "Source or target framework not found")

    # Build ref_id → node_id lookups for both frameworks
    src_q = select(FrameworkNode).where(FrameworkNode.framework_id == body.source_framework_id)
    tgt_q = select(FrameworkNode).where(FrameworkNode.framework_id == body.target_framework_id)
    src_nodes = {n.ref_id: n.id for n in (await s.execute(src_q)).scalars().all() if n.ref_id}
    tgt_nodes = {n.ref_id: n.id for n in (await s.execute(tgt_q)).scalars().all() if n.ref_id}

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
            name=f"{sf.name} <-> {tf.name}",
        )
        s.add(ms)
        await s.flush()

    created = 0
    skipped = 0
    errors = []

    for item in body.mappings:
        src_ref = item.get("source_ref_id")
        tgt_ref = item.get("target_ref_id")
        rel = item.get("relationship_type", "intersect")
        strength = item.get("strength", 2)

        if not src_ref or not tgt_ref:
            errors.append(f"Missing ref_id in mapping: {item}")
            continue

        src_id = src_nodes.get(src_ref)
        tgt_id = tgt_nodes.get(tgt_ref)
        if not src_id:
            errors.append(f"Source ref_id not found: {src_ref}")
            skipped += 1
            continue
        if not tgt_id:
            errors.append(f"Target ref_id not found: {tgt_ref}")
            skipped += 1
            continue

        if rel not in RELATIONSHIP_TYPES:
            rel = "intersect"

        # Check for duplicate
        dup_q = select(FrameworkMapping).where(
            FrameworkMapping.source_requirement_id == src_id,
            FrameworkMapping.target_requirement_id == tgt_id,
        )
        existing = (await s.execute(dup_q)).scalar_one_or_none()
        if existing:
            skipped += 1
            continue

        m = FrameworkMapping(
            mapping_set_id=ms.id,
            source_framework_id=body.source_framework_id,
            source_requirement_id=src_id,
            target_framework_id=body.target_framework_id,
            target_requirement_id=tgt_id,
            relationship_type=rel,
            strength=strength,
            rationale_type=item.get("rationale_type"),
            rationale=item.get("rationale"),
            mapping_source=body.mapping_source,
            mapping_status="draft",
        )
        s.add(m)
        created += 1

    await s.flush()

    # Auto-revert: generate inverse mappings
    revert_created = 0
    if body.auto_revert and created > 0:
        # Find or create revert mapping set
        rev_q = select(MappingSet).where(
            MappingSet.source_framework_id == body.target_framework_id,
            MappingSet.target_framework_id == body.source_framework_id,
        )
        rev_ms = (await s.execute(rev_q)).scalar_one_or_none()
        if not rev_ms:
            rev_ms = MappingSet(
                source_framework_id=body.target_framework_id,
                target_framework_id=body.source_framework_id,
                name=f"{tf.name} <-> {sf.name} (revert)",
            )
            s.add(rev_ms)
            await s.flush()
            ms.revert_set_id = rev_ms.id

        # Create inverse mappings
        fwd_q = select(FrameworkMapping).where(FrameworkMapping.mapping_set_id == ms.id)
        fwd_mappings = (await s.execute(fwd_q)).scalars().all()

        for fm in fwd_mappings:
            # Check for existing reverse
            rev_dup = select(FrameworkMapping).where(
                FrameworkMapping.source_requirement_id == fm.target_requirement_id,
                FrameworkMapping.target_requirement_id == fm.source_requirement_id,
            )
            if (await s.execute(rev_dup)).scalar_one_or_none():
                continue

            rev_m = FrameworkMapping(
                mapping_set_id=rev_ms.id,
                source_framework_id=fm.target_framework_id,
                source_requirement_id=fm.target_requirement_id,
                target_framework_id=fm.source_framework_id,
                target_requirement_id=fm.source_requirement_id,
                relationship_type=revert_relationship(fm.relationship_type),
                strength=fm.strength,
                rationale_type=fm.rationale_type,
                rationale=fm.rationale,
                mapping_source=body.mapping_source,
                mapping_status="draft",
            )
            s.add(rev_m)
            revert_created += 1

        await s.flush()
        await _recalc_set_stats(s, rev_ms.id)

    await _recalc_set_stats(s, ms.id)
    await s.commit()

    return {
        "created": created,
        "revert_created": revert_created,
        "skipped": skipped,
        "errors": errors[:20],  # Limit error messages
        "mapping_set_id": ms.id,
    }


# ═══ YAML Import (CISO Assistant mapping files) ════════════════


@router.post("/import/yaml")
async def import_mapping_yaml_endpoint(
    file: UploadFile = File(...),
    source_framework_id: int | None = Query(None, description="Override source framework (optional)"),
    target_framework_id: int | None = Query(None, description="Override target framework (optional)"),
    auto_revert: bool = Query(True, description="Auto-generate inverse mappings"),
    s: AsyncSession = Depends(get_session),
):
    """Import mappings from a CISO Assistant mapping YAML file.

    Parses the YAML file's requirement_mapping_sets and creates framework mappings.
    Frameworks are resolved by URN from the YAML, or can be overridden with query params.
    """
    from app.services.mapping_import import import_mapping_yaml

    if not file.filename or not file.filename.endswith((".yaml", ".yml")):
        raise HTTPException(400, "File must be a YAML file (.yaml or .yml)")

    content = await file.read()
    file_obj = io.BytesIO(content)

    try:
        result = await import_mapping_yaml(
            s,
            file_obj,
            source_framework_id=source_framework_id,
            target_framework_id=target_framework_id,
            auto_revert=auto_revert,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        await s.rollback()
        raise HTTPException(500, f"Import error: {e}")

    return {
        "mapping_set_id": result.mapping_set_id,
        "source_framework_name": result.source_framework_name,
        "target_framework_name": result.target_framework_name,
        "created": result.created,
        "revert_created": result.revert_created,
        "skipped": result.skipped,
        "errors": result.errors[:20],
    }


@router.post("/import/github-mapping")
async def import_mapping_from_github(
    mapping_path: str = Query(..., description="Path to mapping YAML in CISO Assistant repo, e.g. 'mapping-nist-sp-800-53-rev5-to-iso27001-2022.yaml'"),
    source_framework_id: int | None = Query(None),
    target_framework_id: int | None = Query(None),
    auto_revert: bool = Query(True),
    s: AsyncSession = Depends(get_session),
):
    """Import mappings directly from the CISO Assistant GitHub repository."""
    import httpx

    base_url = "https://raw.githubusercontent.com/intuitem/ciso-assistant-community/main/backend/library/libraries"
    url = f"{base_url}/{mapping_path}"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(400, f"Failed to fetch from GitHub: {e}")

    from app.services.mapping_import import import_mapping_yaml

    file_obj = io.BytesIO(resp.content)
    try:
        result = await import_mapping_yaml(
            s,
            file_obj,
            source_framework_id=source_framework_id,
            target_framework_id=target_framework_id,
            auto_revert=auto_revert,
            imported_by="github-import",
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        await s.rollback()
        raise HTTPException(500, f"GitHub import error: {e}")

    return {
        "mapping_set_id": result.mapping_set_id,
        "source_framework_name": result.source_framework_name,
        "target_framework_name": result.target_framework_name,
        "created": result.created,
        "revert_created": result.revert_created,
        "skipped": result.skipped,
        "errors": result.errors[:20],
    }


# ═══ Coverage Analysis ══════════════════════════════════════════


@router.get("/coverage")
async def cross_framework_coverage(
    source_framework_id: int = Query(...),
    target_framework_id: int = Query(...),
    s: AsyncSession = Depends(get_session),
):
    """Calculate how much of target framework is covered by mappings from source."""
    tq = select(FrameworkNode).where(
        FrameworkNode.framework_id == target_framework_id,
        FrameworkNode.assessable == True,  # noqa: E712
        FrameworkNode.is_active == True,  # noqa: E712
    )
    target_reqs = (await s.execute(tq)).scalars().all()

    mq = select(FrameworkMapping).where(
        FrameworkMapping.source_framework_id == source_framework_id,
        FrameworkMapping.target_framework_id == target_framework_id,
    )
    mappings = (await s.execute(mq)).scalars().all()

    mapped_target_ids = {m.target_requirement_id for m in mappings}
    confirmed_ids = {m.target_requirement_id for m in mappings if m.mapping_status == "confirmed"}

    total = len(target_reqs)
    covered = sum(1 for r in target_reqs if r.id in mapped_target_ids)
    confirmed_covered = sum(1 for r in target_reqs if r.id in confirmed_ids)

    uncovered_reqs = [
        {"id": r.id, "ref_id": r.ref_id, "name": r.name}
        for r in target_reqs
        if r.id not in mapped_target_ids
    ]

    # Breakdown by relationship type
    by_relationship = {}
    for m in mappings:
        by_relationship[m.relationship_type] = by_relationship.get(m.relationship_type, 0) + 1

    # Breakdown by strength
    by_strength = {}
    for m in mappings:
        by_strength[m.strength] = by_strength.get(m.strength, 0) + 1

    return {
        "source_framework_id": source_framework_id,
        "target_framework_id": target_framework_id,
        "total_requirements": total,
        "covered": covered,
        "confirmed_covered": confirmed_covered,
        "uncovered": total - covered,
        "coverage_percent": round(covered / total * 100, 1) if total > 0 else 0,
        "confirmed_coverage_percent": round(confirmed_covered / total * 100, 1) if total > 0 else 0,
        "by_relationship": by_relationship,
        "by_strength": by_strength,
        "uncovered_requirements": uncovered_reqs,
    }


# ═══ Mapping Matrix ═════════════════════════════════════════════


@router.get("/matrix", response_model=MappingMatrixOut)
async def mapping_matrix(
    source_framework_id: int = Query(...),
    target_framework_id: int = Query(...),
    s: AsyncSession = Depends(get_session),
):
    """Get a matrix view of all mappings between two frameworks."""
    sf = await s.get(Framework, source_framework_id)
    tf = await s.get(Framework, target_framework_id)
    if not sf or not tf:
        raise HTTPException(404, "Framework not found")

    mq = select(FrameworkMapping).where(
        FrameworkMapping.source_framework_id == source_framework_id,
        FrameworkMapping.target_framework_id == target_framework_id,
    )
    mappings = (await s.execute(mq)).scalars().all()

    # Coverage
    tq = select(func.count()).where(
        FrameworkNode.framework_id == target_framework_id,
        FrameworkNode.assessable == True,  # noqa: E712
        FrameworkNode.is_active == True,  # noqa: E712
    )
    total_target = (await s.execute(tq)).scalar() or 0
    covered_ids = {m.target_requirement_id for m in mappings}
    coverage = round(len(covered_ids) / total_target * 100, 1) if total_target > 0 else 0

    by_rel = {}
    by_str = {}
    cells = []

    for m in mappings:
        sr = await s.get(FrameworkNode, m.source_requirement_id)
        tr = await s.get(FrameworkNode, m.target_requirement_id)
        cells.append(MappingMatrixCell(
            source_ref_id=sr.ref_id if sr else None,
            source_name=sr.name if sr else None,
            target_ref_id=tr.ref_id if tr else None,
            target_name=tr.name if tr else None,
            relationship_type=m.relationship_type,
            strength=m.strength,
        ))
        by_rel[m.relationship_type] = by_rel.get(m.relationship_type, 0) + 1
        by_str[m.strength] = by_str.get(m.strength, 0) + 1

    return MappingMatrixOut(
        source_framework_id=source_framework_id,
        source_framework_name=sf.name,
        target_framework_id=target_framework_id,
        target_framework_name=tf.name,
        total_mappings=len(mappings),
        coverage_percent=coverage,
        by_relationship=by_rel,
        by_strength=by_str,
        mappings=cells,
    )


# ═══ Statistics ═════════════════════════════════════════════════


@router.get("/stats")
async def mapping_statistics(s: AsyncSession = Depends(get_session)):
    """Global mapping statistics across all frameworks."""
    total_q = select(func.count()).select_from(FrameworkMapping)
    total = (await s.execute(total_q)).scalar() or 0

    confirmed_q = select(func.count()).where(FrameworkMapping.mapping_status == "confirmed")
    confirmed = (await s.execute(confirmed_q)).scalar() or 0

    draft_q = select(func.count()).where(FrameworkMapping.mapping_status == "draft")
    draft = (await s.execute(draft_q)).scalar() or 0

    # Unique framework pairs
    pairs_q = select(
        FrameworkMapping.source_framework_id,
        FrameworkMapping.target_framework_id,
    ).distinct()
    pairs = (await s.execute(pairs_q)).all()

    # By relationship type
    by_rel_q = select(
        FrameworkMapping.relationship_type,
        func.count(),
    ).group_by(FrameworkMapping.relationship_type)
    by_rel = {r: c for r, c in (await s.execute(by_rel_q)).all()}

    # By source
    by_src_q = select(
        FrameworkMapping.mapping_source,
        func.count(),
    ).group_by(FrameworkMapping.mapping_source)
    by_src = {r: c for r, c in (await s.execute(by_src_q)).all()}

    sets_q = select(func.count()).select_from(MappingSet)
    sets_count = (await s.execute(sets_q)).scalar() or 0

    return {
        "total_mappings": total,
        "confirmed": confirmed,
        "draft": draft,
        "framework_pairs": len(pairs),
        "mapping_sets": sets_count,
        "by_relationship": by_rel,
        "by_source": by_src,
    }
