"""
Assessment Engine — /api/v1/assessments

CRUD for assessments, answers, scoring, comparisons.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.framework import (
    Assessment, AssessmentAnswer, AssessmentDimension,
    DimensionLevel, Framework, FrameworkNode, FrameworkNodeSecurityArea,
)
from app.models.org_unit import OrgUnit
from app.models.security_area import SecurityDomain
from app.schemas.framework import (
    AnswerOut, AnswersBatchUpsert,
    AssessmentBrief, AssessmentCompareOut, AssessmentCreate,
    AssessmentOut, AssessmentScoreOut, AssessmentUpdate,
)
from app.services.assessment_score import calculate_assessment_score

router = APIRouter(prefix="/api/v1/assessments", tags=["Assessments"])


# ── helpers ──

async def _assessment_out(s: AsyncSession, a: Assessment) -> AssessmentOut:
    fw = await s.get(Framework, a.framework_id)
    ou = await s.get(OrgUnit, a.org_unit_id) if a.org_unit_id else None
    sa = await s.get(SecurityDomain, a.security_area_id) if a.security_area_id else None
    return AssessmentOut(
        id=a.id,
        ref_id=a.ref_id,
        framework_id=a.framework_id,
        framework_name=fw.name if fw else None,
        org_unit_id=a.org_unit_id,
        org_unit_name=ou.name if ou else None,
        security_area_id=a.security_area_id,
        security_area_name=sa.name if sa else None,
        title=a.title,
        assessor=a.assessor,
        assessment_date=a.assessment_date,
        status=a.status,
        implementation_group_filter=a.implementation_group_filter,
        notes=a.notes,
        completion_pct=float(a.completion_pct) if a.completion_pct else None,
        overall_score=float(a.overall_score) if a.overall_score else None,
        approved_by=a.approved_by,
        approved_at=a.approved_at,
        is_active=a.is_active,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


def _next_ref_id(max_num: int) -> str:
    return f"ASM-{max_num + 1:04d}"


# ═══════════════════════════════════════════════
# ASSESSMENTS CRUD
# ═══════════════════════════════════════════════

@router.get("", response_model=list[AssessmentBrief], summary="Lista ocen")
async def list_assessments(
    framework_id: int | None = Query(None),
    org_unit_id: int | None = Query(None),
    security_area_id: int | None = Query(None),
    status: str | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = (
        select(
            Assessment,
            Framework.name.label("fw_name"),
            OrgUnit.name.label("ou_name"),
        )
        .join(Framework, Assessment.framework_id == Framework.id)
        .outerjoin(OrgUnit, Assessment.org_unit_id == OrgUnit.id)
        .where(Assessment.is_active.is_(True))
    )
    if framework_id is not None:
        q = q.where(Assessment.framework_id == framework_id)
    if org_unit_id is not None:
        q = q.where(Assessment.org_unit_id == org_unit_id)
    if security_area_id is not None:
        q = q.where(Assessment.security_area_id == security_area_id)
    if status:
        q = q.where(Assessment.status == status)

    q = q.order_by(Assessment.assessment_date.desc())
    rows = (await s.execute(q)).all()

    return [
        AssessmentBrief(
            id=a.id,
            framework_name=fw_name,
            org_unit_name=ou_name,
            assessment_date=a.assessment_date,
            status=a.status,
            overall_score=float(a.overall_score) if a.overall_score else None,
            completion_pct=float(a.completion_pct) if a.completion_pct else None,
        )
        for a, fw_name, ou_name in rows
    ]


@router.get("/compare", response_model=AssessmentCompareOut, summary="Porównanie ocen")
async def compare_assessments(
    ids: str = Query(..., description="Comma-separated assessment IDs, e.g. '1,2'"),
    s: AsyncSession = Depends(get_session),
):
    id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    if len(id_list) < 2:
        raise HTTPException(400, "Podaj co najmniej 2 ID do porównania")

    assessments_out = []
    scores_out = []
    for aid in id_list:
        a = await s.get(Assessment, aid)
        if not a:
            raise HTTPException(404, f"Ocena {aid} nie istnieje")
        assessments_out.append(await _assessment_out(s, a))
        scores_out.append(await calculate_assessment_score(s, aid))

    return AssessmentCompareOut(assessments=assessments_out, scores=scores_out)


@router.get("/{assessment_id}", response_model=AssessmentOut, summary="Szczegóły oceny")
async def get_assessment(assessment_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(Assessment, assessment_id)
    if not a or not a.is_active:
        raise HTTPException(404, "Ocena nie istnieje")
    return await _assessment_out(s, a)


@router.post("", response_model=AssessmentOut, status_code=201, summary="Nowa ocena")
async def create_assessment(body: AssessmentCreate, s: AsyncSession = Depends(get_session)):
    # Validate framework exists
    fw = await s.get(Framework, body.framework_id)
    if not fw or not fw.is_active:
        raise HTTPException(404, "Framework nie istnieje")

    # Generate ref_id
    max_num_row = await s.execute(
        select(func.count(Assessment.id))
    )
    max_num = max_num_row.scalar() or 0

    a = Assessment(
        ref_id=_next_ref_id(max_num),
        framework_id=body.framework_id,
        org_unit_id=body.org_unit_id,
        security_area_id=body.security_area_id,
        title=body.title,
        assessor=body.assessor,
        assessment_date=body.assessment_date or date.today(),
        implementation_group_filter=body.implementation_group_filter,
        notes=body.notes,
        status="draft",
    )
    s.add(a)
    await s.flush()

    # Pre-generate empty answers for all assessable nodes × dimensions
    dims = (await s.execute(
        select(AssessmentDimension).where(AssessmentDimension.framework_id == body.framework_id)
    )).scalars().all()

    nodes_q = (
        select(FrameworkNode)
        .where(
            FrameworkNode.framework_id == body.framework_id,
            FrameworkNode.assessable.is_(True),
            FrameworkNode.is_active.is_(True),
        )
    )
    # Apply IG filter if specified
    if body.implementation_group_filter:
        ig = body.implementation_group_filter.strip()
        nodes_q = nodes_q.where(
            func.find_in_set(ig, FrameworkNode.implementation_groups) > 0
        )
    # Apply area filter if specified
    if body.security_area_id:
        mapped_ids = select(FrameworkNodeSecurityArea.framework_node_id).where(
            FrameworkNodeSecurityArea.security_area_id == body.security_area_id
        )
        nodes_q = nodes_q.where(FrameworkNode.id.in_(mapped_ids))

    nodes = (await s.execute(nodes_q)).scalars().all()

    # Copy answers from existing assessment if requested
    if body.copy_from_assessment_id:
        src_answers = (await s.execute(
            select(AssessmentAnswer).where(AssessmentAnswer.assessment_id == body.copy_from_assessment_id)
        )).scalars().all()
        src_map = {(ans.framework_node_id, ans.dimension_id): ans for ans in src_answers}

        for node in nodes:
            for dim in dims:
                src = src_map.get((node.id, dim.id))
                s.add(AssessmentAnswer(
                    assessment_id=a.id,
                    framework_node_id=node.id,
                    dimension_id=dim.id,
                    level_id=src.level_id if src else None,
                    not_applicable=src.not_applicable if src else False,
                    notes=src.notes if src else None,
                    evidence=src.evidence if src else None,
                ))
    else:
        for node in nodes:
            for dim in dims:
                s.add(AssessmentAnswer(
                    assessment_id=a.id,
                    framework_node_id=node.id,
                    dimension_id=dim.id,
                ))

    await s.flush()

    # Calculate initial score if copied
    if body.copy_from_assessment_id:
        await calculate_assessment_score(s, a.id)

    await s.commit()
    await s.refresh(a)
    return await _assessment_out(s, a)


@router.put("/{assessment_id}", response_model=AssessmentOut, summary="Edytuj ocenę")
async def update_assessment(
    assessment_id: int, body: AssessmentUpdate, s: AsyncSession = Depends(get_session),
):
    a = await s.get(Assessment, assessment_id)
    if not a or not a.is_active:
        raise HTTPException(404, "Ocena nie istnieje")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)

    await s.commit()
    await s.refresh(a)
    return await _assessment_out(s, a)


@router.post("/{assessment_id}/approve", response_model=AssessmentOut, summary="Zatwierdź ocenę")
async def approve_assessment(
    assessment_id: int,
    approved_by: str = Query("CISO"),
    s: AsyncSession = Depends(get_session),
):
    from datetime import datetime
    a = await s.get(Assessment, assessment_id)
    if not a or not a.is_active:
        raise HTTPException(404, "Ocena nie istnieje")

    # Recalculate score before approval
    await calculate_assessment_score(s, a.id)

    a.status = "approved"
    a.approved_by = approved_by
    a.approved_at = datetime.utcnow()
    await s.commit()
    await s.refresh(a)
    return await _assessment_out(s, a)


@router.delete("/{assessment_id}", summary="Soft-delete oceny")
async def delete_assessment(assessment_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Ocena nie istnieje")
    a.is_active = False
    await s.commit()
    return {"status": "archived", "id": assessment_id}


# ═══════════════════════════════════════════════
# ANSWERS
# ═══════════════════════════════════════════════

@router.get("/{assessment_id}/answers", response_model=list[AnswerOut], summary="Odpowiedzi oceny")
async def list_answers(assessment_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(
            AssessmentAnswer,
            FrameworkNode.ref_id.label("node_ref"),
            FrameworkNode.name.label("node_name"),
            AssessmentDimension.dimension_key.label("dim_key"),
            DimensionLevel.value.label("lvl_value"),
            DimensionLevel.label.label("lvl_label"),
        )
        .join(FrameworkNode, AssessmentAnswer.framework_node_id == FrameworkNode.id)
        .join(AssessmentDimension, AssessmentAnswer.dimension_id == AssessmentDimension.id)
        .outerjoin(DimensionLevel, AssessmentAnswer.level_id == DimensionLevel.id)
        .where(AssessmentAnswer.assessment_id == assessment_id)
        .order_by(FrameworkNode.order_id, AssessmentDimension.order_id)
    )
    rows = (await s.execute(q)).all()

    return [
        AnswerOut(
            id=ans.id,
            assessment_id=ans.assessment_id,
            framework_node_id=ans.framework_node_id,
            node_ref_id=node_ref,
            node_name=node_name,
            dimension_id=ans.dimension_id,
            dimension_key=dim_key,
            level_id=ans.level_id,
            level_value=float(lvl_value) if lvl_value is not None else None,
            level_label=lvl_label,
            not_applicable=ans.not_applicable,
            notes=ans.notes,
            evidence=ans.evidence,
        )
        for ans, node_ref, node_name, dim_key, lvl_value, lvl_label in rows
    ]


@router.put("/{assessment_id}/answers", summary="Bulk update odpowiedzi")
async def upsert_answers(
    assessment_id: int, body: AnswersBatchUpsert, s: AsyncSession = Depends(get_session),
):
    a = await s.get(Assessment, assessment_id)
    if not a or not a.is_active:
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
            if item.notes is not None:
                existing.notes = item.notes
            if item.evidence is not None:
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

    # Recalculate scores
    score = await calculate_assessment_score(s, assessment_id)
    await s.commit()

    return {
        "status": "ok",
        "created": created,
        "updated": updated,
        "overall_score": score.overall_score,
        "completion_pct": score.completion_pct,
    }


@router.patch("/{assessment_id}/answers/{answer_id}", summary="Update jednej odpowiedzi")
async def update_single_answer(
    assessment_id: int, answer_id: int,
    level_id: int | None = None,
    not_applicable: bool = False,
    notes: str | None = None,
    evidence: str | None = None,
    s: AsyncSession = Depends(get_session),
):
    ans = await s.get(AssessmentAnswer, answer_id)
    if not ans or ans.assessment_id != assessment_id:
        raise HTTPException(404, "Odpowiedź nie istnieje")

    ans.level_id = level_id
    ans.not_applicable = not_applicable
    if notes is not None:
        ans.notes = notes
    if evidence is not None:
        ans.evidence = evidence

    await s.flush()
    score = await calculate_assessment_score(s, assessment_id)
    await s.commit()

    return {
        "status": "ok",
        "overall_score": score.overall_score,
        "completion_pct": score.completion_pct,
    }


# ═══════════════════════════════════════════════
# SCORING
# ═══════════════════════════════════════════════

@router.get("/{assessment_id}/score", response_model=AssessmentScoreOut, summary="Wynik + breakdown")
async def get_assessment_score(assessment_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(Assessment, assessment_id)
    if not a or not a.is_active:
        raise HTTPException(404, "Ocena nie istnieje")
    return await calculate_assessment_score(s, assessment_id)


