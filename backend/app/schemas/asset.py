from datetime import datetime

from pydantic import BaseModel, Field


class AssetOut(BaseModel):
    id: int
    name: str
    asset_type_id: int | None = None
    asset_type_name: str | None = None
    category_id: int | None = None
    category_name: str | None = None
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    parent_id: int | None = None
    parent_name: str | None = None
    owner: str | None = None
    description: str | None = None
    location: str | None = None
    sensitivity_id: int | None = None
    sensitivity_name: str | None = None
    criticality_id: int | None = None
    criticality_name: str | None = None
    is_active: bool = True
    risk_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AssetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=400)
    asset_type_id: int | None = None
    category_id: int | None = None
    org_unit_id: int | None = None
    parent_id: int | None = None
    owner: str | None = Field(None, max_length=200)
    description: str | None = None
    location: str | None = Field(None, max_length=300)
    sensitivity_id: int | None = None
    criticality_id: int | None = None


class AssetUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=400)
    asset_type_id: int | None = None
    category_id: int | None = None
    org_unit_id: int | None = None
    parent_id: int | None = None
    owner: str | None = Field(None, max_length=200)
    description: str | None = None
    location: str | None = Field(None, max_length=300)
    sensitivity_id: int | None = None
    criticality_id: int | None = None
    is_active: bool | None = None
