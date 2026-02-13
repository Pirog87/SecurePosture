"""
Compliance Assessment module — /api/v1/compliance-assessments
Continuous and snapshot compliance assessment with requirement-level scoring.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.compliance import (
    ComplianceAssessment,
    RequirementAssessment,
    Evidence,
    RequirementAssessmentEvidence,
    ComplianceAssessmentHistory,
    FrameworkMapping,
)
from app.models.framework import Framework, FrameworkNode
from app.schemas.compliance import (
    ComplianceAssessmentCreate,
    ComplianceAssessmentOut,
    ComplianceAssessmentUpdate,
    RequirementAssessmentOut,
    RequirementAssessmentUpdate,
    EvidenceCreate,
    EvidenceOut,
    FrameworkMappingCreate,
    FrameworkMappingOut,
    FrameworkMappingUpdate,
)

router = APIRouter(prefix="/api/v1/compliance-assessments", tags=["Compliance Assessment"])


# ─── Helpers ──────────────────────────────────────────────────


async def _ca_out(s: AsyncSession, ca: ComplianceAssessment) -> ComplianceAssessmentOut:
    fw = await s.get(Framework, ca.framework_id)
    return ComplianceAssessmentOut(
        id=ca.id,
        framework_id=ca.framework_id,
        framework_name=fw.name if fw else None,
        scope_type=ca.scope_type,
        scope_id=ca.scope_id,
        scope_name=ca.scope_name,
        assessment_type=ca.assessment_type,
        scoring_mode=ca.scoring_mode,
        selected_impl_groups=ca.selected_impl_groups,
        status=ca.status,
        name=ca.name,
        description=ca.description,
        compliance_score=ca.compliance_score,
        total_requirements=ca.total_requirements,
        assessed_count=ca.assessed_count,
        compliant_count=ca.compliant_count,
        partially_count=ca.partially_count,
        non_compliant_count=ca.non_compliant_count,
        not_applicable_count=ca.not_applicable_count,
        created_by=ca.created_by,
        created_at=ca.created_at,
        updated_at=ca.updated_at,
    )


async def _ra_out(ra: RequirementAssessment, node: FrameworkNode | None = None, ev_count: int = 0) -> RequirementAssessmentOut:
    return RequirementAssessmentOut(
        id=ra.id,
        compliance_assessment_id=ra.compliance_assessment_id,
        requirement_node_id=ra.requirement_node_id,
        node_ref_id=node.ref_id if node else None,
        node_name=node.name if node else None,
        node_name_pl=node.name_pl if node else None,
        node_depth=node.depth if node else None,
        node_assessable=node.assessable if node else None,
        result=ra.result,
        score=ra.score,
        maturity_level=ra.maturity_level,
        assessor_name=ra.assessor_name,
        assessed_at=ra.assessed_at,
        last_audited_at=ra.last_audited_at,
        last_audited_by=ra.last_audited_by,
        notes=ra.notes,
        justification=ra.justification,
        selected=ra.selected,
        evidence_count=ev_count,
        created_at=ra.created_at,
        updated_at=ra.updated_at,
    )


async def _recalculate_scores(s: AsyncSession, ca_id: int):
    """Recalculate aggregated compliance scores for an assessment."""
    q = select(RequirementAssessment).where(
        RequirementAssessment.compliance_assessment_id == ca_id,
        RequirementAssessment.selected == True,  # noqa: E712
    )
    rows = (await s.execute(q)).scalars().all()

    # Only count assessable nodes
    node_ids = [r.requirement_node_id for r in rows]
    if node_ids:
        aq = select(FrameworkNode.id).where(
            FrameworkNode.id.in_(node_ids),
            FrameworkNode.assessable == True,  # noqa: E712
        )
        assessable_ids = set((await s.execute(aq)).scalars().all())
        rows = [r for r in rows if r.requirement_node_id in assessable_ids]

    total = len(rows)
    assessed = sum(1 for r in rows if r.result != "not_assessed")
    compliant = sum(1 for r in rows if r.result == "compliant")
    partial = sum(1 for r in rows if r.result == "partially_compliant")
    non_compliant = sum(1 for r in rows if r.result == "non_compliant")
    na = sum(1 for r in rows if r.result == "not_applicable")

    assessable_total = total - na
    score = round((compliant + partial * 0.5) / assessable_total * 100, 2) if assessable_total > 0 else None

    ca = await s.get(ComplianceAssessment, ca_id)
    if ca:
        ca.compliance_score = score
        ca.total_requirements = total
        ca.assessed_count = assessed
        ca.compliant_count = compliant
        ca.partially_count = partial
        ca.non_compliant_count = non_compliant
        ca.not_applicable_count = na
        await s.flush()


# ─── CRUD: Compliance Assessments ─────────────────────────────


@router.get("/", response_model=list[ComplianceAssessmentOut])
async def list_compliance_assessments(
    framework_id: int | None = None,
    scope_type: str | None = None,
    status: str | None = None,
    assessment_type: str | None = None,
    s: AsyncSession = Depends(get_session),
):
    q = select(ComplianceAssessment)
    if framework_id:
        q = q.where(ComplianceAssessment.framework_id == framework_id)
    if scope_type:
        q = q.where(ComplianceAssessment.scope_type == scope_type)
    if status:
        q = q.where(ComplianceAssessment.status == status)
    if assessment_type:
        q = q.where(ComplianceAssessment.assessment_type == assessment_type)
    q = q.order_by(ComplianceAssessment.updated_at.desc())
    rows = (await s.execute(q)).scalars().all()
    return [await _ca_out(s, ca) for ca in rows]


@router.get("/{ca_id}", response_model=ComplianceAssessmentOut)
async def get_compliance_assessment(ca_id: int, s: AsyncSession = Depends(get_session)):
    ca = await s.get(ComplianceAssessment, ca_id)
    if not ca:
        raise HTTPException(404, "Compliance assessment not found")
    return await _ca_out(s, ca)


@router.post("/", response_model=ComplianceAssessmentOut, status_code=201)
async def create_compliance_assessment(
    body: ComplianceAssessmentCreate,
    s: AsyncSession = Depends(get_session),
):
    fw = await s.get(Framework, body.framework_id)
    if not fw:
        raise HTTPException(404, "Framework not found")

    ca = ComplianceAssessment(
        framework_id=body.framework_id,
        scope_type=body.scope_type,
        scope_id=body.scope_id,
        scope_name=body.scope_name,
        assessment_type=body.assessment_type,
        scoring_mode=body.scoring_mode or fw.scoring_mode if hasattr(fw, "scoring_mode") else "status",
        selected_impl_groups=body.selected_impl_groups,
        name=body.name or f"{fw.name} — {body.scope_name or body.scope_type}",
        description=body.description,
        status="draft",
    )
    s.add(ca)
    await s.flush()

    # Auto-generate requirement assessments for all assessable nodes
    nq = select(FrameworkNode).where(
        FrameworkNode.framework_id == body.framework_id,
        FrameworkNode.assessable == True,  # noqa: E712
        FrameworkNode.is_active == True,  # noqa: E712
    ).order_by(FrameworkNode.depth, FrameworkNode.order_id)
    nodes = (await s.execute(nq)).scalars().all()

    for node in nodes:
        ra = RequirementAssessment(
            compliance_assessment_id=ca.id,
            requirement_node_id=node.id,
            result="not_assessed",
            selected=True,
        )
        s.add(ra)

    ca.total_requirements = len(nodes)
    await s.commit()
    await s.refresh(ca)
    return await _ca_out(s, ca)


@router.put("/{ca_id}", response_model=ComplianceAssessmentOut)
async def update_compliance_assessment(
    ca_id: int,
    body: ComplianceAssessmentUpdate,
    s: AsyncSession = Depends(get_session),
):
    ca = await s.get(ComplianceAssessment, ca_id)
    if not ca:
        raise HTTPException(404, "Compliance assessment not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ca, k, v)
    await s.commit()
    await s.refresh(ca)
    return await _ca_out(s, ca)


@router.delete("/{ca_id}", status_code=204)
async def delete_compliance_assessment(ca_id: int, s: AsyncSession = Depends(get_session)):
    ca = await s.get(ComplianceAssessment, ca_id)
    if not ca:
        raise HTTPException(404, "Compliance assessment not found")
    await s.delete(ca)
    await s.commit()


# ─── Requirement Assessments (per-requirement) ────────────────


@router.get("/{ca_id}/requirements", response_model=list[RequirementAssessmentOut])
async def list_requirement_assessments(
    ca_id: int,
    result: str | None = None,
    selected_only: bool = True,
    s: AsyncSession = Depends(get_session),
):
    ca = await s.get(ComplianceAssessment, ca_id)
    if not ca:
        raise HTTPException(404, "Compliance assessment not found")

    q = (
        select(RequirementAssessment, FrameworkNode)
        .join(FrameworkNode, RequirementAssessment.requirement_node_id == FrameworkNode.id)
        .where(RequirementAssessment.compliance_assessment_id == ca_id)
    )
    if result:
        q = q.where(RequirementAssessment.result == result)
    if selected_only:
        q = q.where(RequirementAssessment.selected == True)  # noqa: E712
    q = q.order_by(FrameworkNode.depth, FrameworkNode.order_id)

    rows = (await s.execute(q)).all()
    out = []
    for ra, node in rows:
        # Count evidences
        ec = (await s.execute(
            select(func.count()).where(RequirementAssessmentEvidence.requirement_assessment_id == ra.id)
        )).scalar() or 0
        out.append(await _ra_out(ra, node, ec))
    return out


@router.put("/requirements/{ra_id}", response_model=RequirementAssessmentOut)
async def update_requirement_assessment(
    ra_id: int,
    body: RequirementAssessmentUpdate,
    s: AsyncSession = Depends(get_session),
):
    ra = await s.get(RequirementAssessment, ra_id)
    if not ra:
        raise HTTPException(404, "Requirement assessment not found")

    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        old_val = getattr(ra, k)
        if str(old_val) != str(v):
            # Record history
            hist = ComplianceAssessmentHistory(
                requirement_assessment_id=ra.id,
                field_name=k,
                old_value=str(old_val) if old_val is not None else None,
                new_value=str(v) if v is not None else None,
                change_reason="manual",
            )
            s.add(hist)
        setattr(ra, k, v)

    if "result" in changes:
        ra.assessed_at = datetime.utcnow()

    await s.flush()
    await _recalculate_scores(s, ra.compliance_assessment_id)
    await s.commit()
    await s.refresh(ra)

    node = await s.get(FrameworkNode, ra.requirement_node_id)
    ec = (await s.execute(
        select(func.count()).where(RequirementAssessmentEvidence.requirement_assessment_id == ra.id)
    )).scalar() or 0
    return await _ra_out(ra, node, ec)


# ─── Evidence ─────────────────────────────────────────────────


@router.post("/requirements/{ra_id}/evidence", response_model=EvidenceOut, status_code=201)
async def add_evidence(
    ra_id: int,
    body: EvidenceCreate,
    s: AsyncSession = Depends(get_session),
):
    ra = await s.get(RequirementAssessment, ra_id)
    if not ra:
        raise HTTPException(404, "Requirement assessment not found")

    ev = Evidence(
        name=body.name,
        description=body.description,
        evidence_type=body.evidence_type,
        url=body.url,
        valid_from=body.valid_from,
        valid_until=body.valid_until,
    )
    s.add(ev)
    await s.flush()

    link = RequirementAssessmentEvidence(
        requirement_assessment_id=ra_id,
        evidence_id=ev.id,
    )
    s.add(link)
    await s.commit()
    await s.refresh(ev)
    return EvidenceOut.model_validate(ev)


@router.get("/requirements/{ra_id}/evidence", response_model=list[EvidenceOut])
async def list_evidence(ra_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(Evidence)
        .join(RequirementAssessmentEvidence)
        .where(RequirementAssessmentEvidence.requirement_assessment_id == ra_id)
    )
    rows = (await s.execute(q)).scalars().all()
    return [EvidenceOut.model_validate(ev) for ev in rows]


@router.delete("/requirements/{ra_id}/evidence/{ev_id}", status_code=204)
async def remove_evidence(ra_id: int, ev_id: int, s: AsyncSession = Depends(get_session)):
    q = select(RequirementAssessmentEvidence).where(
        RequirementAssessmentEvidence.requirement_assessment_id == ra_id,
        RequirementAssessmentEvidence.evidence_id == ev_id,
    )
    link = (await s.execute(q)).scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Evidence link not found")
    await s.delete(link)
    await s.commit()


# ─── Score endpoint ───────────────────────────────────────────


@router.get("/{ca_id}/score")
async def get_compliance_score(ca_id: int, s: AsyncSession = Depends(get_session)):
    ca = await s.get(ComplianceAssessment, ca_id)
    if not ca:
        raise HTTPException(404, "Compliance assessment not found")
    await _recalculate_scores(s, ca_id)
    await s.commit()
    await s.refresh(ca)
    return {
        "compliance_score": ca.compliance_score,
        "total_requirements": ca.total_requirements,
        "assessed_count": ca.assessed_count,
        "compliant_count": ca.compliant_count,
        "partially_count": ca.partially_count,
        "non_compliant_count": ca.non_compliant_count,
        "not_applicable_count": ca.not_applicable_count,
    }
