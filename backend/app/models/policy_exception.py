from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class PolicyException(Base):
    """Policy Exception Registry (Module 15)."""
    __tablename__ = "policy_exceptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str | None] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    policy_id: Mapped[int] = mapped_column(ForeignKey("policies.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"))
    requested_by: Mapped[str] = mapped_column(String(100), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(100))
    risk_level_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    compensating_controls: Mapped[str | None] = mapped_column(Text)
    status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    review_date: Mapped[date | None] = mapped_column(Date)
    closed_at: Mapped[date | None] = mapped_column(Date)

    risk_id: Mapped[int | None] = mapped_column(ForeignKey("risks.id"))
    vulnerability_id: Mapped[int | None] = mapped_column(ForeignKey("vulnerabilities_registry.id"))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    org_unit: Mapped["OrgUnit | None"] = relationship(foreign_keys=[org_unit_id])

    from .org_unit import OrgUnit
