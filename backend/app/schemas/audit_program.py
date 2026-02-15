"""Pydantic schemas for Audit Program module."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ─── Audit Program ────────────────────────────────────────────


class AuditProgramCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    period_type: str = "annual"
    period_start: date
    period_end: date
    year: int | None = None
    strategic_objectives: str | None = None
    risks_and_opportunities: str | None = None
    scope_description: str | None = None
    audit_criteria: str | None = None
    methods: str | None = None
    risk_assessment_ref: str | None = None
    budget_planned_days: Decimal | None = None
    budget_planned_cost: Decimal | None = None
    budget_currency: str = "PLN"
    kpis: list | None = None
    previous_program_id: int | None = None
    owner_id: int
    approver_id: int
    org_unit_id: int | None = None


class AuditProgramUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    period_type: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    year: int | None = None
    strategic_objectives: str | None = None
    risks_and_opportunities: str | None = None
    scope_description: str | None = None
    audit_criteria: str | None = None
    methods: str | None = None
    risk_assessment_ref: str | None = None
    budget_planned_days: Decimal | None = None
    budget_planned_cost: Decimal | None = None
    budget_currency: str | None = None
    kpis: list | None = None
    previous_program_id: int | None = None
    owner_id: int | None = None
    approver_id: int | None = None
    org_unit_id: int | None = None


class AuditProgramOut(BaseModel):
    id: int
    ref_id: str
    name: str
    description: str | None = None
    version: int
    version_group_id: int
    is_current_version: bool
    previous_version_id: int | None = None
    period_type: str
    period_start: date
    period_end: date
    year: int | None = None
    strategic_objectives: str | None = None
    risks_and_opportunities: str | None = None
    scope_description: str | None = None
    audit_criteria: str | None = None
    methods: str | None = None
    risk_assessment_ref: str | None = None
    budget_planned_days: Decimal | None = None
    budget_actual_days: Decimal = Decimal(0)
    budget_planned_cost: Decimal | None = None
    budget_actual_cost: Decimal = Decimal(0)
    budget_currency: str = "PLN"
    kpis: list | None = None
    previous_program_id: int | None = None
    status: str
    status_changed_at: datetime | None = None
    submitted_at: datetime | None = None
    approval_justification: str | None = None
    approved_at: datetime | None = None
    approved_by: int | None = None
    rejection_reason: str | None = None
    rejected_at: datetime | None = None
    correction_reason: str | None = None
    correction_initiated_at: datetime | None = None
    owner_id: int
    approver_id: int
    org_unit_id: int | None = None
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime
    # Computed
    owner_name: str | None = None
    approver_name: str | None = None
    org_unit_name: str | None = None
    item_count: int = 0
    items_completed: int = 0
    items_in_progress: int = 0
    items_planned: int = 0
    items_cancelled: int = 0
    pending_cr_count: int = 0

    class Config:
        from_attributes = True


# ─── Audit Program Item ──────────────────────────────────────


class AuditProgramItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    audit_type: str = "compliance"
    planned_quarter: int | None = None
    planned_month: int | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    scope_type: str | None = None
    scope_id: int | None = None
    scope_name: str | None = None
    framework_ids: list | None = None
    criteria_description: str | None = None
    planned_days: Decimal | None = None
    planned_cost: Decimal | None = None
    priority: str = "medium"
    risk_rating: str | None = None
    risk_justification: str | None = None
    lead_auditor_id: int | None = None
    auditor_ids: list | None = None
    audit_method: str = "on_site"
    display_order: int = 0


class AuditProgramItemUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    audit_type: str | None = None
    planned_quarter: int | None = None
    planned_month: int | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    scope_type: str | None = None
    scope_id: int | None = None
    scope_name: str | None = None
    framework_ids: list | None = None
    criteria_description: str | None = None
    planned_days: Decimal | None = None
    planned_cost: Decimal | None = None
    priority: str | None = None
    risk_rating: str | None = None
    risk_justification: str | None = None
    lead_auditor_id: int | None = None
    auditor_ids: list | None = None
    audit_method: str | None = None
    display_order: int | None = None


class AuditProgramItemOut(BaseModel):
    id: int
    audit_program_id: int
    ref_id: str | None = None
    name: str
    description: str | None = None
    audit_type: str
    planned_quarter: int | None = None
    planned_month: int | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    scope_type: str | None = None
    scope_id: int | None = None
    scope_name: str | None = None
    framework_ids: list | None = None
    criteria_description: str | None = None
    planned_days: Decimal | None = None
    planned_cost: Decimal | None = None
    priority: str
    risk_rating: str | None = None
    risk_justification: str | None = None
    lead_auditor_id: int | None = None
    auditor_ids: list | None = None
    audit_engagement_id: int | None = None
    item_status: str
    cancellation_reason: str | None = None
    deferral_reason: str | None = None
    deferred_to_program_id: int | None = None
    audit_method: str
    display_order: int
    created_at: datetime
    updated_at: datetime
    # Computed
    lead_auditor_name: str | None = None

    class Config:
        from_attributes = True


# ─── Supplier ────────────────────────────────────────────────


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    contact_info: str | None = None
    criticality: str = "medium"
    data_classification: str = "internal"
    contract_ref: str | None = None
    status: str = "active"
    org_unit_id: int | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    contact_info: str | None = None
    criticality: str | None = None
    data_classification: str | None = None
    contract_ref: str | None = None
    status: str | None = None
    org_unit_id: int | None = None


class SupplierOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    contact_info: str | None = None
    criticality: str
    data_classification: str
    contract_ref: str | None = None
    status: str
    org_unit_id: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Location ────────────────────────────────────────────────


class LocationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    location_type: str = "office"
    address: str | None = None
    city: str | None = None
    country: str | None = None
    criticality: str = "medium"
    status: str = "active"
    org_unit_id: int | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    location_type: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    criticality: str | None = None
    status: str | None = None
    org_unit_id: int | None = None


class LocationOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    location_type: str
    address: str | None = None
    city: str | None = None
    country: str | None = None
    criticality: str
    status: str
    org_unit_id: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Workflow payloads ────────────────────────────────────────


class RejectPayload(BaseModel):
    rejection_reason: str = Field(..., min_length=3)


class ApprovePayload(BaseModel):
    approval_justification: str | None = None


class CorrectionPayload(BaseModel):
    correction_reason: str = Field(..., min_length=10)


class CancelItemPayload(BaseModel):
    cancellation_reason: str = Field(..., min_length=3)


class DeferItemPayload(BaseModel):
    deferral_reason: str = Field(..., min_length=3)
    deferred_to_program_id: int | None = None


# ─── Change Requests ────────────────────────────────────────


class ChangeRequestCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    change_type: str = Field(..., pattern=r"^(add_audit|remove_audit|modify_audit|modify_schedule|modify_scope|modify_budget|modify_team|other)$")
    justification: str = Field(..., min_length=5)
    change_description: str = Field(..., min_length=5)
    impact_assessment: str | None = None
    affected_item_id: int | None = None
    proposed_changes: dict | None = None


class ChangeRequestUpdate(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=300)
    change_type: str | None = None
    justification: str | None = None
    change_description: str | None = None
    impact_assessment: str | None = None
    affected_item_id: int | None = None
    proposed_changes: dict | None = None


class ChangeRequestOut(BaseModel):
    id: int
    audit_program_id: int
    ref_id: str
    title: str
    change_type: str
    justification: str
    change_description: str
    impact_assessment: str | None = None
    affected_item_id: int | None = None
    proposed_changes: dict | None = None
    status: str
    status_changed_at: datetime | None = None
    requested_by: int
    requested_at: datetime
    submitted_at: datetime | None = None
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    review_comment: str | None = None
    resulting_version_id: int | None = None
    implemented_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Computed
    requested_by_name: str | None = None

    class Config:
        from_attributes = True


class CRReviewPayload(BaseModel):
    review_comment: str | None = None


class CRRejectPayload(BaseModel):
    review_comment: str = Field(..., min_length=3)


class CRImplementPayload(BaseModel):
    change_request_ids: list[int] | None = None
