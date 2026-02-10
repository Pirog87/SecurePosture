from datetime import datetime

from pydantic import BaseModel, Field


class SecurityAreaOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class SecurityAreaCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    sort_order: int = 0


class SecurityAreaUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
