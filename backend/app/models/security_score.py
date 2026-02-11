"""SQLAlchemy models for Security Score module."""
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text, func
from .base import Base


class SecurityScoreConfig(Base):
    __tablename__ = "security_score_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)
    # Pillar weights
    w_risk = Column(Numeric(5, 2), nullable=False, default=20)
    w_vulnerability = Column(Numeric(5, 2), nullable=False, default=15)
    w_incident = Column(Numeric(5, 2), nullable=False, default=12)
    w_exception = Column(Numeric(5, 2), nullable=False, default=10)
    w_maturity = Column(Numeric(5, 2), nullable=False, default=10)
    w_audit = Column(Numeric(5, 2), nullable=False, default=10)
    w_asset = Column(Numeric(5, 2), nullable=False, default=8)
    w_tprm = Column(Numeric(5, 2), nullable=False, default=6)
    w_policy = Column(Numeric(5, 2), nullable=False, default=5)
    w_awareness = Column(Numeric(5, 2), nullable=False, default=4)
    # Thresholds
    vuln_threshold_critical = Column(Integer, default=3)
    vuln_threshold_high = Column(Integer, default=10)
    vuln_threshold_medium = Column(Integer, default=30)
    vuln_threshold_low = Column(Integer, default=100)
    incident_ttr_critical = Column(Integer, default=4)
    incident_ttr_high = Column(Integer, default=24)
    incident_ttr_medium = Column(Integer, default=72)
    incident_ttr_low = Column(Integer, default=168)
    incident_window_days = Column(Integer, default=90)
    audit_sla_critical = Column(Integer, default=14)
    audit_sla_high = Column(Integer, default=30)
    audit_sla_medium = Column(Integer, default=60)
    audit_sla_low = Column(Integer, default=90)
    snapshot_frequency = Column(String(20), default="daily")
    changed_by = Column(String(100))
    change_reason = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class SecurityScoreSnapshot(Base):
    __tablename__ = "security_score_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    snapshot_date = Column(DateTime, nullable=False, server_default=func.now())
    total_score = Column(Numeric(5, 2), nullable=False)
    risk_score = Column(Numeric(5, 2))
    vulnerability_score = Column(Numeric(5, 2))
    incident_score = Column(Numeric(5, 2))
    exception_score = Column(Numeric(5, 2))
    maturity_score = Column(Numeric(5, 2))
    audit_score = Column(Numeric(5, 2))
    asset_score = Column(Numeric(5, 2))
    tprm_score = Column(Numeric(5, 2))
    policy_score = Column(Numeric(5, 2))
    awareness_score = Column(Numeric(5, 2))
    w_risk = Column(Numeric(5, 2))
    w_vulnerability = Column(Numeric(5, 2))
    w_incident = Column(Numeric(5, 2))
    w_exception = Column(Numeric(5, 2))
    w_maturity = Column(Numeric(5, 2))
    w_audit = Column(Numeric(5, 2))
    w_asset = Column(Numeric(5, 2))
    w_tprm = Column(Numeric(5, 2))
    w_policy = Column(Numeric(5, 2))
    w_awareness = Column(Numeric(5, 2))
    config_version = Column(Integer)
    triggered_by = Column(String(50))
    created_by = Column(String(100))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
