from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Incident(Base):
    """Incident registry (Module 14)."""
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str | None] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    severity_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"))
    reported_by: Mapped[str] = mapped_column(String(100), nullable=False)
    assigned_to: Mapped[str] = mapped_column(String(100), nullable=False)
    status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))

    reported_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    detected_at: Mapped[datetime | None] = mapped_column(DateTime)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)
    ttr_minutes: Mapped[int | None] = mapped_column(Integer)

    impact_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    personal_data_breach: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    authority_notification: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    actions_taken: Mapped[str | None] = mapped_column(Text)
    root_cause: Mapped[str | None] = mapped_column(Text)
    lessons_learned: Mapped[str | None] = mapped_column(Text)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    org_unit: Mapped["OrgUnit | None"] = relationship(foreign_keys=[org_unit_id])
    asset: Mapped["Asset | None"] = relationship(foreign_keys=[asset_id])

    from .org_unit import OrgUnit
    from .asset import Asset


class IncidentRisk(Base):
    """M2M: incidents ↔ risks."""
    __tablename__ = "incident_risks"

    incident_id: Mapped[int] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), primary_key=True)
    risk_id: Mapped[int] = mapped_column(
        ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class IncidentVulnerability(Base):
    """M2M: incidents ↔ vulnerabilities_registry."""
    __tablename__ = "incident_vulnerabilities"

    incident_id: Mapped[int] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), primary_key=True)
    vulnerability_id: Mapped[int] = mapped_column(
        ForeignKey("vulnerabilities_registry.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
