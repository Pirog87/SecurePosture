"""
Audit Program CRUD + lifecycle + items + suppliers + locations + version diffs + audit trail.
Spec: docs/SPECYFIKACJA_AUDIT_PROGRAM_v1.md — Krok 1-5
"""
from datetime import datetime, date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.audit_program import (
    AuditProgramV2,
    AuditProgramItem,
    AuditProgramHistory,
    AuditProgramVersionDiff,
    Supplier,
    Location,
)
from app.models.user import User
from app.models.org_unit import OrgUnit
from app.schemas.audit_program import (
    AuditProgramCreate,
    AuditProgramUpdate,
    AuditProgramOut,
    AuditProgramItemCreate,
    AuditProgramItemUpdate,
    AuditProgramItemOut,
    RejectPayload,
    ApprovePayload,
    CorrectionPayload,
    CancelItemPayload,
    DeferItemPayload,
    SupplierCreate,
    SupplierUpdate,
    SupplierOut,
    LocationCreate,
    LocationUpdate,
    LocationOut,
)

programs_router = APIRouter(prefix="/api/v1/audit-programs", tags=["Program Audytow"])
items_router = APIRouter(prefix="/api/v1/audit-program-items", tags=["Pozycje programu"])
suppliers_router = APIRouter(prefix="/api/v1/suppliers", tags=["Dostawcy"])
locations_router = APIRouter(prefix="/api/v1/locations", tags=["Lokalizacje"])


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

async def _user_name(s: AsyncSession, uid: int | None) -> str | None:
    if not uid:
        return None
    u = await s.get(User, uid)
    return u.display_name if u else None


async def _enrich_program(s: AsyncSession, p: AuditProgramV2) -> AuditProgramOut:
    """Convert model to schema with computed fields."""
    # Item stats
    items_q = select(
        func.count().label("total"),
        func.sum(func.iif(AuditProgramItem.item_status == "completed", 1, 0)).label("completed"),
        func.sum(func.iif(AuditProgramItem.item_status == "in_progress", 1, 0)).label("in_progress"),
        func.sum(func.iif(AuditProgramItem.item_status == "planned", 1, 0)).label("planned"),
        func.sum(func.iif(AuditProgramItem.item_status == "cancelled", 1, 0)).label("cancelled"),
    ).where(AuditProgramItem.audit_program_id == p.id)
    row = (await s.execute(items_q)).one_or_none()
    total = row.total if row else 0
    completed = int(row.completed or 0) if row else 0
    in_progress = int(row.in_progress or 0) if row else 0
    planned = int(row.planned or 0) if row else 0
    cancelled = int(row.cancelled or 0) if row else 0

    # Pending CR count
    from app.models.audit_program import AuditProgramChangeRequest
    cr_q = select(func.count()).where(
        AuditProgramChangeRequest.audit_program_id == p.id,
        AuditProgramChangeRequest.status == "submitted",
    )
    pending_cr = (await s.execute(cr_q)).scalar() or 0

    ou_name = None
    if p.org_unit_id:
        ou = await s.get(OrgUnit, p.org_unit_id)
        ou_name = ou.name if ou else None

    return AuditProgramOut(
        id=p.id,
        ref_id=p.ref_id,
        name=p.name,
        description=p.description,
        version=p.version,
        version_group_id=p.version_group_id,
        is_current_version=p.is_current_version,
        previous_version_id=p.previous_version_id,
        period_type=p.period_type,
        period_start=p.period_start,
        period_end=p.period_end,
        year=p.year,
        strategic_objectives=p.strategic_objectives,
        risks_and_opportunities=p.risks_and_opportunities,
        scope_description=p.scope_description,
        audit_criteria=p.audit_criteria,
        methods=p.methods,
        risk_assessment_ref=p.risk_assessment_ref,
        budget_planned_days=p.budget_planned_days,
        budget_actual_days=p.budget_actual_days,
        budget_planned_cost=p.budget_planned_cost,
        budget_actual_cost=p.budget_actual_cost,
        budget_currency=p.budget_currency,
        kpis=p.kpis,
        previous_program_id=p.previous_program_id,
        status=p.status,
        status_changed_at=p.status_changed_at,
        submitted_at=p.submitted_at,
        approval_justification=p.approval_justification,
        approved_at=p.approved_at,
        approved_by=p.approved_by,
        rejection_reason=p.rejection_reason,
        rejected_at=p.rejected_at,
        correction_reason=p.correction_reason,
        correction_initiated_at=p.correction_initiated_at,
        owner_id=p.owner_id,
        approver_id=p.approver_id,
        org_unit_id=p.org_unit_id,
        created_by=p.created_by,
        created_at=p.created_at,
        updated_at=p.updated_at,
        owner_name=await _user_name(s, p.owner_id),
        approver_name=await _user_name(s, p.approver_id),
        org_unit_name=ou_name,
        item_count=total,
        items_completed=completed,
        items_in_progress=in_progress,
        items_planned=planned,
        items_cancelled=cancelled,
        pending_cr_count=pending_cr,
    )


