"""Functional tests — Org Levels + Org Units."""
import pytest
from httpx import AsyncClient


# ── Org Levels ──

@pytest.mark.asyncio
async def test_create_level(client: AsyncClient):
    r = await client.post("/api/v1/org-levels", json={"level_number": 1, "name": "Pion"})
    assert r.status_code == 201
    data = r.json()
    assert data["level_number"] == 1
    assert data["name"] == "Pion"


@pytest.mark.asyncio
async def test_list_levels(client: AsyncClient, seed_org):
    r = await client.get("/api/v1/org-levels")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Pion"


@pytest.mark.asyncio
async def test_update_level(client: AsyncClient, seed_org):
    level_id = seed_org[0]
    r = await client.put(f"/api/v1/org-levels/{level_id}", json={"name": "Departament"})
    assert r.status_code == 200
    assert r.json()["name"] == "Departament"


# ── Org Units ──

@pytest.mark.asyncio
async def test_create_unit(client: AsyncClient, seed_org):
    level_id, _ = seed_org
    r = await client.post("/api/v1/org-units", json={
        "level_id": level_id,
        "name": "Finanse",
        "symbol": "FIN",
        "owner": "Anna Nowak",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Finanse"
    assert data["symbol"] == "FIN"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_list_units(client: AsyncClient, seed_org):
    r = await client.get("/api/v1/org-units")
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_get_unit(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    r = await client.get(f"/api/v1/org-units/{unit_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "IT"


@pytest.mark.asyncio
async def test_get_unit_404(client: AsyncClient):
    r = await client.get("/api/v1/org-units/9999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_unit(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    r = await client.put(f"/api/v1/org-units/{unit_id}", json={"name": "IT Security"})
    assert r.status_code == 200
    assert r.json()["name"] == "IT Security"


@pytest.mark.asyncio
async def test_deactivate_unit(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    r = await client.delete(f"/api/v1/org-units/{unit_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "deactivated"

    # Verify deactivated
    r2 = await client.get(f"/api/v1/org-units/{unit_id}")
    assert r2.json()["is_active"] is False
    assert r2.json()["deactivated_at"] is not None


@pytest.mark.asyncio
async def test_tree_hierarchy(client: AsyncClient, seed_org):
    level_id, parent_id = seed_org
    # Create child unit
    r = await client.post("/api/v1/org-units", json={
        "level_id": level_id,
        "name": "Bezpieczenstwo",
        "symbol": "SEC",
        "parent_id": parent_id,
    })
    assert r.status_code == 201

    # Get tree
    r2 = await client.get("/api/v1/org-units/tree")
    assert r2.status_code == 200
    tree = r2.json()
    # Find the IT root node
    it_node = next(n for n in tree if n["name"] == "IT")
    assert len(it_node["children"]) == 1
    assert it_node["children"][0]["name"] == "Bezpieczenstwo"
