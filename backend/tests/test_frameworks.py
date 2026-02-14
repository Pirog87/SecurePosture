"""Tests for the Framework Engine — frameworks, nodes, dimensions, assessments, scoring."""
import io
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.framework import (
    AssessmentDimension, DimensionLevel, Framework, FrameworkNode,
    FrameworkNodeSecurityArea, Assessment, AssessmentAnswer,
)
from app.models.security_area import SecurityDomain


# ── Seed helpers ──

@pytest_asyncio.fixture
async def seed_framework(db: AsyncSession):
    """Create a minimal framework with 2 controls, 4 sub-controls, 1 dimension, 4 levels."""
    fw = Framework(
        urn="urn:test:framework:test-fw",
        ref_id="test-fw",
        name="Test Framework",
        version="1.0",
        provider="TestCo",
        source_format="manual",
        total_nodes=6,
        total_assessable=4,
    )
    db.add(fw)
    await db.flush()

    # Control 1 (section, not assessable)
    c1 = FrameworkNode(
        framework_id=fw.id, ref_id="1", name="Control 1", depth=1, order_id=1, assessable=False,
    )
    db.add(c1)
    await db.flush()

    # Sub-controls 1.1, 1.2 (assessable)
    sc11 = FrameworkNode(
        framework_id=fw.id, parent_id=c1.id, ref_id="1.1", name="Sub 1.1",
        depth=2, order_id=1, assessable=True, implementation_groups="IG1,IG2",
    )
    sc12 = FrameworkNode(
        framework_id=fw.id, parent_id=c1.id, ref_id="1.2", name="Sub 1.2",
        depth=2, order_id=2, assessable=True, implementation_groups="IG1",
    )
    db.add_all([sc11, sc12])
    await db.flush()

    # Control 2
    c2 = FrameworkNode(
        framework_id=fw.id, ref_id="2", name="Control 2", depth=1, order_id=2, assessable=False,
    )
    db.add(c2)
    await db.flush()

    # Sub-controls 2.1, 2.2
    sc21 = FrameworkNode(
        framework_id=fw.id, parent_id=c2.id, ref_id="2.1", name="Sub 2.1",
        depth=2, order_id=1, assessable=True, implementation_groups="IG2,IG3",
    )
    sc22 = FrameworkNode(
        framework_id=fw.id, parent_id=c2.id, ref_id="2.2", name="Sub 2.2",
        depth=2, order_id=2, assessable=True, implementation_groups="IG1,IG2,IG3",
    )
    db.add_all([sc21, sc22])
    await db.flush()

    # One dimension: Compliance Level
    dim = AssessmentDimension(
        framework_id=fw.id, dimension_key="compliance", name="Compliance Level",
        name_pl="Poziom zgodności", order_id=1,
    )
    db.add(dim)
    await db.flush()

    # 4 levels
    for order, value, label in [
        (0, 0.00, "None"), (1, 0.33, "Partial"), (2, 0.66, "Largely"), (3, 1.00, "Full"),
    ]:
        db.add(DimensionLevel(
            dimension_id=dim.id, level_order=order, value=value, label=label,
        ))
    await db.flush()

    fw.implementation_groups_definition = {"IG1": "Basic", "IG2": "Medium", "IG3": "Advanced"}
    await db.commit()

    return {
        "fw_id": fw.id,
        "c1_id": c1.id, "c2_id": c2.id,
        "sc11_id": sc11.id, "sc12_id": sc12.id,
        "sc21_id": sc21.id, "sc22_id": sc22.id,
        "dim_id": dim.id,
    }


@pytest_asyncio.fixture
async def seed_area(db: AsyncSession):
    area = SecurityDomain(name="Network", code="NET", sort_order=1)
    db.add(area)
    await db.commit()
    return area.id


# ═══════════════════════════════════════════════
# FRAMEWORK CRUD
# ═══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_list_frameworks(client: AsyncClient, seed_framework):
    r = await client.get("/api/v1/frameworks")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test Framework"
    assert data[0]["total_assessable"] == 4


