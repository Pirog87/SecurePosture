"""Pydantic schemas for the Framework Engine."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ═══════════════════ Dimension Levels ═══════════════════

class DimensionLevelOut(BaseModel):
    id: int
    dimension_id: int
    level_order: int
    value: float
    label: str
    label_pl: str | None = None
    description: str | None = None
    color: str | None = None
    model_config = {"from_attributes": True}


class DimensionLevelCreate(BaseModel):
    level_order: int
    value: float
    label: str = Field(..., max_length=200)
    label_pl: str | None = Field(None, max_length=200)
    description: str | None = None
    color: str | None = Field(None, max_length=7)


# ═══════════════════ Assessment Dimensions ═══════════════════

class AssessmentDimensionOut(BaseModel):
    id: int
    framework_id: int
    dimension_key: str
    name: str
    name_pl: str | None = None
    description: str | None = None
    order_id: int = 0
    weight: float = 1.0
    is_active: bool = True
    levels: list[DimensionLevelOut] = []
    model_config = {"from_attributes": True}


class AssessmentDimensionCreate(BaseModel):
    dimension_key: str = Field(..., max_length=50)
    name: str = Field(..., max_length=200)
    name_pl: str | None = Field(None, max_length=200)
    description: str | None = None
    order_id: int = 0
    weight: float = 1.0
    levels: list[DimensionLevelCreate] = []


# ═══════════════════ Framework Nodes ═══════════════════

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
    implementation_groups: str | None = None
    weight: int = 1
    importance: str | None = None
    annotation: str | None = None
    typical_evidence: str | None = None
    is_active: bool = True
    model_config = {"from_attributes": True}


class FrameworkNodeTreeOut(FrameworkNodeOut):
    """Node with children for tree view."""
    children: list["FrameworkNodeTreeOut"] = []


# ═══════════════════ Framework ═══════════════════

class FrameworkOut(BaseModel):
    id: int
    urn: str
    ref_id: str
    name: str
    description: str | None = None
    version: str | None = None
    provider: str | None = None
    packager: str | None = None
    source_format: str | None = None
    locale: str = "en"
    implementation_groups_definition: dict | None = None
    total_nodes: int = 0
    total_assessable: int = 0
    imported_at: datetime | None = None
    imported_by: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class FrameworkDetailOut(FrameworkOut):
    """Framework with dimensions (no nodes — use /tree endpoint)."""
    dimensions: list[AssessmentDimensionOut] = []


class FrameworkCreate(BaseModel):
    urn: str = Field(..., max_length=500)
    ref_id: str = Field(..., max_length=100)
    name: str = Field(..., max_length=500)
    description: str | None = None
    version: str | None = Field(None, max_length=50)
    provider: str | None = Field(None, max_length=200)
    locale: str = Field("en", max_length=10)
    dimensions: list[AssessmentDimensionCreate] = []


# ═══════════════════ Area Mappings ═══════════════════

class AreaMappingOut(BaseModel):
    id: int
    framework_node_id: int
    security_area_id: int
    source: str
    created_by: str | None = None
    created_at: datetime
    # Denormalized for convenience
    node_ref_id: str | None = None
    node_name: str | None = None
    area_name: str | None = None
    model_config = {"from_attributes": True}


class BulkAreaMappingRequest(BaseModel):
    node_ids: list[int] = Field(..., min_length=1)
    security_area_id: int
    source: str = "manual"
    created_by: str | None = None


# ═══════════════════ Assessment ═══════════════════

class AssessmentOut(BaseModel):
    id: int
    ref_id: str | None = None
    framework_id: int
    framework_name: str | None = None
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    security_area_id: int | None = None
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


class AssessmentCreate(BaseModel):
    framework_id: int
    org_unit_id: int | None = None
    security_area_id: int | None = None
    title: str | None = Field(None, max_length=500)
    assessor: str | None = Field(None, max_length=200)
    assessment_date: date | None = None
    implementation_group_filter: str | None = Field(None, max_length=100)
    notes: str | None = None


class AssessmentApproveRequest(BaseModel):
    approved_by: str = Field(..., max_length=200)


# ═══════════════════ Assessment Answers ═══════════════════

class AssessmentAnswerOut(BaseModel):
    id: int
    assessment_id: int
    framework_node_id: int
    dimension_id: int
    level_id: int | None = None
    not_applicable: bool = False
    notes: str | None = None
    evidence: str | None = None
    # Denormalized
    node_ref_id: str | None = None
    dimension_key: str | None = None
    level_value: float | None = None
    level_label: str | None = None
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


# ═══════════════════ Scoring ═══════════════════

class NodeScore(BaseModel):
    framework_node_id: int
    ref_id: str | None = None
    name: str | None = None
    score: float | None = None
    dimensions: dict[str, float | None] = {}


class AssessmentScoreOut(BaseModel):
    assessment_id: int
    overall_score: float | None = None
    completion_pct: float | None = None
    node_scores: list[NodeScore] = []


# ═══════════════════ Import ═══════════════════

class ImportFromGithubRequest(BaseModel):
    framework_path: str = Field(..., description="Path within CISO Assistant repo, e.g. 'cis-controls-v8.xlsx'")
    auto_map_areas: bool = False


class ImportResult(BaseModel):
    framework_id: int
    framework_name: str
    total_nodes: int
    total_assessable: int
    dimensions_created: int
