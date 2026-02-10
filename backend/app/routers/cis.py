"""
CIS Benchmark module — /api/v1/cis

Controls (reference, read-only) + Assessments CRUD + Answers + Scoring.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.cis import (
    CisAssessment,
    CisAssessmentAnswer,
    CisControl,
    CisSubControl,
)
from app.models.dictionary import DictionaryEntry
from app.models.org_unit import OrgUnit
from app.schemas.cis import (
    CisAnswerOut,
    CisAnswersBatchUpsert,
    CisAnswerUpsert,
    CisAssessmentCreate,
    CisAssessmentOut,
    CisAssessmentUpdate,
    CisControlOut,
    CisSubControlOut,
)

router = APIRouter(prefix="/api/v1/cis", tags=["CIS Benchmark"])


# ── helpers ──

def _d(v: Decimal | None) -> float | None:
    return float(v) if v is not None else None


async def _assessment_out(s: AsyncSession, a: CisAssessment) -> CisAssessmentOut:
    org = await s.get(OrgUnit, a.org_unit_id) if a.org_unit_id else None
    status_label = None
    if a.status_id:
        de = await s.get(DictionaryEntry, a.status_id)
        status_label = de.label if de else None
    return CisAssessmentOut(
        id=a.id, org_unit_id=a.org_unit_id,
        org_unit_name=org.name if org else None,
        assessor_id=a.assessor_id, assessor_name=a.assessor_name,
        status_id=a.status_id, status_name=status_label,
        notes=a.notes, assessment_date=a.assessment_date,
        maturity_rating=_d(a.maturity_rating),
        risk_addressed_pct=_d(a.risk_addressed_pct),
        ig1_score=_d(a.ig1_score), ig2_score=_d(a.ig2_score),
        ig3_score=_d(a.ig3_score),
        created_at=a.created_at, updated_at=a.updated_at,
    )


async def _recalc_scores(s: AsyncSession, assessment_id: int):
    """Recalculate and store aggregate scores on the assessment row."""
    # Overall risk_addressed_pct
    q = select(
        func.avg(
            (
                func.coalesce(CisAssessmentAnswer.policy_value, 0)
                + func.coalesce(CisAssessmentAnswer.impl_value, 0)
                + func.coalesce(CisAssessmentAnswer.auto_value, 0)
                + func.coalesce(CisAssessmentAnswer.report_value, 0)
            ) / 4
        ).label("overall"),
    ).where(
        CisAssessmentAnswer.assessment_id == assessment_id,
        CisAssessmentAnswer.is_not_applicable.is_(False),
    )
    overall = (await s.execute(q)).scalar()

    # IG scores
    ig_scores = {}
    for ig_label, ig_val in [("ig1", "1"), ("ig2", "2"), ("ig3", "3")]:
        q = select(
            func.avg(
                (
                    func.coalesce(CisAssessmentAnswer.policy_value, 0)
                    + func.coalesce(CisAssessmentAnswer.impl_value, 0)
                    + func.coalesce(CisAssessmentAnswer.auto_value, 0)
                    + func.coalesce(CisAssessmentAnswer.report_value, 0)
                ) / 4
            )
        ).join(CisSubControl, CisAssessmentAnswer.sub_control_id == CisSubControl.id).where(
            CisAssessmentAnswer.assessment_id == assessment_id,
            CisAssessmentAnswer.is_not_applicable.is_(False),
            func.find_in_set(ig_val, CisSubControl.implementation_groups) > 0,
        )
        ig_scores[ig_label] = (await s.execute(q)).scalar()

    assessment = await s.get(CisAssessment, assessment_id)
    if assessment:
        assessment.risk_addressed_pct = round(float(overall or 0) * 100, 2)
        assessment.ig1_score = round(float(ig_scores["ig1"] or 0) * 100, 2) if ig_scores["ig1"] else None
        assessment.ig2_score = round(float(ig_scores["ig2"] or 0) * 100, 2) if ig_scores["ig2"] else None
        assessment.ig3_score = round(float(ig_scores["ig3"] or 0) * 100, 2) if ig_scores["ig3"] else None
        # Maturity rating (simplified 0–5 scale)
        pct = float(overall or 0)
        assessment.maturity_rating = round(pct * 5, 2)


# ═══════════════════ CONTROLS (read-only) ═══════════════════

@router.get("/controls", response_model=list[CisControlOut], summary="18 kontroli CIS z sub-kontrolami")
async def list_controls(s: AsyncSession = Depends(get_session)):
    q = (
        select(CisControl)
        .options(selectinload(CisControl.sub_controls))
        .order_by(CisControl.control_number)
    )
    controls = (await s.execute(q)).scalars().unique().all()
    return [
        CisControlOut(
            id=c.id, control_number=c.control_number,
            name_en=c.name_en, name_pl=c.name_pl,
            sub_control_count=c.sub_control_count,
            sub_controls=[CisSubControlOut.model_validate(sc) for sc in sorted(c.sub_controls, key=lambda x: x.sub_id)],
        )
        for c in controls
    ]


# ═══════════════════ ASSESSMENTS ═══════════════════

@router.get("/assessments", response_model=list[CisAssessmentOut], summary="Lista ocen CIS")
async def list_assessments(
    org_unit_id: int | None = Query(None, description="Filtr po jednostce (puste = wszystkie)"),
    s: AsyncSession = Depends(get_session),
):
    q = select(CisAssessment)
    if org_unit_id is not None:
        q = q.where(CisAssessment.org_unit_id == org_unit_id)
    elif org_unit_id is None:
        pass  # return all
    q = q.order_by(CisAssessment.assessment_date.desc())
    rows = (await s.execute(q)).scalars().all()
    return [await _assessment_out(s, a) for a in rows]


@router.get("/assessments/{assessment_id}", response_model=CisAssessmentOut, summary="Pobierz ocenę")
async def get_assessment(assessment_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(CisAssessment, assessment_id)
    if not a:
        raise HTTPException(404, "Ocena nie istnieje")
    return await _assessment_out(s, a)


@router.post("/assessments", response_model=CisAssessmentOut, status_code=201, summary="Utwórz ocenę CIS")
async def create_assessment(body: CisAssessmentCreate, s: AsyncSession = Depends(get_session)):
    a = CisAssessment(
        org_unit_id=body.org_unit_id,
        assessor_name=body.assessor_name,
        status_id=body.status_id,
        notes=body.notes,
    )
    s.add(a)
    await s.flush()

    # Copy answers from previous assessment if requested
    if body.copy_from_assessment_id:
        src = await s.get(CisAssessment, body.copy_from_assessment_id)
        if src:
            src_answers = (await s.execute(
                select(CisAssessmentAnswer).where(CisAssessmentAnswer.assessment_id == src.id)
            )).scalars().all()
            for ans in src_answers:
                s.add(CisAssessmentAnswer(
                    assessment_id=a.id,
                    sub_control_id=ans.sub_control_id,
                    policy_status_id=ans.policy_status_id,
                    impl_status_id=ans.impl_status_id,
                    auto_status_id=ans.auto_status_id,
                    report_status_id=ans.report_status_id,
                    is_not_applicable=ans.is_not_applicable,
                    policy_value=ans.policy_value,
                    impl_value=ans.impl_value,
                    auto_value=ans.auto_value,
                    report_value=ans.report_value,
                ))
            await s.flush()
            await _recalc_scores(s, a.id)

    await s.commit()
    await s.refresh(a)
    return await _assessment_out(s, a)


@router.put("/assessments/{assessment_id}", response_model=CisAssessmentOut, summary="Edytuj metadane oceny")
async def update_assessment(assessment_id: int, body: CisAssessmentUpdate, s: AsyncSession = Depends(get_session)):
    a = await s.get(CisAssessment, assessment_id)
    if not a:
        raise HTTPException(404, "Ocena nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    await s.commit()
    await s.refresh(a)
    return await _assessment_out(s, a)


@router.delete("/assessments/{assessment_id}", summary="Usuń ocenę (tylko robocze)")
async def delete_assessment(assessment_id: int, s: AsyncSession = Depends(get_session)):
    a = await s.get(CisAssessment, assessment_id)
    if not a:
        raise HTTPException(404, "Ocena nie istnieje")
    await s.delete(a)
    await s.commit()
    return {"status": "deleted", "id": assessment_id}


# ═══════════════════ ANSWERS ═══════════════════

@router.get("/assessments/{assessment_id}/answers", response_model=list[CisAnswerOut], summary="Odpowiedzi dla oceny")
async def list_answers(assessment_id: int, s: AsyncSession = Depends(get_session)):
    q = (
        select(CisAssessmentAnswer, CisSubControl.sub_id)
        .join(CisSubControl, CisAssessmentAnswer.sub_control_id == CisSubControl.id)
        .where(CisAssessmentAnswer.assessment_id == assessment_id)
        .order_by(CisSubControl.sub_id)
    )
    rows = (await s.execute(q)).all()
    return [
        CisAnswerOut(
            id=ans.id, assessment_id=ans.assessment_id,
            sub_control_id=ans.sub_control_id, sub_id=sub_id,
            policy_status_id=ans.policy_status_id,
            impl_status_id=ans.impl_status_id,
            auto_status_id=ans.auto_status_id,
            report_status_id=ans.report_status_id,
            is_not_applicable=ans.is_not_applicable,
            policy_value=_d(ans.policy_value),
            impl_value=_d(ans.impl_value),
            auto_value=_d(ans.auto_value),
            report_value=_d(ans.report_value),
        )
        for ans, sub_id in rows
    ]


@router.post(
    "/assessments/{assessment_id}/answers",
    response_model=dict,
    summary="Zapisz/aktualizuj odpowiedzi (batch upsert)",
)
async def upsert_answers(
    assessment_id: int,
    body: CisAnswersBatchUpsert,
    s: AsyncSession = Depends(get_session),
):
    a = await s.get(CisAssessment, assessment_id)
    if not a:
        raise HTTPException(404, "Ocena nie istnieje")

    created = 0
    updated = 0
    for item in body.answers:
        # Check if answer exists
        q = select(CisAssessmentAnswer).where(
            CisAssessmentAnswer.assessment_id == assessment_id,
            CisAssessmentAnswer.sub_control_id == item.sub_control_id,
        )
        existing = (await s.execute(q)).scalar_one_or_none()

        if existing:
            for k, v in item.model_dump(exclude={"sub_control_id"}).items():
                setattr(existing, k, v)
            updated += 1
        else:
            ans = CisAssessmentAnswer(
                assessment_id=assessment_id,
                **item.model_dump(),
            )
            s.add(ans)
            created += 1

    # Recalculate assessment scores
    await s.flush()
    await _recalc_scores(s, assessment_id)
    await s.commit()

    return {"status": "ok", "created": created, "updated": updated}
