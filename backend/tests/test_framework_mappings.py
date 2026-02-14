"""
Tests for Framework Mapping module — CISO Assistant-inspired set-theoretic mapping.

Covers:
- revert_relationship logic
- MappingSet CRUD (create, list, delete)
- FrameworkMapping CRUD with set-theoretic relationship types
- Confirmation workflow (single + bulk)
- Bulk import with auto-revert
- Coverage analysis
- Matrix endpoint
- Statistics endpoint
- Validation (invalid relationship_type)
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance import revert_relationship
from app.models.framework import Framework, FrameworkNode


# ─── Helpers ─────────────────────────────────────────────────

async def _seed_two_frameworks(db: AsyncSession):
    """Create two frameworks with 3 assessable nodes each."""
    fw1 = Framework(name="ISO 27001", urn="urn:iso27001", version="2022")
    fw2 = Framework(name="NIST CSF 2.0", urn="urn:nist-csf", version="2.0")
    db.add_all([fw1, fw2])
    await db.flush()

    # Source framework nodes
    nodes1 = []
    for i, (ref, name) in enumerate([
        ("A.5.1", "Information security policies"),
        ("A.6.1", "Organization of information security"),
        ("A.8.1", "Asset management"),
    ]):
        n = FrameworkNode(
            framework_id=fw1.id, ref_id=ref, name=name,
            depth=2, assessable=True, is_active=True, order_id=i,
        )
        db.add(n)
        nodes1.append(n)

    # Target framework nodes
    nodes2 = []
    for i, (ref, name) in enumerate([
        ("GV.PO-01", "Organizational context - policy"),
        ("GV.RM-01", "Risk management strategy"),
        ("ID.AM-01", "Asset inventories"),
    ]):
        n = FrameworkNode(
            framework_id=fw2.id, ref_id=ref, name=name,
            depth=2, assessable=True, is_active=True, order_id=i,
        )
        db.add(n)
        nodes2.append(n)

    await db.commit()

    # Refresh to get IDs
    for n in nodes1 + nodes2:
        await db.refresh(n)

    return fw1, fw2, nodes1, nodes2


# ─── Unit Tests: revert_relationship ────────────────────────


class TestRevertRelationship:
    def test_equal_stays_equal(self):
        assert revert_relationship("equal") == "equal"

    def test_subset_becomes_superset(self):
        assert revert_relationship("subset") == "superset"

    def test_superset_becomes_subset(self):
        assert revert_relationship("superset") == "subset"

    def test_intersect_stays_intersect(self):
        assert revert_relationship("intersect") == "intersect"

    def test_not_related_stays(self):
        assert revert_relationship("not_related") == "not_related"


# ─── Integration Tests ──────────────────────────────────────


@pytest.mark.asyncio
async def test_mapping_stats_empty(client: AsyncClient):
    """Stats endpoint returns zeros when no mappings exist."""
    r = await client.get("/api/v1/framework-mappings/stats")
    assert r.status_code == 200
    data = r.json()
    assert data["total_mappings"] == 0
    assert data["confirmed"] == 0
    assert data["draft"] == 0
    assert data["framework_pairs"] == 0
    assert data["mapping_sets"] == 0


@pytest.mark.asyncio
async def test_create_mapping_set(client: AsyncClient, db: AsyncSession):
    fw1, fw2, _, _ = await _seed_two_frameworks(db)
    r = await client.post("/api/v1/framework-mappings/sets", json={
        "source_framework_id": fw1.id,
        "target_framework_id": fw2.id,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["source_framework_id"] == fw1.id
    assert data["target_framework_id"] == fw2.id
    assert "ISO 27001" in data["name"]
    assert "NIST CSF" in data["name"]
    assert data["status"] == "draft"
    assert data["mapping_count"] == 0


@pytest.mark.asyncio
async def test_list_mapping_sets(client: AsyncClient, db: AsyncSession):
    fw1, fw2, _, _ = await _seed_two_frameworks(db)
    await client.post("/api/v1/framework-mappings/sets", json={
        "source_framework_id": fw1.id,
        "target_framework_id": fw2.id,
    })
    r = await client.get("/api/v1/framework-mappings/sets")
    assert r.status_code == 200
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_delete_mapping_set(client: AsyncClient, db: AsyncSession):
    fw1, fw2, _, _ = await _seed_two_frameworks(db)
    cr = await client.post("/api/v1/framework-mappings/sets", json={
        "source_framework_id": fw1.id,
        "target_framework_id": fw2.id,
    })
    set_id = cr.json()["id"]
    r = await client.delete(f"/api/v1/framework-mappings/sets/{set_id}")
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_create_mapping_with_ciso_relationship(client: AsyncClient, db: AsyncSession):
    """Create a mapping with CISO Assistant set-theoretic relationship types."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)
    r = await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[0].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[0].id,
        "relationship_type": "equal",
        "strength": 3,
        "rationale_type": "functional",
        "rationale": "Both require documented security policies",
        "mapping_source": "manual",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["relationship_type"] == "equal"
    assert data["strength"] == 3
    assert data["rationale_type"] == "functional"
    assert data["mapping_status"] == "confirmed"  # manual = auto-confirmed
    assert data["source_framework_name"] == "ISO 27001"
    assert data["target_framework_name"] == "NIST CSF 2.0"
    assert data["source_requirement_ref"] == "A.5.1"
    assert data["target_requirement_ref"] == "GV.PO-01"


