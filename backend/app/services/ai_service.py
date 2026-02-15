"""
AI Service — central orchestrator for optional AI features.
Returns None / raises AINotConfiguredException when AI is not available.
Works with graceful degradation: if AI API fails, system reverts to rule-based.
"""
import json
import logging
import re
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

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
    SYSTEM_PROMPT_MANAGEMENT_REPORT,
    SYSTEM_PROMPT_SCENARIO_GEN,
    SYSTEM_PROMPT_SEARCH,
    SYSTEM_PROMPT_SECURITY_AREA_MAP,
    SYSTEM_PROMPT_TRANSLATE,
    SYSTEM_PROMPT_DOCUMENT_IMPORT,
    SYSTEM_PROMPT_DOCUMENT_IMPORT_CONTINUATION,
    SYSTEM_PROMPT_AUDIT_PROGRAM_SUGGEST,
    SYSTEM_PROMPT_AUDIT_PROGRAM_REVIEW,
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
        llm_resp = None

        try:
            logger.info(
                "LLM call: action=%s max_tokens=%d timeout=%d input_len=%d",
                action_type, max_tokens, timeout, len(user_message),
            )
            llm_resp = await self.adapter.chat_completion(
                system=system,
                user_message=user_message,
                max_tokens=max_tokens,
                temperature=float(self.config.temperature),
                timeout=timeout,
            )
            logger.info(
                "LLM response: tokens_in=%d tokens_out=%d cost=$%s response_len=%d",
                llm_resp.tokens_input, llm_resp.tokens_output,
                llm_resp.cost_usd, len(llm_resp.text),
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

        except AIParsingError as e:
            # Log cost even when JSON parsing fails — the API call still cost money
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(
                "LLM JSON parse failed for %s (tokens_in=%s, tokens_out=%s, resp_len=%s): %s",
                action_type,
                llm_resp.tokens_input if llm_resp else "?",
                llm_resp.tokens_output if llm_resp else "?",
                len(llm_resp.text) if llm_resp else "?",
                e,
            )
            try:
                await self._log_call(
                    user_id=user_id,
                    action_type=action_type,
                    duration_ms=duration_ms,
                    success=False,
                    error=str(e)[:500],
                    input_summary=user_message[:500],
                    output_summary=llm_resp.text[:500] if llm_resp else None,
                    tokens_input=llm_resp.tokens_input if llm_resp else None,
                    tokens_output=llm_resp.tokens_output if llm_resp else None,
                    cost_usd=llm_resp.cost_usd if llm_resp else None,
                )
            except Exception as log_err:
                logger.error("Failed to log AI call: %s", log_err)
            raise
        except AIRateLimitException:
            raise
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error("LLM call failed for %s: %s", action_type, e)
            try:
                await self._log_call(
                    user_id=user_id,
                    action_type=action_type,
                    duration_ms=duration_ms,
                    success=False,
                    error=str(e)[:500],
                    input_summary=user_message[:500],
                )
            except Exception as log_err:
                logger.error("Failed to log AI call: %s", log_err)
            raise

    def _parse_json(self, text: str) -> dict | list:
        """Parse JSON from LLM response, handling markdown code blocks and truncation."""
        stripped = text.strip()
        text_len = len(stripped)

        logger.info("_parse_json: response length=%d, starts with: %.80s", text_len, stripped[:80])

        # 0. Strip BOM and common prefixes
        if stripped.startswith('\ufeff'):
            stripped = stripped[1:]
        # Some models prefix with "Here is the JSON:" or similar
        for prefix in ["Here is the JSON:", "Here's the JSON:", "JSON:", "json:"]:
            if stripped.lower().startswith(prefix.lower()):
                stripped = stripped[len(prefix):].strip()

        # 1. Direct parse (ideal case — model returned pure JSON)
        try:
            result = json.loads(stripped)
            logger.info("_parse_json: direct parse OK")
            return result
        except json.JSONDecodeError as e:
            logger.debug("_parse_json: direct parse failed: %s", e)

        # 2. Extract from ```json ... ``` block (common model behavior)
        match = re.search(r"```(?:json)?\s*([\[{].*?)\s*```", stripped, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group(1))
                logger.info("_parse_json: extracted from markdown code block OK")
                return result
            except json.JSONDecodeError as e:
                logger.debug("_parse_json: markdown block parse failed: %s", e)

        # Also try non-lazy match for markdown (in case ``` appears at end)
        match = re.search(r"```(?:json)?\s*([\[{].*)\s*```", stripped, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group(1).rstrip().rstrip('`'))
                logger.info("_parse_json: extracted from markdown block (greedy) OK")
                return result
            except json.JSONDecodeError:
                pass

        # 2b. Handle markdown without closing ``` (truncated response with code block)
        match = re.search(r"```(?:json)?\s*([\[{].*)", stripped, re.DOTALL)
        if match:
            block = match.group(1).rstrip().rstrip('`')
            try:
                result = json.loads(block)
                logger.info("_parse_json: extracted from unclosed markdown block OK")
                return result
            except json.JSONDecodeError:
                # Try repair on the markdown block content
                repaired = self._try_repair_json(block)
                if repaired is not None:
                    logger.warning("_parse_json: repaired unclosed markdown block")
                    return repaired

        # 3. Find first { or [ and try to parse from there
        json_start = re.search(r'[\[{]', stripped)
        if not json_start:
            logger.error("_parse_json: NO JSON-like content found in response (len=%d): %.500s", text_len, stripped[:500])
            raise AIParsingError(f"AI nie zwrocilo JSON — odpowiedz nie zawiera {{ ani [. Poczatek: {stripped[:200]}")

        candidate = stripped[json_start.start():]
        logger.debug("_parse_json: found JSON start at position %d, candidate length=%d", json_start.start(), len(candidate))

        # 3a. Direct parse of candidate
        try:
            result = json.loads(candidate)
            logger.info("_parse_json: parsed from offset %d OK", json_start.start())
            return result
        except json.JSONDecodeError:
            pass

        # 3b. Try trimming trailing non-JSON text
        # Find last } or ] and try parsing up to there
        for end_char in ['}', ']']:
            last_pos = candidate.rfind(end_char)
            if last_pos > 0:
                try:
                    result = json.loads(candidate[:last_pos + 1])
                    logger.info("_parse_json: parsed by trimming after last '%s' at position %d", end_char, last_pos)
                    return result
                except json.JSONDecodeError:
                    pass

        # 3c. Try nested brace matching — find matching closing brace for first opening brace
        depth = 0
        in_str = False
        esc = False
        for i, ch in enumerate(candidate):
            if esc:
                esc = False
                continue
            if ch == '\\' and in_str:
                esc = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if ch in '{[':
                depth += 1
            elif ch in '}]':
                depth -= 1
                if depth == 0:
                    try:
                        result = json.loads(candidate[:i + 1])
                        logger.info("_parse_json: parsed by brace matching at position %d", i)
                        return result
                    except json.JSONDecodeError:
                        break

        # 3d. Try to repair truncated JSON (response cut off at max_tokens)
        logger.info("_parse_json: attempting JSON repair on %d chars...", len(candidate))
        repaired = self._try_repair_json(candidate)
        if repaired is not None:
            logger.warning("_parse_json: repaired truncated JSON (%d chars) — some data may be lost", len(candidate))
            return repaired

        # All methods failed
        logger.error(
            "_parse_json: ALL methods failed. Response length=%d, first 1000 chars:\n%s",
            text_len, stripped[:1000],
        )
        raise AIParsingError(
            f"AI zwrocilo nieprawidlowy JSON (dlugosc odpowiedzi: {text_len} znakow). "
            f"Poczatek: {stripped[:300]}"
        )

    @staticmethod
    def _try_repair_json(text: str) -> dict | list | None:
        """Try to repair truncated JSON by closing open brackets/braces.

        Strategy: find the last valid comma-separated element boundary,
        trim everything after it, then close all open brackets.
        """
        # Find positions of all commas outside strings — these are element boundaries
        boundaries = []
        in_string = False
        escape = False
        depth = 0
        for i, ch in enumerate(text):
            if escape:
                escape = False
                continue
            if ch == '\\' and in_string:
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch in '{[':
                depth += 1
            elif ch in '}]':
                depth -= 1
                # After a closing bracket at top level or any level, it's a valid boundary
                boundaries.append(i + 1)
            elif ch == ',':
                boundaries.append(i)

        # Try from the last boundary backwards
        for pos in reversed(boundaries[-500:]):
            candidate = text[:pos].rstrip().rstrip(',')
            # Count open brackets to close them
            opens = []
            in_str = False
            esc = False
            for ch in candidate:
                if esc:
                    esc = False
                    continue
                if ch == '\\' and in_str:
                    esc = True
                    continue
                if ch == '"':
                    in_str = not in_str
                    continue
                if in_str:
                    continue
                if ch in '{[':
                    opens.append(ch)
                elif ch == '}' and opens and opens[-1] == '{':
                    opens.pop()
                elif ch == ']' and opens and opens[-1] == '[':
                    opens.pop()

            closers = ''.join(']' if o == '[' else '}' for o in reversed(opens))
            if in_str:
                candidate += '"'
                # Recount after closing the string
                closers = ''.join(']' if o == '[' else '}' for o in reversed(opens))
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
        """Log AI call to audit table with token usage and cost.

        Uses a separate DB session so the audit log persists even when
        the caller rolls back (e.g. failed AI import).
        """
        from app.database import async_session as _audit_session_factory

        log_kwargs = dict(
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
        try:
            async with _audit_session_factory() as audit_s:
                audit_s.add(AIAuditLog(**log_kwargs))
                await audit_s.commit()
        except Exception as e:
            logger.error("Audit log separate-session commit failed: %s", e)
            # Fallback: add to main session (may be lost on rollback)
            self.session.add(AIAuditLog(**log_kwargs))
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
    # USE CASE 12: AI management report
    # ═══════════════════════════════════════════════════════════════════

    async def generate_management_report(
        self,
        user_id: int,
        data_context: str,
    ) -> dict:
        """Generate comprehensive AI management report based on organization data."""
        self._require_feature("management_report")

        # Use get_prompt with fallback to hardcoded default if session is broken
        try:
            from app.services.ai_prompts import get_prompt
            system_prompt = await get_prompt(self.session, "management_report")
        except Exception:
            system_prompt = SYSTEM_PROMPT_MANAGEMENT_REPORT

        result = await self._call_llm(
            system=system_prompt,
            user_message=data_context,
            action_type="MANAGEMENT_REPORT",
            user_id=user_id,
            max_tokens=8000,
            timeout=180,
        )
        return result if isinstance(result, dict) else {"executive_summary": str(result)}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 13: AI-powered document import
    # ═══════════════════════════════════════════════════════════════════

    async def analyze_document_structure(
        self,
        user_id: int,
        document_text: str,
        filename: str,
    ) -> dict:
        """Analyze first chunk of document to extract framework metadata + nodes."""
        self._require_ai()
        from app.services.ai_prompts import get_prompt
        system_prompt = await get_prompt(self.session, "document_import")

        prompt = (
            f"Plik: {filename}\n\n"
            f"Tekst dokumentu:\n{document_text}\n\n"
            f"Przeanalizuj ten dokument i wyodrebnij pelna strukture. KRYTYCZNE: "
            f"pole 'content' kazdego wezla MUSI zawierac PELNA oryginalna tresc sekcji "
            f"skopiowana slowo w slowo z tekstu powyzej. NIE streszczaj, NIE parafrazuj."
        )

        result = await self._call_llm(
            system=system_prompt,
            user_message=prompt,
            action_type="DOCUMENT_IMPORT",
            user_id=user_id,
            max_tokens=32000,
            timeout=300,
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
        from app.services.ai_prompts import get_prompt
        system_prompt = await get_prompt(self.session, "document_import_continuation")

        prompt = (
            f"Dotychczas wyodrebnione wezly (ostatnie):\n{previous_nodes_summary}\n\n"
            f"Kontynuacja tekstu dokumentu:\n{document_text}\n\n"
            f"WAZNE: Skopiuj PELNA oryginalna tresc kazdej sekcji do pola 'content'. "
            f"NIE streszczaj, NIE parafrazuj — kopiuj slowo w slowo z tekstu powyzej."
        )

        result = await self._call_llm(
            system=system_prompt,
            user_message=prompt,
            action_type="DOCUMENT_IMPORT",
            user_id=user_id,
            max_tokens=32000,
            timeout=300,
        )
        return result if isinstance(result, dict) else {"nodes": []}

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 14: Audit Program — AI Suggest Items
    # ═══════════════════════════════════════════════════════════════════

    async def suggest_audit_program_items(
        self,
        user_id: int,
        context: str,
    ) -> list:
        """Suggest audit program items based on organizational context."""
        self._require_feature("audit_program_suggest")

        try:
            from app.services.ai_prompts import get_prompt
            system_prompt = await get_prompt(self.session, "audit_program_suggest")
        except Exception:
            system_prompt = SYSTEM_PROMPT_AUDIT_PROGRAM_SUGGEST

        result = await self._call_llm(
            system=system_prompt,
            user_message=context,
            action_type="AUDIT_PROGRAM_SUGGEST",
            user_id=user_id,
            max_tokens=6000,
            timeout=120,
        )
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and "suggestions" in result:
            return result["suggestions"]
        return [result] if isinstance(result, dict) else []

    # ═══════════════════════════════════════════════════════════════════
    # USE CASE 15: Audit Program — AI Completeness Review
    # ═══════════════════════════════════════════════════════════════════

    async def review_audit_program_completeness(
        self,
        user_id: int,
        context: str,
    ) -> dict:
        """Review audit program completeness and identify gaps/warnings."""
        self._require_feature("audit_program_review")

        try:
            from app.services.ai_prompts import get_prompt
            system_prompt = await get_prompt(self.session, "audit_program_review")
        except Exception:
            system_prompt = SYSTEM_PROMPT_AUDIT_PROGRAM_REVIEW

        result = await self._call_llm(
            system=system_prompt,
            user_message=context,
            action_type="AUDIT_PROGRAM_REVIEW",
            user_id=user_id,
            max_tokens=6000,
            timeout=120,
        )
        if isinstance(result, dict) and "observations" in result:
            return result
        if isinstance(result, list):
            return {"observations": result}
        return {"observations": []}


async def get_ai_service(session: AsyncSession) -> AIService:
    """Factory: create AIService with current active config."""
    q = select(AIProviderConfig).where(AIProviderConfig.is_active.is_(True)).limit(1)
    config = (await session.execute(q)).scalar_one_or_none()
    return AIService(session, config)
