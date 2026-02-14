"""Pydantic schemas for Smart Catalog API endpoints."""
from datetime import datetime

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
# Threat Catalog
# ═══════════════════════════════════════════════════════════════════

class ThreatCatalogOut(BaseModel):
    id: int
    ref_id: str
    name: str
    description: str | None = None
    category: str
    source: str = "BOTH"
    cia_impact: dict | None = None
    is_system: bool = False
    is_active: bool = True
    org_unit_id: int | None = None
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime
    asset_category_ids: list[int] = []
    model_config = {"from_attributes": True}


class ThreatCatalogCreate(BaseModel):
    ref_id: str | None = Field(None, max_length=20)
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    category: str = Field(default="ORGANIZATIONAL", max_length=30)
    source: str = Field(default="BOTH", max_length=15)
    cia_impact: dict | None = None
    org_unit_id: int | None = None
    asset_category_ids: list[int] = []


class ThreatCatalogUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    category: str | None = Field(None, max_length=30)
    source: str | None = Field(None, max_length=15)
    cia_impact: dict | None = None
    is_active: bool | None = None
    asset_category_ids: list[int] | None = None


# ═══════════════════════════════════════════════════════════════════
# Weakness Catalog
# ═══════════════════════════════════════════════════════════════════

class WeaknessCatalogOut(BaseModel):
    id: int
    ref_id: str
    name: str
    description: str | None = None
    category: str
    is_system: bool = False
    is_active: bool = True
    org_unit_id: int | None = None
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime
    asset_category_ids: list[int] = []
    model_config = {"from_attributes": True}


class WeaknessCatalogCreate(BaseModel):
    ref_id: str | None = Field(None, max_length=20)
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    category: str = Field(default="PROCESS", max_length=20)
    org_unit_id: int | None = None
    asset_category_ids: list[int] = []


class WeaknessCatalogUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    category: str | None = Field(None, max_length=20)
    is_active: bool | None = None
    asset_category_ids: list[int] | None = None


# ═══════════════════════════════════════════════════════════════════
# Control Catalog
# ═══════════════════════════════════════════════════════════════════

class ControlCatalogOut(BaseModel):
    id: int
    ref_id: str
    name: str
    description: str | None = None
    category: str
    implementation_type: str
    is_system: bool = False
    is_active: bool = True
    org_unit_id: int | None = None
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime
    asset_category_ids: list[int] = []
    model_config = {"from_attributes": True}


class ControlCatalogCreate(BaseModel):
    ref_id: str | None = Field(None, max_length=20)
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    category: str = Field(default="ORGANIZATIONAL", max_length=20)
    implementation_type: str = Field(default="PREVENTIVE", max_length=20)
    org_unit_id: int | None = None
    asset_category_ids: list[int] = []


class ControlCatalogUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    category: str | None = Field(None, max_length=20)
    implementation_type: str | None = Field(None, max_length=20)
    is_active: bool | None = None
    asset_category_ids: list[int] | None = None


# ═══════════════════════════════════════════════════════════════════
# Correlation Links
# ═══════════════════════════════════════════════════════════════════

class LinkOut(BaseModel):
    id: int
    relevance: str | None = None
    effectiveness: str | None = None
    description: str | None = None
    is_system: bool = False
    created_at: datetime
    # Inline names for convenience
    threat_id: int | None = None
    threat_ref_id: str | None = None
    threat_name: str | None = None
    weakness_id: int | None = None
    weakness_ref_id: str | None = None
    weakness_name: str | None = None
    control_id: int | None = None
    control_ref_id: str | None = None
    control_name: str | None = None
    model_config = {"from_attributes": True}


class ThreatWeaknessLinkCreate(BaseModel):
    threat_id: int
    weakness_id: int
    relevance: str = Field(default="MEDIUM", max_length=10)
    description: str | None = None


class ThreatControlLinkCreate(BaseModel):
    threat_id: int
    control_id: int
    effectiveness: str = Field(default="MEDIUM", max_length=10)
    description: str | None = None


class WeaknessControlLinkCreate(BaseModel):
    weakness_id: int
    control_id: int
    effectiveness: str = Field(default="MEDIUM", max_length=10)
    description: str | None = None


class ThreatWeaknessLinkUpdate(BaseModel):
    relevance: str | None = Field(None, max_length=10)
    description: str | None = None


class ThreatControlLinkUpdate(BaseModel):
    effectiveness: str | None = Field(None, max_length=10)
    description: str | None = None


class WeaknessControlLinkUpdate(BaseModel):
    effectiveness: str | None = Field(None, max_length=10)
    description: str | None = None


# ═══════════════════════════════════════════════════════════════════
# Suggestions
# ═══════════════════════════════════════════════════════════════════

class WeaknessSuggestion(BaseModel):
    weakness_id: int
    ref_id: str
    name: str
    relevance: str
    description: str | None = None


class ControlSuggestion(BaseModel):
    control_id: int
    ref_id: str
    name: str
    effectiveness: str
    description: str | None = None
    applied_status: str | None = None  # IMPLEMENTED, PARTIALLY_IMPLEMENTED, etc.
    applied_control_id: int | None = None