@pytest.mark.asyncio
async def test_create_mapping_invalid_relationship(client: AsyncClient, db: AsyncSession):
    """Invalid relationship_type should return 400."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)
    r = await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[0].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[0].id,
        "relationship_type": "invalid_type",
        "strength": 2,
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_list_mappings_with_filters(client: AsyncClient, db: AsyncSession):
    """List mappings with various filter parameters."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)

    # Create mappings with different relationship types
    for i, rel in enumerate(["equal", "subset", "intersect"]):
        await client.post("/api/v1/framework-mappings/", json={
            "source_framework_id": fw1.id,
            "source_requirement_id": n1[i].id,
            "target_framework_id": fw2.id,
            "target_requirement_id": n2[i].id,
            "relationship_type": rel,
            "strength": i + 1,
        })

    # All mappings
    r = await client.get("/api/v1/framework-mappings/")
    assert r.status_code == 200
    assert len(r.json()) == 3

    # Filter by relationship type
    r = await client.get("/api/v1/framework-mappings/?relationship_type=equal")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["relationship_type"] == "equal"

    # Filter by source framework
    r = await client.get(f"/api/v1/framework-mappings/?source_framework_id={fw1.id}")
    assert len(r.json()) == 3


@pytest.mark.asyncio
async def test_update_mapping(client: AsyncClient, db: AsyncSession):
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)
    cr = await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[0].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[0].id,
        "relationship_type": "intersect",
        "strength": 2,
    })
    mapping_id = cr.json()["id"]

    r = await client.put(f"/api/v1/framework-mappings/{mapping_id}", json={
        "relationship_type": "equal",
        "strength": 3,
        "rationale_type": "semantic",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["relationship_type"] == "equal"
    assert data["strength"] == 3
    assert data["rationale_type"] == "semantic"


@pytest.mark.asyncio
async def test_delete_mapping(client: AsyncClient, db: AsyncSession):
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)
    cr = await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[0].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[0].id,
        "relationship_type": "equal",
        "strength": 3,
    })
    mapping_id = cr.json()["id"]
    r = await client.delete(f"/api/v1/framework-mappings/{mapping_id}")
    assert r.status_code == 204

    # Verify deleted
    r = await client.get("/api/v1/framework-mappings/")
    assert len(r.json()) == 0


@pytest.mark.asyncio
async def test_confirm_mapping(client: AsyncClient, db: AsyncSession):
    """Draft mapping can be confirmed via confirmation workflow."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)

    # Create as AI-assisted (will be draft)
    cr = await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[0].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[0].id,
        "relationship_type": "intersect",
        "strength": 2,
        "mapping_source": "ai_assisted",
    })
    data = cr.json()
    assert data["mapping_status"] == "draft"

    # Confirm it
    r = await client.post(f"/api/v1/framework-mappings/{data['id']}/confirm", json={
        "confirmed_by": "Jan Kowalski",
    })
    assert r.status_code == 200
    confirmed = r.json()
    assert confirmed["mapping_status"] == "confirmed"
    assert confirmed["confirmed_by"] == "Jan Kowalski"
    assert confirmed["confirmed_at"] is not None


@pytest.mark.asyncio
async def test_bulk_confirm(client: AsyncClient, db: AsyncSession):
    """Bulk confirm multiple draft mappings at once."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)

    ids = []
    for i in range(3):
        cr = await client.post("/api/v1/framework-mappings/", json={
            "source_framework_id": fw1.id,
            "source_requirement_id": n1[i].id,
            "target_framework_id": fw2.id,
            "target_requirement_id": n2[i].id,
            "relationship_type": "intersect",
            "strength": 2,
            "mapping_source": "ai_assisted",
        })
        ids.append(cr.json()["id"])

    r = await client.post(
        "/api/v1/framework-mappings/bulk-confirm?confirmed_by=Auditor",
        json=ids,
    )
    assert r.status_code == 200
    assert r.json()["confirmed"] == 3