@pytest.mark.asyncio
async def test_get_framework(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.get(f"/api/v1/frameworks/{fw_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["ref_id"] == "test-fw"
    assert len(data["dimensions"]) == 1
    assert len(data["dimensions"][0]["levels"]) == 4


@pytest.mark.asyncio
async def test_framework_not_found(client: AsyncClient):
    r = await client.get("/api/v1/frameworks/999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_framework(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.delete(f"/api/v1/frameworks/{fw_id}")
    assert r.status_code == 200
    # Should be archived, not deleted
    r2 = await client.get("/api/v1/frameworks?is_active=true")
    assert len(r2.json()) == 0


# ═══════════════════════════════════════════════
# FRAMEWORK TREE & NODES
# ═══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_framework_tree(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.get(f"/api/v1/frameworks/{fw_id}/tree")
    assert r.status_code == 200
    tree = r.json()
    assert len(tree) == 2  # 2 root controls
    assert len(tree[0]["children"]) == 2  # control 1 has 2 sub-controls
    assert tree[0]["children"][0]["assessable"] is True


@pytest.mark.asyncio
async def test_list_assessable_nodes(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.get(f"/api/v1/frameworks/{fw_id}/nodes?assessable=true")
    assert r.status_code == 200
    assert len(r.json()) == 4


@pytest.mark.asyncio
async def test_list_nodes_ig_filter(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.get(f"/api/v1/frameworks/{fw_id}/nodes?assessable=true&ig=IG1")
    assert r.status_code == 200
    # IG1: 1.1, 1.2, 2.2 → 3 nodes
    assert len(r.json()) == 3


@pytest.mark.asyncio
async def test_list_nodes_ig3_filter(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.get(f"/api/v1/frameworks/{fw_id}/nodes?assessable=true&ig=IG3")
    assert r.status_code == 200
    # IG3: 2.1, 2.2 → 2 nodes
    assert len(r.json()) == 2


# ═══════════════════════════════════════════════
# DIMENSIONS
# ═══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_get_dimensions(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.get(f"/api/v1/frameworks/{fw_id}/dimensions")
    assert r.status_code == 200
    dims = r.json()
    assert len(dims) == 1
    assert dims[0]["dimension_key"] == "compliance"
    assert len(dims[0]["levels"]) == 4


# ═══════════════════════════════════════════════
# AREA MAPPINGS
# ═══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_area_mappings_crud(client: AsyncClient, seed_framework, seed_area):
    fw_id = seed_framework["fw_id"]
    node_ids = [seed_framework["sc11_id"], seed_framework["sc12_id"]]

    # Bulk create
    r = await client.post(f"/api/v1/frameworks/{fw_id}/area-mappings/bulk", json={
        "framework_node_ids": node_ids,
        "security_area_id": seed_area,
        "source": "manual",
    })
    assert r.status_code == 200
    assert r.json()["created"] == 2

    # List
    r2 = await client.get(f"/api/v1/frameworks/{fw_id}/area-mappings")
    assert r2.status_code == 200
    assert len(r2.json()) == 2

    # Delete one
    r3 = await client.delete(f"/api/v1/frameworks/nodes/{node_ids[0]}/areas/{seed_area}")
    assert r3.status_code == 200

    # Verify one left
    r4 = await client.get(f"/api/v1/frameworks/{fw_id}/area-mappings")
    assert len(r4.json()) == 1


# ═══════════════════════════════════════════════
# ASSESSMENTS CRUD
# ═══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_create_assessment(client: AsyncClient, seed_framework, seed_org):
    _, org_id = seed_org
    fw_id = seed_framework["fw_id"]
    r = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id,
        "org_unit_id": org_id,
        "title": "Test Assessment Q1",
        "assessor": "Jan",
        "assessment_date": "2026-01-15",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["framework_name"] == "Test Framework"
    assert data["status"] == "draft"
    assert data["ref_id"].startswith("ASM-")


@pytest.mark.asyncio
async def test_list_assessments(client: AsyncClient, seed_framework, seed_org):
    _, org_id = seed_org
    fw_id = seed_framework["fw_id"]
    # Create two
    await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "A1", "assessment_date": "2026-01-01",
    })
    await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "org_unit_id": org_id, "title": "A2", "assessment_date": "2026-02-01",
    })
    r = await client.get("/api/v1/assessments")
    assert r.status_code == 200
    assert len(r.json()) == 2

    # Filter by framework
    r2 = await client.get(f"/api/v1/assessments?framework_id={fw_id}")
    assert len(r2.json()) == 2

    # Filter by org_unit
    r3 = await client.get(f"/api/v1/assessments?org_unit_id={org_id}")
    assert len(r3.json()) == 1


@pytest.mark.asyncio
async def test_assessment_pre_generates_answers(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "Test", "assessment_date": "2026-01-15",
    })
    assert r.status_code == 201
    assessment_id = r.json()["id"]

    # Should have 4 nodes × 1 dimension = 4 answers pre-generated
    r2 = await client.get(f"/api/v1/assessments/{assessment_id}/answers")
    assert r2.status_code == 200
    assert len(r2.json()) == 4


@pytest.mark.asyncio
async def test_assessment_ig_filter(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "IG3 only",
        "assessment_date": "2026-01-15",
        "implementation_group_filter": "IG3",
    })
    assert r.status_code == 201
    assessment_id = r.json()["id"]

    # IG3: only 2.1 and 2.2 → 2 answers
    r2 = await client.get(f"/api/v1/assessments/{assessment_id}/answers")
    assert len(r2.json()) == 2


