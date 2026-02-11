"""Pydantic schemas for Vendor (TPRM) module."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ═══ Vendor Assessment Answers ═══

class VendorAssessmentAnswerOut(BaseModel):
    id: int
    assessment_id: int
    question_code: str
    question_text: str
    answer: int
    notes: str | None = None
    model_config = {"from_attributes": True}


class VendorAssessmentAnswerCreate(BaseModel):
    question_code: str = Field(..., max_length=20)
    question_text: str
    answer: int = Field(..., ge=0, le=5)
    notes: str | None = None


# ═══ Vendor Assessments ═══

class VendorAssessmentOut(BaseModel):
    id: int
    vendor_id: int
    assessment_date: date
    assessed_by: str
    total_score: float | None = None
    risk_rating_id: int | None = None
    risk_rating_name: str | None = None
    notes: str | None = None
    answers: list[VendorAssessmentAnswerOut] = []
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class VendorAssessmentCreate(BaseModel):
    assessment_date: date
    assessed_by: str = Field(..., min_length=1, max_length=100)
    notes: str | None = None
    answers: list[VendorAssessmentAnswerCreate] = []


# ═══ Vendor ═══

class VendorOut(BaseModel):
    id: int
    ref_id: str | None = None
    name: str
    category_id: int | None = None
    category_name: str | None = None
    criticality_id: int | None = None
    criticality_name: str | None = None
    services_provided: str | None = None
    data_access_level_id: int | None = None
    data_access_level_name: str | None = None
    contract_owner: str | None = None
    security_contact: str | None = None
    contract_start: date | None = None
    contract_end: date | None = None
    sla_description: str | None = None
    status_id: int | None = None
    status_name: str | None = None
    last_assessment_date: date | None = None
    next_assessment_date: date | None = None
    risk_rating_id: int | None = None
    risk_rating_name: str | None = None
    risk_score: float | None = None
    questionnaire_completed: bool = False
    certifications: str | None = None
    risk_id: int | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class VendorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category_id: int | None = None
    criticality_id: int | None = None
    services_provided: str | None = None
    data_access_level_id: int | None = None
    contract_owner: str | None = Field(None, max_length=100)
    security_contact: str | None = Field(None, max_length=100)
    contract_start: date | None = None
    contract_end: date | None = None
    sla_description: str | None = None
    status_id: int | None = None
    certifications: str | None = None
    risk_id: int | None = None


class VendorUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    category_id: int | None = None
    criticality_id: int | None = None
    services_provided: str | None = None
    data_access_level_id: int | None = None
    contract_owner: str | None = Field(None, max_length=100)
    security_contact: str | None = Field(None, max_length=100)
    contract_start: date | None = None
    contract_end: date | None = None
    sla_description: str | None = None
    status_id: int | None = None
    certifications: str | None = None
    risk_id: int | None = None
    is_active: bool | None = None


class VendorStatusChange(BaseModel):
    status_id: int
