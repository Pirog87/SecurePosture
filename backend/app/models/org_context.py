"""
Organizational Context models — ISO 27001/22301 clause 4
Tables: org_context_issues, org_context_obligations, org_context_stakeholders,
        org_context_scope, org_context_risk_appetite, org_context_reviews,
        org_context_snapshots
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class OrgContextIssue(Base):
    __tablename__ = "org_context_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    issue_type: Mapped[str] = mapped_column(String(20), nullable=False)  # internal / external
    category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    impact_level: Mapped[str | None] = mapped_column(String(20))  # positive / negative / neutral
    relevance: Mapped[str | None] = mapped_column(String(20))  # high / medium / low
    response_action: Mapped[str | None] = mapped_column(Text)
    review_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class OrgContextObligation(Base):
    __tablename__ = "org_context_obligations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    obligation_type: Mapped[str] = mapped_column(String(30), nullable=False)
    regulation_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    custom_name: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    responsible_person: Mapped[str | None] = mapped_column(String(200))
    compliance_status: Mapped[str | None] = mapped_column(String(30), default="not_assessed")
    compliance_evidence: Mapped[str | None] = mapped_column(Text)
    effective_from: Mapped[date | None] = mapped_column(Date)
    review_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class OrgContextStakeholder(Base):
    __tablename__ = "org_context_stakeholders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    stakeholder_type: Mapped[str] = mapped_column(String(20), nullable=False)  # internal / external
    category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    needs_expectations: Mapped[str | None] = mapped_column(Text)
    requirements_type: Mapped[str | None] = mapped_column(String(20))  # legal / contractual / voluntary
    requirements_detail: Mapped[str | None] = mapped_column(Text)
    communication_channel: Mapped[str | None] = mapped_column(String(200))
    influence_level: Mapped[str | None] = mapped_column(String(20))  # high / medium / low
    relevance: Mapped[str | None] = mapped_column(String(20))  # high / medium / low
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class OrgContextScope(Base):
    __tablename__ = "org_context_scope"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    management_system_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    scope_statement: Mapped[str | None] = mapped_column(Text)
    in_scope_description: Mapped[str | None] = mapped_column(Text)
    out_of_scope_description: Mapped[str | None] = mapped_column(Text)
    geographic_boundaries: Mapped[str | None] = mapped_column(Text)
    technology_boundaries: Mapped[str | None] = mapped_column(Text)
    organizational_boundaries: Mapped[str | None] = mapped_column(Text)
    interfaces_dependencies: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(String(200))
    approved_date: Mapped[date | None] = mapped_column(Date)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class OrgContextRiskAppetite(Base):
    __tablename__ = "org_context_risk_appetite"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    risk_appetite_statement: Mapped[str | None] = mapped_column(Text)
    max_acceptable_risk_level: Mapped[str | None] = mapped_column(String(20))  # low / medium / high
    max_acceptable_risk_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    exception_approval_authority: Mapped[str | None] = mapped_column(String(200))
    financial_risk_tolerance: Mapped[str | None] = mapped_column(Text)
    reputational_risk_tolerance: Mapped[str | None] = mapped_column(Text)
    operational_risk_tolerance: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(String(200))
    approved_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class OrgContextReview(Base):
    __tablename__ = "org_context_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    review_date: Mapped[date] = mapped_column(Date, nullable=False)
    reviewer: Mapped[str] = mapped_column(String(200), nullable=False)
    review_type: Mapped[str] = mapped_column(String(20), nullable=False)  # scheduled / triggered / initial
    sections_reviewed: Mapped[dict | None] = mapped_column(JSON)
    changes_summary: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(String(200))
    approved_date: Mapped[date | None] = mapped_column(Date)
    next_review_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class OrgContextSnapshot(Base):
    __tablename__ = "org_context_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"), nullable=False)
    review_id: Mapped[int | None] = mapped_column(ForeignKey("org_context_reviews.id"))
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    snapshot_data: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