# ═══════════════════════════════════════════════
# ANSWERS & SCORING
# ═══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_upsert_answers_and_score(client: AsyncClient, seed_framework, db: AsyncSession):
    fw_id = seed_framework["fw_id"]

    # Get dimension and levels
    r_dims = await client.get(f"/api/v1/frameworks/{fw_id}/dimensions")
    dim = r_dims.json()[0]
    dim_id = dim["id"]
    levels = {l["label"]: l["id"] for l in dim["levels"]}

    # Create assessment
    r = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "Scoring Test", "assessment_date": "2026-01-15",
    })
    assessment_id = r.json()["id"]

    # Set answers: all 4 nodes at "Full" (1.00)
    answers = []
    for node_id in [
        seed_framework["sc11_id"], seed_framework["sc12_id"],
        seed_framework["sc21_id"], seed_framework["sc22_id"],
    ]:
        answers.append({
            "framework_node_id": node_id,
            "dimension_id": dim_id,
            "level_id": levels["Full"],
        })

    r2 = await client.put(f"/api/v1/assessments/{assessment_id}/answers", json={
        "answers": answers,
    })
    assert r2.status_code == 200
    assert r2.json()["overall_score"] == 100.0
    assert r2.json()["completion_pct"] == 100.0


@pytest.mark.asyncio
async def test_scoring_partial(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]

    r_dims = await client.get(f"/api/v1/frameworks/{fw_id}/dimensions")
    dim = r_dims.json()[0]
    dim_id = dim["id"]
    levels = {l["label"]: l["id"] for l in dim["levels"]}

    r = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "Partial", "assessment_date": "2026-01-15",
    })
    assessment_id = r.json()["id"]

    # 1.1 = Full (1.0), 1.2 = Partial (0.33), 2.1 = N/A, 2.2 = None (no answer)
    answers = [
        {"framework_node_id": seed_framework["sc11_id"], "dimension_id": dim_id, "level_id": levels["Full"]},
        {"framework_node_id": seed_framework["sc12_id"], "dimension_id": dim_id, "level_id": levels["Partial"]},
        {"framework_node_id": seed_framework["sc21_id"], "dimension_id": dim_id, "not_applicable": True},
    ]
    r2 = await client.put(f"/api/v1/assessments/{assessment_id}/answers", json={"answers": answers})
    assert r2.status_code == 200

    # Check score details
    r3 = await client.get(f"/api/v1/assessments/{assessment_id}/score")
    score_data = r3.json()
    assert score_data["na_count"] == 1
    assert score_data["answered_count"] == 2
    # Overall = avg(100.0, 33.0) = 66.5 (only 2 answered out of 3 effective)
    assert score_data["overall_score"] == 66.5


@pytest.mark.asyncio
async def test_scoring_with_na(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]

    r_dims = await client.get(f"/api/v1/frameworks/{fw_id}/dimensions")
    dim = r_dims.json()[0]
    dim_id = dim["id"]
    levels = {l["label"]: l["id"] for l in dim["levels"]}

    r = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "NA Test", "assessment_date": "2026-01-15",
    })
    assessment_id = r.json()["id"]

    # All N/A
    answers = [
        {"framework_node_id": nid, "dimension_id": dim_id, "not_applicable": True}
        for nid in [seed_framework["sc11_id"], seed_framework["sc12_id"],
                     seed_framework["sc21_id"], seed_framework["sc22_id"]]
    ]
    r2 = await client.put(f"/api/v1/assessments/{assessment_id}/answers", json={"answers": answers})
    assert r2.status_code == 200

    r3 = await client.get(f"/api/v1/assessments/{assessment_id}/score")
    score_data = r3.json()
    assert score_data["na_count"] == 4
    assert score_data["overall_score"] is None


