"""
Control Effectiveness Assessment — /api/v1/control-effectiveness

Tracks implementation status and operational effectiveness of security controls,
with periodic testing/validation records and metrics for Security Score integration.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.asset import Asset
from app.models.control_effectiveness import ControlImplementation, ControlEffectivenessTest
from app.models.org_unit import OrgUnit
from app.models.security_area import SecurityDomain as SecurityArea
from app.models.smart_catalog import ControlCatalog
from app.schemas.control_effectiveness import (
    EffectivenessMetrics,
    ImplementationCreate,
    ImplementationOut,
    ImplementationUpdate,
    TestCreate,
    TestOut,
)

router = APIRouter(
    prefix="/api/v1/control-effectiveness",
    tags=["Ocena skuteczności zabezpieczeń"],
)


# ── helpers ──

async def _next_ref_id(s: AsyncSession, prefix: str, table) -> str:
    q = select(func.count()).select_from(table)
    count = (await s.execute(q)).scalar() or 0
    return f"{prefix}-{count + 1:04d}"


async def _impl_out(s: AsyncSession, impl: ControlImplementation) -> ImplementationOut:
    ctrl = await s.get(ControlCatalog, impl.control_id)
    org = await s.get(OrgUnit, impl.org_unit_id)
    asset = await s.get(Asset, impl.asset_id) if impl.asset_id else None
    area = await s.get(SecurityArea, impl.security_area_id) if impl.security_area_id else None

    # Load tests
    tests_q = (
        select(ControlEffectivenessTest)
        .where(ControlEffectivenessTest.implementation_id == impl.id)
        .order_by(ControlEffectivenessTest.test_date.desc())
    )
    tests = (await s.execute(tests_q)).scalars().all()

    return ImplementationOut(
        id=impl.id,
        ref_id=impl.ref_id,
        control_id=impl.control_id,
        control_name=ctrl.name if ctrl else None,
        control_ref_id=ctrl.ref_id if ctrl else None,
        org_unit_id=impl.org_unit_id,
        org_unit_name=org.name if org else None,
        asset_id=impl.asset_id,
        asset_name=asset.name if asset else None,
        security_area_id=impl.security_area_id,
        security_area_name=area.name if area else None,
        status=impl.status,
        responsible=impl.responsible,
        implementation_date=impl.implementation_date,
        description=impl.description,
        evidence_url=impl.evidence_url,
        evidence_notes=impl.evidence_notes,
        design_effectiveness=float(impl.design_effectiveness) if impl.design_effectiveness is not None else None,
        operational_effectiveness=float(impl.operational_effectiveness) if impl.operational_effectiveness is not None else None,
        coverage_percent=float(impl.coverage_percent) if impl.coverage_percent is not None else None,
        overall_effectiveness=float(impl.overall_effectiveness) if impl.overall_effectiveness is not None else None,
        test_frequency_days=impl.test_frequency_days,
        last_test_date=impl.last_test_date,
        next_test_date=impl.next_test_date,
        is_active=impl.is_active,
        created_at=impl.created_at,
        updated_at=impl.updated_at,
        tests=[
            TestOut(
                id=t.id,
                ref_id=t.ref_id,
                implementation_id=t.implementation_id,
                test_date=t.test_date,
                test_type=t.test_type,
                tester=t.tester,
                result=t.result,
                design_score=float(t.design_score) if t.design_score is not None else None,
                operational_score=float(t.operational_score) if t.operational_score is not None else None,
                findings=t.findings,
                recommendations=t.recommendations,
                evidence_url=t.evidence_url,
                created_at=t.created_at,
            )
            for t in tests
        ],
    )


# ═══════════════════ IMPLEMENTATIONS — LIST ═══════════════════

@router.get(
    "",
    response_model=list[ImplementationOut],
    summary="Lista wdrożeń zabezpieczeń z filtrami",
)
async def list_implementations(
    control_id: int | None = Query(None),
    org_unit_id: int | None = Query(None),
    asset_id: int | None = Query(None),
    security_area_id: int | None = Query(None),
    status: str | None = Query(None),
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(ControlImplementation)
    if not include_archived:
        q = q.where(ControlImplementation.is_active.is_(True))
    if control_id is not None:
        q = q.where(ControlImplementation.control_id == control_id)
    if org_unit_id is not None:
        q = q.where(ControlImplementation.org_unit_id == org_unit_id)
    if asset_id is not None:
        q = q.where(ControlImplementation.asset_id == asset_id)
    if security_area_id is not None:
        q = q.where(ControlImplementation.security_area_id == security_area_id)
    if status is not None:
        q = q.where(ControlImplementation.status == status)
    q = q.order_by(ControlImplementation.created_at.desc())
    impls = (await s.execute(q)).scalars().all()
    return [await _impl_out(s, i) for i in impls]


# ═══════════════════ IMPLEMENTATIONS — GET ═══════════════════

@router.get(
    "/{impl_id}",
    response_model=ImplementationOut,
    summary="Szczegóły wdrożenia zabezpieczenia",
)
async def get_implementation(impl_id: int, s: AsyncSession = Depends(get_session)):
    impl = await s.get(ControlImplementation, impl_id)
    if not impl:
        raise HTTPException(404, "Wdrożenie nie istnieje")
    return await _impl_out(s, impl)


# ═══════════════════ IMPLEMENTATIONS — CREATE ═══════════════════

@router.post(
    "",
    response_model=ImplementationOut,
    status_code=201,
    summary="Dodaj wdrożenie zabezpieczenia",
)
async def create_implementation(
    body: ImplementationCreate,
    s: AsyncSession = Depends(get_session),
):
    ref_id = await _next_ref_id(s, "CEF", ControlImplementation)
    data = body.model_dump()
    impl = ControlImplementation(ref_id=ref_id, **data)
    impl.recompute_overall()
    s.add(impl)
    await s.commit()
    await s.refresh(impl)
    return await _impl_out(s, impl)


# ═══════════════════ IMPLEMENTATIONS — UPDATE ═══════════════════

@router.put(
    "/{impl_id}",
    response_model=ImplementationOut,
    summary="Edytuj wdrożenie zabezpieczenia",
)
async def update_implementation(
    impl_id: int,
    body: ImplementationUpdate,
    s: AsyncSession = Depends(get_session),
):
    impl = await s.get(ControlImplementation, impl_id)
    if not impl:
        raise HTTPException(404, "Wdrożenie nie istnieje")

    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(impl, k, v)

    impl.recompute_overall()
    await s.commit()
    await s.refresh(impl)
    return await _impl_out(s, impl)


# ═══════════════════ IMPLEMENTATIONS — SOFT DELETE ═══════════════════

@router.delete("/{impl_id}", summary="Dezaktywuj wdrożenie (soft delete)")
async def deactivate_implementation(impl_id: int, s: AsyncSession = Depends(get_session)):
    impl = await s.get(ControlImplementation, impl_id)
    if not impl:
        raise HTTPException(404, "Wdrożenie nie istnieje")
    impl.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": impl_id}


# ═══════════════════ TESTS — LIST ═══════════════════

@router.get(
    "/{impl_id}/tests",
    response_model=list[TestOut],
    summary="Lista testów skuteczności dla wdrożenia",
)
async def list_tests(impl_id: int, s: AsyncSession = Depends(get_session)):
    impl = await s.get(ControlImplementation, impl_id)
    if not impl:
        raise HTTPException(404, "Wdrożenie nie istnieje")
    q = (
        select(ControlEffectivenessTest)
        .where(ControlEffectivenessTest.implementation_id == impl_id)
        .order_by(ControlEffectivenessTest.test_date.desc())
    )
    tests = (await s.execute(q)).scalars().all()
    return [
        TestOut(
            id=t.id,
            ref_id=t.ref_id,
            implementation_id=t.implementation_id,
            test_date=t.test_date,
            test_type=t.test_type,
            tester=t.tester,
            result=t.result,
            design_score=float(t.design_score) if t.design_score is not None else None,
            operational_score=float(t.operational_score) if t.operational_score is not None else None,
            findings=t.findings,
            recommendations=t.recommendations,
            evidence_url=t.evidence_url,
            created_at=t.created_at,
        )
        for t in tests
    ]


# ═══════════════════ TESTS — CREATE ═══════════════════

@router.post(
    "/{impl_id}/tests",
    response_model=TestOut,
    status_code=201,
    summary="Dodaj test skuteczności",
)
async def create_test(
    impl_id: int,
    body: TestCreate,
    s: AsyncSession = Depends(get_session),
):
    impl = await s.get(ControlImplementation, impl_id)
    if not impl:
        raise HTTPException(404, "Wdrożenie nie istnieje")

    ref_id = await _next_ref_id(s, "CET", ControlEffectivenessTest)
    test = ControlEffectivenessTest(
        ref_id=ref_id,
        implementation_id=impl_id,
        **body.model_dump(),
    )
    s.add(test)

    # Update implementation scores from test results
    if body.design_score is not None:
        impl.design_effectiveness = body.design_score
    if body.operational_score is not None:
        impl.operational_effectiveness = body.operational_score
    impl.last_test_date = body.test_date
    if impl.test_frequency_days:
        impl.next_test_date = body.test_date + timedelta(days=impl.test_frequency_days)
    impl.recompute_overall()

    await s.commit()
    await s.refresh(test)

    return TestOut(
        id=test.id,
        ref_id=test.ref_id,
        implementation_id=test.implementation_id,
        test_date=test.test_date,
        test_type=test.test_type,
        tester=test.tester,
        result=test.result,
        design_score=float(test.design_score) if test.design_score is not None else None,
        operational_score=float(test.operational_score) if test.operational_score is not None else None,
        findings=test.findings,
        recommendations=test.recommendations,
        evidence_url=test.evidence_url,
        created_at=test.created_at,
    )


# ═══════════════════ METRICS ═══════════════════

@router.get(
    "/metrics/summary",
    response_model=EffectivenessMetrics,
    summary="Metryki skuteczności zabezpieczeń (do Security Score)",
)
async def get_metrics(
    org_unit_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    # Total controls in catalog
    catalog_q = select(func.count()).select_from(ControlCatalog).where(ControlCatalog.is_active.is_(True))
    total_catalog = (await s.execute(catalog_q)).scalar() or 0

    # Implementations
    impl_q = select(ControlImplementation).where(ControlImplementation.is_active.is_(True))
    if org_unit_id is not None:
        impl_q = impl_q.where(ControlImplementation.org_unit_id == org_unit_id)
    impls = (await s.execute(impl_q)).scalars().all()

    total_impl = len(impls)
    implemented = sum(1 for i in impls if i.status == "implemented")
    partial = sum(1 for i in impls if i.status == "partial")
    planned = sum(1 for i in impls if i.status in ("planned", "in_progress"))
    na = sum(1 for i in impls if i.status == "not_applicable")

    # Average effectiveness scores (only for implemented/partial)
    active_impls = [i for i in impls if i.status in ("implemented", "partial")]
    design_scores = [float(i.design_effectiveness) for i in active_impls if i.design_effectiveness is not None]
    op_scores = [float(i.operational_effectiveness) for i in active_impls if i.operational_effectiveness is not None]
    overall_scores = [float(i.overall_effectiveness) for i in active_impls if i.overall_effectiveness is not None]
    coverage_scores = [float(i.coverage_percent) for i in active_impls if i.coverage_percent is not None]

    avg_design = (sum(design_scores) / len(design_scores)) if design_scores else None
    avg_op = (sum(op_scores) / len(op_scores)) if op_scores else None
    avg_overall = (sum(overall_scores) / len(overall_scores)) if overall_scores else None
    avg_coverage = (sum(coverage_scores) / len(coverage_scores)) if coverage_scores else None

    # Tests in last 90 days
    cutoff_90 = date.today() - timedelta(days=90)
    if org_unit_id is not None:
        tests_q = (
            select(func.count())
            .select_from(ControlEffectivenessTest)
            .join(ControlImplementation)
            .where(
                ControlEffectivenessTest.test_date >= cutoff_90,
                ControlImplementation.org_unit_id == org_unit_id,
                ControlImplementation.is_active.is_(True),
            )
        )
    else:
        tests_q = (
            select(func.count())
            .select_from(ControlEffectivenessTest)
            .join(ControlImplementation)
            .where(
                ControlEffectivenessTest.test_date >= cutoff_90,
                ControlImplementation.is_active.is_(True),
            )
        )
    tests_90d = (await s.execute(tests_q)).scalar() or 0

    # Overdue tests
    overdue = sum(
        1 for i in active_impls
        if i.next_test_date and i.next_test_date < date.today()
    )

    # Positive test rate (last 90 days)
    if org_unit_id is not None:
        recent_tests_q = (
            select(ControlEffectivenessTest)
            .join(ControlImplementation)
            .where(
                ControlEffectivenessTest.test_date >= cutoff_90,
                ControlImplementation.org_unit_id == org_unit_id,
                ControlImplementation.is_active.is_(True),
            )
        )
    else:
        recent_tests_q = (
            select(ControlEffectivenessTest)
            .join(ControlImplementation)
            .where(
                ControlEffectivenessTest.test_date >= cutoff_90,
                ControlImplementation.is_active.is_(True),
            )
        )
    recent_tests = (await s.execute(recent_tests_q)).scalars().all()
    positive_rate = None
    if recent_tests:
        pos = sum(1 for t in recent_tests if t.result == "positive")
        positive_rate = round(pos / len(recent_tests) * 100, 1)

    # Recommended safeguard_rating based on avg_overall
    recommended_z = None
    if avg_overall is not None:
        if avg_overall >= 85:
            recommended_z = 0.95
        elif avg_overall >= 60:
            recommended_z = 0.70
        elif avg_overall >= 30:
            recommended_z = 0.25
        else:
            recommended_z = 0.10

    return EffectivenessMetrics(
        total_controls_in_catalog=total_catalog,
        total_implementations=total_impl,
        implemented_count=implemented,
        partial_count=partial,
        planned_count=planned,
        not_applicable_count=na,
        avg_design_effectiveness=round(avg_design, 1) if avg_design is not None else None,
        avg_operational_effectiveness=round(avg_op, 1) if avg_op is not None else None,
        avg_overall_effectiveness=round(avg_overall, 1) if avg_overall is not None else None,
        avg_coverage=round(avg_coverage, 1) if avg_coverage is not None else None,
        tests_last_90_days=tests_90d,
        overdue_tests=overdue,
        positive_test_rate=positive_rate,
        recommended_safeguard_rating=recommended_z,
    )


# ═══════════════════ PER-CONTROL EFFECTIVENESS ═══════════════════

@router.get(
    "/by-control/{control_id}",
    response_model=list[ImplementationOut],
    summary="Wszystkie wdrożenia danego zabezpieczenia",
)
async def implementations_by_control(
    control_id: int,
    s: AsyncSession = Depends(get_session),
):
    q = (
        select(ControlImplementation)
        .where(
            ControlImplementation.control_id == control_id,
            ControlImplementation.is_active.is_(True),
        )
        .order_by(ControlImplementation.org_unit_id)
    )
    impls = (await s.execute(q)).scalars().all()
    return [await _impl_out(s, i) for i in impls]


# ═══════════════════ SAFEGUARD RATING RECOMMENDATION ═══════════════════

@router.get(
    "/safeguard-rating/{risk_id}",
    summary="Rekomendacja Z (safeguard_rating) na podstawie oceny wdrożonych zabezpieczeń",
)
async def recommend_safeguard_rating(
    risk_id: int,
    s: AsyncSession = Depends(get_session),
):
    """Calculate recommended safeguard_rating (Z) for a risk based on
    the effectiveness of controls linked to it via risk_safeguards."""
    from app.models.risk import Risk, RiskSafeguard

    risk = await s.get(Risk, risk_id)
    if not risk:
        raise HTTPException(404, "Ryzyko nie istnieje")

    # Get safeguard IDs linked to this risk
    sg_q = select(RiskSafeguard.safeguard_id).where(RiskSafeguard.risk_id == risk_id)
    safeguard_ids = [row[0] for row in (await s.execute(sg_q)).all()]

    if not safeguard_ids:
        return {
            "risk_id": risk_id,
            "linked_controls": 0,
            "implementations_found": 0,
            "avg_effectiveness": None,
            "recommended_z": 0.10,
            "current_z": float(risk.safeguard_rating),
            "details": [],
        }

    # Find implementations for those controls
    impl_q = (
        select(ControlImplementation)
        .where(
            ControlImplementation.control_id.in_(safeguard_ids),
            ControlImplementation.is_active.is_(True),
            ControlImplementation.status.in_(["implemented", "partial"]),
        )
    )
    impls = (await s.execute(impl_q)).scalars().all()

    details = []
    scores = []
    for i in impls:
        ctrl = await s.get(ControlCatalog, i.control_id)
        eff = float(i.overall_effectiveness) if i.overall_effectiveness is not None else None
        if eff is not None:
            scores.append(eff)
        details.append({
            "control_id": i.control_id,
            "control_name": ctrl.name if ctrl else None,
            "status": i.status,
            "overall_effectiveness": eff,
            "last_test_date": str(i.last_test_date) if i.last_test_date else None,
        })

    avg_eff = (sum(scores) / len(scores)) if scores else None
    if avg_eff is not None:
        if avg_eff >= 85:
            rec_z = 0.95
        elif avg_eff >= 60:
            rec_z = 0.70
        elif avg_eff >= 30:
            rec_z = 0.25
        else:
            rec_z = 0.10
    else:
        rec_z = 0.10

    return {
        "risk_id": risk_id,
        "linked_controls": len(safeguard_ids),
        "implementations_found": len(impls),
        "avg_effectiveness": round(avg_eff, 1) if avg_eff is not None else None,
        "recommended_z": rec_z,
        "current_z": float(risk.safeguard_rating),
        "details": details,
    }