async def _next_ref(s: AsyncSession, prefix: str) -> str:
    """Generate next sequential ref_id like AP-2025-001."""
    year = datetime.utcnow().year
    pat = f"{prefix}-{year}-%"
    q = select(func.count()).select_from(AuditProgramV2).where(AuditProgramV2.ref_id.like(pat))
    cnt = (await s.execute(q)).scalar() or 0
    return f"{prefix}-{year}-{cnt + 1:03d}"


async def _next_item_ref(s: AsyncSession, program_id: int) -> str:
    """Generate next item ref like API-001."""
    q = select(func.count()).select_from(AuditProgramItem).where(
        AuditProgramItem.audit_program_id == program_id,
    )
    cnt = (await s.execute(q)).scalar() or 0
    return f"API-{cnt + 1:03d}"


async def _log(s: AsyncSession, program_id: int, entity_type: str, entity_id: int,
               action: str, description: str, user_id: int = 1,
               justification: str | None = None, field_changes: dict | None = None):
    """Write audit trail entry."""
    entry = AuditProgramHistory(
        entity_type=entity_type,
        entity_id=entity_id,
        audit_program_id=program_id,
        action=action,
        description=description,
        justification=justification,
        field_changes=field_changes,
        performed_by=user_id,
    )
    s.add(entry)


# ═══════════════════════════════════════════════════════════════
# Version Diff generation (Krok 4)
# ═══════════════════════════════════════════════════════════════

# Fields compared at program level
_PROGRAM_DIFF_FIELDS = [
    "name", "description", "period_type", "period_start", "period_end", "year",
    "strategic_objectives", "risks_and_opportunities", "scope_description",
    "audit_criteria", "methods", "risk_assessment_ref",
    "budget_planned_days", "budget_planned_cost", "budget_currency",
    "owner_id", "approver_id", "org_unit_id",
]

# Fields compared at item level
_ITEM_DIFF_FIELDS = [
    "name", "description", "audit_type", "planned_quarter", "planned_month",
    "planned_start", "planned_end", "scope_type", "scope_name",
    "planned_days", "planned_cost", "priority", "risk_rating",
    "lead_auditor_id", "audit_method", "display_order",
]


def _serialize(val: object) -> str | None:
    """Normalize a value to a comparable string."""
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)


async def generate_version_diff(
    s: AsyncSession,
    from_program: AuditProgramV2,
    to_program: AuditProgramV2,
) -> AuditProgramVersionDiff:
    """Compare two program versions field-by-field and item-by-item, save diff record."""

    # 1. Compare program-level fields
    program_field_changes: dict[str, dict[str, str | None]] = {}
    for field in _PROGRAM_DIFF_FIELDS:
        old_val = _serialize(getattr(from_program, field))
        new_val = _serialize(getattr(to_program, field))
        if old_val != new_val:
            program_field_changes[field] = {"from": old_val, "to": new_val}

    # 2. Load items for both versions
    from_items_q = select(AuditProgramItem).where(
        AuditProgramItem.audit_program_id == from_program.id,
    ).order_by(AuditProgramItem.display_order)
    from_items = list((await s.execute(from_items_q)).scalars().all())

    to_items_q = select(AuditProgramItem).where(
        AuditProgramItem.audit_program_id == to_program.id,
    ).order_by(AuditProgramItem.display_order)
    to_items = list((await s.execute(to_items_q)).scalars().all())

    # Index by ref_id for matching
    from_map = {it.ref_id: it for it in from_items if it.ref_id}
    to_map = {it.ref_id: it for it in to_items if it.ref_id}

    items_added: list[dict] = []
    items_removed: list[dict] = []
    items_modified: list[dict] = []
    items_unchanged = 0

    # Items in to_version but not in from_version → added
    for ref_id, item in to_map.items():
        if ref_id not in from_map:
            items_added.append({"ref_id": ref_id, "name": item.name, "audit_type": item.audit_type})

    # Items in from_version but not in to_version → removed
    for ref_id, item in from_map.items():
        if ref_id not in to_map:
            items_removed.append({"ref_id": ref_id, "name": item.name, "audit_type": item.audit_type})

    # Items in both → compare fields
    for ref_id in from_map:
        if ref_id not in to_map:
            continue
        old_item = from_map[ref_id]
        new_item = to_map[ref_id]
        changes: dict[str, dict[str, str | None]] = {}
        for field in _ITEM_DIFF_FIELDS:
            old_val = _serialize(getattr(old_item, field))
            new_val = _serialize(getattr(new_item, field))
            if old_val != new_val:
                changes[field] = {"from": old_val, "to": new_val}
        if changes:
            items_modified.append({"ref_id": ref_id, "name": new_item.name, "changes": changes})
        else:
            items_unchanged += 1

    # 3. Build human-readable summary
    parts: list[str] = []
    if program_field_changes:
        parts.append(f"Zmieniono {len(program_field_changes)} pol programu")
    if items_added:
        parts.append(f"Dodano {len(items_added)} pozycji")
    if items_removed:
        parts.append(f"Usunieto {len(items_removed)} pozycji")
    if items_modified:
        parts.append(f"Zmodyfikowano {len(items_modified)} pozycji")
    if items_unchanged:
        parts.append(f"{items_unchanged} pozycji bez zmian")
    summary = ". ".join(parts) + "." if parts else "Brak zmian."

    # 4. Persist
    diff = AuditProgramVersionDiff(
        version_group_id=from_program.version_group_id,
        from_version_id=from_program.id,
        to_version_id=to_program.id,
        from_version=from_program.version,
        to_version=to_program.version,
        program_field_changes=program_field_changes,
        items_added=items_added,
        items_removed=items_removed,
        items_modified=items_modified,
        items_unchanged=items_unchanged,
        summary=summary,
    )
    s.add(diff)
    return diff


