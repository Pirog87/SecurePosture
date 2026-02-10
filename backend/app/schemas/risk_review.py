from datetime import datetime

from pydantic import BaseModel, Field


class RiskReviewOut(BaseModel):
    id: int
    risk_id: int
    reviewed_by: int | None = None
    reviewer_name: str | None = None
    review_date: datetime
    notes: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class RiskReviewCreate(BaseModel):
    risk_id: int
    reviewed_by: int | None = None
    notes: str | None = None


class ReviewConfigOut(BaseModel):
    id: int
    review_interval_days: int
    updated_at: datetime
    model_config = {"from_attributes": True}


class ReviewConfigUpdate(BaseModel):
    review_interval_days: int = Field(..., ge=1, le=365)


class OverdueRiskItem(BaseModel):
    risk_id: int
    asset_name: str
    org_unit_name: str
    risk_score: float
    risk_level: str
    owner: str | None = None
    last_review_at: datetime | None = None
    days_overdue: int
