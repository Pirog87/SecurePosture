from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Risk(Base):
    __tablename__ = "risks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"))
    asset_category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    asset_name: Mapped[str] = mapped_column(String(400), nullable=False)
    sensitivity_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    criticality_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    security_area_id: Mapped[int | None] = mapped_column(ForeignKey("security_areas.id"))
    threat_id: Mapped[int | None] = mapped_column(ForeignKey("threats.id"))
    vulnerability_id: Mapped[int | None] = mapped_column(ForeignKey("vulnerabilities.id"))

    impact_level: Mapped[int] = mapped_column(Integer, nullable=False)
    probability_level: Mapped[int] = mapped_column(Integer, nullable=False)
    safeguard_rating: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)

    # GENERATED columns — read-only
    risk_score: Mapped[Decimal] = mapped_column(Numeric(10, 2), server_default="0", insert_default=None)
    risk_level: Mapped[str] = mapped_column(String(20), server_default="low", insert_default=None)

    status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    strategy_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    owner: Mapped[str | None] = mapped_column(String(200))
    planned_actions: Mapped[str | None] = mapped_column(Text)
    residual_risk: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    identified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_review_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    org_unit: Mapped["OrgUnit"] = relationship(foreign_keys=[org_unit_id])
    security_area: Mapped["SecurityArea | None"] = relationship(foreign_keys=[security_area_id])
    status: Mapped["DictionaryEntry | None"] = relationship(foreign_keys=[status_id])

    # Import here to avoid circular
    from .org_unit import OrgUnit
    from .security_area import SecurityArea
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
