from datetime import date, datetime

from pydantic import BaseModel, Field


class RiskSafeguardRef(BaseModel):
    safeguard_id: int
    safeguard_name: str | None = None


class LinkedActionRef(BaseModel):
    """Action linked to this risk via action_links table."""
    action_id: int
    title: str
    status_name: str | None = None
    owner: str | None = None
    due_date: date | None = None
    is_overdue: bool = False


class RiskOut(BaseModel):
    id: int

    # Kontekst (ISO 31000 §5.3)
    org_unit_id: int
    org_unit_name: str | None = None
    risk_category_id: int | None = None
    risk_category_name: str | None = None
    risk_source: str | None = None

    # Identyfikacja (ISO 27005 §8.2)
    asset_id: int | None = None
    asset_id_name: str | None = None
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
    existing_controls: str | None = None
    control_effectiveness_id: int | None = None
    control_effectiveness_name: str | None = None
    consequence_description: str | None = None

    # Analiza (ISO 27005 §8.3)
    impact_level: int
    probability_level: int
    safeguard_rating: float
    risk_score: float | None = None
    risk_level: str | None = None

    # Postepowanie (ISO 27005 §8.5)
    status_id: int | None = None
    status_name: str | None = None
    strategy_id: int | None = None
    strategy_name: str | None = None
    owner: str | None = None
    planned_actions: str | None = None
    treatment_plan: str | None = None
    treatment_deadline: date | None = None
    treatment_resources: str | None = None
    residual_risk: float | None = None
    target_impact: int | None = None
    target_probability: int | None = None
    target_safeguard: float | None = None

    # Akceptacja (ISO 27005 §8.6)
    accepted_by: str | None = None
    accepted_at: datetime | None = None
    acceptance_justification: str | None = None

    # Monitorowanie (ISO 27005 §9)
    next_review_date: date | None = None
    identified_at: datetime
    last_review_at: datetime | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    safeguards: list[RiskSafeguardRef] = []
    linked_actions: list[LinkedActionRef] = []

    model_config = {"from_attributes": True}


class RiskCreate(BaseModel):
    # Kontekst
    org_unit_id: int
    risk_category_id: int | None = None
    risk_source: str | None = None

    # Identyfikacja
    asset_id: int | None = None
    asset_category_id: int | None = None
    asset_name: str = Field(..., min_length=1, max_length=400)
    sensitivity_id: int | None = None
    criticality_id: int | None = None
    security_area_id: int | None = None
    threat_id: int | None = None
    vulnerability_id: int | None = None
    existing_controls: str | None = None
    control_effectiveness_id: int | None = None
    consequence_description: str | None = None

    # Analiza
    impact_level: int = Field(..., ge=1, le=3)
    probability_level: int = Field(..., ge=1, le=3)
    safeguard_rating: float = Field(..., description="0.10 / 0.25 / 0.70 / 0.95")

    # Postepowanie
    status_id: int | None = None
    strategy_id: int | None = None
    owner: str | None = Field(None, max_length=200)
    planned_actions: str | None = None
    treatment_plan: str | None = None
    treatment_deadline: date | None = None
    treatment_resources: str | None = None
    residual_risk: float | None = None
    target_impact: int | None = Field(None, ge=1, le=3)
    target_probability: int | None = Field(None, ge=1, le=3)
    target_safeguard: float | None = None

    # Akceptacja
    accepted_by: str | None = Field(None, max_length=200)
    acceptance_justification: str | None = None

    # Monitorowanie
    next_review_date: date | None = None

    safeguard_ids: list[int] = []


class RiskUpdate(BaseModel):
    # Kontekst
    org_unit_id: int | None = None
    risk_category_id: int | None = None
    risk_source: str | None = None

    # Identyfikacja
    asset_id: int | None = None
    asset_category_id: int | None = None
    asset_name: str | None = Field(None, min_length=1, max_length=400)
    sensitivity_id: int | None = None
    criticality_id: int | None = None
    security_area_id: int | None = None
    threat_id: int | None = None
    vulnerability_id: int | None = None
    existing_controls: str | None = None
    control_effectiveness_id: int | None = None
    consequence_description: str | None = None

    # Analiza
    impact_level: int | None = Field(None, ge=1, le=3)
    probability_level: int | None = Field(None, ge=1, le=3)
    safeguard_rating: float | None = None

    # Postepowanie
    status_id: int | None = None
    strategy_id: int | None = None
    owner: str | None = Field(None, max_length=200)
    planned_actions: str | None = None
    treatment_plan: str | None = None
    treatment_deadline: date | None = None
    treatment_resources: str | None = None
    residual_risk: float | None = None
    target_impact: int | None = Field(None, ge=1, le=3)
    target_probability: int | None = Field(None, ge=1, le=3)
    target_safeguard: float | None = None

    # Akceptacja
    accepted_by: str | None = Field(None, max_length=200)
    acceptance_justification: str | None = None

    # Monitorowanie
    next_review_date: date | None = None
    is_active: bool | None = None

    safeguard_ids: list[int] | None = None


class RiskAcceptRequest(BaseModel):
    accepted_by: str = Field(..., min_length=1, max_length=200)
    acceptance_justification: str | None = None


class RiskListParams(BaseModel):
    org_unit_id: int | None = None
    security_area_id: int | None = None
    status_id: int | None = None
    risk_level: str | None = None
