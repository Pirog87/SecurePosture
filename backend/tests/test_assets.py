"""Functional tests — Asset Registry + Relationships + Graph."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_asset(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    r = await client.post("/api/v1/assets", json={
        "name": "Serwer WWW",
        "org_unit_id": unit_id,
        "owner": "Admin IT",
        "description": "Serwer produkcyjny Apache",
        "location": "DC1 Rack 5",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Serwer WWW"
    assert data["org_unit_name"] == "IT"
    assert data["is_active"] is True
    assert data["risk_count"] == 0


@pytest.mark.asyncio
async def test_list_assets(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    await client.post("/api/v1/assets", json={"name": "A1", "org_unit_id": unit_id})
    await client.post("/api/v1/assets", json={"name": "A2", "org_unit_id": unit_id})

    r = await client.get("/api/v1/assets")
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_list_assets_filter_org(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    await client.post("/api/v1/assets", json={"name": "A1", "org_unit_id": unit_id})

    r = await client.get(f"/api/v1/assets?org_unit_id={unit_id}")
    assert len(r.json()) == 1

    r2 = await client.get("/api/v1/assets?org_unit_id=9999")
    assert len(r2.json()) == 0


@pytest.mark.asyncio
async def test_get_asset(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/assets", json={"name": "DB Server", "org_unit_id": unit_id})
    asset_id = cr.json()["id"]

    r = await client.get(f"/api/v1/assets/{asset_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "DB Server"


@pytest.mark.asyncio
async def test_get_asset_404(client: AsyncClient):
    r = await client.get("/api/v1/assets/9999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_asset(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/assets", json={"name": "Router", "org_unit_id": unit_id})
    asset_id = cr.json()["id"]

    r = await client.put(f"/api/v1/assets/{asset_id}", json={"name": "Router Core"})
    assert r.status_code == 200
    assert r.json()["name"] == "Router Core"


@pytest.mark.asyncio
async def test_archive_asset(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/assets", json={"name": "Switch", "org_unit_id": unit_id})
    asset_id = cr.json()["id"]

    r = await client.delete(f"/api/v1/assets/{asset_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "archived"

    # Not in active list
    r2 = await client.get("/api/v1/assets")
    assert all(a["id"] != asset_id for a in r2.json())


@pytest.mark.asyncio
async def test_parent_child_assets(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    parent = await client.post("/api/v1/assets", json={"name": "DC1", "org_unit_id": unit_id})
    parent_id = parent.json()["id"]

    child = await client.post("/api/v1/assets", json={
        "name": "Rack 1", "org_unit_id": unit_id, "parent_id": parent_id,
    })
    assert child.status_code == 201
    assert child.json()["parent_name"] == "DC1"


# ═══════════════════ RELATIONSHIPS ═══════════════════

@pytest.mark.asyncio
async def test_create_relationship(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    a1 = (await client.post("/api/v1/assets", json={"name": "App", "org_unit_id": unit_id})).json()
    a2 = (await client.post("/api/v1/assets", json={"name": "DB", "org_unit_id": unit_id})).json()

    r = await client.post("/api/v1/assets/relationships", json={
        "source_asset_id": a1["id"],
        "target_asset_id": a2["id"],
        "relationship_type": "depends_on",
        "description": "App wymaga DB",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["source_asset_name"] == "App"
    assert data["target_asset_name"] == "DB"
    assert data["relationship_type"] == "depends_on"


@pytest.mark.asyncio
async def test_self_relationship_rejected(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    a = (await client.post("/api/v1/assets", json={"name": "X", "org_unit_id": unit_id})).json()

    r = await client.post("/api/v1/assets/relationships", json={
        "source_asset_id": a["id"],
        "target_asset_id": a["id"],
        "relationship_type": "depends_on",
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_list_relationships(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    a1 = (await client.post("/api/v1/assets", json={"name": "A1", "org_unit_id": unit_id})).json()
    a2 = (await client.post("/api/v1/assets", json={"name": "A2", "org_unit_id": unit_id})).json()

    await client.post("/api/v1/assets/relationships", json={
        "source_asset_id": a1["id"], "target_asset_id": a2["id"],
        "relationship_type": "connects_to",
    })

    # All relationships
    r = await client.get("/api/v1/assets/relationships/all")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Per-asset relationships
    r2 = await client.get(f"/api/v1/assets/{a1['id']}/relationships")
    assert len(r2.json()) == 1


@pytest.mark.asyncio
async def test_delete_relationship(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    a1 = (await client.post("/api/v1/assets", json={"name": "X", "org_unit_id": unit_id})).json()
    a2 = (await client.post("/api/v1/assets", json={"name": "Y", "org_unit_id": unit_id})).json()

    rel = await client.post("/api/v1/assets/relationships", json={
        "source_asset_id": a1["id"], "target_asset_id": a2["id"],
        "relationship_type": "supports",
    })
    rel_id = rel.json()["id"]

    r = await client.delete(f"/api/v1/assets/relationships/{rel_id}")
    assert r.status_code == 200

    # Verify deleted
    r2 = await client.get("/api/v1/assets/relationships/all")
    assert len(r2.json()) == 0


# ═══════════════════ GRAPH ═══════════════════

@pytest.mark.asyncio
async def test_graph_empty(client: AsyncClient):
    r = await client.get("/api/v1/assets/graph/data")
    assert r.status_code == 200
    data = r.json()
    assert data["nodes"] == []
    assert data["edges"] == []


@pytest.mark.asyncio
async def test_graph_with_relationships(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    a1 = (await client.post("/api/v1/assets", json={"name": "App", "org_unit_id": unit_id})).json()
    a2 = (await client.post("/api/v1/assets", json={"name": "DB", "org_unit_id": unit_id})).json()

    await client.post("/api/v1/assets/relationships", json={
        "source_asset_id": a1["id"], "target_asset_id": a2["id"],
        "relationship_type": "depends_on",
    })

    r = await client.get("/api/v1/assets/graph/data")
    assert r.status_code == 200
    data = r.json()
    assert len(data["nodes"]) == 2
    assert len(data["edges"]) >= 1
    node_names = {n["name"] for n in data["nodes"]}
    assert "App" in node_names
    assert "DB" in node_names
