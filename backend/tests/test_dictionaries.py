"""Functional tests — Dictionary CRUD module."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_empty(client: AsyncClient):
    r = await client.get("/api/v1/dictionaries")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_list_with_seed(client: AsyncClient, seed_dicts):
    r = await client.get("/api/v1/dictionaries")
    assert r.status_code == 200
    data = r.json()
    codes = {d["code"] for d in data}
    assert "risk_status" in codes
    assert "risk_category" in codes
    assert "action_priority" in codes


@pytest.mark.asyncio
async def test_get_entries(client: AsyncClient, seed_dicts):
    r = await client.get("/api/v1/dictionaries/risk_status/entries")
    assert r.status_code == 200
    data = r.json()
    assert data["code"] == "risk_status"
    labels = {e["label"] for e in data["entries"]}
    assert "Otwarty" in labels
    assert "Zamkniete" in labels


@pytest.mark.asyncio
async def test_get_entries_404(client: AsyncClient):
    r = await client.get("/api/v1/dictionaries/nonexistent/entries")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_create_entry(client: AsyncClient, seed_dicts):
    r = await client.post("/api/v1/dictionaries/risk_status/entries", json={
        "code": "in_review",
        "label": "W przeglądzie",
        "sort_order": 10,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["code"] == "in_review"
    assert data["label"] == "W przeglądzie"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_update_entry(client: AsyncClient, seed_dicts):
    entry_id = seed_dicts["risk_status"]["open"]
    r = await client.put(f"/api/v1/dictionaries/entries/{entry_id}", json={
        "label": "Otwarty (zmieniony)",
    })
    assert r.status_code == 200
    assert r.json()["label"] == "Otwarty (zmieniony)"


@pytest.mark.asyncio
async def test_archive_entry(client: AsyncClient, seed_dicts):
    entry_id = seed_dicts["risk_status"]["open"]
    r = await client.patch(f"/api/v1/dictionaries/entries/{entry_id}/archive")
    assert r.status_code == 200
    assert r.json()["is_active"] is False

    # Verify archived entry hidden by default
    r2 = await client.get("/api/v1/dictionaries/risk_status/entries")
    ids = [e["id"] for e in r2.json()["entries"]]
    assert entry_id not in ids

    # Verify visible with include_archived
    r3 = await client.get("/api/v1/dictionaries/risk_status/entries?include_archived=true")
    ids_all = [e["id"] for e in r3.json()["entries"]]
    assert entry_id in ids_all


@pytest.mark.asyncio
async def test_reorder_entries(client: AsyncClient, seed_dicts):
    ids = seed_dicts["risk_status"]
    r = await client.put("/api/v1/dictionaries/entries/reorder", json={
        "items": [
            {"id": ids["open"], "sort_order": 99},
            {"id": ids["closed"], "sort_order": 1},
        ]
    })
    assert r.status_code == 200
    assert r.json()["updated"] == 2
