"""
Organizational Context module — /api/v1/org-units/{id}/context/...
ISO 27001/22301 clause 4

Inheritance types:
  - Additive: issues, obligations, stakeholders (parent + own merged)
  - Overridable: scope, risk_appetite (own or closest ancestor)
  - Local: reviews, snapshots (only own org unit)
"""
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.dictionary import DictionaryEntry
from app.models.org_context import (
    OrgContextIssue,
    OrgContextObligation,
    OrgContextRiskAppetite,
    OrgContextReview,
    OrgContextScope,
    OrgContextSnapshot,
    OrgContextStakeholder,
)
from app.models.org_unit import OrgUnit
from app.schemas.org_context import (
    OrgContextIssueCreate,
    OrgContextIssueOut,
    OrgContextIssueUpdate,
    OrgContextObligationCreate,
    OrgContextObligationOut,
    OrgContextObligationUpdate,
    OrgContextOverview,
    OrgContextReviewCreate,
    OrgContextReviewOut,
    OrgContextReviewUpdate,
    OrgContextRiskAppetiteCreate,
    OrgContextRiskAppetiteOut,
    OrgContextRiskAppetiteUpdate,
    OrgContextScopeCreate,
    OrgContextScopeOut,
    OrgContextScopeUpdate,
    OrgContextSnapshotCreate,
    OrgContextSnapshotOut,
    OrgContextStakeholderCreate,
    OrgContextStakeholderOut,
    OrgContextStakeholderUpdate,
    OrgUnitContextOut,
    OrgUnitContextUpdate,
)

router = APIRouter(tags=["Kontekst organizacyjny"])

PREFIX = "/api/v1/org-units/{org_unit_id}/context"


# ═══════════════════ HELPERS ═══════════════════

async def _get_org_unit(s: AsyncSession, org_unit_id: int) -> OrgUnit:
    unit = await s.get(OrgUnit, org_unit_id)
    if not unit:
        raise HTTPException(404, "Jednostka organizacyjna nie istnieje")
    return unit


async def _get_ancestor_chain(s: AsyncSession, org_unit_id: int) -> list[int]:
    """Return list of org_unit_ids from root down to the given unit (inclusive)."""
    # Recursive CTE to walk up the tree
    cte_query = text("""
        WITH RECURSIVE ancestors AS (
            SELECT id, parent_id, 0 AS depth
            FROM org_units
            WHERE id = :uid
            UNION ALL
            SELECT ou.id, ou.parent_id, a.depth + 1
            FROM org_units ou
            JOIN ancestors a ON ou.id = a.parent_id
        )
        SELECT id FROM ancestors ORDER BY depth DESC
    """)
    result = await s.execute(cte_query, {"uid": org_unit_id})
    return [row[0] for row in result.fetchall()]


async def _get_dict_name(s: AsyncSession, dict_id: int | None) -> str | None:
    if dict_id is None:
        return None
    entry = await s.get(DictionaryEntry, dict_id)
    return entry.label if entry else None


async def _get_unit_name(s: AsyncSession, uid: int) -> str | None:
    unit = await s.get(OrgUnit, uid)
    return unit.name if unit else None


# ═══════════════════ ORG UNIT CONTEXT FIELDS ═══════════════════

@router.get(
    PREFIX + "/general",
    response_model=OrgUnitContextOut,
    summary="Pobierz ogólne dane kontekstowe jednostki",
)
async def get_context_general(
    org_unit_id: int,
    s: AsyncSession = Depends(get_session),
):
    unit = await _get_org_unit(s, org_unit_id)
    return OrgUnitContextOut(
        id=unit.id,
        name=unit.name,
        headcount=getattr(unit, "headcount", None),
        context_review_date=getattr(unit, "context_review_date", None),
        context_next_review=getattr(unit, "context_next_review", None),
        context_reviewer=getattr(unit, "context_reviewer", None),
        context_status=getattr(unit, "context_status", None),
        mission_vision=getattr(unit, "mission_vision", None),
        key_products_services=getattr(unit, "key_products_services", None),
        strategic_objectives=getattr(unit, "strategic_objectives", None),
        key_processes_notes=getattr(unit, "key_processes_notes", None),
    )


