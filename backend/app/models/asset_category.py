from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class AssetCategory(Base):
    __tablename__ = "asset_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("asset_categories.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_plural: Mapped[str | None] = mapped_column(String(200))
    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(7))
    description: Mapped[str | None] = mapped_column(Text)
    is_abstract: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    parent: Mapped["AssetCategory | None"] = relationship(foreign_keys=[parent_id], remote_side=[id])
    field_definitions: Mapped[list["CategoryFieldDefinition"]] = relationship(
        back_populates="category", foreign_keys="CategoryFieldDefinition.category_id",
    )


class CategoryFieldDefinition(Base):
    __tablename__ = "category_field_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("asset_categories.id", ondelete="CASCADE"), nullable=False)
    inherited_from_id: Mapped[int | None] = mapped_column(ForeignKey("asset_categories.id", ondelete="SET NULL"))

    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    label_en: Mapped[str | None] = mapped_column(String(200))
    field_type: Mapped[str] = mapped_column(String(50), nullable=False)  # text, number, date, boolean, select, multiselect, reference, textarea, url, email

    tab_name: Mapped[str] = mapped_column(String(100), default="Informacje", nullable=False)
    section_name: Mapped[str | None] = mapped_column(String(200))

    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_unique: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_value: Mapped[str | None] = mapped_column(String(500))
    placeholder: Mapped[str | None] = mapped_column(String(300))
    help_text: Mapped[str | None] = mapped_column(Text)

    min_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    max_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    max_length: Mapped[int | None] = mapped_column(Integer)
    regex_pattern: Mapped[str | None] = mapped_column(String(500))
    options_json: Mapped[dict | None] = mapped_column(JSON)

    reference_category_id: Mapped[int | None] = mapped_column(ForeignKey("asset_categories.id", ondelete="SET NULL"))

    show_in_list: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    column_width: Mapped[int] = mapped_column(Integer, default=150, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    category: Mapped["AssetCategory"] = relationship(back_populates="field_definitions", foreign_keys=[category_id])


class RelationshipType(Base):
    __tablename__ = "relationship_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_reverse: Mapped[str | None] = mapped_column(String(200))
    color: Mapped[str | None] = mapped_column(String(7))
    icon: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
