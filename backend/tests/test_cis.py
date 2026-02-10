"""Functional tests — CIS Benchmark: Controls, Assessments, Answers."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cis import CisControl, CisSubControl


@pytest.fixture
async def seed_cis(db: AsyncSession):
    """Create minimal CIS controls + sub-controls for tests."""
    c1 = CisControl(control_number=1, name_en="Inventory and Control", name_pl="Inwentaryzacja", sub_control_count=2)
    db.add(c1)
    await db.flush()

    sc1 = CisSubControl(
        control_id=c1.id, sub_id="1.1",
        detail_en="Use passive asset discovery",
        detail_pl="Pasywne odkrywanie aktywow",
        implementation_groups="1,2,3",
    )
    sc2 = CisSubControl(
        control_id=c1.id, sub_id="1.2",
        detail_en="Use active asset discovery",
        detail_pl="Aktywne odkrywanie aktywow",
        implementation_groups="2,3",
    )
    db.add_all([sc1, sc2])
    await db.commit()
    return c1.id, sc1.id, sc2.id


@pytest.mark.asyncio
async def test_list_controls(client: AsyncClient, seed_cis):
    r = await client.get("/api/v1/cis/controls")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["control_number"] == 1
    assert data[0]["name_pl"] == "Inwentaryzacja"
    assert len(data[0]["sub_controls"]) == 2


# ═══════════════════ ASSESSMENTS ═══════════════════

@pytest.mark.asyncio
async def test_create_assessment(client: AsyncClient, seed_org, seed_cis):
    _, unit_id = seed_org
    r = await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id,
        "assessor_name": "Audytor Jan",
        "notes": "Przeglad kwartalny Q1",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["org_unit_name"] == "IT"
    assert data["assessor_name"] == "Audytor Jan"
    assert data["notes"] == "Przeglad kwartalny Q1"


@pytest.mark.asyncio
async def test_list_assessments(client: AsyncClient, seed_org, seed_cis):
    _, unit_id = seed_org
    await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id, "assessor_name": "A",
    })
    await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id, "assessor_name": "B",
    })

    r = await client.get("/api/v1/cis/assessments")
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_list_assessments_filter_org(client: AsyncClient, seed_org, seed_cis):
    _, unit_id = seed_org
    await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id, "assessor_name": "Test",
    })

    r = await client.get(f"/api/v1/cis/assessments?org_unit_id={unit_id}")
    assert len(r.json()) == 1

    r2 = await client.get("/api/v1/cis/assessments?org_unit_id=9999")
    assert len(r2.json()) == 0


@pytest.mark.asyncio
async def test_get_assessment(client: AsyncClient, seed_org, seed_cis):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id, "assessor_name": "Test",
    })
    assessment_id = cr.json()["id"]

    r = await client.get(f"/api/v1/cis/assessments/{assessment_id}")
    assert r.status_code == 200
    assert r.json()["id"] == assessment_id


@pytest.mark.asyncio
async def test_update_assessment(client: AsyncClient, seed_org, seed_cis):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id, "assessor_name": "Test",
    })
    assessment_id = cr.json()["id"]

    r = await client.put(f"/api/v1/cis/assessments/{assessment_id}", json={
        "notes": "Zaktualizowane notatki",
    })
    assert r.status_code == 200
    assert r.json()["notes"] == "Zaktualizowane notatki"


@pytest.mark.asyncio
async def test_delete_assessment(client: AsyncClient, seed_org, seed_cis):
    _, unit_id = seed_org
    cr = await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id, "assessor_name": "Test",
    })
    assessment_id = cr.json()["id"]

    r = await client.delete(f"/api/v1/cis/assessments/{assessment_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "deleted"

    # Verify gone
    r2 = await client.get(f"/api/v1/cis/assessments/{assessment_id}")
    assert r2.status_code == 404


# ═══════════════════ ANSWERS ═══════════════════

@pytest.mark.asyncio
async def test_upsert_answers(client: AsyncClient, seed_org, seed_cis):
    _, unit_id = seed_org
    _, sc1_id, sc2_id = seed_cis

    cr = await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id, "assessor_name": "Audytor",
    })
    assessment_id = cr.json()["id"]

    # Insert answers
    r = await client.post(f"/api/v1/cis/assessments/{assessment_id}/answers", json={
        "answers": [
            {
                "sub_control_id": sc1_id,
                "policy_value": 1.0,
                "impl_value": 0.75,
                "auto_value": 0.5,
                "report_value": 0.5,
            },
            {
                "sub_control_id": sc2_id,
                "policy_value": 0.0,
                "impl_value": 0.0,
                "auto_value": 0.0,
                "report_value": 0.0,
            },
        ]
    })
    assert r.status_code == 200
    data = r.json()
    assert data["created"] == 2
    assert data["updated"] == 0

    # Verify answers
    r2 = await client.get(f"/api/v1/cis/assessments/{assessment_id}/answers")
    assert r2.status_code == 200
    answers = r2.json()
    assert len(answers) == 2

    # Update answer
    r3 = await client.post(f"/api/v1/cis/assessments/{assessment_id}/answers", json={
        "answers": [
            {
                "sub_control_id": sc1_id,
                "policy_value": 1.0,
                "impl_value": 1.0,
                "auto_value": 1.0,
                "report_value": 1.0,
            },
        ]
    })
    assert r3.json()["updated"] == 1
    assert r3.json()["created"] == 0


@pytest.mark.asyncio
async def test_answers_update_scores(client: AsyncClient, seed_org, seed_cis):
    """Answering questions should recalculate assessment scores."""
    _, unit_id = seed_org
    _, sc1_id, sc2_id = seed_cis

    cr = await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id, "assessor_name": "Test",
    })
    assessment_id = cr.json()["id"]

    # Submit perfect scores for all sub-controls
    await client.post(f"/api/v1/cis/assessments/{assessment_id}/answers", json={
        "answers": [
            {"sub_control_id": sc1_id, "policy_value": 1.0, "impl_value": 1.0, "auto_value": 1.0, "report_value": 1.0},
            {"sub_control_id": sc2_id, "policy_value": 1.0, "impl_value": 1.0, "auto_value": 1.0, "report_value": 1.0},
        ]
    })

    # Check that scores were calculated
    r = await client.get(f"/api/v1/cis/assessments/{assessment_id}")
    data = r.json()
    assert data["risk_addressed_pct"] is not None
    assert data["risk_addressed_pct"] == 100.0
    assert data["maturity_rating"] == 5.0


@pytest.mark.asyncio
async def test_copy_assessment(client: AsyncClient, seed_org, seed_cis):
    """Test copying answers from a previous assessment."""
    _, unit_id = seed_org
    _, sc1_id, _ = seed_cis

    # Create first assessment with answers
    cr1 = await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id, "assessor_name": "First",
    })
    a1_id = cr1.json()["id"]
    await client.post(f"/api/v1/cis/assessments/{a1_id}/answers", json={
        "answers": [{"sub_control_id": sc1_id, "policy_value": 0.5, "impl_value": 0.5, "auto_value": 0.5, "report_value": 0.5}],
    })

    # Create second assessment copying from first
    cr2 = await client.post("/api/v1/cis/assessments", json={
        "org_unit_id": unit_id,
        "assessor_name": "Second",
        "copy_from_assessment_id": a1_id,
    })
    a2_id = cr2.json()["id"]

    # Verify answers were copied
    r = await client.get(f"/api/v1/cis/assessments/{a2_id}/answers")
    assert len(r.json()) == 1
    assert r.json()[0]["policy_value"] == 0.5
