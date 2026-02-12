"""
Dictionaries module — /api/v1/dictionaries

CRUD for dictionary types and their entries.
Soft-delete only (archive via is_active=false).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, text, update
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

# ── Pydantic models for usage / reassign endpoints ──


class UsageDetail(BaseModel):
    table: str
    table_key: str
    column: str
    count: int


class EntryUsageOut(BaseModel):
    entry_id: int
    entry_label: str
    total_references: int
    details: list[UsageDetail]


class ReassignRequest(BaseModel):
    target_id: int


class ReassignResult(BaseModel):
    reassigned_from: int
    reassigned_to: int
    total_updated: int
    details: list[UsageDetail]


# ── FK references from other tables to dictionary_entries.id ──

_FK_REFERENCES: list[tuple[str, str]] = [
    ("actions", "priority_id"),
    ("actions", "status_id"),
    ("actions", "source_id"),
    ("org_context_issues", "category_id"),
    ("org_context_obligations", "regulation_id"),
    ("org_context_stakeholders", "category_id"),
    ("org_context_scope", "management_system_id"),
    ("assets", "asset_type_id"),
    ("assets", "category_id"),
    ("assets", "sensitivity_id"),
    ("assets", "criticality_id"),
    ("assets", "environment_id"),
    ("assets", "status_id"),
    ("risks", "risk_category_id"),
    ("risks", "identification_source_id"),
    ("risks", "asset_category_id"),
    ("risks", "sensitivity_id"),
    ("risks", "criticality_id"),
    ("risks", "status_id"),
    ("risks", "strategy_id"),
    ("threats", "category_id"),
    ("threats", "asset_type_id"),
    ("vulnerabilities", "asset_type_id"),
    ("safeguards", "type_id"),
    ("safeguards", "asset_type_id"),
    ("cis_assessments", "status_id"),
    ("cis_assessment_answers", "policy_status_id"),
    ("cis_assessment_answers", "impl_status_id"),
    ("cis_assessment_answers", "auto_status_id"),
    ("cis_assessment_answers", "report_status_id"),
    ("audits", "audit_type_id"),
    ("audits", "overall_rating_id"),
    ("audit_findings", "finding_type_id"),
    ("audit_findings", "severity_id"),
    ("audit_findings", "status_id"),
    ("policies", "category_id"),
    ("policies", "status_id"),
    ("incidents", "category_id"),
    ("incidents", "severity_id"),
    ("incidents", "status_id"),
    ("incidents", "impact_id"),
    ("vulnerabilities_registry", "source_id"),
    ("vulnerabilities_registry", "category_id"),
    ("vulnerabilities_registry", "severity_id"),
    ("vulnerabilities_registry", "status_id"),
    ("vulnerabilities_registry", "remediation_priority_id"),
    ("policy_exceptions", "category_id"),
    ("policy_exceptions", "risk_level_id"),
    ("policy_exceptions", "status_id"),
    ("awareness_campaigns", "campaign_type_id"),
    ("awareness_campaigns", "status_id"),
    ("vendors", "category_id"),
    ("vendors", "criticality_id"),
    ("vendors", "data_access_level_id"),
    ("vendors", "status_id"),
    ("vendors", "risk_rating_id"),
    ("vendor_assessments", "risk_rating_id"),
]

_TABLE_LABELS: dict[str, str] = {
    "actions": "Działania",
    "org_context_issues": "Czynniki kontekstu",
    "org_context_obligations": "Zobowiązania",
    "org_context_stakeholders": "Interesariusze",
    "org_context_scope": "Zakres SZ",
    "assets": "Aktywa",
    "risks": "Ryzyka",
    "threats": "Zagrożenia",
    "vulnerabilities": "Podatności (katalog)",
    "safeguards": "Zabezpieczenia",
    "cis_assessments": "Oceny CIS",
    "cis_assessment_answers": "Odpowiedzi CIS",
    "audits": "Audyty",
    "audit_findings": "Ustalenia audytowe",
    "policies": "Polityki",
    "incidents": "Incydenty",
    "vulnerabilities_registry": "Rejestr podatności",
    "policy_exceptions": "Wyjątki od polityk",
    "awareness_campaigns": "Kampanie świadomości",
    "vendors": "Dostawcy",
    "vendor_assessments": "Oceny dostawców",
}

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


# ── GET entries by code (alias used by frontend) ──

@router.get(
    "/by-code/{code}",
    response_model=DictionaryTypeWithEntries,
    summary="Pozycje słownika (alias /by-code)",
)
async def get_entries_by_code(
    code: str,
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    return await get_entries(code, include_archived, s)


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


# ── USAGE statistics ──

@router.get(
    "/entries/{entry_id}/usage",
    response_model=EntryUsageOut,
    summary="Statystyki użycia pozycji słownika",
)
async def entry_usage(
    entry_id: int,
    s: AsyncSession = Depends(get_session),
):
    entry = await _get_entry(s, entry_id)

    details: list[UsageDetail] = []
    total = 0

    for table_name, column_name in _FK_REFERENCES:
        result = await s.execute(
            text(f"SELECT COUNT(*) FROM {table_name} WHERE {column_name} = :entry_id"),
            {"entry_id": entry_id},
        )
        count = result.scalar_one()
        if count > 0:
            details.append(
                UsageDetail(
                    table=_TABLE_LABELS.get(table_name, table_name),
                    table_key=table_name,
                    column=column_name,
                    count=count,
                )
            )
            total += count

    return EntryUsageOut(
        entry_id=entry.id,
        entry_label=entry.label,
        total_references=total,
        details=details,
    )


# ── REASSIGN references and archive ──

@router.post(
    "/entries/{entry_id}/reassign",
    response_model=ReassignResult,
    summary="Przepnij referencje na inną pozycję i zarchiwizuj bieżącą",
)
async def reassign_entry(
    entry_id: int,
    body: ReassignRequest,
    s: AsyncSession = Depends(get_session),
):
    source = await _get_entry(s, entry_id)
    target = await _get_entry(s, body.target_id)

    if source.dict_type_id != target.dict_type_id:
        raise HTTPException(
            400,
            detail="Obie pozycje muszą należeć do tego samego typu słownika",
        )

    details: list[UsageDetail] = []
    total_updated = 0

    for table_name, column_name in _FK_REFERENCES:
        result = await s.execute(
            text(
                f"UPDATE {table_name} SET {column_name} = :target_id "
                f"WHERE {column_name} = :entry_id"
            ),
            {"target_id": body.target_id, "entry_id": entry_id},
        )
        count = result.rowcount
        if count > 0:
            details.append(
                UsageDetail(
                    table=_TABLE_LABELS.get(table_name, table_name),
                    table_key=table_name,
                    column=column_name,
                    count=count,
                )
            )
            total_updated += count

    source.is_active = False
    await s.commit()

    return ReassignResult(
        reassigned_from=entry_id,
        reassigned_to=body.target_id,
        total_updated=total_updated,
        details=details,
    )
