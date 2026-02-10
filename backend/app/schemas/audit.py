from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    user_id: int | None = None
    user_name: str | None = None
    module: str
    action: str
    entity_type: str
    entity_id: int
    field_name: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    ip_address: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class AuditLogPage(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    per_page: int
