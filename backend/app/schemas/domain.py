from datetime import datetime

from pydantic import BaseModel, Field


class CisControlRef(BaseModel):
    cis_control_id: int
    control_number: int | None = None
    name_pl: str | None = None

    model_config = {"from_attributes": True}


class SecurityDomainOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    owner: str | None = None
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    cis_controls: list[CisControlRef] = []
    risk_count: int = 0

    model_config = {"from_attributes": True}


class SecurityDomainCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    icon: str | None = Field(None, max_length=50)
    color: str | None = Field(None, max_length=30)
    owner: str | None = Field(None, max_length=200)
    sort_order: int = 0
    cis_control_ids: list[int] = []


class SecurityDomainUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    icon: str | None = Field(None, max_length=50)
    color: str | None = Field(None, max_length=30)
    owner: str | None = Field(None, max_length=200)
    sort_order: int | None = None
    is_active: bool | None = None
    cis_control_ids: list[int] | None = None


class DomainScoreOut(BaseModel):
    """Score card for a single security domain."""
    domain_id: int
    domain_name: str
    icon: str | None = None
    color: str | None = None
    owner: str | None = None

    score: float  # 0-100
    grade: str    # A/B/C/D/F

    risk_count: int = 0
    risk_high: int = 0
    risk_medium: int = 0
    risk_low: int = 0
    avg_risk_score: float | None = None

    cis_pct: float | None = None  # CIS compliance % (None if no CIS mapping)
    cis_control_count: int = 0

    top_risks: list["DomainTopRisk"] = []


class DomainTopRisk(BaseModel):
    id: int
    asset_name: str
    risk_score: float
    risk_level: str
    org_unit_name: str | None = None


class DomainDashboardResponse(BaseModel):
    """Full domain dashboard — array of domain score cards."""
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    domains: list[DomainScoreOut] = []
    overall_score: float = 0
    overall_grade: str = "F"
