"""
AI endpoints for Audit Program module.
UC-AP-1: Suggest items based on context
UC-AP-2: Review program completeness
"""
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.audit_program import (
    AuditProgramV2,
    AuditProgramItem,
    Supplier,
    Location,
)
from app.models.risk import Risk
from app.models.framework import Framework, Assessment
from app.models.audit_register import AuditFinding
from app.models.org_unit import OrgUnit
from app.services.ai_service import (
    AIFeatureDisabledException,
    AINotConfiguredException,
    AIRateLimitException,
    get_ai_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai/audit-program", tags=["AI Program Audytow"])


# ═══════════════════════════════════════════════════════════════
# Request schemas
# ═══════════════════════════════════════════════════════════════


class SuggestItemsRequest(BaseModel):
    program_id: int
    scope_themes: list[str] = Field(
        ..., min_length=1,
        description="e.g. ['compliance', 'supplier', 'physical', 'process', 'follow_up']",
    )
    additional_context: str | None = None
    include_assessments: bool = True
    include_findings: bool = True
    include_risks: bool = True
    include_suppliers: bool = True
    include_locations: bool = True
    include_previous_program: bool = True
    include_frameworks: bool = True


class ReviewCompletenessRequest(BaseModel):
    program_id: int


# ═══════════════════════════════════════════════════════════════
# Context Builder
# ═══════════════════════════════════════════════════════════════


async def _build_context(
    s: AsyncSession,
    program: AuditProgramV2,
    scope_themes: list[str],
    additional_context: str | None,
    include_assessments: bool,
    include_findings: bool,
    include_risks: bool,
    include_suppliers: bool,
    include_locations: bool,
    include_previous_program: bool,
    include_frameworks: bool,
) -> str:
    """Build textual context for AI prompt from system data."""
    parts: list[str] = []

    # Program basic info
    ou_name = "Cala organizacja"
    if program.org_unit_id:
        ou = await s.get(OrgUnit, program.org_unit_id)
        if ou:
            ou_name = ou.name

    parts.append(
        f"PROGRAM: {program.name}\n"
        f"Okres: {program.period_start} -> {program.period_end}\n"
        f"Organizacja: {ou_name}\n"
        f"Zakres tematyczny: {', '.join(scope_themes)}\n"
        f"Budzet planowany: {program.budget_planned_days or '?'} osobodni, "
        f"{program.budget_planned_cost or '?'} {program.budget_currency}"
    )

    if additional_context:
        parts.append(f"KONTEKST UZYTKOWNIKA: {additional_context}")

    # Compliance assessments
    if include_assessments and "compliance" in scope_themes:
        q = (
            select(Assessment, Framework.name.label("fw_name"))
            .join(Framework, Assessment.framework_id == Framework.id)
            .where(Assessment.status.in_(["in_progress", "completed"]))
            .order_by(Assessment.assessment_date.desc())
            .limit(15)
        )
        rows = (await s.execute(q)).all()
        if rows:
            lines = ["AKTUALNE OCENY ZGODNOSCI:"]
            for row in rows:
                a = row[0]
                fw_name = row.fw_name
                score = f"{a.overall_score}%" if a.overall_score else "brak oceny"
                lines.append(f"- {fw_name}: {score} (status: {a.status})")
            parts.append("\n".join(lines))

    # Open findings
    if include_findings:
        q = (
            select(AuditFinding)
            .where(AuditFinding.is_active.is_(True))
            .order_by(AuditFinding.created_at.desc())
            .limit(20)
        )
        findings = (await s.execute(q)).scalars().all()
        if findings:
            lines = ["OTWARTE USTALENIA AUDYTOWE:"]
            for f in findings:
                lines.append(f"- {f.title} (ref: {f.ref_id or '?'})")
            parts.append("\n".join(lines))

    # Risk scenarios (high/critical)
    if include_risks:
        q = (
            select(Risk)
            .where(Risk.risk_level.in_(["high", "critical", "very_high"]))
            .order_by(Risk.risk_score.desc())
            .limit(20)
        )
        risks = (await s.execute(q)).scalars().all()
        if risks:
            lines = ["SCENARIUSZE RYZYKA (HIGH/CRITICAL):"]
            for r in risks:
                lines.append(f"- [{r.risk_level.upper()}] {r.asset_name} (score: {r.risk_score})")
            parts.append("\n".join(lines))

    # Suppliers
    if include_suppliers and "supplier" in scope_themes:
        q = (
            select(Supplier)
            .where(Supplier.status == "active")
            .order_by(Supplier.criticality.desc())
        )
        suppliers = (await s.execute(q)).scalars().all()
        if suppliers:
            lines = ["AKTYWNI DOSTAWCY:"]
            for sup in suppliers:
                lines.append(
                    f"- {sup.name} (krytycznosc: {sup.criticality}, "
                    f"klasyfikacja danych: {sup.data_classification})"
                )
            parts.append("\n".join(lines))

    # Locations
    if include_locations and "physical" in scope_themes:
        q = (
            select(Location)
            .where(Location.status == "active")
            .order_by(Location.criticality.desc())
        )
        locations = (await s.execute(q)).scalars().all()
        if locations:
            lines = ["AKTYWNE LOKALIZACJE:"]
            for loc in locations:
                lines.append(
                    f"- {loc.name} ({loc.location_type}, krytycznosc: {loc.criticality}, "
                    f"miasto: {loc.city or '?'})"
                )
            parts.append("\n".join(lines))

    # Previous program
    if include_previous_program and program.previous_program_id:
        prev = await s.get(AuditProgramV2, program.previous_program_id)
        if prev:
            prev_items_q = (
                select(AuditProgramItem)
                .where(AuditProgramItem.audit_program_id == prev.id)
                .order_by(AuditProgramItem.display_order)
            )
            prev_items = (await s.execute(prev_items_q)).scalars().all()
            lines = [f"POPRZEDNI PROGRAM: {prev.name} ({prev.period_start} -> {prev.period_end})"]
            for it in prev_items:
                lines.append(f"- {it.name} ({it.audit_type}, status: {it.item_status})")
            parts.append("\n".join(lines))

    # Frameworks
    if include_frameworks and "compliance" in scope_themes:
        q = (
            select(Framework)
            .where(Framework.is_active.is_(True))
            .order_by(Framework.name)
            .limit(20)
        )
        frameworks = (await s.execute(q)).scalars().all()
        if frameworks:
            lines = ["AKTYWNE FRAMEWORKI / REGULACJE:"]
            for fw in frameworks:
                lines.append(f"- {fw.name} (wersja: {fw.version or '?'}, jezyk: {fw.locale})")
            parts.append("\n".join(lines))

    return "\n\n".join(parts)


def _infer_scope(items: list[AuditProgramItem]) -> list[str]:
    """Infer thematic scope from existing program items."""
    types = {item.audit_type for item in items}
    scope = []
    if "compliance" in types:
        scope.append("compliance")
    if "process" in types:
        scope.append("process")
    if "supplier" in types:
        scope.append("supplier")
    if "physical" in types:
        scope.append("physical")
    if "follow_up" in types:
        scope.append("follow_up")
    if "combined" in types:
        scope.extend(["compliance", "process"])
    return list(set(scope)) or ["compliance", "process"]


# ═══════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════


@router.post("/suggest-items")
async def suggest_items(
    body: SuggestItemsRequest,
    s: AsyncSession = Depends(get_session),
):
    """UC-AP-1: AI-suggested program items based on context and system data."""
    program = await s.get(AuditProgramV2, body.program_id)
    if not program:
        raise HTTPException(404, "Program nie znaleziony")
    if program.status != "draft":
        raise HTTPException(400, "Sugestie AI dostepne tylko dla programow w statusie 'draft'")

    try:
        ai = await get_ai_service(s)
        context = await _build_context(
            s, program, body.scope_themes, body.additional_context,
            body.include_assessments, body.include_findings, body.include_risks,
            body.include_suppliers, body.include_locations,
            body.include_previous_program, body.include_frameworks,
        )
        suggestions = await ai.suggest_audit_program_items(
            user_id=program.owner_id,
            context=context,
        )
        return {"suggestions": suggestions}

    except AINotConfiguredException:
        raise HTTPException(503, "AI nie jest skonfigurowane")
    except AIFeatureDisabledException:
        raise HTTPException(403, "Funkcja AI 'audit_program_suggest' jest wylaczona")
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))
    except Exception as e:
        logger.exception("AI suggest-items failed")
        raise HTTPException(500, f"Blad AI: {e}")