@pytest.mark.asyncio
async def test_approve_assessment(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "Approve Test", "assessment_date": "2026-01-15",
    })
    assessment_id = r.json()["id"]

    r2 = await client.post(f"/api/v1/assessments/{assessment_id}/approve?approved_by=CISO")
    assert r2.status_code == 200
    assert r2.json()["status"] == "approved"
    assert r2.json()["approved_by"] == "CISO"


@pytest.mark.asyncio
async def test_compare_assessments(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]
    r1 = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "A1", "assessment_date": "2026-01-01",
    })
    r2 = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "A2", "assessment_date": "2026-02-01",
    })
    id1 = r1.json()["id"]
    id2 = r2.json()["id"]

    r3 = await client.get(f"/api/v1/assessments/compare?ids={id1},{id2}")
    assert r3.status_code == 200
    data = r3.json()
    assert len(data["assessments"]) == 2
    assert len(data["scores"]) == 2


@pytest.mark.asyncio
async def test_ig_scores(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]

    r_dims = await client.get(f"/api/v1/frameworks/{fw_id}/dimensions")
    dim = r_dims.json()[0]
    dim_id = dim["id"]
    levels = {l["label"]: l["id"] for l in dim["levels"]}

    r = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "IG Score Test", "assessment_date": "2026-01-15",
    })
    assessment_id = r.json()["id"]

    # 1.1 (IG1,IG2)=Full, 1.2 (IG1)=Partial, 2.1 (IG2,IG3)=Largely, 2.2 (IG1,IG2,IG3)=Full
    answers = [
        {"framework_node_id": seed_framework["sc11_id"], "dimension_id": dim_id, "level_id": levels["Full"]},
        {"framework_node_id": seed_framework["sc12_id"], "dimension_id": dim_id, "level_id": levels["Partial"]},
        {"framework_node_id": seed_framework["sc21_id"], "dimension_id": dim_id, "level_id": levels["Largely"]},
        {"framework_node_id": seed_framework["sc22_id"], "dimension_id": dim_id, "level_id": levels["Full"]},
    ]
    await client.put(f"/api/v1/assessments/{assessment_id}/answers", json={"answers": answers})

    r3 = await client.get(f"/api/v1/assessments/{assessment_id}/score")
    score_data = r3.json()
    ig_scores = score_data["ig_scores"]

    # IG1: 1.1(100) + 1.2(33) + 2.2(100) → avg = 77.7
    assert "IG1" in ig_scores
    assert ig_scores["IG1"] == 77.7

    # IG2: 1.1(100) + 2.1(66) + 2.2(100) → avg = 88.7
    assert ig_scores["IG2"] == 88.7

    # IG3: 2.1(66) + 2.2(100) → avg = 83.0
    assert ig_scores["IG3"] == 83.0


# ═══════════════════════════════════════════════
# IMPORT (YAML)
# ═══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_import_yaml(client: AsyncClient):
    yaml_content = """
urn: urn:test:risk:framework:test-yaml
ref_id: test-yaml
name: Test YAML Framework
description: A test framework from YAML
version: "1.0"
provider: TestProvider
requirement_nodes:
  - urn: urn:test:risk:req_node:test-yaml:1
    assessable: false
    depth: 1
    ref_id: "1"
    name: "Section 1"
    children:
      - urn: urn:test:risk:req_node:test-yaml:1.1
        assessable: true
        depth: 2
        ref_id: "1.1"
        name: "Requirement 1.1"
        implementation_groups: "IG1,IG2"
      - urn: urn:test:risk:req_node:test-yaml:1.2
        assessable: true
        depth: 2
        ref_id: "1.2"
        name: "Requirement 1.2"
  - urn: urn:test:risk:req_node:test-yaml:2
    assessable: false
    depth: 1
    ref_id: "2"
    name: "Section 2"
    children:
      - urn: urn:test:risk:req_node:test-yaml:2.1
        assessable: true
        depth: 2
        ref_id: "2.1"
        name: "Requirement 2.1"
"""
    files = {"file": ("test.yaml", io.BytesIO(yaml_content.encode()), "application/x-yaml")}
    r = await client.post("/api/v1/frameworks/import/yaml", files=files)
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Test YAML Framework"
    assert data["total_nodes"] == 5  # 2 sections + 3 requirements
    assert data["total_assessable"] == 3
    assert data["dimensions_created"] == 1  # default dimension

    # Verify tree
    fw_id = data["framework_id"]
    r2 = await client.get(f"/api/v1/frameworks/{fw_id}/tree")
    tree = r2.json()
    assert len(tree) == 2
    assert len(tree[0]["children"]) == 2


