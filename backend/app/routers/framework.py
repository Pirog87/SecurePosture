"""
Framework Engine — /api/v1/frameworks

CRUD for frameworks, nodes, area mappings, dimensions.
Import from Excel/YAML/GitHub.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.framework import (
    AssessmentDimension, DimensionLevel, Framework, FrameworkNode,
    FrameworkNodeSecurityArea,
)
from app.models.security_area import SecurityDomain
from app.schemas.framework import (
    AreaMappingBulkCreate, AreaMappingOut, DimensionOut,
    FrameworkBrief, FrameworkImportResult, FrameworkNodeBrief,
    FrameworkNodeOut, FrameworkNodeTreeOut, FrameworkOut,
)
from app.services.framework_import import import_from_excel, import_from_yaml

router = APIRouter(prefix="/api/v1/frameworks", tags=["Frameworks"])


# ═══════════════════════════════════════════════
# FRAMEWORKS — CRUD
# ═══════════════════════════════════════════════

@router.get("", response_model=list[FrameworkBrief], summary="Lista frameworków")
async def list_frameworks(
    is_active: bool | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = select(Framework).order_by(Framework.name)
    if is_active is not None:
        q = q.where(Framework.is_active == is_active)
    rows = (await s.execute(q)).scalars().all()
    return [FrameworkBrief.model_validate(fw) for fw in rows]


@router.get("/{fw_id}", response_model=FrameworkOut, summary="Szczegóły frameworka")
async def get_framework(fw_id: int, s: AsyncSession = Depends(get_session)):
    fw = await s.get(
        Framework, fw_id,
        options=[selectinload(Framework.dimensions).selectinload(AssessmentDimension.levels)],
    )
    if not fw:
        raise HTTPException(404, "Framework nie istnieje")
    return FrameworkOut.model_validate(fw)


@router.delete("/{fw_id}", summary="Soft-delete framework")
async def delete_framework(fw_id: int, s: AsyncSession = Depends(get_session)):
    fw = await s.get(Framework, fw_id)
    if not fw:
        raise HTTPException(404, "Framework nie istnieje")
    fw.is_active = False
    await s.commit()
    return {"status": "archived", "id": fw_id}


# ═══════════════════════════════════════════════
# FRAMEWORK NODES — tree & list
# ═══════════════════════════════════════════════

@router.get("/{fw_id}/tree", response_model=list[FrameworkNodeTreeOut], summary="Drzewo nodes")
async def get_framework_tree(fw_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(FrameworkNode)
        .where(FrameworkNode.framework_id == fw_id, FrameworkNode.is_active.is_(True))
        .order_by(FrameworkNode.depth, FrameworkNode.order_id)
    )
    all_nodes = list((await s.execute(q)).scalars().all())

    # Build tree — construct manually to avoid lazy-load of ORM `children` relationship
    node_map: dict[int, FrameworkNodeTreeOut] = {}
    roots: list[FrameworkNodeTreeOut] = []

    for n in all_nodes:
        tree_node = FrameworkNodeTreeOut(
            id=n.id, framework_id=n.framework_id, parent_id=n.parent_id,
            urn=n.urn, ref_id=n.ref_id, name=n.name, name_pl=n.name_pl,
            description=n.description, description_pl=n.description_pl,
            depth=n.depth, order_id=n.order_id, assessable=n.assessable,
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


# ═══════════════════════════════════════════════
# DIMENSIONS
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# AREA MAPPINGS (nodes ↔ security areas)
# ═══════════════════════════════════════════════

@router.get("/{fw_id}/area-mappings", response_model=list[AreaMappingOut], summary="Mapowania nodes→areas")
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


@router.post("/{fw_id}/area-mappings/bulk", summary="Bulk assign nodes→area")
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


@router.delete("/nodes/{node_id}/areas/{area_id}", summary="Usuń mapowanie node→area")
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


# ═══════════════════════════════════════════════
# IMPORT
# ═══════════════════════════════════════════════

@router.post("/import/excel", response_model=FrameworkImportResult, summary="Import z Excel CISO Assistant")
async def import_excel(
    file: UploadFile = File(...),
    s: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Plik musi mieć rozszerzenie .xlsx")

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
        raise HTTPException(500, f"Błąd importu: {e}")


@router.post("/import/yaml", response_model=FrameworkImportResult, summary="Import z YAML CISO Assistant")
async def import_yaml_endpoint(
    file: UploadFile = File(...),
    s: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.endswith((".yaml", ".yml")):
        raise HTTPException(400, "Plik musi mieć rozszerzenie .yaml lub .yml")

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
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Błąd importu: {e}")


@router.post("/import/github", response_model=FrameworkImportResult, summary="Import z GitHub CISO Assistant")
async def import_from_github(
    framework_path: str = Query(..., description="Ścieżka pliku, np. 'cis-controls-v8.xlsx'"),
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
        raise HTTPException(400, f"Nie udało się pobrać pliku: {e}")

    file_bytes = io.BytesIO(resp.content)

    try:
        if framework_path.endswith((".yaml", ".yml")):
            fw = await import_from_yaml(s, file_bytes, imported_by="github-import")
        elif framework_path.endswith((".xlsx", ".xls")):
            fw = await import_from_excel(s, file_bytes, imported_by="github-import")
        else:
            raise HTTPException(400, "Nieobsługiwany format pliku")

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
        raise HTTPException(500, f"Błąd importu: {e}")
