from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class SecurityDomain(Base):
    """Security Domain — central unifying concept for risk areas + CIS controls."""
    __tablename__ = "security_domains"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(30))
    owner: Mapped[str | None] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    cis_mappings: Mapped[list["DomainCisControl"]] = relationship(back_populates="domain")


class DomainCisControl(Base):
    """M:N mapping between Security Domains and CIS Controls."""
    __tablename__ = "domain_cis_controls"

    domain_id: Mapped[int] = mapped_column(
        ForeignKey("security_domains.id", ondelete="CASCADE"), primary_key=True,
    )
    cis_control_id: Mapped[int] = mapped_column(
        ForeignKey("cis_controls.id", ondelete="CASCADE"), primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    domain: Mapped["SecurityDomain"] = relationship(back_populates="cis_mappings")
    cis_control = relationship("CisControl")


# Backward-compat alias
SecurityArea = SecurityDomain
