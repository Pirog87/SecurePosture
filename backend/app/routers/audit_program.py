"""
Audit Program CRUD + lifecycle + items + suppliers + locations.
Spec: docs/SPECYFIKACJA_AUDIT_PROGRAM_v1.md — Krok 1
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.audit_program import (
    AuditProgramV2,
    AuditProgramItem,
    AuditProgramHistory,
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