@router.post("/review-completeness")
async def review_completeness(
    body: ReviewCompletenessRequest,
    s: AsyncSession = Depends(get_session),
):
    """UC-AP-2: AI program completeness review before approval."""
    program = await s.get(AuditProgramV2, body.program_id)
    if not program:
        raise HTTPException(404, "Program nie znaleziony")
    if program.status != "draft":
        raise HTTPException(400, "Przeglad kompletnosci AI dostepny tylko dla statusu 'draft'")

    # Load current items to build context
    items_q = (
        select(AuditProgramItem)
        .where(AuditProgramItem.audit_program_id == program.id)
        .order_by(AuditProgramItem.display_order)
    )
    items = list((await s.execute(items_q)).scalars().all())

    # Infer scope from items
    scope_themes = _infer_scope(items)

    # Build program items JSON
    items_json = json.dumps([
        {
            "ref_id": it.ref_id,
            "name": it.name,
            "audit_type": it.audit_type,
            "planned_quarter": it.planned_quarter,
            "planned_start": it.planned_start.isoformat() if it.planned_start else None,
            "planned_end": it.planned_end.isoformat() if it.planned_end else None,
            "scope_type": it.scope_type,
            "scope_name": it.scope_name,
            "priority": it.priority,
            "planned_days": float(it.planned_days) if it.planned_days else None,
            "item_status": it.item_status,
            "audit_method": it.audit_method,
        }
        for it in items
    ], ensure_ascii=False, indent=2)

    try:
        ai = await get_ai_service(s)
        system_context = await _build_context(
            s, program, scope_themes, None,
            include_assessments=True, include_findings=True, include_risks=True,
            include_suppliers="supplier" in scope_themes,
            include_locations="physical" in scope_themes,
            include_previous_program=True, include_frameworks=True,
        )

        full_context = (
            f"AKTUALNY PROGRAM AUDYTOW:\n{items_json}\n\n"
            f"DANE SYSTEMOWE:\n{system_context}"
        )

        result = await ai.review_audit_program_completeness(
            user_id=program.owner_id,
            context=full_context,
        )
        return result

    except AINotConfiguredException:
        raise HTTPException(503, "AI nie jest skonfigurowane")
    except AIFeatureDisabledException:
        raise HTTPException(403, "Funkcja AI 'audit_program_review' jest wylaczona")
    except AIRateLimitException as e:
        raise HTTPException(429, str(e))
    except Exception as e:
        logger.exception("AI review-completeness failed")
        raise HTTPException(500, f"Blad AI: {e}")
