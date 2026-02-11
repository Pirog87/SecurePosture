"""Pydantic schemas for Audit & Finding Registry (Module 16)."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ═══ Audit ═══

class AuditOut(BaseModel):
    id: int
    ref_id: str | None = None
    title: str
    audit_type_id: int | None = None
    audit_type_name: str | None = None
    framework: str | None = None
    auditor: str
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    status: str
    start_date: date | None = None
    end_date: date | None = None
    summary: str | None = None
    overall_rating_id: int | None = None
    overall_rating_name: str | None = None
    findings_count: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AuditCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    audit_type_id: int | None = None
    framework: str | None = Field(None, max_length=200)
    auditor: str = Field(..., min_length=1, max_length=100)
    org_unit_id: int | None = None
    status: str = "planned"
    start_date: date | None = None
    end_date: date | None = None
    summary: str | None = None
    overall_rating_id: int | None = None


class AuditUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    audit_type_id: int | None = None
    framework: str | None = Field(None, max_length=200)
    auditor: str | None = Field(None, max_length=100)
    org_unit_id: int | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    summary: str | None = None
    overall_rating_id: int | None = None
    is_active: bool | None = None


# ═══ Finding ═══

class FindingOut(BaseModel):
    id: int
    ref_id: str | None = None
    audit_id: int
    title: str
    description: str | None = None
    finding_type_id: int | None = None
    finding_type_name: str | None = None
    severity_id: int | None = None
    severity_name: str | None = None
    security_area_id: int | None = None
    security_area_name: str | None = None
    framework_node_id: int | None = None
    remediation_owner: str | None = None
    status_id: int | None = None
    status_name: str | None = None
    sla_deadline: date | None = None
    remediation_plan: str | None = None
    remediation_evidence: str | None = None
    risk_id: int | None = None
    vulnerability_id: int | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class FindingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    finding_type_id: int | None = None
    severity_id: int | None = None
    security_area_id: int | None = None
    framework_node_id: int | None = None
    remediation_owner: str | None = Field(None, max_length=100)
    status_id: int | None = None
    sla_deadline: date | None = None
    remediation_plan: str | None = None
    risk_id: int | None = None
    vulnerability_id: int | None = None


class FindingUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    finding_type_id: int | None = None
    severity_id: int | None = None
    security_area_id: int | None = None
    framework_node_id: int | None = None
    remediation_owner: str | None = Field(None, max_length=100)
    status_id: int | None = None
    sla_deadline: date | None = None
    remediation_plan: str | None = None
    remediation_evidence: str | None = None
    risk_id: int | None = None
    vulnerability_id: int | None = None
    is_active: bool | None = None
