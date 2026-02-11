"""
Framework Import Service — parses CISO Assistant Excel/YAML files.

Supports:
  - Excel v2 format (tabs: library_content + framework nodes)
  - YAML native format
  - Default dimension creation when framework has no scale defined
"""
from __future__ import annotations

import io
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, BinaryIO

import yaml
from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.framework import (
    AssessmentDimension, DimensionLevel, Framework, FrameworkNode,
)

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Default scale (used when framework has none)
# ─────────────────────────────────────────────

DEFAULT_DIMENSION = {
    "dimension_key": "compliance_level",
    "name": "Compliance Level",
    "name_pl": "Poziom zgodności",
    "levels": [
        {"order": 0, "value": 0.00, "label": "Not implemented", "label_pl": "Niezaimplementowane", "color": "#EF4444"},
        {"order": 1, "value": 0.33, "label": "Partially implemented", "label_pl": "Częściowo", "color": "#EAB308"},
        {"order": 2, "value": 0.66, "label": "Largely implemented", "label_pl": "W dużej mierze", "color": "#22C55E"},
        {"order": 3, "value": 1.00, "label": "Fully implemented", "label_pl": "W pełni", "color": "#16A34A"},
    ],
}


async def _create_default_dimensions(s: AsyncSession, fw: Framework) -> int:
    """Create the default single-dimension scale for a framework."""
    d = DEFAULT_DIMENSION
    dim = AssessmentDimension(
        framework_id=fw.id,
        dimension_key=d["dimension_key"],
        name=d["name"],
        name_pl=d["name_pl"],
        order_id=1,
        weight=Decimal("1.00"),
    )
    s.add(dim)
    await s.flush()

    for lvl_data in d["levels"]:
        s.add(DimensionLevel(
            dimension_id=dim.id,
            level_order=lvl_data["order"],
            value=Decimal(str(lvl_data["value"])),
            label=lvl_data["label"],
            label_pl=lvl_data["label_pl"],
            color=lvl_data["color"],
        ))

    return 1  # 1 dimension created


async def _create_dimensions_from_score_def(
    s: AsyncSession, fw: Framework, score_def: list[dict]
) -> int:
    """Create dimensions + levels from a CISO Assistant score definition."""
    count = 0
    for idx, dim_def in enumerate(score_def):
        dim = AssessmentDimension(
            framework_id=fw.id,
            dimension_key=dim_def.get("key", f"dim_{idx+1}"),
            name=dim_def.get("name", f"Dimension {idx+1}"),
            name_pl=dim_def.get("name_pl"),
            order_id=idx + 1,
            weight=Decimal(str(dim_def.get("weight", 1.0))),
        )
        s.add(dim)
        await s.flush()

        for lvl_idx, lvl_data in enumerate(dim_def.get("levels", [])):
            s.add(DimensionLevel(
                dimension_id=dim.id,
                level_order=lvl_idx,
                value=Decimal(str(lvl_data.get("value", 0))),
                label=lvl_data.get("label", ""),
                label_pl=lvl_data.get("label_pl"),
                color=lvl_data.get("color"),
            ))
        count += 1
    return count


# ═══════════════════════════════════════════════
# EXCEL PARSER (CISO Assistant v2 format)
# ═══════════════════════════════════════════════