@pytest.mark.asyncio
async def test_bulk_import_with_auto_revert(client: AsyncClient, db: AsyncSession):
    """Bulk import creates forward + auto-reversed mappings."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)

    r = await client.post("/api/v1/framework-mappings/bulk-import", json={
        "source_framework_id": fw1.id,
        "target_framework_id": fw2.id,
        "mapping_source": "import",
        "auto_revert": True,
        "mappings": [
            {
                "source_ref_id": "A.5.1",
                "target_ref_id": "GV.PO-01",
                "relationship_type": "equal",
                "strength": 3,
            },
            {
                "source_ref_id": "A.6.1",
                "target_ref_id": "GV.RM-01",
                "relationship_type": "subset",
                "strength": 2,
            },
            {
                "source_ref_id": "A.8.1",
                "target_ref_id": "ID.AM-01",
                "relationship_type": "intersect",
                "strength": 2,
                "rationale_type": "functional",
                "rationale": "Both cover asset inventory requirements",
            },
        ],
    })
    assert r.status_code == 200
    result = r.json()
    assert result["created"] == 3
    assert result["revert_created"] == 3  # auto-revert created same count
    assert result["skipped"] == 0
    assert result["mapping_set_id"] is not None

    # Verify forward mappings
    fwd = await client.get(f"/api/v1/framework-mappings/?source_framework_id={fw1.id}")
    assert len(fwd.json()) == 3

    # Verify revert mappings (source/target swapped)
    rev = await client.get(f"/api/v1/framework-mappings/?source_framework_id={fw2.id}")
    rev_data = rev.json()
    assert len(rev_data) == 3

    # Verify relationship inversion: subset -> superset
    subset_fwd = next(m for m in fwd.json() if m["relationship_type"] == "subset")
    subset_rev = next(
        m for m in rev_data
        if m["source_requirement_ref"] == subset_fwd["target_requirement_ref"]
        and m["target_requirement_ref"] == subset_fwd["source_requirement_ref"]
    )
    assert subset_rev["relationship_type"] == "superset"

    # Verify mapping sets were created
    sets = await client.get("/api/v1/framework-mappings/sets")
    assert len(sets.json()) == 2  # forward + revert set


@pytest.mark.asyncio
async def test_bulk_import_skips_missing_refs(client: AsyncClient, db: AsyncSession):
    """Bulk import skips entries with unresolvable ref_ids."""
    fw1, fw2, _, _ = await _seed_two_frameworks(db)

    r = await client.post("/api/v1/framework-mappings/bulk-import", json={
        "source_framework_id": fw1.id,
        "target_framework_id": fw2.id,
        "auto_revert": False,
        "mappings": [
            {"source_ref_id": "A.5.1", "target_ref_id": "GV.PO-01", "relationship_type": "equal"},
            {"source_ref_id": "NONEXISTENT", "target_ref_id": "GV.PO-01", "relationship_type": "equal"},
            {"source_ref_id": "A.5.1", "target_ref_id": "MISSING", "relationship_type": "equal"},
        ],
    })
    assert r.status_code == 200
    result = r.json()
    assert result["created"] == 1
    assert result["skipped"] == 2
    assert len(result["errors"]) == 2


@pytest.mark.asyncio
async def test_coverage_analysis(client: AsyncClient, db: AsyncSession):
    """Coverage analysis counts covered vs uncovered target requirements."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)

    # Map only 2 out of 3 target requirements
    await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[0].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[0].id,
        "relationship_type": "equal",
        "strength": 3,
    })
    await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[1].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[1].id,
        "relationship_type": "intersect",
        "strength": 2,
    })

    r = await client.get(
        f"/api/v1/framework-mappings/coverage"
        f"?source_framework_id={fw1.id}&target_framework_id={fw2.id}"
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total_requirements"] == 3
    assert data["covered"] == 2
    assert data["uncovered"] == 1
    assert data["coverage_percent"] == pytest.approx(66.7, rel=0.1)

    # Verify by_relationship breakdown
    assert data["by_relationship"]["equal"] == 1
    assert data["by_relationship"]["intersect"] == 1

    # Verify by_strength breakdown
    assert data["by_strength"]["3"] == 1 or data["by_strength"][3] == 1

    # Verify uncovered list
    assert len(data["uncovered_requirements"]) == 1
    assert data["uncovered_requirements"][0]["ref_id"] == "ID.AM-01"


@pytest.mark.asyncio
async def test_mapping_matrix(client: AsyncClient, db: AsyncSession):
    """Matrix endpoint returns cross-framework mapping visualization data."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)

    await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[0].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[0].id,
        "relationship_type": "equal",
        "strength": 3,
    })
    await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[2].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[2].id,
        "relationship_type": "intersect",
        "strength": 2,
    })

    r = await client.get(
        f"/api/v1/framework-mappings/matrix"
        f"?source_framework_id={fw1.id}&target_framework_id={fw2.id}"
    )
    assert r.status_code == 200
    data = r.json()
    assert data["source_framework_name"] == "ISO 27001"
    assert data["target_framework_name"] == "NIST CSF 2.0"
    assert data["total_mappings"] == 2
    assert data["coverage_percent"] == pytest.approx(66.7, rel=0.1)
    assert len(data["mappings"]) == 2
    assert data["by_relationship"]["equal"] == 1
    assert data["by_relationship"]["intersect"] == 1


@pytest.mark.asyncio
async def test_mapping_stats_populated(client: AsyncClient, db: AsyncSession):
    """Stats endpoint reflects actual mapping data."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)

    # Create a set
    await client.post("/api/v1/framework-mappings/sets", json={
        "source_framework_id": fw1.id,
        "target_framework_id": fw2.id,
    })

    # Create 2 manual (confirmed) and 1 AI (draft)
    await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[0].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[0].id,
        "relationship_type": "equal",
        "strength": 3,
        "mapping_source": "manual",
    })
    await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[1].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[1].id,
        "relationship_type": "intersect",
        "strength": 2,
        "mapping_source": "manual",
    })
    await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[2].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[2].id,
        "relationship_type": "subset",
        "strength": 1,
        "mapping_source": "ai_assisted",
    })

    r = await client.get("/api/v1/framework-mappings/stats")
    assert r.status_code == 200
    data = r.json()
    assert data["total_mappings"] == 3
    assert data["confirmed"] == 2
    assert data["draft"] == 1
    assert data["framework_pairs"] == 1
    assert data["mapping_sets"] == 1
    assert data["by_relationship"]["equal"] == 1
    assert data["by_relationship"]["intersect"] == 1
    assert data["by_relationship"]["subset"] == 1
    assert data["by_source"]["manual"] == 2
    assert data["by_source"]["ai_assisted"] == 1


