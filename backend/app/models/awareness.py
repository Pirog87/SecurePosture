"""SQLAlchemy models for Security Awareness module."""
from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class AwarenessCampaign(Base):
    __tablename__ = "awareness_campaigns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ref_id = Column(String(20), unique=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    campaign_type_id = Column(Integer, ForeignKey("dictionary_entries.id"))
    org_unit_id = Column(Integer, ForeignKey("org_units.id"))
    target_audience_count = Column(Integer, nullable=False, default=0)
    start_date = Column(Date)
    end_date = Column(Date)
    status_id = Column(Integer, ForeignKey("dictionary_entries.id"))
    owner = Column(String(100))
    content_url = Column(String(500))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    results = relationship("AwarenessResult", back_populates="campaign", cascade="all, delete-orphan")


class AwarenessResult(Base):
    __tablename__ = "awareness_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(Integer, ForeignKey("awareness_campaigns.id", ondelete="CASCADE"), nullable=False)
    org_unit_id = Column(Integer, ForeignKey("org_units.id"))
    participants_count = Column(Integer, nullable=False, default=0)
    completed_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    reported_count = Column(Integer, nullable=False, default=0)
    avg_score = Column(Numeric(5, 2))
    completion_rate = Column(Numeric(5, 2))
    click_rate = Column(Numeric(5, 2))
    report_rate = Column(Numeric(5, 2))
    recorded_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    campaign = relationship("AwarenessCampaign", back_populates="results")


class AwarenessEmployeeReport(Base):
    __tablename__ = "awareness_employee_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    month = Column(Date, nullable=False)
    org_unit_id = Column(Integer, ForeignKey("org_units.id"))
    reports_count = Column(Integer, nullable=False, default=0)
    confirmed_count = Column(Integer, nullable=False, default=0)
    recorded_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
