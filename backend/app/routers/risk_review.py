"""
Risk reviews module — /api/v1/risk-reviews
Overdue tracking + review config + recording reviews.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.org_unit import OrgUnit
from app.models.risk import Risk, RiskReview, RiskReviewConfig
from app.models.user import User
from app.schemas.risk_review import (
    OverdueRiskItem,
    ReviewConfigOut,
    ReviewConfigUpdate,
    RiskReviewCreate,
    RiskReviewOut,
)

router = APIRouter(prefix="/api/v1/risk-reviews", tags=["Przeglądy ryzyka"])


# ═══════════════════ CONFIG ═══════════════════

@router.get("/config", response_model=ReviewConfigOut, summary="Pobierz konfigurację przeglądów")
async def get_config(s: AsyncSession = Depends(get_session)):
    cfg = (await s.execute(select(RiskReviewConfig).limit(1))).scalar_one_or_none()
    if not cfg:
        cfg = RiskReviewConfig(review_interval_days=90)
        s.add(cfg)
        await s.commit()
        await s.refresh(cfg)
    return cfg


@router.put("/config", response_model=ReviewConfigOut, summary="Ustaw interwał przeglądów")
async def update_config(body: ReviewConfigUpdate, s: AsyncSession = Depends(get_session)):
    cfg = (await s.execute(select(RiskReviewConfig).limit(1))).scalar_one_or_none()
    if not cfg:
        cfg = RiskReviewConfig(review_interval_days=body.review_interval_days)
        s.add(cfg)
    else:
        cfg.review_interval_days = body.review_interval_days
    await s.commit()
    await s.refresh(cfg)
    return cfg


# ═══════════════════ OVERDUE ═══════════════════

@router.get("/overdue", response_model=list[OverdueRiskItem], summary="Ryzyka przeterminowane do przeglądu")
async def list_overdue(
    org_unit_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    cfg = (await s.execute(select(RiskReviewConfig.review_interval_days))).scalar() or 90

    q = (
        select(
            Risk.id.label("risk_id"),
            Risk.asset_name,
            OrgUnit.name.label("org_unit_name"),
            Risk.risk_score,
            Risk.risk_level,
            Risk.owner,
            Risk.last_review_at,
            func.datediff(func.now(), func.coalesce(Risk.last_review_at, Risk.identified_at)).label("days_overdue"),
        )
        .join(OrgUnit, Risk.org_unit_id == OrgUnit.id)
        .where(
            func.datediff(func.now(), func.coalesce(Risk.last_review_at, Risk.identified_at)) > cfg
        )
    )
    if org_unit_id is not None:
        q = q.where(Risk.org_unit_id == org_unit_id)
    q = q.order_by(Risk.risk_score.desc())
    rows = (await s.execute(q)).all()
    return [
        OverdueRiskItem(
            risk_id=r.risk_id, asset_name=r.asset_name,
            org_unit_name=r.org_unit_name, risk_score=float(r.risk_score),
            risk_level=r.risk_level, owner=r.owner,
            last_review_at=r.last_review_at, days_overdue=r.days_overdue,
        )
        for r in rows
    ]


# ═══════════════════ LIST REVIEWS FOR RISK ═══════════════════

@router.get("/{risk_id}", response_model=list[RiskReviewOut], summary="Historia przeglądów ryzyka")
async def list_reviews(risk_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(RiskReview, User.display_name.label("reviewer_name"))
        .outerjoin(User, RiskReview.reviewed_by == User.id)
        .where(RiskReview.risk_id == risk_id)
        .order_by(RiskReview.review_date.desc())
    )
    rows = (await s.execute(q)).all()
    return [
        RiskReviewOut(
            id=rv.id, risk_id=rv.risk_id, reviewed_by=rv.reviewed_by,
            reviewer_name=rn, review_date=rv.review_date,
            notes=rv.notes, created_at=rv.created_at,
        )
        for rv, rn in rows
    ]


# ═══════════════════ CREATE REVIEW ═══════════════════

@router.post("", response_model=RiskReviewOut, status_code=201, summary="Zarejestruj przegląd ryzyka")
async def create_review(body: RiskReviewCreate, s: AsyncSession = Depends(get_session)):
    risk = await s.get(Risk, body.risk_id)
    if not risk:
        raise HTTPException(404, "Ryzyko nie istnieje")

    review = RiskReview(
        risk_id=body.risk_id,
        reviewed_by=body.reviewed_by,
        notes=body.notes,
        review_date=datetime.utcnow(),
    )
    s.add(review)

    # Update last_review_at on risk
    risk.last_review_at = review.review_date

    await s.commit()
    await s.refresh(review)
    return RiskReviewOut(
        id=review.id, risk_id=review.risk_id, reviewed_by=review.reviewed_by,
        review_date=review.review_date, notes=review.notes,
        created_at=review.created_at,
    )
