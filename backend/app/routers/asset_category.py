"""
Asset CMDB categories & field definitions — /api/v1/asset-categories
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.asset import Asset
from app.models.asset_category import AssetCategory, CategoryFieldDefinition, RelationshipType
from app.schemas.asset_category import (
    AssetCategoryCreate, AssetCategoryOut, AssetCategoryTreeNode, AssetCategoryUpdate,
    FieldDefinitionCreate, FieldDefinitionOut, FieldDefinitionUpdate,
    RelationshipTypeCreate, RelationshipTypeOut, RelationshipTypeUpdate,
)

router = APIRouter(prefix="/api/v1/asset-categories", tags=["CMDB Kategorie"])


# ═══════════════════ HELPERS ═══════════════════

async def _cat_out(s: AsyncSession, cat: AssetCategory) -> AssetCategoryOut:
    count_q = select(func.count()).select_from(Asset).where(
        Asset.asset_category_id == cat.id, Asset.is_active.is_(True),
    )
    asset_count = (await s.execute(count_q)).scalar() or 0
    return AssetCategoryOut(
        id=cat.id, parent_id=cat.parent_id, name=cat.name, name_plural=cat.name_plural,
        code=cat.code, icon=cat.icon, color=cat.color, description=cat.description,
        is_abstract=cat.is_abstract, sort_order=cat.sort_order, is_active=cat.is_active,
        asset_count=asset_count, created_at=cat.created_at, updated_at=cat.updated_at,
    )


def _build_tree(flat: list[AssetCategoryOut]) -> list[AssetCategoryTreeNode]:
    """Convert flat list into nested tree."""
    by_id: dict[int, AssetCategoryTreeNode] = {}
    for c in flat:
        by_id[c.id] = AssetCategoryTreeNode(**c.model_dump(), children=[])
    roots: list[AssetCategoryTreeNode] = []
    for node in by_id.values():
        if node.parent_id and node.parent_id in by_id:
            by_id[node.parent_id].children.append(node)
        else:
            roots.append(node)
    # Sort children by sort_order
    for node in by_id.values():
        node.children.sort(key=lambda c: c.sort_order)
    roots.sort(key=lambda c: c.sort_order)
    return roots


# ═══════════════════ CATEGORY TREE ═══════════════════

@router.get("/tree", response_model=list[AssetCategoryTreeNode], summary="Drzewo kategorii aktywow")
async def get_category_tree(
    include_inactive: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(AssetCategory)
    if not include_inactive:
        q = q.where(AssetCategory.is_active.is_(True))
    q = q.order_by(AssetCategory.sort_order, AssetCategory.name)
    cats = (await s.execute(q)).scalars().all()
    flat = [await _cat_out(s, c) for c in cats]
    return _build_tree(flat)


@router.get("", response_model=list[AssetCategoryOut], summary="Lista kategorii (flat)")
async def list_categories(
    include_inactive: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(AssetCategory)
    if not include_inactive:
        q = q.where(AssetCategory.is_active.is_(True))
    q = q.order_by(AssetCategory.sort_order, AssetCategory.name)
    cats = (await s.execute(q)).scalars().all()
    return [await _cat_out(s, c) for c in cats]


@router.get("/{category_id}", response_model=AssetCategoryOut, summary="Pobierz kategorie")
async def get_category(category_id: int, s: AsyncSession = Depends(get_session)):
    cat = await s.get(AssetCategory, category_id)
    if not cat:
        raise HTTPException(404, "Kategoria nie istnieje")
    return await _cat_out(s, cat)


@router.post("", response_model=AssetCategoryOut, status_code=201, summary="Utwórz kategorie")
async def create_category(body: AssetCategoryCreate, s: AsyncSession = Depends(get_session)):
    # Check code uniqueness
    existing = (await s.execute(
        select(AssetCategory).where(AssetCategory.code == body.code)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"Kategoria z kodem '{body.code}' juz istnieje")
    cat = AssetCategory(**body.model_dump())
    s.add(cat)
    await s.commit()
    await s.refresh(cat)
    return await _cat_out(s, cat)


@router.put("/{category_id}", response_model=AssetCategoryOut, summary="Edytuj kategorie")
async def update_category(category_id: int, body: AssetCategoryUpdate, s: AsyncSession = Depends(get_session)):
    cat = await s.get(AssetCategory, category_id)
    if not cat:
        raise HTTPException(404, "Kategoria nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    await s.commit()
    await s.refresh(cat)
    return await _cat_out(s, cat)


@router.delete("/{category_id}", summary="Dezaktywuj kategorie")
async def deactivate_category(category_id: int, s: AsyncSession = Depends(get_session)):
    cat = await s.get(AssetCategory, category_id)
    if not cat:
        raise HTTPException(404, "Kategoria nie istnieje")
    cat.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": category_id}


# ═══════════════════ FIELD DEFINITIONS ═══════════════════

@router.get("/{category_id}/fields", response_model=list[FieldDefinitionOut], summary="Pola formularza kategorii")
async def get_category_fields(
    category_id: int,
    include_inherited: bool = Query(True),
    s: AsyncSession = Depends(get_session),
):
    cat = await s.get(AssetCategory, category_id)
    if not cat:
        raise HTTPException(404, "Kategoria nie istnieje")

    fields: list[FieldDefinitionOut] = []

    # Collect inherited fields from ancestors
    if include_inherited:
        ancestor_ids = []
        current = cat
        while current.parent_id:
            ancestor_ids.append(current.parent_id)
            current = await s.get(AssetCategory, current.parent_id)
            if not current:
                break
        if ancestor_ids:
            q = select(CategoryFieldDefinition).where(
                CategoryFieldDefinition.category_id.in_(ancestor_ids),
                CategoryFieldDefinition.is_active.is_(True),
            ).order_by(CategoryFieldDefinition.sort_order)
            inherited = (await s.execute(q)).scalars().all()
            for f in inherited:
                fields.append(FieldDefinitionOut(
                    id=f.id, category_id=category_id,
                    inherited_from_id=f.category_id,
                    field_key=f.field_key, label=f.label, label_en=f.label_en,
                    field_type=f.field_type, tab_name=f.tab_name, section_name=f.section_name,
                    is_required=f.is_required, is_unique=f.is_unique,
                    default_value=f.default_value, placeholder=f.placeholder,
                    help_text=f.help_text, min_value=float(f.min_value) if f.min_value else None,
                    max_value=float(f.max_value) if f.max_value else None,
                    max_length=f.max_length, regex_pattern=f.regex_pattern,
                    options_json=f.options_json, reference_category_id=f.reference_category_id,
                    show_in_list=f.show_in_list, sort_order=f.sort_order,
                    column_width=f.column_width, is_active=f.is_active,
                    created_at=f.created_at,
                ))

    # Own fields
    q = select(CategoryFieldDefinition).where(
        CategoryFieldDefinition.category_id == category_id,
        CategoryFieldDefinition.is_active.is_(True),
    ).order_by(CategoryFieldDefinition.sort_order)
    own = (await s.execute(q)).scalars().all()
    existing_keys = {f.field_key for f in fields}
    for f in own:
        if f.field_key not in existing_keys:
            fields.append(FieldDefinitionOut.model_validate(f))

    fields.sort(key=lambda f: (f.tab_name, f.sort_order))
    return fields


@router.post("/{category_id}/fields", response_model=FieldDefinitionOut, status_code=201, summary="Dodaj pole")
async def create_field(category_id: int, body: FieldDefinitionCreate, s: AsyncSession = Depends(get_session)):
    cat = await s.get(AssetCategory, category_id)
    if not cat:
        raise HTTPException(404, "Kategoria nie istnieje")
    body.category_id = category_id
    field = CategoryFieldDefinition(**body.model_dump())
    s.add(field)
    await s.commit()
    await s.refresh(field)
    return FieldDefinitionOut.model_validate(field)


@router.put("/fields/{field_id}", response_model=FieldDefinitionOut, summary="Edytuj pole")
async def update_field(field_id: int, body: FieldDefinitionUpdate, s: AsyncSession = Depends(get_session)):
    field = await s.get(CategoryFieldDefinition, field_id)
    if not field:
        raise HTTPException(404, "Pole nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(field, k, v)
    await s.commit()
    await s.refresh(field)
    return FieldDefinitionOut.model_validate(field)


@router.delete("/fields/{field_id}", summary="Usun pole")
async def delete_field(field_id: int, s: AsyncSession = Depends(get_session)):
    field = await s.get(CategoryFieldDefinition, field_id)
    if not field:
        raise HTTPException(404, "Pole nie istnieje")
    field.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": field_id}


# ═══════════════════ RELATIONSHIP TYPES ═══════════════════

@router.get("/relationship-types/all", response_model=list[RelationshipTypeOut], summary="Typy relacji")
async def list_relationship_types(
    include_inactive: bool = Query(False),
    s: AsyncSession = Depends(get_session),
):
    q = select(RelationshipType).order_by(RelationshipType.sort_order)
    if not include_inactive:
        q = q.where(RelationshipType.is_active.is_(True))
    types = (await s.execute(q)).scalars().all()
    return [RelationshipTypeOut.model_validate(t) for t in types]


@router.post("/relationship-types", response_model=RelationshipTypeOut, status_code=201, summary="Utwórz typ relacji")
async def create_relationship_type(body: RelationshipTypeCreate, s: AsyncSession = Depends(get_session)):
    existing = (await s.execute(
        select(RelationshipType).where(RelationshipType.code == body.code)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"Typ relacji z kodem '{body.code}' juz istnieje")
    rt = RelationshipType(**body.model_dump())
    s.add(rt)
    await s.commit()
    await s.refresh(rt)
    return RelationshipTypeOut.model_validate(rt)


@router.put("/relationship-types/{rt_id}", response_model=RelationshipTypeOut, summary="Edytuj typ relacji")
async def update_relationship_type(rt_id: int, body: RelationshipTypeUpdate, s: AsyncSession = Depends(get_session)):
    rt = await s.get(RelationshipType, rt_id)
    if not rt:
        raise HTTPException(404, "Typ relacji nie istnieje")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rt, k, v)
    await s.commit()
    await s.refresh(rt)
    return RelationshipTypeOut.model_validate(rt)


@router.delete("/relationship-types/{rt_id}", summary="Dezaktywuj typ relacji")
async def deactivate_relationship_type(rt_id: int, s: AsyncSession = Depends(get_session)):
    rt = await s.get(RelationshipType, rt_id)
    if not rt:
        raise HTTPException(404, "Typ relacji nie istnieje")
    rt.is_active = False
    await s.commit()
    return {"status": "deactivated", "id": rt_id}
