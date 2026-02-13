"""
AI Service — central orchestrator for optional AI features.
Returns None / raises AINotConfiguredException when AI is not available.
Works with graceful degradation: if AI API fails, system reverts to rule-based.
"""
import json
import re
import time
from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.smart_catalog import (
    AIAuditLog,
    AIProviderConfig,
    ControlCatalog,
    ThreatAssetCategory,
    ThreatCatalog,
    ThreatControlLink,
    ThreatWeaknessLink,
    WeaknessCatalog,
    WeaknessControlLink,
)
from app.services.ai_adapters import get_ai_adapter
from app.services.ai_prompts import (
    SYSTEM_PROMPT_ASSIST,
    SYSTEM_PROMPT_ENRICHMENT,
    SYSTEM_PROMPT_GAP_ANALYSIS,
    SYSTEM_PROMPT_SCENARIO_GEN,
    SYSTEM_PROMPT_SEARCH,
)


class AINotConfiguredException(Exception):
    """Raised when AI is not configured or disabled."""


class AIFeatureDisabledException(Exception):
    """Raised when a specific AI feature is disabled."""


class AIRateLimitException(Exception):
    """Raised when AI rate limit is exceeded."""


class AIParsingError(Exception):
    """Raised when AI response cannot be parsed."""


class AIService:
    """Central AI service with graceful degradation."""

    def __init__(self, session: AsyncSession, config: AIProviderConfig | None = None):
        self.session = session
        self.config = config
        self.adapter = get_ai_adapter(config) if config else None

    @property
    def is_available(self) -> bool:
        return self.adapter is not None and self.config is not None and self.config.is_active

    def _require_ai(self):
        if not self.is_available:
            raise AINotConfiguredException(
                "AI nie jest skonfigurowane. "
                "Administrator moze aktywowac AI w Ustawienia > Integracja AI."
            )

    def _require_feature(self, feature_name: str):
        self._require_ai()
        if not getattr(self.config, f"feature_{feature_name}", False):
            raise AIFeatureDisabledException(
                f"Funkcja AI '{feature_name}' jest wylaczona."
            )

    async def _check_rate_limit(self, user_id: int):
        """Check per-user and per-org rate limits."""
        self._require_ai()
        now = datetime.utcnow()

        # Per-user per-hour
        hour_ago = now - timedelta(hours=1)
        q_hour = select(func.count()).select_from(AIAuditLog).where(
            AIAuditLog.user_id == user_id,
            AIAuditLog.created_at >= hour_ago,
        )
        count_hour = (await self.session.execute(q_hour)).scalar() or 0
        if count_hour >= self.config.max_requests_per_user_per_hour:
            raise AIRateLimitException(
                f"Przekroczono limit {self.config.max_requests_per_user_per_hour} "
                f"zapytan AI na godzine."
            )

        # Per-user per-day
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        q_day = select(func.count()).select_from(AIAuditLog).where(
            AIAuditLog.user_id == user_id,
            AIAuditLog.created_at >= day_start,
        )
        count_day = (await self.session.execute(q_day)).scalar() or 0
        if count_day >= self.config.max_requests_per_user_per_day:
            raise AIRateLimitException(
                f"Przekroczono limit {self.config.max_requests_per_user_per_day} "
                f"zapytan AI na dzien."
            )

        # Per-org per-day
        if self.config.org_unit_id:
            q_org = select(func.count()).select_from(AIAuditLog).where(
                AIAuditLog.org_unit_id == self.config.org_unit_id,
                AIAuditLog.created_at >= day_start,
            )
            count_org = (await self.session.execute(q_org)).scalar() or 0
            if count_org >= self.config.max_requests_per_org_per_day:
                raise AIRateLimitException(
                    f"Przekroczono limit {self.config.max_requests_per_org_per_day} "
                    f"zapytan AI na dzien dla organizacji."
                )

    async def _call_llm(self, system: str, user_message: str,
                        action_type: str, user_id: int,
                        max_tokens: int | None = None) -> dict:
        """Call LLM with JSON parsing and audit logging."""
        self._require_ai()
        await self._check_rate_limit(user_id)

        max_tokens = max_tokens or self.config.max_tokens
        start_time = time.time()

        try:
            text = await self.adapter.chat_completion(
                system=system,
                user_message=user_message,
                max_tokens=max_tokens,
                temperature=float(self.config.temperature),
            )

            # Parse JSON from response
            result = self._parse_json(text)

            duration_ms = int((time.time() - start_time) * 1000)
            await self._log_call(
                user_id=user_id,
                action_type=action_type,
                duration_ms=duration_ms,
                success=True,
                input_summary=user_message[:500],
                output_summary=text[:500],
            )
            return result

        except (AIParsingError, AIRateLimitException):
            raise
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            await self._log_call(
                user_id=user_id,
                action_type=action_type,
                duration_ms=duration_ms,
                success=False,
                error=str(e),
                input_summary=user_message[:500],
            )
            raise

    def _parse_json(self, text: str) -> dict | list:
        """Parse JSON from LLM response, handling markdown code blocks."""
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from ```json ... ``` block
        match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try extracting any JSON array or object
        for pattern in [r"\[.*\]", r"\{.*\}"]:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    pass

        raise AIParsingError("AI zwrocilo nieprawidlowy JSON")

    async def _log_call(self, user_id: int, action_type: str,
                        duration_ms: int, success: bool,
                        input_summary: str | None = None,
                        output_summary: str | None = None,
                        error: str | None = None):
        """Log AI call to audit table."""
        log = AIAuditLog(
            user_id=user_id,
            org_unit_id=self.config.org_unit_id if self.config else None,
            action_type=action_type,
            provider_type=self.config.provider_type if self.config else "unknown",
            model_used=self.config.model_name if self.config else "unknown",
            input_summary=input_summary,
            output_summary=output_summary,
            duration_ms=duration_ms,
            success=success,
            error=error,
        )
        self.session.add(log)
        await self.session.flush()

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 1: AI-assisted scenario generation
    # ═══════════════════════════════════════════════════════════════════

    async def generate_scenarios(self, asset_category_id: int,
                                 user_id: int,
                                 org_context: str | None = None) -> list[dict]:
        """Generate risk scenarios using AI. Requires feature_scenario_generation."""
        self._require_feature("scenario_generation")

        # Build context from existing catalog data
        context = await self._build_scenario_context(asset_category_id)
        prompt = (
            f"Kategoria aktywa: {context['category_name']}\n"
            f"Istniejace zagrozenia dla tej kategorii:\n{context['existing_threats']}\n"
            f"Istniejace zabezpieczenia:\n{context['existing_controls']}\n"
        )
        if org_context:
            prompt += f"Kontekst organizacji: {org_context}\n"
        prompt += "\nWygeneruj 3-5 scenariuszy ryzyka specyficznych dla tej kategorii."

        result = await self._call_llm(
            system=SYSTEM_PROMPT_SCENARIO_GEN,
            user_message=prompt,
            action_type="SCENARIO_GEN",
            user_id=user_id,
            max_tokens=4000,
        )

        if isinstance(result, dict) and "scenarios" in result:
            return result["scenarios"]
        if isinstance(result, list):
            return result
        return [result]

    async def _build_scenario_context(self, asset_category_id: int) -> dict:
        """Build context string from catalog data for scenario generation."""
        from app.models.asset_category import AssetCategory

        cat = await self.session.get(AssetCategory, asset_category_id)
        cat_name = cat.name if cat else f"ID={asset_category_id}"

        # Threats for this category
        t_q = (
            select(ThreatCatalog.ref_id, ThreatCatalog.name)
            .join(ThreatAssetCategory, ThreatAssetCategory.threat_id == ThreatCatalog.id)
            .where(ThreatAssetCategory.asset_category_id == asset_category_id)
            .where(ThreatCatalog.is_active.is_(True))
            .limit(30)
        )
        threats = (await self.session.execute(t_q)).all()
        threats_text = "\n".join(f"- {t.ref_id}: {t.name}" for t in threats) or "Brak"

        # Controls for threats in this category
        c_q = (
            select(ControlCatalog.ref_id, ControlCatalog.name)
            .join(ThreatControlLink, ThreatControlLink.control_id == ControlCatalog.id)
            .join(ThreatCatalog, ThreatControlLink.threat_id == ThreatCatalog.id)
            .join(ThreatAssetCategory, ThreatAssetCategory.threat_id == ThreatCatalog.id)
            .where(ThreatAssetCategory.asset_category_id == asset_category_id)
            .where(ControlCatalog.is_active.is_(True))
            .distinct()
            .limit(30)
        )
        controls = (await self.session.execute(c_q)).all()
        controls_text = "\n".join(f"- {c.ref_id}: {c.name}" for c in controls) or "Brak"

        return {
            "category_name": cat_name,
            "existing_threats": threats_text,
            "existing_controls": controls_text,
        }

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 2: Correlation enrichment
    # ═══════════════════════════════════════════════════════════════════

    async def enrich_correlations(self, user_id: int,
                                   scope: str = "all") -> list[dict]:
        """Suggest missing correlations using AI."""
        self._require_feature("correlation_enrichment")

        # Get current catalog entries
        threats = (await self.session.execute(
            select(ThreatCatalog.ref_id, ThreatCatalog.name)
            .where(ThreatCatalog.is_active.is_(True)).limit(50)
        )).all()
        weaknesses = (await self.session.execute(
            select(WeaknessCatalog.ref_id, WeaknessCatalog.name)
            .where(WeaknessCatalog.is_active.is_(True)).limit(50)
        )).all()
        controls = (await self.session.execute(
            select(ControlCatalog.ref_id, ControlCatalog.name)
            .where(ControlCatalog.is_active.is_(True)).limit(50)
        )).all()

        # Get existing links count
        tw_count = (await self.session.execute(
            select(func.count()).select_from(ThreatWeaknessLink)
        )).scalar() or 0
        tc_count = (await self.session.execute(
            select(func.count()).select_from(ThreatControlLink)
        )).scalar() or 0

        prompt = (
            f"Katalog zagrozen ({len(threats)} wpisow):\n"
            + "\n".join(f"- {t.ref_id}: {t.name}" for t in threats)
            + f"\n\nKatalog slabosci ({len(weaknesses)} wpisow):\n"
            + "\n".join(f"- {w.ref_id}: {w.name}" for w in weaknesses)
            + f"\n\nKatalog zabezpieczen ({len(controls)} wpisow):\n"
            + "\n".join(f"- {c.ref_id}: {c.name}" for c in controls)
            + f"\n\nIstniejace powiazania: {tw_count} threat-weakness, {tc_count} threat-control."
            + f"\nScope: {scope}"
            + "\nZaproponuj brakujace powiazania."
        )

        result = await self._call_llm(
            system=SYSTEM_PROMPT_ENRICHMENT,
            user_message=prompt,
            action_type="ENRICHMENT",
            user_id=user_id,
            max_tokens=4000,
        )

        if isinstance(result, dict) and "suggested_links" in result:
            return result["suggested_links"]
        if isinstance(result, list):
            return result
        return []

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 3: Natural language search
    # ═══════════════════════════════════════════════════════════════════

    async def search_catalog(self, query: str, user_id: int) -> dict:
        """AI-powered natural language search."""
        self._require_feature("natural_language_search")

        # Get available categories for context
        from app.models.asset_category import AssetCategory
        categories = (await self.session.execute(
            select(AssetCategory.code, AssetCategory.name)
            .where(AssetCategory.is_active.is_(True))
            .where(AssetCategory.is_abstract.is_(False))
            .limit(30)
        )).all()

        prompt = (
            f"Pytanie uzytkownika: {query}\n\n"
            f"Dostepne kategorie aktywow:\n"
            + "\n".join(f"- {c.code}: {c.name}" for c in categories)
            + "\n\nZidentyfikuj parametry wyszukiwania."
        )

        result = await self._call_llm(
            system=SYSTEM_PROMPT_SEARCH,
            user_message=prompt,
            action_type="SEARCH",
            user_id=user_id,
            max_tokens=1000,
        )
        return result if isinstance(result, dict) else {"keywords": [query]}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 4: Gap analysis
    # ═══════════════════════════════════════════════════════════════════

    async def gap_analysis(self, user_id: int,
                            asset_category_id: int | None = None) -> dict:
        """AI-powered gap analysis."""
        self._require_feature("gap_analysis")

        # Build coverage data
        from app.services.suggestion_engine import SuggestionEngine
        engine = SuggestionEngine(self.session)

        if asset_category_id:
            coverage = await engine.coverage_analysis(asset_category_id)
            prompt = (
                f"Analiza pokrycia dla kategorii aktywow ID={asset_category_id}:\n"
                f"- Zagrozenia ogolem: {coverage['total_threats']}\n"
                f"- Pokryte: {coverage['covered']}\n"
                f"- Pokrycie: {coverage['coverage_pct']}%\n"
                f"- Luki: {json.dumps(coverage['gaps'], ensure_ascii=False)}\n"
                f"\nPrzeanalizuj i zasugeruj dzialania."
            )
        else:
            # Get all categories with coverage
            from app.models.asset_category import AssetCategory
            categories = (await self.session.execute(
                select(AssetCategory.id, AssetCategory.name)
                .where(AssetCategory.is_active.is_(True))
                .where(AssetCategory.is_abstract.is_(False))
                .limit(15)
            )).all()

            coverage_data = []
            for cat in categories:
                cov = await engine.coverage_analysis(cat.id)
                if cov["total_threats"] > 0:
                    coverage_data.append({
                        "category": cat.name,
                        "total": cov["total_threats"],
                        "covered": cov["covered"],
                        "pct": cov["coverage_pct"],
                        "gaps_count": len(cov["gaps"]),
                    })

            prompt = (
                "Analiza pokrycia dla wszystkich kategorii aktywow:\n"
                + json.dumps(coverage_data, ensure_ascii=False, indent=2)
                + "\n\nPrzeanalizuj i zasugeruj dzialania priorytetowe."
            )

        result = await self._call_llm(
            system=SYSTEM_PROMPT_GAP_ANALYSIS,
            user_message=prompt,
            action_type="GAP_ANALYSIS",
            user_id=user_id,
            max_tokens=4000,
        )
        return result if isinstance(result, dict) else {"analysis": result}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 5: Entry assist
    # ═══════════════════════════════════════════════════════════════════

    async def assist_entry(self, entry_type: str, name: str,
                            description: str, user_id: int) -> dict:
        """AI-assisted entry creation suggestions."""
        self._require_feature("entry_assist")

        # Get existing entries for context
        from app.models.asset_category import AssetCategory
        categories = (await self.session.execute(
            select(AssetCategory.code, AssetCategory.name)
            .where(AssetCategory.is_active.is_(True))
            .where(AssetCategory.is_abstract.is_(False))
            .limit(30)
        )).all()

        prompt = (
            f"Typ wpisu: {entry_type}\n"
            f"Nazwa: {name}\n"
            f"Opis: {description}\n\n"
            f"Dostepne kategorie aktywow:\n"
            + "\n".join(f"- {c.code}: {c.name}" for c in categories)
            + "\n\nZasugeruj klasyfikacje i powiazania."
        )

        result = await self._call_llm(
            system=SYSTEM_PROMPT_ASSIST,
            user_message=prompt,
            action_type="ASSIST",
            user_id=user_id,
            max_tokens=2000,
        )
        return result if isinstance(result, dict) else {"suggestions": result}


async def get_ai_service(session: AsyncSession) -> AIService:
    """Factory: create AIService with current active config."""
    q = select(AIProviderConfig).where(AIProviderConfig.is_active.is_(True)).limit(1)
    config = (await session.execute(q)).scalar_one_or_none()
    return AIService(session, config)
