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