# ═══════════════════════════════════════════════════════════════
# Lookups (users for dropdowns)
# ═══════════════════════════════════════════════════════════════


@programs_router.get("/lookups")
async def get_lookups(s: AsyncSession = Depends(get_session)):
    """Return active users for owner/approver selects."""
    q = select(User).where(User.is_active.is_(True)).order_by(User.display_name)
    rows = (await s.execute(q)).scalars().all()
    return {
        "users": [{"id": u.id, "display_name": u.display_name} for u in rows],
    }


# ═══════════════════════════════════════════════════════════════
# CRUD: Audit Programs
# ═══════════════════════════════════════════════════════════════


@programs_router.get("", response_model=list[AuditProgramOut])
async def list_programs(
    status: str | None = Query(None),
    year: int | None = Query(None),
    owner_id: int | None = Query(None),
    org_unit_id: int | None = Query(None),
    current_only: bool = Query(True),
    s: AsyncSession = Depends(get_session),
):
    q = select(AuditProgramV2)
    if current_only:
        q = q.where(AuditProgramV2.is_current_version.is_(True))
    if status:
        q = q.where(AuditProgramV2.status == status)
    if year:
        q = q.where(AuditProgramV2.year == year)
    if owner_id:
        q = q.where(AuditProgramV2.owner_id == owner_id)
    if org_unit_id:
        q = q.where(AuditProgramV2.org_unit_id == org_unit_id)
    q = q.order_by(AuditProgramV2.created_at.desc())
    rows = (await s.execute(q)).scalars().all()
    return [await _enrich_program(s, p) for p in rows]


@programs_router.post("", response_model=AuditProgramOut, status_code=201)
async def create_program(
    body: AuditProgramCreate,
    s: AsyncSession = Depends(get_session),
):
    if body.owner_id == body.approver_id:
        raise HTTPException(400, "Owner i Approver nie moga byc ta sama osoba")

    ref_id = await _next_ref(s, "AP")
    p = AuditProgramV2(
        ref_id=ref_id,
        **body.model_dump(),
        version=1,
        status="draft",
        created_by=body.owner_id,
    )
    # version_group_id will be set after flush (= own id)
    s.add(p)
    await s.flush()
    p.version_group_id = p.id
    await _log(s, p.id, "program", p.id, "created",
               f"Utworzono program '{p.name}' (v1)", user_id=body.owner_id)
    await s.commit()
    await s.refresh(p)
    return await _enrich_program(s, p)


@programs_router.get("/{program_id}", response_model=AuditProgramOut)
async def get_program(program_id: int, s: AsyncSession = Depends(get_session)):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    return await _enrich_program(s, p)


@programs_router.put("/{program_id}", response_model=AuditProgramOut)
async def update_program(
    program_id: int,
    body: AuditProgramUpdate,
    s: AsyncSession = Depends(get_session),
):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    if p.status != "draft":
        raise HTTPException(400, "Edycja mozliwa tylko w statusie 'draft'")

    changes = {}
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        old = getattr(p, k)
        if old != v:
            changes[k] = {"old": str(old), "new": str(v)}
            setattr(p, k, v)

    if changes:
        await _log(s, p.id, "program", p.id, "updated",
                   f"Zaktualizowano program '{p.name}'",
                   user_id=p.owner_id, field_changes=changes)
    await s.commit()
    await s.refresh(p)
    return await _enrich_program(s, p)


@programs_router.delete("/{program_id}")
async def delete_program(program_id: int, s: AsyncSession = Depends(get_session)):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    if p.status != "draft":
        raise HTTPException(400, "Usuwanie mozliwe tylko w statusie 'draft'")
    if p.version > 1:
        raise HTTPException(400, "Nie mozna usunac wersji >= 2 (korekty)")
    await s.delete(p)
    await s.commit()
    return {"status": "deleted"}


# ═══════════════════════════════════════════════════════════════
# State Machine — lifecycle transitions (Krok 2)
# ═══════════════════════════════════════════════════════════════

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft":        ["submitted", "deleted"],
    "submitted":    ["approved", "rejected"],
    "rejected":     ["draft"],          # auto
    "approved":     ["in_execution", "superseded"],
    "in_execution": ["completed", "superseded"],
    "completed":    ["archived"],
    "superseded":   [],                 # terminal
    "deleted":      [],                 # terminal
    "archived":     [],                 # terminal
}


