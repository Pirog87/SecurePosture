from datetime import datetime

from pydantic import BaseModel, Field


# ── OrgLevel ──

class OrgLevelOut(BaseModel):
    id: int
    level_number: int
    name: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class OrgLevelCreate(BaseModel):
    level_number: int = Field(..., ge=1)
    name: str = Field(..., min_length=1, max_length=100)


class OrgLevelUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)


# ── OrgUnit ──

class OrgUnitOut(BaseModel):
    id: int
    parent_id: int | None = None
    level_id: int
    level_name: str | None = None
    name: str
    symbol: str
    owner: str | None = None
    security_contact: str | None = None
    it_coordinator: str | None = None
    description: str | None = None
    is_active: bool = True
    created_at: datetime
    deactivated_at: datetime | None = None
    updated_at: datetime
    model_config = {"from_attributes": True}


class OrgUnitCreate(BaseModel):
    parent_id: int | None = None
    level_id: int
    name: str = Field(..., min_length=1, max_length=300)
    symbol: str = Field(..., min_length=1, max_length=30)
    owner: str | None = Field(None, max_length=200)
    security_contact: str | None = Field(None, max_length=200)
    it_coordinator: str | None = Field(None, max_length=200)
    description: str | None = None


class OrgUnitUpdate(BaseModel):
    parent_id: int | None = None
    level_id: int | None = None
    name: str | None = Field(None, min_length=1, max_length=300)
    symbol: str | None = Field(None, min_length=1, max_length=30)
    owner: str | None = Field(None, max_length=200)
    security_contact: str | None = Field(None, max_length=200)
    it_coordinator: str | None = Field(None, max_length=200)
    description: str | None = None
    is_active: bool | None = None


# ── Tree ──

class OrgUnitTreeNode(BaseModel):
    id: int
    parent_id: int | None = None
    level_id: int
    level_name: str | None = None
    name: str
    symbol: str
    owner: str | None = None
    security_contact: str | None = None
    it_coordinator: str | None = None
    is_active: bool = True
    children: list["OrgUnitTreeNode"] = []
