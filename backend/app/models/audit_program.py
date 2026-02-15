"""
Audit Program models — program planning, versioning, items, change requests,
audit trail, version diffs, suppliers, locations.

Spec: docs/SPECYFIKACJA_AUDIT_PROGRAM_v1.md
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


# ─── Audit Program ────────────────────────────────────────────


class AuditProgramV2(Base):
    """
    Versioned audit program with formal approval workflow.
    Table name 'audit_programs_v2' to coexist with legacy audit_programs during migration.
    """

    __tablename__ = "audit_programs_v2"
    __table_args__ = (
        CheckConstraint("period_end > period_start", name="chk_ap_period"),
        CheckConstraint("version >= 1", name="chk_ap_version"),
        Index("idx_apv2_version_group", "version_group_id"),
        Index("idx_apv2_status", "status"),
        Index("idx_apv2_owner", "owner_id"),
        Index("idx_apv2_year", "year"),
        Index("idx_apv2_period", "period_start", "period_end"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Identification
    ref_id: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Versioning
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    version_group_id: Mapped[int] = mapped_column(Integer, nullable=False)
    is_current_version: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    previous_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("audit_programs_v2.id", ondelete="SET NULL"),
    )

    # Period
    period_type: Mapped[str] = mapped_column(String(20), nullable=False, default="annual")
    period_start: Mapped[datetime] = mapped_column(Date, nullable=False)
    period_end: Mapped[datetime] = mapped_column(Date, nullable=False)
    year: Mapped[int | None] = mapped_column(Integer)

    # Context (ISO 19011 / IIA)
    strategic_objectives: Mapped[str | None] = mapped_column(Text)
    risks_and_opportunities: Mapped[str | None] = mapped_column(Text)
    scope_description: Mapped[str | None] = mapped_column(Text)
    audit_criteria: Mapped[str | None] = mapped_column(Text)
    methods: Mapped[str | None] = mapped_column(Text)
    risk_assessment_ref: Mapped[str | None] = mapped_column(Text)

    # Budget
    budget_planned_days: Mapped[Decimal | None] = mapped_column(Numeric(8, 1))
    budget_actual_days: Mapped[Decimal] = mapped_column(Numeric(8, 1), default=0)
    budget_planned_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    budget_actual_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    budget_currency: Mapped[str] = mapped_column(String(3), default="PLN")

    # KPI
    kpis: Mapped[dict | None] = mapped_column(JSON, default=list)

    # Continuation
    previous_program_id: Mapped[int | None] = mapped_column(Integer)

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime)
    status_changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    # Submission
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    submitted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    # Approval
    approval_justification: Mapped[str | None] = mapped_column(Text)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime)
    rejected_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    # Correction
    correction_reason: Mapped[str | None] = mapped_column(Text)
    correction_initiated_at: Mapped[datetime | None] = mapped_column(DateTime)
    correction_initiated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    # Roles
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    approver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Organization
    org_unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("org_units.id", ondelete="SET NULL"),
    )

    # Metadata
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # Relationships
    items: Mapped[list["AuditProgramItem"]] = relationship(
        back_populates="audit_program",
        cascade="all, delete-orphan",
        foreign_keys="AuditProgramItem.audit_program_id",
    )
    change_requests: Mapped[list["AuditProgramChangeRequest"]] = relationship(
        back_populates="audit_program",
        cascade="all, delete-orphan",
        foreign_keys="AuditProgramChangeRequest.audit_program_id",
    )
    history_entries: Mapped[list["AuditProgramHistory"]] = relationship(
        back_populates="audit_program",
        cascade="all, delete-orphan",
    )


# ─── Audit Program Items ─────────────────────────────────────


class AuditProgramItem(Base):
    """Planned audit within a program."""

    __tablename__ = "audit_program_items"
    __table_args__ = (
        Index("idx_api_program", "audit_program_id"),
        Index("idx_api_type", "audit_type"),
        Index("idx_api_status", "item_status"),
        Index("idx_api_quarter", "planned_quarter"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_program_id: Mapped[int] = mapped_column(
        ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False,
    )

    # Identification
    ref_id: Mapped[str | None] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Type
    audit_type: Mapped[str] = mapped_column(String(20), nullable=False, default="compliance")

    # Timing
    planned_quarter: Mapped[int | None] = mapped_column(Integer)
    planned_month: Mapped[int | None] = mapped_column(Integer)
    planned_start: Mapped[datetime | None] = mapped_column(Date)
    planned_end: Mapped[datetime | None] = mapped_column(Date)

    # Scope
    scope_type: Mapped[str | None] = mapped_column(String(30))
    scope_id: Mapped[int | None] = mapped_column(Integer)
    scope_name: Mapped[str | None] = mapped_column(String(300))

    # Framework / criteria
    framework_ids: Mapped[dict | None] = mapped_column(JSON, default=list)
    criteria_description: Mapped[str | None] = mapped_column(Text)

    # Resources
    planned_days: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    planned_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    # Priority
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    risk_rating: Mapped[str | None] = mapped_column(String(10))
    risk_justification: Mapped[str | None] = mapped_column(Text)

    # Team
    lead_auditor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    auditor_ids: Mapped[dict | None] = mapped_column(JSON, default=list)

    # Engagement link
    audit_engagement_id: Mapped[int | None] = mapped_column(Integer)

    # Status
    item_status: Mapped[str] = mapped_column(String(20), default="planned")
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    deferral_reason: Mapped[str | None] = mapped_column(Text)
    deferred_to_program_id: Mapped[int | None] = mapped_column(
        ForeignKey("audit_programs_v2.id", ondelete="SET NULL"),
    )

    # Method
    audit_method: Mapped[str] = mapped_column(String(20), default="on_site")

    # Display
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # Relationship
    audit_program: Mapped["AuditProgramV2"] = relationship(
        back_populates="items",
        foreign_keys=[audit_program_id],
    )


# ─── Change Requests ─────────────────────────────────────────


class AuditProgramChangeRequest(Base):
    """Formal change request for an approved program."""

    __tablename__ = "audit_program_change_requests"
    __table_args__ = (
        Index("idx_apcr_program", "audit_program_id"),
        Index("idx_apcr_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_program_id: Mapped[int] = mapped_column(
        ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False,
    )

    ref_id: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)

    change_type: Mapped[str] = mapped_column(String(20), nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    change_description: Mapped[str] = mapped_column(Text, nullable=False)
    impact_assessment: Mapped[str | None] = mapped_column(Text)

    affected_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("audit_program_items.id", ondelete="SET NULL"),
    )
    proposed_changes: Mapped[dict | None] = mapped_column(JSON, default=dict)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime)

    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    review_comment: Mapped[str | None] = mapped_column(Text)

    resulting_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("audit_programs_v2.id", ondelete="SET NULL"),
    )
    implemented_at: Mapped[datetime | None] = mapped_column(DateTime)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # Relationship
    audit_program: Mapped["AuditProgramV2"] = relationship(
        back_populates="change_requests",
        foreign_keys=[audit_program_id],
    )


# ─── Audit Program History ───────────────────────────────────


class AuditProgramHistory(Base):
    """Audit trail for all program changes."""

    __tablename__ = "audit_program_history"
    __table_args__ = (
        Index("idx_aph_program", "audit_program_id"),
        Index("idx_aph_entity", "entity_type", "entity_id"),
        Index("idx_aph_action", "action"),
        Index("idx_aph_date", "performed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    entity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    audit_program_id: Mapped[int] = mapped_column(
        ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False,
    )

    action: Mapped[str] = mapped_column(String(30), nullable=False)
    field_changes: Mapped[dict | None] = mapped_column(JSON)
    description: Mapped[str | None] = mapped_column(Text)
    justification: Mapped[str | None] = mapped_column(Text)

    change_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("audit_program_change_requests.id", ondelete="SET NULL"),
    )
    related_program_id: Mapped[int | None] = mapped_column(Integer)

    performed_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    performed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(500))

    # Relationship
    audit_program: Mapped["AuditProgramV2"] = relationship(
        back_populates="history_entries",
        foreign_keys=[audit_program_id],
    )


# ─── Version Diffs ───────────────────────────────────────────


class AuditProgramVersionDiff(Base):
    """Auto-generated diff between two versions of a program."""

    __tablename__ = "audit_program_version_diffs"
    __table_args__ = (
        UniqueConstraint("from_version_id", "to_version_id", name="uq_apvd_versions"),
        Index("idx_apvd_group", "version_group_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version_group_id: Mapped[int] = mapped_column(Integer, nullable=False)
    from_version_id: Mapped[int] = mapped_column(
        ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False,
    )
    to_version_id: Mapped[int] = mapped_column(
        ForeignKey("audit_programs_v2.id", ondelete="CASCADE"), nullable=False,
    )
    from_version: Mapped[int] = mapped_column(Integer, nullable=False)
    to_version: Mapped[int] = mapped_column(Integer, nullable=False)

    program_field_changes: Mapped[dict | None] = mapped_column(JSON, default=dict)
    items_added: Mapped[dict | None] = mapped_column(JSON, default=list)
    items_removed: Mapped[dict | None] = mapped_column(JSON, default=list)
    items_modified: Mapped[dict | None] = mapped_column(JSON, default=list)
    items_unchanged: Mapped[int] = mapped_column(Integer, default=0)

    summary: Mapped[str | None] = mapped_column(Text)
    change_request_ids: Mapped[dict | None] = mapped_column(JSON, default=list)

    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


# ─── Supplier ────────────────────────────────────────────────


class Supplier(Base):
    """External supplier / vendor for second-party audits."""

    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    contact_info: Mapped[str | None] = mapped_column(Text)
    criticality: Mapped[str] = mapped_column(String(10), default="medium")
    data_classification: Mapped[str] = mapped_column(String(20), default="internal")
    contract_ref: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="active")
    org_unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("org_units.id", ondelete="SET NULL"),
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )


# ─── Location ────────────────────────────────────────────────


class Location(Base):
    """Physical location for physical security audits."""

    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    location_type: Mapped[str] = mapped_column(String(20), nullable=False, default="office")
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    criticality: Mapped[str] = mapped_column(String(10), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="active")
    org_unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("org_units.id", ondelete="SET NULL"),
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )
