"""Pydantic schemas for Policy Exception Registry (Module 15)."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class PolicyExceptionOut(BaseModel):
    id: int
    ref_id: str | None = None
    title: str
    description: str
    policy_id: int
    policy_title: str | None = None
    category_id: int | None = None
    category_name: str | None = None
    org_unit_id: int
    org_unit_name: str | None = None
    asset_id: int | None = None
    asset_name: str | None = None
    requested_by: str
    approved_by: str | None = None
    risk_level_id: int | None = None
    risk_level_name: str | None = None
    compensating_controls: str | None = None
    status_id: int | None = None
    status_name: str | None = None
    start_date: date
    expiry_date: date
    review_date: date | None = None
    closed_at: date | None = None
    risk_id: int | None = None
    risk_score: float | None = None
    risk_level: str | None = None
    vulnerability_id: int | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class PolicyExceptionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    policy_id: int
    category_id: int | None = None
    org_unit_id: int
    asset_id: int | None = None
    requested_by: str = Field(..., min_length=1, max_length=100)
    approved_by: str | None = Field(None, max_length=100)
    risk_level_id: int | None = None
    compensating_controls: str | None = None
    status_id: int | None = None
    start_date: date
    expiry_date: date
    risk_id: int | None = None
    vulnerability_id: int | None = None


class PolicyExceptionUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    category_id: int | None = None
    approved_by: str | None = Field(None, max_length=100)
    risk_level_id: int | None = None
    compensating_controls: str | None = None
    status_id: int | None = None
    expiry_date: date | None = None
    risk_id: int | None = None
    vulnerability_id: int | None = None
    is_active: bool | None = None


class PolicyExceptionStatusChange(BaseModel):
    status_id: int


class ExceptionWithRiskCreate(BaseModel):
    """Create exception + mandatory deviation risk in one request."""
    # Exception fields
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    policy_id: int
    category_id: int | None = None
    org_unit_id: int
    asset_id: int | None = None
    requested_by: str = Field(..., min_length=1, max_length=100)
    approved_by: str | None = Field(None, max_length=100)
    compensating_controls: str | None = None
    status_id: int | None = None
    start_date: date
    expiry_date: date
    vulnerability_id: int | None = None

    # Deviation risk assessment (mandatory)
    risk_asset_name: str = Field(..., min_length=1, max_length=400)
    risk_security_area_id: int | None = None
    risk_threat_id: int | None = None
    risk_vulnerability_id: int | None = None
    risk_consequence: str | None = None
    risk_existing_controls: str | None = None
    risk_impact_level: int = Field(..., ge=1, le=3)
    risk_probability_level: int = Field(..., ge=1, le=3)
    risk_safeguard_rating: float = Field(..., description="0.10 / 0.25 / 0.70 / 0.95")
    risk_owner: str | None = Field(None, max_length=200)
    risk_strategy_id: int | None = None
    risk_treatment_plan: str | None = None
