"""
Control Effectiveness Assessment models.

Tracks implementation status and operational effectiveness of security controls
from the Smart Catalog (control_catalog), with periodic testing/validation records.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer,
    Numeric, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ControlImplementation(Base):
    """Links a control from control_catalog to a specific org unit / asset context
    and tracks its implementation status and effectiveness scores."""
    __tablename__ = "control_implementations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str] = mapped_column(String(20), nullable=False)
    # CEF-0001, CEF-0002, ...

    control_id: Mapped[int] = mapped_column(
        ForeignKey("control_catalog.id", ondelete="CASCADE"), nullable=False,
    )
    org_unit_id: Mapped[int] = mapped_column(
        ForeignKey("org_units.id"), nullable=False,
    )
    asset_id: Mapped[int | None] = mapped_column(
        ForeignKey("assets.id"), nullable=True,
    )
    security_area_id: Mapped[int | None] = mapped_column(
        ForeignKey("security_domains.id"), nullable=True,
    )

    # ── Implementation details ──
    status: Mapped[str] = mapped_column(
        String(30), default="planned", nullable=False,
    )
    # planned | in_progress | implemented | partial | not_applicable
    responsible: Mapped[str | None] = mapped_column(String(200))
    implementation_date: Mapped[datetime | None] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    evidence_notes: Mapped[str | None] = mapped_column(Text)

    # ── Effectiveness scores (0–100) ──
    design_effectiveness: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True,
    )
    operational_effectiveness: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True,
    )
    coverage_percent: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True,
    )
    # Overall = weighted avg of design (40%) + operational (60%)
    overall_effectiveness: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True,
    )

    # ── Testing schedule ──
    test_frequency_days: Mapped[int | None] = mapped_column(Integer)
    last_test_date: Mapped[datetime | None] = mapped_column(Date)
    next_test_date: Mapped[datetime | None] = mapped_column(Date)

    # ── Standard fields ──
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    # ── Relationships ──
    tests: Mapped[list["ControlEffectivenessTest"]] = relationship(
        back_populates="implementation", cascade="all, delete-orphan",
        order_by="ControlEffectivenessTest.test_date.desc()",
    )

    def recompute_overall(self) -> None:
        """Recalculate overall_effectiveness from design + operational."""
        d = float(self.design_effectiveness) if self.design_effectiveness is not None else None
        o = float(self.operational_effectiveness) if self.operational_effectiveness is not None else None
        if d is not None and o is not None:
            self.overall_effectiveness = Decimal(str(round(d * 0.4 + o * 0.6, 2)))
        elif d is not None:
            self.overall_effectiveness = Decimal(str(round(d, 2)))
        elif o is not None:
            self.overall_effectiveness = Decimal(str(round(o, 2)))
        else:
            self.overall_effectiveness = None


class ControlEffectivenessTest(Base):
    """Record of a test/validation of a control implementation."""
    __tablename__ = "control_effectiveness_tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str] = mapped_column(String(20), nullable=False)
    # CET-0001, CET-0002, ...

    implementation_id: Mapped[int] = mapped_column(
        ForeignKey("control_implementations.id", ondelete="CASCADE"), nullable=False,
    )

    test_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    test_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # manual_test | automated_test | audit | review | pentest
    tester: Mapped[str] = mapped_column(String(200), nullable=False)

    result: Mapped[str] = mapped_column(String(20), nullable=False)
    # positive | conditional | negative

    design_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    operational_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    findings: Mapped[str | None] = mapped_column(Text)
    recommendations: Mapped[str | None] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False,
    )

    # ── Relationships ──
    implementation: Mapped["ControlImplementation"] = relationship(
        back_populates="tests",
    )