@router.put(
    PREFIX + "/general",
    response_model=OrgUnitContextOut,
    summary="Aktualizuj ogólne dane kontekstowe jednostki",
)
async def update_context_general(
    org_unit_id: int,
    body: OrgUnitContextUpdate,
    s: AsyncSession = Depends(get_session),
):
    unit = await _get_org_unit(s, org_unit_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(unit, k, v)
    await s.commit()
    await s.refresh(unit)
    return OrgUnitContextOut(
        id=unit.id,
        name=unit.name,
        headcount=getattr(unit, "headcount", None),
        context_review_date=getattr(unit, "context_review_date", None),
        context_next_review=getattr(unit, "context_next_review", None),
        context_reviewer=getattr(unit, "context_reviewer", None),
        context_status=getattr(unit, "context_status", None),
        mission_vision=getattr(unit, "mission_vision", None),
        key_products_services=getattr(unit, "key_products_services", None),
        strategic_objectives=getattr(unit, "strategic_objectives", None),
        key_processes_notes=getattr(unit, "key_processes_notes", None),
    )


# ═══════════════════ OVERVIEW ═══════════════════

@router.get(
    PREFIX,
    response_model=OrgContextOverview,
    summary="Przegląd kontekstu organizacyjnego (podsumowanie wszystkich sekcji)",
)
async def get_context_overview(
    org_unit_id: int,
    s: AsyncSession = Depends(get_session),
):
    unit = await _get_org_unit(s, org_unit_id)
    chain = await _get_ancestor_chain(s, org_unit_id)

    # Issues
    q = select(func.count()).select_from(OrgContextIssue).where(
        OrgContextIssue.org_unit_id.in_(chain), OrgContextIssue.is_active.is_(True)
    )
    issues_total = (await s.execute(q)).scalar() or 0
    q_own = select(func.count()).select_from(OrgContextIssue).where(
        OrgContextIssue.org_unit_id == org_unit_id, OrgContextIssue.is_active.is_(True)
    )
    issues_own = (await s.execute(q_own)).scalar() or 0

    # Obligations
    q = select(func.count()).select_from(OrgContextObligation).where(
        OrgContextObligation.org_unit_id.in_(chain), OrgContextObligation.is_active.is_(True)
    )
    obligs_total = (await s.execute(q)).scalar() or 0
    q_own = select(func.count()).select_from(OrgContextObligation).where(
        OrgContextObligation.org_unit_id == org_unit_id, OrgContextObligation.is_active.is_(True)
    )
    obligs_own = (await s.execute(q_own)).scalar() or 0

    # Stakeholders
    q = select(func.count()).select_from(OrgContextStakeholder).where(
        OrgContextStakeholder.org_unit_id.in_(chain), OrgContextStakeholder.is_active.is_(True)
    )
    stkh_total = (await s.execute(q)).scalar() or 0
    q_own = select(func.count()).select_from(OrgContextStakeholder).where(
        OrgContextStakeholder.org_unit_id == org_unit_id, OrgContextStakeholder.is_active.is_(True)
    )
    stkh_own = (await s.execute(q_own)).scalar() or 0

    # Scope (overridable)
    has_scope = False
    scope_inherited = False
    for uid in reversed(chain):  # from self up to root
        q = select(func.count()).select_from(OrgContextScope).where(
            OrgContextScope.org_unit_id == uid, OrgContextScope.is_active.is_(True)
        )
        cnt = (await s.execute(q)).scalar() or 0
        if cnt > 0:
            has_scope = True
            scope_inherited = uid != org_unit_id
            break

    # Risk appetite (overridable)
    has_ra = False
    ra_inherited = False
    for uid in reversed(chain):
        q = select(func.count()).select_from(OrgContextRiskAppetite).where(
            OrgContextRiskAppetite.org_unit_id == uid, OrgContextRiskAppetite.is_active.is_(True)
        )
        cnt = (await s.execute(q)).scalar() or 0
        if cnt > 0:
            has_ra = True
            ra_inherited = uid != org_unit_id
            break

    # Reviews (local)
    q_rev = select(func.count()).select_from(OrgContextReview).where(
        OrgContextReview.org_unit_id == org_unit_id, OrgContextReview.is_active.is_(True)
    )
    reviews_count = (await s.execute(q_rev)).scalar() or 0

    # Snapshots (local)
    q_snap = select(func.count()).select_from(OrgContextSnapshot).where(
        OrgContextSnapshot.org_unit_id == org_unit_id
    )
    snapshots_count = (await s.execute(q_snap)).scalar() or 0

    # Last/next review
    q_last = select(OrgContextReview.review_date).where(
        OrgContextReview.org_unit_id == org_unit_id, OrgContextReview.is_active.is_(True)
    ).order_by(OrgContextReview.review_date.desc()).limit(1)
    last_review = (await s.execute(q_last)).scalar()

    q_next = select(OrgContextReview.next_review_date).where(
        OrgContextReview.org_unit_id == org_unit_id, OrgContextReview.is_active.is_(True)
    ).order_by(OrgContextReview.review_date.desc()).limit(1)
    next_review = (await s.execute(q_next)).scalar()

    return OrgContextOverview(
        org_unit_id=org_unit_id,
        org_unit_name=unit.name,
        context_status=getattr(unit, "context_status", None),
        issues_count=issues_total,
        issues_own=issues_own,
        issues_inherited=issues_total - issues_own,
        obligations_count=obligs_total,
        obligations_own=obligs_own,
        obligations_inherited=obligs_total - obligs_own,
        stakeholders_count=stkh_total,
        stakeholders_own=stkh_own,
        stakeholders_inherited=stkh_total - stkh_own,
        has_scope=has_scope,
        scope_inherited=scope_inherited,
        has_risk_appetite=has_ra,
        risk_appetite_inherited=ra_inherited,
        reviews_count=reviews_count,
        snapshots_count=snapshots_count,
        last_review_date=last_review,
        next_review_date=next_review,
    )


# ═══════════════════ ISSUES (additive inheritance) ═══════════════════

@router.get(
    PREFIX + "/issues",
    response_model=list[OrgContextIssueOut],
    summary="Lista czynników kontekstowych (z dziedziczeniem)",
    description="Zwraca czynniki zdefiniowane dla tej jednostki + odziedziczone z jednostek nadrzędnych.",
)
async def list_issues(
    org_unit_id: int,
    issue_type: str | None = Query(None, description="internal / external"),
    include_inherited: bool = Query(True, description="Uwzględnij odziedziczone z nadrzędnych"),
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)

    if include_inherited:
        chain = await _get_ancestor_chain(s, org_unit_id)
    else:
        chain = [org_unit_id]

    q = (
        select(OrgContextIssue, OrgUnit.name.label("unit_name"))
        .join(OrgUnit, OrgContextIssue.org_unit_id == OrgUnit.id)
        .where(OrgContextIssue.org_unit_id.in_(chain), OrgContextIssue.is_active.is_(True))
    )
    if issue_type:
        q = q.where(OrgContextIssue.issue_type == issue_type)
    q = q.order_by(OrgContextIssue.issue_type, OrgContextIssue.title)
    rows = (await s.execute(q)).all()

    result = []
    for issue, unit_name in rows:
        cat_name = await _get_dict_name(s, issue.category_id)
        result.append(OrgContextIssueOut(
            id=issue.id,
            org_unit_id=issue.org_unit_id,
            org_unit_name=unit_name,
            issue_type=issue.issue_type,
            category_id=issue.category_id,
            category_name=cat_name,
            title=issue.title,
            description=issue.description,
            impact_level=issue.impact_level,
            relevance=issue.relevance,
            response_action=issue.response_action,
            review_date=issue.review_date,
            is_active=issue.is_active,
            inherited=issue.org_unit_id != org_unit_id,
            created_at=issue.created_at,
            updated_at=issue.updated_at,
        ))
    return result


@router.post(
    PREFIX + "/issues",
    response_model=OrgContextIssueOut,
    status_code=201,
    summary="Dodaj czynnik kontekstowy",
)
async def create_issue(
    org_unit_id: int,
    body: OrgContextIssueCreate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    issue = OrgContextIssue(org_unit_id=org_unit_id, **body.model_dump())
    s.add(issue)
    await s.commit()
    await s.refresh(issue)
    unit_name = await _get_unit_name(s, org_unit_id)
    cat_name = await _get_dict_name(s, issue.category_id)
    return OrgContextIssueOut(
        id=issue.id,
        org_unit_id=issue.org_unit_id,
        org_unit_name=unit_name,
        issue_type=issue.issue_type,
        category_id=issue.category_id,
        category_name=cat_name,
        title=issue.title,
        description=issue.description,
        impact_level=issue.impact_level,
        relevance=issue.relevance,
        response_action=issue.response_action,
        review_date=issue.review_date,
        is_active=issue.is_active,
        inherited=False,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
    )


@router.get(
    PREFIX + "/issues/{issue_id}",
    response_model=OrgContextIssueOut,
    summary="Pobierz czynnik kontekstowy",
)
async def get_issue(
    org_unit_id: int,
    issue_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    issue = await s.get(OrgContextIssue, issue_id)
    if not issue:
        raise HTTPException(404, "Czynnik nie istnieje")
    unit_name = await _get_unit_name(s, issue.org_unit_id)
    cat_name = await _get_dict_name(s, issue.category_id)
    return OrgContextIssueOut(
        id=issue.id,
        org_unit_id=issue.org_unit_id,
        org_unit_name=unit_name,
        issue_type=issue.issue_type,
        category_id=issue.category_id,
        category_name=cat_name,
        title=issue.title,
        description=issue.description,
        impact_level=issue.impact_level,
        relevance=issue.relevance,
        response_action=issue.response_action,
        review_date=issue.review_date,
        is_active=issue.is_active,
        inherited=issue.org_unit_id != org_unit_id,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
    )


@router.put(
    PREFIX + "/issues/{issue_id}",
    response_model=OrgContextIssueOut,
    summary="Edytuj czynnik kontekstowy",
)
async def update_issue(
    org_unit_id: int,
    issue_id: int,
    body: OrgContextIssueUpdate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    issue = await s.get(OrgContextIssue, issue_id)
    if not issue:
        raise HTTPException(404, "Czynnik nie istnieje")
    if issue.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można edytować odziedziczonego czynnika — edytuj w jednostce źródłowej")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(issue, k, v)
    await s.commit()
    await s.refresh(issue)
    unit_name = await _get_unit_name(s, org_unit_id)
    cat_name = await _get_dict_name(s, issue.category_id)
    return OrgContextIssueOut(
        id=issue.id,
        org_unit_id=issue.org_unit_id,
        org_unit_name=unit_name,
        issue_type=issue.issue_type,
        category_id=issue.category_id,
        category_name=cat_name,
        title=issue.title,
        description=issue.description,
        impact_level=issue.impact_level,
        relevance=issue.relevance,
        response_action=issue.response_action,
        review_date=issue.review_date,
        is_active=issue.is_active,
        inherited=False,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
    )


@router.delete(
    PREFIX + "/issues/{issue_id}",
    summary="Dezaktywuj czynnik kontekstowy (soft delete)",
)
async def deactivate_issue(
    org_unit_id: int,
    issue_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    issue = await s.get(OrgContextIssue, issue_id)
    if not issue:
        raise HTTPException(404, "Czynnik nie istnieje")
    if issue.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można dezaktywować odziedziczonego czynnika")
    issue.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": issue_id}


# ═══════════════════ OBLIGATIONS (additive inheritance) ═══════════════════

@router.get(
    PREFIX + "/obligations",
    response_model=list[OrgContextObligationOut],
    summary="Lista zobowiązań (z dziedziczeniem)",
)
async def list_obligations(
    org_unit_id: int,
    obligation_type: str | None = Query(None),
    include_inherited: bool = Query(True),
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    chain = await _get_ancestor_chain(s, org_unit_id) if include_inherited else [org_unit_id]

    q = (
        select(OrgContextObligation, OrgUnit.name.label("unit_name"))
        .join(OrgUnit, OrgContextObligation.org_unit_id == OrgUnit.id)
        .where(OrgContextObligation.org_unit_id.in_(chain), OrgContextObligation.is_active.is_(True))
    )
    if obligation_type:
        q = q.where(OrgContextObligation.obligation_type == obligation_type)
    q = q.order_by(OrgContextObligation.obligation_type, OrgContextObligation.custom_name)
    rows = (await s.execute(q)).all()

    result = []
    for obl, unit_name in rows:
        reg_name = await _get_dict_name(s, obl.regulation_id)
        result.append(OrgContextObligationOut(
            id=obl.id,
            org_unit_id=obl.org_unit_id,
            org_unit_name=unit_name,
            obligation_type=obl.obligation_type,
            regulation_id=obl.regulation_id,
            regulation_name=reg_name,
            custom_name=obl.custom_name,
            description=obl.description,
            responsible_person=obl.responsible_person,
            compliance_status=obl.compliance_status,
            compliance_evidence=obl.compliance_evidence,
            effective_from=obl.effective_from,
            review_date=obl.review_date,
            notes=obl.notes,
            is_active=obl.is_active,
            inherited=obl.org_unit_id != org_unit_id,
            created_at=obl.created_at,
            updated_at=obl.updated_at,
        ))
    return result


@router.post(
    PREFIX + "/obligations",
    response_model=OrgContextObligationOut,
    status_code=201,
    summary="Dodaj zobowiązanie",
)
async def create_obligation(
    org_unit_id: int,
    body: OrgContextObligationCreate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    obl = OrgContextObligation(org_unit_id=org_unit_id, **body.model_dump())
    s.add(obl)
    await s.commit()
    await s.refresh(obl)
    unit_name = await _get_unit_name(s, org_unit_id)
    reg_name = await _get_dict_name(s, obl.regulation_id)
    return OrgContextObligationOut(
        id=obl.id, org_unit_id=obl.org_unit_id, org_unit_name=unit_name,
        obligation_type=obl.obligation_type, regulation_id=obl.regulation_id,
        regulation_name=reg_name, custom_name=obl.custom_name,
        description=obl.description, responsible_person=obl.responsible_person,
        compliance_status=obl.compliance_status, compliance_evidence=obl.compliance_evidence,
        effective_from=obl.effective_from, review_date=obl.review_date, notes=obl.notes,
        is_active=obl.is_active, inherited=False, created_at=obl.created_at, updated_at=obl.updated_at,
    )


@router.get(
    PREFIX + "/obligations/{obligation_id}",
    response_model=OrgContextObligationOut,
    summary="Pobierz zobowiązanie",
)
async def get_obligation(
    org_unit_id: int,
    obligation_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    obl = await s.get(OrgContextObligation, obligation_id)
    if not obl:
        raise HTTPException(404, "Zobowiązanie nie istnieje")
    unit_name = await _get_unit_name(s, obl.org_unit_id)
    reg_name = await _get_dict_name(s, obl.regulation_id)
    return OrgContextObligationOut(
        id=obl.id, org_unit_id=obl.org_unit_id, org_unit_name=unit_name,
        obligation_type=obl.obligation_type, regulation_id=obl.regulation_id,
        regulation_name=reg_name, custom_name=obl.custom_name,
        description=obl.description, responsible_person=obl.responsible_person,
        compliance_status=obl.compliance_status, compliance_evidence=obl.compliance_evidence,
        effective_from=obl.effective_from, review_date=obl.review_date, notes=obl.notes,
        is_active=obl.is_active, inherited=obl.org_unit_id != org_unit_id,
        created_at=obl.created_at, updated_at=obl.updated_at,
    )


@router.put(
    PREFIX + "/obligations/{obligation_id}",
    response_model=OrgContextObligationOut,
    summary="Edytuj zobowiązanie",
)
async def update_obligation(
    org_unit_id: int,
    obligation_id: int,
    body: OrgContextObligationUpdate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    obl = await s.get(OrgContextObligation, obligation_id)
    if not obl:
        raise HTTPException(404, "Zobowiązanie nie istnieje")
    if obl.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można edytować odziedziczonego zobowiązania")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obl, k, v)
    await s.commit()
    await s.refresh(obl)
    unit_name = await _get_unit_name(s, org_unit_id)
    reg_name = await _get_dict_name(s, obl.regulation_id)
    return OrgContextObligationOut(
        id=obl.id, org_unit_id=obl.org_unit_id, org_unit_name=unit_name,
        obligation_type=obl.obligation_type, regulation_id=obl.regulation_id,
        regulation_name=reg_name, custom_name=obl.custom_name,
        description=obl.description, responsible_person=obl.responsible_person,
        compliance_status=obl.compliance_status, compliance_evidence=obl.compliance_evidence,
        effective_from=obl.effective_from, review_date=obl.review_date, notes=obl.notes,
        is_active=obl.is_active, inherited=False, created_at=obl.created_at, updated_at=obl.updated_at,
    )


@router.delete(
    PREFIX + "/obligations/{obligation_id}",
    summary="Dezaktywuj zobowiązanie (soft delete)",
)
async def deactivate_obligation(
    org_unit_id: int,
    obligation_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    obl = await s.get(OrgContextObligation, obligation_id)
    if not obl:
        raise HTTPException(404, "Zobowiązanie nie istnieje")
    if obl.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można dezaktywować odziedziczonego zobowiązania")
    obl.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": obligation_id}


# ═══════════════════ STAKEHOLDERS (additive inheritance) ═══════════════════

@router.get(
    PREFIX + "/stakeholders",
    response_model=list[OrgContextStakeholderOut],
    summary="Lista interesariuszy (z dziedziczeniem)",
)
async def list_stakeholders(
    org_unit_id: int,
    stakeholder_type: str | None = Query(None, description="internal / external"),
    include_inherited: bool = Query(True),
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    chain = await _get_ancestor_chain(s, org_unit_id) if include_inherited else [org_unit_id]

    q = (
        select(OrgContextStakeholder, OrgUnit.name.label("unit_name"))
        .join(OrgUnit, OrgContextStakeholder.org_unit_id == OrgUnit.id)
        .where(OrgContextStakeholder.org_unit_id.in_(chain), OrgContextStakeholder.is_active.is_(True))
    )
    if stakeholder_type:
        q = q.where(OrgContextStakeholder.stakeholder_type == stakeholder_type)
    q = q.order_by(OrgContextStakeholder.stakeholder_type, OrgContextStakeholder.name)
    rows = (await s.execute(q)).all()

    result = []
    for stkh, unit_name in rows:
        cat_name = await _get_dict_name(s, stkh.category_id)
        result.append(OrgContextStakeholderOut(
            id=stkh.id, org_unit_id=stkh.org_unit_id, org_unit_name=unit_name,
            stakeholder_type=stkh.stakeholder_type, category_id=stkh.category_id,
            category_name=cat_name, name=stkh.name, description=stkh.description,
            needs_expectations=stkh.needs_expectations, requirements_type=stkh.requirements_type,
            requirements_detail=stkh.requirements_detail,
            communication_channel=stkh.communication_channel,
            influence_level=stkh.influence_level, relevance=stkh.relevance,
            is_active=stkh.is_active, inherited=stkh.org_unit_id != org_unit_id,
            created_at=stkh.created_at, updated_at=stkh.updated_at,
        ))
    return result


@router.post(
    PREFIX + "/stakeholders",
    response_model=OrgContextStakeholderOut,
    status_code=201,
    summary="Dodaj interesariusza",
)
async def create_stakeholder(
    org_unit_id: int,
    body: OrgContextStakeholderCreate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    stkh = OrgContextStakeholder(org_unit_id=org_unit_id, **body.model_dump())
    s.add(stkh)
    await s.commit()
    await s.refresh(stkh)
    unit_name = await _get_unit_name(s, org_unit_id)
    cat_name = await _get_dict_name(s, stkh.category_id)
    return OrgContextStakeholderOut(
        id=stkh.id, org_unit_id=stkh.org_unit_id, org_unit_name=unit_name,
        stakeholder_type=stkh.stakeholder_type, category_id=stkh.category_id,
        category_name=cat_name, name=stkh.name, description=stkh.description,
        needs_expectations=stkh.needs_expectations, requirements_type=stkh.requirements_type,
        requirements_detail=stkh.requirements_detail,
        communication_channel=stkh.communication_channel,
        influence_level=stkh.influence_level, relevance=stkh.relevance,
        is_active=stkh.is_active, inherited=False,
        created_at=stkh.created_at, updated_at=stkh.updated_at,
    )


@router.get(
    PREFIX + "/stakeholders/{stakeholder_id}",
    response_model=OrgContextStakeholderOut,
    summary="Pobierz interesariusza",
)
async def get_stakeholder(
    org_unit_id: int,
    stakeholder_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    stkh = await s.get(OrgContextStakeholder, stakeholder_id)
    if not stkh:
        raise HTTPException(404, "Interesariusz nie istnieje")
    unit_name = await _get_unit_name(s, stkh.org_unit_id)
    cat_name = await _get_dict_name(s, stkh.category_id)
    return OrgContextStakeholderOut(
        id=stkh.id, org_unit_id=stkh.org_unit_id, org_unit_name=unit_name,
        stakeholder_type=stkh.stakeholder_type, category_id=stkh.category_id,
        category_name=cat_name, name=stkh.name, description=stkh.description,
        needs_expectations=stkh.needs_expectations, requirements_type=stkh.requirements_type,
        requirements_detail=stkh.requirements_detail,
        communication_channel=stkh.communication_channel,
        influence_level=stkh.influence_level, relevance=stkh.relevance,
        is_active=stkh.is_active, inherited=stkh.org_unit_id != org_unit_id,
        created_at=stkh.created_at, updated_at=stkh.updated_at,
    )


@router.put(
    PREFIX + "/stakeholders/{stakeholder_id}",
    response_model=OrgContextStakeholderOut,
    summary="Edytuj interesariusza",
)
async def update_stakeholder(
    org_unit_id: int,
    stakeholder_id: int,
    body: OrgContextStakeholderUpdate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    stkh = await s.get(OrgContextStakeholder, stakeholder_id)
    if not stkh:
        raise HTTPException(404, "Interesariusz nie istnieje")
    if stkh.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można edytować odziedziczonego interesariusza")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(stkh, k, v)
    await s.commit()
    await s.refresh(stkh)
    unit_name = await _get_unit_name(s, org_unit_id)
    cat_name = await _get_dict_name(s, stkh.category_id)
    return OrgContextStakeholderOut(
        id=stkh.id, org_unit_id=stkh.org_unit_id, org_unit_name=unit_name,
        stakeholder_type=stkh.stakeholder_type, category_id=stkh.category_id,
        category_name=cat_name, name=stkh.name, description=stkh.description,
        needs_expectations=stkh.needs_expectations, requirements_type=stkh.requirements_type,
        requirements_detail=stkh.requirements_detail,
        communication_channel=stkh.communication_channel,
        influence_level=stkh.influence_level, relevance=stkh.relevance,
        is_active=stkh.is_active, inherited=False,
        created_at=stkh.created_at, updated_at=stkh.updated_at,
    )


@router.delete(
    PREFIX + "/stakeholders/{stakeholder_id}",
    summary="Dezaktywuj interesariusza (soft delete)",
)
async def deactivate_stakeholder(
    org_unit_id: int,
    stakeholder_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    stkh = await s.get(OrgContextStakeholder, stakeholder_id)
    if not stkh:
        raise HTTPException(404, "Interesariusz nie istnieje")
    if stkh.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można dezaktywować odziedziczonego interesariusza")
    stkh.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": stakeholder_id}


# ═══════════════════ SCOPE (overridable inheritance) ═══════════════════

async def _get_effective_scope(
    s: AsyncSession, org_unit_id: int
) -> tuple[OrgContextScope | None, bool]:
    """Return (scope, inherited) — own scope or closest ancestor's."""
    chain = await _get_ancestor_chain(s, org_unit_id)
    for uid in reversed(chain):  # self first, then up
        q = select(OrgContextScope).where(
            OrgContextScope.org_unit_id == uid, OrgContextScope.is_active.is_(True)
        ).order_by(OrgContextScope.version.desc()).limit(1)
        scope = (await s.execute(q)).scalar_one_or_none()
        if scope:
            return scope, uid != org_unit_id
    return None, False


@router.get(
    PREFIX + "/scope",
    response_model=list[OrgContextScopeOut],
    summary="Pobierz zakresy SZ (z dziedziczeniem)",
    description="Zwraca listę zakresów — własne + odziedziczone z nadrzędnych jednostek.",
)
async def get_scope(
    org_unit_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    # Collect all active scopes from self + ancestors
    chain = await _get_ancestor_chain(s, org_unit_id)
    result: list[OrgContextScopeOut] = []
    seen_ms_ids: set[int | None] = set()
    for uid in reversed(chain):  # self first, then up
        q = select(OrgContextScope).where(
            OrgContextScope.org_unit_id == uid, OrgContextScope.is_active.is_(True)
        ).order_by(OrgContextScope.version.desc())
        scopes = (await s.execute(q)).scalars().all()
        inherited = uid != org_unit_id
        for scope in scopes:
            if scope.management_system_id in seen_ms_ids:
                continue  # own scope overrides inherited for same MS
            seen_ms_ids.add(scope.management_system_id)
            unit_name = await _get_unit_name(s, scope.org_unit_id)
            ms_name = await _get_dict_name(s, scope.management_system_id)
            result.append(OrgContextScopeOut(
                id=scope.id, org_unit_id=scope.org_unit_id, org_unit_name=unit_name,
                management_system_id=scope.management_system_id, management_system_name=ms_name,
                scope_statement=scope.scope_statement,
                in_scope_description=scope.in_scope_description,
                out_of_scope_description=scope.out_of_scope_description,
                geographic_boundaries=scope.geographic_boundaries,
                technology_boundaries=scope.technology_boundaries,
                organizational_boundaries=scope.organizational_boundaries,
                interfaces_dependencies=scope.interfaces_dependencies,
                approved_by=scope.approved_by, approved_date=scope.approved_date,
                version=scope.version, is_active=scope.is_active, inherited=inherited,
                created_at=scope.created_at, updated_at=scope.updated_at,
            ))
    return result


@router.post(
    PREFIX + "/scope",
    response_model=OrgContextScopeOut,
    status_code=201,
    summary="Utwórz/nadpisz zakres SZ dla tej jednostki",
)
async def create_scope(
    org_unit_id: int,
    body: OrgContextScopeCreate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    # Validate management_system_id exists in dictionary
    if body.management_system_id is not None:
        entry = await s.get(DictionaryEntry, body.management_system_id)
        if entry is None:
            raise HTTPException(400, detail=f"Wpis słownika #{body.management_system_id} nie istnieje")
    # Check if own scope exists for same management_system_id — bump version
    q = select(OrgContextScope).where(
        OrgContextScope.org_unit_id == org_unit_id,
        OrgContextScope.is_active.is_(True),
        OrgContextScope.management_system_id == body.management_system_id,
    ).order_by(OrgContextScope.version.desc()).limit(1)
    existing = (await s.execute(q)).scalar_one_or_none()
    new_version = (existing.version + 1) if existing else 1

    scope = OrgContextScope(org_unit_id=org_unit_id, version=new_version, **body.model_dump())
    s.add(scope)
    # Deactivate previous version for same MS
    if existing:
        existing.is_active = False
    await s.commit()
    await s.refresh(scope)
    unit_name = await _get_unit_name(s, org_unit_id)
    ms_name = await _get_dict_name(s, scope.management_system_id)
    return OrgContextScopeOut(
        id=scope.id, org_unit_id=scope.org_unit_id, org_unit_name=unit_name,
        management_system_id=scope.management_system_id, management_system_name=ms_name,
        scope_statement=scope.scope_statement,
        in_scope_description=scope.in_scope_description,
        out_of_scope_description=scope.out_of_scope_description,
        geographic_boundaries=scope.geographic_boundaries,
        technology_boundaries=scope.technology_boundaries,
        organizational_boundaries=scope.organizational_boundaries,
        interfaces_dependencies=scope.interfaces_dependencies,
        approved_by=scope.approved_by, approved_date=scope.approved_date,
        version=scope.version, is_active=scope.is_active, inherited=False,
        created_at=scope.created_at, updated_at=scope.updated_at,
    )


@router.put(
    PREFIX + "/scope/{scope_id}",
    response_model=OrgContextScopeOut,
    summary="Edytuj zakres SZBI",
)
async def update_scope(
    org_unit_id: int,
    scope_id: int,
    body: OrgContextScopeUpdate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    scope = await s.get(OrgContextScope, scope_id)
    if not scope:
        raise HTTPException(404, "Zakres nie istnieje")
    if scope.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można edytować odziedziczonego zakresu")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(scope, k, v)
    await s.commit()
    await s.refresh(scope)
    unit_name = await _get_unit_name(s, org_unit_id)
    ms_name = await _get_dict_name(s, scope.management_system_id)
    return OrgContextScopeOut(
        id=scope.id, org_unit_id=scope.org_unit_id, org_unit_name=unit_name,
        management_system_id=scope.management_system_id, management_system_name=ms_name,
        scope_statement=scope.scope_statement,
        in_scope_description=scope.in_scope_description,
        out_of_scope_description=scope.out_of_scope_description,
        geographic_boundaries=scope.geographic_boundaries,
        technology_boundaries=scope.technology_boundaries,
        organizational_boundaries=scope.organizational_boundaries,
        interfaces_dependencies=scope.interfaces_dependencies,
        approved_by=scope.approved_by, approved_date=scope.approved_date,
        version=scope.version, is_active=scope.is_active, inherited=False,
        created_at=scope.created_at, updated_at=scope.updated_at,
    )


@router.delete(
    PREFIX + "/scope/{scope_id}",
    summary="Dezaktywuj zakres SZBI (soft delete — powrót do odziedziczonego)",
)
async def deactivate_scope(
    org_unit_id: int,
    scope_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    scope = await s.get(OrgContextScope, scope_id)
    if not scope:
        raise HTTPException(404, "Zakres nie istnieje")
    if scope.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można dezaktywować odziedziczonego zakresu")
    scope.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": scope_id}


# ═══════════════════ RISK APPETITE (overridable inheritance) ═══════════════════

async def _get_effective_risk_appetite(
    s: AsyncSession, org_unit_id: int
) -> tuple[OrgContextRiskAppetite | None, bool]:
    chain = await _get_ancestor_chain(s, org_unit_id)
    for uid in reversed(chain):
        q = select(OrgContextRiskAppetite).where(
            OrgContextRiskAppetite.org_unit_id == uid,
            OrgContextRiskAppetite.is_active.is_(True),
        )
        ra = (await s.execute(q)).scalar_one_or_none()
        if ra:
            return ra, uid != org_unit_id
    return None, False


@router.get(
    PREFIX + "/risk-appetite",
    response_model=OrgContextRiskAppetiteOut | None,
    summary="Pobierz apetyt na ryzyko (z dziedziczeniem)",
)
async def get_risk_appetite(
    org_unit_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    ra, inherited = await _get_effective_risk_appetite(s, org_unit_id)
    if not ra:
        return None
    unit_name = await _get_unit_name(s, ra.org_unit_id)
    return OrgContextRiskAppetiteOut(
        id=ra.id, org_unit_id=ra.org_unit_id, org_unit_name=unit_name,
        risk_appetite_statement=ra.risk_appetite_statement,
        max_acceptable_risk_level=ra.max_acceptable_risk_level,
        max_acceptable_risk_score=ra.max_acceptable_risk_score,
        exception_approval_authority=ra.exception_approval_authority,
        financial_risk_tolerance=ra.financial_risk_tolerance,
        reputational_risk_tolerance=ra.reputational_risk_tolerance,
        operational_risk_tolerance=ra.operational_risk_tolerance,
        approved_by=ra.approved_by, approved_date=ra.approved_date,
        is_active=ra.is_active, inherited=inherited,
        created_at=ra.created_at, updated_at=ra.updated_at,
    )


@router.post(
    PREFIX + "/risk-appetite",
    response_model=OrgContextRiskAppetiteOut,
    status_code=201,
    summary="Utwórz/nadpisz apetyt na ryzyko",
)
async def create_risk_appetite(
    org_unit_id: int,
    body: OrgContextRiskAppetiteCreate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    # Deactivate existing if any
    q = select(OrgContextRiskAppetite).where(
        OrgContextRiskAppetite.org_unit_id == org_unit_id,
        OrgContextRiskAppetite.is_active.is_(True),
    )
    existing = (await s.execute(q)).scalar_one_or_none()
    if existing:
        existing.is_active = False

    ra = OrgContextRiskAppetite(org_unit_id=org_unit_id, **body.model_dump())
    s.add(ra)
    await s.commit()
    await s.refresh(ra)
    unit_name = await _get_unit_name(s, org_unit_id)
    return OrgContextRiskAppetiteOut(
        id=ra.id, org_unit_id=ra.org_unit_id, org_unit_name=unit_name,
        risk_appetite_statement=ra.risk_appetite_statement,
        max_acceptable_risk_level=ra.max_acceptable_risk_level,
        max_acceptable_risk_score=ra.max_acceptable_risk_score,
        exception_approval_authority=ra.exception_approval_authority,
        financial_risk_tolerance=ra.financial_risk_tolerance,
        reputational_risk_tolerance=ra.reputational_risk_tolerance,
        operational_risk_tolerance=ra.operational_risk_tolerance,
        approved_by=ra.approved_by, approved_date=ra.approved_date,
        is_active=ra.is_active, inherited=False,
        created_at=ra.created_at, updated_at=ra.updated_at,
    )


@router.put(
    PREFIX + "/risk-appetite/{ra_id}",
    response_model=OrgContextRiskAppetiteOut,
    summary="Edytuj apetyt na ryzyko",
)
async def update_risk_appetite(
    org_unit_id: int,
    ra_id: int,
    body: OrgContextRiskAppetiteUpdate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    ra = await s.get(OrgContextRiskAppetite, ra_id)
    if not ra:
        raise HTTPException(404, "Apetyt na ryzyko nie istnieje")
    if ra.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można edytować odziedziczonego apetytu na ryzyko")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ra, k, v)
    await s.commit()
    await s.refresh(ra)
    unit_name = await _get_unit_name(s, org_unit_id)
    return OrgContextRiskAppetiteOut(
        id=ra.id, org_unit_id=ra.org_unit_id, org_unit_name=unit_name,
        risk_appetite_statement=ra.risk_appetite_statement,
        max_acceptable_risk_level=ra.max_acceptable_risk_level,
        max_acceptable_risk_score=ra.max_acceptable_risk_score,
        exception_approval_authority=ra.exception_approval_authority,
        financial_risk_tolerance=ra.financial_risk_tolerance,
        reputational_risk_tolerance=ra.reputational_risk_tolerance,
        operational_risk_tolerance=ra.operational_risk_tolerance,
        approved_by=ra.approved_by, approved_date=ra.approved_date,
        is_active=ra.is_active, inherited=False,
        created_at=ra.created_at, updated_at=ra.updated_at,
    )


@router.delete(
    PREFIX + "/risk-appetite/{ra_id}",
    summary="Dezaktywuj apetyt na ryzyko (soft delete)",
)
async def deactivate_risk_appetite(
    org_unit_id: int,
    ra_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    ra = await s.get(OrgContextRiskAppetite, ra_id)
    if not ra:
        raise HTTPException(404, "Apetyt na ryzyko nie istnieje")
    if ra.org_unit_id != org_unit_id:
        raise HTTPException(403, "Nie można dezaktywować odziedziczonego apetytu na ryzyko")
    ra.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": ra_id}


# ═══════════════════ REVIEWS (local — no inheritance) ═══════════════════

@router.get(
    PREFIX + "/reviews",
    response_model=list[OrgContextReviewOut],
    summary="Lista przeglądów kontekstu",
)
async def list_reviews(
    org_unit_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    q = (
        select(OrgContextReview, OrgUnit.name.label("unit_name"))
        .join(OrgUnit, OrgContextReview.org_unit_id == OrgUnit.id)
        .where(OrgContextReview.org_unit_id == org_unit_id, OrgContextReview.is_active.is_(True))
        .order_by(OrgContextReview.review_date.desc())
    )
    rows = (await s.execute(q)).all()
    return [
        OrgContextReviewOut(
            id=r.id, org_unit_id=r.org_unit_id, org_unit_name=un,
            review_date=r.review_date, reviewer=r.reviewer, review_type=r.review_type,
            sections_reviewed=r.sections_reviewed, changes_summary=r.changes_summary,
            approved_by=r.approved_by, approved_date=r.approved_date,
            next_review_date=r.next_review_date, is_active=r.is_active, created_at=r.created_at,
        )
        for r, un in rows
    ]


@router.post(
    PREFIX + "/reviews",
    response_model=OrgContextReviewOut,
    status_code=201,
    summary="Dodaj przegląd kontekstu",
)
async def create_review(
    org_unit_id: int,
    body: OrgContextReviewCreate,
    s: AsyncSession = Depends(get_session),
):
    unit = await _get_org_unit(s, org_unit_id)
    review = OrgContextReview(org_unit_id=org_unit_id, **body.model_dump())
    s.add(review)
    # Update context review dates on org_unit
    if hasattr(unit, "context_review_date"):
        unit.context_review_date = body.review_date
    if hasattr(unit, "context_next_review") and body.next_review_date:
        unit.context_next_review = body.next_review_date
    if hasattr(unit, "context_reviewer"):
        unit.context_reviewer = body.reviewer
    await s.commit()
    await s.refresh(review)
    return OrgContextReviewOut(
        id=review.id, org_unit_id=review.org_unit_id, org_unit_name=unit.name,
        review_date=review.review_date, reviewer=review.reviewer,
        review_type=review.review_type, sections_reviewed=review.sections_reviewed,
        changes_summary=review.changes_summary, approved_by=review.approved_by,
        approved_date=review.approved_date, next_review_date=review.next_review_date,
        is_active=review.is_active, created_at=review.created_at,
    )


@router.put(
    PREFIX + "/reviews/{review_id}",
    response_model=OrgContextReviewOut,
    summary="Edytuj przegląd kontekstu",
)
async def update_review(
    org_unit_id: int,
    review_id: int,
    body: OrgContextReviewUpdate,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    review = await s.get(OrgContextReview, review_id)
    if not review:
        raise HTTPException(404, "Przegląd nie istnieje")
    if review.org_unit_id != org_unit_id:
        raise HTTPException(403, "Przegląd należy do innej jednostki")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(review, k, v)
    await s.commit()
    await s.refresh(review)
    unit_name = await _get_unit_name(s, org_unit_id)
    return OrgContextReviewOut(
        id=review.id, org_unit_id=review.org_unit_id, org_unit_name=unit_name,
        review_date=review.review_date, reviewer=review.reviewer,
        review_type=review.review_type, sections_reviewed=review.sections_reviewed,
        changes_summary=review.changes_summary, approved_by=review.approved_by,
        approved_date=review.approved_date, next_review_date=review.next_review_date,
        is_active=review.is_active, created_at=review.created_at,
    )


@router.delete(
    PREFIX + "/reviews/{review_id}",
    summary="Dezaktywuj przegląd (soft delete)",
)
async def deactivate_review(
    org_unit_id: int,
    review_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    review = await s.get(OrgContextReview, review_id)
    if not review:
        raise HTTPException(404, "Przegląd nie istnieje")
    if review.org_unit_id != org_unit_id:
        raise HTTPException(403, "Przegląd należy do innej jednostki")
    review.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": review_id}


# ═══════════════════ SNAPSHOTS (local) ═══════════════════

@router.get(
    PREFIX + "/snapshots",
    response_model=list[OrgContextSnapshotOut],
    summary="Lista snapshotów kontekstu",
)
async def list_snapshots(
    org_unit_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    q = (
        select(OrgContextSnapshot, OrgUnit.name.label("unit_name"))
        .join(OrgUnit, OrgContextSnapshot.org_unit_id == OrgUnit.id)
        .where(OrgContextSnapshot.org_unit_id == org_unit_id)
        .order_by(OrgContextSnapshot.snapshot_date.desc())
    )
    rows = (await s.execute(q)).all()
    return [
        OrgContextSnapshotOut(
            id=snap.id, org_unit_id=snap.org_unit_id, org_unit_name=un,
            review_id=snap.review_id, snapshot_date=snap.snapshot_date,
            snapshot_data=snap.snapshot_data, created_at=snap.created_at,
        )
        for snap, un in rows
    ]


@router.post(
    PREFIX + "/snapshots",
    response_model=OrgContextSnapshotOut,
    status_code=201,
    summary="Utwórz snapshot kontekstu (zrzut aktualnych danych)",
)
async def create_snapshot(
    org_unit_id: int,
    body: OrgContextSnapshotCreate,
    s: AsyncSession = Depends(get_session),
):
    unit = await _get_org_unit(s, org_unit_id)
    chain = await _get_ancestor_chain(s, org_unit_id)

    # Collect current state
    issues_q = select(OrgContextIssue).where(
        OrgContextIssue.org_unit_id.in_(chain), OrgContextIssue.is_active.is_(True)
    )
    issues = (await s.execute(issues_q)).scalars().all()

    obligs_q = select(OrgContextObligation).where(
        OrgContextObligation.org_unit_id.in_(chain), OrgContextObligation.is_active.is_(True)
    )
    obligs = (await s.execute(obligs_q)).scalars().all()

    stkh_q = select(OrgContextStakeholder).where(
        OrgContextStakeholder.org_unit_id.in_(chain), OrgContextStakeholder.is_active.is_(True)
    )
    stkhs = (await s.execute(stkh_q)).scalars().all()

    scope, _ = await _get_effective_scope(s, org_unit_id)
    ra, _ = await _get_effective_risk_appetite(s, org_unit_id)

    snapshot_data = {
        "org_unit": {"id": unit.id, "name": unit.name},
        "issues": [
            {"id": i.id, "type": i.issue_type, "title": i.title,
             "impact_level": i.impact_level, "relevance": i.relevance,
             "org_unit_id": i.org_unit_id}
            for i in issues
        ],
        "obligations": [
            {"id": o.id, "type": o.obligation_type, "custom_name": o.custom_name,
             "compliance_status": o.compliance_status, "org_unit_id": o.org_unit_id}
            for o in obligs
        ],
        "stakeholders": [
            {"id": st.id, "type": st.stakeholder_type, "name": st.name,
             "influence_level": st.influence_level, "org_unit_id": st.org_unit_id}
            for st in stkhs
        ],
        "scope": {
            "id": scope.id, "scope_statement": scope.scope_statement,
            "version": scope.version, "org_unit_id": scope.org_unit_id,
        } if scope else None,
        "risk_appetite": {
            "id": ra.id, "max_acceptable_risk_level": ra.max_acceptable_risk_level,
            "org_unit_id": ra.org_unit_id,
        } if ra else None,
    }

    snap = OrgContextSnapshot(
        org_unit_id=org_unit_id,
        review_id=body.review_id,
        snapshot_date=body.snapshot_date or date.today(),
        snapshot_data=snapshot_data,
    )
    s.add(snap)
    await s.commit()
    await s.refresh(snap)
    return OrgContextSnapshotOut(
        id=snap.id, org_unit_id=snap.org_unit_id, org_unit_name=unit.name,
        review_id=snap.review_id, snapshot_date=snap.snapshot_date,
        snapshot_data=snap.snapshot_data, created_at=snap.created_at,
    )


@router.get(
    PREFIX + "/snapshots/{snapshot_id}",
    response_model=OrgContextSnapshotOut,
    summary="Pobierz snapshot kontekstu",
)
async def get_snapshot(
    org_unit_id: int,
    snapshot_id: int,
    s: AsyncSession = Depends(get_session),
):
    await _get_org_unit(s, org_unit_id)
    snap = await s.get(OrgContextSnapshot, snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot nie istnieje")
    unit_name = await _get_unit_name(s, snap.org_unit_id)
    return OrgContextSnapshotOut(
        id=snap.id, org_unit_id=snap.org_unit_id, org_unit_name=unit_name,
        review_id=snap.review_id, snapshot_date=snap.snapshot_date,
        snapshot_data=snap.snapshot_data, created_at=snap.created_at,
    )