async def _item_count(s: AsyncSession, pid: int) -> int:
    q = select(func.count()).select_from(AuditProgramItem).where(
        AuditProgramItem.audit_program_id == pid,
    )
    return (await s.execute(q)).scalar() or 0


async def _all_items_terminal(s: AsyncSession, pid: int) -> bool:
    """True when every item is completed, cancelled or deferred."""
    q = select(func.count()).select_from(AuditProgramItem).where(
        AuditProgramItem.audit_program_id == pid,
        AuditProgramItem.item_status.notin_(["completed", "cancelled", "deferred"]),
    )
    non_terminal = (await s.execute(q)).scalar() or 0
    total = await _item_count(s, pid)
    return total > 0 and non_terminal == 0


def _set_status(p: AuditProgramV2, new_status: str):
    """Update status + timestamp."""
    p.status = new_status
    p.status_changed_at = datetime.utcnow()


# ── T1: draft → submitted ───────────────────────────────────
@programs_router.post("/{program_id}/submit", response_model=AuditProgramOut)
async def submit_program(program_id: int, s: AsyncSession = Depends(get_session)):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    if p.status != "draft":
        raise HTTPException(400, f"Nie mozna zlozyc programu w statusie '{p.status}' — wymagany 'draft'")

    cnt = await _item_count(s, p.id)
    if cnt == 0:
        raise HTTPException(400, "Program musi zawierac co najmniej 1 pozycje audytowa")

    _set_status(p, "submitted")
    p.submitted_at = datetime.utcnow()
    await _log(s, p.id, "program", p.id, "submitted",
               f"Zlozono program '{p.name}' do zatwierdzenia ({cnt} pozycji)",
               user_id=p.owner_id)
    await s.commit()
    await s.refresh(p)
    return await _enrich_program(s, p)


# ── T3: submitted → approved ────────────────────────────────
@programs_router.post("/{program_id}/approve", response_model=AuditProgramOut)
async def approve_program(
    program_id: int,
    body: ApprovePayload,
    s: AsyncSession = Depends(get_session),
):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    if p.status != "submitted":
        raise HTTPException(400, f"Zatwierdzanie mozliwe tylko w statusie 'submitted', aktualny: '{p.status}'")

    # For version > 1, justification is required
    if p.version > 1 and not (body.approval_justification or "").strip():
        raise HTTPException(400, "Uzasadnienie zatwierdzenia wymagane dla wersji > 1")

    _set_status(p, "approved")
    p.approved_at = datetime.utcnow()
    p.approved_by = p.approver_id
    p.approval_justification = body.approval_justification
    # Clear any prior rejection data
    p.rejection_reason = None
    p.rejected_at = None

    await _log(s, p.id, "program", p.id, "approved",
               f"Zatwierdzono program '{p.name}' v{p.version}",
               user_id=p.approver_id,
               justification=body.approval_justification)

    # Krok 4: Auto-generate version diff for corrections (v2+)
    if p.version > 1 and p.previous_version_id:
        prev = await s.get(AuditProgramV2, p.previous_version_id)
        if prev:
            await generate_version_diff(s, prev, p)

    await s.commit()
    await s.refresh(p)
    return await _enrich_program(s, p)


# ── T4+T5: submitted → rejected → auto draft ────────────────
@programs_router.post("/{program_id}/reject", response_model=AuditProgramOut)
async def reject_program(
    program_id: int,
    body: RejectPayload,
    s: AsyncSession = Depends(get_session),
):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    if p.status != "submitted":
        raise HTTPException(400, f"Odrzucanie mozliwe tylko w statusie 'submitted', aktualny: '{p.status}'")

    # T4: submitted → rejected
    p.rejection_reason = body.rejection_reason
    p.rejected_at = datetime.utcnow()
    await _log(s, p.id, "program", p.id, "rejected",
               f"Odrzucono program '{p.name}': {body.rejection_reason}",
               user_id=p.approver_id,
               justification=body.rejection_reason)

    # T5: auto-reset to draft
    _set_status(p, "draft")
    p.submitted_at = None
    await _log(s, p.id, "program", p.id, "status_changed",
               f"Program '{p.name}' automatycznie przywrocony do statusu draft po odrzuceniu",
               user_id=p.approver_id)

    await s.commit()
    await s.refresh(p)
    return await _enrich_program(s, p)


# ── T9: in_execution → completed ─────────────────────────────
@programs_router.post("/{program_id}/complete", response_model=AuditProgramOut)
async def complete_program(program_id: int, s: AsyncSession = Depends(get_session)):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    if p.status != "in_execution":
        raise HTTPException(400, f"Zakonczenie mozliwe tylko w statusie 'in_execution', aktualny: '{p.status}'")

    if not await _all_items_terminal(s, p.id):
        raise HTTPException(400, "Wszystkie pozycje musza miec status 'completed', 'cancelled' lub 'deferred'")

    _set_status(p, "completed")
    await _log(s, p.id, "program", p.id, "status_changed",
               f"Zakonczono program '{p.name}'",
               user_id=p.owner_id)
    await s.commit()
    await s.refresh(p)
    return await _enrich_program(s, p)


