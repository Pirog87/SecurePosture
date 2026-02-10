from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Risk(Base):
    __tablename__ = "risks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── ISO 31000 §5.3 Kontekst ──
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    risk_category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    risk_source: Mapped[str | None] = mapped_column(Text)

    # ── ISO 27005 §8.2 Identyfikacja ryzyka ──
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"))
    asset_category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    asset_name: Mapped[str] = mapped_column(String(400), nullable=False)
    sensitivity_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    criticality_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    security_area_id: Mapped[int | None] = mapped_column(ForeignKey("security_domains.id"))
    threat_id: Mapped[int | None] = mapped_column(ForeignKey("threats.id"))
    vulnerability_id: Mapped[int | None] = mapped_column(ForeignKey("vulnerabilities.id"))
    existing_controls: Mapped[str | None] = mapped_column(Text)
    control_effectiveness_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    consequence_description: Mapped[str | None] = mapped_column(Text)

    # ── ISO 27005 §8.3 Analiza ryzyka ──
    impact_level: Mapped[int] = mapped_column(Integer, nullable=False)
    probability_level: Mapped[int] = mapped_column(Integer, nullable=False)
    safeguard_rating: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)

    # GENERATED columns — read-only
    risk_score: Mapped[Decimal] = mapped_column(Numeric(10, 2), server_default="0", insert_default=None)
    risk_level: Mapped[str] = mapped_column(String(20), server_default="low", insert_default=None)

    # ── ISO 27005 §8.5 Postepowanie z ryzykiem ──
    status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    strategy_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    owner: Mapped[str | None] = mapped_column(String(200))
    planned_actions: Mapped[str | None] = mapped_column(Text)
    treatment_plan: Mapped[str | None] = mapped_column(Text)
    treatment_deadline: Mapped[datetime | None] = mapped_column(Date)
    treatment_resources: Mapped[str | None] = mapped_column(Text)
    residual_risk: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    target_impact: Mapped[int | None] = mapped_column(Integer)
    target_probability: Mapped[int | None] = mapped_column(Integer)
    target_safeguard: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))

    # ── ISO 27005 §8.6 Akceptacja ryzyka ──
    accepted_by: Mapped[str | None] = mapped_column(String(200))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime)
    acceptance_justification: Mapped[str | None] = mapped_column(Text)

    # ── ISO 27005 §9 Monitorowanie i przeglad ──
    next_review_date: Mapped[datetime | None] = mapped_column(Date)
    identified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_review_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    org_unit: Mapped["OrgUnit"] = relationship(foreign_keys=[org_unit_id])
    security_area: Mapped["SecurityDomain | None"] = relationship(foreign_keys=[security_area_id])
    status: Mapped["DictionaryEntry | None"] = relationship(foreign_keys=[status_id])

    # Import here to avoid circular
    from .org_unit import OrgUnit
    from .security_area import SecurityDomain
    from .dictionary import DictionaryEntry


class RiskSafeguard(Base):
    __tablename__ = "risk_safeguards"

    risk_id: Mapped[int] = mapped_column(ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True)
    safeguard_id: Mapped[int] = mapped_column(ForeignKey("safeguards.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class RiskReviewConfig(Base):
    __tablename__ = "risk_review_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    review_interval_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class RiskReview(Base):
    __tablename__ = "risk_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    risk_id: Mapped[int] = mapped_column(ForeignKey("risks.id", ondelete="CASCADE"), nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    review_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
