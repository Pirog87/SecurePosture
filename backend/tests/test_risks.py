"""Functional tests — Risk Management (full ISO 27005/31000 lifecycle).

Note: risk_score and risk_level are MySQL GENERATED columns.
In SQLite tests they stay at their defaults (0 / "low").
We test all other business logic, ISO fields, and risk acceptance.
"""
import math

import pytest
from httpx import AsyncClient


def _risk_body(org_unit_id: int, **overrides) -> dict:
    """Minimal valid risk creation body."""
    base = {
        "org_unit_id": org_unit_id,
        "asset_name": "Serwer testowy",
        "impact_level": 2,
        "probability_level": 2,
        "safeguard_rating": 0.25,
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_create_risk_minimal(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    r = await client.post("/api/v1/risks", json=_risk_body(unit_id))
    assert r.status_code == 201
    data = r.json()
    assert data["asset_name"] == "Serwer testowy"
    assert data["impact_level"] == 2
    assert data["probability_level"] == 2
    assert data["safeguard_rating"] == 0.25
    assert data["org_unit_name"] == "IT"
    assert data["is_active"] is True
    assert data["id"] > 0


@pytest.mark.asyncio
async def test_create_risk_full_iso(client: AsyncClient, seed_org, seed_dicts, seed_catalog, seed_security_area):
    _, unit_id = seed_org
    dicts = seed_dicts
    threat_id, vuln_id, sg_id = seed_catalog

    r = await client.post("/api/v1/risks", json=_risk_body(
        unit_id,
        # Kontekst (ISO 31000 §5.3)
        risk_category_id=dicts["risk_category"]["strategic"],
        risk_source="Brak segmentacji sieci",
        # Identyfikacja (ISO 27005 §8.2)
        sensitivity_id=dicts["sensitivity"]["high"],
        criticality_id=dicts["criticality"]["high"],
        security_area_id=seed_security_area,
        threat_id=threat_id,
        vulnerability_id=vuln_id,
        existing_controls="Podstawowy firewall",
        control_effectiveness_id=dicts["control_effectiveness"]["none"],
        consequence_description="Utrata danych klientow",
        # Postepowanie (ISO 27005 §8.5)
        strategy_id=dicts["risk_strategy"]["modify"],
        treatment_plan="Wdrozenie segmentacji VLAN",
        treatment_deadline="2026-06-30",
        treatment_resources="Budzet 50k PLN, 2 inzynierow",
        safeguard_ids=[sg_id],
        target_impact=1,
        target_probability=1,
        target_safeguard=0.95,
        # Akceptacja i monitorowanie
        status_id=dicts["risk_status"]["open"],
        owner="Jan Kowalski",
        next_review_date="2026-03-15",
        planned_actions="Przeglad kwartalny",
    ))
    assert r.status_code == 201
    data = r.json()

    # Context
    assert data["risk_category_name"] == "Strategiczne"
    assert data["risk_source"] == "Brak segmentacji sieci"

    # Identification
    assert data["sensitivity_name"] == "Wysoka"
    assert data["criticality_name"] == "Wysoka"
    assert data["threat_name"] == "Ransomware"
    assert data["vulnerability_name"] == "Brak backupu"
    assert data["existing_controls"] == "Podstawowy firewall"
    assert data["control_effectiveness_name"] == "Brak kontroli"
    assert data["consequence_description"] == "Utrata danych klientow"

    # Treatment
    assert data["strategy_name"] == "Modyfikacja ryzyka"
    assert data["treatment_plan"] == "Wdrozenie segmentacji VLAN"
    assert data["treatment_deadline"] == "2026-06-30"
    assert data["treatment_resources"] == "Budzet 50k PLN, 2 inzynierow"
    assert len(data["safeguards"]) == 1
    assert data["safeguards"][0]["safeguard_name"] == "Firewall"

    # Residual risk auto-calculated: EXP(1) * 1 / 0.95
    expected_residual = round(math.exp(1) * 1 / 0.95, 2)
    assert data["residual_risk"] == pytest.approx(expected_residual, rel=0.01)
    assert data["target_impact"] == 1
    assert data["target_probability"] == 1
    assert data["target_safeguard"] == 0.95

    # Monitoring
    assert data["status_name"] == "Otwarty"
    assert data["owner"] == "Jan Kowalski"
    assert data["next_review_date"] == "2026-03-15"
    assert data["planned_actions"] == "Przeglad kwartalny"


@pytest.mark.asyncio
async def test_list_risks(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    # Create two risks
    await client.post("/api/v1/risks", json=_risk_body(unit_id, asset_name="Serwer A"))
    await client.post("/api/v1/risks", json=_risk_body(unit_id, asset_name="Serwer B"))

    r = await client.get("/api/v1/risks")
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_list_risks_filter_org(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    await client.post("/api/v1/risks", json=_risk_body(unit_id))

    r = await client.get(f"/api/v1/risks?org_unit_id={unit_id}")
    assert r.status_code == 200
    assert len(r.json()) == 1

    r2 = await client.get("/api/v1/risks?org_unit_id=9999")
    assert len(r2.json()) == 0


@pytest.mark.asyncio
async def test_get_risk(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/risks", json=_risk_body(unit_id))
    risk_id = cr.json()["id"]

    r = await client.get(f"/api/v1/risks/{risk_id}")
    assert r.status_code == 200
    assert r.json()["id"] == risk_id


@pytest.mark.asyncio
async def test_get_risk_404(client: AsyncClient):
    r = await client.get("/api/v1/risks/9999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_risk(client: AsyncClient, seed_org, seed_dicts):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/risks", json=_risk_body(unit_id))
    risk_id = cr.json()["id"]

    r = await client.put(f"/api/v1/risks/{risk_id}", json={
        "asset_name": "Serwer produkcyjny",
        "impact_level": 3,
        "owner": "Nowy wlasciciel",
        "treatment_plan": "Nowy plan postepowania",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["asset_name"] == "Serwer produkcyjny"
    assert data["impact_level"] == 3
    assert data["owner"] == "Nowy wlasciciel"
    assert data["treatment_plan"] == "Nowy plan postepowania"


@pytest.mark.asyncio
async def test_update_risk_residual_recalc(client: AsyncClient, seed_org):
    """When target components change on update, residual_risk is recalculated."""
    _, unit_id = seed_org
    cr = await client.post("/api/v1/risks", json=_risk_body(
        unit_id, target_impact=2, target_probability=2, target_safeguard=0.70,
    ))
    risk_id = cr.json()["id"]
    orig_residual = cr.json()["residual_risk"]

    # Update target components
    r = await client.put(f"/api/v1/risks/{risk_id}", json={
        "target_impact": 1,
        "target_safeguard": 0.95,
    })
    assert r.status_code == 200
    new_residual = r.json()["residual_risk"]
    # New residual should be lower (target_impact went from 2->1, safeguard went 0.70->0.95)
    assert new_residual < orig_residual


@pytest.mark.asyncio
async def test_accept_risk_iso8_6(client: AsyncClient, seed_org, seed_dicts):
    """ISO 27005 §8.6 — formal risk acceptance workflow."""
    _, unit_id = seed_org
    cr = await client.post("/api/v1/risks", json=_risk_body(unit_id))
    risk_id = cr.json()["id"]

    r = await client.post(f"/api/v1/risks/{risk_id}/accept", json={
        "accepted_by": "Jan Kowalski, CISO",
        "acceptance_justification": "Ryzyko w granicach apetytu na ryzyko organizacji",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["accepted_by"] == "Jan Kowalski, CISO"
    assert data["accepted_at"] is not None
    assert data["acceptance_justification"] == "Ryzyko w granicach apetytu na ryzyko organizacji"
    # Status should be auto-set to "accepted" if the dict entry exists
    assert data["status_name"] == "Zaakceptowane"


@pytest.mark.asyncio
async def test_accept_risk_404(client: AsyncClient):
    r = await client.post("/api/v1/risks/9999/accept", json={"accepted_by": "Test"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_close_risk(client: AsyncClient, seed_org, seed_dicts):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/risks", json=_risk_body(unit_id))
    risk_id = cr.json()["id"]

    r = await client.delete(f"/api/v1/risks/{risk_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "closed"

    # Verify closed risk not in active list
    r2 = await client.get("/api/v1/risks")
    assert all(ri["id"] != risk_id for ri in r2.json())

    # Visible with include_archived
    r3 = await client.get("/api/v1/risks?include_archived=true")
    risk = next(ri for ri in r3.json() if ri["id"] == risk_id)
    assert risk["is_active"] is False


@pytest.mark.asyncio
async def test_risk_safeguards_sync(client: AsyncClient, seed_org, seed_catalog):
    """Safeguards can be attached and changed on update."""
    _, unit_id = seed_org
    _, _, sg_id = seed_catalog

    cr = await client.post("/api/v1/risks", json=_risk_body(unit_id, safeguard_ids=[sg_id]))
    risk_id = cr.json()["id"]
    assert len(cr.json()["safeguards"]) == 1

    # Remove all safeguards
    r = await client.put(f"/api/v1/risks/{risk_id}", json={"safeguard_ids": []})
    assert len(r.json()["safeguards"]) == 0