# ── T10: completed → archived ────────────────────────────────
@programs_router.post("/{program_id}/archive", response_model=AuditProgramOut)
async def archive_program(program_id: int, s: AsyncSession = Depends(get_session)):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    if p.status != "completed":
        raise HTTPException(400, f"Archiwizacja mozliwa tylko w statusie 'completed', aktualny: '{p.status}'")

    _set_status(p, "archived")
    await _log(s, p.id, "program", p.id, "status_changed",
               f"Zarchiwizowano program '{p.name}'",
               user_id=p.owner_id)
    await s.commit()
    await s.refresh(p)
    return await _enrich_program(s, p)


# ── T7/T8: approved|in_execution → superseded (initiate correction) ──
@programs_router.post("/{program_id}/initiate-correction", response_model=AuditProgramOut)
async def initiate_correction(
    program_id: int,
    body: CorrectionPayload,
    s: AsyncSession = Depends(get_session),
):
    """
    Create a new version (correction) of an approved/in_execution program.
    1. Validate: program must be 'approved' or 'in_execution'
    2. Old program → 'superseded', is_current_version = False
    3. New program → copy with version+1, status='draft', is_current_version = True
    4. Copy all audit_program_items (preserving engagement links)
    """
    original = await s.get(AuditProgramV2, program_id)
    if not original:
        raise HTTPException(404, "Program nie znaleziony")
    if original.status not in ("approved", "in_execution"):
        raise HTTPException(
            400,
            f"Korekta mozliwa tylko dla programu 'approved' lub 'in_execution', aktualny: '{original.status}'",
        )

    # 1. Supersede the original
    old_status = original.status
    _set_status(original, "superseded")
    original.is_current_version = False
    original.correction_reason = body.correction_reason
    original.correction_initiated_at = datetime.utcnow()

    await _log(s, original.id, "program", original.id, "correction_initiated",
               f"Inicjacja korekty programu '{original.name}' v{original.version}: {body.correction_reason}",
               user_id=original.owner_id,
               justification=body.correction_reason)

    # 2. Create new version
    new_p = AuditProgramV2(
        ref_id=original.ref_id,
        name=original.name,
        description=original.description,
        version=original.version + 1,
        version_group_id=original.version_group_id,
        is_current_version=True,
        previous_version_id=original.id,
        period_type=original.period_type,
        period_start=original.period_start,
        period_end=original.period_end,
        year=original.year,
        strategic_objectives=original.strategic_objectives,
        risks_and_opportunities=original.risks_and_opportunities,
        scope_description=original.scope_description,
        audit_criteria=original.audit_criteria,
        methods=original.methods,
        risk_assessment_ref=original.risk_assessment_ref,
        budget_planned_days=original.budget_planned_days,
        budget_actual_days=original.budget_actual_days,
        budget_planned_cost=original.budget_planned_cost,
        budget_actual_cost=original.budget_actual_cost,
        budget_currency=original.budget_currency,
        kpis=original.kpis,
        previous_program_id=original.previous_program_id,
        status="draft",
        owner_id=original.owner_id,
        approver_id=original.approver_id,
        org_unit_id=original.org_unit_id,
        created_by=original.owner_id,
    )
    s.add(new_p)
    await s.flush()  # get new_p.id

    # 3. Copy items
    items_q = select(AuditProgramItem).where(
        AuditProgramItem.audit_program_id == original.id,
    ).order_by(AuditProgramItem.display_order)
    old_items = (await s.execute(items_q)).scalars().all()

    for idx, oi in enumerate(old_items):
        new_item = AuditProgramItem(
            audit_program_id=new_p.id,
            ref_id=oi.ref_id,
            name=oi.name,
            description=oi.description,
            audit_type=oi.audit_type,
            planned_quarter=oi.planned_quarter,
            planned_month=oi.planned_month,
            planned_start=oi.planned_start,
            planned_end=oi.planned_end,
            scope_type=oi.scope_type,
            scope_id=oi.scope_id,
            scope_name=oi.scope_name,
            framework_ids=oi.framework_ids,
            criteria_description=oi.criteria_description,
            planned_days=oi.planned_days,
            planned_cost=oi.planned_cost,
            priority=oi.priority,
            risk_rating=oi.risk_rating,
            risk_justification=oi.risk_justification,
            lead_auditor_id=oi.lead_auditor_id,
            auditor_ids=oi.auditor_ids,
            audit_engagement_id=oi.audit_engagement_id,  # preserve link
            item_status="planned",  # reset to planned in new version
            audit_method=oi.audit_method,
            display_order=idx,
        )
        s.add(new_item)

    await _log(s, new_p.id, "program", new_p.id, "version_created",
               f"Utworzono korekta v{new_p.version} programu '{new_p.name}' "
               f"(z {old_status} v{original.version})",
               user_id=original.owner_id,
               justification=body.correction_reason)

    await s.commit()
    await s.refresh(new_p)
    return await _enrich_program(s, new_p)


