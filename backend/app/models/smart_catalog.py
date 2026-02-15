"""
Smart Catalog models — enriched catalogs of threats, weaknesses, and controls
with tri-directional correlations and optional AI integration.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, JSON, LargeBinary,
    Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


# ═══════════════════════════════════════════════════════════════════
# Catalog tables
# ═══════════════════════════════════════════════════════════════════

class ThreatCatalog(Base):
    __tablename__ = "threat_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    # NATURAL, ENVIRONMENTAL, HUMAN_INTENTIONAL, HUMAN_ACCIDENTAL, TECHNICAL, ORGANIZATIONAL
    source: Mapped[str] = mapped_column(String(15), default="BOTH", nullable=False)
    # INTERNAL, EXTERNAL, BOTH
    cia_impact: Mapped[dict | None] = mapped_column(JSON, default=dict)
    # {"C": true, "I": false, "A": true}
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("ref_id", "org_unit_id", name="uq_threat_ref_org"),
    )

    asset_categories: Mapped[list["ThreatAssetCategory"]] = relationship(
        back_populates="threat", cascade="all, delete-orphan",
    )
    weakness_links: Mapped[list["ThreatWeaknessLink"]] = relationship(
        back_populates="threat", foreign_keys="ThreatWeaknessLink.threat_id", cascade="all, delete-orphan",
    )
    control_links: Mapped[list["ThreatControlLink"]] = relationship(
        back_populates="threat", foreign_keys="ThreatControlLink.threat_id", cascade="all, delete-orphan",
    )


class WeaknessCatalog(Base):
    __tablename__ = "weakness_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    # HARDWARE, SOFTWARE, NETWORK, PERSONNEL, SITE, ORGANIZATION, PROCESS
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("ref_id", "org_unit_id", name="uq_weakness_ref_org"),
    )

    asset_categories: Mapped[list["WeaknessAssetCategory"]] = relationship(
        back_populates="weakness", cascade="all, delete-orphan",
    )
    threat_links: Mapped[list["ThreatWeaknessLink"]] = relationship(
        back_populates="weakness", foreign_keys="ThreatWeaknessLink.weakness_id", cascade="all, delete-orphan",
    )
    control_links: Mapped[list["WeaknessControlLink"]] = relationship(
        back_populates="weakness", foreign_keys="WeaknessControlLink.weakness_id", cascade="all, delete-orphan",
    )


class ControlCatalog(Base):
    __tablename__ = "control_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    # TECHNICAL, ORGANIZATIONAL, PHYSICAL, LEGAL
    implementation_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # PREVENTIVE, DETECTIVE, CORRECTIVE, DETERRENT, COMPENSATING
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("ref_id", "org_unit_id", name="uq_control_ref_org"),
    )

    asset_categories: Mapped[list["ControlAssetCategory"]] = relationship(
        back_populates="control", cascade="all, delete-orphan",
    )
    threat_links: Mapped[list["ThreatControlLink"]] = relationship(
        back_populates="control", foreign_keys="ThreatControlLink.control_id", cascade="all, delete-orphan",
    )
    weakness_links: Mapped[list["WeaknessControlLink"]] = relationship(
        back_populates="control", foreign_keys="WeaknessControlLink.control_id", cascade="all, delete-orphan",
    )


# ═══════════════════════════════════════════════════════════════════
# M2M: catalog ↔ asset_category
# ═══════════════════════════════════════════════════════════════════

class ThreatAssetCategory(Base):
    __tablename__ = "threat_asset_category"

    threat_id: Mapped[int] = mapped_column(ForeignKey("threat_catalog.id", ondelete="CASCADE"), primary_key=True)
    asset_category_id: Mapped[int] = mapped_column(ForeignKey("asset_categories.id", ondelete="CASCADE"), primary_key=True)

    threat: Mapped["ThreatCatalog"] = relationship(back_populates="asset_categories")


class WeaknessAssetCategory(Base):
    __tablename__ = "weakness_asset_category"

    weakness_id: Mapped[int] = mapped_column(ForeignKey("weakness_catalog.id", ondelete="CASCADE"), primary_key=True)
    asset_category_id: Mapped[int] = mapped_column(ForeignKey("asset_categories.id", ondelete="CASCADE"), primary_key=True)

    weakness: Mapped["WeaknessCatalog"] = relationship(back_populates="asset_categories")


class ControlAssetCategory(Base):
    __tablename__ = "control_catalog_asset_category"

    control_id: Mapped[int] = mapped_column(ForeignKey("control_catalog.id", ondelete="CASCADE"), primary_key=True)
    asset_category_id: Mapped[int] = mapped_column(ForeignKey("asset_categories.id", ondelete="CASCADE"), primary_key=True)

    control: Mapped["ControlCatalog"] = relationship(back_populates="asset_categories")


# ═══════════════════════════════════════════════════════════════════
# Correlation link tables
# ═══════════════════════════════════════════════════════════════════

class ThreatWeaknessLink(Base):
    __tablename__ = "threat_weakness_link"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    threat_id: Mapped[int] = mapped_column(ForeignKey("threat_catalog.id", ondelete="CASCADE"), nullable=False)
    weakness_id: Mapped[int] = mapped_column(ForeignKey("weakness_catalog.id", ondelete="CASCADE"), nullable=False)
    relevance: Mapped[str] = mapped_column(String(10), default="MEDIUM", nullable=False)
    # HIGH, MEDIUM, LOW
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("threat_id", "weakness_id", name="uq_threat_weakness"),
    )

    threat: Mapped["ThreatCatalog"] = relationship(back_populates="weakness_links", foreign_keys=[threat_id])
    weakness: Mapped["WeaknessCatalog"] = relationship(back_populates="threat_links", foreign_keys=[weakness_id])


class ThreatControlLink(Base):
    __tablename__ = "threat_control_link"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    threat_id: Mapped[int] = mapped_column(ForeignKey("threat_catalog.id", ondelete="CASCADE"), nullable=False)
    control_id: Mapped[int] = mapped_column(ForeignKey("control_catalog.id", ondelete="CASCADE"), nullable=False)
    effectiveness: Mapped[str] = mapped_column(String(10), default="MEDIUM", nullable=False)
    # HIGH, MEDIUM, LOW
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("threat_id", "control_id", name="uq_threat_control"),
    )

    threat: Mapped["ThreatCatalog"] = relationship(back_populates="control_links", foreign_keys=[threat_id])
    control: Mapped["ControlCatalog"] = relationship(back_populates="threat_links", foreign_keys=[control_id])


class WeaknessControlLink(Base):
    __tablename__ = "weakness_control_link"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    weakness_id: Mapped[int] = mapped_column(ForeignKey("weakness_catalog.id", ondelete="CASCADE"), nullable=False)
    control_id: Mapped[int] = mapped_column(ForeignKey("control_catalog.id", ondelete="CASCADE"), nullable=False)
    effectiveness: Mapped[str] = mapped_column(String(10), default="MEDIUM", nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("weakness_id", "control_id", name="uq_weakness_control"),
    )

    weakness: Mapped["WeaknessCatalog"] = relationship(back_populates="control_links", foreign_keys=[weakness_id])
    control: Mapped["ControlCatalog"] = relationship(back_populates="weakness_links", foreign_keys=[control_id])


# ═══════════════════════════════════════════════════════════════════
# AI Provider Configuration
# ═══════════════════════════════════════════════════════════════════

class AIProviderConfig(Base):
    __tablename__ = "ai_provider_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    provider_type: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    # 'none' | 'anthropic' | 'openai_compatible'
    api_endpoint: Mapped[str | None] = mapped_column(String(500))
    api_key_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    model_name: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, default=4000, nullable=False)
    temperature: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0.30"), nullable=False)

    # Rate limiting
    max_requests_per_user_per_hour: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    max_requests_per_user_per_day: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    max_requests_per_org_per_day: Mapped[int] = mapped_column(Integer, default=500, nullable=False)

    # Feature toggles — Smart Catalog
    feature_scenario_generation: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    feature_correlation_enrichment: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    feature_natural_language_search: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    feature_gap_analysis: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    feature_entry_assist: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Feature toggles — Framework / Dokument
    feature_interpret: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    feature_translate: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    feature_evidence: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    feature_security_area_map: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    feature_cross_mapping: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    feature_coverage_report: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    feature_document_import: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    feature_management_report: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)

    # Test metadata
    last_test_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_test_ok: Mapped[bool | None] = mapped_column(Boolean)
    last_test_error: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class AIPromptTemplate(Base):
    """Editable AI prompt templates — one per function, overrides hardcoded defaults."""
    __tablename__ = "ai_prompt_templates"
    __table_args__ = (
        UniqueConstraint("function_key", name="uq_prompt_function_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    function_key: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Unique key: scenario_gen, enrichment, search, gap_analysis, assist, "
                "interpret, translate, evidence, security_area_map, cross_mapping, "
                "coverage_report, document_import, document_import_continuation",
    )
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, comment="Description of what this prompt does")
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False, comment="The system prompt sent to LLM")
    is_customized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False,
        comment="True if user has edited this prompt (vs default)")
    updated_by: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )


class AIAuditLog(Base):
    __tablename__ = "ai_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    action_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # SCENARIO_GEN, ENRICHMENT, SEARCH, GAP_ANALYSIS, ASSIST, TEST_CONNECTION
    provider_type: Mapped[str] = mapped_column(String(20), nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    input_summary: Mapped[str | None] = mapped_column(Text)
    output_summary: Mapped[str | None] = mapped_column(Text)
    tokens_input: Mapped[int | None] = mapped_column(Integer)
    tokens_output: Mapped[int | None] = mapped_column(Integer)
    cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    accepted: Mapped[bool | None] = mapped_column(Boolean)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
