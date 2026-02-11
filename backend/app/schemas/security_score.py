"""Pydantic schemas for Security Score module."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class PillarDetail(BaseModel):
    name: str
    score: float
    weight: float
    weighted_contribution: float


class SecurityScoreOut(BaseModel):
    total_score: float
    rating: str
    color: str
    pillars: list[PillarDetail]
    config_version: int
    calculated_at: datetime


class SnapshotOut(BaseModel):
    id: int
    snapshot_date: datetime
    total_score: float
    risk_score: float | None = None
    vulnerability_score: float | None = None
    incident_score: float | None = None
    exception_score: float | None = None
    maturity_score: float | None = None
    audit_score: float | None = None
    asset_score: float | None = None
    tprm_score: float | None = None
    policy_score: float | None = None
    awareness_score: float | None = None
    config_version: int | None = None
    triggered_by: str | None = None
    created_by: str | None = None
    model_config = {"from_attributes": True}


class ConfigOut(BaseModel):
    id: int
    version: int
    is_active: bool
    w_risk: float
    w_vulnerability: float
    w_incident: float
    w_exception: float
    w_maturity: float
    w_audit: float
    w_asset: float
    w_tprm: float
    w_policy: float
    w_awareness: float
    vuln_threshold_critical: int
    vuln_threshold_high: int
    vuln_threshold_medium: int
    vuln_threshold_low: int
    incident_ttr_critical: int
    incident_ttr_high: int
    incident_ttr_medium: int
    incident_ttr_low: int
    incident_window_days: int
    audit_sla_critical: int
    audit_sla_high: int
    audit_sla_medium: int
    audit_sla_low: int
    snapshot_frequency: str
    changed_by: str | None = None
    change_reason: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ConfigUpdate(BaseModel):
    w_risk: float | None = None
    w_vulnerability: float | None = None
    w_incident: float | None = None
    w_exception: float | None = None
    w_maturity: float | None = None
    w_audit: float | None = None
    w_asset: float | None = None
    w_tprm: float | None = None
    w_policy: float | None = None
    w_awareness: float | None = None
    vuln_threshold_critical: int | None = None
    vuln_threshold_high: int | None = None
    vuln_threshold_medium: int | None = None
    vuln_threshold_low: int | None = None
    incident_ttr_critical: int | None = None
    incident_ttr_high: int | None = None
    incident_ttr_medium: int | None = None
    incident_ttr_low: int | None = None
    incident_window_days: int | None = None
    audit_sla_critical: int | None = None
    audit_sla_high: int | None = None
    audit_sla_medium: int | None = None
    audit_sla_low: int | None = None
    snapshot_frequency: str | None = None
    changed_by: str | None = None
    change_reason: str | None = None


class MethodologyPillar(BaseModel):
    name: str
    weight: float
    description: str
    data_source: str
    formula: str
    current_score: float


class MethodologyOut(BaseModel):
    title: str
    config_version: int
    generated_at: datetime
    scale_description: str
    pillars: list[MethodologyPillar]
    total_score: float
    rating: str
