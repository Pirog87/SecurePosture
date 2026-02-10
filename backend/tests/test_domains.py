"""Functional tests — Security Domains CRUD + Dashboard."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_domain(client: AsyncClient):
    r = await client.post("/api/v1/domains", json={
        "name": "Bezpieczenstwo sieci",
        "description": "Monitoring i ochrona sieci",
        "icon": "wifi",
        "color": "#0ea5e9",
        "owner": "Jan Kowalski",
        "sort_order": 1,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Bezpieczenstwo sieci"
    assert data["icon"] == "wifi"
    assert data["color"] == "#0ea5e9"
    assert data["owner"] == "Jan Kowalski"
    assert data["is_active"] is True
    assert data["cis_controls"] == []
    assert data["risk_count"] == 0


@pytest.mark.asyncio
async def test_list_domains(client: AsyncClient, seed_security_area):
    r = await client.get("/api/v1/domains")
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_get_domain(client: AsyncClient, seed_security_area):
    r = await client.get(f"/api/v1/domains/{seed_security_area}")
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Bezpieczenstwo informacji"
    assert "cis_controls" in data
    assert "risk_count" in data


@pytest.mark.asyncio
async def test_update_domain(client: AsyncClient, seed_security_area):
    r = await client.put(f"/api/v1/domains/{seed_security_area}", json={
        "name": "Bezpieczenstwo IT",
        "icon": "shield",
        "color": "#ef4444",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Bezpieczenstwo IT"
    assert data["icon"] == "shield"
    assert data["color"] == "#ef4444"


@pytest.mark.asyncio
async def test_archive_domain(client: AsyncClient, seed_security_area):
    r = await client.delete(f"/api/v1/domains/{seed_security_area}")
    assert r.status_code == 200
    assert r.json()["status"] == "archived"

    # Archived hidden by default
    r2 = await client.get("/api/v1/domains")
    assert len(r2.json()) == 0

    # Visible with include_archived
    r3 = await client.get("/api/v1/domains?include_archived=true")
    assert len(r3.json()) == 1


@pytest.mark.asyncio
async def test_domain_404(client: AsyncClient):
    r = await client.get("/api/v1/domains/9999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_domain_dashboard_empty(client: AsyncClient):
    r = await client.get("/api/v1/domains/dashboard/scores")
    assert r.status_code == 200
    data = r.json()
    assert "domains" in data
    assert "overall_score" in data
    assert "overall_grade" in data


@pytest.mark.asyncio
async def test_domain_dashboard_with_data(client: AsyncClient, seed_org, seed_security_area, seed_dicts):
    """Create a domain with risks and check dashboard score."""
    _, unit_id = seed_org
    # Create a risk linked to the domain
    await client.post("/api/v1/risks", json={
        "org_unit_id": unit_id,
        "asset_name": "Server DB",
        "security_area_id": seed_security_area,
        "impact_level": 3,
        "probability_level": 2,
        "safeguard_rating": 0.25,
    })

    r = await client.get("/api/v1/domains/dashboard/scores")
    assert r.status_code == 200
    data = r.json()
    assert len(data["domains"]) >= 1
    domain = next((d for d in data["domains"] if d["domain_id"] == seed_security_area), None)
    assert domain is not None
    assert domain["risk_count"] == 1
    assert domain["risk_high"] + domain["risk_medium"] + domain["risk_low"] == 1
    assert 0 <= domain["score"] <= 100
    assert domain["grade"] in ("A", "B", "C", "D", "F")
    assert len(domain["top_risks"]) == 1


@pytest.mark.asyncio
async def test_domain_with_org_filter(client: AsyncClient, seed_org, seed_security_area, seed_dicts):
    _, unit_id = seed_org
    r = await client.get(f"/api/v1/domains/dashboard/scores?org_unit_id={unit_id}")
    assert r.status_code == 200
    assert r.json()["org_unit_id"] == unit_id