class ThreatSuggestion(BaseModel):
    threat_id: int
    ref_id: str
    name: str
    effectiveness: str


class QuickRiskDraft(BaseModel):
    threat_id: int
    threat_ref_id: str
    threat_name: str
    weaknesses: list[WeaknessSuggestion] = []
    suggested_controls: list[ControlSuggestion] = []
    existing_controls: list[ControlSuggestion] = []


class CoverageResult(BaseModel):
    total_threats: int
    covered: int
    gaps: list[dict] = []
    coverage_pct: float


# ═══════════════════════════════════════════════════════════════════
# Feature Flags
# ═══════════════════════════════════════════════════════════════════

class FeatureFlagsOut(BaseModel):
    ai_enabled: bool = False
    ai_features: dict = {}


# ═══════════════════════════════════════════════════════════════════
# AI Config (admin)
# ═══════════════════════════════════════════════════════════════════

class AIConfigOut(BaseModel):
    id: int
    provider_type: str
    api_endpoint: str | None = None
    api_key_masked: str | None = None
    model_name: str | None = None
    is_active: bool = False
    max_tokens: int = 4000
    temperature: float = 0.3
    max_requests_per_user_per_hour: int = 20
    max_requests_per_user_per_day: int = 100
    max_requests_per_org_per_day: int = 500
    feature_scenario_generation: bool = True
    feature_correlation_enrichment: bool = True
    feature_natural_language_search: bool = True
    feature_gap_analysis: bool = True
    feature_entry_assist: bool = True
    last_test_at: datetime | None = None
    last_test_ok: bool | None = None
    last_test_error: str | None = None
    model_config = {"from_attributes": True}


class AIConfigUpdate(BaseModel):
    provider_type: str | None = None
    api_endpoint: str | None = None
    api_key: str | None = None  # plaintext; will be encrypted server-side
    model_name: str | None = None
    max_tokens: int | None = None
    temperature: float | None = None
    max_requests_per_user_per_hour: int | None = None
    max_requests_per_user_per_day: int | None = None
    max_requests_per_org_per_day: int | None = None
    feature_scenario_generation: bool | None = None
    feature_correlation_enrichment: bool | None = None
    feature_natural_language_search: bool | None = None
    feature_gap_analysis: bool | None = None
    feature_entry_assist: bool | None = None


class AITestResult(BaseModel):
    success: bool
    message: str
    response_time_ms: int | None = None


# ═══════════════════════════════════════════════════════════════════
# AI Endpoints (available only when ai_enabled=true)
# ═══════════════════════════════════════════════════════════════════

class AIScenarioRequest(BaseModel):
    asset_category_id: int
    org_context: str | None = None


class AIScenarioOut(BaseModel):
    scenarios: list[dict] = []
    ai_request_id: int | None = None


class AIEnrichRequest(BaseModel):
    scope: str = Field(default="all", pattern="^(threats|weaknesses|controls|all)$")


class AIEnrichOut(BaseModel):
    suggestions: list[dict] = []
    ai_request_id: int | None = None


class AISearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)


class AISearchOut(BaseModel):
    asset_category_codes: list[str] = []
    threat_categories: list[str] = []
    keywords: list[str] = []
    interpretation: str | None = None


class AIGapRequest(BaseModel):
    asset_category_id: int | None = None


class AIGapOut(BaseModel):
    critical_gaps: list[dict] = []
    recommendations: list[dict] = []
    coverage_pct: float | None = None
    immediate_actions: list[dict] = []


class AIAssistRequest(BaseModel):
    entry_type: str = Field(..., pattern="^(threat|weakness|control)$")
    name: str = Field(..., min_length=1, max_length=300)
    description: str = Field(default="", max_length=2000)


class AIAssistOut(BaseModel):
    applicable_asset_categories: list[str] = []
    category: str | None = None
    cia_impact: dict | None = None
    suggested_correlations: list[dict] = []


class AIInterpretRequest(BaseModel):
    framework_name: str = Field(..., min_length=1, max_length=300)
    node_ref_id: str | None = None
    node_name: str = Field(..., min_length=1, max_length=500)
    node_description: str | None = None


class AIInterpretOut(BaseModel):
    interpretation: str = ""
    practical_examples: list[str] = []
    common_pitfalls: list[str] = []
    related_standards: list[str] = []


class AITranslateRequest(BaseModel):
    framework_name: str = Field(..., min_length=1, max_length=300)
    node_ref_id: str | None = None
    node_name: str = Field(..., min_length=1, max_length=500)
    node_description: str | None = None
    target_language: str = Field(..., min_length=2, max_length=50)


class AITranslateOut(BaseModel):
    translated_name: str = ""
    translated_description: str | None = None
    terminology_notes: list[str] = []


class AIUsageStatsOut(BaseModel):
    requests_count: int = 0
    tokens_used: int = 0
    cost_usd: float = 0.0
    acceptance_rate: float | None = None
    by_action: dict = {}
