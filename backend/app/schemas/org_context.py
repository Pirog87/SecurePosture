"""Pydantic schemas for the Organizational Context module (ISO 27001/22301 clause 4)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ═══════════════════ ISSUES ═══════════════════

class OrgContextIssueOut(BaseModel):
    id: int
    org_unit_id: int
    org_unit_name: str | None = None
    issue_type: str
    category_id: int | None = None
    category_name: str | None = None
    title: str
    description: str | None = None
    impact_level: str | None = None
    relevance: str | None = None
    response_action: str | None = None
    review_date: date | None = None
    is_active: bool = True
    inherited: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class OrgContextIssueCreate(BaseModel):
    issue_type: str = Field(..., pattern=r"^(internal|external)$")
    category_id: int | None = None
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    impact_level: str | None = Field(None, pattern=r"^(positive|negative|neutral)$")
    relevance: str | None = Field(None, pattern=r"^(high|medium|low)$")
    response_action: str | None = None
    review_date: date | None = None


class OrgContextIssueUpdate(BaseModel):
    issue_type: str | None = Field(None, pattern=r"^(internal|external)$")
    category_id: int | None = None
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    impact_level: str | None = Field(None, pattern=r"^(positive|negative|neutral)$")
    relevance: str | None = Field(None, pattern=r"^(high|medium|low)$")
    response_action: str | None = None
    review_date: date | None = None
    is_active: bool | None = None


# ═══════════════════ OBLIGATIONS ═══════════════════

class OrgContextObligationOut(BaseModel):
    id: int
    org_unit_id: int
    org_unit_name: str | None = None
    obligation_type: str
    regulation_id: int | None = None
    regulation_name: str | None = None
    custom_name: str | None = None
    description: str | None = None
    responsible_person: str | None = None
    compliance_status: str | None = None
    compliance_evidence: str | None = None
    effective_from: date | None = None
    review_date: date | None = None
    notes: str | None = None
    is_active: bool = True
    inherited: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class OrgContextObligationCreate(BaseModel):
    obligation_type: str = Field(..., min_length=1, max_length=30)
    regulation_id: int | None = None
    custom_name: str | None = Field(None, max_length=500)
    description: str | None = None
    responsible_person: str | None = Field(None, max_length=200)
    compliance_status: str | None = Field("not_assessed", max_length=30)
    compliance_evidence: str | None = None
    effective_from: date | None = None
    review_date: date | None = None
    notes: str | None = None


class OrgContextObligationUpdate(BaseModel):
    obligation_type: str | None = Field(None, min_length=1, max_length=30)
    regulation_id: int | None = None
    custom_name: str | None = Field(None, max_length=500)
    description: str | None = None
    responsible_person: str | None = Field(None, max_length=200)
    compliance_status: str | None = Field(None, max_length=30)
    compliance_evidence: str | None = None
    effective_from: date | None = None
    review_date: date | None = None
    notes: str | None = None
    is_active: bool | None = None


# ═══════════════════ STAKEHOLDERS ═══════════════════

class OrgContextStakeholderOut(BaseModel):
    id: int
    org_unit_id: int
    org_unit_name: str | None = None
    stakeholder_type: str
    category_id: int | None = None
    category_name: str | None = None
    name: str
    description: str | None = None
    needs_expectations: str | None = None
    requirements_type: str | None = None
    requirements_detail: str | None = None
    communication_channel: str | None = None
    influence_level: str | None = None
    relevance: str | None = None
    is_active: bool = True
    inherited: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class OrgContextStakeholderCreate(BaseModel):
    stakeholder_type: str = Field(..., pattern=r"^(internal|external)$")
    category_id: int | None = None
    name: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    needs_expectations: str | None = None
    requirements_type: str | None = Field(None, pattern=r"^(legal|contractual|voluntary)$")
    requirements_detail: str | None = None
    communication_channel: str | None = Field(None, max_length=200)
    influence_level: str | None = Field(None, pattern=r"^(high|medium|low)$")
    relevance: str | None = Field(None, pattern=r"^(high|medium|low)$")


class OrgContextStakeholderUpdate(BaseModel):
    stakeholder_type: str | None = Field(None, pattern=r"^(internal|external)$")
    category_id: int | None = None
    name: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    needs_expectations: str | None = None
    requirements_type: str | None = Field(None, pattern=r"^(legal|contractual|voluntary)$")
    requirements_detail: str | None = None
    communication_channel: str | None = Field(None, max_length=200)
    influence_level: str | None = Field(None, pattern=r"^(high|medium|low)$")
    relevance: str | None = Field(None, pattern=r"^(high|medium|low)$")
    is_active: bool | None = None


# ═══════════════════ SCOPE ═══════════════════

class OrgContextScopeOut(BaseModel):
    id: int
    org_unit_id: int
    org_unit_name: str | None = None
    management_system_id: int | None = None
    management_system_name: str | None = None
    scope_statement: str | None = None
    in_scope_description: str | None = None
    out_of_scope_description: str | None = None
    geographic_boundaries: str | None = None
    technology_boundaries: str | None = None
    organizational_boundaries: str | None = None
    interfaces_dependencies: str | None = None
    approved_by: str | None = None
    approved_date: date | None = None
    version: int = 1
    is_active: bool = True
    inherited: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class OrgContextScopeCreate(BaseModel):
    management_system_id: int | None = None
    scope_statement: str | None = None
    in_scope_description: str | None = None
    out_of_scope_description: str | None = None
    geographic_boundaries: str | None = None
    technology_boundaries: str | None = None
    organizational_boundaries: str | None = None
    interfaces_dependencies: str | None = None
    approved_by: str | None = Field(None, max_length=200)
    approved_date: date | None = None


class OrgContextScopeUpdate(BaseModel):
    management_system_id: int | None = None
    scope_statement: str | None = None
    in_scope_description: str | None = None
    out_of_scope_description: str | None = None
    geographic_boundaries: str | None = None
    technology_boundaries: str | None = None
    organizational_boundaries: str | None = None
    interfaces_dependencies: str | None = None
    approved_by: str | None = Field(None, max_length=200)
    approved_date: date | None = None
    is_active: bool | None = None


# ═══════════════════ RISK APPETITE ═══════════════════

class OrgContextRiskAppetiteOut(BaseModel):
    id: int
    org_unit_id: int
    org_unit_name: str | None = None
    risk_appetite_statement: str | None = None
    max_acceptable_risk_level: str | None = None
    max_acceptable_risk_score: Decimal | None = None
    exception_approval_authority: str | None = None
    financial_risk_tolerance: str | None = None
    reputational_risk_tolerance: str | None = None
    operational_risk_tolerance: str | None = None
    approved_by: str | None = None
    approved_date: date | None = None
    is_active: bool = True
    inherited: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class OrgContextRiskAppetiteCreate(BaseModel):
    risk_appetite_statement: str | None = None
    max_acceptable_risk_level: str | None = Field(None, pattern=r"^(low|medium|high)$")
    max_acceptable_risk_score: Decimal | None = Field(None, ge=0, le=999.99)
    exception_approval_authority: str | None = Field(None, max_length=200)
    financial_risk_tolerance: str | None = None
    reputational_risk_tolerance: str | None = None
    operational_risk_tolerance: str | None = None
    approved_by: str | None = Field(None, max_length=200)
    approved_date: date | None = None


class OrgContextRiskAppetiteUpdate(BaseModel):
    risk_appetite_statement: str | None = None
    max_acceptable_risk_level: str | None = Field(None, pattern=r"^(low|medium|high)$")
    max_acceptable_risk_score: Decimal | None = Field(None, ge=0, le=999.99)
    exception_approval_authority: str | None = Field(None, max_length=200)
    financial_risk_tolerance: str | None = None
    reputational_risk_tolerance: str | None = None
    operational_risk_tolerance: str | None = None
    approved_by: str | None = Field(None, max_length=200)
    approved_date: date | None = None
    is_active: bool | None = None


# ═══════════════════ REVIEWS ═══════════════════

class OrgContextReviewOut(BaseModel):
    id: int
    org_unit_id: int
    org_unit_name: str | None = None
    review_date: date
    reviewer: str
    review_type: str
    sections_reviewed: dict | None = None
    changes_summary: str | None = None
    approved_by: str | None = None
    approved_date: date | None = None
    next_review_date: date | None = None
    is_active: bool = True
    created_at: datetime
    model_config = {"from_attributes": True}


class OrgContextReviewCreate(BaseModel):
    review_date: date
    reviewer: str = Field(..., min_length=1, max_length=200)
    review_type: str = Field(..., pattern=r"^(scheduled|triggered|initial)$")
    sections_reviewed: dict | None = None
    changes_summary: str | None = None
    approved_by: str | None = Field(None, max_length=200)
    approved_date: date | None = None
    next_review_date: date | None = None


class OrgContextReviewUpdate(BaseModel):
    review_date: date | None = None
    reviewer: str | None = Field(None, min_length=1, max_length=200)
    review_type: str | None = Field(None, pattern=r"^(scheduled|triggered|initial)$")
    sections_reviewed: dict | None = None
    changes_summary: str | None = None
    approved_by: str | None = Field(None, max_length=200)
    approved_date: date | None = None
    next_review_date: date | None = None
    is_active: bool | None = None


# ═══════════════════ SNAPSHOTS ═══════════════════

class OrgContextSnapshotOut(BaseModel):
    id: int
    org_unit_id: int
    org_unit_name: str | None = None
    review_id: int | None = None
    snapshot_date: date
    snapshot_data: dict | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class OrgContextSnapshotCreate(BaseModel):
    review_id: int | None = None
    snapshot_date: date | None = None


# ═══════════════════ ORG UNIT CONTEXT EXTENSIONS ═══════════════════

class OrgUnitContextUpdate(BaseModel):
    """Update the context-related fields on org_units table."""
    headcount: int | None = Field(None, ge=0)
    context_reviewer: str | None = Field(None, max_length=200)
    context_status: str | None = Field(None, pattern=r"^(draft|in_review|approved|needs_update)$")
    mission_vision: str | None = None
    key_products_services: str | None = None
    strategic_objectives: str | None = None
    key_processes_notes: str | None = None
    context_review_date: date | None = None
    context_next_review: date | None = None


class OrgUnitContextOut(BaseModel):
    """Context-related fields from org_units."""
    id: int
    name: str
    headcount: int | None = None
    context_review_date: date | None = None
    context_next_review: date | None = None
    context_reviewer: str | None = None
    context_status: str | None = None
    mission_vision: str | None = None
    key_products_services: str | None = None
    strategic_objectives: str | None = None
    key_processes_notes: str | None = None
    model_config = {"from_attributes": True}


# ═══════════════════ OVERVIEW ═══════════════════

class OrgContextOverview(BaseModel):
    """Summary of all context sections for an org unit."""
    org_unit_id: int
    org_unit_name: str
    context_status: str | None = None
    issues_count: int = 0
    issues_own: int = 0
    issues_inherited: int = 0
    obligations_count: int = 0
    obligations_own: int = 0
    obligations_inherited: int = 0
    stakeholders_count: int = 0
    stakeholders_own: int = 0
    stakeholders_inherited: int = 0
    has_scope: bool = False
    scope_inherited: bool = False
    has_risk_appetite: bool = False
    risk_appetite_inherited: bool = False
    reviews_count: int = 0
    snapshots_count: int = 0
    last_review_date: date | None = None
    next_review_date: date | None = None
