"""Pydantic schemas for the Requirements Repository (Repozytorium Wymagań).

Formerly Framework Engine schemas — extended to support all reference document types.
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# Dimension levels
# ─────────────────────────────────────────────

class DimensionLevelOut(BaseModel):
    id: int
    level_order: int
    value: float
    label: str
    label_pl: str | None = None
    description: str | None = None
    color: str | None = None
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Assessment dimensions
# ─────────────────────────────────────────────

class DimensionOut(BaseModel):
    id: int
    dimension_key: str
    name: str
    name_pl: str | None = None
    description: str | None = None
    order_id: int = 0
    weight: float = 1.0
    levels: list[DimensionLevelOut] = []
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Framework nodes
# ─────────────────────────────────────────────

class FrameworkNodeOut(BaseModel):
    id: int
    framework_id: int
    parent_id: int | None = None
    urn: str | None = None
    ref_id: str | None = None
    name: str
    name_pl: str | None = None
    description: str | None = None
    description_pl: str | None = None
    depth: int = 1
    order_id: int = 0
    assessable: bool = False
    point_type_id: int | None = None
    implementation_groups: str | None = None
    weight: int = 1
    importance: str | None = None
    maturity_level: int | None = None
    annotation: str | None = None
    typical_evidence: str | None = None
    model_config = {"from_attributes": True}


class FrameworkNodeTreeOut(FrameworkNodeOut):
    """Node with children for tree display."""
    children: list[FrameworkNodeTreeOut] = []


class FrameworkNodeBrief(BaseModel):
    """Compact node for list views."""
    id: int
    ref_id: str | None = None
    name: str
    name_pl: str | None = None
    depth: int
    assessable: bool
    point_type_id: int | None = None
    implementation_groups: str | None = None
    model_config = {"from_attributes": True}


class FrameworkNodeCreate(BaseModel):
    """Create a new node in a framework."""
    parent_id: int | None = None
    ref_id: str | None = None
    name: str = Field(..., min_length=1, max_length=500)
    name_pl: str | None = None
    description: str | None = None
    description_pl: str | None = None
    assessable: bool = False
    point_type_id: int | None = None
    implementation_groups: str | None = None
    weight: int = 1
    importance: str | None = None
    annotation: str | None = None
    typical_evidence: str | None = None


class FrameworkNodeUpdate(BaseModel):
    """Update an existing node."""
    ref_id: str | None = None
    name: str | None = Field(None, min_length=1, max_length=500)
    name_pl: str | None = None
    description: str | None = None
    description_pl: str | None = None
    assessable: bool | None = None
    point_type_id: int | None = None
    implementation_groups: str | None = None
    weight: int | None = None
    importance: str | None = None
    annotation: str | None = None
    typical_evidence: str | None = None
    parent_id: int | None = Field(None, description="Move node to new parent (null = root)")


class FrameworkNodeMoveRequest(BaseModel):
    """Reorder or move a node."""
    parent_id: int | None = None
    after_node_id: int | None = Field(None, description="Place after this sibling node")
    new_order_id: int | None = Field(None, description="New order_id value")


# ─────────────────────────────────────────────
# Frameworks / Reference Documents
# ─────────────────────────────────────────────

class FrameworkOut(BaseModel):
    id: int
    urn: str | None = None
    ref_id: str | None = None
    name: str
    description: str | None = None
    version: str | None = None
    provider: str | None = None
    packager: str | None = None
    source_format: str | None = None
    locale: str | None = None
    implementation_groups_definition: dict | list | None = None
    total_nodes: int = 0
    total_assessable: int = 0
    imported_at: datetime | None = None
    imported_by: str | None = None
    # Document Repository fields
    document_type_id: int | None = None
    document_type_name: str | None = None
    document_origin: str = "external"
    owner: str | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    requires_review: bool = False
    review_frequency_months: int = 12
    next_review_date: date | None = None
    last_reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    major_version: int = 1
    minor_version: int = 0
    display_version: str | None = None
    updates_document_id: int | None = None
    updates_document_name: str | None = None
    # Lifecycle
    lifecycle_status: str = "draft"
    edit_version: int = 1
    published_version: str | None = None
    last_edited_by: str | None = None
    last_edited_at: datetime | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    dimensions: list[DimensionOut] = []
    model_config = {"from_attributes": True}


class FrameworkBrief(BaseModel):
    """Short framework info for list views."""
    id: int
    ref_id: str | None = None
    name: str
    version: str | None = None
    provider: str | None = None
    total_nodes: int = 0
    total_assessable: int = 0
    lifecycle_status: str = "draft"
    edit_version: int = 1
    published_version: str | None = None
    is_active: bool = True
    source_format: str | None = None
    # Document Repository fields
    document_type_id: int | None = None
    document_type_name: str | None = None
    document_origin: str = "external"
    owner: str | None = None
    requires_review: bool = False
    next_review_date: date | None = None
    major_version: int = 1
    minor_version: int = 0
    display_version: str | None = None
    updates_document_id: int | None = None
    model_config = {"from_attributes": True}


class FrameworkCreate(BaseModel):
    """Create a new reference document manually."""
    name: str = Field(..., min_length=1, max_length=500)
    ref_id: str | None = Field(None, max_length=100)
    description: str | None = None
    version: str | None = Field(None, max_length=50)
    provider: str | None = Field(None, max_length=200)
    locale: str = "pl"
    # Document Repository fields
    document_type_id: int | None = None
    document_origin: str = "external"
    owner: str | None = Field(None, max_length=200)
    requires_review: bool = False
    review_frequency_months: int = 12
    updates_document_id: int | None = None


class FrameworkUpdate(BaseModel):
    """Update framework/document metadata."""
    name: str | None = Field(None, min_length=1, max_length=500)
    ref_id: str | None = Field(None, max_length=100)
    description: str | None = None
    version: str | None = Field(None, max_length=50)
    provider: str | None = Field(None, max_length=200)
    locale: str | None = None
    published_version: str | None = Field(None, max_length=100)
    change_summary: str | None = Field(None, description="Opis zmian do historii wersji")
    # Document Repository fields
    document_type_id: int | None = None
    document_origin: str | None = None
    owner: str | None = Field(None, max_length=200)
    requires_review: bool | None = None
    review_frequency_months: int | None = None


class LifecycleChangeRequest(BaseModel):
    """Change framework lifecycle status."""
    status: str = Field(..., description="Nowy status: draft, review, published, deprecated, archived")
    change_summary: str | None = None
    keep_existing_assessments: bool | None = Field(
        None,
        description="When approving a new version: True = keep existing assessments, False = require re-assessment",
    )


class FrameworkImportResult(BaseModel):
    """Response after importing a framework."""
    framework_id: int
    name: str
    total_nodes: int
    total_assessable: int
    dimensions_created: int


class FrameworkImportAdoptionRequest(BaseModel):
    """Adoption form during import — allows setting attributes before final import."""
    name: str | None = None
    ref_id: str | None = None
    description: str | None = None
    document_type_id: int | None = None
    document_origin: str = "external"
    owner: str | None = None
    requires_review: bool = False
    review_frequency_months: int = 12
    updates_document_id: int | None = Field(
        None,
        description="If set, marks this as an update proposal for the specified document",
    )


# ─────────────────────────────────────────────
# Version history
# ─────────────────────────────────────────────

class FrameworkVersionOut(BaseModel):
    id: int
    framework_id: int
    edit_version: int
    lifecycle_status: str
    change_summary: str | None = None
    changed_by: str | None = None
    changed_at: datetime
    snapshot_nodes_count: int | None = None
    snapshot_assessable_count: int | None = None
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Area mappings
# ─────────────────────────────────────────────

class AreaMappingOut(BaseModel):
    id: int
    framework_node_id: int
    node_ref_id: str | None = None
    node_name: str | None = None
    security_area_id: int
    security_area_name: str | None = None
    source: str | None = None
    created_by: str | None = None
    model_config = {"from_attributes": True}


class AreaMappingBulkCreate(BaseModel):
    framework_node_ids: list[int]
    security_area_id: int
    source: str = "manual"


# ─────────────────────────────────────────────
# Org Unit linking (document ↔ org unit)
# ─────────────────────────────────────────────

class FrameworkOrgUnitOut(BaseModel):
    id: int
    framework_id: int
    org_unit_id: int
    org_unit_name: str | None = None
    compliance_status: str = "not_assessed"
    last_assessed_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class FrameworkOrgUnitCreate(BaseModel):
    org_unit_ids: list[int] = Field(..., min_length=1, description="IDs of org units to link")
    notes: str | None = None


class FrameworkOrgUnitUpdate(BaseModel):
    compliance_status: str | None = None
    notes: str | None = None


# ─────────────────────────────────────────────
# Document reviews
# ─────────────────────────────────────────────

class FrameworkReviewOut(BaseModel):
    id: int
    framework_id: int
    reviewer: str | None = None
    review_date: datetime
    review_type: str = "periodic"
    findings: str | None = None
    recommendations: str | None = None
    status: str = "completed"
    next_review_date: date | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class FrameworkReviewCreate(BaseModel):
    reviewer: str | None = Field(None, max_length=200)
    review_type: str = "periodic"
    findings: str | None = None
    recommendations: str | None = None
    status: str = "completed"
    next_review_date: date | None = None


# ─────────────────────────────────────────────
# Document copy
# ─────────────────────────────────────────────

class FrameworkCopyRequest(BaseModel):
    """Copy a document with all its relations."""
    name: str | None = Field(None, description="New name (default: 'Copy of {original}')")
    copy_org_unit_links: bool = True
    copy_assessments: bool = False


# ─────────────────────────────────────────────
# Assessments
# ─────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    framework_id: int
    org_unit_id: int | None = None
    security_area_id: int | None = None
    title: str | None = None
    assessor: str | None = Field(None, max_length=200)
    assessment_date: date | None = None
    implementation_group_filter: str | None = None
    notes: str | None = None
    copy_from_assessment_id: int | None = None


class AssessmentUpdate(BaseModel):
    title: str | None = None
    assessor: str | None = Field(None, max_length=200)
    status: str | None = None
    notes: str | None = None
    implementation_group_filter: str | None = None


class AssessmentOut(BaseModel):
    id: int
    ref_id: str | None = None
    framework_id: int
    framework_name: str | None = None
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    security_area_id: int | None = None
    security_area_name: str | None = None
    title: str | None = None
    assessor: str | None = None
    assessment_date: date
    status: str = "draft"
    implementation_group_filter: str | None = None
    notes: str | None = None
    completion_pct: float | None = None
    overall_score: float | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AssessmentBrief(BaseModel):
    id: int
    framework_name: str | None = None
    org_unit_name: str | None = None
    assessment_date: date
    status: str
    overall_score: float | None = None
    completion_pct: float | None = None
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Assessment answers
# ─────────────────────────────────────────────

class AnswerOut(BaseModel):
    id: int
    assessment_id: int
    framework_node_id: int
    node_ref_id: str | None = None
    node_name: str | None = None
    dimension_id: int
    dimension_key: str | None = None
    level_id: int | None = None
    level_value: float | None = None
    level_label: str | None = None
    not_applicable: bool = False
    notes: str | None = None
    evidence: str | None = None
    model_config = {"from_attributes": True}


class AnswerUpsert(BaseModel):
    framework_node_id: int
    dimension_id: int
    level_id: int | None = None
    not_applicable: bool = False
    notes: str | None = None
    evidence: str | None = None


class AnswersBatchUpsert(BaseModel):
    answers: list[AnswerUpsert] = Field(..., min_length=1)


# ─────────────────────────────────────────────
# Scoring
# ─────────────────────────────────────────────

class NodeScoreOut(BaseModel):
    """Score for a single assessable node."""
    framework_node_id: int
    ref_id: str | None = None
    name: str | None = None
    score: float | None = None
    dimension_scores: dict[str, float | None] = {}
    not_applicable: bool = False


class AssessmentScoreOut(BaseModel):
    """Full scoring breakdown for an assessment."""
    assessment_id: int
    overall_score: float | None = None
    completion_pct: float | None = None
    total_assessable: int = 0
    answered_count: int = 0
    na_count: int = 0
    node_scores: list[NodeScoreOut] = []
    dimension_averages: dict[str, float | None] = {}
    ig_scores: dict[str, float | None] = {}


class AssessmentCompareOut(BaseModel):
    """Side-by-side comparison of two assessments."""
    assessments: list[AssessmentOut] = []
    scores: list[AssessmentScoreOut] = []


# ─────────────────────────────────────────────
# Dimensions edit
# ─────────────────────────────────────────────

class DimensionLevelUpsert(BaseModel):
    level_order: int
    value: float
    label: str
    label_pl: str | None = None
    description: str | None = None
    color: str | None = None


class DimensionUpsert(BaseModel):
    dimension_key: str
    name: str
    name_pl: str | None = None
    description: str | None = None
    order_id: int = 0
    weight: float = 1.0
    levels: list[DimensionLevelUpsert] = []


class DimensionsUpdate(BaseModel):
    dimensions: list[DimensionUpsert] = Field(..., min_length=1)


# ─────────────────────────────────────────────
# Auto-map areas
# ─────────────────────────────────────────────

class AutoMapResult(BaseModel):
    framework_id: int
    mappings_created: int


# ─────────────────────────────────────────────
# Control Maturity metrics (for Security Score)
# ─────────────────────────────────────────────

class FrameworkMetricUnit(BaseModel):
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    assessment_id: int | None = None
    assessment_date: date | None = None
    overall_score: float | None = None
    completion_pct: float | None = None


class FrameworkMetrics(BaseModel):
    framework_id: int
    framework_name: str
    units: list[FrameworkMetricUnit] = []
    organization_score: float | None = None
