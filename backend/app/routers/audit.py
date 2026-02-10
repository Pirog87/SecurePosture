"""
Audit trail viewer — /api/v1/audit-log
Read-only access to the change log.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogOut, AuditLogPage

router = APIRouter(prefix="/api/v1/audit-log", tags=["Audit Trail"])


@router.get("", response_model=AuditLogPage, summary="Przeglądaj logi zmian")
async def list_audit_logs(
    module: str | None = Query(None, description="Filtr po module (risks, cis, dictionaries, ...)"),
    entity_type: str | None = Query(None),
    entity_id: int | None = Query(None),
    action: str | None = Query(None, description="create / update / delete / review / approve"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    s: AsyncSession = Depends(get_session),
):
    q = (
        select(AuditLog, User.display_name.label("user_name"))
        .outerjoin(User, AuditLog.user_id == User.id)
    )

    if module:
        q = q.where(AuditLog.module == module)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        q = q.where(AuditLog.entity_id == entity_id)
    if action:
        q = q.where(AuditLog.action == action)

    # Count
    count_q = select(func.count()).select_from(AuditLog)
    if module:
        count_q = count_q.where(AuditLog.module == module)
    if entity_type:
        count_q = count_q.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        count_q = count_q.where(AuditLog.entity_id == entity_id)
    if action:
        count_q = count_q.where(AuditLog.action == action)
    total = (await s.execute(count_q)).scalar() or 0

    # Paginate
    q = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await s.execute(q)).all()

    items = [
        AuditLogOut(
            id=log.id, user_id=log.user_id, user_name=un,
            module=log.module, action=log.action,
            entity_type=log.entity_type, entity_id=log.entity_id,
            field_name=log.field_name, old_value=log.old_value,
            new_value=log.new_value, ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log, un in rows
    ]
    return AuditLogPage(items=items, total=total, page=page, per_page=per_page)
