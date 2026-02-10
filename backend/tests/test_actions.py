"""Functional tests — Actions module with polymorphic linking + change history."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_action_minimal(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    r = await client.post("/api/v1/actions", json={
        "title": "Wdrozenie MFA",
        "org_unit_id": unit_id,
        "owner": "Jan Kowalski",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Wdrozenie MFA"
    assert data["org_unit_name"] == "IT"
    assert data["is_active"] is True
    assert data["is_overdue"] is False


@pytest.mark.asyncio
async def test_create_action_with_links(client: AsyncClient, seed_org, seed_catalog):
    _, unit_id = seed_org
    # Create a risk to link to
    risk_r = await client.post("/api/v1/risks", json={
        "org_unit_id": unit_id,
        "asset_name": "Test",
        "impact_level": 1,
        "probability_level": 1,
        "safeguard_rating": 0.25,
    })
    risk_id = risk_r.json()["id"]

    r = await client.post("/api/v1/actions", json={
        "title": "Redukcja ryzyka",
        "org_unit_id": unit_id,
        "links": [
            {"entity_type": "risk", "entity_id": risk_id},
        ],
    })
    assert r.status_code == 201
    data = r.json()
    assert len(data["links"]) == 1
    assert data["links"][0]["entity_type"] == "risk"
    assert data["links"][0]["entity_id"] == risk_id
    assert data["links"][0]["entity_name"] == "Test"


@pytest.mark.asyncio
async def test_list_actions(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    await client.post("/api/v1/actions", json={"title": "A1", "org_unit_id": unit_id})
    await client.post("/api/v1/actions", json={"title": "A2", "org_unit_id": unit_id})

    r = await client.get("/api/v1/actions")
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_list_actions_filter_by_entity(client: AsyncClient, seed_org):
    """Filter actions by linked entity."""
    _, unit_id = seed_org
    risk_r = await client.post("/api/v1/risks", json={
        "org_unit_id": unit_id, "asset_name": "X",
        "impact_level": 1, "probability_level": 1, "safeguard_rating": 0.25,
    })
    risk_id = risk_r.json()["id"]

    await client.post("/api/v1/actions", json={
        "title": "Linked", "org_unit_id": unit_id,
        "links": [{"entity_type": "risk", "entity_id": risk_id}],
    })
    await client.post("/api/v1/actions", json={
        "title": "Unlinked", "org_unit_id": unit_id,
    })

    r = await client.get(f"/api/v1/actions?entity_type=risk&entity_id={risk_id}")
    assert len(r.json()) == 1
    assert r.json()[0]["title"] == "Linked"


@pytest.mark.asyncio
async def test_get_action(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/actions", json={"title": "Test", "org_unit_id": unit_id})
    action_id = cr.json()["id"]

    r = await client.get(f"/api/v1/actions/{action_id}")
    assert r.status_code == 200
    assert r.json()["title"] == "Test"


@pytest.mark.asyncio
async def test_get_action_404(client: AsyncClient):
    r = await client.get("/api/v1/actions/9999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_action_with_change_tracking(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/actions", json={
        "title": "Original",
        "org_unit_id": unit_id,
        "owner": "Adam",
    })
    action_id = cr.json()["id"]

    r = await client.put(f"/api/v1/actions/{action_id}", json={
        "title": "Updated",
        "owner": "Basia",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Updated"
    assert data["owner"] == "Basia"

    # Verify change history
    assert len(data["history"]) >= 2
    changed_fields = {h["field_name"] for h in data["history"]}
    assert "title" in changed_fields
    assert "owner" in changed_fields


@pytest.mark.asyncio
async def test_close_action_with_effectiveness(client: AsyncClient, seed_org, seed_dicts):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/actions", json={
        "title": "Do zamkniecia",
        "org_unit_id": unit_id,
    })
    action_id = cr.json()["id"]

    r = await client.post(f"/api/v1/actions/{action_id}/close", json={
        "effectiveness_rating": 4,
        "effectiveness_notes": "Wdrozenie skuteczne, wymaga monitoringu",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["effectiveness_rating"] == 4
    assert data["effectiveness_notes"] == "Wdrozenie skuteczne, wymaga monitoringu"
    assert data["completed_at"] is not None


@pytest.mark.asyncio
async def test_archive_action(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/actions", json={"title": "X", "org_unit_id": unit_id})
    action_id = cr.json()["id"]

    r = await client.delete(f"/api/v1/actions/{action_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "archived"

    # Not in active list
    r2 = await client.get("/api/v1/actions")
    assert all(a["id"] != action_id for a in r2.json())


@pytest.mark.asyncio
async def test_update_links(client: AsyncClient, seed_org):
    """Links can be replaced on update."""
    _, unit_id = seed_org
    a1 = (await client.post("/api/v1/assets", json={"name": "Asset1", "org_unit_id": unit_id})).json()

    cr = await client.post("/api/v1/actions", json={
        "title": "With links",
        "org_unit_id": unit_id,
        "links": [{"entity_type": "asset", "entity_id": a1["id"]}],
    })
    action_id = cr.json()["id"]
    assert len(cr.json()["links"]) == 1

    # Replace links with empty
    r = await client.put(f"/api/v1/actions/{action_id}", json={"links": []})
    assert len(r.json()["links"]) == 0