@pytest.mark.asyncio
async def test_import_yaml_duplicate_urn_reimport(client: AsyncClient):
    yaml_content = """
urn: urn:test:risk:framework:dupe
ref_id: dupe
name: Dupe Framework
requirement_nodes:
  - assessable: true
    depth: 1
    ref_id: "1"
    name: "Req 1"
"""
    files = {"file": ("test.yaml", io.BytesIO(yaml_content.encode()), "application/x-yaml")}
    r1 = await client.post("/api/v1/frameworks/import/yaml", files=files)
    assert r1.status_code == 200
    fw_id = r1.json()["framework_id"]

    # Second import with same URN re-imports (updates existing framework)
    files2 = {"file": ("test2.yaml", io.BytesIO(yaml_content.encode()), "application/x-yaml")}
    r2 = await client.post("/api/v1/frameworks/import/yaml", files=files2)
    assert r2.status_code == 200
    assert r2.json()["framework_id"] == fw_id  # Same framework ID (re-imported)


@pytest.mark.asyncio
async def test_copy_assessment(client: AsyncClient, seed_framework):
    fw_id = seed_framework["fw_id"]

    # Get dimensions and levels
    r_dims = await client.get(f"/api/v1/frameworks/{fw_id}/dimensions")
    dim = r_dims.json()[0]
    dim_id = dim["id"]
    full_level_id = next(l["id"] for l in dim["levels"] if l["label"] == "Full")

    # Create source assessment and fill answers
    r1 = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "Source", "assessment_date": "2026-01-01",
    })
    src_id = r1.json()["id"]

    answers = [
        {"framework_node_id": nid, "dimension_id": dim_id, "level_id": full_level_id}
        for nid in [seed_framework["sc11_id"], seed_framework["sc12_id"],
                     seed_framework["sc21_id"], seed_framework["sc22_id"]]
    ]
    await client.put(f"/api/v1/assessments/{src_id}/answers", json={"answers": answers})

    # Copy to new assessment
    r2 = await client.post("/api/v1/assessments", json={
        "framework_id": fw_id, "title": "Copy", "assessment_date": "2026-02-01",
        "copy_from_assessment_id": src_id,
    })
    assert r2.status_code == 201
    copy_id = r2.json()["id"]

    # Verify answers were copied
    r3 = await client.get(f"/api/v1/assessments/{copy_id}/answers")
    answers_data = r3.json()
    assert len(answers_data) == 4
    assert all(a["level_id"] == full_level_id for a in answers_data)


# ═══════════════════════════════════════════════
# ADOPTION FLOW (import → adopt → get detail)
# ═══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_adopt_framework_after_import(client: AsyncClient):
    """Import YAML, adopt with attributes, verify both adopt response and GET detail work."""
    yaml_content = """
urn: urn:test:adopt:framework
ref_id: adopt-test
name: Adopt Test Framework
version: "1.0"
provider: TestProvider
requirement_nodes:
  - urn: urn:test:adopt:req:1
    assessable: false
    depth: 1
    ref_id: "1"
    name: "Section 1"
    children:
      - urn: urn:test:adopt:req:1.1
        assessable: true
        depth: 2
        ref_id: "1.1"
        name: "Requirement 1.1"
"""
    # 1. Import
    files = {"file": ("test.yaml", io.BytesIO(yaml_content.encode()), "application/x-yaml")}
    r1 = await client.post("/api/v1/frameworks/import/yaml", files=files)
    assert r1.status_code == 200
    fw_id = r1.json()["framework_id"]

    # 2. Adopt — this used to fail with 500 (MissingGreenlet on dimensions)
    adopt_body = {
        "name": "My Adopted Document",
        "document_origin": "external",
        "owner": "John Doe",
        "requires_review": False,
        "review_frequency_months": 12,
    }
    r2 = await client.put(f"/api/v1/frameworks/{fw_id}/adopt", json=adopt_body)
    assert r2.status_code == 200
    data = r2.json()
    assert data["name"] == "My Adopted Document"
    assert data["owner"] == "John Doe"
    assert len(data["dimensions"]) >= 1

    # 3. GET detail — should also work
    r3 = await client.get(f"/api/v1/frameworks/{fw_id}")
    assert r3.status_code == 200
    detail = r3.json()
    assert detail["name"] == "My Adopted Document"
    assert detail["owner"] == "John Doe"
    assert len(detail["dimensions"]) >= 1


