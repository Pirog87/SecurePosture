"""
Requirements Repository models — universal document & framework management system.

Formerly "Framework Engine" — now extended to serve as a Requirements Repository
(Repozytorium Wymagań) supporting frameworks, standards, regulations, policies,
procedures and other reference documents.

Tables: frameworks, framework_nodes, framework_versions, assessment_dimensions,
        dimension_levels, framework_node_security_areas, assessments, assessment_answers,
        framework_org_units, framework_reviews
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
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

# Lifecycle statuses for framework documents
LIFECYCLE_STATUSES = ("draft", "review", "published", "deprecated", "archived")

# Document origin types
DOCUMENT_ORIGINS = ("internal", "external")


class Framework(Base):
    """Reference document in the Requirements Repository.

    Covers: frameworks, ISO standards, legal regulations, internal policies,
    procedures, regulations, instructions, contracts, etc.
    """
    __tablename__ = "frameworks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[str | None] = mapped_column(String(500), unique=True, nullable=True)
    ref_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    version: Mapped[str | None] = mapped_column(String(50))
    provider: Mapped[str | None] = mapped_column(String(200))
    packager: Mapped[str | None] = mapped_column(String(200))
    copyright: Mapped[str | None] = mapped_column(Text)

    source_format: Mapped[str | None] = mapped_column(
        Enum("ciso_assistant_excel", "ciso_assistant_yaml", "custom_import", "manual",
             name="source_format_enum"),
    )
    source_url: Mapped[str | None] = mapped_column(String(1000))
    locale: Mapped[str] = mapped_column(String(10), default="en", nullable=False)

    implementation_groups_definition: Mapped[dict | list | None] = mapped_column(JSON)

    total_nodes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_assessable: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    imported_at: Mapped[datetime | None] = mapped_column(DateTime)
    imported_by: Mapped[str | None] = mapped_column(String(200))

    # ── Document Repository fields (Repozytorium Wymagań) ──
    document_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("dictionary_entries.id", ondelete="SET NULL"),
        comment="Type: Norma, Standard, Rozporządzenie, Polityka, Procedura, Regulamin, Instrukcja, Umowa",
    )
    document_origin: Mapped[str] = mapped_column(
        String(20), default="external", nullable=False,
        comment="internal = wewnętrzny, external = zewnętrzny",
    )
    owner: Mapped[str | None] = mapped_column(String(200), comment="Document owner / responsible person")
    approved_by: Mapped[str | None] = mapped_column(String(200))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Review management
    requires_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    review_frequency_months: Mapped[int] = mapped_column(Integer, default=12, nullable=False)
    next_review_date: Mapped[date | None] = mapped_column(Date)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    reviewed_by: Mapped[str | None] = mapped_column(String(200))

    # Version management (major.minor)
    major_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    minor_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Update proposal: links to the document this is a draft update for
    updates_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("frameworks.id", ondelete="SET NULL"),
        comment="If set, this is a draft update proposal for the referenced document",
    )

    # ── Lifecycle & versioning ──
    lifecycle_status: Mapped[str] = mapped_column(String(30), default="draft", nullable=False)
    edit_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    published_version: Mapped[str | None] = mapped_column(String(100))
    last_edited_by: Mapped[str | None] = mapped_column(String(200))
    last_edited_at: Mapped[datetime | None] = mapped_column(DateTime)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    nodes: Mapped[list["FrameworkNode"]] = relationship(
        back_populates="framework", cascade="all, delete-orphan",
    )
    dimensions: Mapped[list["AssessmentDimension"]] = relationship(
        back_populates="framework", cascade="all, delete-orphan",
    )
    assessments: Mapped[list["Assessment"]] = relationship(back_populates="framework")
    versions: Mapped[list["FrameworkVersionHistory"]] = relationship(
        back_populates="framework", cascade="all, delete-orphan",
        order_by="FrameworkVersionHistory.edit_version.desc()",
    )
    org_unit_links: Mapped[list["FrameworkOrgUnit"]] = relationship(
        back_populates="framework", cascade="all, delete-orphan",
    )
    reviews: Mapped[list["FrameworkReview"]] = relationship(
        back_populates="framework", cascade="all, delete-orphan",
        order_by="FrameworkReview.review_date.desc()",
    )
    # Self-referencing: document that this is an update proposal for
    updates_document: Mapped["Framework | None"] = relationship(
        remote_side="Framework.id", foreign_keys=[updates_document_id],
    )

    @property
    def display_version(self) -> str:
        """Human-readable version: e.g. '2.0' (approved) or '2.03' (draft)."""
        if self.minor_version == 0:
            return f"{self.major_version}.0"
        return f"{self.major_version}.{self.minor_version:02d}"


class FrameworkVersionHistory(Base):
    """Tracks each edit version of a framework for audit trail."""
    __tablename__ = "framework_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(
        ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False,
    )
    edit_version: Mapped[int] = mapped_column(Integer, nullable=False)
    lifecycle_status: Mapped[str] = mapped_column(String(30), nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text)
    changed_by: Mapped[str | None] = mapped_column(String(200))
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    snapshot_nodes_count: Mapped[int | None] = mapped_column(Integer)
    snapshot_assessable_count: Mapped[int | None] = mapped_column(Integer)

    # relationships
    framework: Mapped["Framework"] = relationship(back_populates="versions")


class FrameworkNode(Base):
    __tablename__ = "framework_nodes"
    __table_args__ = (
        Index("ix_fwnode_framework_parent", "framework_id", "parent_id"),
        Index("ix_fwnode_framework_depth", "framework_id", "depth"),
        Index("ix_fwnode_framework_assessable", "framework_id", "assessable"),
        Index("ix_fwnode_urn", "urn"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("framework_nodes.id", ondelete="SET NULL"))

    urn: Mapped[str | None] = mapped_column(String(500))
    ref_id: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    name_pl: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    description_pl: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text, comment="Full verbatim text of this section from the source document")

    depth: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    order_id: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    assessable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Point type for document structure (Rozdział, Pkt, Ppkt, Art., Rekomendacja)
    point_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("dictionary_entries.id", ondelete="SET NULL"),
        comment="Node type from dictionary: Rozdział, Pkt, Ppkt, Art., Rekomendacja, etc.",
    )

    implementation_groups: Mapped[str | None] = mapped_column(String(100))
    weight: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    importance: Mapped[str | None] = mapped_column(
        Enum("mandatory", "recommended", "nice_to_have", "undefined",
             name="importance_enum"),
    )
    maturity_level: Mapped[int | None] = mapped_column(Integer)
    annotation: Mapped[str | None] = mapped_column(Text)

    threats: Mapped[dict | None] = mapped_column(JSON)
    reference_controls: Mapped[dict | None] = mapped_column(JSON)
    typical_evidence: Mapped[str | None] = mapped_column(Text)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    framework: Mapped["Framework"] = relationship(back_populates="nodes")
    parent: Mapped["FrameworkNode | None"] = relationship(
        remote_side="FrameworkNode.id", foreign_keys=[parent_id],
    )
    children: Mapped[list["FrameworkNode"]] = relationship(
        back_populates="parent", foreign_keys=[parent_id],
    )
    area_mappings: Mapped[list["FrameworkNodeSecurityArea"]] = relationship(
        back_populates="node", cascade="all, delete-orphan",
    )


class FrameworkNodeSecurityArea(Base):
    __tablename__ = "framework_node_security_areas"
    __table_args__ = (
        UniqueConstraint("framework_node_id", "security_area_id", name="uq_fwnode_secarea"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_node_id: Mapped[int] = mapped_column(
        ForeignKey("framework_nodes.id", ondelete="CASCADE"), nullable=False,
    )
    security_area_id: Mapped[int] = mapped_column(
        ForeignKey("security_domains.id", ondelete="CASCADE"), nullable=False,
    )
    source: Mapped[str] = mapped_column(
        Enum("seed", "manual", "ai_suggested", name="mapping_source_enum"),
        default="manual", nullable=False,
    )
    created_by: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # relationships
    node: Mapped["FrameworkNode"] = relationship(back_populates="area_mappings")
    security_area: Mapped["SecurityArea"] = relationship()


class AssessmentDimension(Base):
    __tablename__ = "assessment_dimensions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False)
    dimension_key: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_pl: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    order_id: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("1.00"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # relationships
    framework: Mapped["Framework"] = relationship(back_populates="dimensions")
    levels: Mapped[list["DimensionLevel"]] = relationship(
        back_populates="dimension", cascade="all, delete-orphan",
        order_by="DimensionLevel.level_order",
    )


class DimensionLevel(Base):
    __tablename__ = "dimension_levels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dimension_id: Mapped[int] = mapped_column(
        ForeignKey("assessment_dimensions.id", ondelete="CASCADE"), nullable=False,
    )
    level_order: Mapped[int] = mapped_column(Integer, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    label_pl: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(7))

    # relationships
    dimension: Mapped["AssessmentDimension"] = relationship(back_populates="levels")


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str | None] = mapped_column(String(20))
    framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id"), nullable=False)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    security_area_id: Mapped[int | None] = mapped_column(ForeignKey("security_domains.id"))

    title: Mapped[str | None] = mapped_column(String(500))
    assessor: Mapped[str | None] = mapped_column(String(200))
    assessment_date: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[str] = mapped_column(
        Enum("draft", "in_progress", "completed", "approved", "archived",
             name="assessment_status_enum"),
        default="draft", nullable=False,
    )
    implementation_group_filter: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)

    completion_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    overall_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    approved_by: Mapped[str | None] = mapped_column(String(200))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    framework: Mapped["Framework"] = relationship(back_populates="assessments")
    answers: Mapped[list["AssessmentAnswer"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan",
    )


class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"
    __table_args__ = (
        UniqueConstraint("assessment_id", "framework_node_id", "dimension_id",
                         name="uq_assess_node_dim"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False,
    )
    framework_node_id: Mapped[int] = mapped_column(
        ForeignKey("framework_nodes.id"), nullable=False,
    )
    dimension_id: Mapped[int] = mapped_column(
        ForeignKey("assessment_dimensions.id"), nullable=False,
    )
    level_id: Mapped[int | None] = mapped_column(ForeignKey("dimension_levels.id"))

    not_applicable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    assessment: Mapped["Assessment"] = relationship(back_populates="answers")
    framework_node: Mapped["FrameworkNode"] = relationship()
    dimension: Mapped["AssessmentDimension"] = relationship()
    level: Mapped["DimensionLevel | None"] = relationship()


class FrameworkOrgUnit(Base):
    """M2M: links reference documents to organizational units."""
    __tablename__ = "framework_org_units"
    __table_args__ = (
        UniqueConstraint("framework_id", "org_unit_id", name="uq_fw_orgunit"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(
        ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False,
    )
    org_unit_id: Mapped[int] = mapped_column(
        ForeignKey("org_units.id", ondelete="CASCADE"), nullable=False,
    )
    compliance_status: Mapped[str] = mapped_column(
        String(30), default="not_assessed", nullable=False,
        comment="not_assessed, compliant, partially_compliant, non_compliant, requires_update",
    )
    last_assessed_at: Mapped[datetime | None] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # relationships
    framework: Mapped["Framework"] = relationship(back_populates="org_unit_links")


class FrameworkReview(Base):
    """Review records for reference documents that require periodic reviews."""
    __tablename__ = "framework_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(
        ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False,
    )
    reviewer: Mapped[str | None] = mapped_column(String(200))
    review_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    review_type: Mapped[str] = mapped_column(
        String(30), default="periodic", nullable=False,
        comment="periodic, ad_hoc, update_review",
    )
    findings: Mapped[str | None] = mapped_column(Text)
    recommendations: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), default="completed", nullable=False,
        comment="pending, completed, overdue",
    )
    next_review_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # relationships
    framework: Mapped["Framework"] = relationship(back_populates="reviews")


class FrameworkNodeAiCache(Base):
    """Persists AI interpretation/translation results for framework nodes."""
    __tablename__ = "framework_node_ai_cache"
    __table_args__ = (
        UniqueConstraint("node_id", "action_type", "language", name="uq_node_ai_cache"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    node_id: Mapped[int] = mapped_column(
        ForeignKey("framework_nodes.id", ondelete="CASCADE"), nullable=False,
    )
    action_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="interpret or translate",
    )
    language: Mapped[str | None] = mapped_column(
        String(10), nullable=True,
        comment="Target language code for translations, NULL for interpret",
    )
    result_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    node: Mapped["FrameworkNode"] = relationship()


class DocumentMetrics(Base):
    """Document metrics / metryka dokumentu — extracted from imported documents."""
    __tablename__ = "document_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(
        ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False, unique=True,
    )

    # Historia zmian dokumentu — JSON array of {version, date, author, description}
    change_history: Mapped[list | None] = mapped_column(JSON)

    # Odpowiedzialności i akceptacje — JSON array of {role, name, title, date}
    responsibilities: Mapped[list | None] = mapped_column(JSON)

    # Wdrożenie dokumentu
    implementation_date: Mapped[str | None] = mapped_column(String(50))
    implementation_method: Mapped[str | None] = mapped_column(Text)
    verification_date: Mapped[str | None] = mapped_column(String(50))
    effective_date: Mapped[str | None] = mapped_column(String(50))
    distribution_responsible: Mapped[str | None] = mapped_column(String(300))
    distribution_date: Mapped[str | None] = mapped_column(String(50))
    distribution_list: Mapped[str | None] = mapped_column(Text)
    notification_method: Mapped[str | None] = mapped_column(Text)

    # Klasyfikacja i dostęp
    access_level: Mapped[str | None] = mapped_column(String(200))
    classification: Mapped[str | None] = mapped_column(String(200))
    additional_permissions: Mapped[str | None] = mapped_column(Text)

    # Roles and obligations
    applicable_roles: Mapped[str | None] = mapped_column(Text)
    management_approved: Mapped[str | None] = mapped_column(String(10))

    # Extra data (extensible JSON for anything else found)
    extra: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # relationships
    framework: Mapped["Framework"] = relationship()


class FrameworkAttachment(Base):
    """File attachments for framework/document (e.g. source PDF/DOCX)."""
    __tablename__ = "framework_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(
        ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(200))
    uploaded_by: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # relationships
    framework: Mapped["Framework"] = relationship()


# Avoid circular import — SecurityArea is referenced by string above.
# The actual import is resolved at mapper configuration time by SQLAlchemy.
from .security_area import SecurityArea  # noqa: F401, E402
