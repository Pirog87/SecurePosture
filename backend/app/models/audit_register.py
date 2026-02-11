from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Audit(Base):
    """Audit & Control Registry (Module 16)."""
    __tablename__ = "audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str | None] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    audit_type_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    framework: Mapped[str | None] = mapped_column(String(200))
    auditor: Mapped[str] = mapped_column(String(100), nullable=False)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    status: Mapped[str] = mapped_column(String(50), default="planned", nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    summary: Mapped[str | None] = mapped_column(Text)
    overall_rating_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    org_unit: Mapped["OrgUnit | None"] = relationship(foreign_keys=[org_unit_id])
    findings: Mapped[list["AuditFinding"]] = relationship(back_populates="audit")

    from .org_unit import OrgUnit


class AuditFinding(Base):
    """Individual finding within an audit."""
    __tablename__ = "audit_findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str | None] = mapped_column(String(20))
    audit_id: Mapped[int] = mapped_column(ForeignKey("audits.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    finding_type_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    severity_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    security_area_id: Mapped[int | None] = mapped_column(ForeignKey("security_domains.id"))
    framework_node_id: Mapped[int | None] = mapped_column(ForeignKey("framework_nodes.id"))
    remediation_owner: Mapped[str | None] = mapped_column(String(100))
    status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    sla_deadline: Mapped[date | None] = mapped_column(Date)
    remediation_plan: Mapped[str | None] = mapped_column(Text)
    remediation_evidence: Mapped[str | None] = mapped_column(Text)
    risk_id: Mapped[int | None] = mapped_column(ForeignKey("risks.id"))
    vulnerability_id: Mapped[int | None] = mapped_column(ForeignKey("vulnerabilities_registry.id"))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    audit: Mapped["Audit"] = relationship(back_populates="findings")