# ═══════════════════════════════════════════════
# LIVE CISO ASSISTANT FRAMEWORK IMPORT TESTS
# (download real YAMLs from GitHub, full flow)
# ═══════════════════════════════════════════════

import httpx as _httpx


GITHUB_RAW_BASE = (
    "https://raw.githubusercontent.com/intuitem/ciso-assistant-community"
    "/main/backend/library/libraries"
)

# Small, well-structured YAML frameworks from the CISO Assistant repo.
# Each tuple: (filename, min_expected_nodes, has_implementation_groups)
CISO_YAML_FRAMEWORKS = [
    ("asf-baseline-v2.yaml", 10, False),
    ("google-saif.yaml", 5, True),
    ("nist-ai-rmf-1.0.yaml", 10, False),
]


async def _download_yaml(filename: str) -> bytes | None:
    """Download a YAML file from CISO Assistant GitHub repo.

    Returns the raw bytes, or None if the download fails (network error, 404, etc.).
    """
    url = f"{GITHUB_RAW_BASE}/{filename}"
    try:
        async with _httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception:
        return None


@pytest.mark.asyncio
async def test_live_ciso_yaml_import_adopt_detail(client: AsyncClient):
    """Download real CISO Assistant YAML files from GitHub and run the full
    import -> adopt -> GET detail -> GET tree flow for each.

    Skips gracefully if GitHub is unreachable.
    """
    # Pre-flight: check if GitHub is reachable at all
    probe = await _download_yaml(CISO_YAML_FRAMEWORKS[0][0])
    if probe is None:
        pytest.skip("GitHub is unreachable -- skipping live CISO import test")

    imported_fw_ids: list[int] = []

    for filename, min_nodes, has_ig in CISO_YAML_FRAMEWORKS:
        # ── 1. Download YAML ──
        raw = await _download_yaml(filename)
        if raw is None:
            # Individual file missing -- skip this framework, continue others
            continue

        assert len(raw) > 100, f"{filename}: downloaded content too small ({len(raw)} bytes)"

        # ── 2. Import via POST /api/v1/frameworks/import/yaml ──
        files = {"file": (filename, io.BytesIO(raw), "application/x-yaml")}
        r_import = await client.post("/api/v1/frameworks/import/yaml", files=files)
        assert r_import.status_code == 200, (
            f"{filename}: import failed ({r_import.status_code}): {r_import.text}"
        )
        import_data = r_import.json()

        fw_id = import_data["framework_id"]
        imported_fw_ids.append(fw_id)

        assert import_data["name"], f"{filename}: imported framework has no name"
        assert import_data["total_nodes"] >= min_nodes, (
            f"{filename}: expected >= {min_nodes} nodes, got {import_data['total_nodes']}"
        )
        assert import_data["total_assessable"] >= 1, (
            f"{filename}: expected >= 1 assessable node, got {import_data['total_assessable']}"
        )
        assert import_data["dimensions_created"] >= 1, (
            f"{filename}: expected >= 1 dimension, got {import_data['dimensions_created']}"
        )

        # ── 3. Adopt via PUT /api/v1/frameworks/{id}/adopt ──
        adopt_body = {
            "name": f"Adopted: {import_data['name']}",
            "document_origin": "external",
            "owner": "Security Team",
            "requires_review": True,
            "review_frequency_months": 6,
        }
        r_adopt = await client.put(f"/api/v1/frameworks/{fw_id}/adopt", json=adopt_body)
        assert r_adopt.status_code == 200, (
            f"{filename}: adopt failed ({r_adopt.status_code}): {r_adopt.text}"
        )
        adopt_data = r_adopt.json()
        assert adopt_data["name"] == f"Adopted: {import_data['name']}"
        assert adopt_data["owner"] == "Security Team"
        assert adopt_data["requires_review"] is True
        assert adopt_data["review_frequency_months"] == 6
        assert len(adopt_data["dimensions"]) >= 1

        # ── 4. GET detail via GET /api/v1/frameworks/{id} ──
        r_detail = await client.get(f"/api/v1/frameworks/{fw_id}")
        assert r_detail.status_code == 200, (
            f"{filename}: GET detail failed ({r_detail.status_code}): {r_detail.text}"
        )
        detail = r_detail.json()
        assert detail["id"] == fw_id
        assert detail["name"] == adopt_data["name"]
        assert detail["owner"] == "Security Team"
        assert detail["total_nodes"] >= min_nodes
        assert detail["total_assessable"] >= 1
        assert len(detail["dimensions"]) >= 1
        # Verify dimensions have levels
        for dim in detail["dimensions"]:
            assert len(dim["levels"]) >= 2, (
                f"{filename}: dimension '{dim['name']}' has fewer than 2 levels"
            )

        # ── 5. GET tree via GET /api/v1/frameworks/{id}/tree ──
        r_tree = await client.get(f"/api/v1/frameworks/{fw_id}/tree")
        assert r_tree.status_code == 200, (
            f"{filename}: GET tree failed ({r_tree.status_code}): {r_tree.text}"
        )
        tree = r_tree.json()
        assert len(tree) >= 1, f"{filename}: tree is empty"

        # Walk the tree to count total nodes and verify structure
        def _count_tree_nodes(nodes: list) -> int:
            total = 0
            for n in nodes:
                total += 1
                assert "id" in n, f"{filename}: tree node missing 'id'"
                assert "name" in n, f"{filename}: tree node missing 'name'"
                assert "children" in n, f"{filename}: tree node missing 'children'"
                total += _count_tree_nodes(n["children"])
            return total

        tree_count = _count_tree_nodes(tree)
        assert tree_count == detail["total_nodes"], (
            f"{filename}: tree node count ({tree_count}) != total_nodes ({detail['total_nodes']})"
        )

    # At least 2 frameworks should have imported successfully
    assert len(imported_fw_ids) >= 2, (
        f"Only {len(imported_fw_ids)} frameworks imported; expected >= 2"
    )

    # Verify all frameworks appear in the list endpoint
    r_list = await client.get("/api/v1/frameworks")
    assert r_list.status_code == 200
    listed_ids = {fw["id"] for fw in r_list.json()}
    for fw_id in imported_fw_ids:
        assert fw_id in listed_ids, f"Framework {fw_id} not found in list endpoint"


