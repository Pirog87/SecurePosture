"""
Mapping Import Service — parses CISO Assistant mapping YAML files.

Supports the CISO Assistant requirement_mapping_sets format:
  - requirement_mapping_sets[].requirement_mappings[]
  - Each mapping: source_requirement_urn, target_requirement_urn, relationship
  - Framework resolution via URN lookup or explicit framework IDs

Reference format (from CISO Assistant community library):
  objects:
    requirement_mapping_sets:
      - urn: ...
        source_framework_urn: urn:intuitem:risk:library:nist-sp-800-53-rev5
        target_framework_urn: urn:intuitem:risk:library:iso27001-2022
        requirement_mappings:
          - source_requirement_urn: urn:intuitem:risk:req_node:nist-sp-800-53-rev5:ac-1
            target_requirement_urn: urn:intuitem:risk:req_node:iso27001-2022:5.2
            relationship: intersect
            strength: 2
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, BinaryIO

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance import (
    FrameworkMapping,
    MappingSet,
    revert_relationship,
    RELATIONSHIP_TYPES,
)
from app.models.framework import Framework, FrameworkNode

log = logging.getLogger(__name__)


def _normalize_urn(urn: str | None) -> str | None:
    if not urn:
        return None
    return urn.strip().lower()


@dataclass
class MappingImportResult:
    """Result of a mapping YAML import."""
    mapping_set_id: int | None = None
    source_framework_name: str | None = None
    target_framework_name: str | None = None
    created: int = 0
    revert_created: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


def parse_mapping_yaml(content: bytes | str) -> list[dict[str, Any]]:
    """Parse a CISO Assistant mapping YAML file.

    Returns a list of mapping set dicts, each containing:
      - source_framework_urn
      - target_framework_urn
      - name (optional)
      - mappings: list of {source_urn, target_urn, relationship, strength}
    """
    if isinstance(content, bytes):
        content = content.decode("utf-8")

    data = yaml.safe_load(content)
    if not data:
        raise ValueError("Empty YAML file")

    results: list[dict[str, Any]] = []

    # Extract mapping sets from objects.requirement_mapping_sets
    objects = data.get("objects", {})
    if isinstance(objects, dict):
        mapping_sets = objects.get("requirement_mapping_sets", [])
    elif isinstance(objects, list):
        # Legacy format: objects is a list
        mapping_sets = [
            obj for obj in objects
            if isinstance(obj, dict) and "requirement_mappings" in obj
        ]
    else:
        mapping_sets = []

    # Fallback: mapping set data at top-level
    if not mapping_sets and "requirement_mappings" in data:
        mapping_sets = [data]

    if not mapping_sets:
        raise ValueError(
            "No requirement_mapping_sets found in YAML. "
            "Expected objects.requirement_mapping_sets[] with requirement_mappings[]."
        )

    lib_meta = {
        "urn": data.get("urn"),
        "name": data.get("name"),
        "ref_id": data.get("ref_id"),
        "provider": data.get("provider"),
    }

    for ms_data in mapping_sets:
        if not isinstance(ms_data, dict):
            continue

        raw_mappings = ms_data.get("requirement_mappings", [])
        if not raw_mappings:
            continue

        parsed_mappings = []
        for rm in raw_mappings:
            if not isinstance(rm, dict):
                continue

            src_urn = rm.get("source_requirement_urn") or rm.get("source_urn")
            tgt_urn = rm.get("target_requirement_urn") or rm.get("target_urn")
            if not src_urn or not tgt_urn:
                continue

            rel = rm.get("relationship", "intersect")
            if rel not in RELATIONSHIP_TYPES:
                rel = "intersect"

            strength = rm.get("strength", 2)
            if not isinstance(strength, int) or strength < 1 or strength > 3:
                strength = 2

            parsed_mappings.append({
                "source_urn": _normalize_urn(src_urn),
                "target_urn": _normalize_urn(tgt_urn),
                "relationship": rel,
                "strength": strength,
                "rationale": rm.get("rationale"),
            })

        results.append({
            "source_framework_urn": _normalize_urn(
                ms_data.get("source_framework_urn")
                or ms_data.get("source_framework")
            ),
            "target_framework_urn": _normalize_urn(
                ms_data.get("target_framework_urn")
                or ms_data.get("target_framework")
            ),
            "name": ms_data.get("name") or lib_meta.get("name"),
            "urn": ms_data.get("urn") or lib_meta.get("urn"),
            "mappings": parsed_mappings,
        })

    return results


async def _resolve_framework_by_urn(
    s: AsyncSession, urn: str | None
) -> Framework | None:
    """Find a framework by its URN (checking both framework URN and library URN patterns)."""
    if not urn:
        return None

    # Direct URN match
    q = select(Framework).where(Framework.urn == urn)
    fw = (await s.execute(q)).scalar_one_or_none()
    if fw:
        return fw

    # Try stripping common prefixes to match against stored URN
    # CISO Assistant uses urn:intuitem:risk:library:XXX for library-level
    # but frameworks may be stored with just the last part
    for prefix in (
        "urn:intuitem:risk:library:",
        "urn:intuitem:risk:framework:",
    ):
        if urn.startswith(prefix):
            short = urn[len(prefix):]
            # Try matching by ref_id
            q2 = select(Framework).where(Framework.ref_id == short)
            fw = (await s.execute(q2)).scalar_one_or_none()
            if fw:
                return fw
            # Try case-insensitive name match
            q3 = select(Framework).where(Framework.urn.ilike(f"%{short}%"))
            fw = (await s.execute(q3)).scalar_one_or_none()
            if fw:
                return fw

    return None


async def _build_urn_to_node_map(
    s: AsyncSession, framework_id: int
) -> dict[str, int]:
    """Build a mapping of normalized URN -> node ID for a framework."""
    q = select(FrameworkNode).where(
        FrameworkNode.framework_id == framework_id,
        FrameworkNode.is_active == True,  # noqa: E712
    )
    nodes = (await s.execute(q)).scalars().all()

    urn_map: dict[str, int] = {}
    for n in nodes:
        if n.urn:
            urn_map[_normalize_urn(n.urn)] = n.id
        # Also map by ref_id-based URN patterns
        if n.ref_id:
            # CISO Assistant uses urn:intuitem:risk:req_node:FRAMEWORK-REF:NODE-REF
            ref_lower = n.ref_id.lower()
            urn_map[ref_lower] = n.id

    return urn_map


def _extract_ref_from_urn(urn: str) -> str | None:
    """Extract the requirement reference from a CISO Assistant URN.

    Example: urn:intuitem:risk:req_node:nist-sp-800-53-rev5:ac-1 -> ac-1
    """
    if not urn:
        return None
    parts = urn.split(":")
    if len(parts) >= 2:
        return parts[-1]
    return None


async def import_mapping_yaml(
    s: AsyncSession,
    file: BinaryIO,
    source_framework_id: int | None = None,
    target_framework_id: int | None = None,
    auto_revert: bool = True,
    imported_by: str = "yaml-import",
) -> MappingImportResult:
    """Import mappings from a CISO Assistant mapping YAML file.

    If source_framework_id/target_framework_id are provided, they override
    URN-based resolution. Otherwise, frameworks are resolved from URNs in
    the YAML file.
    """
    content = file.read()
    parsed_sets = parse_mapping_yaml(content)

    if not parsed_sets:
        raise ValueError("No mapping sets found in YAML file")

    # Use the first mapping set (most YAML files contain one)
    ms_data = parsed_sets[0]
    total_result = MappingImportResult()

    # Resolve source framework
    src_fw: Framework | None = None
    if source_framework_id:
        src_fw = await s.get(Framework, source_framework_id)
    if not src_fw and ms_data.get("source_framework_urn"):
        src_fw = await _resolve_framework_by_urn(s, ms_data["source_framework_urn"])

    # Resolve target framework
    tgt_fw: Framework | None = None
    if target_framework_id:
        tgt_fw = await s.get(Framework, target_framework_id)
    if not tgt_fw and ms_data.get("target_framework_urn"):
        tgt_fw = await _resolve_framework_by_urn(s, ms_data["target_framework_urn"])

    if not src_fw:
        raise ValueError(
            f"Source framework not found. "
            f"URN: {ms_data.get('source_framework_urn')}. "
            f"Import the source framework first."
        )
    if not tgt_fw:
        raise ValueError(
            f"Target framework not found. "
            f"URN: {ms_data.get('target_framework_urn')}. "
            f"Import the target framework first."
        )

    total_result.source_framework_name = src_fw.name
    total_result.target_framework_name = tgt_fw.name

    log.info(
        "Importing mappings: %s -> %s (%d mappings in YAML)",
        src_fw.name, tgt_fw.name, len(ms_data["mappings"]),
    )

    # Build URN -> node_id lookups
    src_urn_map = await _build_urn_to_node_map(s, src_fw.id)
    tgt_urn_map = await _build_urn_to_node_map(s, tgt_fw.id)

    # Also build ref_id -> node_id lookups for fallback
    src_ref_q = select(FrameworkNode).where(FrameworkNode.framework_id == src_fw.id)
    tgt_ref_q = select(FrameworkNode).where(FrameworkNode.framework_id == tgt_fw.id)
    src_ref_map = {
        n.ref_id.lower(): n.id
        for n in (await s.execute(src_ref_q)).scalars().all()
        if n.ref_id
    }
    tgt_ref_map = {
        n.ref_id.lower(): n.id
        for n in (await s.execute(tgt_ref_q)).scalars().all()
        if n.ref_id
    }

    # Find or create mapping set
    ms_q = select(MappingSet).where(
        MappingSet.source_framework_id == src_fw.id,
        MappingSet.target_framework_id == tgt_fw.id,
    )
    ms = (await s.execute(ms_q)).scalar_one_or_none()
    if not ms:
        ms = MappingSet(
            source_framework_id=src_fw.id,
            target_framework_id=tgt_fw.id,
            name=ms_data.get("name") or f"{src_fw.name} <-> {tgt_fw.name}",
        )
        s.add(ms)
        await s.flush()

    total_result.mapping_set_id = ms.id

    # Import each mapping
    for m in ms_data["mappings"]:
        src_urn = m["source_urn"]
        tgt_urn = m["target_urn"]

        # Resolve source node
        src_node_id = src_urn_map.get(src_urn)
        if not src_node_id:
            # Fallback: extract ref_id from URN
            src_ref = _extract_ref_from_urn(src_urn)
            if src_ref:
                src_node_id = src_ref_map.get(src_ref.lower())
        if not src_node_id:
            total_result.errors.append(f"Source node not found: {src_urn}")
            total_result.skipped += 1
            continue

        # Resolve target node
        tgt_node_id = tgt_urn_map.get(tgt_urn)
        if not tgt_node_id:
            tgt_ref = _extract_ref_from_urn(tgt_urn)
            if tgt_ref:
                tgt_node_id = tgt_ref_map.get(tgt_ref.lower())
        if not tgt_node_id:
            total_result.errors.append(f"Target node not found: {tgt_urn}")
            total_result.skipped += 1
            continue

        # Check for duplicate
        dup_q = select(FrameworkMapping).where(
            FrameworkMapping.source_requirement_id == src_node_id,
            FrameworkMapping.target_requirement_id == tgt_node_id,
        )
        if (await s.execute(dup_q)).scalar_one_or_none():
            total_result.skipped += 1
            continue

        fm = FrameworkMapping(
            mapping_set_id=ms.id,
            source_framework_id=src_fw.id,
            source_requirement_id=src_node_id,
            target_framework_id=tgt_fw.id,
            target_requirement_id=tgt_node_id,
            relationship_type=m["relationship"],
            strength=m["strength"],
            rationale=m.get("rationale"),
            mapping_source="import",
            mapping_status="draft",
        )
        s.add(fm)
        total_result.created += 1

    await s.flush()

    # Auto-revert: generate inverse mappings
    if auto_revert and total_result.created > 0:
        rev_q = select(MappingSet).where(
            MappingSet.source_framework_id == tgt_fw.id,
            MappingSet.target_framework_id == src_fw.id,
        )
        rev_ms = (await s.execute(rev_q)).scalar_one_or_none()
        if not rev_ms:
            rev_ms = MappingSet(
                source_framework_id=tgt_fw.id,
                target_framework_id=src_fw.id,
                name=f"{tgt_fw.name} <-> {src_fw.name} (revert)",
            )
            s.add(rev_ms)
            await s.flush()
            ms.revert_set_id = rev_ms.id

        # Create inverse mappings from newly created forward mappings
        fwd_q = select(FrameworkMapping).where(
            FrameworkMapping.mapping_set_id == ms.id,
        )
        for fm in (await s.execute(fwd_q)).scalars().all():
            rev_dup = select(FrameworkMapping).where(
                FrameworkMapping.source_requirement_id == fm.target_requirement_id,
                FrameworkMapping.target_requirement_id == fm.source_requirement_id,
            )
            if (await s.execute(rev_dup)).scalar_one_or_none():
                continue

            rev_m = FrameworkMapping(
                mapping_set_id=rev_ms.id,
                source_framework_id=fm.target_framework_id,
                source_requirement_id=fm.target_requirement_id,
                target_framework_id=fm.source_framework_id,
                target_requirement_id=fm.source_requirement_id,
                relationship_type=revert_relationship(fm.relationship_type),
                strength=fm.strength,
                rationale=fm.rationale,
                mapping_source="import",
                mapping_status="draft",
            )
            s.add(rev_m)
            total_result.revert_created += 1

        await s.flush()

        # Recalc revert set stats
        from sqlalchemy import func
        rev_count = (await s.execute(
            select(func.count()).where(FrameworkMapping.mapping_set_id == rev_ms.id)
        )).scalar() or 0
        rev_ms.mapping_count = rev_count

    # Recalc forward set stats
    from sqlalchemy import func
    fwd_count = (await s.execute(
        select(func.count()).where(FrameworkMapping.mapping_set_id == ms.id)
    )).scalar() or 0
    ms.mapping_count = fwd_count

    await s.commit()

    log.info(
        "Mapping import complete: created=%d, revert=%d, skipped=%d, errors=%d",
        total_result.created, total_result.revert_created,
        total_result.skipped, len(total_result.errors),
    )

    return total_result
