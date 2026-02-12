"""
Automatic audit logging for SQLAlchemy model changes.

Hooks into SQLAlchemy ORM events to capture INSERT, UPDATE, and DELETE
operations and persist them as AuditLog entries without requiring manual
calls in every router.

Usage:
    from app.middleware.audit_auto import install_audit_listeners, set_audit_context

    # At application startup (e.g. in main.py lifespan):
    install_audit_listeners()

    # In request middleware or dependency:
    set_audit_context(user_id=current_user.id, ip_address=request.client.host)
"""
from __future__ import annotations

import contextvars
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.base import Base

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Context variables – set per-request so event listeners can read them.
# ---------------------------------------------------------------------------
_ctx_user_id: contextvars.ContextVar[int | None] = contextvars.ContextVar(
    "_ctx_user_id", default=None
)
_ctx_ip_address: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "_ctx_ip_address", default=None
)


def set_audit_context(
    *,
    user_id: int | None = None,
    ip_address: str | None = None,
) -> None:
    """Store the current request's user and IP so audit listeners can use them."""
    _ctx_user_id.set(user_id)
    _ctx_ip_address.set(ip_address)


# ---------------------------------------------------------------------------
# Tables to exclude from automatic auditing.
# ---------------------------------------------------------------------------
_EXCLUDED_TABLES: set[str] = {"audit_log", "alembic_version"}

# ---------------------------------------------------------------------------
# Table name -> module name mapping.
#
# Tables whose prefix already matches a module are handled by the fallback
# logic (first segment before "_" or the full name).  Explicit overrides go
# here for cases where the mapping is not obvious.
# ---------------------------------------------------------------------------
_TABLE_MODULE_MAP: dict[str, str] = {
    # Org context tables
    "org_context_issues": "org_context",
    "org_context_obligations": "org_context",
    "org_context_stakeholders": "org_context",
    "org_context_scope": "org_context",
    "org_context_risk_appetite": "org_context",
    "org_context_reviews": "org_context",
    "org_context_snapshots": "org_context",
    # Org unit tables
    "org_levels": "org_units",
    "org_units": "org_units",
    # Risk tables
    "risks": "risks",
    "risk_threats": "risks",
    "risk_vulnerabilities": "risks",
    "risk_safeguards": "risks",
    "risk_review_config": "risks",
    "risk_reviews": "risks",
    # Asset tables
    "assets": "assets",
    "asset_relationships": "assets",
    # Policy tables
    "policies": "policies",
    "policy_standard_mappings": "policies",
    "policy_acknowledgments": "policies",
    "policy_exceptions": "policies",
    # Framework / assessment tables
    "frameworks": "frameworks",
    "framework_nodes": "frameworks",
    "framework_node_security_areas": "frameworks",
    "assessment_dimensions": "frameworks",
    "dimension_levels": "frameworks",
    "assessments": "frameworks",
    "assessment_answers": "frameworks",
    # CIS tables
    "cis_controls": "cis",
    "cis_sub_controls": "cis",
    "cis_attack_mapping": "cis",
    "cis_assessments": "cis",
    "cis_assessment_answers": "cis",
    # Action tables
    "actions": "actions",
    "action_links": "actions",
    "action_history": "actions",
    # Incident tables
    "incidents": "incidents",
    "incident_risks": "incidents",
    "incident_vulnerabilities": "incidents",
    # Vendor tables
    "vendors": "vendors",
    "vendor_assessments": "vendors",
    "vendor_assessment_answers": "vendors",
    # Awareness tables
    "awareness_campaigns": "awareness",
    "awareness_results": "awareness",
    "awareness_employee_reports": "awareness",
    # Audit register tables
    "audits": "audit_register",
    "audit_findings": "audit_register",
    # Security tables
    "security_domains": "security_areas",
    "domain_cis_controls": "security_areas",
    "security_score_config": "security_score",
    "security_score_snapshots": "security_score",
    # Catalog tables
    "threats": "catalog",
    "vulnerabilities": "catalog",
    "safeguards": "catalog",
    # Vulnerability registry
    "vulnerabilities_registry": "vulnerabilities",
    # Dictionary tables
    "dictionary_types": "dictionary",
    "dictionary_entries": "dictionary",
    # User tables
    "users": "users",
}


def _resolve_module(table_name: str) -> str:
    """Return the module name for a given table name."""
    if table_name in _TABLE_MODULE_MAP:
        return _TABLE_MODULE_MAP[table_name]
    # Fallback: use the table name itself as the module.
    return table_name


