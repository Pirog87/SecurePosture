from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Policy(Base):
    """Security Policy Registry (Module 20)."""
    __tablename__ = "policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str | None] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    owner: Mapped[str] = mapped_column(String(100), nullable=False)
    approver: Mapped[str | None] = mapped_column(String(100))
    status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    current_version: Mapped[str | None] = mapped_column(String(20))
    effective_date: Mapped[date | None] = mapped_column(Date)
    review_date: Mapped[date | None] = mapped_column(Date)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    document_url: Mapped[str | None] = mapped_column(String(500))
    target_audience_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class PolicyStandardMapping(Base):
    """Mapping policies to framework controls / standards."""
    __tablename__ = "policy_standard_mappings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("policies.id", ondelete="CASCADE"), nullable=False)
    framework_node_id: Mapped[int | None] = mapped_column(ForeignKey("framework_nodes.id", ondelete="SET NULL"))
    standard_name: Mapped[str | None] = mapped_column(String(100))
    control_ref: Mapped[str | None] = mapped_column(String(50))
    control_description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class PolicyAcknowledgment(Base):
    """Tracking user/org acknowledgments of policies."""
    __tablename__ = "policy_acknowledgments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("policies.id", ondelete="CASCADE"), nullable=False)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    acknowledged_by: Mapped[str] = mapped_column(String(100), nullable=False)
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    policy_version: Mapped[str | None] = mapped_column(String(20))
