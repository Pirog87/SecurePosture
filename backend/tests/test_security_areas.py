"""Functional tests — Security Areas CRUD."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_area(client: AsyncClient):
    r = await client.post("/api/v1/security-areas", json={
        "name": "Bezpieczenstwo fizyczne",
        "description": "Ochrona fizyczna budynkow",
        "sort_order": 1,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Bezpieczenstwo fizyczne"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_list_areas(client: AsyncClient, seed_security_area):
    r = await client.get("/api/v1/security-areas")
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_get_area(client: AsyncClient, seed_security_area):
    r = await client.get(f"/api/v1/security-areas/{seed_security_area}")
    assert r.status_code == 200
    assert r.json()["name"] == "Bezpieczenstwo informacji"


@pytest.mark.asyncio
async def test_update_area(client: AsyncClient, seed_security_area):
    r = await client.put(f"/api/v1/security-areas/{seed_security_area}", json={
        "name": "Bezpieczenstwo IT",
    })
    assert r.status_code == 200
    assert r.json()["name"] == "Bezpieczenstwo IT"


@pytest.mark.asyncio
async def test_archive_area(client: AsyncClient, seed_security_area):
    r = await client.delete(f"/api/v1/security-areas/{seed_security_area}")
    assert r.status_code == 200
    assert r.json()["status"] == "archived"

    # Archived areas hidden by default
    r2 = await client.get("/api/v1/security-areas")
    assert len(r2.json()) == 0

    # Visible with include_archived
    r3 = await client.get("/api/v1/security-areas?include_archived=true")
    assert len(r3.json()) == 1
