"""Pydantic schemas for Control Effectiveness Assessment module."""
from datetime import date, datetime

from pydantic import BaseModel, Field


# ═══════════════════ Tests ═══════════════════

class TestOut(BaseModel):
    id: int
    ref_id: str
    implementation_id: int
    test_date: date
    test_type: str
    tester: str
    result: str
    design_score: float | None = None
    operational_score: float | None = None
    findings: str | None = None
    recommendations: str | None = None
    evidence_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TestCreate(BaseModel):
    test_date: date
    test_type: str = Field(..., pattern=r"^(manual_test|automated_test|audit|review|pentest)$")
    tester: str = Field(..., min_length=1, max_length=200)
    result: str = Field(..., pattern=r"^(positive|conditional|negative)$")
    design_score: float | None = Field(None, ge=0, le=100)
    operational_score: float | None = Field(None, ge=0, le=100)
    findings: str | None = None
    recommendations: str | None = None
    evidence_url: str | None = Field(None, max_length=500)


# ═══════════════════ Implementations ═══════════════════

class ImplementationOut(BaseModel):
    id: int
    ref_id: str
    control_id: int
    control_name: str | None = None
    control_ref_id: str | None = None
    org_unit_id: int
    org_unit_name: str | None = None
    asset_id: int | None = None
    asset_name: str | None = None
    security_area_id: int | None = None
    security_area_name: str | None = None

    status: str
    responsible: str | None = None
    implementation_date: date | None = None
    description: str | None = None
    evidence_url: str | None = None
    evidence_notes: str | None = None

    design_effectiveness: float | None = None
    operational_effectiveness: float | None = None
    coverage_percent: float | None = None
    overall_effectiveness: float | None = None

    test_frequency_days: int | None = None
    last_test_date: date | None = None
    next_test_date: date | None = None

    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    tests: list[TestOut] = []

    model_config = {"from_attributes": True}


class ImplementationCreate(BaseModel):
    control_id: int
    org_unit_id: int
    asset_id: int | None = None
    security_area_id: int | None = None

    status: str = Field(
        "planned",
        pattern=r"^(planned|in_progress|implemented|partial|not_applicable)$",
    )
    responsible: str | None = Field(None, max_length=200)
    implementation_date: date | None = None
    description: str | None = None
    evidence_url: str | None = Field(None, max_length=500)
    evidence_notes: str | None = None

    design_effectiveness: float | None = Field(None, ge=0, le=100)
    operational_effectiveness: float | None = Field(None, ge=0, le=100)
    coverage_percent: float | None = Field(None, ge=0, le=100)

    test_frequency_days: int | None = Field(None, ge=1)
    last_test_date: date | None = None
    next_test_date: date | None = None


class ImplementationUpdate(BaseModel):
    control_id: int | None = None
    org_unit_id: int | None = None
    asset_id: int | None = None
    security_area_id: int | None = None

    status: str | None = Field(
        None,
        pattern=r"^(planned|in_progress|implemented|partial|not_applicable)$",
    )
    responsible: str | None = Field(None, max_length=200)
    implementation_date: date | None = None
    description: str | None = None
    evidence_url: str | None = Field(None, max_length=500)
    evidence_notes: str | None = None

    design_effectiveness: float | None = Field(None, ge=0, le=100)
    operational_effectiveness: float | None = Field(None, ge=0, le=100)
    coverage_percent: float | None = Field(None, ge=0, le=100)

    test_frequency_days: int | None = Field(None, ge=1)
    last_test_date: date | None = None
    next_test_date: date | None = None
    is_active: bool | None = None


# ═══════════════════ Metrics ═══════════════════

class EffectivenessMetrics(BaseModel):
    total_controls_in_catalog: int = 0
    total_implementations: int = 0
    implemented_count: int = 0
    partial_count: int = 0
    planned_count: int = 0
    not_applicable_count: int = 0

    avg_design_effectiveness: float | None = None
    avg_operational_effectiveness: float | None = None
    avg_overall_effectiveness: float | None = None
    avg_coverage: float | None = None

    tests_last_90_days: int = 0
    overdue_tests: int = 0
    positive_test_rate: float | None = None

    # Derived safeguard_rating recommendation
    recommended_safeguard_rating: float | None = None
