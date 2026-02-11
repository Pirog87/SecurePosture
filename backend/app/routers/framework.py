"""
Framework Engine — /api/v1/frameworks + /api/v1/assessments

Universal multi-framework assessment system:
- Frameworks CRUD + import (Excel, YAML, GitHub)
- Framework nodes (tree view, flat filtered)
- Area mappings (M2M node ↔ security_area)
- Dimensions & levels per framework
- Assessments CRUD + answers + scoring
"""
from datetime import date, datetime
from decimal import Decimal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.framework import (
    Assessment,
    AssessmentAnswer,
    AssessmentDimension,
    DimensionLevel,
    Framework,
    FrameworkNode,
    FrameworkNodeSecurityArea,
)
from app.models.org_unit import OrgUnit
from app.models.security_area import SecurityArea
from app.schemas.framework import (
    AnswersBatchUpsert,
    AreaMappingOut,
    AssessmentAnswerOut,
    AssessmentApproveRequest,
    AssessmentCreate,
    AssessmentDimensionOut,
    AssessmentOut,
    AssessmentScoreOut,
    BulkAreaMappingRequest,
    FrameworkCreate,
    FrameworkDetailOut,
    FrameworkNodeOut,
    FrameworkNodeTreeOut,
    FrameworkOut,
    ImportFromGithubRequest,
    ImportResult,
    NodeScore,
)
from app.services.framework_import import import_from_excel, import_from_yaml
from app.services.framework_scoring import (
    get_assessment_score_breakdown,
    recalculate_assessment,
)

router = APIRouter(tags=["Framework Engine"])


# ── helpers ──

def _d(v: Decimal | None) -> float | None:
    return float(v) if v is not None else None


def _build_tree(nodes: list[FrameworkNodeOut]) -> list[FrameworkNodeTreeOut]:
    """Build hierarchical tree from flat node list."""
    node_map: dict[int, FrameworkNodeTreeOut] = {}
    roots: list[FrameworkNodeTreeOut] = []

    for n in nodes:
        tree_node = FrameworkNodeTreeOut(**n.model_dump(), children=[])
        node_map[n.id] = tree_node

    for tree_node in node_map.values():
        if tree_node.parent_id and tree_node.parent_id in node_map:
            node_map[tree_node.parent_id].children.append(tree_node)
        else:
            roots.append(tree_node)

    return roots


# ═══════════════════ FRAMEWORKS CRUD ═══════════════════

@router.get("/api/v1/frameworks", response_model=list[FrameworkOut],
            summary="Lista frameworków")
