"""Pydantic schemas for Security Awareness module."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ═══ Awareness Results ═══

class AwarenessResultOut(BaseModel):
    id: int
    campaign_id: int
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    participants_count: int = 0
    completed_count: int = 0
    failed_count: int = 0
    reported_count: int = 0
    avg_score: float | None = None
    completion_rate: float | None = None
    click_rate: float | None = None
    report_rate: float | None = None
    recorded_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AwarenessResultCreate(BaseModel):
    org_unit_id: int | None = None
    participants_count: int = Field(0, ge=0)
    completed_count: int = Field(0, ge=0)
    failed_count: int = Field(0, ge=0)
    reported_count: int = Field(0, ge=0)
    avg_score: float | None = Field(None, ge=0, le=100)


# ═══ Awareness Campaign ═══

class CampaignOut(BaseModel):
    id: int
    ref_id: str | None = None
    title: str
    description: str | None = None
    campaign_type_id: int | None = None
    campaign_type_name: str | None = None
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    target_audience_count: int = 0
    start_date: date | None = None
    end_date: date | None = None
    status_id: int | None = None
    status_name: str | None = None
    owner: str | None = None
    content_url: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class CampaignCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    campaign_type_id: int | None = None
    org_unit_id: int | None = None
    target_audience_count: int = Field(0, ge=0)
    start_date: date | None = None
    end_date: date | None = None
    status_id: int | None = None
    owner: str | None = Field(None, max_length=100)
    content_url: str | None = Field(None, max_length=500)


class CampaignUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    campaign_type_id: int | None = None
    org_unit_id: int | None = None
    target_audience_count: int | None = Field(None, ge=0)
    start_date: date | None = None
    end_date: date | None = None
    status_id: int | None = None
    owner: str | None = Field(None, max_length=100)
    content_url: str | None = Field(None, max_length=500)
    is_active: bool | None = None


class CampaignStatusChange(BaseModel):
    status_id: int


# ═══ Employee Reports ═══

class EmployeeReportOut(BaseModel):
    id: int
    month: date
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    reports_count: int = 0
    confirmed_count: int = 0
    confirmation_rate: float | None = None
    recorded_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class EmployeeReportCreate(BaseModel):
    month: date
    org_unit_id: int | None = None
    reports_count: int = Field(0, ge=0)
    confirmed_count: int = Field(0, ge=0)
