"""
Vendor (TPRM) registry module — /api/v1/vendors
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.vendor import Vendor, VendorAssessment, VendorAssessmentAnswer
from app.models.dictionary import DictionaryEntry
from app.schemas.vendor import (
    VendorAssessmentCreate, VendorAssessmentOut,
    VendorCreate, VendorOut, VendorStatusChange, VendorUpdate,
)

router = APIRouter(prefix="/api/v1/vendors", tags=["Zarządzanie dostawcami (TPRM)"])


async def _de_label(s: AsyncSession, entry_id: int | None) -> str | None:
    if entry_id is None:
        return None
    e = await s.get(DictionaryEntry, entry_id)
    return e.label if e else None


async def _vendor_out(s: AsyncSession, v: Vendor) -> VendorOut:
    return VendorOut(
        id=v.id, ref_id=v.ref_id, name=v.name,
        category_id=v.category_id, category_name=await _de_label(s, v.category_id),
        criticality_id=v.criticality_id, criticality_name=await _de_label(s, v.criticality_id),
        services_provided=v.services_provided,
        data_access_level_id=v.data_access_level_id,
        data_access_level_name=await _de_label(s, v.data_access_level_id),
        contract_owner=v.contract_owner, security_contact=v.security_contact,
        contract_start=v.contract_start, contract_end=v.contract_end,
        sla_description=v.sla_description,
        status_id=v.status_id, status_name=await _de_label(s, v.status_id),
        last_assessment_date=v.last_assessment_date,
        next_assessment_date=v.next_assessment_date,
        risk_rating_id=v.risk_rating_id, risk_rating_name=await _de_label(s, v.risk_rating_id),
        risk_score=float(v.risk_score) if v.risk_score is not None else None,
        questionnaire_completed=v.questionnaire_completed or False,
        certifications=v.certifications, risk_id=v.risk_id,
        is_active=v.is_active, created_at=v.created_at, updated_at=v.updated_at,
    )


async def _assessment_out(s: AsyncSession, a: VendorAssessment) -> VendorAssessmentOut:
    answers_q = select(VendorAssessmentAnswer).where(VendorAssessmentAnswer.assessment_id == a.id)
    answers = (await s.execute(answers_q)).scalars().all()
    return VendorAssessmentOut(
        id=a.id, vendor_id=a.vendor_id, assessment_date=a.assessment_date,
        assessed_by=a.assessed_by,
        total_score=float(a.total_score) if a.total_score is not None else None,
        risk_rating_id=a.risk_rating_id,
        risk_rating_name=await _de_label(s, a.risk_rating_id),
        notes=a.notes, answers=answers,
        created_at=a.created_at, updated_at=a.updated_at,
    )


def _score_to_rating_code(score: float) -> str:
    """Map total_score (0-100) to risk rating code."""
    if score >= 90:
        return "a_niskie_ryzyko"
    elif score >= 70:
        return "b"
    elif score >= 40:
        return "c"
    return "d_wysokie_ryzyko"


# ═══════════════════ METRICS (before /{id}) ═══════════════════

@router.get("/metrics", summary="Metryki TPRM dla Security Score")
async def vendor_metrics(s: AsyncSession = Depends(get_session)):
    q = select(Vendor).where(Vendor.is_active.is_(True))
    vendors = (await s.execute(q)).scalars().all()
    total = len(vendors)
    if total == 0:
        return {"coverage_score": 0, "rating_score": 0, "timeliness_score": 100, "tprm_score": 0, "total_vendors": 0}

    one_year_ago = date.today() - timedelta(days=365)
    assessed = sum(1 for v in vendors if v.last_assessment_date and v.last_assessment_date >= one_year_ago)
    coverage_score = (assessed / total) * 100

    crit_weights = {"krytyczny": 4, "wysoki": 3, "średni": 2, "niski": 1}
    weighted_sum = 0.0
    weight_total = 0.0
    for v in vendors:
        if v.risk_score is not None and v.criticality_id:
            crit_label = await _de_label(s, v.criticality_id)
            w = crit_weights.get((crit_label or "").lower(), 1)
            weighted_sum += float(v.risk_score) * w
            weight_total += w
    rating_score = (weighted_sum / weight_total) if weight_total > 0 else 0

    overdue = sum(1 for v in vendors if v.next_assessment_date and v.next_assessment_date < date.today())
    timeliness_score = 100 - (overdue / total * 100)

    tprm_score = coverage_score * 0.4 + rating_score * 0.4 + timeliness_score * 0.2

    return {
        "coverage_score": round(coverage_score, 1),
        "rating_score": round(rating_score, 1),
        "timeliness_score": round(timeliness_score, 1),
        "tprm_score": round(tprm_score, 1),
        "total_vendors": total,
        "assessed_last_12m": assessed,
        "overdue_assessments": overdue,
    }


# ═══════════════════ LIST ═══════════════════

@router.get("", response_model=list[VendorOut], summary="Lista dostawców")
async def list_vendors(
    category_id: int | None = Query(None),
    criticality_id: int | None = Query(None),
    status_id: int | None = Query(None),
    risk_rating_id: int | None = Query(None),
    include_archived: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(Vendor)
    if not include_archived:
        q = q.where(Vendor.is_active.is_(True))
    if category_id is not None:
        q = q.where(Vendor.category_id == category_id)
    if criticality_id is not None:
        q = q.where(Vendor.criticality_id == criticality_id)
    if status_id is not None:
        q = q.where(Vendor.status_id == status_id)
    if risk_rating_id is not None:
        q = q.where(Vendor.risk_rating_id == risk_rating_id)
    q = q.order_by(Vendor.name)
    vendors = (await s.execute(q)).scalars().all()
    return [await _vendor_out(s, v) for v in vendors]


@router.get("/{vendor_id}", response_model=VendorOut, summary="Szczegóły dostawcy")
async def get_vendor(vendor_id: int, s: AsyncSession = Depends(get_session)):
    v = await s.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(404, "Dostawca nie istnieje")
    return await _vendor_out(s, v)


@router.post("", response_model=VendorOut, status_code=201, summary="Nowy dostawca")
async def create_vendor(body: VendorCreate, s: AsyncSession = Depends(get_session)):
    v = Vendor(**body.model_dump())
    s.add(v)
    await s.flush()
    v.ref_id = f"VND-{v.id:04d}"
    await s.commit()
    await s.refresh(v)
    return await _vendor_out(s, v)


@router.put("/{vendor_id}", response_model=VendorOut, summary="Edycja dostawcy")
async def update_vendor(vendor_id: int, body: VendorUpdate, s: AsyncSession = Depends(get_session)):
    v = await s.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(404, "Dostawca nie istnieje")
    for k, val in body.model_dump(exclude_unset=True).items():
        setattr(v, k, val)
    await s.commit()
    await s.refresh(v)
    return await _vendor_out(s, v)


@router.patch("/{vendor_id}/status", response_model=VendorOut, summary="Zmiana statusu dostawcy")
async def change_vendor_status(vendor_id: int, body: VendorStatusChange, s: AsyncSession = Depends(get_session)):
    v = await s.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(404, "Dostawca nie istnieje")
    v.status_id = body.status_id
    await s.commit()
    await s.refresh(v)
    return await _vendor_out(s, v)


@router.delete("/{vendor_id}", summary="Archiwizuj dostawcę")
async def archive_vendor(vendor_id: int, s: AsyncSession = Depends(get_session)):
    v = await s.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(404, "Dostawca nie istnieje")
    v.is_active = False
    await s.commit()
    return {"status": "archived", "id": vendor_id}


# ═══════════════════ ASSESSMENTS ═══════════════════

@router.get("/{vendor_id}/assessments", response_model=list[VendorAssessmentOut], summary="Historia ocen dostawcy")
async def list_assessments(vendor_id: int, s: AsyncSession = Depends(get_session)):
    q = (select(VendorAssessment)
         .where(VendorAssessment.vendor_id == vendor_id)
         .order_by(VendorAssessment.assessment_date.desc()))
    assessments = (await s.execute(q)).scalars().all()
    return [await _assessment_out(s, a) for a in assessments]


@router.post("/{vendor_id}/assessments", response_model=VendorAssessmentOut, status_code=201, summary="Nowa ocena dostawcy")
async def create_assessment(vendor_id: int, body: VendorAssessmentCreate, s: AsyncSession = Depends(get_session)):
    v = await s.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(404, "Dostawca nie istnieje")

    a = VendorAssessment(
        vendor_id=vendor_id,
        assessment_date=body.assessment_date,
        assessed_by=body.assessed_by,
        notes=body.notes,
    )

    # Calculate total score from answers
    if body.answers:
        total = sum(ans.answer for ans in body.answers)
        max_possible = len(body.answers) * 5
        a.total_score = round(total / max_possible * 100, 2) if max_possible > 0 else 0

        # Auto-map risk rating
        rating_code = _score_to_rating_code(float(a.total_score))
        from sqlalchemy import and_
        from app.models.dictionary import DictionaryType
        rating_q = (select(DictionaryEntry)
                    .select_from(DictionaryEntry)
                    .join(DictionaryType, DictionaryEntry.dict_type_id == DictionaryType.id)
                    .where(and_(DictionaryType.code == "vendor_risk_rating", DictionaryEntry.code == rating_code)))
        rating_entry = (await s.execute(rating_q)).scalars().first()
        if rating_entry:
            a.risk_rating_id = rating_entry.id

    s.add(a)
    await s.flush()

    # Create answers
    for ans_data in body.answers:
        answer = VendorAssessmentAnswer(
            assessment_id=a.id,
            question_code=ans_data.question_code,
            question_text=ans_data.question_text,
            answer=ans_data.answer,
            notes=ans_data.notes,
        )
        s.add(answer)

    # Update vendor
    v.last_assessment_date = body.assessment_date
    v.next_assessment_date = body.assessment_date + timedelta(days=365)
    v.questionnaire_completed = True
    if a.total_score is not None:
        v.risk_score = a.total_score
    if a.risk_rating_id:
        v.risk_rating_id = a.risk_rating_id

    await s.commit()
    await s.refresh(a)
    return await _assessment_out(s, a)


@router.get("/{vendor_id}/assessments/{assessment_id}", response_model=VendorAssessmentOut, summary="Szczegóły oceny")
async def get_assessment(vendor_id: int, assessment_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(VendorAssessment, assessment_id)
    if not a or a.vendor_id != vendor_id:
        raise HTTPException(404, "Ocena nie istnieje")
    return await _assessment_out(s, a)
