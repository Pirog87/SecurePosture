from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.database import check_db_connection
from app.middleware.audit_auto import install_audit_listeners, set_audit_context
from app.routers.action import router as action_router
from app.routers.asset import router as asset_router
from app.routers.asset_category import router as asset_category_router
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
from app.routers.org_context import router as org_context_router
from app.routers.report import router as report_router
from app.routers.smart_catalog import router as smart_catalog_router
from app.routers.control_effectiveness import router as control_effectiveness_router
from app.routers.compliance import router as compliance_router
from app.routers.audit_workflow import programs as audit_programs_router
from app.routers.audit_workflow import engagements as audit_engagements_router
from app.routers.audit_workflow import findings_router as audit_findings_router
from app.routers.framework_mapping import router as framework_mapping_router
from app.routers.test_template import router as test_template_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Install automatic audit logging ──
install_audit_listeners()


class AuditContextMiddleware(BaseHTTPMiddleware):
    """Set per-request audit context (user, IP) for automatic audit logging."""

    async def dispatch(self, request: Request, call_next):
        user_id_header = request.headers.get("X-User-Id")
        ip = request.client.host if request.client else None
        set_audit_context(
            user_id=int(user_id_header) if user_id_header else None,
            ip_address=ip,
        )
        return await call_next(request)


app.add_middleware(AuditContextMiddleware)

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
app.include_router(asset_category_router)
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
app.include_router(org_context_router)
app.include_router(report_router)
app.include_router(smart_catalog_router)
app.include_router(control_effectiveness_router)
app.include_router(compliance_router)
app.include_router(audit_programs_router)
app.include_router(audit_engagements_router)
app.include_router(framework_mapping_router)
app.include_router(test_template_router)
app.include_router(audit_findings_router)


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


@app.get("/api/v1/debug/routes")
async def debug_routes():
    """List all registered API routes — useful for diagnosing 404s."""
    routes = []
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            routes.append({"path": route.path, "methods": sorted(route.methods - {"HEAD", "OPTIONS"})})
    routes.sort(key=lambda r: r["path"])
    ai_routes = [r for r in routes if "/ai/" in r["path"] or "import" in r["path"]]
    return {"total_routes": len(routes), "ai_and_import_routes": ai_routes, "all_routes": routes}
