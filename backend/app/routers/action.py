"""
Actions module — /api/v1/actions
Track corrective actions, risk treatment plans, CIS remediation tasks.
"""
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.action import Action, ActionAttachment, ActionHistory, ActionLink
from app.models.asset import Asset
from app.models.dictionary import DictionaryEntry
from app.models.org_unit import OrgUnit
from app.models.risk import Risk
from app.schemas.action import (
    ActionAttachmentOut,
    ActionCloseRequest,
    ActionCreate,
    ActionHistoryOut,
    ActionLinkOut,
    ActionOut,
    ActionUpdate,
)

router = APIRouter(prefix="/api/v1/actions", tags=["Dzialania"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "actions")


# ── helpers ──

async def _de_label(s, entry_id: int | None) -> str | None:
    if entry_id is None:
        return None
    e = await s.get(DictionaryEntry, entry_id)
    return e.label if e else None


async def _entity_name(s, entity_type: str, entity_id: int) -> str | None:
    if entity_type == "risk":
        r = await s.get(Risk, entity_id)
        return r.asset_name if r else None
    if entity_type == "asset":
        a = await s.get(Asset, entity_id)
        return a.name if a else None
    if entity_type == "policy_exception":
        from app.models.policy_exception import PolicyException
        pe = await s.get(PolicyException, entity_id)
        return pe.title if pe else None
    if entity_type == "incident":
        from app.models.incident import Incident
        inc = await s.get(Incident, entity_id)
        return inc.title if inc else None
    if entity_type == "audit":
        from app.models.audit import Audit
        aud = await s.get(Audit, entity_id)
        return aud.title if aud else None
    return f"{entity_type}#{entity_id}"


async def _entity_extra(s, entity_type: str, entity_id: int) -> dict | None:
    """Return extra info about linked entity (e.g. risk score, level, other links)."""
    if entity_type == "risk":
        r = await s.get(Risk, entity_id)
        if not r:
            return None
        # Get other action_links pointing to this risk
        other_links_q = select(ActionLink).where(
            ActionLink.entity_type == "risk",
            ActionLink.entity_id == entity_id,
        )
        other_links = (await s.execute(other_links_q)).scalars().all()
        other_action_ids = [lnk.action_id for lnk in other_links]
        # Also collect all links FROM this risk (via action_links where this risk is target)
        status_name = await _de_label(s, r.status_id) if hasattr(r, 'status_id') else None
        return {
            "risk_score": r.risk_score,
            "risk_level": r.risk_level,
            "status_name": status_name,
            "org_unit_name": None,  # Loaded separately if needed
            "other_action_count": len(other_action_ids),
        }
    return None


async def _action_out(s, action: Action) -> ActionOut:
    org = await s.get(OrgUnit, action.org_unit_id) if action.org_unit_id else None

    # Links
    links_q = select(ActionLink).where(ActionLink.action_id == action.id)
    links = (await s.execute(links_q)).scalars().all()
    link_outs = []
    for lnk in links:
        ename = await _entity_name(s, lnk.entity_type, lnk.entity_id)
        eextra = await _entity_extra(s, lnk.entity_type, lnk.entity_id)
        link_outs.append(ActionLinkOut(
            id=lnk.id, entity_type=lnk.entity_type,
            entity_id=lnk.entity_id, entity_name=ename,
            entity_extra=eextra,
            created_at=lnk.created_at,
        ))

    # History (full, ordered newest first)
    hist_q = (select(ActionHistory)
              .where(ActionHistory.action_id == action.id)
              .order_by(ActionHistory.created_at.desc()))
    history = (await s.execute(hist_q)).scalars().all()

    # Attachments
    att_q = (select(ActionAttachment)
             .where(ActionAttachment.action_id == action.id)
             .order_by(ActionAttachment.created_at.desc()))
    attachments = (await s.execute(att_q)).scalars().all()

    is_overdue = (
        action.due_date is not None
        and action.completed_at is None
        and action.due_date < datetime.utcnow()
    )

    return ActionOut(
        id=action.id,
        title=action.title,
        description=action.description,
        org_unit_id=action.org_unit_id,
        org_unit_name=org.name if org else None,
        owner=action.owner,
        responsible=action.responsible,
        priority_id=action.priority_id,
        priority_name=await _de_label(s, action.priority_id),
        status_id=action.status_id,
        status_name=await _de_label(s, action.status_id),
        source_id=action.source_id,
        source_name=await _de_label(s, action.source_id),
        due_date=action.due_date,
        completed_at=action.completed_at,
        effectiveness_rating=action.effectiveness_rating,
        effectiveness_notes=action.effectiveness_notes,
        implementation_notes=action.implementation_notes,
        is_active=action.is_active,
        is_overdue=is_overdue,
        links=link_outs,
        history=[ActionHistoryOut.model_validate(h) for h in history],
        attachments=[ActionAttachmentOut.model_validate(a) for a in attachments],
        created_at=action.created_at,
        updated_at=action.updated_at,
    )


async def _sync_links(s, action_id: int, links: list[dict]):
    await s.execute(delete(ActionLink).where(ActionLink.action_id == action_id))
    for lnk in links:
        s.add(ActionLink(
            action_id=action_id,
            entity_type=lnk["entity_type"],
            entity_id=lnk["entity_id"],
        ))


async def _track_change(s, action_id: int, field: str, old_val, new_val, change_reason: str | None = None):
    if str(old_val) != str(new_val):
        s.add(ActionHistory(
            action_id=action_id,
            field_name=field,
            old_value=str(old_val) if old_val is not None else None,
            new_value=str(new_val) if new_val is not None else None,
            change_reason=change_reason,
        ))


# ═══════════════════ LIST ═══════════════════

@router.get("", response_model=list[ActionOut], summary="Lista dzialan")
async def list_actions(
    org_unit_id: int | None = Query(None),
    status_id: int | None = Query(None),
    source_id: int | None = Query(None),
    overdue_only: bool = Query(False),
    include_archived: bool = Query(False),
    entity_type: str | None = Query(None, description="Filter by linked entity type"),
    entity_id: int | None = Query(None, description="Filter by linked entity id"),
    s: AsyncSession = Depends(get_session),
):
    q = select(Action)
    if not include_archived:
        q = q.where(Action.is_active.is_(True))
    if org_unit_id is not None:
        q = q.where(Action.org_unit_id == org_unit_id)
    if status_id is not None:
        q = q.where(Action.status_id == status_id)
    if source_id is not None:
        q = q.where(Action.source_id == source_id)
    if overdue_only:
        q = q.where(Action.due_date < datetime.utcnow()).where(Action.completed_at.is_(None))
    if entity_type and entity_id is not None:
        link_sub = select(ActionLink.action_id).where(
            ActionLink.entity_type == entity_type,
            ActionLink.entity_id == entity_id,
        )
        q = q.where(Action.id.in_(link_sub))
    q = q.order_by(Action.due_date.asc().nullslast(), Action.created_at.desc())
    actions = (await s.execute(q)).scalars().all()
    return [await _action_out(s, a) for a in actions]


# ═══════════════════ GET ═══════════════════

@router.get("/{action_id}", response_model=ActionOut, summary="Pobierz dzialanie")
async def get_action(action_id: int, s: AsyncSession = Depends(get_session)):
    action = await s.get(Action, action_id)
    if not action:
        raise HTTPException(404, "Dzialanie nie istnieje")
    return await _action_out(s, action)


# ═══════════════════ CREATE ═══════════════════

@router.post("", response_model=ActionOut, status_code=201, summary="Utworz dzialanie")
async def create_action(body: ActionCreate, s: AsyncSession = Depends(get_session)):
    data = body.model_dump(exclude={"links"})
    action = Action(**data)
    s.add(action)
    await s.flush()

    if body.links:
        await _sync_links(s, action.id, body.links)

    await s.commit()
    await s.refresh(action)
    return await _action_out(s, action)


# ═══════════════════ UPDATE ═══════════════════

@router.put("/{action_id}", response_model=ActionOut, summary="Edytuj dzialanie")
async def update_action(action_id: int, body: ActionUpdate, s: AsyncSession = Depends(get_session)):
    action = await s.get(Action, action_id)
    if not action:
        raise HTTPException(404, "Dzialanie nie istnieje")

    reason = body.change_reason
    data = body.model_dump(exclude_unset=True, exclude={"links", "change_reason"})
    for k, v in data.items():
        old = getattr(action, k)
        if old != v:
            await _track_change(s, action_id, k, old, v, change_reason=reason)
            setattr(action, k, v)

    if body.links is not None:
        await _sync_links(s, action_id, body.links)

    await s.commit()
    await s.refresh(action)
    return await _action_out(s, action)


# ═══════════════════ CLOSE (with effectiveness) ═══════════════════

@router.post("/{action_id}/close", response_model=ActionOut, summary="Zamknij dzialanie z ocena skutecznosci")
async def close_action(action_id: int, body: ActionCloseRequest, s: AsyncSession = Depends(get_session)):
    action = await s.get(Action, action_id)
    if not action:
        raise HTTPException(404, "Dzialanie nie istnieje")

    reason = body.change_reason or "Zamkniecie dzialania"

    await _track_change(s, action_id, "completed_at", action.completed_at, datetime.utcnow(), change_reason=reason)
    action.completed_at = datetime.utcnow()
    action.effectiveness_rating = body.effectiveness_rating
    action.effectiveness_notes = body.effectiveness_notes
    if body.implementation_notes is not None:
        await _track_change(s, action_id, "implementation_notes", action.implementation_notes, body.implementation_notes, change_reason=reason)
        action.implementation_notes = body.implementation_notes

    # Find "completed" status
    from app.models.dictionary import DictionaryType
    q = (
        select(DictionaryEntry.id)
        .select_from(DictionaryEntry)
        .join(DictionaryType, DictionaryEntry.dict_type_id == DictionaryType.id)
        .where(DictionaryType.code == "action_status")
        .where(DictionaryEntry.code == "completed")
        .limit(1)
    )
    completed_id = (await s.execute(q)).scalar()
    if completed_id:
        await _track_change(s, action_id, "status_id", action.status_id, completed_id, change_reason=reason)
        action.status_id = completed_id

    await s.commit()
    await s.refresh(action)
    return await _action_out(s, action)


# ═══════════════════ ARCHIVE ═══════════════════

@router.delete("/{action_id}", summary="Archiwizuj dzialanie")
async def archive_action(action_id: int, s: AsyncSession = Depends(get_session)):
    action = await s.get(Action, action_id)
    if not action:
        raise HTTPException(404, "Dzialanie nie istnieje")
    action.is_active = False
    await s.commit()
    return {"status": "archived", "id": action_id}


# ═══════════════════ ATTACHMENTS ═══════════════════

@router.post("/{action_id}/attachments", response_model=ActionAttachmentOut, summary="Dodaj zalacznik")
async def upload_attachment(
    action_id: int,
    file: UploadFile = File(...),
    s: AsyncSession = Depends(get_session),
):
    action = await s.get(Action, action_id)
    if not action:
        raise HTTPException(404, "Dzialanie nie istnieje")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "file")[1]
    stored_name = f"{action_id}_{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, stored_name)

    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    att = ActionAttachment(
        action_id=action_id,
        filename=stored_name,
        original_name=file.filename or "file",
        file_size=len(content),
        content_type=file.content_type,
    )
    s.add(att)
    await s.commit()
    await s.refresh(att)
    return ActionAttachmentOut.model_validate(att)


@router.get("/{action_id}/attachments/{attachment_id}/download", summary="Pobierz zalacznik")
async def download_attachment(
    action_id: int,
    attachment_id: int,
    s: AsyncSession = Depends(get_session),
):
    att = await s.get(ActionAttachment, attachment_id)
    if not att or att.action_id != action_id:
        raise HTTPException(404, "Zalacznik nie istnieje")

    path = os.path.join(UPLOAD_DIR, att.filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Plik nie istnieje na dysku")

    return FileResponse(path, filename=att.original_name, media_type=att.content_type or "application/octet-stream")


@router.delete("/{action_id}/attachments/{attachment_id}", summary="Usun zalacznik")
async def delete_attachment(
    action_id: int,
    attachment_id: int,
    s: AsyncSession = Depends(get_session),
):
    att = await s.get(ActionAttachment, attachment_id)
    if not att or att.action_id != action_id:
        raise HTTPException(404, "Zalacznik nie istnieje")

    path = os.path.join(UPLOAD_DIR, att.filename)
    if os.path.exists(path):
        os.remove(path)

    await s.delete(att)
    await s.commit()
    return {"status": "deleted", "id": attachment_id}