def _get_entity_id(obj: Any) -> int:
    """Return the primary key value for an ORM instance.

    Handles composite keys by returning only the first column value, which
    covers the vast majority of tables in this project.
    """
    mapper = inspect(type(obj))
    pk_cols = mapper.primary_key
    if pk_cols:
        val = getattr(obj, pk_cols[0].name, None)
        return val if val is not None else 0
    return 0


# ---------------------------------------------------------------------------
# Event listeners
# ---------------------------------------------------------------------------

def _before_flush(session: Session, flush_context: Any, instances: Any) -> None:
    """Capture pending audit entries *before* the flush writes to the DB.

    At this point ``session.dirty`` objects still carry their old attribute
    values in the history, so we can diff them.
    """
    if session.info.get("_flushing_audit"):
        return

    pending: list[dict[str, Any]] = []

    # -- UPDATES -----------------------------------------------------------
    for obj in session.dirty:
        if not isinstance(obj, Base):
            continue
        table_name = obj.__class__.__tablename__
        if table_name in _EXCLUDED_TABLES:
            continue
        if not session.is_modified(obj, include_collections=False):
            continue

        insp = inspect(obj)
        module = _resolve_module(table_name)
        entity_id = _get_entity_id(obj)

        for attr in insp.attrs:
            hist = attr.history
            if not hist.has_changes():
                continue
            key = attr.key
            # Skip relationship attributes – we only care about columns.
            if key not in {c.key for c in insp.mapper.column_attrs}:
                continue

            old_val = hist.deleted[0] if hist.deleted else None
            new_val = hist.added[0] if hist.added else None

            pending.append({
                "module": module,
                "action": "update",
                "entity_type": table_name,
                "entity_id": entity_id,
                "field_name": key,
                "old_value": str(old_val) if old_val is not None else None,
                "new_value": str(new_val) if new_val is not None else None,
            })

    # -- INSERTS -----------------------------------------------------------
    for obj in session.new:
        if not isinstance(obj, Base):
            continue
        table_name = obj.__class__.__tablename__
        if table_name in _EXCLUDED_TABLES:
            continue

        pending.append({
            "module": _resolve_module(table_name),
            "action": "create",
            "entity_type": table_name,
            "entity_id": None,  # resolved after flush assigns PK
            "field_name": None,
            "old_value": None,
            "new_value": None,
            "_obj_ref": obj,  # keep reference so we can read PK after flush
        })

    # -- DELETES -----------------------------------------------------------
    for obj in session.deleted:
        if not isinstance(obj, Base):
            continue
        table_name = obj.__class__.__tablename__
        if table_name in _EXCLUDED_TABLES:
            continue

        pending.append({
            "module": _resolve_module(table_name),
            "action": "delete",
            "entity_type": table_name,
            "entity_id": _get_entity_id(obj),
            "field_name": None,
            "old_value": None,
            "new_value": None,
        })

    session.info["_audit_pending"] = pending


def _after_flush(session: Session, flush_context: Any) -> None:
    """Create AuditLog rows from the pending entries collected before flush."""
    if session.info.get("_flushing_audit"):
        return

    pending: list[dict[str, Any]] = session.info.pop("_audit_pending", [])
    if not pending:
        return

    user_id = _ctx_user_id.get()
    ip_address = _ctx_ip_address.get()
    now = datetime.utcnow()

    session.info["_flushing_audit"] = True
    try:
        for entry in pending:
            # For CREATE entries, resolve the entity_id now that the PK is
            # available after the flush.
            entity_id = entry["entity_id"]
            if entity_id is None:
                obj_ref = entry.get("_obj_ref")
                entity_id = _get_entity_id(obj_ref) if obj_ref is not None else 0

            session.add(AuditLog(
                user_id=user_id,
                module=entry["module"],
                action=entry["action"],
                entity_type=entry["entity_type"],
                entity_id=entity_id,
                field_name=entry.get("field_name"),
                old_value=entry.get("old_value"),
                new_value=entry.get("new_value"),
                ip_address=ip_address,
                created_at=now,
            ))
    except Exception:
        logger.exception("Failed to create automatic audit log entries")
    finally:
        session.info["_flushing_audit"] = False


# ---------------------------------------------------------------------------
# Public installer – called once at application startup.
# ---------------------------------------------------------------------------

def install_audit_listeners() -> None:
    """Register SQLAlchemy ORM event listeners for automatic audit logging."""
    event.listen(Session, "before_flush", _before_flush)
    event.listen(Session, "after_flush", _after_flush)
    logger.info("Automatic audit logging listeners installed")
