"""
Audit Workflow module — /api/v1/audit-programs, /api/v1/audit-engagements
Formal audit lifecycle: program → engagement → tests → findings → report.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.compliance import (
    AuditProgram,
    AuditEngagement,
    AuditEngagementAuditor,
    AuditEngagementScope,
    AuditTest,
    ComplianceAuditFinding,
    AuditReport,
)
from app.models.framework import Framework, FrameworkNode
from app.schemas.compliance import (
    AuditProgramCreate,
    AuditProgramOut,
    AuditProgramUpdate,
    AuditEngagementCreate,
    AuditEngagementOut,
    AuditEngagementUpdate,
    EngagementTransition,
    AuditTestCreate,
    AuditTestOut,
    AuditTestUpdate,
    ComplianceFindingCreate,
    ComplianceFindingOut,
    ComplianceFindingUpdate,
    AuditReportOut,
    AuditReportUpsert,
)

router = APIRouter(tags=["Audit Workflow"])


# ─── Helpers ──────────────────────────────────────────────────


def _next_ref(prefix: str, count: int) -> str:
    return f"{prefix}-{count + 1:03d}"


async def _engagement_out(s: AsyncSession, e: AuditEngagement) -> AuditEngagementOut:
    fw = await s.get(Framework, e.framework_id)
    prog = await s.get(AuditProgram, e.audit_program_id) if e.audit_program_id else None

    tc = (await s.execute(
        select(func.count()).where(AuditTest.audit_engagement_id == e.id)
    )).scalar() or 0
    fc = (await s.execute(
        select(func.count()).where(ComplianceAuditFinding.audit_engagement_id == e.id)
    )).scalar() or 0

    return AuditEngagementOut(
        id=e.id,
        audit_program_id=e.audit_program_id,
        program_name=prog.name if prog else None,
        ref_id=e.ref_id,
        name=e.name,
        framework_id=e.framework_id,
        framework_name=fw.name if fw else None,
        compliance_assessment_id=e.compliance_assessment_id,
        scope_type=e.scope_type,
        scope_id=e.scope_id,
        scope_name=e.scope_name,
        objective=e.objective,
        methodology=e.methodology,
        criteria=e.criteria,
        planned_quarter=e.planned_quarter,
        planned_start=e.planned_start,
        planned_end=e.planned_end,
        actual_start=e.actual_start,
        actual_end=e.actual_end,
        lead_auditor=e.lead_auditor,
        supervisor=e.supervisor,
        status=e.status,
        status_changed_at=e.status_changed_at,
        priority=e.priority,
        tests_count=tc,
        findings_count=fc,
        created_by=e.created_by,
        created_at=e.created_at,
        updated_at=e.updated_at,
    )


# ═══════════════════════════════════════════════════════════════
#  AUDIT PROGRAMS
# ═══════════════════════════════════════════════════════════════

programs = APIRouter(prefix="/api/v1/audit-programs", tags=["Audit Programs"])


@programs.get("/", response_model=list[AuditProgramOut])
async def list_programs(
    year: int | None = None,
    status: str | None = None,
    s: AsyncSession = Depends(get_session),
):
    q = select(AuditProgram)
    if year:
        q = q.where(AuditProgram.year == year)
    if status:
        q = q.where(AuditProgram.status == status)
    q = q.order_by(AuditProgram.year.desc(), AuditProgram.name)
    rows = (await s.execute(q)).scalars().all()
    out = []
    for p in rows:
        ec = (await s.execute(
            select(func.count()).where(AuditEngagement.audit_program_id == p.id)
        )).scalar() or 0
        out.append(AuditProgramOut(
            id=p.id, name=p.name, year=p.year, description=p.description,
            status=p.status, prepared_by=p.prepared_by, approved_by=p.approved_by,
            approved_at=p.approved_at, org_unit_id=p.org_unit_id,
            engagement_count=ec, created_at=p.created_at, updated_at=p.updated_at,
        ))
    return out


@programs.get("/{prog_id}", response_model=AuditProgramOut)
async def get_program(prog_id: int, s: AsyncSession = Depends(get_session)):
    p = await s.get(AuditProgram, prog_id)
    if not p:
        raise HTTPException(404, "Audit program not found")
    ec = (await s.execute(
        select(func.count()).where(AuditEngagement.audit_program_id == p.id)
    )).scalar() or 0
    return AuditProgramOut(
        id=p.id, name=p.name, year=p.year, description=p.description,
        status=p.status, prepared_by=p.prepared_by, approved_by=p.approved_by,
        approved_at=p.approved_at, org_unit_id=p.org_unit_id,
        engagement_count=ec, created_at=p.created_at, updated_at=p.updated_at,
    )


@programs.post("/", response_model=AuditProgramOut, status_code=201)
async def create_program(body: AuditProgramCreate, s: AsyncSession = Depends(get_session)):
    p = AuditProgram(**body.model_dump())
    s.add(p)
    await s.commit()
    await s.refresh(p)
    return AuditProgramOut(
        id=p.id, name=p.name, year=p.year, description=p.description,
        status=p.status, prepared_by=p.prepared_by, approved_by=p.approved_by,
        approved_at=p.approved_at, org_unit_id=p.org_unit_id,
        engagement_count=0, created_at=p.created_at, updated_at=p.updated_at,
    )


@programs.put("/{prog_id}", response_model=AuditProgramOut)
async def update_program(prog_id: int, body: AuditProgramUpdate, s: AsyncSession = Depends(get_session)):
    p = await s.get(AuditProgram, prog_id)
    if not p:
        raise HTTPException(404, "Audit program not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await s.commit()
    await s.refresh(p)
    ec = (await s.execute(
        select(func.count()).where(AuditEngagement.audit_program_id == p.id)
    )).scalar() or 0
    return AuditProgramOut(
        id=p.id, name=p.name, year=p.year, description=p.description,
        status=p.status, prepared_by=p.prepared_by, approved_by=p.approved_by,
        approved_at=p.approved_at, org_unit_id=p.org_unit_id,
        engagement_count=ec, created_at=p.created_at, updated_at=p.updated_at,
    )


@programs.post("/{prog_id}/approve")
async def approve_program(prog_id: int, approved_by: str = Query(...), s: AsyncSession = Depends(get_session)):
    p = await s.get(AuditProgram, prog_id)
    if not p:
        raise HTTPException(404, "Audit program not found")
    p.status = "approved"
    p.approved_by = approved_by
    p.approved_at = datetime.utcnow()
    await s.commit()
    return {"status": "approved"}


# ═══════════════════════════════════════════════════════════════
#  AUDIT ENGAGEMENTS
# ═══════════════════════════════════════════════════════════════

engagements = APIRouter(prefix="/api/v1/audit-engagements", tags=["Audit Engagements"])


@engagements.get("/", response_model=list[AuditEngagementOut])
async def list_engagements(
    program_id: int | None = None,
    framework_id: int | None = None,
    status: str | None = None,
    s: AsyncSession = Depends(get_session),
):
    q = select(AuditEngagement)
    if program_id:
        q = q.where(AuditEngagement.audit_program_id == program_id)
    if framework_id:
        q = q.where(AuditEngagement.framework_id == framework_id)
    if status:
        q = q.where(AuditEngagement.status == status)
    q = q.order_by(AuditEngagement.created_at.desc())
    rows = (await s.execute(q)).scalars().all()
    return [await _engagement_out(s, e) for e in rows]


@engagements.get("/{eng_id}", response_model=AuditEngagementOut)
async def get_engagement(eng_id: int, s: AsyncSession = Depends(get_session)):
    e = await s.get(AuditEngagement, eng_id)
    if not e:
        raise HTTPException(404, "Audit engagement not found")
    return await _engagement_out(s, e)


@engagements.post("/", response_model=AuditEngagementOut, status_code=201)
async def create_engagement(body: AuditEngagementCreate, s: AsyncSession = Depends(get_session)):
    fw = await s.get(Framework, body.framework_id)
    if not fw:
        raise HTTPException(404, "Framework not found")

    # Auto-generate ref_id
    cnt = (await s.execute(select(func.count()).select_from(AuditEngagement))).scalar() or 0
    ref_id = _next_ref("AE", cnt)

    e = AuditEngagement(
        ref_id=ref_id,
        **body.model_dump(),
    )
    s.add(e)
    await s.commit()
    await s.refresh(e)
    return await _engagement_out(s, e)


@engagements.put("/{eng_id}", response_model=AuditEngagementOut)
async def update_engagement(eng_id: int, body: AuditEngagementUpdate, s: AsyncSession = Depends(get_session)):
    e = await s.get(AuditEngagement, eng_id)
    if not e:
        raise HTTPException(404, "Audit engagement not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    await s.commit()
    await s.refresh(e)
    return await _engagement_out(s, e)


@engagements.post("/{eng_id}/transition")
async def transition_engagement(eng_id: int, body: EngagementTransition, s: AsyncSession = Depends(get_session)):
    e = await s.get(AuditEngagement, eng_id)
    if not e:
        raise HTTPException(404, "Audit engagement not found")
    if not e.can_transition_to(body.target_status):
        raise HTTPException(
            400,
            f"Cannot transition from '{e.status}' to '{body.target_status}'. "
            f"Allowed: {AuditEngagement.TRANSITIONS.get(e.status, [])}",
        )
    e.status = body.target_status
    e.status_changed_at = datetime.utcnow()
    if body.target_status == "fieldwork" and not e.actual_start:
        e.actual_start = datetime.utcnow().date()
    if body.target_status in ("completed", "closed") and not e.actual_end:
        e.actual_end = datetime.utcnow().date()
    await s.commit()
    return {"status": e.status}


# ─── Tests within Engagement ──────────────────────────────────


@engagements.get("/{eng_id}/tests", response_model=list[AuditTestOut])
async def list_tests(eng_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(AuditTest, FrameworkNode)
        .outerjoin(FrameworkNode, AuditTest.requirement_node_id == FrameworkNode.id)
        .where(AuditTest.audit_engagement_id == eng_id)
        .order_by(AuditTest.ref_id)
    )
    rows = (await s.execute(q)).all()
    return [
        AuditTestOut(
            id=t.id,
            audit_engagement_id=t.audit_engagement_id,
            test_template_id=t.test_template_id,
            requirement_node_id=t.requirement_node_id,
            node_ref_id=n.ref_id if n else None,
            node_name=n.name if n else None,
            ref_id=t.ref_id,
            name=t.name,
            description=t.description,
            test_steps=t.test_steps,
            expected_result=t.expected_result,
            test_type=t.test_type,
            actual_result=t.actual_result,
            test_result=t.test_result,
            auditor_name=t.auditor_name,
            tested_at=t.tested_at,
            workpaper_ref=t.workpaper_ref,
            sample_size=t.sample_size,
            exceptions_count=t.exceptions_count,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t, n in rows
    ]


@engagements.post("/{eng_id}/tests", response_model=AuditTestOut, status_code=201)
async def create_test(eng_id: int, body: AuditTestCreate, s: AsyncSession = Depends(get_session)):
    e = await s.get(AuditEngagement, eng_id)
    if not e:
        raise HTTPException(404, "Engagement not found")

    cnt = (await s.execute(
        select(func.count()).where(AuditTest.audit_engagement_id == eng_id)
    )).scalar() or 0
    ref_id = f"T-{cnt + 1:03d}"

    t = AuditTest(audit_engagement_id=eng_id, ref_id=ref_id, **body.model_dump())
    s.add(t)
    await s.commit()
    await s.refresh(t)
    node = await s.get(FrameworkNode, t.requirement_node_id) if t.requirement_node_id else None
    return AuditTestOut(
        id=t.id, audit_engagement_id=t.audit_engagement_id,
        test_template_id=t.test_template_id, requirement_node_id=t.requirement_node_id,
        node_ref_id=node.ref_id if node else None, node_name=node.name if node else None,
        ref_id=t.ref_id, name=t.name, description=t.description,
        test_steps=t.test_steps, expected_result=t.expected_result,
        test_type=t.test_type, actual_result=t.actual_result,
        test_result=t.test_result, auditor_name=t.auditor_name,
        tested_at=t.tested_at, workpaper_ref=t.workpaper_ref,
        sample_size=t.sample_size, exceptions_count=t.exceptions_count,
        created_at=t.created_at, updated_at=t.updated_at,
    )


@engagements.put("/tests/{test_id}", response_model=AuditTestOut)
async def update_test(test_id: int, body: AuditTestUpdate, s: AsyncSession = Depends(get_session)):
    t = await s.get(AuditTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    if body.test_result and body.test_result != "not_tested" and not t.tested_at:
        t.tested_at = datetime.utcnow()
    await s.commit()
    await s.refresh(t)
    node = await s.get(FrameworkNode, t.requirement_node_id) if t.requirement_node_id else None
    return AuditTestOut(
        id=t.id, audit_engagement_id=t.audit_engagement_id,
        test_template_id=t.test_template_id, requirement_node_id=t.requirement_node_id,
        node_ref_id=node.ref_id if node else None, node_name=node.name if node else None,
        ref_id=t.ref_id, name=t.name, description=t.description,
        test_steps=t.test_steps, expected_result=t.expected_result,
        test_type=t.test_type, actual_result=t.actual_result,
        test_result=t.test_result, auditor_name=t.auditor_name,
        tested_at=t.tested_at, workpaper_ref=t.workpaper_ref,
        sample_size=t.sample_size, exceptions_count=t.exceptions_count,
        created_at=t.created_at, updated_at=t.updated_at,
    )


@engagements.delete("/tests/{test_id}", status_code=204)
async def delete_test(test_id: int, s: AsyncSession = Depends(get_session)):
    t = await s.get(AuditTest, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    await s.delete(t)
    await s.commit()


# ─── Findings within Engagement ───────────────────────────────


@engagements.get("/{eng_id}/findings", response_model=list[ComplianceFindingOut])
async def list_findings(eng_id: int, s: AsyncSession = Depends(get_session)):
    q = select(ComplianceAuditFinding).where(
        ComplianceAuditFinding.audit_engagement_id == eng_id,
    ).order_by(ComplianceAuditFinding.ref_id)
    rows = (await s.execute(q)).scalars().all()
    return [ComplianceFindingOut.model_validate(f) for f in rows]


@engagements.post("/{eng_id}/findings", response_model=ComplianceFindingOut, status_code=201)
async def create_finding(eng_id: int, body: ComplianceFindingCreate, s: AsyncSession = Depends(get_session)):
    e = await s.get(AuditEngagement, eng_id)
    if not e:
        raise HTTPException(404, "Engagement not found")

    cnt = (await s.execute(
        select(func.count()).where(ComplianceAuditFinding.audit_engagement_id == eng_id)
    )).scalar() or 0
    ref_id = f"F-{cnt + 1:03d}"

    f = ComplianceAuditFinding(
        audit_engagement_id=eng_id,
        ref_id=ref_id,
        **body.model_dump(),
    )
    s.add(f)
    await s.commit()
    await s.refresh(f)
    return ComplianceFindingOut.model_validate(f)


@engagements.put("/findings/{finding_id}", response_model=ComplianceFindingOut)
async def update_finding(finding_id: int, body: ComplianceFindingUpdate, s: AsyncSession = Depends(get_session)):
    f = await s.get(ComplianceAuditFinding, finding_id)
    if not f:
        raise HTTPException(404, "Finding not found")
    changes = body.model_dump(exclude_unset=True)
    if "status" in changes and changes["status"] != f.status:
        f.status_changed_at = datetime.utcnow()
    if "management_response" in changes and not f.management_response_at:
        f.management_response_at = datetime.utcnow()
    if "verified_by" in changes:
        f.verified_at = datetime.utcnow()
    for k, v in changes.items():
        setattr(f, k, v)
    await s.commit()
    await s.refresh(f)
    return ComplianceFindingOut.model_validate(f)


# ─── Report within Engagement ─────────────────────────────────


@engagements.get("/{eng_id}/report", response_model=AuditReportOut | None)
async def get_report(eng_id: int, s: AsyncSession = Depends(get_session)):
    q = select(AuditReport).where(AuditReport.audit_engagement_id == eng_id)
    r = (await s.execute(q)).scalar_one_or_none()
    if not r:
        return None
    return AuditReportOut.model_validate(r)


@engagements.post("/{eng_id}/report", response_model=AuditReportOut)
async def upsert_report(eng_id: int, body: AuditReportUpsert, s: AsyncSession = Depends(get_session)):
    e = await s.get(AuditEngagement, eng_id)
    if not e:
        raise HTTPException(404, "Engagement not found")

    q = select(AuditReport).where(AuditReport.audit_engagement_id == eng_id)
    r = (await s.execute(q)).scalar_one_or_none()
    if r:
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(r, k, v)
        r.version += 1
    else:
        r = AuditReport(audit_engagement_id=eng_id, **body.model_dump(exclude_unset=True))
        r.prepared_at = datetime.utcnow()
        s.add(r)
    await s.commit()
    await s.refresh(r)
    return AuditReportOut.model_validate(r)


# ═══════════════════════════════════════════════════════════════
#  GLOBAL FINDINGS LIST — /api/v1/audit-findings
# ═══════════════════════════════════════════════════════════════

findings_router = APIRouter(prefix="/api/v1/audit-findings", tags=["Audit Findings"])


@findings_router.get("/", response_model=list[ComplianceFindingOut])
async def list_all_findings(
    severity: str | None = None,
    status: str | None = None,
    s: AsyncSession = Depends(get_session),
):
    """List all audit findings across all engagements."""
    q = select(ComplianceAuditFinding).order_by(
        ComplianceAuditFinding.created_at.desc(),
    )
    if severity:
        q = q.where(ComplianceAuditFinding.severity == severity)
    if status:
        q = q.where(ComplianceAuditFinding.status == status)
    rows = (await s.execute(q)).scalars().all()
    return [ComplianceFindingOut.model_validate(f) for f in rows]
