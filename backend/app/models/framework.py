"""
Framework Engine models — universal multi-framework assessment system.

Tables: frameworks, framework_nodes, assessment_dimensions, dimension_levels,
        framework_node_security_areas, assessments, assessment_answers
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
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Framework(Base):
    __tablename__ = "frameworks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    ref_id: Mapped[str] = mapped_column(String(100), nullable=False)
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

    implementation_groups_definition: Mapped[dict | None] = mapped_column(JSON)

    total_nodes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_assessable: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    imported_at: Mapped[datetime | None] = mapped_column(DateTime)
    imported_by: Mapped[str | None] = mapped_column(String(200))

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

    depth: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    order_id: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    assessable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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


# Avoid circular import — SecurityArea is referenced by string above.
# The actual import is resolved at mapper configuration time by SQLAlchemy.
from .security_area import SecurityArea  # noqa: F401, E402
