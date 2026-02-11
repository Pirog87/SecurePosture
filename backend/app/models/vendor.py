"""SQLAlchemy models for Vendor (TPRM) module."""
from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func,
)
from sqlalchemy.orm import relationship

from .base import Base


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ref_id = Column(String(20), unique=True)
    name = Column(String(255), nullable=False)
    category_id = Column(Integer, ForeignKey("dictionary_entries.id"))
    criticality_id = Column(Integer, ForeignKey("dictionary_entries.id"))
    services_provided = Column(Text)
    data_access_level_id = Column(Integer, ForeignKey("dictionary_entries.id"))
    contract_owner = Column(String(100))
    security_contact = Column(String(100))
    contract_start = Column(Date)
    contract_end = Column(Date)
    sla_description = Column(Text)
    status_id = Column(Integer, ForeignKey("dictionary_entries.id"))
    last_assessment_date = Column(Date)
    next_assessment_date = Column(Date)
    risk_rating_id = Column(Integer, ForeignKey("dictionary_entries.id"))
    risk_score = Column(Numeric(5, 2))
    questionnaire_completed = Column(Boolean, default=False)
    certifications = Column(Text)
    risk_id = Column(Integer, ForeignKey("risks.id"))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    assessments = relationship("VendorAssessment", back_populates="vendor", cascade="all, delete-orphan")


class VendorAssessment(Base):
    __tablename__ = "vendor_assessments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    assessment_date = Column(Date, nullable=False)
    assessed_by = Column(String(100), nullable=False)
    total_score = Column(Numeric(5, 2))
    risk_rating_id = Column(Integer, ForeignKey("dictionary_entries.id"))
    notes = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="assessments")
    answers = relationship("VendorAssessmentAnswer", back_populates="assessment", cascade="all, delete-orphan")


class VendorAssessmentAnswer(Base):
    __tablename__ = "vendor_assessment_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    assessment_id = Column(Integer, ForeignKey("vendor_assessments.id", ondelete="CASCADE"), nullable=False)
    question_code = Column(String(20), nullable=False)
    question_text = Column(Text, nullable=False)
    answer = Column(Integer, nullable=False)
    notes = Column(Text)

    assessment = relationship("VendorAssessment", back_populates="answers")