async def import_from_excel(
    s: AsyncSession, file: BinaryIO, imported_by: str = "admin"
) -> Framework:
    """Import framework from CISO Assistant Excel v2 format."""
    wb = load_workbook(file, read_only=True, data_only=True)

    # 1. Read library_content metadata tab
    meta = _read_excel_metadata(wb)

    # 2. Check for duplicate URN
    fw_urn = meta.get("framework_urn")
    if fw_urn:
        existing = (await s.execute(
            select(Framework).where(Framework.urn == fw_urn)
        )).scalar_one_or_none()
        if existing:
            raise ValueError(f"Framework with URN '{fw_urn}' already exists (id={existing.id})")

    # 3. Create Framework record
    fw = Framework(
        urn=fw_urn,
        ref_id=meta.get("framework_ref_id") or meta.get("ref_id"),
        name=meta.get("framework_name") or meta.get("library_name", "Unnamed Framework"),
        description=meta.get("framework_description") or meta.get("library_description"),
        version=meta.get("library_version"),
        provider=meta.get("library_provider"),
        packager=meta.get("library_packager"),
        copyright=meta.get("library_copyright"),
        source_format="ciso_assistant_excel",
        locale=meta.get("library_locale", "en"),
        implementation_groups_definition=meta.get("implementation_groups_definition"),
        imported_at=datetime.utcnow(),
        imported_by=imported_by,
    )
    s.add(fw)
    await s.flush()

    # 4. Read nodes from framework tab
    tab_name = meta.get("framework_ref_id") or meta.get("ref_id")
    nodes_data = _read_excel_nodes(wb, tab_name)

    # 5. Insert nodes
    total, assessable = await _insert_nodes(s, fw, nodes_data)
    fw.total_nodes = total
    fw.total_assessable = assessable

    # 6. Create dimensions
    score_def = meta.get("score_definition")
    if score_def and isinstance(score_def, list):
        dims_count = await _create_dimensions_from_score_def(s, fw, score_def)
    else:
        dims_count = await _create_default_dimensions(s, fw)

    wb.close()
    return fw


def _read_excel_metadata(wb) -> dict[str, Any]:
    """Read the library_content tab for metadata."""
    meta = {}

    if "library_content" not in wb.sheetnames:
        # Try first sheet as fallback
        return meta

    ws = wb["library_content"]

    for row in ws.iter_rows(min_row=1, max_col=2, values_only=True):
        if row[0] and row[1]:
            key = str(row[0]).strip().lower()
            val = row[1]
            # Normalize keys
            key = key.replace(" ", "_")
            meta[key] = val

    # Parse JSON fields
    for json_key in ("implementation_groups_definition", "score_definition"):
        if json_key in meta and isinstance(meta[json_key], str):
            import json
            try:
                meta[json_key] = json.loads(meta[json_key])
            except (json.JSONDecodeError, TypeError):
                pass

    return meta


def _read_excel_nodes(wb, tab_name: str | None) -> list[dict]:
    """Read the framework nodes from the named tab."""
    # Find the right tab
    ws = None
    if tab_name and tab_name in wb.sheetnames:
        ws = wb[tab_name]
    else:
        # Try tabs that aren't 'library_content'
        for name in wb.sheetnames:
            if name.lower() != "library_content":
                ws = wb[name]
                break

    if ws is None:
        return []

    # Read header row
    headers = []
    for cell in next(ws.iter_rows(min_row=1, max_row=1, values_only=True)):
        headers.append(str(cell).strip().lower() if cell else "")

    nodes = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        row_dict = {}
        for i, val in enumerate(row):
            if i < len(headers) and headers[i]:
                row_dict[headers[i]] = val
        if row_dict.get("ref_id") or row_dict.get("name"):
            nodes.append(row_dict)

    return nodes


# ═══════════════════════════════════════════════
# YAML PARSER (CISO Assistant native format)
# ═══════════════════════════════════════════════

