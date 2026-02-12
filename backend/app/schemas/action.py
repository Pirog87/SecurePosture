from datetime import datetime

from pydantic import BaseModel, Field


class ActionLinkOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    entity_name: str | None = None
    entity_extra: dict | None = None  # extra info about linked entity (score, level, etc.)
    created_at: datetime
    model_config = {"from_attributes": True}


class ActionHistoryOut(BaseModel):
    id: int
    field_name: str
    old_value: str | None = None
    new_value: str | None = None
    changed_by: str | None = None
    change_reason: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ActionAttachmentOut(BaseModel):
    id: int
    filename: str
    original_name: str
    file_size: int
    content_type: str | None = None
    uploaded_by: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ActionOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    org_unit_id: int | None = None
    org_unit_name: str | None = None
    owner: str | None = None
    responsible: str | None = None
    priority_id: int | None = None
    priority_name: str | None = None
    status_id: int | None = None
    status_name: str | None = None
    source_id: int | None = None
    source_name: str | None = None
    due_date: datetime | None = None
    completed_at: datetime | None = None
    effectiveness_rating: int | None = None
    effectiveness_notes: str | None = None
    implementation_notes: str | None = None
    is_active: bool = True
    is_overdue: bool = False
    links: list[ActionLinkOut] = []
    history: list[ActionHistoryOut] = []
    attachments: list[ActionAttachmentOut] = []
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ActionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    org_unit_id: int | None = None
    owner: str | None = Field(None, max_length=200)
    responsible: str | None = Field(None, max_length=200)
    priority_id: int | None = None
    status_id: int | None = None
    source_id: int | None = None
    due_date: datetime | None = None
    links: list[dict] | None = None  # [{"entity_type": "risk", "entity_id": 1}]


class ActionUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    org_unit_id: int | None = None
    owner: str | None = Field(None, max_length=200)
    responsible: str | None = Field(None, max_length=200)
    priority_id: int | None = None
    status_id: int | None = None
    source_id: int | None = None
    due_date: datetime | None = None
    completed_at: datetime | None = None
    effectiveness_rating: int | None = Field(None, ge=1, le=5)
    effectiveness_notes: str | None = None
    implementation_notes: str | None = None
    links: list[dict] | None = None
    change_reason: str | None = None  # reason/justification for the change


class ActionCloseRequest(BaseModel):
    effectiveness_rating: int = Field(..., ge=1, le=5)
    effectiveness_notes: str | None = None
    implementation_notes: str | None = None
    change_reason: str | None = None
