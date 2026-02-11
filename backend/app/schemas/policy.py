"""Pydantic schemas for Policy Registry (Module 20)."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class PolicyOut(BaseModel):
    id: int
    ref_id: str | None = None
    title: str
    category_id: int | None = None
    category_name: str | None = None
    owner: str
    approver: str | None = None
    status_id: int | None = None
    status_name: str | None = None
    current_version: str | None = None
    effective_date: date | None = None
    review_date: date | None = None
    last_reviewed_at: datetime | None = None
    document_url: str | None = None
    target_audience_count: int = 0
    acknowledgment_count: int = 0
    acknowledgment_rate: float | None = None
    description: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class PolicyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category_id: int | None = None
    owner: str = Field(..., min_length=1, max_length=100)
    approver: str | None = Field(None, max_length=100)
    status_id: int | None = None
    current_version: str | None = Field(None, max_length=20)
    effective_date: date | None = None
    review_date: date | None = None
    document_url: str | None = Field(None, max_length=500)
    target_audience_count: int = 0
    description: str | None = None


class PolicyUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    category_id: int | None = None
    owner: str | None = Field(None, max_length=100)
    approver: str | None = Field(None, max_length=100)
    status_id: int | None = None
    current_version: str | None = Field(None, max_length=20)
    effective_date: date | None = None
    review_date: date | None = None
    document_url: str | None = Field(None, max_length=500)
    target_audience_count: int | None = None
    description: str | None = None
    is_active: bool | None = None


class PolicyMappingOut(BaseModel):
    id: int
    policy_id: int
    framework_node_id: int | None = None
    standard_name: str | None = None
    control_ref: str | None = None
    control_description: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class PolicyMappingCreate(BaseModel):
    framework_node_id: int | None = None
    standard_name: str | None = Field(None, max_length=100)
    control_ref: str | None = Field(None, max_length=50)
    control_description: str | None = Field(None, max_length=500)


class PolicyAcknowledgmentOut(BaseModel):
    id: int
    policy_id: int
    org_unit_id: int | None = None
    acknowledged_by: str
    acknowledged_at: datetime
    policy_version: str | None = None
    model_config = {"from_attributes": True}


class PolicyAcknowledgmentCreate(BaseModel):
    org_unit_id: int | None = None
    acknowledged_by: str = Field(..., min_length=1, max_length=100)
    policy_version: str | None = Field(None, max_length=20)
