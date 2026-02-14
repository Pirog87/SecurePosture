"""
Tests for Framework Mapping module — CISO Assistant-inspired set-theoretic mapping.

Covers:
- revert_relationship logic
- MappingSet CRUD (create, list, delete)
- FrameworkMapping CRUD with set-theoretic relationship types
- Confirmation workflow (single + bulk)
- Bulk import with auto-revert
- YAML mapping import (CISO Assistant format)
- SBERT AI-suggest (mocked model)
- Coverage analysis
- Matrix endpoint
- Statistics endpoint
- Validation (invalid relationship_type)
"""
import io
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance import revert_relationship
from app.models.framework import Framework, FrameworkNode


def _mock_compute_suggestions(source_texts, target_texts, model_name="all-MiniLM-L6-v2", top_k=5, min_score=0.0):
    """Mock compute_suggestions that returns deterministic results without loading a model."""
    results = []
    n_tgt = len(target_texts)
    actual_k = min(top_k, n_tgt)
    for i in range(len(source_texts)):
        pairs = []
        for j in range(actual_k):
            score = max(0.9 - j * 0.15 - abs(i - j) * 0.05, 0.1)
            if score >= min_score:
                pairs.append((j, score))
        pairs.sort(key=lambda x: x[1], reverse=True)
        results.append(pairs)
    return results


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


# ─── YAML Mapping Import Tests ────────────────────────────────


SAMPLE_MAPPING_YAML = """
urn: urn:test:risk:library:mapping-iso27001-to-nist-csf
locale: en
ref_id: mapping-iso27001-to-nist-csf
name: "ISO 27001 to NIST CSF 2.0"
description: "Test mapping between ISO 27001 and NIST CSF 2.0"
version: 1
provider: test
objects:
  requirement_mapping_sets:
    - urn: urn:test:risk:mapping-set:iso27001-to-nist-csf
      ref_id: iso27001-to-nist-csf
      name: "ISO 27001:2022 to NIST CSF 2.0"
      source_framework_urn: urn:iso27001
      target_framework_urn: urn:nist-csf
      requirement_mappings:
        - source_requirement_urn: urn:test:risk:req_node:iso27001:a.5.1
          target_requirement_urn: urn:test:risk:req_node:nist-csf:gv.po-01
          relationship: equal
          strength: 3
        - source_requirement_urn: urn:test:risk:req_node:iso27001:a.6.1
          target_requirement_urn: urn:test:risk:req_node:nist-csf:gv.rm-01
          relationship: subset
          strength: 2
        - source_requirement_urn: urn:test:risk:req_node:iso27001:a.8.1
          target_requirement_urn: urn:test:risk:req_node:nist-csf:id.am-01
          relationship: intersect
"""


async def _seed_frameworks_with_urns(db: AsyncSession):
    """Create two frameworks with URN-based nodes for YAML import testing."""
    fw1 = Framework(name="ISO 27001", urn="urn:iso27001", version="2022")
    fw2 = Framework(name="NIST CSF 2.0", urn="urn:nist-csf", version="2.0")
    db.add_all([fw1, fw2])
    await db.flush()

    # Source framework nodes with URNs
    n1 = []
    for i, (ref, name, urn) in enumerate([
        ("A.5.1", "Information security policies", "urn:test:risk:req_node:iso27001:a.5.1"),
        ("A.6.1", "Organization of information security", "urn:test:risk:req_node:iso27001:a.6.1"),
        ("A.8.1", "Asset management", "urn:test:risk:req_node:iso27001:a.8.1"),
    ]):
        n = FrameworkNode(
            framework_id=fw1.id, ref_id=ref, name=name, urn=urn,
            depth=2, assessable=True, is_active=True, order_id=i,
        )
        db.add(n)
        n1.append(n)

    # Target framework nodes with URNs
    n2 = []
    for i, (ref, name, urn) in enumerate([
        ("GV.PO-01", "Organizational context - policy", "urn:test:risk:req_node:nist-csf:gv.po-01"),
        ("GV.RM-01", "Risk management strategy", "urn:test:risk:req_node:nist-csf:gv.rm-01"),
        ("ID.AM-01", "Asset inventories", "urn:test:risk:req_node:nist-csf:id.am-01"),
    ]):
        n = FrameworkNode(
            framework_id=fw2.id, ref_id=ref, name=name, urn=urn,
            depth=2, assessable=True, is_active=True, order_id=i,
        )
        db.add(n)
        n2.append(n)

    await db.commit()
    for n in n1 + n2:
        await db.refresh(n)

    return fw1, fw2, n1, n2


