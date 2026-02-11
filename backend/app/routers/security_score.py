"""
Security Score module — /api/v1/security-score
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.security_score import SecurityScoreConfig, SecurityScoreSnapshot
from app.schemas.security_score import (
    ConfigOut, ConfigUpdate, MethodologyOut, MethodologyPillar,
    PillarDetail, SecurityScoreOut, SnapshotOut,
)
from app.services.score_engine import calculate_all_pillars, get_active_config

router = APIRouter(prefix="/api/v1/security-score", tags=["Security Score"])

PILLAR_NAMES = {
    "risk": "Ryzyka",
    "vulnerability": "Podatności",
    "incident": "Incydenty",
    "exception": "Wyjątki od polityk",
    "maturity": "Control Maturity",
    "audit": "Audyty / Findings",
    "asset": "Aktywa (CMDB)",
    "tprm": "Dostawcy (TPRM)",
    "policy": "Polityki",
    "awareness": "Awareness",
}


def _score_rating(score: float) -> tuple[str, str]:
    if score >= 80:
        return "Dobry", "#16a34a"
    elif score >= 60:
        return "Zadowalający", "#ca8a04"
    elif score >= 40:
        return "Wymaga poprawy", "#ea580c"
    return "Krytyczny", "#dc2626"


# ═══════════════════ CURRENT SCORE ═══════════════════

@router.get("", response_model=SecurityScoreOut, summary="Aktualny Security Score")
async def get_security_score(s: AsyncSession = Depends(get_session)):
    result = await calculate_all_pillars(s)
    rating, color = _score_rating(result["total_score"])

    pillars = []
    for key in result["pillars"]:
        score = result["pillars"][key]
        weight = result["weights"][key]
        pillars.append(PillarDetail(
            name=PILLAR_NAMES.get(key, key),
            score=score,
            weight=weight,
            weighted_contribution=round(score * weight / 100, 1),
        ))

    return SecurityScoreOut(
        total_score=result["total_score"],
        rating=rating,
        color=color,
        pillars=pillars,
        config_version=result["config_version"],
        calculated_at=datetime.now(),
    )


# ═══════════════════ HISTORY ═══════════════════

@router.get("/history", response_model=list[SnapshotOut], summary="Historia snapshotów")
async def get_history(
    limit: int = Query(30, ge=1, le=365),
    s: AsyncSession = Depends(get_session),
):
    q = (select(SecurityScoreSnapshot)
         .order_by(SecurityScoreSnapshot.snapshot_date.desc())
         .limit(limit))
    snapshots = (await s.execute(q)).scalars().all()
    return snapshots


# ═══════════════════ SNAPSHOT ═══════════════════

@router.post("/snapshot", response_model=SnapshotOut, status_code=201, summary="Wymuś snapshot")
async def force_snapshot(
    triggered_by: str = Query("manual"),
    created_by: str = Query("admin"),
    s: AsyncSession = Depends(get_session),
):
    result = await calculate_all_pillars(s)
    cfg = await get_active_config(s)

    snap = SecurityScoreSnapshot(
        total_score=result["total_score"],
        risk_score=result["pillars"]["risk"],
        vulnerability_score=result["pillars"]["vulnerability"],
        incident_score=result["pillars"]["incident"],
        exception_score=result["pillars"]["exception"],
        maturity_score=result["pillars"]["maturity"],
        audit_score=result["pillars"]["audit"],
        asset_score=result["pillars"]["asset"],
        tprm_score=result["pillars"]["tprm"],
        policy_score=result["pillars"]["policy"],
        awareness_score=result["pillars"]["awareness"],
        w_risk=cfg.w_risk, w_vulnerability=cfg.w_vulnerability,
        w_incident=cfg.w_incident, w_exception=cfg.w_exception,
        w_maturity=cfg.w_maturity, w_audit=cfg.w_audit,
        w_asset=cfg.w_asset, w_tprm=cfg.w_tprm,
        w_policy=cfg.w_policy, w_awareness=cfg.w_awareness,
        config_version=cfg.version,
        triggered_by=triggered_by,
        created_by=created_by,
    )
    s.add(snap)
    await s.commit()
    await s.refresh(snap)
    return snap


# ═══════════════════ METHODOLOGY ═══════════════════

@router.get("/methodology", response_model=MethodologyOut, summary="Strona metodologii")
async def get_methodology(s: AsyncSession = Depends(get_session)):
    result = await calculate_all_pillars(s)
    rating, _ = _score_rating(result["total_score"])

    descriptions = {
        "risk": "Mierzy poziom ryzyka w organizacji na podstawie rejestru ryzyk, uwzględniając wagę statusu (zidentyfikowane, w mitygacji, zaakceptowane).",
        "vulnerability": "Ocenia stan podatności technicznych: otwarte podatności wg severity, zgodność z SLA remediacji.",
        "incident": "Ocenia zdolność reagowania na incydenty: częstotliwość, czas reakcji (TTR), wyciągnięte wnioski.",
        "exception": "Mierzy ilość aktywnych wyjątków od polityk, przeterminowane wyjątki, obecność kontroli kompensacyjnych.",
        "maturity": "Poziom dojrzałości kontroli bezpieczeństwa na podstawie ostatniej oceny frameworka (CIS v8 / ISO 27001 / NIST).",
        "audit": "Ocenia otwarte ustalenia z audytów wg severity, zgodność z SLA remediacji.",
        "asset": "Ocenia higienę zarządzania aktywami: pokrycie właścicielami, EOL, skanowanie, sieroty.",
        "tprm": "Ocenia zarządzanie ryzykiem dostawców: pokrycie ocenami, wyniki ratingów, terminowość przeglądów.",
        "policy": "Ocenia stan polityk bezpieczeństwa: potwierdzenia, przeglądy, mapowanie do standardów, zatwierdzenia.",
        "awareness": "Ocenia świadomość bezpieczeństwa: ukończenie szkoleń, wyniki symulacji phishingowych, raportowanie.",
    }

    formulas = {
        "risk": "Risk_Score = 100 − (Σ(normalized_R × status_weight) / N) × 100",
        "vulnerability": "Vuln_Score = (100 − Σ(waga × min(count, próg)/próg) × 100) × sla_mult",
        "incident": "Inc_Score = 100 − incident_penalty − ttr_penalty + lessons_bonus",
        "exception": "Exc_Score = 100 − active_penalty − expired_penalty + comp_bonus",
        "maturity": "Maturity_Score = avg(assessment_levels) / max_level × 100",
        "audit": "Audit_Score = (100 − Σ(waga × count_open)) × sla_mult",
        "asset": "Asset_Score = coverage×0.4 + eol×0.25 + scan×0.2 + hygiene×0.15",
        "tprm": "TPRM_Score = coverage×0.4 + rating×0.4 + timeliness×0.2",
        "policy": "Policy_Score = ack×0.35 + review×0.30 + coverage×0.20 + approval×0.15",
        "awareness": "Awareness_Score = training×0.40 + phishing×0.40 + reporting×0.20",
    }

    sources = {
        "risk": "Rejestr ryzyk", "vulnerability": "Rejestr podatności",
        "incident": "Rejestr incydentów", "exception": "Rejestr wyjątków",
        "maturity": "Framework Engine", "audit": "Rejestr audytów",
        "asset": "Rejestr aktywów (CMDB)", "tprm": "Rejestr dostawców",
        "policy": "Rejestr polityk", "awareness": "Security Awareness",
    }

    pillars = []
    for key in result["pillars"]:
        pillars.append(MethodologyPillar(
            name=PILLAR_NAMES.get(key, key),
            weight=result["weights"][key],
            description=descriptions.get(key, ""),
            data_source=sources.get(key, ""),
            formula=formulas.get(key, ""),
            current_score=result["pillars"][key],
        ))

    return MethodologyOut(
        title="Metodologia Security Score — SecurePosture",
        config_version=result["config_version"],
        generated_at=datetime.now(),
        scale_description="Skala 0-100: Dobry (80-100, zielony), Zadowalający (60-79, żółty), Wymaga poprawy (40-59, pomarańczowy), Krytyczny (0-39, czerwony)",
        pillars=pillars,
        total_score=result["total_score"],
        rating=rating,
    )


# ═══════════════════ CONFIG ═══════════════════

@router.get("/config", response_model=ConfigOut, summary="Aktywna konfiguracja")
async def get_config(s: AsyncSession = Depends(get_session)):
    cfg = await get_active_config(s)
    return cfg


@router.put("/config", response_model=ConfigOut, summary="Zmiana konfiguracji")
async def update_config(body: ConfigUpdate, s: AsyncSession = Depends(get_session)):
    old_cfg = await get_active_config(s)

    # Validate weights sum to 100 if any weights are provided
    weight_fields = ["w_risk", "w_vulnerability", "w_incident", "w_exception",
                     "w_maturity", "w_audit", "w_asset", "w_tprm", "w_policy", "w_awareness"]
    new_weights = {}
    for f in weight_fields:
        val = getattr(body, f) if getattr(body, f) is not None else float(getattr(old_cfg, f) or 0)
        new_weights[f] = val

    total_w = sum(new_weights.values())
    if abs(total_w - 100) > 0.1:
        raise HTTPException(400, f"Suma wag musi wynosić 100% (aktualnie: {total_w}%)")

    # Deactivate old config
    old_cfg.is_active = False

    # Create new version
    new_cfg = SecurityScoreConfig(
        version=(old_cfg.version or 0) + 1,
        is_active=True,
    )
    for f in weight_fields:
        setattr(new_cfg, f, new_weights[f])

    threshold_fields = ["vuln_threshold_critical", "vuln_threshold_high", "vuln_threshold_medium",
                        "vuln_threshold_low", "incident_ttr_critical", "incident_ttr_high",
                        "incident_ttr_medium", "incident_ttr_low", "incident_window_days",
                        "audit_sla_critical", "audit_sla_high", "audit_sla_medium", "audit_sla_low",
                        "snapshot_frequency"]
    for f in threshold_fields:
        val = getattr(body, f) if getattr(body, f) is not None else getattr(old_cfg, f)
        setattr(new_cfg, f, val)

    new_cfg.changed_by = body.changed_by or "admin"
    new_cfg.change_reason = body.change_reason

    s.add(new_cfg)
    await s.commit()
    await s.refresh(new_cfg)
    return new_cfg


@router.get("/config/history", response_model=list[ConfigOut], summary="Historia konfiguracji")
async def get_config_history(s: AsyncSession = Depends(get_session)):
    q = select(SecurityScoreConfig).order_by(SecurityScoreConfig.version.desc())
    configs = (await s.execute(q)).scalars().all()
    return configs
