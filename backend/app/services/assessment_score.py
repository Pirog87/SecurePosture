"""
Assessment Scoring Service for the Framework Engine.

Calculates:
  - Per-node score: avg of dimension level values (excluding N/A)
  - Per-control score: weighted avg of child node scores
  - Overall score: weighted avg of all assessable nodes → 0-100
  - Completion %: answered / total assessable
  - IG scores: avg per implementation group
  - Dimension averages: avg per dimension across all nodes
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.framework import (
    Assessment, AssessmentAnswer, AssessmentDimension,
    DimensionLevel, Framework, FrameworkNode,
)
from app.schemas.framework import (
    AssessmentScoreOut, NodeScoreOut,
)


async def calculate_assessment_score(
    s: AsyncSession, assessment_id: int
) -> AssessmentScoreOut:
    """Calculate full scoring for an assessment."""

    assessment = await s.get(Assessment, assessment_id)
    if not assessment:
        return AssessmentScoreOut(assessment_id=assessment_id)

    fw_id = assessment.framework_id

    # Get all dimensions for this framework
    dims_q = (
        select(AssessmentDimension)
        .where(AssessmentDimension.framework_id == fw_id)
        .order_by(AssessmentDimension.order_id)
    )
    dimensions = list((await s.execute(dims_q)).scalars().all())
    dim_map = {d.id: d for d in dimensions}

    # Get assessable nodes (respecting IG filter and area filter)
    nodes_q = (
        select(FrameworkNode)
        .where(
            FrameworkNode.framework_id == fw_id,
            FrameworkNode.assessable.is_(True),
            FrameworkNode.is_active.is_(True),
        )
    )

    # IG filter
    if assessment.implementation_group_filter:
        ig = assessment.implementation_group_filter.strip()
        nodes_q = nodes_q.where(
            func.find_in_set(ig, FrameworkNode.implementation_groups) > 0
        )

    # Security area filter — if assessment is scoped to a specific area,
    # only include nodes mapped to that area
    if assessment.security_area_id:
        from app.models.framework import FrameworkNodeSecurityArea
        mapped_node_ids = (
            select(FrameworkNodeSecurityArea.framework_node_id)
            .where(FrameworkNodeSecurityArea.security_area_id == assessment.security_area_id)
        )
        nodes_q = nodes_q.where(FrameworkNode.id.in_(mapped_node_ids))

    nodes = list((await s.execute(nodes_q)).scalars().all())
    node_map = {n.id: n for n in nodes}
    total_assessable = len(nodes)

    # Get all answers for this assessment
    answers_q = (
        select(AssessmentAnswer)
        .where(AssessmentAnswer.assessment_id == assessment_id)
    )
    answers = list((await s.execute(answers_q)).scalars().all())

    # Pre-fetch level values
    level_ids = {a.level_id for a in answers if a.level_id}
    level_values = {}
    if level_ids:
        lvl_q = select(DimensionLevel).where(DimensionLevel.id.in_(level_ids))
        for lvl in (await s.execute(lvl_q)).scalars():
            level_values[lvl.id] = float(lvl.value)

    # Group answers by node
    node_answers: dict[int, list[AssessmentAnswer]] = {}
    for ans in answers:
        node_answers.setdefault(ans.framework_node_id, []).append(ans)

    # Calculate per-node scores
    node_scores: list[NodeScoreOut] = []
    answered_count = 0
    na_count = 0

    # Accumulators for dimension averages
    dim_sums: dict[str, float] = {}
    dim_counts: dict[str, int] = {}

    for node in nodes:
        ans_list = node_answers.get(node.id, [])

        # Check if N/A (all dimensions are N/A)
        all_na = all(a.not_applicable for a in ans_list) if ans_list else False

        if all_na and ans_list:
            na_count += 1
            node_scores.append(NodeScoreOut(
                framework_node_id=node.id,
                ref_id=node.ref_id,
                name=node.name,
                score=None,
                not_applicable=True,
            ))
            continue

        dim_scores: dict[str, float | None] = {}
        values_for_avg = []
        has_answer = False

        for ans in ans_list:
            if ans.not_applicable:
                continue
            dim = dim_map.get(ans.dimension_id)
            if not dim:
                continue

            val = None
            if ans.level_id and ans.level_id in level_values:
                val = level_values[ans.level_id]
                has_answer = True

            dim_scores[dim.dimension_key] = val
            if val is not None:
                weighted_val = val * float(dim.weight)
                values_for_avg.append((weighted_val, float(dim.weight)))

                # Accumulate for dimension averages
                dim_sums.setdefault(dim.dimension_key, 0.0)
                dim_counts.setdefault(dim.dimension_key, 0)
                dim_sums[dim.dimension_key] += val
                dim_counts[dim.dimension_key] += 1

        if has_answer:
            answered_count += 1

        # Node score = weighted average of dimension values
        if values_for_avg:
            total_weight = sum(w for _, w in values_for_avg)
            node_score = sum(v for v, _ in values_for_avg) / total_weight if total_weight > 0 else None
        else:
            node_score = None

        node_scores.append(NodeScoreOut(
            framework_node_id=node.id,
            ref_id=node.ref_id,
            name=node.name,
            score=round(node_score * 100, 1) if node_score is not None else None,
            dimension_scores=dim_scores,
        ))

    # Overall score = weighted average of all node scores (using node.weight)
    weighted_sum = 0.0
    weight_total = 0.0
    for ns in node_scores:
        if ns.score is not None and not ns.not_applicable:
            node = node_map.get(ns.framework_node_id)
            w = node.weight if node else 1
            weighted_sum += ns.score * w
            weight_total += w

    overall = round(weighted_sum / weight_total, 1) if weight_total > 0 else None

    # Completion %
    effective_total = total_assessable - na_count
    completion = round((answered_count / effective_total) * 100, 1) if effective_total > 0 else 0.0

    # Dimension averages
    dim_averages = {}
    for dim_key in dim_sums:
        cnt = dim_counts.get(dim_key, 0)
        dim_averages[dim_key] = round((dim_sums[dim_key] / cnt) * 100, 1) if cnt > 0 else None

    # IG scores
    ig_scores = {}
    # Get all IGs from framework definition
    fw = await s.get(Framework, fw_id)
    ig_def = fw.implementation_groups_definition if fw else None
    if ig_def and isinstance(ig_def, dict):
        for ig_key in ig_def:
            ig_node_scores = []
            for ns in node_scores:
                if ns.not_applicable or ns.score is None:
                    continue
                node = node_map.get(ns.framework_node_id)
                if node and node.implementation_groups:
                    igs = [g.strip() for g in node.implementation_groups.split(",")]
                    if ig_key in igs:
                        ig_node_scores.append(ns.score)
            if ig_node_scores:
                ig_scores[ig_key] = round(sum(ig_node_scores) / len(ig_node_scores), 1)

    # Update assessment cached scores
    assessment.overall_score = Decimal(str(overall)) if overall is not None else None
    assessment.completion_pct = Decimal(str(completion))
    await s.flush()

    return AssessmentScoreOut(
        assessment_id=assessment_id,
        overall_score=overall,
        completion_pct=completion,
        total_assessable=total_assessable,
        answered_count=answered_count,
        na_count=na_count,
        node_scores=node_scores,
        dimension_averages=dim_averages,
        ig_scores=ig_scores,
    )
