from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(400), nullable=False)
    asset_type_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    org_unit_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"))

    owner: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(300))

    sensitivity_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    criticality_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    parent: Mapped["Asset | None"] = relationship(foreign_keys=[parent_id], remote_side=[id])
    org_unit: Mapped["OrgUnit | None"] = relationship(foreign_keys=[org_unit_id])

    from .org_unit import OrgUnit
