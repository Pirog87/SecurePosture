from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import check_db_connection
from app.routers.action import router as action_router
from app.routers.asset import router as asset_router
from app.routers.audit import router as audit_router
from app.routers.catalog import router as catalog_router
from app.routers.assessment import router as assessment_router
from app.routers.cis import router as cis_router
from app.routers.dashboard import router as dashboard_router
from app.routers.domain import router as domain_router
from app.routers.framework import router as framework_router
from app.routers.dictionary import router as dictionary_router
from app.routers.org_unit import router as org_unit_router
from app.routers.risk import router as risk_router
from app.routers.risk_review import router as risk_review_router
from app.routers.vulnerability import router as vulnerability_router
from app.routers.incident import router as incident_router
from app.routers.policy import router as policy_router
from app.routers.policy_exception import router as exception_router
from app.routers.audit_register import router as audit_register_router
from app.routers.security_area import router as security_area_router
from app.routers.vendor import router as vendor_router
from app.routers.awareness import router as awareness_router
from app.routers.security_score import router as score_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router)
app.include_router(dictionary_router)
app.include_router(org_unit_router)
app.include_router(security_area_router)
app.include_router(catalog_router)
app.include_router(asset_router)
app.include_router(risk_router)
app.include_router(risk_review_router)
app.include_router(action_router)
app.include_router(cis_router)
app.include_router(framework_router)
app.include_router(assessment_router)
app.include_router(vulnerability_router)
app.include_router(incident_router)
app.include_router(policy_router)
app.include_router(exception_router)
app.include_router(audit_register_router)
app.include_router(vendor_router)
app.include_router(awareness_router)
app.include_router(score_router)
app.include_router(domain_router)
app.include_router(audit_router)


@app.get("/health")
async def health():
    """Health check — verifies API is running and database is reachable."""
    try:
        await check_db_connection()
        db_status = "connected"
    except Exception as exc:
        db_status = f"error: {exc}"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": db_status,
    }