@pytest.mark.asyncio
async def test_live_github_import_endpoint(client: AsyncClient):
    """Test the POST /api/v1/frameworks/import/github endpoint with a real file.

    This endpoint downloads from GitHub internally, so we just pass the filename.
    Skips if GitHub is unreachable.
    """
    # Pre-flight connectivity check
    probe = await _download_yaml("asf-baseline-v2.yaml")
    if probe is None:
        pytest.skip("GitHub is unreachable -- skipping GitHub import endpoint test")

    # Use a small framework file for the GitHub import endpoint
    filename = "asf-baseline-v2.yaml"
    r = await client.post(
        f"/api/v1/frameworks/import/github?framework_path={filename}"
    )
    assert r.status_code == 200, (
        f"GitHub import failed ({r.status_code}): {r.text}"
    )
    data = r.json()
    fw_id = data["framework_id"]

    assert data["name"], "GitHub-imported framework has no name"
    assert data["total_nodes"] >= 10
    assert data["total_assessable"] >= 1
    assert data["dimensions_created"] >= 1

    # Verify detail loads
    r_detail = await client.get(f"/api/v1/frameworks/{fw_id}")
    assert r_detail.status_code == 200
    detail = r_detail.json()
    assert detail["id"] == fw_id
    assert len(detail["dimensions"]) >= 1

    # Verify tree loads
    r_tree = await client.get(f"/api/v1/frameworks/{fw_id}/tree")
    assert r_tree.status_code == 200
    tree = r_tree.json()
    assert len(tree) >= 1

    # Adopt the framework
    adopt_body = {
        "name": "GitHub Imported & Adopted",
        "document_origin": "external",
        "owner": "CISO",
        "requires_review": False,
        "review_frequency_months": 12,
    }
    r_adopt = await client.put(f"/api/v1/frameworks/{fw_id}/adopt", json=adopt_body)
    assert r_adopt.status_code == 200
    adopt_data = r_adopt.json()
    assert adopt_data["name"] == "GitHub Imported & Adopted"
    assert adopt_data["owner"] == "CISO"

    # Re-verify detail after adoption
    r_detail2 = await client.get(f"/api/v1/frameworks/{fw_id}")
    assert r_detail2.status_code == 200
    assert r_detail2.json()["name"] == "GitHub Imported & Adopted"


