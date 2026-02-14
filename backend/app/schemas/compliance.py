"""Pydantic schemas for Compliance & Audit module."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ═══ Compliance Assessment ═══


class ComplianceAssessmentOut(BaseModel):
    id: int
    framework_id: int
    framework_name: str | None = None
    scope_type: str
    scope_id: int | None = None
    scope_name: str | None = None
    assessment_type: str
    scoring_mode: str | None = None
    selected_impl_groups: list | None = None
    status: str
    name: str | None = None
    description: str | None = None
    compliance_score: Decimal | None = None
    total_requirements: int = 0
    assessed_count: int = 0
    compliant_count: int = 0
    partially_count: int = 0
    non_compliant_count: int = 0
    not_applicable_count: int = 0
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ComplianceAssessmentCreate(BaseModel):
    framework_id: int
    scope_type: str = "organization"
    scope_id: int | None = None
    scope_name: str | None = Field(None, max_length=300)
    assessment_type: str = "continuous"
    scoring_mode: str | None = None
    selected_impl_groups: list | None = None
    name: str | None = Field(None, max_length=300)
    description: str | None = None


class ComplianceAssessmentUpdate(BaseModel):
    scope_type: str | None = None
    scope_id: int | None = None
    scope_name: str | None = Field(None, max_length=300)
    scoring_mode: str | None = None
    selected_impl_groups: list | None = None
    status: str | None = None
    name: str | None = Field(None, max_length=300)
    description: str | None = None


# ═══ Requirement Assessment ═══


class RequirementAssessmentOut(BaseModel):
    id: int
    compliance_assessment_id: int
    requirement_node_id: int
    node_ref_id: str | None = None
    node_name: str | None = None
    node_name_pl: str | None = None
    node_depth: int | None = None
    node_assessable: bool | None = None
    result: str
    score: int | None = None
    maturity_level: str | None = None
    assessor_name: str | None = None
    assessed_at: datetime | None = None
    last_audited_at: datetime | None = None
    last_audited_by: str | None = None
    notes: str | None = None
    justification: str | None = None
    selected: bool = True
    evidence_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class RequirementAssessmentUpdate(BaseModel):
    result: str | None = None
    score: int | None = None
    maturity_level: str | None = None
    assessor_name: str | None = None
    notes: str | None = None
    justification: str | None = None
    selected: bool | None = None


class RequirementAssessmentItemUpdate(BaseModel):
    id: int
    result: str | None = None
    score: int | None = None
    maturity_level: str | None = None
    notes: str | None = None


class RequirementAssessmentBulkUpdate(BaseModel):
    updates: list[RequirementAssessmentItemUpdate]


# ═══ Evidence ═══


class EvidenceOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    evidence_type: str
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    url: str | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    uploaded_by: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class EvidenceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    evidence_type: str = "description"
    url: str | None = Field(None, max_length=500)
    valid_from: date | None = None
    valid_until: date | None = None


# ═══ Audit Program ═══


class AuditProgramOut(BaseModel):
    id: int
    name: str
    year: int
    description: str | None = None
    status: str
    prepared_by: str | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    org_unit_id: int | None = None
    engagement_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AuditProgramCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    year: int
    description: str | None = None
    org_unit_id: int | None = None
    prepared_by: str | None = None


class AuditProgramUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    status: str | None = None
    org_unit_id: int | None = None
    prepared_by: str | None = None
    approved_by: str | None = None


# ═══ Audit Engagement ═══


class AuditEngagementOut(BaseModel):
    id: int
    audit_program_id: int | None = None
    program_name: str | None = None
    ref_id: str
    name: str
    framework_id: int
    framework_name: str | None = None
    compliance_assessment_id: int | None = None
    scope_type: str
    scope_id: int | None = None
    scope_name: str | None = None
    objective: str
    methodology: str | None = None
    criteria: str | None = None
    planned_quarter: int | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    actual_start: date | None = None
    actual_end: date | None = None
    lead_auditor: str
    supervisor: str | None = None
    status: str
    status_changed_at: datetime | None = None
    priority: str
    tests_count: int = 0
    findings_count: int = 0
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AuditEngagementCreate(BaseModel):
    audit_program_id: int | None = None
    name: str = Field(..., min_length=1, max_length=300)
    framework_id: int
    compliance_assessment_id: int | None = None
    scope_type: str = "organization"
    scope_id: int | None = None
    scope_name: str | None = Field(None, max_length=300)
    objective: str = Field(..., min_length=1)
    methodology: str | None = None
    criteria: str | None = None
    planned_quarter: int | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    lead_auditor: str = Field(..., min_length=1, max_length=200)
    supervisor: str | None = Field(None, max_length=200)
    priority: str = "medium"


class AuditEngagementUpdate(BaseModel):
    name: str | None = Field(None, max_length=300)
    compliance_assessment_id: int | None = None
    scope_type: str | None = None
    scope_id: int | None = None
    scope_name: str | None = Field(None, max_length=300)
    objective: str | None = None
    methodology: str | None = None
    criteria: str | None = None
    planned_quarter: int | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    actual_start: date | None = None
    actual_end: date | None = None
    lead_auditor: str | None = Field(None, max_length=200)
    supervisor: str | None = Field(None, max_length=200)
    priority: str | None = None


class EngagementTransition(BaseModel):
    target_status: str


# ═══ Audit Test ═══


class AuditTestOut(BaseModel):
    id: int
    audit_engagement_id: int
    test_template_id: int | None = None
    requirement_node_id: int | None = None
    node_ref_id: str | None = None
    node_name: str | None = None
    ref_id: str | None = None
    name: str
    description: str | None = None
    test_steps: str | None = None
    expected_result: str | None = None
    test_type: str
    actual_result: str | None = None
    test_result: str
    auditor_name: str | None = None
    tested_at: datetime | None = None
    workpaper_ref: str | None = None
    sample_size: int | None = None
    exceptions_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AuditTestCreate(BaseModel):
    test_template_id: int | None = None
    requirement_node_id: int | None = None
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    test_steps: str | None = None
    expected_result: str | None = None
    test_type: str = "design"


class AuditTestUpdate(BaseModel):
    name: str | None = Field(None, max_length=300)
    description: str | None = None
    test_steps: str | None = None
    expected_result: str | None = None
    actual_result: str | None = None
    test_result: str | None = None
    auditor_name: str | None = None
    workpaper_ref: str | None = None
    workpaper_notes: str | None = None
    sample_size: int | None = None
    sample_description: str | None = None
    exceptions_count: int | None = None


# ═══ Compliance Audit Finding ═══


class ComplianceFindingOut(BaseModel):
    id: int
    audit_engagement_id: int
    ref_id: str
    title: str
    condition_text: str
    criteria_text: str
    cause_text: str | None = None
    effect_text: str | None = None
    severity: str
    recommendation: str | None = None
    management_response: str | None = None
    management_response_by: str | None = None
    management_response_at: datetime | None = None
    agreed: bool | None = None
    status: str
    status_changed_at: datetime | None = None
    target_date: date | None = None
    actual_close_date: date | None = None
    verified_by: str | None = None
    verified_at: datetime | None = None
    verification_notes: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ComplianceFindingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    condition_text: str = Field(..., min_length=1)
    criteria_text: str = Field(..., min_length=1)
    cause_text: str | None = None
    effect_text: str | None = None
    severity: str = "medium"
    recommendation: str | None = None
    target_date: date | None = None


class ComplianceFindingUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    condition_text: str | None = None
    criteria_text: str | None = None
    cause_text: str | None = None
    effect_text: str | None = None
    severity: str | None = None
    recommendation: str | None = None
    status: str | None = None
    target_date: date | None = None
    management_response: str | None = None
    management_response_by: str | None = None
    agreed: bool | None = None
    verified_by: str | None = None
    verification_notes: str | None = None


# ═══ Audit Report ═══


class AuditReportOut(BaseModel):
    id: int
    audit_engagement_id: int
    report_type: str
    version: int
    executive_summary: str | None = None
    scope_description: str | None = None
    methodology_description: str | None = None
    findings_summary: str | None = None
    conclusion: str | None = None
    opinion: str | None = None
    opinion_rationale: str | None = None
    prepared_by: str | None = None
    prepared_at: datetime | None = None
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    distributed: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AuditReportUpsert(BaseModel):
    executive_summary: str | None = None
    scope_description: str | None = None
    methodology_description: str | None = None
    findings_summary: str | None = None
    conclusion: str | None = None
    opinion: str | None = None
    opinion_rationale: str | None = None
    report_type: str | None = None


# ═══ Mapping Set ═══


class MappingSetOut(BaseModel):
    id: int
    source_framework_id: int
    source_framework_name: str | None = None
    target_framework_id: int
    target_framework_name: str | None = None
    name: str | None = None
    description: str | None = None
    status: str
    revert_set_id: int | None = None
    mapping_count: int = 0
    coverage_percent: Decimal | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class MappingSetCreate(BaseModel):
    source_framework_id: int
    target_framework_id: int
    name: str | None = Field(None, max_length=500)
    description: str | None = None


class MappingSetUpdate(BaseModel):
    name: str | None = Field(None, max_length=500)
    description: str | None = None
    status: str | None = None


# ═══ Framework Mapping ═══


class FrameworkMappingOut(BaseModel):
    id: int
    mapping_set_id: int | None = None
    source_framework_id: int
    source_framework_name: str | None = None
    source_requirement_id: int
    source_requirement_ref: str | None = None
    source_requirement_name: str | None = None
    target_framework_id: int
    target_framework_name: str | None = None
    target_requirement_id: int
    target_requirement_ref: str | None = None
    target_requirement_name: str | None = None
    relationship_type: str
    strength: int = 2
    rationale_type: str | None = None
    rationale: str | None = None
    mapping_source: str
    mapping_status: str
    ai_score: Decimal | None = None
    ai_model: str | None = None
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class FrameworkMappingCreate(BaseModel):
    source_framework_id: int
    source_requirement_id: int
    target_framework_id: int
    target_requirement_id: int
    mapping_set_id: int | None = None
    relationship_type: str = "intersect"
    strength: int = Field(2, ge=1, le=3)
    rationale_type: str | None = None
    rationale: str | None = None
    mapping_source: str = "manual"


class FrameworkMappingUpdate(BaseModel):
    relationship_type: str | None = None
    strength: int | None = Field(None, ge=1, le=3)
    rationale_type: str | None = None
    rationale: str | None = None
    mapping_status: str | None = None
    confirmed_by: str | None = None


class FrameworkMappingBulkCreate(BaseModel):
    """Bulk import of mappings (CISO Assistant style)."""
    source_framework_id: int
    target_framework_id: int
    mapping_source: str = "import"
    auto_revert: bool = True
    mappings: list[dict]


class FrameworkMappingConfirm(BaseModel):
    confirmed_by: str = Field(..., min_length=1, max_length=200)


# ═══ Mapping Matrix ═══


class MappingMatrixCell(BaseModel):
    source_ref_id: str | None = None
    source_name: str | None = None
    target_ref_id: str | None = None
    target_name: str | None = None
    relationship_type: str
    strength: int


class MappingMatrixOut(BaseModel):
    source_framework_id: int
    source_framework_name: str
    target_framework_id: int
    target_framework_name: str
    total_mappings: int
    coverage_percent: float
    by_relationship: dict[str, int]
    by_strength: dict[int, int]
    mappings: list[MappingMatrixCell]


# ═══ Test Template ═══


class TestTemplateOut(BaseModel):
    id: int
    ref_id: str | None = None
    name: str
    description: str | None = None
    test_steps: list = []
    expected_evidence: list = []
    success_criteria: str | None = None
    failure_criteria: str | None = None
    test_type: str
    category: str | None = None
    difficulty: str
    estimated_hours: Decimal | None = None
    tags: list = []
    is_system: bool = False
    is_active: bool = True
    created_at: datetime
    model_config = {"from_attributes": True}


class TestTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    test_steps: list = []
    expected_evidence: list = []
    success_criteria: str | None = None
    failure_criteria: str | None = None
    test_type: str = "both"
    category: str | None = None
    difficulty: str = "basic"
    estimated_hours: Decimal | None = None
    tags: list = []


class TestTemplateUpdate(BaseModel):
    name: str | None = Field(None, max_length=300)
    description: str | None = None
    test_steps: list | None = None
    expected_evidence: list | None = None
    success_criteria: str | None = None
    failure_criteria: str | None = None
    test_type: str | None = None
    category: str | None = None
    difficulty: str | None = None
    estimated_hours: Decimal | None = None
    tags: list | None = None
    is_active: bool | None = None


# ═══ Compliance Dashboard ═══


class FrameworkComplianceSummary(BaseModel):
    framework_id: int
    framework_name: str
    document_type: str | None = None
    assessment_count: int = 0
    latest_score: Decimal | None = None
    latest_status: str | None = None
    total_requirements: int = 0
    compliant_count: int = 0


class ComplianceDashboardOut(BaseModel):
    """Aggregated compliance dashboard data."""
    total_frameworks: int = 0
    active_assessments: int = 0
    avg_compliance_score: Decimal | None = None
    open_findings: int = 0
    overdue_findings: int = 0
    active_engagements: int = 0
    frameworks: list[FrameworkComplianceSummary] = []
