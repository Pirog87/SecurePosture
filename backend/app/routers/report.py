"""
Report generation — /api/v1/reports
Generates Excel reports for risks, assets, assessments, and executive summary.
"""
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.asset import Asset, AssetRelationship
from app.models.asset_category import AssetCategory
from app.models.dictionary import DictionaryEntry
from app.models.framework import Assessment, Framework
from app.models.incident import Incident
from app.models.org_unit import OrgUnit
from app.models.risk import Risk
from app.models.security_area import SecurityDomain
from app.models.vendor import Vendor
from app.models.vulnerability import VulnerabilityRecord

router = APIRouter(prefix="/api/v1/reports", tags=["Raporty"])


def _wb():
    """Create openpyxl workbook (lazy import)."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        return Workbook(), Font, PatternFill, Alignment, Border, Side
    except ImportError:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        return Workbook(), Font, PatternFill, Alignment, Border, Side


def _styled_header(ws, row, headers, Font, PatternFill, Alignment, Border, Side):
    """Apply styled headers to a worksheet row."""
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin"),
    )
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border
    return thin_border


def _stream_xlsx(wb) -> StreamingResponse:
    """Stream workbook as xlsx download."""
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=raport_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"},
    )


async def _de_label(s: AsyncSession, entry_id: int | None) -> str | None:
    if entry_id is None:
        return None
    e = await s.get(DictionaryEntry, entry_id)
    return e.label if e else None


# ═══════════════════ RISK REPORT ═══════════════════

@router.get("/risks", summary="Raport ryzyk (Excel)")
async def report_risks(
    org_unit_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    wb, Font, PatternFill, Alignment, Border, Side = _wb()
    ws = wb.active
    ws.title = "Rejestr Ryzyk"

    headers = [
        "ID", "Aktywo", "Jednostka org.", "Domena bezp.", "Kategoria ryzyka",
        "Wplyw (W)", "Prawdop. (P)", "Zabezp. (Z)", "Ocena ryzyka (R)", "Poziom",
        "Status", "Strategia", "Wlasciciel", "Termin realizacji",
        "Ryzyko rezydualne", "Zaakceptowal", "Data akceptacji",
    ]
    border = _styled_header(ws, 1, headers, Font, PatternFill, Alignment, Border, Side)

    q = select(Risk).where(Risk.is_active.is_(True))
    if org_unit_id:
        q = q.where(Risk.org_unit_id == org_unit_id)
    q = q.order_by(Risk.risk_score.desc())
    risks = (await s.execute(q)).scalars().all()

    for row_idx, r in enumerate(risks, 2):
        org = await s.get(OrgUnit, r.org_unit_id) if r.org_unit_id else None
        area = await s.get(SecurityDomain, r.security_area_id) if r.security_area_id else None
        values = [
            f"R-{r.id}", r.asset_name, org.name if org else "",
            area.name if area else "", await _de_label(s, r.risk_category_id),
            r.impact_level, r.probability_level, float(r.safeguard_rating),
            float(r.risk_score) if r.risk_score else 0, r.risk_level,
            await _de_label(s, r.status_id), await _de_label(s, r.strategy_id),
            r.owner, r.treatment_deadline.isoformat() if r.treatment_deadline else "",
            float(r.residual_risk) if r.residual_risk else "", r.accepted_by or "",
            r.accepted_at.isoformat() if r.accepted_at else "",
        ]
        for col_idx, val in enumerate(values, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.border = border

    # Auto-width
    for col in ws.columns:
        max_len = max(len(str(c.value or "")) for c in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 3, 40)

    return _stream_xlsx(wb)


# ═══════════════════ ASSET REPORT ═══════════════════

@router.get("/assets", summary="Raport aktywow (Excel)")
async def report_assets(
    asset_category_id: int | None = Query(None),
    s: AsyncSession = Depends(get_session),
):
    wb, Font, PatternFill, Alignment, Border, Side = _wb()
    ws = wb.active
    ws.title = "Rejestr Aktywow"

    headers = [
        "ID", "Ref", "Nazwa", "Kategoria CMDB", "Jednostka org.",
        "Wlasciciel", "Lokalizacja", "Wrazliwosc", "Krytycznosc",
        "Ilosc ryzyk", "Utworzono",
    ]
    border = _styled_header(ws, 1, headers, Font, PatternFill, Alignment, Border, Side)

    q = select(Asset).where(Asset.is_active.is_(True))
    if asset_category_id:
        q = q.where(Asset.asset_category_id == asset_category_id)
    q = q.order_by(Asset.name)
    assets = (await s.execute(q)).scalars().all()

    for row_idx, a in enumerate(assets, 2):
        org = await s.get(OrgUnit, a.org_unit_id) if a.org_unit_id else None
        cat = await s.get(AssetCategory, a.asset_category_id) if a.asset_category_id else None
        rc_q = select(func.count()).select_from(Risk).where(Risk.asset_id == a.id)
        rc = (await s.execute(rc_q)).scalar() or 0
        values = [
            a.id, a.ref_id or "", a.name,
            cat.name if cat else "", org.name if org else "",
            a.owner or "", a.location or "",
            await _de_label(s, a.sensitivity_id), await _de_label(s, a.criticality_id),
            rc, a.created_at.strftime("%Y-%m-%d"),
        ]
        for col_idx, val in enumerate(values, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.border = border

    for col in ws.columns:
        max_len = max(len(str(c.value or "")) for c in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 3, 40)

    return _stream_xlsx(wb)


# ═══════════════════ EXECUTIVE REPORT ═══════════════════

@router.get("/executive", summary="Raport Executive Summary (Excel)")
async def report_executive(s: AsyncSession = Depends(get_session)):
    wb, Font, PatternFill, Alignment, Border, Side = _wb()

    # Sheet 1: Summary
    ws1 = wb.active
    ws1.title = "Podsumowanie"
    title_font = Font(bold=True, size=14, color="1F4E79")
    ws1.cell(row=1, column=1, value="SecurePosture — Raport Executive Summary").font = title_font
    ws1.cell(row=2, column=1, value=f"Data generacji: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    # KPIs
    ws1.cell(row=4, column=1, value="Kluczowe wskazniki (KPI)").font = Font(bold=True, size=12)

    # Risk counts
    total_risks = (await s.execute(select(func.count()).select_from(Risk).where(Risk.is_active.is_(True)))).scalar() or 0
    high_risks = (await s.execute(select(func.count()).select_from(Risk).where(Risk.is_active.is_(True), Risk.risk_level == "high"))).scalar() or 0
    medium_risks = (await s.execute(select(func.count()).select_from(Risk).where(Risk.is_active.is_(True), Risk.risk_level == "medium"))).scalar() or 0
    low_risks = (await s.execute(select(func.count()).select_from(Risk).where(Risk.is_active.is_(True), Risk.risk_level == "low"))).scalar() or 0

    # Asset counts
    total_assets = (await s.execute(select(func.count()).select_from(Asset).where(Asset.is_active.is_(True)))).scalar() or 0
    assets_with_risks = (await s.execute(
        select(func.count(func.distinct(Risk.asset_id))).where(Risk.is_active.is_(True), Risk.asset_id.isnot(None))
    )).scalar() or 0

    # Vulnerability counts
    open_vulns = (await s.execute(select(func.count()).select_from(VulnerabilityRecord).where(VulnerabilityRecord.is_active.is_(True)))).scalar() or 0

    # Incident counts
    open_incidents = (await s.execute(select(func.count()).select_from(Incident).where(Incident.is_active.is_(True)))).scalar() or 0

    kpis = [
        ("Ryzyka ogolnie", total_risks),
        ("Ryzyka wysokie", high_risks),
        ("Ryzyka srednie", medium_risks),
        ("Ryzyka niskie", low_risks),
        ("Aktywow ogolnie", total_assets),
        ("Aktywa z ryzykami", assets_with_risks),
        ("Otwarte podatnosci", open_vulns),
        ("Otwarte incydenty", open_incidents),
    ]
    for idx, (label, val) in enumerate(kpis):
        ws1.cell(row=6 + idx, column=1, value=label)
        ws1.cell(row=6 + idx, column=2, value=val).font = Font(bold=True)

    # Sheet 2: Risk summary
    ws2 = wb.create_sheet("Ryzyka - Top 20")
    headers = ["ID", "Aktywo", "Jednostka", "Domena", "Ocena (R)", "Poziom", "Status", "Wlasciciel"]
    border = _styled_header(ws2, 1, headers, Font, PatternFill, Alignment, Border, Side)
    top_q = select(Risk).where(Risk.is_active.is_(True)).order_by(Risk.risk_score.desc()).limit(20)
    top_risks = (await s.execute(top_q)).scalars().all()
    for i, r in enumerate(top_risks, 2):
        org = await s.get(OrgUnit, r.org_unit_id) if r.org_unit_id else None
        area = await s.get(SecurityDomain, r.security_area_id) if r.security_area_id else None
        vals = [f"R-{r.id}", r.asset_name, org.name if org else "", area.name if area else "",
                float(r.risk_score) if r.risk_score else 0, r.risk_level,
                await _de_label(s, r.status_id), r.owner or ""]
        for c, v in enumerate(vals, 1):
            ws2.cell(row=i, column=c, value=v).border = border

    for col in ws2.columns:
        max_len = max(len(str(c.value or "")) for c in col)
        ws2.column_dimensions[col[0].column_letter].width = min(max_len + 3, 40)

    # Sheet 3: Assets overview
    ws3 = wb.create_sheet("Aktywa - Przeglad")
    headers3 = ["Kategoria CMDB", "Ilosc aktywow"]
    _styled_header(ws3, 1, headers3, Font, PatternFill, Alignment, Border, Side)
    cat_q = (
        select(AssetCategory.name, func.count(Asset.id))
        .join(Asset, Asset.asset_category_id == AssetCategory.id, isouter=True)
        .where(AssetCategory.is_active.is_(True))
        .group_by(AssetCategory.id, AssetCategory.name)
        .order_by(func.count(Asset.id).desc())
    )
    cat_rows = (await s.execute(cat_q)).all()
    for i, (name, count) in enumerate(cat_rows, 2):
        ws3.cell(row=i, column=1, value=name)
        ws3.cell(row=i, column=2, value=count)

    return _stream_xlsx(wb)