@pytest.mark.asyncio
async def test_live_ciso_yaml_reimport(client: AsyncClient):
    """Test that re-importing the same YAML (same URN) updates rather than duplicates.

    Skips if GitHub is unreachable.
    """
    filename = "asf-baseline-v2.yaml"
    raw = await _download_yaml(filename)
    if raw is None:
        pytest.skip("GitHub is unreachable -- skipping reimport test")

    # First import
    files1 = {"file": (filename, io.BytesIO(raw), "application/x-yaml")}
    r1 = await client.post("/api/v1/frameworks/import/yaml", files=files1)
    assert r1.status_code == 200
    fw_id_1 = r1.json()["framework_id"]

    # Second import of the same file (same URN) should re-import, not duplicate
    files2 = {"file": (filename, io.BytesIO(raw), "application/x-yaml")}
    r2 = await client.post("/api/v1/frameworks/import/yaml", files=files2)
    assert r2.status_code == 200
    fw_id_2 = r2.json()["framework_id"]

    assert fw_id_1 == fw_id_2, (
        f"Re-import created a new framework (id {fw_id_2}) instead of updating "
        f"the existing one (id {fw_id_1})"
    )

    # Verify the framework is still intact after re-import
    r_detail = await client.get(f"/api/v1/frameworks/{fw_id_1}")
    assert r_detail.status_code == 200
    detail = r_detail.json()
    assert detail["total_nodes"] >= 10
    assert len(detail["dimensions"]) >= 1

    # Verify tree still works
    r_tree = await client.get(f"/api/v1/frameworks/{fw_id_1}/tree")
    assert r_tree.status_code == 200
    assert len(r_tree.json()) >= 1


@pytest.mark.asyncio
async def test_live_ciso_yaml_dimensions_and_nodes(client: AsyncClient):
    """Download a real framework and verify its dimensions and node endpoints in detail.

    Skips if GitHub is unreachable.
    """
    filename = "google-saif.yaml"
    raw = await _download_yaml(filename)
    if raw is None:
        pytest.skip("GitHub is unreachable -- skipping dimensions/nodes detail test")

    # Import
    files = {"file": (filename, io.BytesIO(raw), "application/x-yaml")}
    r_import = await client.post("/api/v1/frameworks/import/yaml", files=files)
    assert r_import.status_code == 200
    fw_id = r_import.json()["framework_id"]

    # GET dimensions endpoint
    r_dims = await client.get(f"/api/v1/frameworks/{fw_id}/dimensions")
    assert r_dims.status_code == 200
    dims = r_dims.json()
    assert len(dims) >= 1
    for dim in dims:
        assert dim["dimension_key"], "Dimension missing key"
        assert dim["name"], "Dimension missing name"
        assert len(dim["levels"]) >= 2, f"Dimension '{dim['name']}' has fewer than 2 levels"
        # Verify levels are ordered and have values
        for level in dim["levels"]:
            assert "value" in level, f"Level missing 'value' in dimension '{dim['name']}'"
            assert "label" in level, f"Level missing 'label' in dimension '{dim['name']}'"

    # GET assessable nodes
    r_nodes = await client.get(f"/api/v1/frameworks/{fw_id}/nodes?assessable=true")
    assert r_nodes.status_code == 200
    nodes = r_nodes.json()
    assert len(nodes) >= 1, "No assessable nodes found"
    for node in nodes:
        assert node["assessable"] is True
        assert node["name"], f"Assessable node {node.get('ref_id', '?')} has no name"

    # GET all nodes (assessable + non-assessable)
    r_all_nodes = await client.get(f"/api/v1/frameworks/{fw_id}/nodes")
    assert r_all_nodes.status_code == 200
    all_nodes = r_all_nodes.json()
    assert len(all_nodes) >= len(nodes), (
        "Total nodes should be >= assessable nodes"
    )
