"""
Catalogs module — /api/v1/threats, /api/v1/vulnerabilities, /api/v1/safeguards
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.database import get_session
from app.models.catalog import Safeguard, Threat, Vulnerability
from app.models.dictionary import DictionaryEntry
from app.models.security_area import SecurityArea
from app.schemas.catalog import (
    SafeguardCreate,
    SafeguardOut,
    SafeguardUpdate,
    ThreatCreate,
    ThreatOut,
    ThreatUpdate,
    VulnerabilityCreate,
    VulnerabilityOut,
    VulnerabilityUpdate,
)

router = APIRouter(tags=["Katalogi"])


# helper: resolve asset_type_name from id
async def _asset_type_label(s: AsyncSession, asset_type_id: int | None) -> str | None:
    if asset_type_id is None:
        return None
    e = await s.get(DictionaryEntry, asset_type_id)
    return e.label if e else None


# ═══════════════════ THREATS ═══════════════════

@router.get("/api/v1/threats", response_model=list[ThreatOut], summary="Lista zagrożeń")
async def list_threats(
    include_archived: bool = Query(False),
    category_id: int | None = Query(None),
    asset_type_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    cat = aliased(DictionaryEntry)
    atype = aliased(DictionaryEntry)
    q = (
        select(Threat, cat.label.label("cat_name"), atype.label.label("atype_name"))
        .outerjoin(cat, Threat.category_id == cat.id)
        .outerjoin(atype, Threat.asset_type_id == atype.id)
    )
    if not include_archived:
        q = q.where(Threat.is_active.is_(True))
    if category_id is not None:
        q = q.where(Threat.category_id == category_id)
    if asset_type_id is not None:
        q = q.where((Threat.asset_type_id == asset_type_id) | (Threat.asset_type_id.is_(None)))
    q = q.order_by(Threat.name)
    rows = (await s.execute(q)).all()
    return [
        ThreatOut(
            id=t.id, name=t.name, category_id=t.category_id, category_name=cn,
            asset_type_id=t.asset_type_id, asset_type_name=atn,
            description=t.description, is_active=t.is_active,
            created_at=t.created_at, updated_at=t.updated_at,
        )
        for t, cn, atn in rows
    ]


@router.get("/api/v1/threats/{threat_id}", response_model=ThreatOut, summary="Pobierz zagrożenie")
async def get_threat(threat_id: int, s: AsyncSession = Depends(get_session)):
    cat = aliased(DictionaryEntry)
    atype = aliased(DictionaryEntry)
    q = (
        select(Threat, cat.label.label("cn"), atype.label.label("atn"))
        .outerjoin(cat, Threat.category_id == cat.id)
        .outerjoin(atype, Threat.asset_type_id == atype.id)
        .where(Threat.id == threat_id)
    )
    row = (await s.execute(q)).first()
    if not row:
        raise HTTPException(404, "Zagrożenie nie istnieje")
    t, cn, atn = row
    return ThreatOut(id=t.id, name=t.name, category_id=t.category_id, category_name=cn,
                     asset_type_id=t.asset_type_id, asset_type_name=atn,
                     description=t.description, is_active=t.is_active,
                     created_at=t.created_at, updated_at=t.updated_at)


@router.post("/api/v1/threats", response_model=ThreatOut, status_code=201, summary="Utwórz zagrożenie")
async def create_threat(body: ThreatCreate, s: AsyncSession = Depends(get_session)):
    t = Threat(**body.model_dump())
    s.add(t)
    await s.commit()
    await s.refresh(t)
    atn = await _asset_type_label(s, t.asset_type_id)
    return ThreatOut(id=t.id, name=t.name, category_id=t.category_id,
                     asset_type_id=t.asset_type_id, asset_type_name=atn,
                     description=t.description, is_active=t.is_active,
                     created_at=t.created_at, updated_at=t.updated_at)


@router.put("/api/v1/threats/{threat_id}", response_model=ThreatOut, summary="Edytuj zagrożenie")
async def update_threat(threat_id: int, body: ThreatUpdate, s: AsyncSession = Depends(get_session)):
    t = await s.get(Threat, threat_id)
    if not t:
        raise HTTPException(404, "Zagrożenie nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    await s.commit()
    await s.refresh(t)
    atn = await _asset_type_label(s, t.asset_type_id)
    return ThreatOut(id=t.id, name=t.name, category_id=t.category_id,
                     asset_type_id=t.asset_type_id, asset_type_name=atn,
                     description=t.description, is_active=t.is_active,
                     created_at=t.created_at, updated_at=t.updated_at)


@router.delete("/api/v1/threats/{threat_id}", summary="Archiwizuj zagrożenie")
async def archive_threat(threat_id: int, s: AsyncSession = Depends(get_session)):
    t = await s.get(Threat, threat_id)
    if not t:
        raise HTTPException(404, "Zagrożenie nie istnieje")
    t.is_active = False
    await s.commit()
    return {"status": "archived", "id": threat_id}


# ═══════════════════ VULNERABILITIES ═══════════════════

@router.get("/api/v1/vulnerabilities", response_model=list[VulnerabilityOut], summary="Lista podatności")
async def list_vulnerabilities(
    include_archived: bool = Query(False),
    security_area_id: int | None = Query(None),
    asset_type_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    atype = aliased(DictionaryEntry)
    q = (
        select(Vulnerability, SecurityArea.name.label("area_name"), atype.label.label("atype_name"))
        .outerjoin(SecurityArea, Vulnerability.security_area_id == SecurityArea.id)
        .outerjoin(atype, Vulnerability.asset_type_id == atype.id)
    )
    if not include_archived:
        q = q.where(Vulnerability.is_active.is_(True))
    if security_area_id is not None:
        q = q.where(Vulnerability.security_area_id == security_area_id)
    if asset_type_id is not None:
        q = q.where((Vulnerability.asset_type_id == asset_type_id) | (Vulnerability.asset_type_id.is_(None)))
    q = q.order_by(Vulnerability.name)
    rows = (await s.execute(q)).all()
    return [
        VulnerabilityOut(
            id=v.id, name=v.name, security_area_id=v.security_area_id,
            security_area_name=an, asset_type_id=v.asset_type_id, asset_type_name=atn,
            description=v.description, is_active=v.is_active,
            created_at=v.created_at, updated_at=v.updated_at,
        )
        for v, an, atn in rows
    ]


@router.get("/api/v1/vulnerabilities/{vuln_id}", response_model=VulnerabilityOut, summary="Pobierz podatność")
async def get_vulnerability(vuln_id: int, s: AsyncSession = Depends(get_session)):
    atype = aliased(DictionaryEntry)
    q = (
        select(Vulnerability, SecurityArea.name.label("an"), atype.label.label("atn"))
        .outerjoin(SecurityArea, Vulnerability.security_area_id == SecurityArea.id)
        .outerjoin(atype, Vulnerability.asset_type_id == atype.id)
        .where(Vulnerability.id == vuln_id)
    )
    row = (await s.execute(q)).first()
    if not row:
        raise HTTPException(404, "Podatność nie istnieje")
    v, an, atn = row
    return VulnerabilityOut(id=v.id, name=v.name, security_area_id=v.security_area_id,
                            security_area_name=an, asset_type_id=v.asset_type_id, asset_type_name=atn,
                            description=v.description,
                            is_active=v.is_active, created_at=v.created_at, updated_at=v.updated_at)


@router.post("/api/v1/vulnerabilities", response_model=VulnerabilityOut, status_code=201, summary="Utwórz podatność")
async def create_vulnerability(body: VulnerabilityCreate, s: AsyncSession = Depends(get_session)):
    v = Vulnerability(**body.model_dump())
    s.add(v)
    await s.commit()
    await s.refresh(v)
    atn = await _asset_type_label(s, v.asset_type_id)
    return VulnerabilityOut(id=v.id, name=v.name, security_area_id=v.security_area_id,
                            asset_type_id=v.asset_type_id, asset_type_name=atn,
                            description=v.description, is_active=v.is_active,
                            created_at=v.created_at, updated_at=v.updated_at)


@router.put("/api/v1/vulnerabilities/{vuln_id}", response_model=VulnerabilityOut, summary="Edytuj podatność")
async def update_vulnerability(vuln_id: int, body: VulnerabilityUpdate, s: AsyncSession = Depends(get_session)):
    v = await s.get(Vulnerability, vuln_id)
    if not v:
        raise HTTPException(404, "Podatność nie istnieje")
    for k, val in body.model_dump(exclude_unset=True).items():
        setattr(v, k, val)
    await s.commit()
    await s.refresh(v)
    atn = await _asset_type_label(s, v.asset_type_id)
    return VulnerabilityOut(id=v.id, name=v.name, security_area_id=v.security_area_id,
                            asset_type_id=v.asset_type_id, asset_type_name=atn,
                            description=v.description, is_active=v.is_active,
                            created_at=v.created_at, updated_at=v.updated_at)


@router.delete("/api/v1/vulnerabilities/{vuln_id}", summary="Archiwizuj podatność")
async def archive_vulnerability(vuln_id: int, s: AsyncSession = Depends(get_session)):
    v = await s.get(Vulnerability, vuln_id)
    if not v:
        raise HTTPException(404, "Podatność nie istnieje")
    v.is_active = False
    await s.commit()
    return {"status": "archived", "id": vuln_id}


# ═══════════════════ SAFEGUARDS ═══════════════════

@router.get("/api/v1/safeguards", response_model=list[SafeguardOut], summary="Lista zabezpieczeń")
async def list_safeguards(
    include_archived: bool = Query(False),
    type_id: int | None = Query(None),
    asset_type_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    t = aliased(DictionaryEntry)
    atype = aliased(DictionaryEntry)
    q = (
        select(Safeguard, t.label.label("type_name"), atype.label.label("atype_name"))
        .outerjoin(t, Safeguard.type_id == t.id)
        .outerjoin(atype, Safeguard.asset_type_id == atype.id)
    )
    if not include_archived:
        q = q.where(Safeguard.is_active.is_(True))
    if type_id is not None:
        q = q.where(Safeguard.type_id == type_id)
    if asset_type_id is not None:
        q = q.where((Safeguard.asset_type_id == asset_type_id) | (Safeguard.asset_type_id.is_(None)))
    q = q.order_by(Safeguard.name)
    rows = (await s.execute(q)).all()
    return [
        SafeguardOut(
            id=sg.id, name=sg.name, type_id=sg.type_id, type_name=tn,
            asset_type_id=sg.asset_type_id, asset_type_name=atn,
            description=sg.description, is_active=sg.is_active,
            created_at=sg.created_at, updated_at=sg.updated_at,
        )
        for sg, tn, atn in rows
    ]


@router.get("/api/v1/safeguards/{sg_id}", response_model=SafeguardOut, summary="Pobierz zabezpieczenie")
async def get_safeguard(sg_id: int, s: AsyncSession = Depends(get_session)):
    t = aliased(DictionaryEntry)
    atype = aliased(DictionaryEntry)
    q = (
        select(Safeguard, t.label.label("tn"), atype.label.label("atn"))
        .outerjoin(t, Safeguard.type_id == t.id)
        .outerjoin(atype, Safeguard.asset_type_id == atype.id)
        .where(Safeguard.id == sg_id)
    )
    row = (await s.execute(q)).first()
    if not row:
        raise HTTPException(404, "Zabezpieczenie nie istnieje")
    sg, tn, atn = row
    return SafeguardOut(id=sg.id, name=sg.name, type_id=sg.type_id, type_name=tn,
                        asset_type_id=sg.asset_type_id, asset_type_name=atn,
                        description=sg.description, is_active=sg.is_active,
                        created_at=sg.created_at, updated_at=sg.updated_at)


@router.post("/api/v1/safeguards", response_model=SafeguardOut, status_code=201, summary="Utwórz zabezpieczenie")
async def create_safeguard(body: SafeguardCreate, s: AsyncSession = Depends(get_session)):
    sg = Safeguard(**body.model_dump())
    s.add(sg)
    await s.commit()
    await s.refresh(sg)
    atn = await _asset_type_label(s, sg.asset_type_id)
    return SafeguardOut(id=sg.id, name=sg.name, type_id=sg.type_id,
                        asset_type_id=sg.asset_type_id, asset_type_name=atn,
                        description=sg.description, is_active=sg.is_active,
                        created_at=sg.created_at, updated_at=sg.updated_at)


@router.put("/api/v1/safeguards/{sg_id}", response_model=SafeguardOut, summary="Edytuj zabezpieczenie")
async def update_safeguard(sg_id: int, body: SafeguardUpdate, s: AsyncSession = Depends(get_session)):
    sg = await s.get(Safeguard, sg_id)
    if not sg:
        raise HTTPException(404, "Zabezpieczenie nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(sg, k, v)
    await s.commit()
    await s.refresh(sg)
    atn = await _asset_type_label(s, sg.asset_type_id)
    return SafeguardOut(id=sg.id, name=sg.name, type_id=sg.type_id,
                        asset_type_id=sg.asset_type_id, asset_type_name=atn,
                        description=sg.description, is_active=sg.is_active,
                        created_at=sg.created_at, updated_at=sg.updated_at)


@router.delete("/api/v1/safeguards/{sg_id}", summary="Archiwizuj zabezpieczenie")
async def archive_safeguard(sg_id: int, s: AsyncSession = Depends(get_session)):
    sg = await s.get(Safeguard, sg_id)
    if not sg:
        raise HTTPException(404, "Zabezpieczenie nie istnieje")
    sg.is_active = False
    await s.commit()
    return {"status": "archived", "id": sg_id}