@pytest.mark.asyncio
async def test_mapping_not_found(client: AsyncClient):
    """Operations on non-existent mapping return 404."""
    r = await client.put("/api/v1/framework-mappings/99999", json={"strength": 1})
    assert r.status_code == 404

    r = await client.delete("/api/v1/framework-mappings/99999")
    assert r.status_code == 404

    r = await client.post("/api/v1/framework-mappings/99999/confirm", json={"confirmed_by": "test"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_coverage_confirmed_vs_total(client: AsyncClient, db: AsyncSession):
    """Coverage distinguishes between confirmed and total (incl. draft) coverage."""
    fw1, fw2, n1, n2 = await _seed_two_frameworks(db)

    # One confirmed mapping
    await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[0].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[0].id,
        "relationship_type": "equal",
        "strength": 3,
        "mapping_source": "manual",
    })
    # One draft mapping
    await client.post("/api/v1/framework-mappings/", json={
        "source_framework_id": fw1.id,
        "source_requirement_id": n1[1].id,
        "target_framework_id": fw2.id,
        "target_requirement_id": n2[1].id,
        "relationship_type": "intersect",
        "strength": 2,
        "mapping_source": "ai_assisted",
    })

    r = await client.get(
        f"/api/v1/framework-mappings/coverage"
        f"?source_framework_id={fw1.id}&target_framework_id={fw2.id}"
    )
    data = r.json()
    assert data["covered"] == 2
    assert data["confirmed_covered"] == 1
    assert data["coverage_percent"] == pytest.approx(66.7, rel=0.1)
    assert data["confirmed_coverage_percent"] == pytest.approx(33.3, rel=0.1)
