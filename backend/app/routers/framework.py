"""
Requirements Repository (Repozytorium Wymagań) -- /api/v1/frameworks

Universal reference document management: frameworks, standards, regulations,
internal policies, procedures, etc.

CRUD for documents, nodes, area mappings, dimensions.
Import from Excel/YAML/GitHub with adoption form.
Manual creation, editing with versioning, lifecycle statuses.
Document copy, org unit linking, review management.
"""
from __future__ import annotations

import logging
from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File

logger = logging.getLogger(__name__)
from sqlalchemy import select, func, update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.dictionary import DictionaryEntry
from app.models.framework import (
    AssessmentDimension, DimensionLevel, Framework, FrameworkNode,
    FrameworkNodeSecurityArea, FrameworkVersionHistory, FrameworkOrgUnit,
    FrameworkReview, LIFECYCLE_STATUSES,
)
from app.models.org_unit import OrgUnit
from app.models.security_area import SecurityDomain
from app.schemas.framework import (
    AreaMappingBulkCreate, AreaMappingOut, AutoMapResult,
    DimensionOut, DimensionsUpdate,
    FrameworkBrief, FrameworkCreate, FrameworkCopyRequest, FrameworkImportResult,
    FrameworkImportAdoptionRequest, FrameworkMetrics,
    FrameworkMetricUnit, FrameworkNodeBrief, FrameworkNodeCreate,
    FrameworkNodeOut, FrameworkNodeTreeOut, FrameworkNodeUpdate, FrameworkOut,
    FrameworkOrgUnitCreate, FrameworkOrgUnitOut, FrameworkOrgUnitUpdate,
    FrameworkReviewCreate, FrameworkReviewOut,
    FrameworkUpdate, FrameworkVersionOut, LifecycleChangeRequest,
)
from app.services.framework_import import import_from_excel, import_from_yaml

router = APIRouter(prefix="/api/v1/frameworks", tags=["Repozytorium Wymagań"])


# ===================================================
# HELPERS -- resolve document_type_name for output
# ===================================================

