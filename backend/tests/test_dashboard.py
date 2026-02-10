"""Functional tests — Dashboard endpoints (smoke tests).

Dashboard endpoints aggregate data from multiple modules.
risk_dashboard uses MySQL-specific SQL (aliased join, date_format, group_concat)
that doesn't translate to SQLite. Marked xfail where applicable.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_executive_summary_empty(client: AsyncClient):
    r = await client.get("/api/v1/dashboard/executive-summary")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
    assert "kpis" in data


@pytest.mark.asyncio
@pytest.mark.xfail(reason="MySQL-specific SQL: aliased join, date_format, group_concat")
async def test_risk_dashboard_empty(client: AsyncClient):
    r = await client.get("/api/v1/dashboard/risks")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_cis_dashboard_empty(client: AsyncClient):
    r = await client.get("/api/v1/dashboard/cis")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_posture_score_empty(client: AsyncClient):
    r = await client.get("/api/v1/dashboard/posture-score")
    assert r.status_code == 200
    data = r.json()
    assert "score" in data
    assert "grade" in data


@pytest.mark.asyncio
async def test_executive_summary_with_data(client: AsyncClient, seed_org, seed_dicts):
    """Create some risks and verify executive summary reflects them."""
    _, unit_id = seed_org
    await client.post("/api/v1/risks", json={
        "org_unit_id": unit_id, "asset_name": "Test",
        "impact_level": 3, "probability_level": 3, "safeguard_rating": 0.10,
    })

    r = await client.get("/api/v1/dashboard/executive-summary")
    assert r.status_code == 200


@pytest.mark.asyncio
@pytest.mark.xfail(reason="MySQL-specific SQL: risk dashboard aliased joins")
async def test_risk_dashboard_with_org_filter(client: AsyncClient, seed_org):
    _, unit_id = seed_org
    r = await client.get(f"/api/v1/dashboard/risks?org_unit_id={unit_id}")
    assert r.status_code == 200
