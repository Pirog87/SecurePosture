from datetime import datetime

from pydantic import BaseModel, Field


class RiskSafeguardRef(BaseModel):
    safeguard_id: int
    safeguard_name: str | None = None


class RiskOut(BaseModel):
    id: int
    org_unit_id: int
    org_unit_name: str | None = None
    asset_category_id: int | None = None
    asset_category_name: str | None = None
    asset_name: str
    sensitivity_id: int | None = None
    sensitivity_name: str | None = None
    criticality_id: int | None = None
    criticality_name: str | None = None
    security_area_id: int | None = None
    security_area_name: str | None = None
    threat_id: int | None = None
    threat_name: str | None = None
    vulnerability_id: int | None = None
    vulnerability_name: str | None = None

    impact_level: int
    probability_level: int
    safeguard_rating: float

    risk_score: float | None = None
    risk_level: str | None = None

    status_id: int | None = None
    status_name: str | None = None
    strategy_id: int | None = None
    strategy_name: str | None = None
    owner: str | None = None
    planned_actions: str | None = None
    residual_risk: float | None = None

    identified_at: datetime
    last_review_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    safeguards: list[RiskSafeguardRef] = []

    model_config = {"from_attributes": True}


class RiskCreate(BaseModel):
    org_unit_id: int
    asset_category_id: int | None = None
    asset_name: str = Field(..., min_length=1, max_length=400)
    sensitivity_id: int | None = None
    criticality_id: int | None = None
    security_area_id: int | None = None
    threat_id: int | None = None
    vulnerability_id: int | None = None

    impact_level: int = Field(..., ge=1, le=3)
    probability_level: int = Field(..., ge=1, le=3)
    safeguard_rating: float = Field(..., description="0.10 / 0.25 / 0.70 / 0.95")

    status_id: int | None = None
    strategy_id: int | None = None
    owner: str | None = Field(None, max_length=200)
    planned_actions: str | None = None
    residual_risk: float | None = None

    safeguard_ids: list[int] = []


class RiskUpdate(BaseModel):
    org_unit_id: int | None = None
    asset_category_id: int | None = None
    asset_name: str | None = Field(None, min_length=1, max_length=400)
    sensitivity_id: int | None = None
    criticality_id: int | None = None
    security_area_id: int | None = None
    threat_id: int | None = None
    vulnerability_id: int | None = None

    impact_level: int | None = Field(None, ge=1, le=3)
    probability_level: int | None = Field(None, ge=1, le=3)
    safeguard_rating: float | None = None

    status_id: int | None = None
    strategy_id: int | None = None
    owner: str | None = Field(None, max_length=200)
    planned_actions: str | None = None
    residual_risk: float | None = None

    safeguard_ids: list[int] | None = None


class RiskListParams(BaseModel):
    org_unit_id: int | None = None
    security_area_id: int | None = None
    status_id: int | None = None
    risk_level: str | None = None
