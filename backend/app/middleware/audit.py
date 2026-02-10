"""
Audit trail helper — call audit_log() from routers after mutations.

Usage in a router:
    from app.middleware.audit import audit_log
    await audit_log(s, module="risks", action="create",
                    entity_type="risk", entity_id=risk.id,
                    new_values={"asset_name": risk.asset_name, ...})
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


async def audit_log(
    session: AsyncSession,
    *,
    module: str,
    action: str,
    entity_type: str,
    entity_id: int,
    changes: dict[str, tuple[str | None, str | None]] | None = None,
    user_id: int | None = None,
    ip_address: str | None = None,
):
    """
    Record one or more audit entries.

    changes: dict of field_name -> (old_value, new_value)
    If changes is None, a single entry with no field detail is created.
    """
    if changes:
        for field_name, (old_val, new_val) in changes.items():
            session.add(AuditLog(
                user_id=user_id,
                module=module,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                field_name=field_name,
                old_value=str(old_val) if old_val is not None else None,
                new_value=str(new_val) if new_val is not None else None,
                ip_address=ip_address,
                created_at=datetime.utcnow(),
            ))
    else:
        session.add(AuditLog(
            user_id=user_id,
            module=module,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=ip_address,
            created_at=datetime.utcnow(),
        ))


def diff_changes(old: dict, new: dict) -> dict[str, tuple]:
    """Compare two dicts and return {field: (old_val, new_val)} for changed fields."""
    changes = {}
    for key in new:
        if key in old and old[key] != new[key]:
            changes[key] = (old[key], new[key])
    return changes
