"""
Framework import service — parses CISO Assistant Excel/YAML files
and creates Framework + FrameworkNodes + Dimensions + Levels.
"""
import io
from datetime import datetime
from decimal import Decimal

import yaml
from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.framework import (
    AssessmentDimension,
    DimensionLevel,
    Framework,
    FrameworkNode,
)


# ═══════════════════ Default scale (fallback) ═══════════════════

DEFAULT_DIMENSION = {
    "dimension_key": "compliance_level",
    "name": "Compliance Level",
    "name_pl": "Poziom zgodności",
    "levels": [
        {"level_order": 0, "value": "0.00", "label": "Not implemented",  "label_pl": "Niezaimplementowane", "color": "#EF4444"},
        {"level_order": 1, "value": "0.33", "label": "Partially implemented", "label_pl": "Częściowo",        "color": "#EAB308"},
        {"level_order": 2, "value": "0.66", "label": "Largely implemented",  "label_pl": "W dużej mierze",    "color": "#22C55E"},
        {"level_order": 3, "value": "1.00", "label": "Fully implemented",    "label_pl": "W pełni",           "color": "#16A34A"},
    ],
}


# ═══════════════════ Excel Parser ═══════════════════

async def import_from_excel(
    session: AsyncSession,
    file_bytes: bytes,
    filename: str = "",
    imported_by: str = "system",
) -> Framework:
    """Parse a CISO Assistant Excel (.xlsx) file and insert framework."""
    wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)

    # ── Read library_content tab ──
    if "library_content" not in wb.sheetnames:
        raise ValueError("Excel file missing 'library_content' tab")
    lc = wb["library_content"]

    meta: dict[str, str] = {}
    for row in lc.iter_rows(min_row=1, max_col=2, values_only=True):
        if row[0] and row[1]:
            meta[str(row[0]).strip()] = str(row[1]).strip()

    urn = meta.get("framework_urn", meta.get("library_urn", ""))
    ref_id = meta.get("framework_ref_id", meta.get("ref_id", ""))
    name = meta.get("framework_name", meta.get("library_name", filename))

    if not urn:
        raise ValueError("Cannot determine framework URN from library_content")

    # Check for duplicate URN
    existing = (await session.execute(
        select(Framework).where(Framework.urn == urn)
    )).scalar_one_or_none()
    if existing:
        raise ValueError(f"Framework with URN '{urn}' already exists (id={existing.id})")

    fw = Framework(
        urn=urn,
        ref_id=ref_id or urn.split(":")[-1],
        name=name,
        description=meta.get("framework_description", meta.get("library_description", "")),
        version=meta.get("library_version", ""),
        provider=meta.get("library_provider", ""),
        packager=meta.get("library_packager", "intuitem"),
        copyright=meta.get("library_copyright", ""),
        source_format="ciso_assistant_excel",
        locale=meta.get("library_locale", "en"),
        imported_at=datetime.utcnow(),
        imported_by=imported_by,
    )

    # Parse implementation_groups_definition if present
    ig_def = meta.get("implementation_groups_definition")
    if ig_def:
        try:
            fw.implementation_groups_definition = yaml.safe_load(ig_def)
        except Exception:
            pass

    session.add(fw)
    await session.flush()

    # ── Read requirement nodes tab ──
    # Tab name = ref_id of the framework, or second sheet
    node_tab_name = ref_id or (wb.sheetnames[1] if len(wb.sheetnames) > 1 else None)
    if node_tab_name and node_tab_name in wb.sheetnames:
        ws = wb[node_tab_name]
    elif len(wb.sheetnames) > 1:
        ws = wb[wb.sheetnames[1]]
    else:
        raise ValueError("Cannot find requirement nodes tab in Excel file")

    # Read header row
    headers: list[str] = []
    for cell in next(ws.iter_rows(min_row=1, max_row=1, values_only=True)):
        headers.append(str(cell).strip().lower() if cell else "")

    def col(name: str, row_vals: tuple) -> str | None:
        if name in headers:
            idx = headers.index(name)
            val = row_vals[idx] if idx < len(row_vals) else None
            return str(val).strip() if val is not None else None
        return None

    # Track parent stack by depth
    parent_stack: dict[int, FrameworkNode] = {}
    order_counter: dict[int, int] = {}
    total_nodes = 0
    total_assessable = 0

    for row_vals in ws.iter_rows(min_row=2, values_only=True):
        depth_str = col("depth", row_vals)
        if not depth_str:
            continue
        try:
            depth = int(float(depth_str))
        except (ValueError, TypeError):
            continue

        node_ref_id = col("ref_id", row_vals) or ""
        node_name = col("name", row_vals) or col("description", row_vals) or node_ref_id
        if not node_name:
            continue

        assessable_str = col("assessable", row_vals)
        assessable = assessable_str and str(assessable_str).lower() in ("true", "1", "yes", "x")

        # Determine parent
        parent = parent_stack.get(depth - 1)

        # Order within depth group
        order_counter[depth] = order_counter.get(depth, 0) + 1

        node_urn = col("urn", row_vals) or ""
        if not node_urn and fw.urn:
            node_urn = f"{fw.urn}:{node_ref_id}" if node_ref_id else ""

        node = FrameworkNode(
            framework_id=fw.id,
            parent_id=parent.id if parent else None,
            urn=node_urn or None,
            ref_id=node_ref_id or None,
            name=node_name,
            description=col("description", row_vals),
            depth=depth,
            order_id=order_counter[depth],
            assessable=bool(assessable),
            implementation_groups=col("implementation_groups", row_vals),
            annotation=col("annotation", row_vals),
            typical_evidence=col("typical_evidence", row_vals),
        )
        session.add(node)
        await session.flush()

        parent_stack[depth] = node
        total_nodes += 1
        if assessable:
            total_assessable += 1

    fw.total_nodes = total_nodes
    fw.total_assessable = total_assessable

    # ── Create default dimension if none defined ──
    score_def = meta.get("score_definition")
    if score_def:
        try:
            _create_dimensions_from_score_def(session, fw, yaml.safe_load(score_def))
        except Exception:
            _create_default_dimension(session, fw)
    else:
        _create_default_dimension(session, fw)

    await session.flush()
    wb.close()
    return fw


