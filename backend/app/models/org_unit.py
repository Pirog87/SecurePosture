from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class OrgLevel(Base):
    __tablename__ = "org_levels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    level_number: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class OrgUnit(Base):
    __tablename__ = "org_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    level_id: Mapped[int] = mapped_column(ForeignKey("org_levels.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    symbol: Mapped[str] = mapped_column(String(30), nullable=False)
    owner: Mapped[str | None] = mapped_column(String(200))
    security_contact: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Context extension fields (ISO 27001 clause 4)
    headcount: Mapped[int | None] = mapped_column(Integer)
    context_review_date: Mapped[date | None] = mapped_column(Date)
    context_next_review: Mapped[date | None] = mapped_column(Date)
    context_reviewer: Mapped[str | None] = mapped_column(String(200))
    context_status: Mapped[str | None] = mapped_column(String(30))  # draft / in_review / approved / needs_update
    mission_vision: Mapped[str | None] = mapped_column(Text)
    key_products_services: Mapped[str | None] = mapped_column(Text)
    strategic_objectives: Mapped[str | None] = mapped_column(Text)
    key_processes_notes: Mapped[str | None] = mapped_column(Text)

    parent: Mapped["OrgUnit | None"] = relationship(remote_side=[id])
    level: Mapped["OrgLevel"] = relationship()