async def _reload_framework(s: AsyncSession, fw_id: int) -> Framework | None:
    """Reload framework with dimensions eagerly loaded, bypassing identity map cache.

    Using select() with populate_existing=True instead of s.get() ensures that
    selectinload is applied even when the object is already in the identity map
    (e.g. after commit). Without this, s.get() returns the cached object and
    Pydantic triggers a lazy load on .dimensions which fails in async context
    with MissingGreenlet.
    """
    result = await s.execute(
        select(Framework)
        .where(Framework.id == fw_id)
        .options(
            selectinload(Framework.dimensions).selectinload(AssessmentDimension.levels)
        )
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def _enrich_framework_out(fw: Framework, s: AsyncSession) -> dict:
    """Add computed fields for FrameworkOut / FrameworkBrief."""
    extra: dict = {}
    if fw.document_type_id:
        dt = await s.get(DictionaryEntry, fw.document_type_id)
        extra["document_type_name"] = dt.label if dt else None
    else:
        extra["document_type_name"] = None
    extra["display_version"] = fw.display_version
    if fw.updates_document_id:
        upd = await s.get(Framework, fw.updates_document_id)
        extra["updates_document_name"] = upd.name if upd else None
    else:
        extra["updates_document_name"] = None
    return extra


# ===================================================
# METRICS -- must be before /{fw_id} to avoid path collision
# ===================================================

@router.get("/metrics", response_model=FrameworkMetrics, summary="Metryki Control Maturity")
async def get_metrics(
    framework_id: int | None = Query(None, description="ID frameworka (domyslnie: najnowszy aktywny)"),
    s: AsyncSession = Depends(get_session),
):
    """Latest approved assessment scores per org unit -- for Security Score pillar."""
    from app.models.framework import Assessment
    from app.models.org_unit import OrgUnit
    from sqlalchemy import and_

    if framework_id:
        fw = await s.get(Framework, framework_id)
    else:
        fw = (await s.execute(
            select(Framework).where(Framework.is_active.is_(True))
            .order_by(Framework.created_at.desc()).limit(1)
        )).scalar_one_or_none()

    if not fw:
        raise HTTPException(404, "Brak aktywnych frameworkow")

    sub = (
        select(
            Assessment.org_unit_id,
            func.max(Assessment.assessment_date).label("max_date"),
        )
        .where(
            Assessment.framework_id == fw.id,
            Assessment.is_active.is_(True),
            Assessment.status == "approved",
        )
        .group_by(Assessment.org_unit_id)
        .subquery()
    )

    rows = (await s.execute(
        select(Assessment, OrgUnit.name.label("ou_name"))
        .outerjoin(OrgUnit, Assessment.org_unit_id == OrgUnit.id)
        .join(sub, and_(
            Assessment.org_unit_id == sub.c.org_unit_id,
            Assessment.assessment_date == sub.c.max_date,
        ))
        .where(
            Assessment.framework_id == fw.id,
            Assessment.is_active.is_(True),
            Assessment.status == "approved",
        )
        .order_by(Assessment.org_unit_id)
    )).all()

    units = []
    scores = []
    for a, ou_name in rows:
        units.append(FrameworkMetricUnit(
            org_unit_id=a.org_unit_id, org_unit_name=ou_name,
            assessment_id=a.id, assessment_date=a.assessment_date,
            overall_score=float(a.overall_score) if a.overall_score else None,
            completion_pct=float(a.completion_pct) if a.completion_pct else None,
        ))
        if a.overall_score is not None:
            scores.append(float(a.overall_score))

    return FrameworkMetrics(
        framework_id=fw.id, framework_name=fw.name,
        units=units,
        organization_score=sum(scores) / len(scores) if scores else None,
    )


# ===================================================
# FRAMEWORKS -- CRUD
# ===================================================

@router.get("", response_model=list[FrameworkBrief], summary="Lista dokumentów referencyjnych")
async def list_frameworks(
    is_active: bool | None = Query(None),
    lifecycle_status: str | None = Query(None),
    document_type_id: int | None = Query(None, description="Filter by document type"),
    document_origin: str | None = Query(None, description="Filter: internal / external"),
    requires_review: bool | None = Query(None),
    review_overdue: bool | None = Query(None, description="Only documents with overdue reviews"),
    s: AsyncSession = Depends(get_session),
):
    try:
        q = select(Framework).order_by(Framework.document_origin, Framework.name)
    except Exception:
        # Fallback: document_origin column may not exist yet (pre-migration)
        q = select(Framework).order_by(Framework.name)
    if is_active is not None:
        q = q.where(Framework.is_active == is_active)
    if lifecycle_status:
        try:
            q = q.where(Framework.lifecycle_status == lifecycle_status)
        except Exception:
            pass
    if document_type_id is not None:
        try:
            q = q.where(Framework.document_type_id == document_type_id)
        except Exception:
            pass
    if document_origin:
        try:
            q = q.where(Framework.document_origin == document_origin)
        except Exception:
            pass
    if requires_review is not None:
        try:
            q = q.where(Framework.requires_review == requires_review)
        except Exception:
            pass
    if review_overdue:
        try:
            today = date.today()
            q = q.where(
                Framework.requires_review.is_(True),
                Framework.next_review_date.isnot(None),
                Framework.next_review_date < today,
            )
        except Exception:
            pass
    try:
        rows = (await s.execute(q)).scalars().all()
    except Exception as exc:
        logger.warning("list_frameworks: query failed (missing columns?), trying minimal query: %s", exc)
        await s.rollback()
        # Minimal fallback: only columns guaranteed to exist from migration 001
        from sqlalchemy import text
        rows_raw = (await s.execute(
            text("SELECT id, name, ref_id, version, provider, total_nodes, total_assessable, is_active FROM frameworks ORDER BY name")
        )).all()
        return [
            FrameworkBrief(
                id=r[0], name=r[1], ref_id=r[2], version=r[3], provider=r[4],
                total_nodes=r[5] or 0, total_assessable=r[6] or 0,
                is_active=bool(r[7]) if r[7] is not None else True,
            )
            for r in rows_raw
        ]
    result = []
    for fw in rows:
        try:
            extra = await _enrich_framework_out(fw, s)
        except Exception:
            extra = {}
        brief = FrameworkBrief.model_validate(fw)
        for k, v in extra.items():
            if hasattr(brief, k):
                setattr(brief, k, v)
        result.append(brief)
    return result


@router.post("", response_model=FrameworkOut, summary="Nowy dokument referencyjny (ręczny)")
async def create_framework(
    body: FrameworkCreate,
    s: AsyncSession = Depends(get_session),
):
    """Create a new empty reference document manually from scratch."""
    from app.services.framework_import import _create_default_dimensions

    fw = Framework(
        name=body.name,
        ref_id=body.ref_id,
        description=body.description,
        version=body.version,
        provider=body.provider,
        locale=body.locale,
        source_format="manual",
        lifecycle_status="draft",
        edit_version=1,
        imported_at=datetime.utcnow(),
        imported_by="manual",
        # Document Repository fields
        document_type_id=body.document_type_id,
        document_origin=body.document_origin,
        owner=body.owner,
        requires_review=body.requires_review,
        review_frequency_months=body.review_frequency_months,
        updates_document_id=body.updates_document_id,
    )
    s.add(fw)
    await s.flush()

    # Create default dimension
    await _create_default_dimensions(s, fw)

    # Create initial version record
    s.add(FrameworkVersionHistory(
        framework_id=fw.id,
        edit_version=1,
        lifecycle_status="draft",
        change_summary="Utworzenie dokumentu referencyjnego",
        changed_by="admin",
        snapshot_nodes_count=0,
        snapshot_assessable_count=0,
    ))

    await s.commit()

    # Reload with dimensions (populate_existing to bypass identity map cache)
    fw = await _reload_framework(s, fw.id)
    extra = await _enrich_framework_out(fw, s)
    out = FrameworkOut.model_validate(fw)
    for k, v in extra.items():
        if hasattr(out, k):
            setattr(out, k, v)
    return out


@router.get("/{fw_id}", response_model=FrameworkOut, summary="Szczegóły dokumentu referencyjnego")
async def get_framework(fw_id: int, s: AsyncSession = Depends(get_session)):
    fw = await _reload_framework(s, fw_id)
    if not fw:
        raise HTTPException(404, "Dokument nie istnieje")
    extra = await _enrich_framework_out(fw, s)
    out = FrameworkOut.model_validate(fw)
    for k, v in extra.items():
        if hasattr(out, k):
            setattr(out, k, v)
    return out


@router.put("/{fw_id}", response_model=FrameworkOut, summary="Edycja metadanych dokumentu")
async def update_framework(
    fw_id: int, body: FrameworkUpdate, s: AsyncSession = Depends(get_session),
):
    """Update document metadata and bump edit version."""
    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Dokument nie istnieje")

    # Update provided fields
    if body.name is not None:
        fw.name = body.name
    if body.ref_id is not None:
        fw.ref_id = body.ref_id
    if body.description is not None:
        fw.description = body.description
    if body.version is not None:
        fw.version = body.version
    if body.provider is not None:
        fw.provider = body.provider
    if body.locale is not None:
        fw.locale = body.locale
    if body.published_version is not None:
        fw.published_version = body.published_version
    # Document Repository fields
    if body.document_type_id is not None:
        fw.document_type_id = body.document_type_id
    if body.document_origin is not None:
        fw.document_origin = body.document_origin
    if body.owner is not None:
        fw.owner = body.owner
    if body.requires_review is not None:
        fw.requires_review = body.requires_review
    if body.review_frequency_months is not None:
        fw.review_frequency_months = body.review_frequency_months

    # Bump version
    fw.edit_version += 1
    fw.minor_version += 1
    fw.last_edited_by = "admin"
    fw.last_edited_at = datetime.utcnow()

    # Record version history
    s.add(FrameworkVersionHistory(
        framework_id=fw.id,
        edit_version=fw.edit_version,
        lifecycle_status=fw.lifecycle_status,
        change_summary=body.change_summary or "Edycja metadanych",
        changed_by="admin",
        snapshot_nodes_count=fw.total_nodes,
        snapshot_assessable_count=fw.total_assessable,
    ))

    await s.commit()

    fw = await _reload_framework(s, fw_id)
    extra = await _enrich_framework_out(fw, s)
    out = FrameworkOut.model_validate(fw)
    for k, v in extra.items():
        if hasattr(out, k):
            setattr(out, k, v)
    return out


@router.delete("/{fw_id}", summary="Usuń / archiwizuj dokument")
async def delete_framework(fw_id: int, s: AsyncSession = Depends(get_session)):
    """Delete or archive a reference document.

    Draft/review documents: hard-deleted (any assessments also cleaned up).
    Published/deprecated documents: soft-deleted (archived) — only specific roles.
    Archived documents: permanently removed.
    """
    from sqlalchemy import delete as sa_delete
    from app.models.framework import Assessment, AssessmentAnswer

    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Dokument nie istnieje")

    if fw.lifecycle_status == "published":
        # Published -> soft-delete (archive)
        fw.is_active = False
        fw.lifecycle_status = "archived"
        fw.edit_version += 1
        fw.last_edited_by = "admin"
        fw.last_edited_at = datetime.utcnow()
        s.add(FrameworkVersionHistory(
            framework_id=fw.id,
            edit_version=fw.edit_version,
            lifecycle_status="archived",
            change_summary="Archiwizacja dokumentu",
            changed_by="admin",
            snapshot_nodes_count=fw.total_nodes,
            snapshot_assessable_count=fw.total_assessable,
        ))
        await s.commit()
        return {"status": "archived", "id": fw_id}

    # Draft / review / deprecated / archived -> hard-delete
    # First clean up assessments (deactivate them)
    assessments = (await s.execute(
        select(Assessment).where(Assessment.framework_id == fw_id)
    )).scalars().all()
    for a in assessments:
        await s.execute(
            sa_delete(AssessmentAnswer).where(AssessmentAnswer.assessment_id == a.id)
        )
        await s.delete(a)

    # Clean up org unit links
    await s.execute(
        sa_delete(FrameworkOrgUnit).where(FrameworkOrgUnit.framework_id == fw_id)
    )
    # Clean up reviews
    await s.execute(
        sa_delete(FrameworkReview).where(FrameworkReview.framework_id == fw_id)
    )
    # Clean up area mappings
    await s.execute(
        sa_delete(FrameworkNodeSecurityArea).where(
            FrameworkNodeSecurityArea.framework_node_id.in_(
                select(FrameworkNode.id).where(FrameworkNode.framework_id == fw_id)
            )
        )
    )
    await s.delete(fw)
    await s.commit()
    return {"status": "deleted", "id": fw_id}


# ===================================================
# LIFECYCLE STATUS
# ===================================================

VALID_TRANSITIONS = {
    "draft": ["review", "published", "archived"],
    "review": ["draft", "published", "archived"],
    "published": ["deprecated", "draft", "archived"],
    "deprecated": ["archived", "draft"],
    "archived": ["draft"],
}


@router.put("/{fw_id}/lifecycle", response_model=FrameworkOut, summary="Zmiana statusu cyklu zycia")
async def change_lifecycle(
    fw_id: int, body: LifecycleChangeRequest, s: AsyncSession = Depends(get_session),
):
    """Change framework lifecycle status with transition validation."""
    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Framework nie istnieje")

    new_status = body.status
    if new_status not in LIFECYCLE_STATUSES:
        raise HTTPException(400, f"Nieprawidlowy status: {new_status}. Dozwolone: {', '.join(LIFECYCLE_STATUSES)}")

    current = fw.lifecycle_status
    allowed = VALID_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        raise HTTPException(
            400,
            f"Nie mozna zmienic statusu z '{current}' na '{new_status}'. "
            f"Dozwolone przejscia: {', '.join(allowed)}",
        )

    old_status = fw.lifecycle_status
    fw.lifecycle_status = new_status
    fw.edit_version += 1
    fw.last_edited_by = "admin"
    fw.last_edited_at = datetime.utcnow()

    if new_status == "archived":
        fw.is_active = False
    elif old_status == "archived":
        fw.is_active = True

    # When publishing (approving): bump major version, reset minor
    if new_status == "published":
        fw.major_version += 1
        fw.minor_version = 0
        fw.approved_by = "admin"
        fw.approved_at = datetime.utcnow()
        fw.published_version = fw.display_version
        # Set next review date if reviews are required
        if fw.requires_review:
            fw.next_review_date = date.today() + timedelta(days=fw.review_frequency_months * 30)

    # Record version
    s.add(FrameworkVersionHistory(
        framework_id=fw.id,
        edit_version=fw.edit_version,
        lifecycle_status=new_status,
        change_summary=body.change_summary or f"Zmiana statusu: {old_status} -> {new_status}",
        changed_by="admin",
        snapshot_nodes_count=fw.total_nodes,
        snapshot_assessable_count=fw.total_assessable,
    ))

    await s.commit()

    fw = await _reload_framework(s, fw_id)
    extra = await _enrich_framework_out(fw, s)
    out = FrameworkOut.model_validate(fw)
    for k, v in extra.items():
        if hasattr(out, k):
            setattr(out, k, v)
    return out


# ===================================================
# VERSION HISTORY
# ===================================================

@router.get("/{fw_id}/versions", response_model=list[FrameworkVersionOut], summary="Historia wersji")
async def get_versions(fw_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(FrameworkVersionHistory)
        .where(FrameworkVersionHistory.framework_id == fw_id)
        .order_by(FrameworkVersionHistory.edit_version.desc())
    )
    rows = (await s.execute(q)).scalars().all()
    return [FrameworkVersionOut.model_validate(v) for v in rows]


# ===================================================
# FRAMEWORK NODES -- tree & list
# ===================================================

@router.get("/{fw_id}/tree", response_model=list[FrameworkNodeTreeOut], summary="Drzewo nodes")
async def get_framework_tree(fw_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(FrameworkNode)
        .where(FrameworkNode.framework_id == fw_id, FrameworkNode.is_active.is_(True))
        .order_by(FrameworkNode.order_id)
    )
    all_nodes = list((await s.execute(q)).scalars().all())

    # Build tree -- construct manually to avoid lazy-load of ORM `children` relationship
    node_map: dict[int, FrameworkNodeTreeOut] = {}
    roots: list[FrameworkNodeTreeOut] = []

    for n in all_nodes:
        tree_node = FrameworkNodeTreeOut(
            id=n.id, framework_id=n.framework_id, parent_id=n.parent_id,
            urn=n.urn, ref_id=n.ref_id, name=n.name, name_pl=n.name_pl,
            description=n.description, description_pl=n.description_pl,
            depth=n.depth, order_id=n.order_id, assessable=n.assessable,
            point_type_id=n.point_type_id,
            implementation_groups=n.implementation_groups, weight=n.weight,
            importance=n.importance, maturity_level=n.maturity_level,
            annotation=n.annotation, typical_evidence=n.typical_evidence,
            children=[],
        )
        node_map[n.id] = tree_node

    for n in all_nodes:
        tree_node = node_map[n.id]
        if n.parent_id and n.parent_id in node_map:
            node_map[n.parent_id].children.append(tree_node)
        else:
            roots.append(tree_node)

    return roots


@router.get("/{fw_id}/nodes", response_model=list[FrameworkNodeBrief], summary="Filtrowane nodes")
async def list_nodes(
    fw_id: int,
    assessable: bool | None = Query(None),
    ig: str | None = Query(None, description="Implementation Group filter (e.g. IG1)"),
    depth: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = (
        select(FrameworkNode)
        .where(FrameworkNode.framework_id == fw_id, FrameworkNode.is_active.is_(True))
    )
    if assessable is not None:
        q = q.where(FrameworkNode.assessable == assessable)
    if depth is not None:
        q = q.where(FrameworkNode.depth == depth)
    if ig:
        q = q.where(func.find_in_set(ig, FrameworkNode.implementation_groups) > 0)
    q = q.order_by(FrameworkNode.order_id)
    rows = (await s.execute(q)).scalars().all()
    return [FrameworkNodeBrief.model_validate(n) for n in rows]


# ===================================================
# NODE CRUD
# ===================================================

@router.post("/{fw_id}/nodes", response_model=FrameworkNodeOut, summary="Dodaj wezel")
async def create_node(
    fw_id: int, body: FrameworkNodeCreate, s: AsyncSession = Depends(get_session),
):
    """Add a new node to a framework."""
    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Framework nie istnieje")

    # Determine depth based on parent
    depth = 1
    if body.parent_id:
        parent = await s.get(FrameworkNode, body.parent_id)
        if not parent or parent.framework_id != fw_id:
            raise HTTPException(400, "Nieprawidlowy parent_id")
        depth = parent.depth + 1

    # Get max order_id for this framework
    max_order = (await s.execute(
        select(func.max(FrameworkNode.order_id))
        .where(FrameworkNode.framework_id == fw_id)
    )).scalar() or 0

    node = FrameworkNode(
        framework_id=fw_id,
        parent_id=body.parent_id,
        ref_id=body.ref_id,
        name=body.name,
        name_pl=body.name_pl,
        description=body.description,
        description_pl=body.description_pl,
        depth=depth,
        order_id=max_order + 1,
        assessable=body.assessable,
        point_type_id=body.point_type_id,
        implementation_groups=body.implementation_groups,
        weight=body.weight,
        importance=body.importance,
        annotation=body.annotation,
        typical_evidence=body.typical_evidence,
    )
    s.add(node)
    await s.flush()

    # Update framework counts
    fw.total_nodes += 1
    if body.assessable:
        fw.total_assessable += 1
    fw.edit_version += 1
    fw.last_edited_by = "admin"
    fw.last_edited_at = datetime.utcnow()

    await s.commit()
    await s.refresh(node)
    return FrameworkNodeOut.model_validate(node)


@router.put("/{fw_id}/nodes/{node_id}", response_model=FrameworkNodeOut, summary="Edycja wezla")
async def update_node(
    fw_id: int, node_id: int, body: FrameworkNodeUpdate,
    s: AsyncSession = Depends(get_session),
):
    """Update an existing framework node."""
    node = await s.get(FrameworkNode, node_id)
    if not node or node.framework_id != fw_id:
        raise HTTPException(404, "Wezel nie istnieje w tym frameworku")

    fw = await s.get(Framework, fw_id)
    was_assessable = node.assessable

    if body.name is not None:
        node.name = body.name
    if body.ref_id is not None:
        node.ref_id = body.ref_id
    if body.name_pl is not None:
        node.name_pl = body.name_pl
    if body.description is not None:
        node.description = body.description
    if body.description_pl is not None:
        node.description_pl = body.description_pl
    if body.assessable is not None:
        node.assessable = body.assessable
    if body.point_type_id is not None:
        node.point_type_id = body.point_type_id
    if body.implementation_groups is not None:
        node.implementation_groups = body.implementation_groups
    if body.weight is not None:
        node.weight = body.weight
    if body.importance is not None:
        node.importance = body.importance
    if body.annotation is not None:
        node.annotation = body.annotation
    if body.typical_evidence is not None:
        node.typical_evidence = body.typical_evidence

    # Handle parent change (move node)
    if body.parent_id is not None:
        if body.parent_id == 0:
            # Move to root
            node.parent_id = None
            node.depth = 1
        else:
            parent = await s.get(FrameworkNode, body.parent_id)
            if not parent or parent.framework_id != fw_id:
                raise HTTPException(400, "Nieprawidlowy parent_id")
            if parent.id == node.id:
                raise HTTPException(400, "Wezel nie moze byc swoim wlasnym rodzicem")
            node.parent_id = body.parent_id
            node.depth = parent.depth + 1

    # Update assessable count if changed
    if body.assessable is not None and was_assessable != body.assessable:
        if body.assessable:
            fw.total_assessable += 1
        else:
            fw.total_assessable = max(0, fw.total_assessable - 1)

    fw.edit_version += 1
    fw.last_edited_by = "admin"
    fw.last_edited_at = datetime.utcnow()

    await s.commit()
    await s.refresh(node)
    return FrameworkNodeOut.model_validate(node)


@router.delete("/{fw_id}/nodes/{node_id}", summary="Usun wezel")
async def delete_node(
    fw_id: int, node_id: int, s: AsyncSession = Depends(get_session),
):
    """Delete a framework node (soft-delete by setting is_active=false).
    Children are re-parented to the deleted node's parent.
    """
    node = await s.get(FrameworkNode, node_id)
    if not node or node.framework_id != fw_id:
        raise HTTPException(404, "Wezel nie istnieje w tym frameworku")

    fw = await s.get(Framework, fw_id)

    # Re-parent children to this node's parent
    children = (await s.execute(
        select(FrameworkNode).where(
            FrameworkNode.parent_id == node_id,
            FrameworkNode.is_active.is_(True),
        )
    )).scalars().all()

    for child in children:
        child.parent_id = node.parent_id
        if node.parent_id is None:
            child.depth = 1
        else:
            parent = await s.get(FrameworkNode, node.parent_id)
            child.depth = (parent.depth + 1) if parent else 1

    # Soft-delete the node
    node.is_active = False

    # Update counts
    fw.total_nodes = max(0, fw.total_nodes - 1)
    if node.assessable:
        fw.total_assessable = max(0, fw.total_assessable - 1)
    fw.edit_version += 1
    fw.last_edited_by = "admin"
    fw.last_edited_at = datetime.utcnow()

    await s.commit()
    return {"status": "deleted", "node_id": node_id, "children_reparented": len(children)}


# ===================================================
# DIMENSIONS
# ===================================================

@router.get("/{fw_id}/dimensions", response_model=list[DimensionOut], summary="Wymiary + poziomy")
async def get_dimensions(fw_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(AssessmentDimension)
        .options(selectinload(AssessmentDimension.levels))
        .where(AssessmentDimension.framework_id == fw_id)
        .order_by(AssessmentDimension.order_id)
    )
    dims = (await s.execute(q)).scalars().unique().all()
    return [DimensionOut.model_validate(d) for d in dims]


# ===================================================
# AREA MAPPINGS (nodes <-> security areas)
# ===================================================

@router.get("/{fw_id}/area-mappings", response_model=list[AreaMappingOut], summary="Mapowania nodes->areas")
async def get_area_mappings(fw_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(
            FrameworkNodeSecurityArea,
            FrameworkNode.ref_id.label("node_ref_id"),
            FrameworkNode.name.label("node_name"),
            SecurityDomain.name.label("area_name"),
        )
        .join(FrameworkNode, FrameworkNodeSecurityArea.framework_node_id == FrameworkNode.id)
        .join(SecurityDomain, FrameworkNodeSecurityArea.security_area_id == SecurityDomain.id)
        .where(FrameworkNode.framework_id == fw_id)
        .order_by(FrameworkNode.order_id)
    )
    rows = (await s.execute(q)).all()
    return [
        AreaMappingOut(
            id=m.id,
            framework_node_id=m.framework_node_id,
            node_ref_id=node_ref,
            node_name=node_name,
            security_area_id=m.security_area_id,
            security_area_name=area_name,
            source=m.source,
            created_by=m.created_by,
        )
        for m, node_ref, node_name, area_name in rows
    ]


@router.post("/{fw_id}/area-mappings/bulk", summary="Bulk assign nodes->area")
async def bulk_create_area_mappings(
    fw_id: int, body: AreaMappingBulkCreate, s: AsyncSession = Depends(get_session),
):
    created = 0
    for node_id in body.framework_node_ids:
        # Verify node belongs to this framework
        node = await s.get(FrameworkNode, node_id)
        if not node or node.framework_id != fw_id:
            continue

        # Check if mapping already exists
        existing = (await s.execute(
            select(FrameworkNodeSecurityArea).where(
                FrameworkNodeSecurityArea.framework_node_id == node_id,
                FrameworkNodeSecurityArea.security_area_id == body.security_area_id,
            )
        )).scalar_one_or_none()
        if existing:
            continue

        s.add(FrameworkNodeSecurityArea(
            framework_node_id=node_id,
            security_area_id=body.security_area_id,
            source=body.source,
        ))
        created += 1

    await s.commit()
    return {"status": "ok", "created": created}


@router.delete("/nodes/{node_id}/areas/{area_id}", summary="Usun mapowanie node->area")
async def delete_area_mapping(node_id: int, area_id: int, s: AsyncSession = Depends(get_session)):
    q = select(FrameworkNodeSecurityArea).where(
        FrameworkNodeSecurityArea.framework_node_id == node_id,
        FrameworkNodeSecurityArea.security_area_id == area_id,
    )
    mapping = (await s.execute(q)).scalar_one_or_none()
    if not mapping:
        raise HTTPException(404, "Mapowanie nie istnieje")
    await s.delete(mapping)
    await s.commit()
    return {"status": "deleted"}


# ===================================================
# IMPORT
# ===================================================

@router.post("/import/excel", response_model=FrameworkImportResult, summary="Import z Excel CISO Assistant")
async def import_excel(
    file: UploadFile = File(...),
    s: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Plik musi miec rozszerzenie .xlsx")

    try:
        fw = await import_from_excel(s, file.file, imported_by="admin")
        await s.commit()
        await s.refresh(fw)

        dims_count = (await s.execute(
            select(func.count(AssessmentDimension.id))
            .where(AssessmentDimension.framework_id == fw.id)
        )).scalar() or 0

        return FrameworkImportResult(
            framework_id=fw.id,
            name=fw.name,
            total_nodes=fw.total_nodes,
            total_assessable=fw.total_assessable,
            dimensions_created=dims_count,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Blad importu: {e}")


@router.post("/import/yaml", response_model=FrameworkImportResult, summary="Import z YAML CISO Assistant")
async def import_yaml_endpoint(
    file: UploadFile = File(...),
    s: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.endswith((".yaml", ".yml")):
        raise HTTPException(400, "Plik musi miec rozszerzenie .yaml lub .yml")

    try:
        fw = await import_from_yaml(s, file.file, imported_by="admin")
        await s.commit()
        await s.refresh(fw)

        dims_count = (await s.execute(
            select(func.count(AssessmentDimension.id))
            .where(AssessmentDimension.framework_id == fw.id)
        )).scalar() or 0

        return FrameworkImportResult(
            framework_id=fw.id,
            name=fw.name,
            total_nodes=fw.total_nodes,
            total_assessable=fw.total_assessable,
            dimensions_created=dims_count,
        )
    except ValueError as e:
        await s.rollback()
        raise HTTPException(400, str(e))
    except Exception as e:
        await s.rollback()
        raise HTTPException(500, f"Blad importu: {e}")


@router.post("/import/github", response_model=FrameworkImportResult, summary="Import z GitHub CISO Assistant")
async def import_from_github(
    framework_path: str = Query(..., description="Sciezka pliku, np. 'cis-controls-v8.xlsx'"),
    s: AsyncSession = Depends(get_session),
):
    import httpx
    import io

    base_url = "https://raw.githubusercontent.com/intuitem/ciso-assistant-community/main/backend/library/libraries"
    url = f"{base_url}/{framework_path}"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(400, f"Nie udalo sie pobrac pliku: {e}")

    file_bytes = io.BytesIO(resp.content)

    try:
        if framework_path.endswith((".yaml", ".yml")):
            fw = await import_from_yaml(s, file_bytes, imported_by="github-import")
        elif framework_path.endswith((".xlsx", ".xls")):
            fw = await import_from_excel(s, file_bytes, imported_by="github-import")
        else:
            raise HTTPException(400, "Nieobslugiwany format pliku")

        await s.commit()
        await s.refresh(fw)

        dims_count = (await s.execute(
            select(func.count(AssessmentDimension.id))
            .where(AssessmentDimension.framework_id == fw.id)
        )).scalar() or 0

        return FrameworkImportResult(
            framework_id=fw.id,
            name=fw.name,
            total_nodes=fw.total_nodes,
            total_assessable=fw.total_assessable,
            dimensions_created=dims_count,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Blad importu GitHub: {e}")


# ===================================================
# AI-POWERED DOCUMENT IMPORT (PDF / DOCX)
# ===================================================

# ── AI Import progress tracking (in-memory) ──
import uuid as _uuid

_ai_import_progress: dict[str, dict] = {}


@router.post("/import/ai/debug", summary="Debug AI Import — test parsing without saving")
async def debug_ai_import(
    file: UploadFile = File(...),
    s: AsyncSession = Depends(get_session),
):
    """Debug endpoint: runs AI import but returns raw AI response + parse result without saving.

    Use to diagnose JSON parsing issues.
    """
    from app.services.ai_service import get_ai_service, AINotConfiguredException
    from app.services.document_extract import prepare_chunked_document

    if not file.filename:
        raise HTTPException(400, "Brak nazwy pliku")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("pdf", "docx", "doc"):
        raise HTTPException(400, "Obsługiwane formaty: .pdf, .docx")

    svc = await get_ai_service(s)
    if not svc.config:
        raise HTTPException(503, "AI nie jest skonfigurowane.")

    try:
        await file.seek(0)
        chunks, meta = prepare_chunked_document(file.filename, file.file)
    except ValueError as e:
        raise HTTPException(400, str(e))

    if not chunks:
        raise HTTPException(400, "Dokument jest pusty lub nie udało się wyekstrahować tekstu.")

    # Call LLM but catch everything and return raw response
    from app.services.ai_adapters import LLMResponse
    from app.services.ai_prompts import SYSTEM_PROMPT_DOCUMENT_IMPORT

    prompt = (
        f"Plik: {file.filename}\n\n"
        f"Tekst dokumentu:\n{chunks[0][:5000]}\n\n"  # Only first 5000 chars for debug
        f"Przeanalizuj ten dokument i wyodrebnij pelna strukture."
    )

    try:
        llm_resp: LLMResponse = await svc.adapter.chat_completion(
            system=SYSTEM_PROMPT_DOCUMENT_IMPORT,
            user_message=prompt,
            max_tokens=svc.config.max_tokens,
            temperature=float(svc.config.temperature),
            timeout=120,
        )
    except Exception as e:
        return {
            "status": "llm_call_failed",
            "error": str(e),
            "chunks_count": len(chunks),
            "first_chunk_length": len(chunks[0]),
            "meta": meta,
        }

    # Try to parse
    parse_error = None
    parsed = None
    try:
        parsed = svc._parse_json(llm_resp.text)
    except Exception as e:
        parse_error = str(e)

    return {
        "status": "ok" if parsed else "parse_failed",
        "raw_response_length": len(llm_resp.text),
        "raw_response_first_500": llm_resp.text[:500],
        "raw_response_last_200": llm_resp.text[-200:] if len(llm_resp.text) > 200 else llm_resp.text,
        "tokens_input": llm_resp.tokens_input,
        "tokens_output": llm_resp.tokens_output,
        "cost_usd": float(llm_resp.cost_usd),
        "model": llm_resp.model,
        "parsed_ok": parsed is not None,
        "parse_error": parse_error,
        "parsed_keys": list(parsed.keys()) if isinstance(parsed, dict) else None,
        "nodes_count": len(parsed.get("nodes", [])) if isinstance(parsed, dict) else None,
        "chunks_count": len(chunks),
        "first_chunk_length": len(chunks[0]),
        "meta": meta,
    }


@router.get("/import/ai/progress/{task_id}")
async def ai_import_progress(task_id: str):
    """Poll progress of an AI import task."""
    p = _ai_import_progress.get(task_id)
    if not p:
        raise HTTPException(404, "Brak zadania o podanym ID")
    return p


@router.post("/import/ai", response_model=FrameworkImportResult, summary="AI Import z PDF/DOCX")
async def import_from_ai(
    file: UploadFile = File(...),
    s: AsyncSession = Depends(get_session),
):
    """Import a framework from PDF/DOCX using AI to extract structure.

    AI analyzes the document text and builds a hierarchical framework:
    - Detects metadata (name, version, provider)
    - Extracts chapters, sections, requirements as tree nodes
    - Marks assessable nodes (concrete requirements/controls)

    Returns X-Import-Task-Id header for progress polling.
    """
    from app.services.ai_service import get_ai_service, AINotConfiguredException, AIParsingError
    from app.services.document_extract import prepare_chunked_document
    from app.services.framework_import import _create_default_dimensions

    if not file.filename:
        raise HTTPException(400, "Brak nazwy pliku")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("pdf", "docx", "doc"):
        raise HTTPException(400, "Obsługiwane formaty: .pdf, .docx")

    svc = await get_ai_service(s)
    if not svc.config:
        raise HTTPException(503, "AI nie jest skonfigurowane. Włącz AI w panelu administracyjnym.")

    try:
        # Reset file position — FastAPI may have already read the stream
        await file.seek(0)
        # Extract text in chunks
        chunks, meta = prepare_chunked_document(file.filename, file.file)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # ── Progress tracking ──
    task_id = str(_uuid.uuid4())[:8]
    total_steps = len(chunks) + 1  # chunks + save step
    progress = {
        "task_id": task_id,
        "status": "running",
        "step": 0,
        "total_steps": total_steps,
        "message": "Ekstrakcja tekstu z dokumentu...",
        "nodes_found": 0,
        "percent": 0,
    }
    _ai_import_progress[task_id] = progress

    def _update_progress(step: int, message: str, nodes: int = 0):
        progress["step"] = step
        progress["message"] = message
        progress["nodes_found"] = nodes
        progress["percent"] = int(step / total_steps * 100)

    if not chunks:
        raise HTTPException(400, "Dokument jest pusty lub nie udało się wyekstrahować tekstu.")

    try:
        # Pass 1: analyze first chunk — get framework metadata + initial nodes
        _update_progress(0, f"AI analizuje fragment 1/{len(chunks)}...")
        first_result = await svc.analyze_document_structure(
            user_id=1,  # system import
            document_text=chunks[0],
            filename=file.filename,
        )

        fw_meta = first_result.get("framework", {})
        all_nodes = first_result.get("nodes", [])
        _update_progress(1, f"Fragment 1/{len(chunks)} — znaleziono {len(all_nodes)} węzłów", len(all_nodes))

        # Pass 2+: analyze remaining chunks for more nodes
        for i, chunk in enumerate(chunks[1:], start=2):
            _update_progress(i - 1, f"AI analizuje fragment {i}/{len(chunks)}...", len(all_nodes))

            # Build summary of last few nodes for context
            last_nodes = all_nodes[-5:] if all_nodes else []
            summary = "\n".join(
                f"- {n.get('ref_id', '?')}: {n.get('name', '?')} (depth={n.get('depth', 1)})"
                for n in last_nodes
            )

            continuation = await svc.analyze_document_continuation(
                user_id=1,
                document_text=chunk,
                previous_nodes_summary=summary,
            )
            extra_nodes = continuation.get("nodes", [])
            all_nodes.extend(extra_nodes)
            _update_progress(i, f"Fragment {i}/{len(chunks)} — łącznie {len(all_nodes)} węzłów", len(all_nodes))

        # Save to database
        _update_progress(len(chunks), f"Zapisywanie {len(all_nodes)} węzłów do bazy...", len(all_nodes))

        # Create framework
        fw_name = fw_meta.get("name") or file.filename.rsplit(".", 1)[0]
        fw = Framework(
            name=fw_name,
            ref_id=fw_meta.get("ref_id"),
            description=fw_meta.get("description"),
            version=fw_meta.get("version"),
            provider=fw_meta.get("provider"),
            locale=fw_meta.get("locale", "pl"),
            source_format="custom_import",
            lifecycle_status="draft",
            imported_at=datetime.utcnow(),
            imported_by="ai-import",
        )
        s.add(fw)
        await s.flush()

        # Create default assessment dimensions
        await _create_default_dimensions(s, fw)

        # Build nodes — two-pass approach like existing importers
        ref_to_id: dict[str, int] = {}
        inserted: list[tuple[int, dict]] = []
        total_nodes = 0
        total_assessable = 0

        for idx, nd in enumerate(all_nodes):
            ref_id = str(nd.get("ref_id", "")).strip() or None
            name = (nd.get("name") or ref_id or f"Węzeł {idx + 1}")[:500]
            description = nd.get("description")
            depth = nd.get("depth", 1)
            assessable = bool(nd.get("assessable", False))

            node = FrameworkNode(
                framework_id=fw.id,
                parent_id=None,  # resolved in pass 2
                ref_id=ref_id,
                name=name,
                description=description,
                depth=depth,
                order_id=idx + 1,
                assessable=assessable,
                is_active=True,
            )
            s.add(node)
            await s.flush()

            if ref_id:
                ref_to_id[ref_id] = node.id
            inserted.append((node.id, nd))
            total_nodes += 1
            if assessable:
                total_assessable += 1

        # Pass 2: resolve parent_id
        depth_stack: dict[int, int] = {}
        for node_id, nd in inserted:
            parent_ref = nd.get("parent_ref")
            depth = nd.get("depth", 1)
            parent_id = None

            if parent_ref and parent_ref in ref_to_id:
                parent_id = ref_to_id[parent_ref]
            elif depth > 1:
                # Fallback: most recent node at depth-1
                parent_id = depth_stack.get(depth - 1)

            if parent_id:
                await s.execute(
                    update(FrameworkNode)
                    .where(FrameworkNode.id == node_id)
                    .values(parent_id=parent_id)
                )

            depth_stack[depth] = node_id

        # Update framework counts
        fw.total_nodes = total_nodes
        fw.total_assessable = total_assessable
        fw.edit_version = 1

        # Version history
        s.add(FrameworkVersionHistory(
            framework_id=fw.id,
            edit_version=1,
            lifecycle_status="draft",
            change_summary=f"AI import z {file.filename} ({meta.get('format', '?')}, "
                           f"{meta.get('chunks', 1)} fragmentów, {total_nodes} węzłów)",
            changed_by="ai-import",
            snapshot_nodes_count=total_nodes,
            snapshot_assessable_count=total_assessable,
        ))

        await s.commit()
        await s.refresh(fw)

        dims_count = (await s.execute(
            select(func.count(AssessmentDimension.id))
            .where(AssessmentDimension.framework_id == fw.id)
        )).scalar() or 0

        # Mark progress complete
        progress["status"] = "done"
        progress["percent"] = 100
        progress["message"] = f"Import zakończony — {total_nodes} węzłów"

        from starlette.responses import JSONResponse
        result = FrameworkImportResult(
            framework_id=fw.id,
            name=fw.name,
            total_nodes=fw.total_nodes,
            total_assessable=fw.total_assessable,
            dimensions_created=dims_count,
        )
        resp = JSONResponse(content=result.model_dump())
        resp.headers["X-Import-Task-Id"] = task_id
        return resp

    except AINotConfiguredException:
        progress["status"] = "error"
        progress["message"] = "AI nie jest skonfigurowane"
        raise HTTPException(503, "AI nie jest skonfigurowane")
    except AIParsingError as e:
        try:
            await s.rollback()
        except Exception:
            pass
        logger.exception("AI import: JSON parsing failed")
        progress["status"] = "error"
        progress["message"] = f"AI nie zwróciło poprawnego JSON: {e}"
        raise HTTPException(
            502,
            f"AI nie zwróciło poprawnego JSON. "
            f"Spróbuj z mniejszym dokumentem lub innym modelem. Szczegóły: {e}",
        )
    except Exception as e:
        # Check if this is actually an AIParsingError wrapped in another exception
        err_msg = str(e)
        is_parsing = "nieprawidlowy JSON" in err_msg or "nie zwrocilo JSON" in err_msg
        try:
            await s.rollback()
        except Exception:
            pass
        logger.exception("AI import error")
        progress["status"] = "error"
        progress["message"] = f"Błąd: {e}"
        if is_parsing:
            raise HTTPException(
                502,
                f"AI nie zwróciło poprawnego JSON. "
                f"Spróbuj z mniejszym dokumentem lub innym modelem. Szczegóły: {e}",
            )
        raise HTTPException(500, f"Błąd importu AI: {e}")
    finally:
        # Clean up old progress entries (keep last 20)
        if len(_ai_import_progress) > 20:
            keys = list(_ai_import_progress.keys())
            for k in keys[:-20]:
                _ai_import_progress.pop(k, None)


# ===================================================
# AUTO-MAP AREAS (seed mapping CIS -> security areas)
# ===================================================

# Pre-built CIS v8 -> security area mapping (control ref_id -> area codes)
_CIS_AREA_MAP: dict[str, list[str]] = {
    "1":  ["WORKSTATIONS", "SERVER_INFRA", "MOBILE_DEVICES", "NETWORK_INFRA"],
    "2":  ["WORKSTATIONS", "SERVER_INFRA"],
    "3":  ["DATA_PROTECTION"],
    "4":  ["WORKSTATIONS", "SERVER_INFRA", "NETWORK_INFRA", "PUBLIC_CLOUD"],
    "5":  ["ACCESS_CONTROL"],
    "6":  ["ACCESS_CONTROL"],
    "7":  ["WORKSTATIONS", "SERVER_INFRA"],
    "8":  ["SERVER_INFRA"],
    "9":  ["WORKSTATIONS", "M365_CLOUD"],
    "10": ["WORKSTATIONS", "SERVER_INFRA"],
    "11": ["SERVER_INFRA"],
    "12": ["NETWORK_INFRA"],
    "13": ["NETWORK_INFRA"],
    "14": [],
    "15": ["PUBLIC_CLOUD", "M365_CLOUD"],
    "16": ["WORKSTATIONS"],
    "17": ["SERVER_INFRA"],
    "18": ["WORKSTATIONS", "SERVER_INFRA"],
}


@router.post("/{fw_id}/auto-map-areas", response_model=AutoMapResult, summary="Auto-mapowanie nodes->areas (seed)")
async def auto_map_areas(fw_id: int, s: AsyncSession = Depends(get_session)):
    """Auto-map framework nodes to security areas using pre-built seed mappings."""
    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Framework nie istnieje")

    areas = (await s.execute(
        select(SecurityDomain).where(SecurityDomain.is_active.is_(True))
    )).scalars().all()
    code_to_id = {a.code: a.id for a in areas if a.code}

    top_nodes = (await s.execute(
        select(FrameworkNode).where(
            FrameworkNode.framework_id == fw_id,
            FrameworkNode.depth == 1,
            FrameworkNode.is_active.is_(True),
        )
    )).scalars().all()
    ref_to_node_id = {n.ref_id: n.id for n in top_nodes if n.ref_id}

    all_children = (await s.execute(
        select(FrameworkNode).where(
            FrameworkNode.framework_id == fw_id,
            FrameworkNode.depth > 1,
            FrameworkNode.is_active.is_(True),
        )
    )).scalars().all()
    children_by_parent: dict[int, list[int]] = {}
    for child in all_children:
        if child.parent_id:
            children_by_parent.setdefault(child.parent_id, []).append(child.id)

    created = 0
    for control_ref, area_codes in _CIS_AREA_MAP.items():
        parent_id = ref_to_node_id.get(control_ref)
        if not parent_id:
            continue
        node_ids = [parent_id] + children_by_parent.get(parent_id, [])
        for area_code in area_codes:
            area_id = code_to_id.get(area_code)
            if not area_id:
                continue
            for node_id in node_ids:
                existing = (await s.execute(
                    select(FrameworkNodeSecurityArea).where(
                        FrameworkNodeSecurityArea.framework_node_id == node_id,
                        FrameworkNodeSecurityArea.security_area_id == area_id,
                    )
                )).scalar_one_or_none()
                if existing:
                    continue
                s.add(FrameworkNodeSecurityArea(
                    framework_node_id=node_id, security_area_id=area_id,
                    source="seed", created_by="auto-map",
                ))
                created += 1

    await s.commit()
    return AutoMapResult(framework_id=fw_id, mappings_created=created)


# ===================================================
# DIMENSIONS -- edit scale
# ===================================================

@router.put("/{fw_id}/dimensions", response_model=list[DimensionOut], summary="Edycja skali ocen")
async def update_dimensions(
    fw_id: int, body: DimensionsUpdate, s: AsyncSession = Depends(get_session),
):
    """Replace dimensions and levels. Only allowed when no active assessments exist."""
    from sqlalchemy import delete as sa_delete
    from app.models.framework import Assessment

    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Framework nie istnieje")

    existing_assessments = (await s.execute(
        select(func.count(Assessment.id)).where(
            Assessment.framework_id == fw_id, Assessment.is_active.is_(True),
        )
    )).scalar() or 0
    if existing_assessments > 0:
        raise HTTPException(
            409,
            f"Framework ma {existing_assessments} aktywnych ocen. "
            "Zmiana skali wymaga archiwizacji istniejacych ocen."
        )

    old_dims = (await s.execute(
        select(AssessmentDimension).where(AssessmentDimension.framework_id == fw_id)
    )).scalars().all()
    for dim in old_dims:
        await s.execute(sa_delete(DimensionLevel).where(DimensionLevel.dimension_id == dim.id))
    await s.execute(sa_delete(AssessmentDimension).where(AssessmentDimension.framework_id == fw_id))
    await s.flush()

    for dim_data in body.dimensions:
        dim = AssessmentDimension(
            framework_id=fw_id, dimension_key=dim_data.dimension_key,
            name=dim_data.name, name_pl=dim_data.name_pl,
            description=dim_data.description, order_id=dim_data.order_id,
            weight=dim_data.weight,
        )
        s.add(dim)
        await s.flush()
        for lv in dim_data.levels:
            s.add(DimensionLevel(
                dimension_id=dim.id, level_order=lv.level_order,
                value=lv.value, label=lv.label, label_pl=lv.label_pl,
                description=lv.description, color=lv.color,
            ))

    await s.commit()

    q_reload = (
        select(AssessmentDimension)
        .options(selectinload(AssessmentDimension.levels))
        .where(AssessmentDimension.framework_id == fw_id)
        .order_by(AssessmentDimension.order_id)
    )
    updated_dims = (await s.execute(q_reload)).scalars().unique().all()
    return [DimensionOut.model_validate(d) for d in updated_dims]


# ===================================================
# DOCUMENT COPY (with all relations)
# ===================================================

@router.post("/{fw_id}/copy", response_model=FrameworkOut, summary="Kopiuj dokument referencyjny")
async def copy_framework(
    fw_id: int, body: FrameworkCopyRequest, s: AsyncSession = Depends(get_session),
):
    """Copy a reference document with its complete structure and optionally org unit links."""
    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Dokument nie istnieje")

    new_fw = Framework(
        name=body.name or f"Kopia: {fw.name}",
        ref_id=fw.ref_id, description=fw.description,
        version=fw.version, provider=fw.provider, packager=fw.packager,
        copyright=fw.copyright, source_format=fw.source_format,
        source_url=fw.source_url, locale=fw.locale,
        implementation_groups_definition=fw.implementation_groups_definition,
        document_type_id=fw.document_type_id, document_origin=fw.document_origin,
        owner=fw.owner, requires_review=fw.requires_review,
        review_frequency_months=fw.review_frequency_months,
        lifecycle_status="draft", edit_version=1,
        major_version=fw.major_version, minor_version=fw.minor_version + 1,
        updates_document_id=fw.id,
        imported_at=datetime.utcnow(), imported_by="copy",
    )
    s.add(new_fw)
    await s.flush()

    # Copy nodes
    src_nodes = (await s.execute(
        select(FrameworkNode)
        .where(FrameworkNode.framework_id == fw_id, FrameworkNode.is_active.is_(True))
        .order_by(FrameworkNode.order_id)
    )).scalars().all()

    id_map: dict[int, int] = {}
    for n in src_nodes:
        nn = FrameworkNode(
            framework_id=new_fw.id, parent_id=None,
            urn=n.urn, ref_id=n.ref_id, name=n.name, name_pl=n.name_pl,
            description=n.description, description_pl=n.description_pl,
            depth=n.depth, order_id=n.order_id, assessable=n.assessable,
            point_type_id=n.point_type_id,
            implementation_groups=n.implementation_groups, weight=n.weight,
            importance=n.importance, maturity_level=n.maturity_level,
            annotation=n.annotation, threats=n.threats,
            reference_controls=n.reference_controls, typical_evidence=n.typical_evidence,
        )
        s.add(nn)
        await s.flush()
        id_map[n.id] = nn.id

    for n in src_nodes:
        if n.parent_id and n.parent_id in id_map:
            await s.execute(
                update(FrameworkNode).where(FrameworkNode.id == id_map[n.id])
                .values(parent_id=id_map[n.parent_id])
            )

    # Copy dimensions
    src_dims = (await s.execute(
        select(AssessmentDimension).options(selectinload(AssessmentDimension.levels))
        .where(AssessmentDimension.framework_id == fw_id)
    )).scalars().unique().all()
    for dm in src_dims:
        nd = AssessmentDimension(
            framework_id=new_fw.id, dimension_key=dm.dimension_key,
            name=dm.name, name_pl=dm.name_pl, description=dm.description,
            order_id=dm.order_id, weight=dm.weight,
        )
        s.add(nd)
        await s.flush()
        for lv in dm.levels:
            s.add(DimensionLevel(
                dimension_id=nd.id, level_order=lv.level_order,
                value=lv.value, label=lv.label, label_pl=lv.label_pl,
                description=lv.description, color=lv.color,
            ))

    # Copy area mappings
    src_maps = (await s.execute(
        select(FrameworkNodeSecurityArea).where(
            FrameworkNodeSecurityArea.framework_node_id.in_([n.id for n in src_nodes])
        )
    )).scalars().all()
    for m in src_maps:
        if m.framework_node_id in id_map:
            s.add(FrameworkNodeSecurityArea(
                framework_node_id=id_map[m.framework_node_id],
                security_area_id=m.security_area_id,
                source=m.source, created_by="copy",
            ))

    if body.copy_org_unit_links:
        src_links = (await s.execute(
            select(FrameworkOrgUnit).where(FrameworkOrgUnit.framework_id == fw_id)
        )).scalars().all()
        for lnk in src_links:
            s.add(FrameworkOrgUnit(
                framework_id=new_fw.id, org_unit_id=lnk.org_unit_id,
                compliance_status=lnk.compliance_status, notes=lnk.notes,
            ))

    new_fw.total_nodes = len(src_nodes)
    new_fw.total_assessable = sum(1 for n in src_nodes if n.assessable)
    s.add(FrameworkVersionHistory(
        framework_id=new_fw.id, edit_version=1, lifecycle_status="draft",
        change_summary=f"Kopia dokumentu: {fw.name}", changed_by="admin",
        snapshot_nodes_count=new_fw.total_nodes,
        snapshot_assessable_count=new_fw.total_assessable,
    ))
    await s.commit()

    new_fw = await _reload_framework(s, new_fw.id)
    extra = await _enrich_framework_out(new_fw, s)
    out = FrameworkOut.model_validate(new_fw)
    for k, v in extra.items():
        if hasattr(out, k):
            setattr(out, k, v)
    return out


# ===================================================
# ORG UNIT LINKING
# ===================================================

@router.get("/{fw_id}/org-units", response_model=list[FrameworkOrgUnitOut], summary="Powiązane jednostki")
async def get_framework_org_units(fw_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(FrameworkOrgUnit, OrgUnit.name.label("ou_name"))
        .outerjoin(OrgUnit, FrameworkOrgUnit.org_unit_id == OrgUnit.id)
        .where(FrameworkOrgUnit.framework_id == fw_id)
        .order_by(OrgUnit.name)
    )
    rows = (await s.execute(q)).all()
    return [
        FrameworkOrgUnitOut(
            id=link.id, framework_id=link.framework_id,
            org_unit_id=link.org_unit_id, org_unit_name=ou_name,
            compliance_status=link.compliance_status,
            last_assessed_at=link.last_assessed_at,
            notes=link.notes, created_at=link.created_at,
        )
        for link, ou_name in rows
    ]


@router.post("/{fw_id}/org-units", summary="Powiąż dokument z jednostkami")
async def link_org_units(
    fw_id: int, body: FrameworkOrgUnitCreate, s: AsyncSession = Depends(get_session),
):
    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Dokument nie istnieje")
    created = 0
    for ou_id in body.org_unit_ids:
        existing = (await s.execute(
            select(FrameworkOrgUnit).where(
                FrameworkOrgUnit.framework_id == fw_id,
                FrameworkOrgUnit.org_unit_id == ou_id,
            )
        )).scalar_one_or_none()
        if existing:
            continue
        s.add(FrameworkOrgUnit(framework_id=fw_id, org_unit_id=ou_id, notes=body.notes))
        created += 1
    await s.commit()
    return {"status": "ok", "created": created}


@router.put("/{fw_id}/org-units/{link_id}", response_model=FrameworkOrgUnitOut)
async def update_org_unit_link(
    fw_id: int, link_id: int, body: FrameworkOrgUnitUpdate, s: AsyncSession = Depends(get_session),
):
    link = await s.get(FrameworkOrgUnit, link_id)
    if not link or link.framework_id != fw_id:
        raise HTTPException(404, "Powiązanie nie istnieje")
    if body.compliance_status is not None:
        link.compliance_status = body.compliance_status
        link.last_assessed_at = datetime.utcnow()
    if body.notes is not None:
        link.notes = body.notes
    await s.commit()
    await s.refresh(link)
    ou = await s.get(OrgUnit, link.org_unit_id)
    return FrameworkOrgUnitOut(
        id=link.id, framework_id=link.framework_id,
        org_unit_id=link.org_unit_id, org_unit_name=ou.name if ou else None,
        compliance_status=link.compliance_status,
        last_assessed_at=link.last_assessed_at,
        notes=link.notes, created_at=link.created_at,
    )


@router.delete("/{fw_id}/org-units/{link_id}", summary="Usuń powiązanie")
async def delete_org_unit_link(fw_id: int, link_id: int, s: AsyncSession = Depends(get_session)):
    link = await s.get(FrameworkOrgUnit, link_id)
    if not link or link.framework_id != fw_id:
        raise HTTPException(404, "Powiązanie nie istnieje")
    await s.delete(link)
    await s.commit()
    return {"status": "deleted"}


# ===================================================
# REVIEW MANAGEMENT
# ===================================================

@router.get("/{fw_id}/reviews", response_model=list[FrameworkReviewOut], summary="Historia przeglądów")
async def get_framework_reviews(fw_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(FrameworkReview).where(FrameworkReview.framework_id == fw_id)
        .order_by(FrameworkReview.review_date.desc())
    )
    rows = (await s.execute(q)).scalars().all()
    return [FrameworkReviewOut.model_validate(r) for r in rows]


@router.post("/{fw_id}/reviews", response_model=FrameworkReviewOut, summary="Dodaj przegląd")
async def create_review(
    fw_id: int, body: FrameworkReviewCreate, s: AsyncSession = Depends(get_session),
):
    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Dokument nie istnieje")
    review = FrameworkReview(
        framework_id=fw_id, reviewer=body.reviewer, review_type=body.review_type,
        findings=body.findings, recommendations=body.recommendations,
        status=body.status, next_review_date=body.next_review_date,
    )
    s.add(review)
    fw.last_reviewed_at = datetime.utcnow()
    fw.reviewed_by = body.reviewer
    if body.next_review_date:
        fw.next_review_date = body.next_review_date
    elif fw.requires_review:
        fw.next_review_date = date.today() + timedelta(days=fw.review_frequency_months * 30)
    await s.commit()
    await s.refresh(review)
    return FrameworkReviewOut.model_validate(review)


# ===================================================
# NODE REORDER (drag-and-drop support)
# ===================================================

@router.put("/{fw_id}/nodes/{node_id}/move", summary="Przenieś / zmień kolejność węzła")
async def move_node(
    fw_id: int, node_id: int,
    new_parent_id: int | None = Query(None),
    new_order_id: int | None = Query(None),
    after_node_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    """Move a node to a new parent or change its order (drag-and-drop)."""
    node = await s.get(FrameworkNode, node_id)
    if not node or node.framework_id != fw_id:
        raise HTTPException(404, "Węzeł nie istnieje w tym dokumencie")
    fw = await s.get(Framework, fw_id)

    if new_parent_id is not None:
        if new_parent_id == 0:
            node.parent_id = None
            node.depth = 1
        else:
            parent = await s.get(FrameworkNode, new_parent_id)
            if not parent or parent.framework_id != fw_id:
                raise HTTPException(400, "Nieprawidłowy parent_id")
            if parent.id == node.id:
                raise HTTPException(400, "Węzeł nie może być swoim rodzicem")
            node.parent_id = new_parent_id
            node.depth = parent.depth + 1

        async def _fix_depth(pid: int, pdepth: int):
            ch = (await s.execute(
                select(FrameworkNode).where(
                    FrameworkNode.parent_id == pid, FrameworkNode.is_active.is_(True))
            )).scalars().all()
            for c in ch:
                c.depth = pdepth + 1
                await _fix_depth(c.id, c.depth)
        await _fix_depth(node.id, node.depth)

    if new_order_id is not None:
        node.order_id = new_order_id
    elif after_node_id is not None:
        aft = await s.get(FrameworkNode, after_node_id)
        if aft and aft.framework_id == fw_id:
            node.order_id = aft.order_id + 1
            await s.execute(
                update(FrameworkNode).where(
                    FrameworkNode.framework_id == fw_id,
                    FrameworkNode.parent_id == node.parent_id,
                    FrameworkNode.order_id >= node.order_id,
                    FrameworkNode.id != node.id,
                ).values(order_id=FrameworkNode.order_id + 1)
            )

    fw.edit_version += 1
    fw.last_edited_by = "admin"
    fw.last_edited_at = datetime.utcnow()
    await s.commit()
    return {"status": "moved", "node_id": node_id}


# ===================================================
# IMPORT ADOPTION FORM
# ===================================================

@router.put("/{fw_id}/adopt", response_model=FrameworkOut, summary="Formularz adopcji")
async def adopt_framework(
    fw_id: int, body: FrameworkImportAdoptionRequest, s: AsyncSession = Depends(get_session),
):
    """Apply adoption attributes to an imported document (after import, before approval)."""
    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Dokument nie istnieje")
    if body.name is not None:
        fw.name = body.name
    if body.ref_id is not None:
        fw.ref_id = body.ref_id
    if body.description is not None:
        fw.description = body.description
    if body.document_type_id is not None:
        fw.document_type_id = body.document_type_id
    if body.document_origin is not None:
        fw.document_origin = body.document_origin
    if body.owner is not None:
        fw.owner = body.owner
    fw.requires_review = body.requires_review
    fw.review_frequency_months = body.review_frequency_months
    if body.updates_document_id is not None:
        fw.updates_document_id = body.updates_document_id
    fw.last_edited_by = "admin"
    fw.last_edited_at = datetime.utcnow()
    await s.commit()

    fw = await _reload_framework(s, fw_id)
    extra = await _enrich_framework_out(fw, s)
    out = FrameworkOut.model_validate(fw)
    for k, v in extra.items():
        if hasattr(out, k):
            setattr(out, k, v)
    return out
