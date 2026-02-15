"""
Seed script: creates sample audit program with 12 items, 3 suppliers, 4 locations.
Run: cd backend && python ../scripts/seed_audit_programs.py
"""
import asyncio
import os
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

# Ensure backend is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
os.chdir(str(Path(__file__).resolve().parent.parent / "backend"))

from app.database import async_session, engine  # noqa: E402
from app.models.audit_program import (  # noqa: E402
    AuditProgramV2,
    AuditProgramItem,
    Supplier,
    Location,
)


ITEMS = [
    {"name": "Audyt SZBI ISO 27001", "audit_type": "compliance", "planned_quarter": 1, "priority": "critical", "risk_rating": "high", "audit_method": "on_site", "planned_days": Decimal("15"), "scope_type": "org_unit", "scope_name": "Cala organizacja"},
    {"name": "Audyt ochrony danych osobowych (RODO)", "audit_type": "compliance", "planned_quarter": 1, "priority": "high", "risk_rating": "high", "audit_method": "hybrid", "planned_days": Decimal("10"), "scope_type": "process", "scope_name": "Przetwarzanie danych osobowych"},
    {"name": "Audyt bezpieczenstwa sieci", "audit_type": "it", "planned_quarter": 1, "priority": "critical", "risk_rating": "critical", "audit_method": "on_site", "planned_days": Decimal("8"), "scope_type": "system", "scope_name": "Infrastruktura sieciowa"},
    {"name": "Audyt zarzadzania ryzykiem", "audit_type": "operational", "planned_quarter": 2, "priority": "high", "risk_rating": "medium", "audit_method": "document_review", "planned_days": Decimal("6"), "scope_type": "process", "scope_name": "Proces zarzadzania ryzykiem"},
    {"name": "Audyt ciaglosci dzialania (BCP/DRP)", "audit_type": "operational", "planned_quarter": 2, "priority": "high", "risk_rating": "high", "audit_method": "hybrid", "planned_days": Decimal("10"), "scope_type": "process", "scope_name": "Plany ciaglosci dzialania"},
    {"name": "Audyt kontroli dostepu", "audit_type": "security", "planned_quarter": 2, "priority": "critical", "risk_rating": "critical", "audit_method": "on_site", "planned_days": Decimal("8"), "scope_type": "system", "scope_name": "IAM / Active Directory"},
    {"name": "Audyt dostawcy uslug chmurowych", "audit_type": "supplier", "planned_quarter": 3, "priority": "medium", "risk_rating": "medium", "audit_method": "remote", "planned_days": Decimal("5"), "scope_type": "supplier", "scope_name": "AWS / Azure"},
    {"name": "Audyt procesow HR i onboardingu", "audit_type": "process", "planned_quarter": 3, "priority": "medium", "risk_rating": "low", "audit_method": "document_review", "planned_days": Decimal("4"), "scope_type": "org_unit", "scope_name": "Dzial HR"},
    {"name": "Audyt bezpieczenstwa fizycznego", "audit_type": "security", "planned_quarter": 3, "priority": "medium", "risk_rating": "medium", "audit_method": "on_site", "planned_days": Decimal("6"), "scope_type": "location", "scope_name": "Siedziba glowna"},
    {"name": "Audyt zarzadzania incydentami", "audit_type": "operational", "planned_quarter": 4, "priority": "high", "risk_rating": "high", "audit_method": "hybrid", "planned_days": Decimal("7"), "scope_type": "process", "scope_name": "Obsluga incydentow"},
    {"name": "Audyt nastepczy (follow-up Q1-Q2)", "audit_type": "follow_up", "planned_quarter": 4, "priority": "medium", "risk_rating": "low", "audit_method": "document_review", "planned_days": Decimal("5"), "scope_type": "org_unit", "scope_name": "Cala organizacja"},
    {"name": "Audyt finansowy kontroli wewnetrznych", "audit_type": "financial", "planned_quarter": 4, "priority": "high", "risk_rating": "medium", "audit_method": "on_site", "planned_days": Decimal("10"), "scope_type": "org_unit", "scope_name": "Dzial Finansow"},
]

