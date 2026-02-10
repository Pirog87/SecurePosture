from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class CisControl(Base):
    __tablename__ = "cis_controls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    control_number: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name_en: Mapped[str] = mapped_column(String(400), nullable=False)
    name_pl: Mapped[str] = mapped_column(String(400), nullable=False)
    sub_control_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    sub_controls: Mapped[list["CisSubControl"]] = relationship(back_populates="control")


class CisSubControl(Base):
    __tablename__ = "cis_sub_controls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    control_id: Mapped[int] = mapped_column(ForeignKey("cis_controls.id"), nullable=False)
    sub_id: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    detail_en: Mapped[str] = mapped_column(Text, nullable=False)
    detail_pl: Mapped[str | None] = mapped_column(Text)
    nist_csf: Mapped[str | None] = mapped_column(String(20))
    implementation_groups: Mapped[str | None] = mapped_column(String(20))
    sensor_baseline: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    control: Mapped["CisControl"] = relationship(back_populates="sub_controls")
    attack_mappings: Mapped[list["CisAttackMapping"]] = relationship(back_populates="sub_control")


class CisAttackMapping(Base):
    __tablename__ = "cis_attack_mapping"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sub_control_id: Mapped[int] = mapped_column(ForeignKey("cis_sub_controls.id", ondelete="CASCADE"), nullable=False)
    attack_activity: Mapped[str] = mapped_column(String(100), nullable=False)
    capability_type: Mapped[str] = mapped_column(Enum("preventive", "detective"), nullable=False)

    sub_control: Mapped["CisSubControl"] = relationship(back_populates="attack_mappings")


class CisAssessment(Base):
    __tablename__ = "cis_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    assessor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    assessor_name: Mapped[str | None] = mapped_column(String(200))
    status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    notes: Mapped[str | None] = mapped_column(Text)
    assessment_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    maturity_rating: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    risk_addressed_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    ig1_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    ig2_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    ig3_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    answers: Mapped[list["CisAssessmentAnswer"]] = relationship(back_populates="assessment")


class CisAssessmentAnswer(Base):
    __tablename__ = "cis_assessment_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("cis_assessments.id", ondelete="CASCADE"), nullable=False)
    sub_control_id: Mapped[int] = mapped_column(ForeignKey("cis_sub_controls.id"), nullable=False)

    policy_status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    impl_status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    auto_status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    report_status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))

    is_not_applicable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    policy_value: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    impl_value: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    auto_value: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    report_value: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    assessment: Mapped["CisAssessment"] = relationship(back_populates="answers")
    sub_control: Mapped["CisSubControl"] = relationship()
