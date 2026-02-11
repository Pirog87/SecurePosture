"""Pydantic schemas for the Incident Registry (Module 14)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class IncidentOut(BaseModel):
    id: int
    ref_id: str | None = None
    title: str
    description: str
    category_id: int | None = None
    category_name: str | None = None
    severity_id: int | None = None
    severity_name: str | None = None
    org_unit_id: int
    org_unit_name: str | None = None
    asset_id: int | None = None
    asset_name: str | None = None
    reported_by: str
    assigned_to: str
    status_id: int | None = None
    status_name: str | None = None
    reported_at: datetime
    detected_at: datetime | None = None
    closed_at: datetime | None = None
    ttr_minutes: int | None = None
    impact_id: int | None = None
    impact_name: str | None = None
    personal_data_breach: bool = False
    authority_notification: bool = False
    actions_taken: str | None = None
    root_cause: str | None = None
    lessons_learned: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    category_id: int | None = None
    severity_id: int | None = None
    org_unit_id: int
    asset_id: int | None = None
    reported_by: str = Field(..., min_length=1, max_length=100)
    assigned_to: str = Field(..., min_length=1, max_length=100)
    status_id: int | None = None
    reported_at: datetime
    detected_at: datetime | None = None
    impact_id: int | None = None
    personal_data_breach: bool = False
    authority_notification: bool = False
    actions_taken: str | None = None


class IncidentUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    category_id: int | None = None
    severity_id: int | None = None
    org_unit_id: int | None = None
    asset_id: int | None = None
    reported_by: str | None = Field(None, max_length=100)
    assigned_to: str | None = Field(None, max_length=100)
    status_id: int | None = None
    detected_at: datetime | None = None
    impact_id: int | None = None
    personal_data_breach: bool | None = None
    authority_notification: bool | None = None
    actions_taken: str | None = None
    root_cause: str | None = None
    lessons_learned: str | None = None
    is_active: bool | None = None


class IncidentStatusChange(BaseModel):
    status_id: int
    actions_taken: str | None = None
    root_cause: str | None = None
    lessons_learned: str | None = None


class IncidentBrief(BaseModel):
    id: int
    ref_id: str | None = None
    title: str
    severity_name: str | None = None
    status_name: str | None = None
    reported_at: datetime
    ttr_minutes: int | None = None
    personal_data_breach: bool = False
    model_config = {"from_attributes": True}


class IncidentLinkRisk(BaseModel):
    risk_id: int


class IncidentLinkVulnerability(BaseModel):
    vulnerability_id: int


class IncidentMetrics(BaseModel):
    total_open: int = 0
    total_90d: int = 0
    by_severity: dict[str, int] = {}
    avg_ttr_minutes: float | None = None
    lessons_learned_pct: float | None = None