async def list_frameworks(
    is_active: bool | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = select(Framework).order_by(Framework.name)
    if is_active is not None:
        q = q.where(Framework.is_active == is_active)
    rows = (await s.execute(q)).scalars().all()
    return [FrameworkOut.model_validate(fw) for fw in rows]


@router.get("/api/v1/frameworks/{framework_id}", response_model=FrameworkDetailOut,
            summary="Szczegóły frameworka z wymiarami")
async def get_framework(framework_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(Framework)
        .options(
            selectinload(Framework.dimensions).selectinload(AssessmentDimension.levels),
        )
        .where(Framework.id == framework_id)
    )
    fw = (await s.execute(q)).scalar_one_or_none()
    if not fw:
        raise HTTPException(404, "Framework nie istnieje")
    return FrameworkDetailOut.model_validate(fw)


@router.post("/api/v1/frameworks", response_model=FrameworkOut, status_code=201,
             summary="Utwórz framework ręcznie")
async def create_framework(body: FrameworkCreate, s: AsyncSession = Depends(get_session)):
    fw = Framework(
        urn=body.urn,
        ref_id=body.ref_id,
        name=body.name,
        description=body.description,
        version=body.version,
        provider=body.provider,
        locale=body.locale,
        source_format="manual",
        imported_at=datetime.utcnow(),
    )
    s.add(fw)
    await s.flush()

    # Create dimensions if provided
    for dim_data in body.dimensions:
        dim = AssessmentDimension(
            framework_id=fw.id,
            dimension_key=dim_data.dimension_key,
            name=dim_data.name,
            name_pl=dim_data.name_pl,
            order_id=dim_data.order_id,
            weight=Decimal(str(dim_data.weight)),
        )
        s.add(dim)
        await s.flush()
        for lvl_data in dim_data.levels:
            s.add(DimensionLevel(
                dimension_id=dim.id,
                level_order=lvl_data.level_order,
                value=Decimal(str(lvl_data.value)),
                label=lvl_data.label,
                label_pl=lvl_data.label_pl,
                color=lvl_data.color,
            ))

    await s.commit()
    await s.refresh(fw)
    return FrameworkOut.model_validate(fw)


@router.delete("/api/v1/frameworks/{framework_id}",
               summary="Soft-delete frameworka")
async def delete_framework(framework_id: int, s: AsyncSession = Depends(get_session)):
    fw = await s.get(Framework, framework_id)
    if not fw:
        raise HTTPException(404, "Framework nie istnieje")
    fw.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": framework_id}


# ═══════════════════ FRAMEWORK NODES ═══════════════════

@router.get("/api/v1/frameworks/{framework_id}/tree",
            response_model=list[FrameworkNodeTreeOut],
            summary="Drzewo hierarchiczne nodes")
async def get_framework_tree(framework_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(FrameworkNode)
        .where(FrameworkNode.framework_id == framework_id, FrameworkNode.is_active.is_(True))
        .order_by(FrameworkNode.depth, FrameworkNode.order_id)
    )
    rows = (await s.execute(q)).scalars().all()
    flat = [FrameworkNodeOut.model_validate(n) for n in rows]
    return _build_tree(flat)


@router.get("/api/v1/frameworks/{framework_id}/nodes",
            response_model=list[FrameworkNodeOut],
            summary="Lista nodes (z filtrami)")
async def list_framework_nodes(
    framework_id: int,
    assessable: bool | None = Query(None),
    ig: str | None = Query(None, description="Implementation Group filter, e.g. 'IG1'"),
    depth: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = select(FrameworkNode).where(
        FrameworkNode.framework_id == framework_id,
        FrameworkNode.is_active.is_(True),
    )
    if assessable is not None:
        q = q.where(FrameworkNode.assessable == assessable)
    if ig:
        q = q.where(func.find_in_set(ig, FrameworkNode.implementation_groups) > 0)
    if depth is not None:
        q = q.where(FrameworkNode.depth == depth)
    q = q.order_by(FrameworkNode.depth, FrameworkNode.order_id)
    rows = (await s.execute(q)).scalars().all()
    return [FrameworkNodeOut.model_validate(n) for n in rows]


# ═══════════════════ IMPORT ═══════════════════

@router.post("/api/v1/frameworks/import/excel", response_model=ImportResult,
             status_code=201, summary="Import z Excel (CISO Assistant)")
async def import_excel(
    file: UploadFile = File(...),
    imported_by: str = Query("system"),
    s: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "Plik musi być w formacie .xlsx")
    contents = await file.read()
    try:
        fw = await import_from_excel(s, contents, file.filename, imported_by)
        await s.commit()
        await s.refresh(fw)
        dim_count = (await s.execute(
            select(func.count(AssessmentDimension.id))
            .where(AssessmentDimension.framework_id == fw.id)
        )).scalar() or 0
        return ImportResult(
            framework_id=fw.id, framework_name=fw.name,
            total_nodes=fw.total_nodes, total_assessable=fw.total_assessable,
            dimensions_created=dim_count,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/api/v1/frameworks/import/yaml", response_model=ImportResult,
             status_code=201, summary="Import z YAML (CISO Assistant)")
async def import_yaml_endpoint(
    file: UploadFile = File(...),
    imported_by: str = Query("system"),
    s: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.endswith((".yaml", ".yml")):
        raise HTTPException(400, "Plik musi być w formacie .yaml/.yml")
    contents = await file.read()
    try:
        fw = await import_from_yaml(s, contents, file.filename, imported_by)
        await s.commit()
        await s.refresh(fw)
        dim_count = (await s.execute(
            select(func.count(AssessmentDimension.id))
            .where(AssessmentDimension.framework_id == fw.id)
        )).scalar() or 0
        return ImportResult(
            framework_id=fw.id, framework_name=fw.name,
            total_nodes=fw.total_nodes, total_assessable=fw.total_assessable,
            dimensions_created=dim_count,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/api/v1/frameworks/import/github", response_model=ImportResult,
             status_code=201, summary="Import z GitHub (CISO Assistant repo)")
async def import_from_github(
    body: ImportFromGithubRequest,
    imported_by: str = Query("system"),
    s: AsyncSession = Depends(get_session),
):
    base_url = "https://raw.githubusercontent.com/intuitem/ciso-assistant-community/main/backend/library/libraries"
    url = f"{base_url}/{body.framework_path}"

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(url)
    if resp.status_code != 200:
        raise HTTPException(400, f"Nie udało się pobrać pliku z GitHub: HTTP {resp.status_code}")

    file_bytes = resp.content
    filename = body.framework_path.split("/")[-1]

    try:
        if filename.endswith(".xlsx"):
            fw = await import_from_excel(s, file_bytes, filename, imported_by)
        elif filename.endswith((".yaml", ".yml")):
            fw = await import_from_yaml(s, file_bytes, filename, imported_by)
        else:
            raise HTTPException(400, "Nieobsługiwany format pliku (oczekiwano .xlsx lub .yaml)")

        fw.source_url = url
        await s.commit()
        await s.refresh(fw)
        dim_count = (await s.execute(
            select(func.count(AssessmentDimension.id))
            .where(AssessmentDimension.framework_id == fw.id)
        )).scalar() or 0
        return ImportResult(
            framework_id=fw.id, framework_name=fw.name,
            total_nodes=fw.total_nodes, total_assessable=fw.total_assessable,
            dimensions_created=dim_count,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


# ═══════════════════ AREA MAPPINGS ═══════════════════

@router.get("/api/v1/frameworks/{framework_id}/area-mappings",
            response_model=list[AreaMappingOut],
            summary="Mapowania nodes → obszary")
async def list_area_mappings(
    framework_id: int, s: AsyncSession = Depends(get_session),
):
    q = (
        select(
            FrameworkNodeSecurityArea,
            FrameworkNode.ref_id.label("node_ref_id"),
            FrameworkNode.name.label("node_name"),
            SecurityArea.name.label("area_name"),
        )
        .join(FrameworkNode, FrameworkNodeSecurityArea.framework_node_id == FrameworkNode.id)
        .join(SecurityArea, FrameworkNodeSecurityArea.security_area_id == SecurityArea.id)
        .where(FrameworkNode.framework_id == framework_id)
        .order_by(FrameworkNode.ref_id)
    )
    rows = (await s.execute(q)).all()
    return [
        AreaMappingOut(
            id=m.id, framework_node_id=m.framework_node_id,
            security_area_id=m.security_area_id, source=m.source,
            created_by=m.created_by, created_at=m.created_at,
            node_ref_id=node_ref_id, node_name=node_name, area_name=area_name,
        )
        for m, node_ref_id, node_name, area_name in rows
    ]


@router.post("/api/v1/frameworks/{framework_id}/area-mappings/bulk",
             summary="Bulk assign nodes → area")
async def bulk_create_area_mappings(
    framework_id: int,
    body: BulkAreaMappingRequest,
    s: AsyncSession = Depends(get_session),
):
    created = 0
    for node_id in body.node_ids:
        # Verify node belongs to framework
        node = await s.get(FrameworkNode, node_id)
        if not node or node.framework_id != framework_id:
            continue
        existing = (await s.execute(
            select(FrameworkNodeSecurityArea).where(
                FrameworkNodeSecurityArea.framework_node_id == node_id,
                FrameworkNodeSecurityArea.security_area_id == body.security_area_id,
            )
        )).scalar_one_or_none()
        if not existing:
            s.add(FrameworkNodeSecurityArea(
                framework_node_id=node_id,
                security_area_id=body.security_area_id,
                source=body.source,
                created_by=body.created_by,
            ))
            created += 1
    await s.commit()
    return {"status": "ok", "created": created}


@router.delete("/api/v1/framework-nodes/{node_id}/areas/{area_id}",
               summary="Usuń mapowanie node → area")
async def delete_area_mapping(
    node_id: int, area_id: int, s: AsyncSession = Depends(get_session),
):
    result = await s.execute(
        delete(FrameworkNodeSecurityArea).where(
            FrameworkNodeSecurityArea.framework_node_id == node_id,
            FrameworkNodeSecurityArea.security_area_id == area_id,
        )
    )
    await s.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "Mapowanie nie istnieje")
    return {"status": "deleted"}


# ═══════════════════ DIMENSIONS ═══════════════════

@router.get("/api/v1/frameworks/{framework_id}/dimensions",
            response_model=list[AssessmentDimensionOut],
            summary="Wymiary + poziomy dla frameworka")
async def list_dimensions(framework_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(AssessmentDimension)
        .options(selectinload(AssessmentDimension.levels))
        .where(AssessmentDimension.framework_id == framework_id)
        .order_by(AssessmentDimension.order_id)
    )
    dims = (await s.execute(q)).scalars().unique().all()
    return [AssessmentDimensionOut.model_validate(d) for d in dims]


# ═══════════════════ ASSESSMENTS ═══════════════════

@router.get("/api/v1/assessments", response_model=list[AssessmentOut],
            summary="Lista ocen (filtry: framework, org_unit, area)")
async def list_assessments(
    framework_id: int | None = Query(None),
    org_unit_id: int | None = Query(None),
    security_area_id: int | None = Query(None),
    status: str | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = select(Assessment).where(Assessment.is_active.is_(True))
    if framework_id is not None:
        q = q.where(Assessment.framework_id == framework_id)
    if org_unit_id is not None:
        q = q.where(Assessment.org_unit_id == org_unit_id)
    if security_area_id is not None:
        q = q.where(Assessment.security_area_id == security_area_id)
    if status:
        q = q.where(Assessment.status == status)
    q = q.order_by(Assessment.assessment_date.desc())

    rows = (await s.execute(q)).scalars().all()
    results = []
    for a in rows:
        fw = await s.get(Framework, a.framework_id)
        ou = await s.get(OrgUnit, a.org_unit_id) if a.org_unit_id else None
        results.append(AssessmentOut(
            id=a.id, ref_id=a.ref_id,
            framework_id=a.framework_id,
            framework_name=fw.name if fw else None,
            org_unit_id=a.org_unit_id,
            org_unit_name=ou.name if ou else None,
            security_area_id=a.security_area_id,
            title=a.title, assessor=a.assessor,
            assessment_date=a.assessment_date,
            status=a.status,
            implementation_group_filter=a.implementation_group_filter,
            notes=a.notes,
            completion_pct=_d(a.completion_pct),
            overall_score=_d(a.overall_score),
            approved_by=a.approved_by, approved_at=a.approved_at,
            is_active=a.is_active,
            created_at=a.created_at, updated_at=a.updated_at,
        ))
    return results


@router.get("/api/v1/assessments/{assessment_id}", response_model=AssessmentOut,
            summary="Szczegóły oceny + score")
async def get_assessment(assessment_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(Assessment, assessment_id)
    if not a or not a.is_active:
        raise HTTPException(404, "Ocena nie istnieje")
    fw = await s.get(Framework, a.framework_id)
    ou = await s.get(OrgUnit, a.org_unit_id) if a.org_unit_id else None
    return AssessmentOut(
        id=a.id, ref_id=a.ref_id,
        framework_id=a.framework_id,
        framework_name=fw.name if fw else None,
        org_unit_id=a.org_unit_id,
        org_unit_name=ou.name if ou else None,
        security_area_id=a.security_area_id,
        title=a.title, assessor=a.assessor,
        assessment_date=a.assessment_date,
        status=a.status,
        implementation_group_filter=a.implementation_group_filter,
        notes=a.notes,
        completion_pct=_d(a.completion_pct),
        overall_score=_d(a.overall_score),
        approved_by=a.approved_by, approved_at=a.approved_at,
        is_active=a.is_active,
        created_at=a.created_at, updated_at=a.updated_at,
    )


@router.post("/api/v1/assessments", response_model=AssessmentOut, status_code=201,
             summary="Nowa ocena")
async def create_assessment(body: AssessmentCreate, s: AsyncSession = Depends(get_session)):
    fw = await s.get(Framework, body.framework_id)
    if not fw:
        raise HTTPException(404, "Framework nie istnieje")

    # Generate ref_id
    count = (await s.execute(select(func.count(Assessment.id)))).scalar() or 0
    ref_id = f"ASM-{count + 1:04d}"

    a = Assessment(
        ref_id=ref_id,
        framework_id=body.framework_id,
        org_unit_id=body.org_unit_id,
        security_area_id=body.security_area_id,
        title=body.title or f"{fw.name} Assessment",
        assessor=body.assessor,
        assessment_date=body.assessment_date or date.today(),
        status="draft",
        implementation_group_filter=body.implementation_group_filter,
        notes=body.notes,
    )
    s.add(a)
    await s.flush()

    # Pre-generate empty answers for each assessable node × each dimension
    nodes_q = select(FrameworkNode).where(
        FrameworkNode.framework_id == body.framework_id,
        FrameworkNode.assessable.is_(True),
        FrameworkNode.is_active.is_(True),
    )
    # Apply area filter
    if body.security_area_id:
        nodes_q = nodes_q.where(
            FrameworkNode.id.in_(
                select(FrameworkNodeSecurityArea.framework_node_id)
                .where(FrameworkNodeSecurityArea.security_area_id == body.security_area_id)
            )
        )
    # Apply IG filter
    if body.implementation_group_filter:
        nodes_q = nodes_q.where(
            func.find_in_set(body.implementation_group_filter,
                             FrameworkNode.implementation_groups) > 0
        )

    nodes = (await s.execute(nodes_q)).scalars().all()
    dims = (await s.execute(
        select(AssessmentDimension).where(
            AssessmentDimension.framework_id == body.framework_id,
            AssessmentDimension.is_active.is_(True),
        )
    )).scalars().all()

    for node in nodes:
        for dim in dims:
            s.add(AssessmentAnswer(
                assessment_id=a.id,
                framework_node_id=node.id,
                dimension_id=dim.id,
            ))

    await s.commit()
    await s.refresh(a)
    fw = await s.get(Framework, a.framework_id)
    ou = await s.get(OrgUnit, a.org_unit_id) if a.org_unit_id else None
    return AssessmentOut(
        id=a.id, ref_id=a.ref_id,
        framework_id=a.framework_id,
        framework_name=fw.name if fw else None,
        org_unit_id=a.org_unit_id,
        org_unit_name=ou.name if ou else None,
        security_area_id=a.security_area_id,
        title=a.title, assessor=a.assessor,
        assessment_date=a.assessment_date, status=a.status,
        implementation_group_filter=a.implementation_group_filter,
        notes=a.notes,
        completion_pct=_d(a.completion_pct),
        overall_score=_d(a.overall_score),
        approved_by=a.approved_by, approved_at=a.approved_at,
        is_active=a.is_active,
        created_at=a.created_at, updated_at=a.updated_at,
    )


# ═══════════════════ ANSWERS ═══════════════════

@router.get("/api/v1/assessments/{assessment_id}/answers",
            response_model=list[AssessmentAnswerOut],
            summary="Odpowiedzi dla oceny")
async def list_answers(assessment_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(
            AssessmentAnswer,
            FrameworkNode.ref_id.label("node_ref_id"),
            AssessmentDimension.dimension_key,
            DimensionLevel.value.label("level_value"),
            DimensionLevel.label.label("level_label"),
        )
        .join(FrameworkNode, AssessmentAnswer.framework_node_id == FrameworkNode.id)
        .join(AssessmentDimension, AssessmentAnswer.dimension_id == AssessmentDimension.id)
        .outerjoin(DimensionLevel, AssessmentAnswer.level_id == DimensionLevel.id)
        .where(AssessmentAnswer.assessment_id == assessment_id)
        .order_by(FrameworkNode.ref_id, AssessmentDimension.order_id)
    )
    rows = (await s.execute(q)).all()
    return [
        AssessmentAnswerOut(
            id=ans.id, assessment_id=ans.assessment_id,
            framework_node_id=ans.framework_node_id,
            dimension_id=ans.dimension_id,
            level_id=ans.level_id,
            not_applicable=ans.not_applicable,
            notes=ans.notes, evidence=ans.evidence,
            node_ref_id=node_ref_id,
            dimension_key=dim_key,
            level_value=float(level_value) if level_value is not None else None,
            level_label=level_label,
        )
        for ans, node_ref_id, dim_key, level_value, level_label in rows
    ]


@router.put("/api/v1/assessments/{assessment_id}/answers",
            summary="Bulk update odpowiedzi")
async def bulk_upsert_answers(
    assessment_id: int,
    body: AnswersBatchUpsert,
    s: AsyncSession = Depends(get_session),
):
    a = await s.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Ocena nie istnieje")

    created = 0
    updated = 0
    for item in body.answers:
        existing = (await s.execute(
            select(AssessmentAnswer).where(
                AssessmentAnswer.assessment_id == assessment_id,
                AssessmentAnswer.framework_node_id == item.framework_node_id,
                AssessmentAnswer.dimension_id == item.dimension_id,
            )
        )).scalar_one_or_none()

        if existing:
            existing.level_id = item.level_id
            existing.not_applicable = item.not_applicable
            existing.notes = item.notes
            existing.evidence = item.evidence
            updated += 1
        else:
            s.add(AssessmentAnswer(
                assessment_id=assessment_id,
                framework_node_id=item.framework_node_id,
                dimension_id=item.dimension_id,
                level_id=item.level_id,
                not_applicable=item.not_applicable,
                notes=item.notes,
                evidence=item.evidence,
            ))
            created += 1

    await s.flush()
    await recalculate_assessment(s, assessment_id)
    await s.commit()
    return {"status": "ok", "created": created, "updated": updated}


@router.patch("/api/v1/assessments/{assessment_id}/answers/{answer_id}",
              response_model=AssessmentAnswerOut,
              summary="Update jednej odpowiedzi")
async def update_single_answer(
    assessment_id: int, answer_id: int,
    level_id: int | None = Query(None),
    not_applicable: bool | None = Query(None),
    notes: str | None = Query(None),
    evidence: str | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    ans = await s.get(AssessmentAnswer, answer_id)
    if not ans or ans.assessment_id != assessment_id:
        raise HTTPException(404, "Odpowiedź nie istnieje")

    if level_id is not None:
        ans.level_id = level_id
    if not_applicable is not None:
        ans.not_applicable = not_applicable
    if notes is not None:
        ans.notes = notes
    if evidence is not None:
        ans.evidence = evidence

    await s.flush()
    await recalculate_assessment(s, assessment_id)
    await s.commit()
    await s.refresh(ans)

    node = await s.get(FrameworkNode, ans.framework_node_id)
    dim = await s.get(AssessmentDimension, ans.dimension_id)
    lvl = await s.get(DimensionLevel, ans.level_id) if ans.level_id else None
    return AssessmentAnswerOut(
        id=ans.id, assessment_id=ans.assessment_id,
        framework_node_id=ans.framework_node_id,
        dimension_id=ans.dimension_id,
        level_id=ans.level_id,
        not_applicable=ans.not_applicable,
        notes=ans.notes, evidence=ans.evidence,
        node_ref_id=node.ref_id if node else None,
        dimension_key=dim.dimension_key if dim else None,
        level_value=float(lvl.value) if lvl else None,
        level_label=lvl.label if lvl else None,
    )


@router.post("/api/v1/assessments/{assessment_id}/approve",
             summary="Zatwierdź ocenę")
async def approve_assessment(
    assessment_id: int,
    body: AssessmentApproveRequest,
    s: AsyncSession = Depends(get_session),
):
    a = await s.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Ocena nie istnieje")
    a.status = "approved"
    a.approved_by = body.approved_by
    a.approved_at = datetime.utcnow()
    await s.commit()
    return {"status": "approved", "id": assessment_id}


@router.get("/api/v1/assessments/{assessment_id}/score",
            response_model=AssessmentScoreOut,
            summary="Wynik + breakdown")
async def get_assessment_score(assessment_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Ocena nie istnieje")

    breakdown = await get_assessment_score_breakdown(s, assessment_id)
    return AssessmentScoreOut(
        assessment_id=assessment_id,
        overall_score=_d(a.overall_score),
        completion_pct=_d(a.completion_pct),
        node_scores=[
            NodeScore(
                framework_node_id=ns["framework_node_id"],
                ref_id=ns["ref_id"],
                name=ns["name"],
                score=ns["score"],
                dimensions=ns["dimensions"],
            )
            for ns in breakdown
        ],
    )


@router.get("/api/v1/assessments/compare", response_model=list[AssessmentScoreOut],
            summary="Porównanie ocen")
async def compare_assessments(
    ids: str = Query(..., description="Comma-separated assessment IDs"),
    s: AsyncSession = Depends(get_session),
):
    id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
    results = []
    for aid in id_list:
        a = await s.get(Assessment, aid)
        if not a:
            continue
        breakdown = await get_assessment_score_breakdown(s, aid)
        results.append(AssessmentScoreOut(
            assessment_id=aid,
            overall_score=_d(a.overall_score),
            completion_pct=_d(a.completion_pct),
            node_scores=[
                NodeScore(
                    framework_node_id=ns["framework_node_id"],
                    ref_id=ns["ref_id"],
                    name=ns["name"],
                    score=ns["score"],
                    dimensions=ns["dimensions"],
                )
                for ns in breakdown
            ],
        ))
    return results


# ═══════════════════ METRICS ═══════════════════

@router.get("/api/v1/frameworks/metrics",
            summary="Dane do filaru Control Maturity")
async def get_framework_metrics(
    framework_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = (
        select(Assessment)
        .where(
            Assessment.status == "approved",
            Assessment.is_active.is_(True),
        )
        .order_by(Assessment.assessment_date.desc())
    )
    if framework_id:
        q = q.where(Assessment.framework_id == framework_id)

    assessments = (await s.execute(q)).scalars().all()
    return [
        {
            "assessment_id": a.id,
            "ref_id": a.ref_id,
            "framework_id": a.framework_id,
            "org_unit_id": a.org_unit_id,
            "overall_score": _d(a.overall_score),
            "assessment_date": a.assessment_date.isoformat() if a.assessment_date else None,
        }
        for a in assessments
    ]