async def import_from_yaml(
    s: AsyncSession, file: BinaryIO, imported_by: str = "admin"
) -> Framework:
    """Import framework from CISO Assistant YAML format."""
    content = file.read()
    if isinstance(content, bytes):
        content = content.decode("utf-8")
    data = yaml.safe_load(content)

    if not data:
        raise ValueError("Empty YAML file")

    # Handle both library wrapper and direct framework format
    fw_data = data
    if "objects" in data:
        # Library wrapper format
        for obj in data["objects"]:
            if obj.get("type") == "framework":
                fw_data = obj
                break

    # Check for duplicate URN
    fw_urn = fw_data.get("urn")
    if fw_urn:
        existing = (await s.execute(
            select(Framework).where(Framework.urn == fw_urn)
        )).scalar_one_or_none()
        if existing:
            raise ValueError(f"Framework with URN '{fw_urn}' already exists (id={existing.id})")

    # Create Framework record
    fw = Framework(
        urn=fw_urn,
        ref_id=fw_data.get("ref_id"),
        name=fw_data.get("name", "Unnamed Framework"),
        description=fw_data.get("description"),
        version=fw_data.get("version") or data.get("version"),
        provider=fw_data.get("provider") or data.get("provider"),
        packager=fw_data.get("packager") or data.get("packager"),
        copyright=fw_data.get("copyright") or data.get("copyright"),
        source_format="ciso_assistant_yaml",
        locale=fw_data.get("locale") or data.get("locale", "en"),
        implementation_groups_definition=fw_data.get("implementation_groups_definition"),
        imported_at=datetime.utcnow(),
        imported_by=imported_by,
    )
    s.add(fw)
    await s.flush()

    # Parse nodes
    req_nodes = fw_data.get("requirement_nodes", [])
    nodes_data = _flatten_yaml_nodes(req_nodes)

    total, assessable = await _insert_nodes(s, fw, nodes_data)
    fw.total_nodes = total
    fw.total_assessable = assessable

    # Create dimensions
    score_def = fw_data.get("scores") or fw_data.get("score_definition")
    if score_def and isinstance(score_def, list):
        await _create_dimensions_from_score_def(s, fw, score_def)
    else:
        await _create_default_dimensions(s, fw)

    return fw


def _flatten_yaml_nodes(nodes: list[dict], depth: int = 1) -> list[dict]:
    """Flatten hierarchical YAML nodes into a flat list with depth info."""
    result = []
    for node in nodes:
        flat = {
            "urn": node.get("urn"),
            "ref_id": node.get("ref_id"),
            "name": node.get("name", ""),
            "description": node.get("description"),
            "depth": node.get("depth", depth),
            "assessable": node.get("assessable", False),
            "implementation_groups": node.get("implementation_groups"),
            "annotation": node.get("annotation"),
            "typical_evidence": node.get("typical_evidence"),
            "threats": node.get("threats"),
            "reference_controls": node.get("reference_controls"),
        }
        result.append(flat)

        children = node.get("children", [])
        if children:
            result.extend(_flatten_yaml_nodes(children, depth + 1))

    return result


# ═══════════════════════════════════════════════
# SHARED: Insert nodes from flat list
# ═══════════════════════════════════════════════

async def _insert_nodes(
    s: AsyncSession, fw: Framework, nodes_data: list[dict]
) -> tuple[int, int]:
    """Insert framework nodes. Returns (total, assessable) counts."""
    if not nodes_data:
        return (0, 0)

    total = 0
    assessable = 0

    # Track parent stack by depth for auto-parenting
    parent_stack: dict[int, int] = {}  # depth → node_id

    for idx, nd in enumerate(nodes_data):
        depth = int(nd.get("depth", 1))
        is_assessable = bool(nd.get("assessable", False))

        # Determine parent
        parent_id = None
        if depth > 1:
            # Find parent at depth-1
            parent_id = parent_stack.get(depth - 1)

        ig = nd.get("implementation_groups")
        if ig and isinstance(ig, list):
            ig = ",".join(str(x) for x in ig)

        threats = nd.get("threats")
        if threats and isinstance(threats, str):
            threats = None  # Only store if dict/list

        ref_controls = nd.get("reference_controls")
        if ref_controls and isinstance(ref_controls, str):
            ref_controls = None

        node = FrameworkNode(
            framework_id=fw.id,
            parent_id=parent_id,
            urn=nd.get("urn"),
            ref_id=str(nd["ref_id"]) if nd.get("ref_id") else None,
            name=str(nd.get("name", "")),
            name_pl=nd.get("name_pl"),
            description=nd.get("description"),
            description_pl=nd.get("description_pl"),
            depth=depth,
            order_id=idx + 1,
            assessable=is_assessable,
            implementation_groups=ig,
            annotation=nd.get("annotation"),
            threats=threats if isinstance(threats, (dict, list)) else None,
            reference_controls=ref_controls if isinstance(ref_controls, (dict, list)) else None,
            typical_evidence=nd.get("typical_evidence"),
        )
        s.add(node)
        await s.flush()  # Get the ID

        parent_stack[depth] = node.id
        total += 1
        if is_assessable:
            assessable += 1

    return (total, assessable)
