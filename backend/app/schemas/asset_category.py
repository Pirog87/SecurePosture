from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Asset Category ──

class AssetCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    name_plural: str | None = Field(None, max_length=200)
    code: str = Field(..., min_length=1, max_length=100)
    icon: str | None = Field(None, max_length=50)
    color: str | None = Field(None, max_length=7)
    description: str | None = None
    is_abstract: bool = False
    sort_order: int = 0


class AssetCategoryCreate(AssetCategoryBase):
    parent_id: int | None = None


class AssetCategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    name_plural: str | None = Field(None, max_length=200)
    icon: str | None = Field(None, max_length=50)
    color: str | None = Field(None, max_length=7)
    description: str | None = None
    is_abstract: bool | None = None
    sort_order: int | None = None
    parent_id: int | None = None
    is_active: bool | None = None


class AssetCategoryOut(AssetCategoryBase):
    id: int
    parent_id: int | None = None
    is_active: bool = True
    asset_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AssetCategoryTreeNode(AssetCategoryOut):
    children: list["AssetCategoryTreeNode"] = []


# ── Category Field Definition ──

class FieldDefinitionBase(BaseModel):
    field_key: str = Field(..., min_length=1, max_length=100)
    label: str = Field(..., min_length=1, max_length=200)
    label_en: str | None = Field(None, max_length=200)
    field_type: str = Field(..., max_length=50)  # text, number, date, boolean, select, multiselect, reference, textarea, url, email
    tab_name: str = Field("Informacje", max_length=100)
    section_name: str | None = Field(None, max_length=200)
    is_required: bool = False
    is_unique: bool = False
    default_value: str | None = Field(None, max_length=500)
    placeholder: str | None = Field(None, max_length=300)
    help_text: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    max_length: int | None = None
    regex_pattern: str | None = Field(None, max_length=500)
    options_json: Any | None = None
    reference_category_id: int | None = None
    show_in_list: bool = False
    sort_order: int = 0
    column_width: int = 150


class FieldDefinitionCreate(FieldDefinitionBase):
    category_id: int


class FieldDefinitionUpdate(BaseModel):
    label: str | None = Field(None, max_length=200)
    label_en: str | None = Field(None, max_length=200)
    field_type: str | None = Field(None, max_length=50)
    tab_name: str | None = Field(None, max_length=100)
    section_name: str | None = Field(None, max_length=200)
    is_required: bool | None = None
    is_unique: bool | None = None
    default_value: str | None = Field(None, max_length=500)
    placeholder: str | None = Field(None, max_length=300)
    help_text: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    max_length: int | None = None
    regex_pattern: str | None = Field(None, max_length=500)
    options_json: Any | None = None
    reference_category_id: int | None = None
    show_in_list: bool | None = None
    sort_order: int | None = None
    column_width: int | None = None
    is_active: bool | None = None


class FieldDefinitionOut(FieldDefinitionBase):
    id: int
    category_id: int
    inherited_from_id: int | None = None
    is_active: bool = True
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Relationship Type ──

class RelationshipTypeOut(BaseModel):
    id: int
    code: str
    name: str
    name_reverse: str | None = None
    color: str | None = None
    icon: str | None = None
    description: str | None = None
    sort_order: int = 0
    is_active: bool = True
    model_config = {"from_attributes": True}
