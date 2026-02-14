"""
Compliance & Audit models — compliance assessments, requirement assessments,
evidences, audit workflow, framework mappings, test templates.

Extends the existing Framework Engine (frameworks, framework_nodes) with
continuous compliance assessment, formal audit workflow (IIA-based),
cross-framework mapping, and a reusable test template catalog.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
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


# ─── Compliance Assessment ────────────────────────────────────


class ComplianceAssessment(Base):
    """Continuous or snapshot assessment of a framework within a scope."""

    __tablename__ = "compliance_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id"), nullable=False)

    scope_type: Mapped[str] = mapped_column(String(20), default="organization", nullable=False)
    scope_id: Mapped[int | None] = mapped_column(Integer)
    scope_name: Mapped[str | None] = mapped_column(String(300))

    assessment_type: Mapped[str] = mapped_column(String(20), default="continuous", nullable=False)
    scoring_mode: Mapped[str | None] = mapped_column(String(20))
    selected_impl_groups: Mapped[dict | None] = mapped_column(JSON)

    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    name: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)

    # Computed scores (recalculated on change)
    compliance_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    total_requirements: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    assessed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    compliant_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    partially_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    non_compliant_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    not_applicable_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_by: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    framework: Mapped["Framework"] = relationship()
    requirement_assessments: Mapped[list["RequirementAssessment"]] = relationship(
        back_populates="compliance_assessment", cascade="all, delete-orphan",
    )
    engagements: Mapped[list["AuditEngagement"]] = relationship(back_populates="compliance_assessment")


class RequirementAssessment(Base):
    """Assessment result for a single requirement within a compliance assessment."""

    __tablename__ = "requirement_assessments"
    __table_args__ = (
        UniqueConstraint("compliance_assessment_id", "requirement_node_id", name="uq_ra_assess_node"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    compliance_assessment_id: Mapped[int] = mapped_column(
        ForeignKey("compliance_assessments.id", ondelete="CASCADE"), nullable=False,
    )
    requirement_node_id: Mapped[int] = mapped_column(
        ForeignKey("framework_nodes.id"), nullable=False,
    )

    result: Mapped[str] = mapped_column(String(20), default="not_assessed", nullable=False)
    score: Mapped[int | None] = mapped_column(Integer)
    maturity_level: Mapped[str | None] = mapped_column(String(30))

    assessor_name: Mapped[str | None] = mapped_column(String(200))
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_audited_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_audited_by: Mapped[str | None] = mapped_column(String(200))

    notes: Mapped[str | None] = mapped_column(Text)
    justification: Mapped[str | None] = mapped_column(Text)
    selected: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    compliance_assessment: Mapped["ComplianceAssessment"] = relationship(back_populates="requirement_assessments")
    requirement_node: Mapped["FrameworkNode"] = relationship()
    evidences: Mapped[list["RequirementAssessmentEvidence"]] = relationship(
        back_populates="requirement_assessment", cascade="all, delete-orphan",
    )


# ─── Evidence ─────────────────────────────────────────────────


class Evidence(Base):
    """Shared evidence store — files, URLs, descriptions."""

    __tablename__ = "evidences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    evidence_type: Mapped[str] = mapped_column(String(20), default="description", nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(500))
    file_name: Mapped[str | None] = mapped_column(String(300))
    file_size: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(100))
    url: Mapped[str | None] = mapped_column(String(500))
    valid_from: Mapped[datetime | None] = mapped_column(Date)
    valid_until: Mapped[datetime | None] = mapped_column(Date)
    uploaded_by: Mapped[str | None] = mapped_column(String(200))
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id", ondelete="SET NULL"))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )


class RequirementAssessmentEvidence(Base):
    """M2M: evidence <-> requirement_assessment."""

    __tablename__ = "requirement_assessment_evidences"
    __table_args__ = (
        UniqueConstraint("requirement_assessment_id", "evidence_id", name="uq_rae"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requirement_assessment_id: Mapped[int] = mapped_column(
        ForeignKey("requirement_assessments.id", ondelete="CASCADE"), nullable=False,
    )
    evidence_id: Mapped[int] = mapped_column(
        ForeignKey("evidences.id", ondelete="CASCADE"), nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # relationships
    requirement_assessment: Mapped["RequirementAssessment"] = relationship(back_populates="evidences")
    evidence: Mapped["Evidence"] = relationship()


class ComplianceAssessmentHistory(Base):
    """Audit trail for changes to requirement assessments."""

    __tablename__ = "compliance_assessment_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requirement_assessment_id: Mapped[int] = mapped_column(
        ForeignKey("requirement_assessments.id", ondelete="CASCADE"), nullable=False,
    )
    field_name: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    change_reason: Mapped[str | None] = mapped_column(String(20))
    change_source: Mapped[str | None] = mapped_column(String(200))
    changed_by: Mapped[str | None] = mapped_column(String(200))
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


# ─── Audit Programs ───────────────────────────────────────────


class AuditProgram(Base):
    """Annual audit plan."""

    __tablename__ = "audit_programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    prepared_by: Mapped[str | None] = mapped_column(String(200))
    approved_by: Mapped[str | None] = mapped_column(String(200))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id", ondelete="SET NULL"))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    engagements: Mapped[list["AuditEngagement"]] = relationship(back_populates="audit_program")


# ─── Audit Engagements ────────────────────────────────────────


class AuditEngagement(Base):
    """Individual audit task with IIA lifecycle."""

    __tablename__ = "audit_engagements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_program_id: Mapped[int | None] = mapped_column(
        ForeignKey("audit_programs.id", ondelete="SET NULL"),
    )
    ref_id: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id"), nullable=False)
    compliance_assessment_id: Mapped[int | None] = mapped_column(
        ForeignKey("compliance_assessments.id", ondelete="SET NULL"),
    )

    scope_type: Mapped[str] = mapped_column(String(20), default="organization", nullable=False)
    scope_id: Mapped[int | None] = mapped_column(Integer)
    scope_name: Mapped[str | None] = mapped_column(String(300))

    objective: Mapped[str] = mapped_column(Text, nullable=False)
    methodology: Mapped[str | None] = mapped_column(Text)
    criteria: Mapped[str | None] = mapped_column(Text)

    planned_quarter: Mapped[int | None] = mapped_column(Integer)
    planned_start: Mapped[datetime | None] = mapped_column(Date)
    planned_end: Mapped[datetime | None] = mapped_column(Date)
    actual_start: Mapped[datetime | None] = mapped_column(Date)
    actual_end: Mapped[datetime | None] = mapped_column(Date)

    lead_auditor: Mapped[str] = mapped_column(String(200), nullable=False)
    supervisor: Mapped[str | None] = mapped_column(String(200))

    status: Mapped[str] = mapped_column(String(20), default="planned", nullable=False)
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime)
    priority: Mapped[str] = mapped_column(String(10), default="medium", nullable=False)

    created_by: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    audit_program: Mapped["AuditProgram | None"] = relationship(back_populates="engagements")
    framework: Mapped["Framework"] = relationship()
    compliance_assessment: Mapped["ComplianceAssessment | None"] = relationship(back_populates="engagements")
    tests: Mapped[list["AuditTest"]] = relationship(back_populates="engagement", cascade="all, delete-orphan")
    findings: Mapped[list["ComplianceAuditFinding"]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan",
    )
    report: Mapped["AuditReport | None"] = relationship(back_populates="engagement", uselist=False)
    auditors: Mapped[list["AuditEngagementAuditor"]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan",
    )
    scope_items: Mapped[list["AuditEngagementScope"]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan",
    )

    # Valid status transitions
    TRANSITIONS = {
        "planned": ["scoping", "cancelled"],
        "scoping": ["fieldwork", "cancelled"],
        "fieldwork": ["reporting", "cancelled"],
        "reporting": ["review"],
        "review": ["completed"],
        "completed": ["closed"],
    }

    def can_transition_to(self, target: str) -> bool:
        return target in self.TRANSITIONS.get(self.status, [])


class AuditEngagementAuditor(Base):
    """M2M: engagement <-> auditor team members."""

    __tablename__ = "audit_engagement_auditors"
    __table_args__ = (
        UniqueConstraint("audit_engagement_id", "auditor_name", name="uq_aea"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_engagement_id: Mapped[int] = mapped_column(
        ForeignKey("audit_engagements.id", ondelete="CASCADE"), nullable=False,
    )
    auditor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="auditor", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    engagement: Mapped["AuditEngagement"] = relationship(back_populates="auditors")


class AuditEngagementScope(Base):
    """M2M: engagement <-> requirement_nodes (audit scope)."""

    __tablename__ = "audit_engagement_scope"
    __table_args__ = (
        UniqueConstraint("audit_engagement_id", "requirement_node_id", name="uq_aes"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_engagement_id: Mapped[int] = mapped_column(
        ForeignKey("audit_engagements.id", ondelete="CASCADE"), nullable=False,
    )
    requirement_node_id: Mapped[int] = mapped_column(
        ForeignKey("framework_nodes.id"), nullable=False,
    )
    in_scope: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    engagement: Mapped["AuditEngagement"] = relationship(back_populates="scope_items")
    requirement_node: Mapped["FrameworkNode"] = relationship()


# ─── Test Templates ───────────────────────────────────────────


class TestTemplate(Base):
    """Reusable audit test template catalog."""

    __tablename__ = "test_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str | None] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    test_steps: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    expected_evidence: Mapped[list | None] = mapped_column(JSON, default=list)
    success_criteria: Mapped[str | None] = mapped_column(Text)
    failure_criteria: Mapped[str | None] = mapped_column(Text)
    test_type: Mapped[str] = mapped_column(String(20), default="both", nullable=False)
    category: Mapped[str | None] = mapped_column(String(30))
    difficulty: Mapped[str] = mapped_column(String(15), default="basic", nullable=False)
    estimated_hours: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    tags: Mapped[list | None] = mapped_column(JSON, default=list)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )


class TestTemplateRequirement(Base):
    """M2M: test_template <-> requirement_nodes."""

    __tablename__ = "test_template_requirements"
    __table_args__ = (
        UniqueConstraint("test_template_id", "requirement_node_id", name="uq_ttr"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    test_template_id: Mapped[int] = mapped_column(
        ForeignKey("test_templates.id", ondelete="CASCADE"), nullable=False,
    )
    requirement_node_id: Mapped[int] = mapped_column(
        ForeignKey("framework_nodes.id"), nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


# ─── Audit Tests ──────────────────────────────────────────────


class AuditTest(Base):
    """Test within an audit engagement."""

    __tablename__ = "audit_tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_engagement_id: Mapped[int] = mapped_column(
        ForeignKey("audit_engagements.id", ondelete="CASCADE"), nullable=False,
    )
    test_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("test_templates.id", ondelete="SET NULL"),
    )
    requirement_node_id: Mapped[int | None] = mapped_column(
        ForeignKey("framework_nodes.id", ondelete="SET NULL"),
    )

    ref_id: Mapped[str | None] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    test_steps: Mapped[str | None] = mapped_column(Text)
    expected_result: Mapped[str | None] = mapped_column(Text)
    test_type: Mapped[str] = mapped_column(String(20), default="design", nullable=False)

    actual_result: Mapped[str | None] = mapped_column(Text)
    test_result: Mapped[str] = mapped_column(String(20), default="not_tested", nullable=False)
    auditor_name: Mapped[str | None] = mapped_column(String(200))
    tested_at: Mapped[datetime | None] = mapped_column(DateTime)

    workpaper_ref: Mapped[str | None] = mapped_column(String(50))
    workpaper_notes: Mapped[str | None] = mapped_column(Text)
    sample_size: Mapped[int | None] = mapped_column(Integer)
    sample_description: Mapped[str | None] = mapped_column(Text)
    exceptions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    engagement: Mapped["AuditEngagement"] = relationship(back_populates="tests")
    requirement_node: Mapped["FrameworkNode | None"] = relationship()


# ─── Compliance Audit Findings ────────────────────────────────


class ComplianceAuditFinding(Base):
    """IIA-format audit finding within an engagement."""

    __tablename__ = "compliance_audit_findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_engagement_id: Mapped[int] = mapped_column(
        ForeignKey("audit_engagements.id", ondelete="CASCADE"), nullable=False,
    )
    ref_id: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)

    # IIA 4-element format
    condition_text: Mapped[str] = mapped_column(Text, nullable=False)
    criteria_text: Mapped[str] = mapped_column(Text, nullable=False)
    cause_text: Mapped[str | None] = mapped_column(Text)
    effect_text: Mapped[str | None] = mapped_column(Text)

    severity: Mapped[str] = mapped_column(String(15), default="medium", nullable=False)
    recommendation: Mapped[str | None] = mapped_column(Text)

    management_response: Mapped[str | None] = mapped_column(Text)
    management_response_by: Mapped[str | None] = mapped_column(String(200))
    management_response_at: Mapped[datetime | None] = mapped_column(DateTime)
    agreed: Mapped[bool | None] = mapped_column(Boolean)

    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime)
    target_date: Mapped[datetime | None] = mapped_column(Date)
    actual_close_date: Mapped[datetime | None] = mapped_column(Date)
    verified_by: Mapped[str | None] = mapped_column(String(200))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    verification_notes: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    engagement: Mapped["AuditEngagement"] = relationship(back_populates="findings")


# ─── Audit Reports ────────────────────────────────────────────


class AuditReport(Base):
    """Audit report for an engagement."""

    __tablename__ = "audit_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_engagement_id: Mapped[int] = mapped_column(
        ForeignKey("audit_engagements.id", ondelete="CASCADE"), nullable=False,
    )
    report_type: Mapped[str] = mapped_column(String(10), default="draft", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    executive_summary: Mapped[str | None] = mapped_column(Text)
    scope_description: Mapped[str | None] = mapped_column(Text)
    methodology_description: Mapped[str | None] = mapped_column(Text)
    findings_summary: Mapped[str | None] = mapped_column(Text)
    conclusion: Mapped[str | None] = mapped_column(Text)
    opinion: Mapped[str | None] = mapped_column(String(20))
    opinion_rationale: Mapped[str | None] = mapped_column(Text)

    prepared_by: Mapped[str | None] = mapped_column(String(200))
    prepared_at: Mapped[datetime | None] = mapped_column(DateTime)
    reviewed_by: Mapped[str | None] = mapped_column(String(200))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    review_notes: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(String(200))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)

    distributed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    distributed_at: Mapped[datetime | None] = mapped_column(DateTime)

    pdf_file_path: Mapped[str | None] = mapped_column(String(500))
    docx_file_path: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    engagement: Mapped["AuditEngagement"] = relationship(back_populates="report")


# ─── Framework Mappings ───────────────────────────────────────


# ─── Mapping Set ──────────────────────────────────────────────
# Groups mappings between a pair of frameworks (inspired by CISO Assistant)

# Set-theoretic relationship types (CISO Assistant approach)
RELATIONSHIP_TYPES = ("equal", "subset", "superset", "intersect", "not_related")

# Rationale types for how the mapping was derived
RATIONALE_TYPES = ("syntactic", "semantic", "functional")

# Mapping sources
MAPPING_SOURCES = ("manual", "ai_assisted", "scf_strm", "import")


def revert_relationship(relation: str) -> str:
    """Invert a relationship for bidirectional mapping (CISO Assistant pattern)."""
    if relation == "subset":
        return "superset"
    elif relation == "superset":
        return "subset"
    return relation  # equal, intersect, not_related are symmetric


class MappingSet(Base):
    """A group of mappings between two specific frameworks.

    Mirrors CISO Assistant's requirement_mapping_set concept: each set
    defines a directional mapping from source → target framework, with
    an optional auto-generated revert set for the inverse direction.
    """

    __tablename__ = "mapping_sets"
    __table_args__ = (
        UniqueConstraint("source_framework_id", "target_framework_id", name="uq_ms_src_tgt"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id"), nullable=False)
    target_framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id"), nullable=False)

    name: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)

    # Whether a revert (inverse) set has been auto-generated
    revert_set_id: Mapped[int | None] = mapped_column(ForeignKey("mapping_sets.id"))

    mapping_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    coverage_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    created_by: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    source_framework: Mapped["Framework"] = relationship(foreign_keys=[source_framework_id])
    target_framework: Mapped["Framework"] = relationship(foreign_keys=[target_framework_id])
    mappings: Mapped[list["FrameworkMapping"]] = relationship(
        back_populates="mapping_set", cascade="all, delete-orphan",
    )


class FrameworkMapping(Base):
    """Cross-framework requirement mapping.

    Uses CISO Assistant set-theoretic relationship types (equal, subset,
    superset, intersect, not_related) with numeric strength and rationale
    classification for formal compliance mapping.
    """

    __tablename__ = "framework_mappings"
    __table_args__ = (
        UniqueConstraint("source_requirement_id", "target_requirement_id", name="uq_fm"),
        Index("ix_fm_set", "mapping_set_id"),
        Index("ix_fm_src_fw", "source_framework_id"),
        Index("ix_fm_tgt_fw", "target_framework_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mapping_set_id: Mapped[int | None] = mapped_column(ForeignKey("mapping_sets.id", ondelete="SET NULL"))
    source_framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id"), nullable=False)
    source_requirement_id: Mapped[int] = mapped_column(ForeignKey("framework_nodes.id"), nullable=False)
    target_framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id"), nullable=False)
    target_requirement_id: Mapped[int] = mapped_column(ForeignKey("framework_nodes.id"), nullable=False)

    # Set-theoretic relationship (CISO Assistant style)
    relationship_type: Mapped[str] = mapped_column(String(20), default="intersect", nullable=False)
    # Numeric strength 1-3 (1=weak, 2=moderate, 3=strong)
    strength: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    # Classification of how the mapping was derived
    rationale_type: Mapped[str | None] = mapped_column(String(20))
    rationale: Mapped[str | None] = mapped_column(Text)

    # Source & workflow
    mapping_source: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    mapping_status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)

    # AI-assisted mapping metadata
    ai_score: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    ai_model: Mapped[str | None] = mapped_column(String(100))

    confirmed_by: Mapped[str | None] = mapped_column(String(200))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_by: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    mapping_set: Mapped["MappingSet | None"] = relationship(back_populates="mappings")
    source_framework: Mapped["Framework"] = relationship(foreign_keys=[source_framework_id])
    source_requirement: Mapped["FrameworkNode"] = relationship(foreign_keys=[source_requirement_id])
    target_framework: Mapped["Framework"] = relationship(foreign_keys=[target_framework_id])
    target_requirement: Mapped["FrameworkNode"] = relationship(foreign_keys=[target_requirement_id])


# Resolve forward references
from .framework import Framework, FrameworkNode  # noqa: F401, E402
