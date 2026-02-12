"""
Smart Engine — rule-based suggestion engine for Smart Catalog.
Works ALWAYS, independent of AI configuration.
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.smart_catalog import (
    ControlCatalog,
    ThreatCatalog,
    ThreatControlLink,
    ThreatWeaknessLink,
    WeaknessCatalog,
    WeaknessControlLink,
    ThreatAssetCategory,
)

RELEVANCE_ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}


class SuggestionEngine:
    """Rule-based suggestion engine providing catalog correlations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def suggest_weaknesses(self, threat_id: int) -> list[dict]:
        """For a selected threat, return correlated weaknesses sorted by relevance."""
        q = (
            select(
                WeaknessCatalog.id,
                WeaknessCatalog.ref_id,
                WeaknessCatalog.name,
                WeaknessCatalog.description,
                ThreatWeaknessLink.relevance,
            )
            .join(ThreatWeaknessLink, ThreatWeaknessLink.weakness_id == WeaknessCatalog.id)
            .where(ThreatWeaknessLink.threat_id == threat_id)
            .where(WeaknessCatalog.is_active.is_(True))
            .order_by(
                # HIGH first, then MEDIUM, then LOW
                func.case(
                    (ThreatWeaknessLink.relevance == "HIGH", 0),
                    (ThreatWeaknessLink.relevance == "MEDIUM", 1),
                    else_=2,
                )
            )
        )
        rows = (await self.session.execute(q)).all()
        return [
            {
                "weakness_id": r.id,
                "ref_id": r.ref_id,
                "name": r.name,
                "description": r.description,
                "relevance": r.relevance,
            }
            for r in rows
        ]

    async def suggest_controls(self, threat_id: int) -> list[dict]:
        """For a selected threat, return suggested controls sorted by effectiveness."""
        q = (
            select(
                ControlCatalog.id,
                ControlCatalog.ref_id,
                ControlCatalog.name,
                ControlCatalog.description,
                ThreatControlLink.effectiveness,
            )
            .join(ThreatControlLink, ThreatControlLink.control_id == ControlCatalog.id)
            .where(ThreatControlLink.threat_id == threat_id)
            .where(ControlCatalog.is_active.is_(True))
            .order_by(
                func.case(
                    (ThreatControlLink.effectiveness == "HIGH", 0),
                    (ThreatControlLink.effectiveness == "MEDIUM", 1),
                    else_=2,
                )
            )
        )
        rows = (await self.session.execute(q)).all()
        return [
            {
                "control_id": r.id,
                "ref_id": r.ref_id,
                "name": r.name,
                "description": r.description,
                "effectiveness": r.effectiveness,
            }
            for r in rows
        ]

    async def suggest_controls_for_weakness(self, weakness_id: int) -> list[dict]:
        """For a selected weakness, return controls that address it."""
        q = (
            select(
                ControlCatalog.id,
                ControlCatalog.ref_id,
                ControlCatalog.name,
                ControlCatalog.description,
                WeaknessControlLink.effectiveness,
            )
            .join(WeaknessControlLink, WeaknessControlLink.control_id == ControlCatalog.id)
            .where(WeaknessControlLink.weakness_id == weakness_id)
            .where(ControlCatalog.is_active.is_(True))
            .order_by(
                func.case(
                    (WeaknessControlLink.effectiveness == "HIGH", 0),
                    (WeaknessControlLink.effectiveness == "MEDIUM", 1),
                    else_=2,
                )
            )
        )
        rows = (await self.session.execute(q)).all()
        return [
            {
                "control_id": r.id,
                "ref_id": r.ref_id,
                "name": r.name,
                "description": r.description,
                "effectiveness": r.effectiveness,
            }
            for r in rows
        ]

    async def reverse_lookup(self, control_id: int) -> list[dict]:
        """What threats does this control mitigate?"""
        q = (
            select(
                ThreatCatalog.id,
                ThreatCatalog.ref_id,
                ThreatCatalog.name,
                ThreatControlLink.effectiveness,
            )
            .join(ThreatControlLink, ThreatControlLink.threat_id == ThreatCatalog.id)
            .where(ThreatControlLink.control_id == control_id)
            .where(ThreatCatalog.is_active.is_(True))
            .order_by(
                func.case(
                    (ThreatControlLink.effectiveness == "HIGH", 0),
                    (ThreatControlLink.effectiveness == "MEDIUM", 1),
                    else_=2,
                )
            )
        )
        rows = (await self.session.execute(q)).all()
        return [
            {
                "threat_id": r.id,
                "ref_id": r.ref_id,
                "name": r.name,
                "effectiveness": r.effectiveness,
            }
            for r in rows
        ]

    async def coverage_analysis(self, asset_category_id: int) -> dict:
        """Analyze threat coverage for an asset category."""
        # All active threats for this asset category
        all_threats_q = (
            select(ThreatCatalog.id, ThreatCatalog.ref_id, ThreatCatalog.name)
            .join(ThreatAssetCategory, ThreatAssetCategory.threat_id == ThreatCatalog.id)
            .where(ThreatAssetCategory.asset_category_id == asset_category_id)
            .where(ThreatCatalog.is_active.is_(True))
        )
        all_threats = (await self.session.execute(all_threats_q)).all()

        if not all_threats:
            return {"total_threats": 0, "covered": 0, "gaps": [], "coverage_pct": 0.0}

        # Threats that have at least one control linked
        covered_q = (
            select(ThreatCatalog.id)
            .join(ThreatAssetCategory, ThreatAssetCategory.threat_id == ThreatCatalog.id)
            .join(ThreatControlLink, ThreatControlLink.threat_id == ThreatCatalog.id)
            .where(ThreatAssetCategory.asset_category_id == asset_category_id)
            .where(ThreatCatalog.is_active.is_(True))
            .distinct()
        )
        covered_ids = {r[0] for r in (await self.session.execute(covered_q)).all()}

        gaps = [
            {"threat_id": t.id, "ref_id": t.ref_id, "name": t.name}
            for t in all_threats
            if t.id not in covered_ids
        ]
        total = len(all_threats)
        covered = len(covered_ids)
        pct = round((covered / total) * 100, 1) if total > 0 else 0.0

        return {
            "total_threats": total,
            "covered": covered,
            "gaps": gaps,
            "coverage_pct": pct,
        }

    async def quick_risk(self, asset_category_id: int) -> list[dict]:
        """Generate quick risk drafts based on asset category.

        For each threat relevant to the category, return HIGH-relevance
        weaknesses and suggested controls.
        """
        threats_q = (
            select(ThreatCatalog.id, ThreatCatalog.ref_id, ThreatCatalog.name)
            .join(ThreatAssetCategory, ThreatAssetCategory.threat_id == ThreatCatalog.id)
            .where(ThreatAssetCategory.asset_category_id == asset_category_id)
            .where(ThreatCatalog.is_active.is_(True))
            .order_by(ThreatCatalog.ref_id)
        )
        threats = (await self.session.execute(threats_q)).all()

        drafts = []
        for t in threats:
            weaknesses = await self.suggest_weaknesses(t.id)
            controls = await self.suggest_controls(t.id)

            drafts.append({
                "threat_id": t.id,
                "threat_ref_id": t.ref_id,
                "threat_name": t.name,
                "weaknesses": [w for w in weaknesses if w["relevance"] == "HIGH"],
                "suggested_controls": controls,
                "existing_controls": [],
            })
        return drafts
