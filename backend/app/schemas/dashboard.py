from datetime import datetime

from pydantic import BaseModel, Field


# ────────────────────────────────────────────────
# Shared / reusable pieces
# ────────────────────────────────────────────────

class OrgUnitRef(BaseModel):
    id: int
    name: str
    symbol: str


class RiskLevelCounts(BaseModel):
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0


class OverdueRiskItem(BaseModel):
    id: int
    asset_name: str
    org_unit: str
    risk_score: float
    risk_level: str
    days_since_review: int
    owner: str | None = None


# ────────────────────────────────────────────────
# 1. EXECUTIVE SUMMARY
# ────────────────────────────────────────────────

class ExecutiveKPI(BaseModel):
    label: str
    value: float | int | str
    unit: str | None = None
    trend: str | None = None          # "up" | "down" | "stable" | None
    color: str | None = None          # semantic color hint


class ExecutiveSummary(BaseModel):
    """Top-level KPIs for the CISO at a glance."""
    org_unit: OrgUnitRef | None = None  # None = whole organization
    kpis: list[ExecutiveKPI]
    risk_counts: RiskLevelCounts
    avg_risk_score: float | None = None
    # Framework Engine maturity (replaces old CIS-only fields)
    maturity_score: float | None = None         # Framework Engine overall_score (0–100)
    maturity_framework_name: str | None = None  # e.g. "CIS Controls v8"
    maturity_completion_pct: float | None = None
    # Legacy aliases — populated from Framework Engine data for backward compat
    cis_maturity_rating: float | None = None
    cis_risk_addressed_pct: float | None = None
    posture_score: float | None = None      # composite 0–100 (from Security Score engine)
    posture_grade: str | None = None        # A / B / C / D / F
    overdue_reviews_count: int = 0
    top_risks: list["TopRiskItem"] = []


class TopRiskItem(BaseModel):
    id: int
    asset_name: str
    risk_score: float
    risk_level: str
    org_unit: str
    security_area: str | None = None
    status: str | None = None


# ────────────────────────────────────────────────
# 2. RISK DASHBOARD
# ────────────────────────────────────────────────

class RiskByStatus(BaseModel):
    status: str
    status_color: str | None = None
    count: int


class RiskByArea(BaseModel):
    area_id: int
    area_name: str
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0
    avg_score: float | None = None


class RiskByOrgUnit(BaseModel):
    org_unit_id: int
    org_unit_name: str
    symbol: str
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0
    avg_score: float | None = None


class RiskMatrixCell(BaseModel):
    impact: int         # W: 1–3
    probability: int    # P: 1–3
    count: int
    risk_ids: list[int] = []


class RiskTrendPoint(BaseModel):
    period: str         # e.g. "2026-01"
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0
    avg_score: float | None = None


class RiskDashboard(BaseModel):
    """Full risk perspective."""
    org_unit: OrgUnitRef | None = None
    risk_counts: RiskLevelCounts
    avg_risk_score: float | None = None
    by_status: list[RiskByStatus] = []
    by_area: list[RiskByArea] = []
    by_org_unit: list[RiskByOrgUnit] = []
    matrix: list[RiskMatrixCell] = []
    trend: list[RiskTrendPoint] = []
    overdue_reviews: list[OverdueRiskItem] = []


# ────────────────────────────────────────────────
# 3. CIS DASHBOARD
# ────────────────────────────────────────────────

class CisDimensionScores(BaseModel):
    policy_pct: float | None = None
    implementation_pct: float | None = None
    automation_pct: float | None = None
    reporting_pct: float | None = None


class CisControlScore(BaseModel):
    control_number: int
    name_pl: str
    name_en: str
    applicable_subs: int = 0
    na_subs: int = 0
    risk_addressed_pct: float | None = None
    dimensions: CisDimensionScores = CisDimensionScores()


class CisIGScores(BaseModel):
    ig1: float | None = None
    ig2: float | None = None
    ig3: float | None = None


class AttackCapability(BaseModel):
    activity: str                      # e.g. "Initial Access"
    preventive_score: float | None = None
    detective_score: float | None = None
    preventive_level: str = "Low"      # Low / Moderate / High
    detective_level: str = "Low"


class CisDashboard(BaseModel):
    """CIS Controls v8 compliance perspective."""
    org_unit: OrgUnitRef | None = None
    assessment_id: int | None = None
    assessment_date: datetime | None = None
    maturity_rating: float | None = None
    risk_addressed_pct: float | None = None
    overall_dimensions: CisDimensionScores = CisDimensionScores()
    ig_scores: CisIGScores = CisIGScores()
    controls: list[CisControlScore] = []
    attack_capabilities: list[AttackCapability] = []


# ────────────────────────────────────────────────
# 4. CIS COMPARISON
# ────────────────────────────────────────────────

class CisComparisonUnit(BaseModel):
    org_unit: OrgUnitRef | None = None  # None = whole org
    assessment_id: int | None = None
    assessment_date: datetime | None = None
    maturity_rating: float | None = None
    risk_addressed_pct: float | None = None
    ig_scores: CisIGScores = CisIGScores()
    controls: list[CisControlScore] = []


class CisComparison(BaseModel):
    """Side-by-side CIS comparison for multiple org units."""
    units: list[CisComparisonUnit] = []


# ────────────────────────────────────────────────
# 5. CIS TREND
# ────────────────────────────────────────────────

class CisTrendPoint(BaseModel):
    assessment_id: int
    assessment_date: datetime
    maturity_rating: float | None = None
    risk_addressed_pct: float | None = None
    ig1: float | None = None
    ig2: float | None = None
    ig3: float | None = None


class CisTrend(BaseModel):
    """CIS maturity trend over time for an org unit."""
    org_unit: OrgUnitRef | None = None
    points: list[CisTrendPoint] = []


# ────────────────────────────────────────────────
# 6. SECURITY POSTURE SCORE (creative composite)
# ────────────────────────────────────────────────

class PostureDimension(BaseModel):
    name: str                       # e.g. "Zarządzanie ryzykiem"
    score: float                    # 0–100
    weight: float                   # fraction of total
    color: str | None = None


class PostureScoreResponse(BaseModel):
    """
    Composite Security Posture Score from the 10-pillar Security Score engine.
    Replaces the old 4-dimension hardcoded posture scoring.
    """
    org_unit: OrgUnitRef | None = None
    score: float = Field(..., ge=0, le=100, description="Composite score 0–100")
    grade: str                      # A / B / C / D / F
    rating: str | None = None       # "Dobry" / "Zadowalający" / "Wymaga poprawy" / "Krytyczny"
    dimensions: list[PostureDimension] = []
    config_version: int | None = None
    benchmark_avg: float | None = None  # average across all org units for context