# ── Version history ──
@programs_router.get("/{program_id}/versions")
async def list_versions(program_id: int, s: AsyncSession = Depends(get_session)):
    """List all versions of a program (by version_group_id)."""
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")

    q = (
        select(AuditProgramV2)
        .where(AuditProgramV2.version_group_id == p.version_group_id)
        .order_by(AuditProgramV2.version.desc())
    )
    rows = (await s.execute(q)).scalars().all()
    return [
        {
            "id": v.id,
            "version": v.version,
            "status": v.status,
            "is_current_version": v.is_current_version,
            "correction_reason": v.correction_reason,
            "approved_at": v.approved_at.isoformat() if v.approved_at else None,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in rows
    ]


# ── Version diffs (Krok 4) ──
@programs_router.get("/{program_id}/diffs")
async def list_diffs(program_id: int, s: AsyncSession = Depends(get_session)):
    """List all version diffs for a program (by version_group_id)."""
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")

    q = (
        select(AuditProgramVersionDiff)
        .where(AuditProgramVersionDiff.version_group_id == p.version_group_id)
        .order_by(AuditProgramVersionDiff.to_version.desc())
    )
    rows = (await s.execute(q)).scalars().all()
    return [
        {
            "id": d.id,
            "from_version_id": d.from_version_id,
            "to_version_id": d.to_version_id,
            "from_version": d.from_version,
            "to_version": d.to_version,
            "program_field_changes": d.program_field_changes,
            "items_added": d.items_added,
            "items_removed": d.items_removed,
            "items_modified": d.items_modified,
            "items_unchanged": d.items_unchanged,
            "summary": d.summary,
            "generated_at": d.generated_at.isoformat() if d.generated_at else None,
        }
        for d in rows
    ]


# ── Audit trail (Krok 5) ──
@programs_router.get("/{program_id}/history")
async def list_history(
    program_id: int,
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    performed_by: int | None = Query(None),
    date_from: date_type | None = Query(None, alias="from"),
    date_to: date_type | None = Query(None, alias="to"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    s: AsyncSession = Depends(get_session),
):
    """Return audit trail entries for a program with filtering."""
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")

    q = (
        select(AuditProgramHistory)
        .where(AuditProgramHistory.audit_program_id == program_id)
    )
    if action:
        q = q.where(AuditProgramHistory.action == action)
    if entity_type:
        q = q.where(AuditProgramHistory.entity_type == entity_type)
    if performed_by:
        q = q.where(AuditProgramHistory.performed_by == performed_by)
    if date_from:
        q = q.where(AuditProgramHistory.performed_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.where(AuditProgramHistory.performed_at <= datetime.combine(date_to, datetime.max.time()))

    # Count for pagination
    count_q = select(func.count()).select_from(q.subquery())
    total = (await s.execute(count_q)).scalar() or 0

    q = q.order_by(AuditProgramHistory.performed_at.desc()).offset(offset).limit(limit)
    rows = (await s.execute(q)).scalars().all()

    items = []
    for h in rows:
        performer_name = await _user_name(s, h.performed_by)
        items.append({
            "id": h.id,
            "entity_type": h.entity_type,
            "entity_id": h.entity_id,
            "action": h.action,
            "description": h.description,
            "justification": h.justification,
            "field_changes": h.field_changes,
            "change_request_id": h.change_request_id,
            "related_program_id": h.related_program_id,
            "performed_by": h.performed_by,
            "performed_by_name": performer_name,
            "performed_at": h.performed_at.isoformat() if h.performed_at else None,
        })

    return {"total": total, "items": items}


# ── T6: approved → in_execution (auto, triggered by item status change) ──
@items_router.post("/{item_id}/start")
async def start_item(item_id: int, s: AsyncSession = Depends(get_session)):
    """Mark item as in_progress. Auto-transitions program from approved → in_execution."""
    item = await s.get(AuditProgramItem, item_id)
    if not item:
        raise HTTPException(404, "Pozycja nie znaleziona")
    if item.item_status != "planned":
        raise HTTPException(400, f"Rozpoczecie mozliwe tylko dla pozycji 'planned', aktualny: '{item.item_status}'")

    p = await s.get(AuditProgramV2, item.audit_program_id)
    if not p or p.status not in ("approved", "in_execution"):
        raise HTTPException(400, "Rozpoczecie pozycji mozliwe tylko w programie 'approved' lub 'in_execution'")

    item.item_status = "in_progress"
    await _log(s, p.id, "program_item", item.id, "item_modified",
               f"Rozpoczeto pozycje '{item.name}'", user_id=p.owner_id)

    # T6: auto-transition program to in_execution
    if p.status == "approved":
        _set_status(p, "in_execution")
        await _log(s, p.id, "program", p.id, "status_changed",
                   f"Program '{p.name}' automatycznie przeszedl do statusu 'in_execution'",
                   user_id=p.owner_id)

    await s.commit()
    return {"status": "in_progress"}


# ── Mark item as completed ──
@items_router.post("/{item_id}/complete")
async def complete_item(item_id: int, s: AsyncSession = Depends(get_session)):
    """Mark item as completed."""
    item = await s.get(AuditProgramItem, item_id)
    if not item:
        raise HTTPException(404, "Pozycja nie znaleziona")
    if item.item_status != "in_progress":
        raise HTTPException(400, f"Zakonczenie mozliwe tylko dla pozycji 'in_progress', aktualny: '{item.item_status}'")

    p = await s.get(AuditProgramV2, item.audit_program_id)
    if not p or p.status not in ("approved", "in_execution"):
        raise HTTPException(400, "Zakonczenie pozycji mozliwe tylko w programie 'approved' lub 'in_execution'")

    item.item_status = "completed"
    await _log(s, p.id, "program_item", item.id, "item_modified",
               f"Zakonczono pozycje '{item.name}'", user_id=p.owner_id)
    await s.commit()
    return {"status": "completed"}


# ═══════════════════════════════════════════════════════════════
# CRUD: Program Items
# ═══════════════════════════════════════════════════════════════


@programs_router.get("/{program_id}/items", response_model=list[AuditProgramItemOut])
async def list_items(program_id: int, s: AsyncSession = Depends(get_session)):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    q = (
        select(AuditProgramItem)
        .where(AuditProgramItem.audit_program_id == program_id)
        .order_by(AuditProgramItem.display_order, AuditProgramItem.planned_quarter, AuditProgramItem.id)
    )
    rows = (await s.execute(q)).scalars().all()
    result = []
    for item in rows:
        out = AuditProgramItemOut.model_validate(item)
        out.lead_auditor_name = await _user_name(s, item.lead_auditor_id)
        result.append(out)
    return result


@programs_router.post("/{program_id}/items", response_model=AuditProgramItemOut, status_code=201)
async def create_item(
    program_id: int,
    body: AuditProgramItemCreate,
    s: AsyncSession = Depends(get_session),
):
    p = await s.get(AuditProgramV2, program_id)
    if not p:
        raise HTTPException(404, "Program nie znaleziony")
    if p.status != "draft":
        raise HTTPException(400, "Dodawanie pozycji mozliwe tylko w statusie 'draft'")

    ref_id = await _next_item_ref(s, program_id)
    item = AuditProgramItem(
        audit_program_id=program_id,
        ref_id=ref_id,
        **body.model_dump(),
    )
    s.add(item)
    await s.flush()
    await _log(s, program_id, "program_item", item.id, "item_added",
               f"Dodano pozycje '{item.name}' ({item.ref_id})", user_id=p.owner_id)
    await s.commit()
    await s.refresh(item)
    out = AuditProgramItemOut.model_validate(item)
    out.lead_auditor_name = await _user_name(s, item.lead_auditor_id)
    return out


@items_router.put("/{item_id}", response_model=AuditProgramItemOut)
async def update_item(
    item_id: int,
    body: AuditProgramItemUpdate,
    s: AsyncSession = Depends(get_session),
):
    item = await s.get(AuditProgramItem, item_id)
    if not item:
        raise HTTPException(404, "Pozycja nie znaleziona")
    p = await s.get(AuditProgramV2, item.audit_program_id)
    if not p or p.status != "draft":
        raise HTTPException(400, "Edycja pozycji mozliwa tylko w programie draft")

    changes = {}
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        old = getattr(item, k)
        if old != v:
            changes[k] = {"old": str(old), "new": str(v)}
            setattr(item, k, v)

    if changes:
        await _log(s, p.id, "program_item", item.id, "item_modified",
                   f"Zmodyfikowano pozycje '{item.name}'", user_id=p.owner_id,
                   field_changes=changes)
    await s.commit()
    await s.refresh(item)
    out = AuditProgramItemOut.model_validate(item)
    out.lead_auditor_name = await _user_name(s, item.lead_auditor_id)
    return out


@items_router.delete("/{item_id}")
async def delete_item(item_id: int, s: AsyncSession = Depends(get_session)):
    item = await s.get(AuditProgramItem, item_id)
    if not item:
        raise HTTPException(404, "Pozycja nie znaleziona")
    p = await s.get(AuditProgramV2, item.audit_program_id)
    if not p or p.status != "draft":
        raise HTTPException(400, "Usuwanie pozycji mozliwe tylko w programie draft")
    name = item.name
    prog_id = item.audit_program_id
    await s.delete(item)
    await _log(s, prog_id, "program_item", item_id, "item_removed",
               f"Usunieto pozycje '{name}'", user_id=p.owner_id)
    await s.commit()
    return {"status": "deleted"}


@items_router.post("/{item_id}/cancel")
async def cancel_item(
    item_id: int,
    body: CancelItemPayload,
    s: AsyncSession = Depends(get_session),
):
    item = await s.get(AuditProgramItem, item_id)
    if not item:
        raise HTTPException(404, "Pozycja nie znaleziona")
    if item.item_status not in ("planned", "in_progress"):
        raise HTTPException(400, f"Nie mozna anulowac pozycji w statusie '{item.item_status}'")
    p = await s.get(AuditProgramV2, item.audit_program_id)
    if not p or p.status != "draft":
        raise HTTPException(400, "Anulowanie mozliwe tylko w programie draft")
    item.item_status = "cancelled"
    item.cancellation_reason = body.cancellation_reason
    await _log(s, p.id, "program_item", item.id, "item_modified",
               f"Anulowano pozycje '{item.name}': {body.cancellation_reason}",
               user_id=p.owner_id)
    await s.commit()
    return {"status": "cancelled"}


@items_router.post("/{item_id}/defer")
async def defer_item(
    item_id: int,
    body: DeferItemPayload,
    s: AsyncSession = Depends(get_session),
):
    item = await s.get(AuditProgramItem, item_id)
    if not item:
        raise HTTPException(404, "Pozycja nie znaleziona")
    if item.item_status != "planned":
        raise HTTPException(400, "Odraczanie mozliwe tylko dla pozycji 'planned'")
    p = await s.get(AuditProgramV2, item.audit_program_id)
    if not p or p.status != "draft":
        raise HTTPException(400, "Odraczanie mozliwe tylko w programie draft")
    item.item_status = "deferred"
    item.deferral_reason = body.deferral_reason
    item.deferred_to_program_id = body.deferred_to_program_id
    await _log(s, p.id, "program_item", item.id, "item_modified",
               f"Odroczono pozycje '{item.name}': {body.deferral_reason}",
               user_id=p.owner_id)
    await s.commit()
    return {"status": "deferred"}


# ═══════════════════════════════════════════════════════════════
# CRUD: Suppliers
# ═══════════════════════════════════════════════════════════════


@suppliers_router.get("", response_model=list[SupplierOut])
async def list_suppliers(
    status: str | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = select(Supplier)
    if status:
        q = q.where(Supplier.status == status)
    q = q.order_by(Supplier.name)
    rows = (await s.execute(q)).scalars().all()
    return [SupplierOut.model_validate(r) for r in rows]


@suppliers_router.post("", response_model=SupplierOut, status_code=201)
async def create_supplier(body: SupplierCreate, s: AsyncSession = Depends(get_session)):
    sup = Supplier(**body.model_dump())
    s.add(sup)
    await s.commit()
    await s.refresh(sup)
    return SupplierOut.model_validate(sup)


@suppliers_router.get("/{supplier_id}", response_model=SupplierOut)
async def get_supplier(supplier_id: int, s: AsyncSession = Depends(get_session)):
    sup = await s.get(Supplier, supplier_id)
    if not sup:
        raise HTTPException(404, "Dostawca nie znaleziony")
    return SupplierOut.model_validate(sup)


@suppliers_router.put("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(supplier_id: int, body: SupplierUpdate, s: AsyncSession = Depends(get_session)):
    sup = await s.get(Supplier, supplier_id)
    if not sup:
        raise HTTPException(404, "Dostawca nie znaleziony")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(sup, k, v)
    await s.commit()
    await s.refresh(sup)
    return SupplierOut.model_validate(sup)


@suppliers_router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: int, s: AsyncSession = Depends(get_session)):
    sup = await s.get(Supplier, supplier_id)
    if not sup:
        raise HTTPException(404, "Dostawca nie znaleziony")
    await s.delete(sup)
    await s.commit()
    return {"status": "deleted"}


# ═══════════════════════════════════════════════════════════════
# CRUD: Locations
# ═══════════════════════════════════════════════════════════════


@locations_router.get("", response_model=list[LocationOut])
async def list_locations(
    status: str | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    q = select(Location)
    if status:
        q = q.where(Location.status == status)
    q = q.order_by(Location.name)
    rows = (await s.execute(q)).scalars().all()
    return [LocationOut.model_validate(r) for r in rows]


@locations_router.post("", response_model=LocationOut, status_code=201)
async def create_location(body: LocationCreate, s: AsyncSession = Depends(get_session)):
    loc = Location(**body.model_dump())
    s.add(loc)
    await s.commit()
    await s.refresh(loc)
    return LocationOut.model_validate(loc)


@locations_router.get("/{location_id}", response_model=LocationOut)
async def get_location(location_id: int, s: AsyncSession = Depends(get_session)):
    loc = await s.get(Location, location_id)
    if not loc:
        raise HTTPException(404, "Lokalizacja nie znaleziona")
    return LocationOut.model_validate(loc)


@locations_router.put("/{location_id}", response_model=LocationOut)
async def update_location(location_id: int, body: LocationUpdate, s: AsyncSession = Depends(get_session)):
    loc = await s.get(Location, location_id)
    if not loc:
        raise HTTPException(404, "Lokalizacja nie znaleziona")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(loc, k, v)
    await s.commit()
    await s.refresh(loc)
    return LocationOut.model_validate(loc)


@locations_router.delete("/{location_id}")
async def delete_location(location_id: int, s: AsyncSession = Depends(get_session)):
    loc = await s.get(Location, location_id)
    if not loc:
        raise HTTPException(404, "Lokalizacja nie znaleziona")
    await s.delete(loc)
    await s.commit()
    return {"status": "deleted"}
