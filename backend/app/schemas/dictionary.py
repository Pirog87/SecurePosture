from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ── Response ──

class DictionaryEntryOut(BaseModel):
    id: int
    dict_type_id: int
    code: str | None = None
    label: str
    description: str | None = None
    numeric_value: float | None = None
    color: str | None = None
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DictionaryTypeOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    is_system: bool = False
    entry_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DictionaryTypeWithEntries(DictionaryTypeOut):
    entries: list[DictionaryEntryOut] = []


# ── Request ──

class DictionaryEntryCreate(BaseModel):
    code: str | None = None
    label: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    numeric_value: float | None = None
    color: str | None = Field(None, max_length=20)
    sort_order: int = 0


class DictionaryEntryUpdate(BaseModel):
    code: str | None = None
    label: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    numeric_value: float | None = None
    color: str | None = Field(None, max_length=20)
    sort_order: int | None = None


class ReorderItem(BaseModel):
    id: int
    sort_order: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem] = Field(..., min_length=1)
