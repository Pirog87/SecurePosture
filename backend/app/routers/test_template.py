"""
Test Template catalog — /api/v1/test-templates
Reusable audit test templates.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.compliance import TestTemplate
from app.schemas.compliance import TestTemplateCreate, TestTemplateOut, TestTemplateUpdate

router = APIRouter(prefix="/api/v1/test-templates", tags=["Test Templates"])


@router.get("/", response_model=list[TestTemplateOut])
async def list_templates(
    category: str | None = None,
    test_type: str | None = None,
    is_active: bool = True,
    s: AsyncSession = Depends(get_session),
):
    q = select(TestTemplate).where(TestTemplate.is_active == is_active)
    if category:
        q = q.where(TestTemplate.category == category)
    if test_type:
        q = q.where(TestTemplate.test_type == test_type)
    q = q.order_by(TestTemplate.ref_id, TestTemplate.name)
    rows = (await s.execute(q)).scalars().all()
    return [TestTemplateOut.model_validate(t) for t in rows]


@router.get("/{tt_id}", response_model=TestTemplateOut)
async def get_template(tt_id: int, s: AsyncSession = Depends(get_session)):
    t = await s.get(TestTemplate, tt_id)
    if not t:
        raise HTTPException(404, "Test template not found")
    return TestTemplateOut.model_validate(t)


@router.post("/", response_model=TestTemplateOut, status_code=201)
async def create_template(body: TestTemplateCreate, s: AsyncSession = Depends(get_session)):
    t = TestTemplate(**body.model_dump())
    s.add(t)
    await s.commit()
    await s.refresh(t)
    return TestTemplateOut.model_validate(t)


@router.put("/{tt_id}", response_model=TestTemplateOut)
async def update_template(tt_id: int, body: TestTemplateUpdate, s: AsyncSession = Depends(get_session)):
    t = await s.get(TestTemplate, tt_id)
    if not t:
        raise HTTPException(404, "Test template not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    await s.commit()
    await s.refresh(t)
    return TestTemplateOut.model_validate(t)
