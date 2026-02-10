from datetime import datetime

from pydantic import BaseModel, Field


# ── Reference data (read-only) ──

class CisSubControlOut(BaseModel):
    id: int
    control_id: int
    sub_id: str
    detail_en: str
    detail_pl: str | None = None
    nist_csf: str | None = None
    implementation_groups: str | None = None
    sensor_baseline: str | None = None
    model_config = {"from_attributes": True}


class CisControlOut(BaseModel):
    id: int
    control_number: int
    name_en: str
    name_pl: str
    sub_control_count: int = 0
    sub_controls: list[CisSubControlOut] = []
    model_config = {"from_attributes": True}


# ── Assessment ──

class CisAssessmentOut(BaseModel):
    id: int
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    assessor_id: int | None = None
    assessor_name: str | None = None
    status_id: int | None = None
    status_name: str | None = None
    notes: str | None = None
    assessment_date: datetime

    maturity_rating: float | None = None
    risk_addressed_pct: float | None = None
    ig1_score: float | None = None
    ig2_score: float | None = None
    ig3_score: float | None = None

    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class CisAssessmentCreate(BaseModel):
    org_unit_id: int | None = None
    assessor_name: str | None = Field(None, max_length=200)
    status_id: int | None = None
    notes: str | None = None
    copy_from_assessment_id: int | None = None


class CisAssessmentUpdate(BaseModel):
    assessor_name: str | None = Field(None, max_length=200)
    status_id: int | None = None
    notes: str | None = None


# ── Answers ──

class CisAnswerOut(BaseModel):
    id: int
    assessment_id: int
    sub_control_id: int
    sub_id: str | None = None

    policy_status_id: int | None = None
    impl_status_id: int | None = None
    auto_status_id: int | None = None
    report_status_id: int | None = None

    is_not_applicable: bool = False

    policy_value: float | None = None
    impl_value: float | None = None
    auto_value: float | None = None
    report_value: float | None = None

    model_config = {"from_attributes": True}


class CisAnswerUpsert(BaseModel):
    sub_control_id: int
    policy_status_id: int | None = None
    impl_status_id: int | None = None
    auto_status_id: int | None = None
    report_status_id: int | None = None
    is_not_applicable: bool = False
    policy_value: float | None = None
    impl_value: float | None = None
    auto_value: float | None = None
    report_value: float | None = None


class CisAnswersBatchUpsert(BaseModel):
    answers: list[CisAnswerUpsert] = Field(..., min_length=1)
