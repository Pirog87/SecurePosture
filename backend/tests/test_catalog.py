"""Functional tests — Threats, Vulnerabilities, Safeguards CRUD."""
import pytest
from httpx import AsyncClient


# ═══════════════════ THREATS ═══════════════════

@pytest.mark.asyncio
async def test_create_threat(client: AsyncClient):
    r = await client.post("/api/v1/threats", json={
        "name": "Phishing",
        "description": "Atak socjotechniczny",
    })
    assert r.status_code == 201
    assert r.json()["name"] == "Phishing"
    assert r.json()["is_active"] is True


@pytest.mark.asyncio
async def test_list_threats(client: AsyncClient, seed_catalog):
    r = await client.get("/api/v1/threats")
    assert r.status_code == 200
    assert len(r.json()) >= 1
    assert r.json()[0]["name"] == "Ransomware"


@pytest.mark.asyncio
async def test_get_threat(client: AsyncClient, seed_catalog):
    threat_id = seed_catalog[0]
    r = await client.get(f"/api/v1/threats/{threat_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "Ransomware"


@pytest.mark.asyncio
async def test_update_threat(client: AsyncClient, seed_catalog):
    threat_id = seed_catalog[0]
    r = await client.put(f"/api/v1/threats/{threat_id}", json={"name": "Ransomware v2"})
    assert r.status_code == 200
    assert r.json()["name"] == "Ransomware v2"


@pytest.mark.asyncio
async def test_archive_threat(client: AsyncClient, seed_catalog):
    threat_id = seed_catalog[0]
    r = await client.delete(f"/api/v1/threats/{threat_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "archived"

    # Hidden by default
    r2 = await client.get("/api/v1/threats")
    assert all(t["id"] != threat_id for t in r2.json())


# ═══════════════════ VULNERABILITIES ═══════════════════

@pytest.mark.asyncio
async def test_create_vulnerability(client: AsyncClient, seed_security_area):
    r = await client.post("/api/v1/vulnerabilities", json={
        "name": "Slabe hasla",
        "security_area_id": seed_security_area,
    })
    assert r.status_code == 201
    assert r.json()["name"] == "Slabe hasla"


@pytest.mark.asyncio
async def test_list_vulnerabilities(client: AsyncClient, seed_catalog):
    r = await client.get("/api/v1/vulnerabilities")
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_get_vulnerability(client: AsyncClient, seed_catalog):
    vuln_id = seed_catalog[1]
    r = await client.get(f"/api/v1/vulnerabilities/{vuln_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "Brak backupu"


@pytest.mark.asyncio
async def test_update_vulnerability(client: AsyncClient, seed_catalog):
    vuln_id = seed_catalog[1]
    r = await client.put(f"/api/v1/vulnerabilities/{vuln_id}", json={"name": "Brak backupu danych"})
    assert r.status_code == 200
    assert r.json()["name"] == "Brak backupu danych"


@pytest.mark.asyncio
async def test_archive_vulnerability(client: AsyncClient, seed_catalog):
    vuln_id = seed_catalog[1]
    r = await client.delete(f"/api/v1/vulnerabilities/{vuln_id}")
    assert r.status_code == 200


# ═══════════════════ SAFEGUARDS ═══════════════════

@pytest.mark.asyncio
async def test_create_safeguard(client: AsyncClient):
    r = await client.post("/api/v1/safeguards", json={
        "name": "Antywirus",
        "description": "Ochrona przed zlosliwym oprogramowaniem",
    })
    assert r.status_code == 201
    assert r.json()["name"] == "Antywirus"


@pytest.mark.asyncio
async def test_list_safeguards(client: AsyncClient, seed_catalog):
    r = await client.get("/api/v1/safeguards")
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_update_safeguard(client: AsyncClient, seed_catalog):
    sg_id = seed_catalog[2]
    r = await client.put(f"/api/v1/safeguards/{sg_id}", json={"name": "WAF"})
    assert r.status_code == 200
    assert r.json()["name"] == "WAF"


@pytest.mark.asyncio
async def test_archive_safeguard(client: AsyncClient, seed_catalog):
    sg_id = seed_catalog[2]
    r = await client.delete(f"/api/v1/safeguards/{sg_id}")
    assert r.status_code == 200