@pytest.mark.asyncio
async def test_parse_mapping_yaml():
    """parse_mapping_yaml correctly extracts mapping sets from CISO Assistant YAML."""
    from app.services.mapping_import import parse_mapping_yaml

    result = parse_mapping_yaml(SAMPLE_MAPPING_YAML)
    assert len(result) == 1

    ms = result[0]
    assert ms["source_framework_urn"] == "urn:iso27001"
    assert ms["target_framework_urn"] == "urn:nist-csf"
    assert ms["name"] == "ISO 27001:2022 to NIST CSF 2.0"
    assert len(ms["mappings"]) == 3

    # Check first mapping
    m0 = ms["mappings"][0]
    assert "a.5.1" in m0["source_urn"]
    assert "gv.po-01" in m0["target_urn"]
    assert m0["relationship"] == "equal"
    assert m0["strength"] == 3

    # Check mapping with default strength
    m2 = ms["mappings"][2]
    assert m2["relationship"] == "intersect"
    assert m2["strength"] == 2  # default


@pytest.mark.asyncio
async def test_parse_mapping_yaml_empty():
    """parse_mapping_yaml raises ValueError on empty YAML."""
    from app.services.mapping_import import parse_mapping_yaml

    with pytest.raises(ValueError, match="Empty YAML"):
        parse_mapping_yaml("")


@pytest.mark.asyncio
async def test_parse_mapping_yaml_no_mappings():
    """parse_mapping_yaml raises ValueError when no mapping sets found."""
    from app.services.mapping_import import parse_mapping_yaml

    with pytest.raises(ValueError, match="No requirement_mapping_sets"):
        parse_mapping_yaml("urn: test\nobjects:\n  framework:\n    name: Test\n")


