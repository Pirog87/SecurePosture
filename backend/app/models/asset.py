from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str | None] = mapped_column(String(20))
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

    # ── CMDB extension (Phase 1) ──
    asset_subtype: Mapped[str | None] = mapped_column(String(100))
    technical_owner: Mapped[str | None] = mapped_column(String(200))
    environment_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    hostname: Mapped[str | None] = mapped_column(String(255))
    os_version: Mapped[str | None] = mapped_column(String(100))
    vendor: Mapped[str | None] = mapped_column(String(100))
    support_end_date: Mapped[date | None] = mapped_column(Date)
    status_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_entries.id"))
    last_scan_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    # ── CMDB Phase 2: category + custom attributes ──
    asset_category_id: Mapped[int | None] = mapped_column(ForeignKey("asset_categories.id", ondelete="SET NULL"))
    custom_attributes: Mapped[dict | None] = mapped_column(JSON)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    parent: Mapped["Asset | None"] = relationship(foreign_keys=[parent_id], remote_side=[id])
    org_unit: Mapped["OrgUnit | None"] = relationship(foreign_keys=[org_unit_id])

    from .org_unit import OrgUnit


class AssetRelationship(Base):
    __tablename__ = "asset_relationships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    target_asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False)  # depends_on, supports, connects_to, contains
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