SUPPLIERS = [
    {"name": "Amazon Web Services (AWS)", "description": "Usluga chmurowa IaaS/PaaS", "contact_info": "aws-support@example.com", "criticality": "critical", "data_classification": "confidential", "contract_ref": "CLOUD-2025-001", "status": "active"},
    {"name": "Microsoft Azure", "description": "Platforma chmurowa, M365", "contact_info": "azure-support@example.com", "criticality": "critical", "data_classification": "confidential", "contract_ref": "CLOUD-2025-002", "status": "active"},
    {"name": "Firma Ochroniarska SecGuard", "description": "Ochrona fizyczna obiektow", "contact_info": "biuro@secguard.pl", "criticality": "medium", "data_classification": "internal", "contract_ref": "SEC-2025-010", "status": "active"},
]

LOCATIONS = [
    {"name": "Siedziba glowna - Warszawa", "description": "Glowne biuro organizacji", "location_type": "office", "address": "ul. Marszalkowska 100", "city": "Warszawa", "country": "Polska", "criticality": "critical", "status": "active"},
    {"name": "Data Center - Krakow", "description": "Glowne centrum danych", "location_type": "datacenter", "address": "ul. Krolewska 50", "city": "Krakow", "country": "Polska", "criticality": "critical", "status": "active"},
    {"name": "Biuro regionalne - Gdansk", "description": "Biuro oddzialu polnocnego", "location_type": "office", "address": "ul. Dluga 20", "city": "Gdansk", "country": "Polska", "criticality": "medium", "status": "active"},
    {"name": "Archiwum dokumentow - Wroclaw", "description": "Archiwum fizyczne dokumentacji", "location_type": "warehouse", "address": "ul. Swidnicka 15", "city": "Wroclaw", "country": "Polska", "criticality": "low", "status": "active"},
]


async def seed():
    async with async_session() as s:
        # Create program
        p = AuditProgramV2(
            ref_id="AP-2026-001",
            name="Roczny Program Audytow Wewnetrznych 2026",
            description="Kompleksowy program audytow wewnetrznych obejmujacy bezpieczenstwo informacji, zgodnosc regulacyjna, procesy operacyjne i audyty dostawcow.",
            version=1,
            status="draft",
            period_type="annual",
            period_start=date(2026, 1, 1),
            period_end=date(2026, 12, 31),
            year=2026,
            strategic_objectives="Zapewnienie zgodnosci z ISO 27001, NIS2, RODO. Poprawa poziomu bezpieczenstwa informacji. Identyfikacja i mitygacja kluczowych ryzyk.",
            scope_description="Wszystkie procesy biznesowe, systemy IT, lokalizacje fizyczne i kluczowi dostawcy.",
            audit_criteria="ISO 27001:2022, ISO 27002:2022, RODO, polityki wewnetrzne, standardy branzowe.",
            methods="Wywiady, przeglady dokumentacji, testy techniczne, obserwacje na miejscu.",
            budget_planned_days=Decimal("94"),
            budget_planned_cost=Decimal("188000"),
            budget_currency="PLN",
            owner_id=1,
            approver_id=2,
            created_by=1,
        )
        s.add(p)
        await s.flush()
        p.version_group_id = p.id
        p.is_current_version = True

        # Create items
        for idx, item_data in enumerate(ITEMS):
            item = AuditProgramItem(
                audit_program_id=p.id,
                ref_id=f"API-{idx + 1:03d}",
                display_order=idx,
                lead_auditor_id=1,
                **item_data,
            )
            s.add(item)

        # Create suppliers
        for sup_data in SUPPLIERS:
            s.add(Supplier(**sup_data))

        # Create locations
        for loc_data in LOCATIONS:
            s.add(Location(**loc_data))

        await s.commit()
        print(f"Seeded program '{p.name}' (id={p.id}) with {len(ITEMS)} items")
        print(f"Seeded {len(SUPPLIERS)} suppliers and {len(LOCATIONS)} locations")


if __name__ == "__main__":
    asyncio.run(seed())
