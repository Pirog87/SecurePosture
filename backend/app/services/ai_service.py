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
from app.services.ai_adapters import LLMResponse, get_ai_adapter
from app.services.ai_prompts import (
    SYSTEM_PROMPT_ASSIST,
    SYSTEM_PROMPT_COVERAGE_REPORT,
    SYSTEM_PROMPT_CROSS_MAPPING,
    SYSTEM_PROMPT_ENRICHMENT,
    SYSTEM_PROMPT_EVIDENCE,
    SYSTEM_PROMPT_GAP_ANALYSIS,
    SYSTEM_PROMPT_INTERPRET,
    SYSTEM_PROMPT_SCENARIO_GEN,
    SYSTEM_PROMPT_SEARCH,
    SYSTEM_PROMPT_SECURITY_AREA_MAP,
    SYSTEM_PROMPT_TRANSLATE,
    SYSTEM_PROMPT_DOCUMENT_IMPORT,
    SYSTEM_PROMPT_DOCUMENT_IMPORT_CONTINUATION,
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
                        max_tokens: int | None = None,
                        timeout: int = 120) -> dict:
        """Call LLM with JSON parsing and audit logging."""
        self._require_ai()
        await self._check_rate_limit(user_id)

        max_tokens = max_tokens or self.config.max_tokens
        start_time = time.time()

        try:
            llm_resp: LLMResponse = await self.adapter.chat_completion(
                system=system,
                user_message=user_message,
                max_tokens=max_tokens,
                temperature=float(self.config.temperature),
                timeout=timeout,
            )

            # Parse JSON from response
            result = self._parse_json(llm_resp.text)

            duration_ms = int((time.time() - start_time) * 1000)
            await self._log_call(
                user_id=user_id,
                action_type=action_type,
                duration_ms=duration_ms,
                success=True,
                input_summary=user_message[:500],
                output_summary=llm_resp.text[:500],
                tokens_input=llm_resp.tokens_input,
                tokens_output=llm_resp.tokens_output,
                cost_usd=llm_resp.cost_usd,
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
        """Parse JSON from LLM response, handling markdown code blocks and truncation."""
        import logging
        logger = logging.getLogger(__name__)

        # 1. Direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 2. Extract from ```json ... ``` block
        match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # 3. Extract any JSON object or array
        for pattern in [r"\{.*\}", r"\[.*\]"]:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    pass

        # 4. Try to fix truncated JSON (response cut off at max_tokens)
        #    Find the start of JSON and attempt to close open brackets/braces
        json_start = re.search(r'[\[{]', text)
        if json_start:
            partial = text[json_start.start():]
            repaired = self._try_repair_json(partial)
            if repaired is not None:
                logger.warning("AI response was truncated — repaired JSON successfully")
                return repaired

        logger.error(
            "AI returned unparseable response (first 500 chars): %s",
            text[:500],
        )
        raise AIParsingError(
            f"AI zwrocilo nieprawidlowy JSON. "
            f"Odpowiedz zaczyna sie od: {text[:200]}"
        )

    @staticmethod
    def _try_repair_json(text: str) -> dict | list | None:
        """Try to repair truncated JSON by closing open brackets/braces."""
        # Remove trailing incomplete string/value
        # Find last complete element by looking for last comma or colon+value
        for trim in range(min(200, len(text)), 0, -1):
            candidate = text[:len(text) - trim]
            # Count open/close brackets
            opens = []
            in_string = False
            escape = False
            for ch in candidate:
                if escape:
                    escape = False
                    continue
                if ch == '\\' and in_string:
                    escape = True
                    continue
                if ch == '"' and not escape:
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if ch in '{[':
                    opens.append(ch)
                elif ch == '}':
                    if opens and opens[-1] == '{':
                        opens.pop()
                elif ch == ']':
                    if opens and opens[-1] == '[':
                        opens.pop()

            # Close any remaining open brackets
            if in_string:
                candidate += '"'
            closers = ""
            for o in reversed(opens):
                closers += ']' if o == '[' else '}'
            try:
                return json.loads(candidate + closers)
            except json.JSONDecodeError:
                continue
        return None

    async def _log_call(self, user_id: int, action_type: str,
                        duration_ms: int, success: bool,
                        input_summary: str | None = None,
                        output_summary: str | None = None,
                        error: str | None = None,
                        tokens_input: int | None = None,
                        tokens_output: int | None = None,
                        cost_usd=None):
        """Log AI call to audit table with token usage and cost."""
        log = AIAuditLog(
            user_id=user_id,
            org_unit_id=self.config.org_unit_id if self.config else None,
            action_type=action_type,
            provider_type=self.config.provider_type if self.config else "unknown",
            model_used=self.config.model_name if self.config else "unknown",
            input_summary=input_summary,
            output_summary=output_summary,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            cost_usd=cost_usd,
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

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 6: Framework node interpretation
    # ═══════════════════════════════════════════════════════════════════

    async def interpret_node(
        self,
        user_id: int,
        framework_name: str,
        node_ref_id: str | None,
        node_name: str,
        node_description: str | None,
    ) -> dict:
        """Generate expert interpretation of a framework requirement."""
        self._require_ai()

        prompt = (
            f"Framework: {framework_name}\n"
            f"Ref ID: {node_ref_id or 'brak'}\n"
            f"Nazwa wymagania: {node_name}\n"
        )
        if node_description:
            prompt += f"Opis: {node_description}\n"
        prompt += "\nWygeneruj interpretacje tego wymagania."

        result = await self._call_llm(
            system=SYSTEM_PROMPT_INTERPRET,
            user_message=prompt,
            action_type="INTERPRET",
            user_id=user_id,
            max_tokens=2000,
        )
        return result if isinstance(result, dict) else {"interpretation": str(result)}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 7: Framework node translation
    # ═══════════════════════════════════════════════════════════════════

    async def translate_node(
        self,
        user_id: int,
        framework_name: str,
        node_ref_id: str | None,
        node_name: str,
        node_description: str | None,
        target_language: str,
    ) -> dict:
        """Translate a framework requirement to the specified language."""
        self._require_ai()

        prompt = (
            f"Framework: {framework_name}\n"
            f"Ref ID: {node_ref_id or 'brak'}\n"
            f"Nazwa wymagania: {node_name}\n"
        )
        if node_description:
            prompt += f"Opis: {node_description}\n"
        prompt += f"\nPrzetlumacz na jezyk: {target_language}"

        result = await self._call_llm(
            system=SYSTEM_PROMPT_TRANSLATE,
            user_message=prompt,
            action_type="TRANSLATE",
            user_id=user_id,
            max_tokens=2000,
        )
        return result if isinstance(result, dict) else {"translated_name": str(result)}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 8: Evidence checklist generation
    # ═══════════════════════════════════════════════════════════════════

    async def generate_evidence(
        self,
        user_id: int,
        framework_name: str,
        node_ref_id: str | None,
        node_name: str,
        node_description: str | None,
    ) -> dict:
        """Generate audit evidence checklist for a framework requirement."""
        self._require_ai()

        prompt = (
            f"Framework: {framework_name}\n"
            f"Ref ID: {node_ref_id or 'brak'}\n"
            f"Nazwa wymagania: {node_name}\n"
        )
        if node_description:
            prompt += f"Opis: {node_description}\n"
        prompt += "\nWygeneruj liste dowodow audytowych dla tego wymagania."

        result = await self._call_llm(
            system=SYSTEM_PROMPT_EVIDENCE,
            user_message=prompt,
            action_type="EVIDENCE",
            user_id=user_id,
            max_tokens=2000,
        )
        return result if isinstance(result, dict) else {"evidence_items": []}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 9: Auto-map node to security areas
    # ═══════════════════════════════════════════════════════════════════

    async def suggest_security_areas(
        self,
        user_id: int,
        framework_name: str,
        node_ref_id: str | None,
        node_name: str,
        node_description: str | None,
        available_areas: list[dict],
    ) -> dict:
        """Suggest security areas for a framework node."""
        self._require_ai()

        areas_text = "\n".join(
            f"- ID={a['id']}: {a['name']}" + (f" ({a['description']})" if a.get('description') else "")
            for a in available_areas
        )

        prompt = (
            f"Framework: {framework_name}\n"
            f"Ref ID: {node_ref_id or 'brak'}\n"
            f"Nazwa wymagania: {node_name}\n"
        )
        if node_description:
            prompt += f"Opis: {node_description}\n"
        prompt += f"\nDostepne obszary bezpieczenstwa:\n{areas_text}\n"
        prompt += "\nDo ktorych obszarow pasuje to wymaganie?"

        result = await self._call_llm(
            system=SYSTEM_PROMPT_SECURITY_AREA_MAP,
            user_message=prompt,
            action_type="SECURITY_AREA_MAP",
            user_id=user_id,
            max_tokens=1000,
        )
        return result if isinstance(result, dict) else {"suggested_areas": []}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 10: AI-assisted cross-framework mapping
    # ═══════════════════════════════════════════════════════════════════

    async def suggest_cross_mapping(
        self,
        user_id: int,
        source_framework_name: str,
        source_node_ref_id: str | None,
        source_node_name: str,
        source_node_description: str | None,
        target_framework_name: str,
        target_nodes: list[dict],
    ) -> dict:
        """Suggest mappings from a source node to target framework nodes."""
        self._require_ai()

        target_text = "\n".join(
            f"- {t.get('ref_id', '?')}: {t['name']}"
            + (f" — {t['description'][:100]}" if t.get('description') else "")
            for t in target_nodes[:50]  # limit context
        )

        prompt = (
            f"Framework zrodlowy: {source_framework_name}\n"
            f"Wymaganie zrodlowe:\n"
            f"  Ref ID: {source_node_ref_id or 'brak'}\n"
            f"  Nazwa: {source_node_name}\n"
        )
        if source_node_description:
            prompt += f"  Opis: {source_node_description}\n"
        prompt += (
            f"\nFramework docelowy: {target_framework_name}\n"
            f"Wymagania docelowe:\n{target_text}\n"
            f"\nZaproponuj mapowania z wymagania zrodlowego na wymagania docelowe."
        )

        result = await self._call_llm(
            system=SYSTEM_PROMPT_CROSS_MAPPING,
            user_message=prompt,
            action_type="CROSS_MAPPING",
            user_id=user_id,
            max_tokens=2000,
        )
        return result if isinstance(result, dict) else {"mappings": []}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 11: Coverage report generation
    # ═══════════════════════════════════════════════════════════════════

    async def generate_coverage_report(
        self,
        user_id: int,
        source_framework_name: str,
        target_framework_name: str,
        coverage_data: dict,
    ) -> dict:
        """Generate AI-powered coverage analysis report."""
        self._require_ai()

        prompt = (
            f"Framework zrodlowy: {source_framework_name}\n"
            f"Framework docelowy: {target_framework_name}\n"
            f"Pokrycie: {coverage_data.get('coverage_percent', 0)}%\n"
            f"Wymagania ogolem: {coverage_data.get('total_requirements', 0)}\n"
            f"Pokryte: {coverage_data.get('covered', 0)}\n"
            f"Niepokryte: {coverage_data.get('uncovered', 0)}\n"
            f"Rozkad relacji: {json.dumps(coverage_data.get('by_relationship', {}))}\n"
        )
        uncovered = coverage_data.get("uncovered_requirements", [])
        if uncovered:
            prompt += "Niepokryte wymagania:\n"
            for u in uncovered[:20]:
                prompt += f"- {u.get('ref_id', '?')}: {u.get('name', '?')}\n"

        prompt += "\nWygeneruj raport zarzadczy z rekomendacjami."

        result = await self._call_llm(
            system=SYSTEM_PROMPT_COVERAGE_REPORT,
            user_message=prompt,
            action_type="COVERAGE_REPORT",
            user_id=user_id,
            max_tokens=2000,
        )
        return result if isinstance(result, dict) else {"executive_summary": str(result)}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 12: AI-powered document import
    # ═══════════════════════════════════════════════════════════════════

    async def analyze_document_structure(
        self,
        user_id: int,
        document_text: str,
        filename: str,
    ) -> dict:
        """Analyze first chunk of document to extract framework metadata + nodes."""
        self._require_ai()

        prompt = (
            f"Plik: {filename}\n\n"
            f"Tekst dokumentu:\n{document_text}\n\n"
            f"Przeanalizuj ten dokument i wyodrebnij pelna strukture."
        )

        result = await self._call_llm(
            system=SYSTEM_PROMPT_DOCUMENT_IMPORT,
            user_message=prompt,
            action_type="DOCUMENT_IMPORT",
            user_id=user_id,
            max_tokens=16000,
            timeout=180,
        )
        return result if isinstance(result, dict) else {"framework": {}, "nodes": []}

    async def analyze_document_continuation(
        self,
        user_id: int,
        document_text: str,
        previous_nodes_summary: str,
    ) -> dict:
        """Analyze continuation chunk of document."""
        self._require_ai()

        prompt = (
            f"Dotychczas wyodrebnione wezly (ostatnie):\n{previous_nodes_summary}\n\n"
            f"Kontynuacja tekstu dokumentu:\n{document_text}\n\n"
            f"Kontynuuj wyodrebnianie struktury."
        )

        result = await self._call_llm(
            system=SYSTEM_PROMPT_DOCUMENT_IMPORT_CONTINUATION,
            user_message=prompt,
            action_type="DOCUMENT_IMPORT",
            user_id=user_id,
            max_tokens=16000,
            timeout=180,
        )
        return result if isinstance(result, dict) else {"nodes": []}


async def get_ai_service(session: AsyncSession) -> AIService:
    """Factory: create AIService with current active config."""
    q = select(AIProviderConfig).where(AIProviderConfig.is_active.is_(True)).limit(1)
    config = (await session.execute(q)).scalar_one_or_none()
    return AIService(session, config)
