from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class AssetOut(BaseModel):
    id: int
    ref_id: str | None = None
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
    # CMDB extension
    asset_subtype: str | None = None
    technical_owner: str | None = None
    environment_id: int | None = None
    environment_name: str | None = None
    ip_address: str | None = None
    hostname: str | None = None
    os_version: str | None = None
    vendor: str | None = None
    support_end_date: date | None = None
    status_id: int | None = None
    status_name: str | None = None
    last_scan_date: date | None = None
    notes: str | None = None
    # CMDB Phase 2: category tree + custom attributes
    asset_category_id: int | None = None
    asset_category_name: str | None = None
    asset_category_code: str | None = None
    asset_category_icon: str | None = None
    asset_category_color: str | None = None
    custom_attributes: dict[str, Any] | None = None
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
    # CMDB extension
    asset_subtype: str | None = Field(None, max_length=100)
    technical_owner: str | None = Field(None, max_length=200)
    environment_id: int | None = None
    ip_address: str | None = Field(None, max_length=45)
    hostname: str | None = Field(None, max_length=255)
    os_version: str | None = Field(None, max_length=100)
    vendor: str | None = Field(None, max_length=100)
    support_end_date: date | None = None
    status_id: int | None = None
    last_scan_date: date | None = None
    notes: str | None = None
    # CMDB Phase 2
    asset_category_id: int | None = None
    custom_attributes: dict[str, Any] | None = None


class AssetRelationshipOut(BaseModel):
    id: int
    source_asset_id: int
    source_asset_name: str | None = None
    target_asset_id: int
    target_asset_name: str | None = None
    relationship_type: str
    description: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class AssetRelationshipCreate(BaseModel):
    source_asset_id: int
    target_asset_id: int
    relationship_type: str = Field(..., max_length=100)
    description: str | None = Field(None, max_length=500)


class AssetGraphNode(BaseModel):
    id: int
    name: str
    asset_type_name: str | None = None
    criticality_name: str | None = None
    org_unit_name: str | None = None
    risk_count: int = 0


class AssetGraphEdge(BaseModel):
    id: int
    source: int
    target: int
    type: str
    description: str | None = None


class AssetGraph(BaseModel):
    nodes: list[AssetGraphNode]
    edges: list[AssetGraphEdge]


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
    # CMDB extension
    asset_subtype: str | None = Field(None, max_length=100)
    technical_owner: str | None = Field(None, max_length=200)
    environment_id: int | None = None
    ip_address: str | None = Field(None, max_length=45)
    hostname: str | None = Field(None, max_length=255)
    os_version: str | None = Field(None, max_length=100)
    vendor: str | None = Field(None, max_length=100)
    support_end_date: date | None = None
    status_id: int | None = None
    last_scan_date: date | None = None
    notes: str | None = None
    # CMDB Phase 2
    asset_category_id: int | None = None
    custom_attributes: dict[str, Any] | None = None
    is_active: bool | None = None