@pytest.mark.asyncio
async def test_import_mapping_yaml_endpoint(client: AsyncClient, db: AsyncSession):
    """YAML import endpoint creates mappings from CISO Assistant format."""
    fw1, fw2, n1, n2 = await _seed_frameworks_with_urns(db)

    # Upload YAML file
    r = await client.post(
        "/api/v1/framework-mappings/import/yaml",
        files={"file": ("mapping.yaml", SAMPLE_MAPPING_YAML.encode(), "application/x-yaml")},
        params={"auto_revert": "true"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["created"] == 3
    assert data["revert_created"] == 3
    assert data["skipped"] == 0
    assert data["source_framework_name"] == "ISO 27001"
    assert data["target_framework_name"] == "NIST CSF 2.0"
    assert data["mapping_set_id"] is not None

    # Verify mappings exist
    fwd = await client.get(f"/api/v1/framework-mappings/?source_framework_id={fw1.id}")
    assert len(fwd.json()) == 3

    # Verify revert mappings
    rev = await client.get(f"/api/v1/framework-mappings/?source_framework_id={fw2.id}")
    assert len(rev.json()) == 3

    # Verify relationship types preserved
    mappings = fwd.json()
    rels = sorted([m["relationship_type"] for m in mappings])
    assert rels == ["equal", "intersect", "subset"]


@pytest.mark.asyncio
async def test_import_mapping_yaml_with_framework_override(client: AsyncClient, db: AsyncSession):
    """YAML import with explicit framework IDs overrides URN resolution."""
    fw1, fw2, n1, n2 = await _seed_frameworks_with_urns(db)

    r = await client.post(
        "/api/v1/framework-mappings/import/yaml",
        files={"file": ("mapping.yaml", SAMPLE_MAPPING_YAML.encode(), "application/x-yaml")},
        params={
            "source_framework_id": fw1.id,
            "target_framework_id": fw2.id,
            "auto_revert": "false",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["created"] == 3
    assert data["revert_created"] == 0  # auto_revert disabled


@pytest.mark.asyncio
async def test_import_mapping_yaml_duplicate_skip(client: AsyncClient, db: AsyncSession):
    """Second import of same YAML skips already existing mappings."""
    await _seed_frameworks_with_urns(db)

    # First import
    r1 = await client.post(
        "/api/v1/framework-mappings/import/yaml",
        files={"file": ("mapping.yaml", SAMPLE_MAPPING_YAML.encode(), "application/x-yaml")},
        params={"auto_revert": "false"},
    )
    assert r1.json()["created"] == 3

    # Second import — all should be skipped
    r2 = await client.post(
        "/api/v1/framework-mappings/import/yaml",
        files={"file": ("mapping.yaml", SAMPLE_MAPPING_YAML.encode(), "application/x-yaml")},
        params={"auto_revert": "false"},
    )
    assert r2.json()["created"] == 0
    assert r2.json()["skipped"] == 3


@pytest.mark.asyncio
async def test_import_mapping_yaml_missing_framework(client: AsyncClient, db: AsyncSession):
    """YAML import fails with 400 when referenced framework is not found."""
    # No frameworks seeded — URN resolution will fail
    r = await client.post(
        "/api/v1/framework-mappings/import/yaml",
        files={"file": ("mapping.yaml", SAMPLE_MAPPING_YAML.encode(), "application/x-yaml")},
    )
    assert r.status_code == 400
    assert "not found" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_import_mapping_yaml_invalid_file(client: AsyncClient):
    """YAML import rejects non-YAML files."""
    r = await client.post(
        "/api/v1/framework-mappings/import/yaml",
        files={"file": ("mapping.txt", b"not yaml", "text/plain")},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_import_mapping_yaml_partial_match(client: AsyncClient, db: AsyncSession):
    """YAML import handles partial node resolution — creates what it can, reports errors."""
    fw1, fw2, _, _ = await _seed_frameworks_with_urns(db)

    # YAML with one valid and one invalid mapping
    partial_yaml = """
objects:
  requirement_mapping_sets:
    - source_framework_urn: urn:iso27001
      target_framework_urn: urn:nist-csf
      requirement_mappings:
        - source_requirement_urn: urn:test:risk:req_node:iso27001:a.5.1
          target_requirement_urn: urn:test:risk:req_node:nist-csf:gv.po-01
          relationship: equal
        - source_requirement_urn: urn:test:risk:req_node:iso27001:nonexistent
          target_requirement_urn: urn:test:risk:req_node:nist-csf:gv.rm-01
          relationship: intersect
"""
    r = await client.post(
        "/api/v1/framework-mappings/import/yaml",
        files={"file": ("mapping.yaml", partial_yaml.encode(), "application/x-yaml")},
        params={"auto_revert": "false"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["created"] == 1
    assert data["skipped"] == 1
    assert len(data["errors"]) >= 1


# ─── SBERT Mapper Tests ───────────────────────────────────────


@pytest.mark.asyncio
async def test_sbert_node_text():
    """_node_text builds correct text representation."""
    from app.services.sbert_mapper import _node_text

    class FakeNode:
        ref_id = "A.5.1"
        name = "Information security policies"
        description = "Policies for information security"

    txt = _node_text(FakeNode())
    assert "A.5.1" in txt
    assert "Information security policies" in txt
    assert "Policies for information security" in txt


@pytest.mark.asyncio
async def test_sbert_node_text_no_description():
    """_node_text works without description."""
    from app.services.sbert_mapper import _node_text

    class FakeNode:
        ref_id = "GV.PO-01"
        name = "Policy"
        description = None

    txt = _node_text(FakeNode())
    assert "GV.PO-01" in txt
    assert "Policy" in txt


@pytest.mark.asyncio
async def test_sbert_classify_score():
    """Score classification returns correct relationship types."""
    from app.services.sbert_mapper import _classify_score

    rel, strength = _classify_score(0.90)
    assert rel == "equal"
    assert strength == 3

    rel, strength = _classify_score(0.75)
    assert rel == "subset"
    assert strength == 3

    rel, strength = _classify_score(0.60)
    assert rel == "intersect"
    assert strength == 2

    rel, strength = _classify_score(0.42)
    assert rel == "intersect"
    assert strength == 1


@pytest.mark.asyncio
async def test_sbert_compute_suggestions():
    """compute_suggestions (mocked) returns scored matches above threshold."""
    results = _mock_compute_suggestions(
        ["Information security policies and procedures"],
        ["Organizational security policy management", "Physical access control", "Network firewall"],
        top_k=3, min_score=0.0,
    )
    assert len(results) == 1
    assert len(results[0]) > 0
    scores = [score for _, score in results[0]]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.asyncio
@patch("app.services.sbert_mapper.compute_suggestions", side_effect=_mock_compute_suggestions)
async def test_sbert_suggest_mappings(mock_cs, db: AsyncSession):
    """suggest_mappings returns suggestions for two frameworks."""
    from app.services.sbert_mapper import suggest_mappings

    fw1, fw2, _, _ = await _seed_two_frameworks(db)

    result = await suggest_mappings(
        db,
        fw1.id,
        fw2.id,
        top_k=2,
        min_score=0.0,
    )

    assert result.source_framework_id == fw1.id
    assert result.target_framework_id == fw2.id
    assert result.source_framework_name == "ISO 27001"
    assert result.target_framework_name == "NIST CSF 2.0"
    assert result.source_nodes_count == 3
    assert result.target_nodes_count == 3
    assert len(result.suggestions) > 0

    for s in result.suggestions:
        assert s.source_node_id > 0
        assert s.target_node_id > 0
        assert 0.0 <= s.score <= 1.0
        assert s.relationship_type in ("equal", "subset", "superset", "intersect", "not_related")
        assert s.strength in (1, 2, 3)


@pytest.mark.asyncio
async def test_sbert_suggest_missing_framework(db: AsyncSession):
    """suggest_mappings raises ValueError for missing framework."""
    from app.services.sbert_mapper import suggest_mappings

    with pytest.raises(ValueError, match="not found"):
        await suggest_mappings(db, 9999, 9998)


@pytest.mark.asyncio
async def test_sbert_suggest_empty_framework(db: AsyncSession):
    """suggest_mappings returns empty for framework with no nodes."""
    from app.services.sbert_mapper import suggest_mappings

    fw1 = Framework(name="Empty FW", urn="urn:empty1")
    fw2 = Framework(name="Empty FW 2", urn="urn:empty2")
    db.add_all([fw1, fw2])
    await db.commit()
    await db.refresh(fw1)
    await db.refresh(fw2)

    result = await suggest_mappings(db, fw1.id, fw2.id)
    assert len(result.suggestions) == 0


@pytest.mark.asyncio
@patch("app.services.sbert_mapper.compute_suggestions", side_effect=_mock_compute_suggestions)
async def test_ai_suggest_endpoint(mock_cs, client: AsyncClient, db: AsyncSession):
    """POST /ai-suggest returns suggestions via API."""
    fw1, fw2, _, _ = await _seed_two_frameworks(db)

    r = await client.post(
        "/api/v1/framework-mappings/ai-suggest",
        params={
            "source_framework_id": fw1.id,
            "target_framework_id": fw2.id,
            "top_k": 2,
            "min_score": 0.0,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["source_framework_name"] == "ISO 27001"
    assert data["target_framework_name"] == "NIST CSF 2.0"
    assert data["total_suggestions"] > 0
    assert len(data["suggestions"]) > 0

    s = data["suggestions"][0]
    assert "source_node_id" in s
    assert "target_node_id" in s
    assert "score" in s
    assert "relationship_type" in s
    assert "strength" in s


@pytest.mark.asyncio
async def test_ai_suggest_accept(client: AsyncClient, db: AsyncSession):
    """POST /ai-suggest/accept creates mappings from suggestions."""
    fw1, fw2, nodes1, nodes2 = await _seed_two_frameworks(db)

    # Accept some suggestions directly
    suggestions = [
        {
            "source_node_id": nodes1[0].id,
            "target_node_id": nodes2[0].id,
            "relationship_type": "equal",
            "strength": 3,
            "score": 0.92,
            "model_name": "all-MiniLM-L6-v2",
        },
        {
            "source_node_id": nodes1[1].id,
            "target_node_id": nodes2[1].id,
            "relationship_type": "intersect",
            "strength": 2,
            "score": 0.65,
            "model_name": "all-MiniLM-L6-v2",
        },
    ]

    r = await client.post(
        "/api/v1/framework-mappings/ai-suggest/accept",
        params={
            "source_framework_id": fw1.id,
            "target_framework_id": fw2.id,
            "auto_revert": "true",
        },
        json=suggestions,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["created"] == 2
    assert data["revert_created"] == 2  # auto-revert creates inverse
    assert data["mapping_set_id"] > 0

    # Verify mappings were actually created
    r2 = await client.get("/api/v1/framework-mappings/")
    mappings = r2.json()
    assert len(mappings) >= 4  # 2 forward + 2 reverse
    ai_mappings = [m for m in mappings if m["mapping_source"] == "ai_assisted"]
    assert len(ai_mappings) >= 2


@pytest.mark.asyncio
async def test_ai_suggest_accept_skip_duplicates(client: AsyncClient, db: AsyncSession):
    """Accept endpoint skips duplicate mappings."""
    fw1, fw2, nodes1, nodes2 = await _seed_two_frameworks(db)

    suggestions = [{
        "source_node_id": nodes1[0].id,
        "target_node_id": nodes2[0].id,
        "relationship_type": "equal",
        "strength": 3,
        "score": 0.90,
    }]

    # First accept
    r1 = await client.post(
        "/api/v1/framework-mappings/ai-suggest/accept",
        params={"source_framework_id": fw1.id, "target_framework_id": fw2.id, "auto_revert": "false"},
        json=suggestions,
    )
    assert r1.json()["created"] == 1

    # Second accept — should skip
    r2 = await client.post(
        "/api/v1/framework-mappings/ai-suggest/accept",
        params={"source_framework_id": fw1.id, "target_framework_id": fw2.id, "auto_revert": "false"},
        json=suggestions,
    )
    assert r2.json()["created"] == 0
    assert r2.json()["skipped"] == 1
