"""
Audit & Findings registry module — /api/v1/audits
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.audit_register import Audit, AuditFinding
from app.models.dictionary import DictionaryEntry
from app.models.org_unit import OrgUnit
from app.models.security_area import SecurityDomain
from app.schemas.audit_register import (
    AuditCreate, AuditOut, AuditUpdate,
    FindingCreate, FindingOut, FindingUpdate,
)

router = APIRouter(prefix="/api/v1/audits", tags=["Rejestr audytów"])


async def _de_label(s: AsyncSession, entry_id: int | None) -> str | None:
    if entry_id is None:
        return None
    e = await s.get(DictionaryEntry, entry_id)
    return e.label if e else None


async def _audit_out(s: AsyncSession, a: Audit) -> AuditOut:
    org = await s.get(OrgUnit, a.org_unit_id) if a.org_unit_id else None
    fc = (await s.execute(
        select(func.count()).select_from(AuditFinding)
        .where(AuditFinding.audit_id == a.id)
        .where(AuditFinding.is_active.is_(True))
    )).scalar() or 0
    return AuditOut(
        id=a.id, ref_id=a.ref_id, title=a.title,
        audit_type_id=a.audit_type_id, audit_type_name=await _de_label(s, a.audit_type_id),
        framework=a.framework, auditor=a.auditor,
        org_unit_id=a.org_unit_id, org_unit_name=org.name if org else None,
        status=a.status, start_date=a.start_date, end_date=a.end_date,
        summary=a.summary,
        overall_rating_id=a.overall_rating_id,
        overall_rating_name=await _de_label(s, a.overall_rating_id),
        findings_count=fc,
        is_active=a.is_active, created_at=a.created_at, updated_at=a.updated_at,
    )


async def _finding_out(s: AsyncSession, f: AuditFinding) -> FindingOut:
    sa_name = None
    if f.security_area_id:
        sa = await s.get(SecurityDomain, f.security_area_id)
        sa_name = sa.name if sa else None
    return FindingOut(
        id=f.id, ref_id=f.ref_id, audit_id=f.audit_id,
        title=f.title, description=f.description,
        finding_type_id=f.finding_type_id, finding_type_name=await _de_label(s, f.finding_type_id),
        severity_id=f.severity_id, severity_name=await _de_label(s, f.severity_id),
        security_area_id=f.security_area_id, security_area_name=sa_name,
        framework_node_id=f.framework_node_id,
        remediation_owner=f.remediation_owner,
        status_id=f.status_id, status_name=await _de_label(s, f.status_id),
        sla_deadline=f.sla_deadline,
        remediation_plan=f.remediation_plan, remediation_evidence=f.remediation_evidence,
        risk_id=f.risk_id, vulnerability_id=f.vulnerability_id,
        is_active=f.is_active, created_at=f.created_at, updated_at=f.updated_at,
    )


# ═══════════════════ AUDITS ═══════════════════

@router.get("", response_model=list[AuditOut], summary="Lista audytów")
async def list_audits(
    org_unit_id: int | None = Query(None),
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(Audit)
    if not include_archived:
        q = q.where(Audit.is_active.is_(True))
    if org_unit_id is not None:
        q = q.where(Audit.org_unit_id == org_unit_id)
    q = q.order_by(Audit.created_at.desc())
    audits = (await s.execute(q)).scalars().all()
    return [await _audit_out(s, a) for a in audits]


@router.get("/{audit_id}", response_model=AuditOut, summary="Szczegóły audytu")
async def get_audit(audit_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(Audit, audit_id)
    if not a:
        raise HTTPException(404, "Audyt nie istnieje")
    return await _audit_out(s, a)


@router.post("", response_model=AuditOut, status_code=201, summary="Nowy audyt")
async def create_audit(body: AuditCreate, s: AsyncSession = Depends(get_session)):
    a = Audit(**body.model_dump())
    s.add(a)
    await s.flush()
    a.ref_id = f"AUD-{a.id:04d}"
    await s.commit()
    await s.refresh(a)
    return await _audit_out(s, a)


@router.put("/{audit_id}", response_model=AuditOut, summary="Edycja audytu")
async def update_audit(audit_id: int, body: AuditUpdate, s: AsyncSession = Depends(get_session)):
    a = await s.get(Audit, audit_id)
    if not a:
        raise HTTPException(404, "Audyt nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    await s.commit()
    await s.refresh(a)
    return await _audit_out(s, a)


@router.delete("/{audit_id}", summary="Archiwizuj audyt")
async def archive_audit(audit_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(Audit, audit_id)
    if not a:
        raise HTTPException(404, "Audyt nie istnieje")
    a.is_active = False
    await s.commit()
    return {"status": "archived", "id": audit_id}


# ═══════════════════ FINDINGS ═══════════════════

@router.get("/{audit_id}/findings", response_model=list[FindingOut], summary="Findings audytu")
async def list_findings(
    audit_id: int,
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(AuditFinding).where(AuditFinding.audit_id == audit_id)
    if not include_archived:
        q = q.where(AuditFinding.is_active.is_(True))
    q = q.order_by(AuditFinding.created_at.desc())
    findings = (await s.execute(q)).scalars().all()
    return [await _finding_out(s, f) for f in findings]


@router.post("/{audit_id}/findings", response_model=FindingOut, status_code=201, summary="Nowy finding")
async def create_finding(audit_id: int, body: FindingCreate, s: AsyncSession = Depends(get_session)):
    a = await s.get(Audit, audit_id)
    if not a:
        raise HTTPException(404, "Audyt nie istnieje")
    f = AuditFinding(audit_id=audit_id, **body.model_dump())
    s.add(f)
    await s.flush()
    f.ref_id = f"FND-{f.id:04d}"
    await s.commit()
    await s.refresh(f)
    return await _finding_out(s, f)


@router.put("/{audit_id}/findings/{finding_id}", response_model=FindingOut, summary="Edycja findingu")
async def update_finding(
    audit_id: int, finding_id: int, body: FindingUpdate,
    s: AsyncSession = Depends(get_session),
):
    f = await s.get(AuditFinding, finding_id)
    if not f or f.audit_id != audit_id:
        raise HTTPException(404, "Finding nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(f, k, v)
    await s.commit()
    await s.refresh(f)
    return await _finding_out(s, f)


@router.delete("/{audit_id}/findings/{finding_id}", summary="Archiwizuj finding")
async def archive_finding(audit_id: int, finding_id: int, s: AsyncSession = Depends(get_session)):
    f = await s.get(AuditFinding, finding_id)
    if not f or f.audit_id != audit_id:
        raise HTTPException(404, "Finding nie istnieje")
    f.is_active = False
    await s.commit()
    return {"status": "archived", "id": finding_id}