def _create_default_dimension(session: AsyncSession, fw: Framework) -> None:
    dim = AssessmentDimension(
        framework_id=fw.id,
        dimension_key=DEFAULT_DIMENSION["dimension_key"],
        name=DEFAULT_DIMENSION["name"],
        name_pl=DEFAULT_DIMENSION["name_pl"],
        order_id=1,
        weight=Decimal("1.00"),
    )
    session.add(dim)
    # We need to flush to get dim.id, but this is called inside an already-flushed context
    # so we add levels directly referencing the dimension object
    for lvl in DEFAULT_DIMENSION["levels"]:
        session.add(DimensionLevel(
            dimension=dim,
            level_order=lvl["level_order"],
            value=Decimal(lvl["value"]),
            label=lvl["label"],
            label_pl=lvl["label_pl"],
            color=lvl["color"],
        ))


def _create_dimensions_from_score_def(
    session: AsyncSession, fw: Framework, score_def: list | dict,
) -> None:
    """Parse score_definition from library_content into dimensions+levels."""
    if isinstance(score_def, dict):
        score_def = [score_def]

    for idx, dim_def in enumerate(score_def):
        dim = AssessmentDimension(
            framework_id=fw.id,
            dimension_key=dim_def.get("key", f"dim_{idx+1}"),
            name=dim_def.get("name", f"Dimension {idx+1}"),
            name_pl=dim_def.get("name_pl"),
            order_id=idx + 1,
            weight=Decimal(str(dim_def.get("weight", "1.00"))),
        )
        session.add(dim)
        for lvl_idx, lvl_def in enumerate(dim_def.get("levels", [])):
            session.add(DimensionLevel(
                dimension=dim,
                level_order=lvl_idx,
                value=Decimal(str(lvl_def.get("value", 0))),
                label=lvl_def.get("label", ""),
                label_pl=lvl_def.get("label_pl"),
                color=lvl_def.get("color"),
            ))

    if not score_def:
        _create_default_dimension(session, fw)


# ═══════════════════ YAML Parser ═══════════════════

async def import_from_yaml(
    session: AsyncSession,
    file_bytes: bytes,
    filename: str = "",
    imported_by: str = "system",
) -> Framework:
    """Parse a CISO Assistant YAML file and insert framework."""
    data = yaml.safe_load(file_bytes)

    if not isinstance(data, dict):
        raise ValueError("Invalid YAML structure — expected a mapping at top level")

    urn = data.get("urn", "")
    ref_id = data.get("ref_id", "")
    name = data.get("name", filename)

    if not urn:
        raise ValueError("YAML missing required 'urn' field")

    existing = (await session.execute(
        select(Framework).where(Framework.urn == urn)
    )).scalar_one_or_none()
    if existing:
        raise ValueError(f"Framework with URN '{urn}' already exists (id={existing.id})")

    fw = Framework(
        urn=urn,
        ref_id=ref_id or urn.split(":")[-1],
        name=name,
        description=data.get("description", ""),
        version=data.get("version", ""),
        provider=data.get("provider", ""),
        packager=data.get("packager", "intuitem"),
        copyright=data.get("copyright", ""),
        source_format="ciso_assistant_yaml",
        locale=data.get("locale", "en"),
        imported_at=datetime.utcnow(),
        imported_by=imported_by,
    )

    ig = data.get("implementation_groups_definition")
    if ig and isinstance(ig, dict):
        fw.implementation_groups_definition = ig

    session.add(fw)
    await session.flush()

    # Parse nodes
    nodes = data.get("requirement_nodes", data.get("children", []))
    total_nodes, total_assessable = await _insert_yaml_nodes(session, fw.id, nodes, parent_id=None)
    fw.total_nodes = total_nodes
    fw.total_assessable = total_assessable

    # Dimensions
    score_def = data.get("scores", data.get("score_definition"))
    if score_def:
        _create_dimensions_from_score_def(session, fw, score_def)
    else:
        _create_default_dimension(session, fw)

    await session.flush()
    return fw


async def _insert_yaml_nodes(
    session: AsyncSession,
    framework_id: int,
    nodes: list[dict],
    parent_id: int | None,
    depth: int = 1,
) -> tuple[int, int]:
    total = 0
    assessable_count = 0

    for order, node_data in enumerate(nodes, start=1):
        assessable = node_data.get("assessable", False)
        node = FrameworkNode(
            framework_id=framework_id,
            parent_id=parent_id,
            urn=node_data.get("urn"),
            ref_id=node_data.get("ref_id"),
            name=node_data.get("name", node_data.get("description", "")),
            description=node_data.get("description"),
            depth=node_data.get("depth", depth),
            order_id=order,
            assessable=bool(assessable),
            implementation_groups=node_data.get("implementation_groups"),
            annotation=node_data.get("annotation"),
            typical_evidence=node_data.get("typical_evidence"),
        )
        session.add(node)
        await session.flush()

        total += 1
        if assessable:
            assessable_count += 1

        children = node_data.get("children", [])
        if children:
            child_total, child_assess = await _insert_yaml_nodes(
                session, framework_id, children, node.id, depth + 1,
            )
            total += child_total
            assessable_count += child_assess

    return total, assessable_count
