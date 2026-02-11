"""
Framework assessment scoring service.

Calculates per-node scores, overall score, and completion percentage.
"""
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.framework import (
    Assessment,
    AssessmentAnswer,
    AssessmentDimension,
    DimensionLevel,
    FrameworkNode,
)


async def recalculate_assessment(session: AsyncSession, assessment_id: int) -> None:
    """Recalculate completion_pct and overall_score for an assessment."""
    assessment = await session.get(Assessment, assessment_id)
    if not assessment:
        return

    fw_id = assessment.framework_id

    # Count total assessable nodes in scope
    nodes_q = select(func.count(FrameworkNode.id)).where(
        FrameworkNode.framework_id == fw_id,
        FrameworkNode.assessable.is_(True),
        FrameworkNode.is_active.is_(True),
    )
    # Apply IG filter if set
    if assessment.implementation_group_filter:
        ig_filter = assessment.implementation_group_filter
        nodes_q = nodes_q.where(
            func.find_in_set(ig_filter, FrameworkNode.implementation_groups) > 0
        )
    total_assessable = (await session.execute(nodes_q)).scalar() or 0

    # Count answered nodes (distinct framework_node_id with level_id != NULL and not N/A)
    answered_q = (
        select(func.count(func.distinct(AssessmentAnswer.framework_node_id)))
        .where(
            AssessmentAnswer.assessment_id == assessment_id,
            AssessmentAnswer.level_id.isnot(None),
            AssessmentAnswer.not_applicable.is_(False),
        )
    )
    answered_nodes = (await session.execute(answered_q)).scalar() or 0

    # Count N/A nodes
    na_q = (
        select(func.count(func.distinct(AssessmentAnswer.framework_node_id)))
        .where(
            AssessmentAnswer.assessment_id == assessment_id,
            AssessmentAnswer.not_applicable.is_(True),
        )
    )
    na_nodes = (await session.execute(na_q)).scalar() or 0

    denominator = total_assessable - na_nodes if total_assessable > na_nodes else 1
    completion_pct = round((answered_nodes / denominator) * 100, 2) if denominator > 0 else 0

    # Calculate overall score: weighted average across all answered nodes
    # For each answered, non-N/A answer: take level.value, weighted by dimension.weight
    score_q = (
        select(
            func.sum(DimensionLevel.value * AssessmentDimension.weight),
            func.sum(AssessmentDimension.weight),
        )
        .select_from(AssessmentAnswer)
        .join(DimensionLevel, AssessmentAnswer.level_id == DimensionLevel.id)
        .join(AssessmentDimension, AssessmentAnswer.dimension_id == AssessmentDimension.id)
        .where(
            AssessmentAnswer.assessment_id == assessment_id,
            AssessmentAnswer.not_applicable.is_(False),
            AssessmentAnswer.level_id.isnot(None),
        )
    )
    result = (await session.execute(score_q)).one_or_none()
    weighted_sum = float(result[0]) if result and result[0] else 0
    weight_total = float(result[1]) if result and result[1] else 0

    overall_score = round((weighted_sum / weight_total) * 100, 2) if weight_total > 0 else None

    assessment.completion_pct = Decimal(str(completion_pct))
    assessment.overall_score = Decimal(str(overall_score)) if overall_score is not None else None


async def get_assessment_score_breakdown(
    session: AsyncSession, assessment_id: int,
) -> list[dict]:
    """Return per-node score breakdown."""
    assessment = await session.get(Assessment, assessment_id)
    if not assessment:
        return []

    # Get all answers with level values grouped by node
    q = (
        select(
            AssessmentAnswer.framework_node_id,
            FrameworkNode.ref_id,
            FrameworkNode.name,
            AssessmentDimension.dimension_key,
            DimensionLevel.value,
            AssessmentAnswer.not_applicable,
        )
        .select_from(AssessmentAnswer)
        .join(FrameworkNode, AssessmentAnswer.framework_node_id == FrameworkNode.id)
        .join(AssessmentDimension, AssessmentAnswer.dimension_id == AssessmentDimension.id)
        .outerjoin(DimensionLevel, AssessmentAnswer.level_id == DimensionLevel.id)
        .where(AssessmentAnswer.assessment_id == assessment_id)
        .order_by(FrameworkNode.ref_id, AssessmentDimension.order_id)
    )
    rows = (await session.execute(q)).all()

    # Group by node
    node_map: dict[int, dict] = {}
    for node_id, ref_id, name, dim_key, value, na in rows:
        if node_id not in node_map:
            node_map[node_id] = {
                "framework_node_id": node_id,
                "ref_id": ref_id,
                "name": name,
                "dimensions": {},
                "is_na": False,
            }
        if na:
            node_map[node_id]["is_na"] = True
        node_map[node_id]["dimensions"][dim_key] = float(value) if value is not None else None

    # Calculate per-node score
    results = []
    for node_data in node_map.values():
        dims = node_data["dimensions"]
        values = [v for v in dims.values() if v is not None]
        score = (sum(values) / len(values)) * 100 if values else None
        results.append({
            "framework_node_id": node_data["framework_node_id"],
            "ref_id": node_data["ref_id"],
            "name": node_data["name"],
            "score": round(score, 2) if score is not None else None,
            "dimensions": dims,
        })

    return results
