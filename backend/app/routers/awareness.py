"""
Security Awareness module — /api/v1/awareness-campaigns, /api/v1/awareness-employee-reports
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.awareness import AwarenessCampaign, AwarenessResult, AwarenessEmployeeReport
from app.models.dictionary import DictionaryEntry, DictionaryType
from app.models.org_unit import OrgUnit
from app.schemas.awareness import (
    AwarenessResultCreate, AwarenessResultOut,
    CampaignCreate, CampaignOut, CampaignStatusChange, CampaignUpdate,
    EmployeeReportCreate, EmployeeReportOut,
)

router = APIRouter(tags=["Security Awareness"])


async def _de_label(s: AsyncSession, entry_id: int | None) -> str | None:
    if entry_id is None:
        return None
    e = await s.get(DictionaryEntry, entry_id)
    return e.label if e else None


async def _campaign_out(s: AsyncSession, c: AwarenessCampaign) -> CampaignOut:
    org = await s.get(OrgUnit, c.org_unit_id) if c.org_unit_id else None
    return CampaignOut(
        id=c.id, ref_id=c.ref_id, title=c.title, description=c.description,
        campaign_type_id=c.campaign_type_id,
        campaign_type_name=await _de_label(s, c.campaign_type_id),
        org_unit_id=c.org_unit_id, org_unit_name=org.name if org else None,
        target_audience_count=c.target_audience_count,
        start_date=c.start_date, end_date=c.end_date,
        status_id=c.status_id, status_name=await _de_label(s, c.status_id),
        owner=c.owner, content_url=c.content_url,
        is_active=c.is_active, created_at=c.created_at, updated_at=c.updated_at,
    )


async def _result_out(s: AsyncSession, r: AwarenessResult) -> AwarenessResultOut:
    org = await s.get(OrgUnit, r.org_unit_id) if r.org_unit_id else None
    return AwarenessResultOut(
        id=r.id, campaign_id=r.campaign_id,
        org_unit_id=r.org_unit_id, org_unit_name=org.name if org else None,
        participants_count=r.participants_count,
        completed_count=r.completed_count,
        failed_count=r.failed_count,
        reported_count=r.reported_count,
        avg_score=float(r.avg_score) if r.avg_score is not None else None,
        completion_rate=float(r.completion_rate) if r.completion_rate is not None else None,
        click_rate=float(r.click_rate) if r.click_rate is not None else None,
        report_rate=float(r.report_rate) if r.report_rate is not None else None,
        recorded_at=r.recorded_at,
        created_at=r.created_at, updated_at=r.updated_at,
    )


async def _report_out(s: AsyncSession, r: AwarenessEmployeeReport) -> EmployeeReportOut:
    org = await s.get(OrgUnit, r.org_unit_id) if r.org_unit_id else None
    conf_rate = None
    if r.reports_count and r.reports_count > 0:
        conf_rate = round(r.confirmed_count / r.reports_count * 100, 1)
    return EmployeeReportOut(
        id=r.id, month=r.month,
        org_unit_id=r.org_unit_id, org_unit_name=org.name if org else None,
        reports_count=r.reports_count, confirmed_count=r.confirmed_count,
        confirmation_rate=conf_rate,
        recorded_at=r.recorded_at,
        created_at=r.created_at, updated_at=r.updated_at,
    )


# Helper to get campaign type label for scoring
async def _get_type_label(s: AsyncSession, type_id: int | None) -> str | None:
    if type_id is None:
        return None
    e = await s.get(DictionaryEntry, type_id)
    return e.label if e else None


# ═══════════════════ METRICS ═══════════════════

@router.get("/api/v1/awareness/metrics", summary="Metryki awareness dla Security Score")
async def awareness_metrics(s: AsyncSession = Depends(get_session)):
    one_year_ago = date.today() - timedelta(days=365)
    q = select(AwarenessCampaign).where(
        AwarenessCampaign.is_active.is_(True),
        AwarenessCampaign.start_date >= one_year_ago,
    )
    campaigns = (await s.execute(q)).scalars().all()

    training_rates = []
    phishing_click_rates = []
    phishing_report_rates = []

    for c in campaigns:
        type_label = await _get_type_label(s, c.campaign_type_id)
        results_q = select(AwarenessResult).where(AwarenessResult.campaign_id == c.id)
        results = (await s.execute(results_q)).scalars().all()

        if not results:
            continue

        if type_label in ("Szkolenie online", "Szkolenie stacjonarne"):
            rates = [float(r.completion_rate) for r in results if r.completion_rate is not None]
            if rates:
                training_rates.append(sum(rates) / len(rates))

        elif type_label == "Phishing simulation":
            clicks = [float(r.click_rate) for r in results if r.click_rate is not None]
            reports = [float(r.report_rate) for r in results if r.report_rate is not None]
            if clicks:
                phishing_click_rates.append(sum(clicks) / len(clicks))
            if reports:
                phishing_report_rates.append(sum(reports) / len(reports))

    training_score = (sum(training_rates) / len(training_rates)) if training_rates else 0
    avg_click = (sum(phishing_click_rates) / len(phishing_click_rates)) if phishing_click_rates else 0
    phishing_score = max(0, 100 - avg_click * 2)
    avg_report = (sum(phishing_report_rates) / len(phishing_report_rates)) if phishing_report_rates else 0
    reporting_score = min(100, avg_report * 3)

    awareness_score = training_score * 0.4 + phishing_score * 0.4 + reporting_score * 0.2

    return {
        "training_score": round(training_score, 1),
        "phishing_score": round(phishing_score, 1),
        "reporting_score": round(reporting_score, 1),
        "awareness_score": round(awareness_score, 1),
        "campaigns_count": len(campaigns),
    }


# ═══════════════════ CAMPAIGNS ═══════════════════

@router.get("/api/v1/awareness-campaigns", response_model=list[CampaignOut], summary="Lista kampanii")
async def list_campaigns(
    campaign_type_id: int | None = Query(None),
    status_id: int | None = Query(None),
    org_unit_id: int | None = Query(None),
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(AwarenessCampaign)
    if not include_archived:
        q = q.where(AwarenessCampaign.is_active.is_(True))
    if campaign_type_id is not None:
        q = q.where(AwarenessCampaign.campaign_type_id == campaign_type_id)
    if status_id is not None:
        q = q.where(AwarenessCampaign.status_id == status_id)
    if org_unit_id is not None:
        q = q.where(AwarenessCampaign.org_unit_id == org_unit_id)
    q = q.order_by(AwarenessCampaign.start_date.desc())
    campaigns = (await s.execute(q)).scalars().all()
    return [await _campaign_out(s, c) for c in campaigns]


@router.get("/api/v1/awareness-campaigns/{camp_id}", response_model=CampaignOut, summary="Szczegóły kampanii")
async def get_campaign(camp_id: int, s: AsyncSession = Depends(get_session)):
    c = await s.get(AwarenessCampaign, camp_id)
    if not c:
        raise HTTPException(404, "Kampania nie istnieje")
    return await _campaign_out(s, c)


@router.post("/api/v1/awareness-campaigns", response_model=CampaignOut, status_code=201, summary="Nowa kampania")
async def create_campaign(body: CampaignCreate, s: AsyncSession = Depends(get_session)):
    c = AwarenessCampaign(**body.model_dump())
    s.add(c)
    await s.flush()
    c.ref_id = f"AWR-{c.id:04d}"
    await s.commit()
    await s.refresh(c)
    return await _campaign_out(s, c)


@router.put("/api/v1/awareness-campaigns/{camp_id}", response_model=CampaignOut, summary="Edycja kampanii")
async def update_campaign(camp_id: int, body: CampaignUpdate, s: AsyncSession = Depends(get_session)):
    c = await s.get(AwarenessCampaign, camp_id)
    if not c:
        raise HTTPException(404, "Kampania nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    await s.commit()
    await s.refresh(c)
    return await _campaign_out(s, c)


@router.patch("/api/v1/awareness-campaigns/{camp_id}/status", response_model=CampaignOut, summary="Zmiana statusu kampanii")
async def change_campaign_status(camp_id: int, body: CampaignStatusChange, s: AsyncSession = Depends(get_session)):
    c = await s.get(AwarenessCampaign, camp_id)
    if not c:
        raise HTTPException(404, "Kampania nie istnieje")
    c.status_id = body.status_id
    await s.commit()
    await s.refresh(c)
    return await _campaign_out(s, c)


@router.delete("/api/v1/awareness-campaigns/{camp_id}", summary="Archiwizuj kampanię")
async def archive_campaign(camp_id: int, s: AsyncSession = Depends(get_session)):
    c = await s.get(AwarenessCampaign, camp_id)
    if not c:
        raise HTTPException(404, "Kampania nie istnieje")
    c.is_active = False
    await s.commit()
    return {"status": "archived", "id": camp_id}


# ═══════════════════ CAMPAIGN RESULTS ═══════════════════

@router.get("/api/v1/awareness-campaigns/{camp_id}/results", response_model=list[AwarenessResultOut], summary="Wyniki kampanii")
async def list_results(camp_id: int, s: AsyncSession = Depends(get_session)):
    q = select(AwarenessResult).where(AwarenessResult.campaign_id == camp_id)
    results = (await s.execute(q)).scalars().all()
    return [await _result_out(s, r) for r in results]


@router.post("/api/v1/awareness-campaigns/{camp_id}/results", response_model=AwarenessResultOut, status_code=201, summary="Dodaj wyniki kampanii")
async def create_result(camp_id: int, body: AwarenessResultCreate, s: AsyncSession = Depends(get_session)):
    c = await s.get(AwarenessCampaign, camp_id)
    if not c:
        raise HTTPException(404, "Kampania nie istnieje")

    r = AwarenessResult(campaign_id=camp_id, **body.model_dump())

    # Auto-compute rates
    if r.participants_count and r.participants_count > 0:
        r.completion_rate = round(r.completed_count / r.participants_count * 100, 2)
        r.click_rate = round((r.participants_count - r.reported_count) / r.participants_count * 100, 2)
        r.report_rate = round(r.reported_count / r.participants_count * 100, 2)

    from datetime import datetime
    r.recorded_at = datetime.now()

    s.add(r)
    await s.commit()
    await s.refresh(r)
    return await _result_out(s, r)


# ═══════════════════ EMPLOYEE REPORTS ═══════════════════

@router.get("/api/v1/awareness-employee-reports", response_model=list[EmployeeReportOut], summary="Raporty miesięczne")
async def list_employee_reports(
    org_unit_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = select(AwarenessEmployeeReport).order_by(AwarenessEmployeeReport.month.desc())
    if org_unit_id is not None:
        q = q.where(AwarenessEmployeeReport.org_unit_id == org_unit_id)
    reports = (await s.execute(q)).scalars().all()
    return [await _report_out(s, r) for r in reports]


@router.post("/api/v1/awareness-employee-reports", response_model=EmployeeReportOut, status_code=201, summary="Nowy raport miesięczny")
async def create_employee_report(body: EmployeeReportCreate, s: AsyncSession = Depends(get_session)):
    r = AwarenessEmployeeReport(**body.model_dump())
    from datetime import datetime
    r.recorded_at = datetime.now()
    s.add(r)
    await s.commit()
    await s.refresh(r)
    return await _report_out(s, r)
