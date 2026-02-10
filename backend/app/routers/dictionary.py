"""
Dictionaries module — /api/v1/dictionaries

CRUD for dictionary types and their entries.
Soft-delete only (archive via is_active=false).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.dictionary import DictionaryEntry, DictionaryType
from app.schemas.dictionary import (
    DictionaryEntryCreate,
    DictionaryEntryOut,
    DictionaryEntryUpdate,
    DictionaryTypeOut,
    DictionaryTypeWithEntries,
    ReorderRequest,
)

router = APIRouter(prefix="/api/v1/dictionaries", tags=["Słowniki"])


# ── helpers ──

async def _get_type_by_code(s: AsyncSession, code: str) -> DictionaryType:
    q = select(DictionaryType).where(DictionaryType.code == code)
    dt = (await s.execute(q)).scalar_one_or_none()
    if dt is None:
        raise HTTPException(404, detail=f"Słownik '{code}' nie istnieje")
    return dt


async def _get_entry(s: AsyncSession, entry_id: int) -> DictionaryEntry:
    entry = await s.get(DictionaryEntry, entry_id)
    if entry is None:
        raise HTTPException(404, detail=f"Pozycja słownika #{entry_id} nie istnieje")
    return entry


# ── LIST dictionary types ──

@router.get(
    "",
    response_model=list[DictionaryTypeOut],
    summary="Lista typów słowników",
)
async def list_dictionary_types(
    s: AsyncSession = Depends(get_session),
):
    q = (
        select(
            DictionaryType,
            func.count(DictionaryEntry.id).label("entry_count"),
        )
        .outerjoin(DictionaryEntry, DictionaryEntry.dict_type_id == DictionaryType.id)
        .group_by(DictionaryType.id)
        .order_by(DictionaryType.name)
    )
    rows = (await s.execute(q)).all()
    return [
        DictionaryTypeOut(
            id=dt.id,
            code=dt.code,
            name=dt.name,
            description=dt.description,
            is_system=dt.is_system,
            entry_count=cnt,
            created_at=dt.created_at,
            updated_at=dt.updated_at,
        )
        for dt, cnt in rows
    ]


# ── GET entries for a dictionary ──

@router.get(
    "/{code}/entries",
    response_model=DictionaryTypeWithEntries,
    summary="Pozycje danego słownika",
)
async def get_entries(
    code: str,
    include_archived: bool = Query(False, description="Pokaż też zarchiwizowane pozycje"),
    s: AsyncSession = Depends(get_session),
):
    dt = await _get_type_by_code(s, code)

    entry_filter = DictionaryEntry.dict_type_id == dt.id
    if not include_archived:
        entry_filter = entry_filter & DictionaryEntry.is_active.is_(True)

    q = (
        select(DictionaryEntry)
        .where(entry_filter)
        .order_by(DictionaryEntry.sort_order, DictionaryEntry.label)
    )
    entries = (await s.execute(q)).scalars().all()

    return DictionaryTypeWithEntries(
        id=dt.id,
        code=dt.code,
        name=dt.name,
        description=dt.description,
        is_system=dt.is_system,
        entry_count=len(entries),
        created_at=dt.created_at,
        updated_at=dt.updated_at,
        entries=[DictionaryEntryOut.model_validate(e) for e in entries],
    )


# ── CREATE entry ──

@router.post(
    "/{code}/entries",
    response_model=DictionaryEntryOut,
    status_code=201,
    summary="Dodaj pozycję do słownika",
)
async def create_entry(
    code: str,
    body: DictionaryEntryCreate,
    s: AsyncSession = Depends(get_session),
):
    dt = await _get_type_by_code(s, code)

    entry = DictionaryEntry(
        dict_type_id=dt.id,
        code=body.code,
        label=body.label,
        description=body.description,
        numeric_value=body.numeric_value,
        color=body.color,
        sort_order=body.sort_order,
    )
    s.add(entry)
    await s.commit()
    await s.refresh(entry)
    return DictionaryEntryOut.model_validate(entry)


# ── REORDER entries (defined before {entry_id} to avoid path collision) ──

@router.put(
    "/entries/reorder",
    summary="Zmień kolejność pozycji (sort_order)",
)
async def reorder_entries(
    body: ReorderRequest,
    s: AsyncSession = Depends(get_session),
):
    for item in body.items:
        await s.execute(
            update(DictionaryEntry)
            .where(DictionaryEntry.id == item.id)
            .values(sort_order=item.sort_order)
        )
    await s.commit()
    return {"status": "ok", "updated": len(body.items)}


# ── UPDATE entry ──

@router.put(
    "/entries/{entry_id}",
    response_model=DictionaryEntryOut,
    summary="Edytuj pozycję słownika",
)
async def update_entry(
    entry_id: int,
    body: DictionaryEntryUpdate,
    s: AsyncSession = Depends(get_session),
):
    entry = await _get_entry(s, entry_id)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    await s.commit()
    await s.refresh(entry)
    return DictionaryEntryOut.model_validate(entry)


# ── ARCHIVE entry (soft delete) ──

@router.patch(
    "/entries/{entry_id}/archive",
    response_model=DictionaryEntryOut,
    summary="Archiwizuj pozycję (is_active=false)",
)
async def archive_entry(
    entry_id: int,
    s: AsyncSession = Depends(get_session),
):
    entry = await _get_entry(s, entry_id)
    entry.is_active = False
    await s.commit()
    await s.refresh(entry)
    return DictionaryEntryOut.model_validate(entry)
