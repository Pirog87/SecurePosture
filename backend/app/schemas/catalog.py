from datetime import datetime

from pydantic import BaseModel, Field


# ── Threats ──

class ThreatOut(BaseModel):
    id: int
    name: str
    category_id: int | None = None
    category_name: str | None = None
    description: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ThreatCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=400)
    category_id: int | None = None
    description: str | None = None


class ThreatUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=400)
    category_id: int | None = None
    description: str | None = None
    is_active: bool | None = None


# ── Vulnerabilities ──

class VulnerabilityOut(BaseModel):
    id: int
    name: str
    security_area_id: int | None = None
    security_area_name: str | None = None
    description: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class VulnerabilityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=400)
    security_area_id: int | None = None
    description: str | None = None


class VulnerabilityUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=400)
    security_area_id: int | None = None
    description: str | None = None
    is_active: bool | None = None


# ── Safeguards ──

class SafeguardOut(BaseModel):
    id: int
    name: str
    type_id: int | None = None
    type_name: str | None = None
    description: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class SafeguardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=400)
    type_id: int | None = None
    description: str | None = None


class SafeguardUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=400)
    type_id: int | None = None
    description: str | None = None
    is_active: bool | None = None
