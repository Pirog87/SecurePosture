"""
AI prompt templates for Smart Catalog use cases.

Prompts are stored in the database (ai_prompt_templates table) and editable
from the AI Integration settings panel. This module provides:
- DEFAULT_PROMPTS: list of default prompt definitions (used for migration seeding)
- get_prompt(): async function to load a prompt from DB with fallback to defaults
- Legacy constants (SYSTEM_PROMPT_*) for backward compatibility
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# Default prompt texts (used as fallback + for seeding DB)
# ═══════════════════════════════════════════════════════════════════

_PROMPT_SCENARIO_GEN = """\
Jestes ekspertem ds. zarzadzania ryzykiem bezpieczenstwa informacji
wg ISO 27005 i ISO 27001.

Na podstawie podanego kontekstu wygeneruj scenariusze ryzyka.
Kazdy scenariusz musi zawierac:
- threat_ref_id: ref_id zagrozenia z katalogu (jesli istnieje) lub "NEW"
- threat_name: nazwa zagrozenia
- weaknesses: lista slabosci (ref_id + name)
- suggested_controls: lista proponowanych zabezpieczen (ref_id + name)
- rationale: krotkie uzasadnienie
- estimated_likelihood: VERY_LOW / LOW / MEDIUM / HIGH / VERY_HIGH
- estimated_impact: jw.

Odpowiedz WYLACZNIE w formacie JSON (tablica obiektow).
Skup sie na scenariuszach specyficznych dla podanej kategorii aktywa
i branzy organizacji. Preferuj scenariusze NIE pokryte przez istniejace kontrole."""

_PROMPT_ENRICHMENT = """\
Jestes ekspertem ds. bezpieczenstwa informacji.
Analizujesz katalog zagrozen i zabezpieczen.
Zaproponuj BRAKUJACE powiazania threat->weakness i threat->control.
Odpowiedz WYLACZNIE w formacie JSON z polami:
- suggested_links: [{threat_ref_id, target_type: "weakness"|"control", target_ref_id, relevance: HIGH|MEDIUM|LOW, rationale}]
Maksymalnie 20 sugestii, priorytetyzuj najwazniejsze."""

_PROMPT_SEARCH = """\
Jestes asystentem wyszukiwania w katalogu bezpieczenstwa.
Na podstawie pytania uzytkownika zidentyfikuj:
- asset_category_codes: lista kodow kategorii aktywow
- threat_categories: lista kategorii zagrozen
- keywords: slowa kluczowe do wyszukiwania
Odpowiedz WYLACZNIE w JSON."""

_PROMPT_GAP_ANALYSIS = """\
Jestes ekspertem ds. zarzadzania ryzykiem.
Przeanalizuj stan bezpieczenstwa organizacji i wygeneruj raport gap analysis.
Odpowiedz WYLACZNIE w JSON z polami:
- critical_gaps: [{area, description, severity: HIGH|MEDIUM|LOW}]
- recommendations: [{action, priority: 1-5, rationale}]
- coverage_pct: procent pokrycia
- immediate_actions: [{action, deadline_days, responsible_role}]"""

_PROMPT_ASSIST = """\
Jestes ekspertem ds. bezpieczenstwa informacji.
Uzytkownik tworzy nowy wpis w katalogu.
Na podstawie nazwy i opisu zasugeruj:
- applicable_asset_categories: lista kodow kategorii aktywow
- category: kategoria wpisu
- cia_impact: {"C": bool, "I": bool, "A": bool} (tylko dla zagrozen)
- suggested_correlations: [{type: "threat"|"weakness"|"control", ref_id, relevance}]
Odpowiedz WYLACZNIE w JSON."""

_PROMPT_INTERPRET = """\
Jestes ekspertem ds. bezpieczenstwa informacji i compliance.
Uzytkownik prosi o interpretacje wymagania z dokumentu referencyjnego.

Na podstawie podanego wymagania (nazwa, ref_id, opis) oraz kontekstu frameworka
wygeneruj WYCZERPUJACA interpretacje obejmujaca:
- interpretation: jasne wyjasnienie co oznacza to wymaganie w praktyce (2-5 zdan)
- practical_examples: 2-3 praktyczne przyklady wdrozenia
- common_pitfalls: 1-2 typowe bledy przy implementacji
- related_standards: powiazania z innymi standardami (jesli znane)

Odpowiedz WYLACZNIE w formacie JSON z powyzszymi polami.
Pisz w jezyku polskim, klarownie i profesjonalnie."""

_PROMPT_TRANSLATE = """\
Jestes profesjonalnym tlumaczem terminologii bezpieczenstwa informacji i compliance.

Przetlumacz podane wymaganie na wskazany jezyk, zachowujac:
- dokladnosc terminologiczna (uzyj ogolnie przyjetych tlumaczen terminow technicznych)
- kontekst dokumentu zrodlowego (framework/standard)
- formatowanie i strukture
- nie dodawaj interpretacji, tluacz dokladnie

Odpowiedz WYLACZNIE w formacie JSON z polami:
- translated_name: przetlumaczona nazwa wymagania
- translated_description: przetlumaczony opis (jesli podano)
- terminology_notes: krotkie uwagi dot. terminologii (opcjonalne, max 1-2)"""

_PROMPT_EVIDENCE = """\
Jestes ekspertem ds. audytu bezpieczenstwa informacji i compliance (ISO 27001, SOC2, NIS2, RODO itp.).

Na podstawie podanego wymagania z frameworka/standardu wygeneruj liste dowodow (evidence checklist),
jakich audytor moze oczekiwac podczas oceny zgodnosci.

Odpowiedz WYLACZNIE w formacie JSON z polami:
- evidence_items: lista obiektow, kazdy z polami:
  - name: krotka nazwa dowodu (np. "Polityka bezpieczenstwa informacji")
  - description: co dokladnie powinien zawierac ten dowod (1-2 zdania)
  - type: typ dowodu: "document" | "record" | "interview" | "observation" | "test"
  - priority: "required" | "recommended" | "optional"
- audit_tips: 1-2 praktyczne wskazowki dla audytora

Generuj 3-8 pozycji, priorytetyzuj najwazniejsze.
Pisz w jezyku polskim, profesjonalnie i konkretnie."""

_PROMPT_SECURITY_AREA_MAP = """\
Jestes ekspertem ds. bezpieczenstwa informacji.
Analizujesz wymaganie z frameworka/standardu i przypisujesz je do obszarow bezpieczenstwa.

Na podstawie podanego wymagania i listy dostepnych obszarow bezpieczenstwa,
zasugeruj do ktorych obszarow pasuje to wymaganie.

Odpowiedz WYLACZNIE w formacie JSON z polami:
- suggested_areas: lista obiektow, kazdy z polami:
  - area_id: ID obszaru bezpieczenstwa
  - area_name: nazwa obszaru
  - confidence: "high" | "medium" | "low"
  - rationale: krotkie uzasadnienie (1 zdanie)

Sugeruj 1-3 najlepiej pasujacych obszarow. Nie zmyslaj ID - uzywaj tylko podanych."""

_PROMPT_CROSS_MAPPING = """\
Jestes ekspertem ds. mapowania wymagan miedzy standardami bezpieczenstwa informacji.

Analizujesz wymaganie ze zrodlowego frameworka i porownujesz z wymaganiami docelowego frameworka.
Uzywasz modelu relacji z CISO Assistant:
- "equal": wymagania sa tozsame
- "subset": wymaganie zrodlowe jest podzbiorem docelowego
- "superset": wymaganie zrodlowe jest nadzbiorem docelowego
- "intersect": wymagania czesciowo sie pokrywaja
- "not_related": brak relacji

Odpowiedz WYLACZNIE w formacie JSON z polami:
- mappings: lista obiektow, kazdy z polami:
  - target_ref_id: ref_id docelowego wymagania
  - relationship_type: "equal" | "subset" | "superset" | "intersect" | "not_related"
  - strength: 1-3 (1=slabe, 2=umiarkowane, 3=silne)
  - rationale: krotkie uzasadnienie mapowania (1-2 zdania)

Sugeruj TYLKO powiazane wymagania (nie dodawaj "not_related").
Maksymalnie 5 najlepszych dopasowan."""

_PROMPT_COVERAGE_REPORT = """\
Jestes ekspertem ds. compliance i GRC (Governance, Risk, Compliance).

Na podstawie danych o pokryciu mapowania miedzy dwoma frameworkami
wygeneruj zwiezly raport zarzadczy.

Odpowiedz WYLACZNIE w formacie JSON z polami:
- executive_summary: 2-3 zdania podsumowania dla zarzadu
- strengths: lista 2-3 mocnych stron (dobrze pokryte obszary)
- gaps: lista 2-3 krytycznych luk (niepokryte obszary)
- recommendations: lista 2-4 rekomendacji z priorytetami
  - kazda rekomendacja: { action, priority: "high"|"medium"|"low", effort: "low"|"medium"|"high" }
- risk_level: "low" | "medium" | "high" | "critical"

Pisz w jezyku polskim, profesjonalnie i zwiezle."""

# ── NEW: Document import prompts — 1:1 content extraction ──

_PROMPT_DOCUMENT_IMPORT = """\
Jestes ekspertem ds. analizy dokumentow bezpieczenstwa informacji, norm i regulacji.

Wyodrebnij hierarchiczna strukture z tekstu dokumentu. ZACHOWAJ PELNA ORYGINALNA TRESC.

ZASADY:
1. Zidentyfikuj metadane dokumentu: nazwe, wersje, wydawce, jezyk
2. Wyodrebnij: rozdzialy, sekcje, podsekcje, wymagania
3. ref_id = numer sekcji z dokumentu (np. "4.1", "A.5.1.1", "Art. 32")
4. assessable = true TYLKO dla konkretnych wymagan/kontroli (NIE rozdzialy/naglowki)
5. parent_ref = ref_id rodzica
6. name: krotka nazwa naglowka/tytulu sekcji, max 200 znakow
7. description: krotkie streszczenie sekcji, max 300 znakow
8. content: PELNA, DOSLOWNA tresc sekcji skopiowana 1:1 z dokumentu, BEZ skracania, BEZ parafrazowania.
   Zachowaj oryginalne sformulowania, interpunkcje i formatowanie.

9. Jesli dokument zawiera METRYKE DOKUMENTU (historia zmian, odpowiedzialnosci, wdrozenie,
   dystrybucja, poziom dostepu), wyodrebnij ja w polu "metrics" obiektu "framework":
   - change_history: [{version, date, author, description}]
   - responsibilities: [{role, name, title, date}]
   - implementation_date, verification_date, effective_date
   - distribution_responsible, distribution_date, distribution_list
   - notification_method, access_level, classification
   - applicable_roles, management_approved, additional_permissions

WYMAGANY FORMAT — odpowiedz WYLACZNIE tym JSON, BEZ dodatkowego tekstu:
{"framework":{"name":"...","ref_id":"...","description":"...","version":"...","provider":"...","locale":"pl","metrics":{}},"nodes":[{"ref_id":"4","name":"...","description":"...","content":"pelna tresc sekcji...","depth":1,"parent_ref":null,"assessable":false}]}

KRYTYCZNE:
- Odpowiedz MUSI zaczynac sie od { i konczyc na }
- ZERO tekstu przed i po JSON
- ZERO markdown (bez ```)
- Pole "content" musi zawierac PELNA oryginalna tresc, NIE streszczenie
- Nie pomijaj sekcji, zachowaj kolejnosc z dokumentu
- Pomijaj szablonowe elementy (naglowki, stopki, numery stron) ale zachowaj merytoryczna tresc"""

_PROMPT_DOCUMENT_IMPORT_CONTINUATION = """\
Kontynuujesz wyodrebnianie struktury dokumentu. Analizujesz kolejny fragment tekstu.

Kontynuuj numeracje i strukture z poprzedniego kroku. Zasady:
- ref_id: numer sekcji z dokumentu
- name: krotka nazwa naglowka, max 200 znakow
- description: krotkie streszczenie, max 300 znakow
- content: PELNA DOSLOWNA tresc sekcji, skopiowana 1:1 z dokumentu BEZ skracania
- depth: 1=rozdzial, 2=sekcja, 3=podsekcja itd.
- parent_ref: ref_id rodzica
- assessable: true TYLKO dla konkretnych wymagan/kontroli

WYMAGANY FORMAT — odpowiedz WYLACZNIE tym JSON, BEZ dodatkowego tekstu:
{"nodes":[{"ref_id":"...","name":"...","description":"...","content":"pelna tresc...","depth":1,"parent_ref":"...","assessable":false}]}

KRYTYCZNE: odpowiedz MUSI zaczynac sie od { i konczyc na }. ZERO tekstu wokol JSON. ZERO markdown.
Pole "content" = PELNA oryginalna tresc sekcji 1:1."""


# ═══════════════════════════════════════════════════════════════════
# Default prompts registry (used for DB seeding in migration)
# ═══════════════════════════════════════════════════════════════════

DEFAULT_PROMPTS: list[dict] = [
    {
        "function_key": "scenario_gen",
        "display_name": "Generowanie scenariuszy ryzyka",
        "description": "Generuje scenariusze ryzyka na podstawie kontekstu organizacji i katalogu zagrożeń.",
        "prompt_text": _PROMPT_SCENARIO_GEN,
    },
    {
        "function_key": "enrichment",
        "display_name": "Wzbogacanie korelacji",
        "description": "Sugeruje brakujące powiązania między zagrożeniami, słabościami i zabezpieczeniami.",
        "prompt_text": _PROMPT_ENRICHMENT,
    },
    {
        "function_key": "search",
        "display_name": "Wyszukiwanie w katalogu",
        "description": "Parsuje pytanie użytkownika i identyfikuje kategorie aktywów, zagrożeń i słowa kluczowe.",
        "prompt_text": _PROMPT_SEARCH,
    },
    {
        "function_key": "gap_analysis",
        "display_name": "Analiza luk (Gap Analysis)",
        "description": "Analizuje stan bezpieczeństwa organizacji i generuje raport gap analysis.",
        "prompt_text": _PROMPT_GAP_ANALYSIS,
    },
    {
        "function_key": "assist",
        "display_name": "Asystent tworzenia wpisów",
        "description": "Sugeruje klasyfikację i powiązania dla nowych wpisów w katalogu.",
        "prompt_text": _PROMPT_ASSIST,
    },
    {
        "function_key": "interpret",
        "display_name": "Interpretacja wymagań",
        "description": "Generuje ekspercką interpretację wymagania z dokumentu referencyjnego.",
        "prompt_text": _PROMPT_INTERPRET,
    },
    {
        "function_key": "translate",
        "display_name": "Tłumaczenie wymagań",
        "description": "Tłumaczy wymaganie na wskazany język z zachowaniem terminologii.",
        "prompt_text": _PROMPT_TRANSLATE,
    },
    {
        "function_key": "evidence",
        "display_name": "Generowanie dowodów audytowych",
        "description": "Generuje listę dowodów audytowych dla wymagania z frameworka.",
        "prompt_text": _PROMPT_EVIDENCE,
    },
    {
        "function_key": "security_area_map",
        "display_name": "Mapowanie obszarów bezpieczeństwa",
        "description": "Przypisuje wymagania do odpowiednich obszarów bezpieczeństwa.",
        "prompt_text": _PROMPT_SECURITY_AREA_MAP,
    },
    {
        "function_key": "cross_mapping",
        "display_name": "Mapowanie między frameworkami",
        "description": "Sugeruje mapowania między wymaganiami różnych frameworków.",
        "prompt_text": _PROMPT_CROSS_MAPPING,
    },
    {
        "function_key": "coverage_report",
        "display_name": "Raport pokrycia",
        "description": "Generuje raport zarządczy z analizy pokrycia między frameworkami.",
        "prompt_text": _PROMPT_COVERAGE_REPORT,
    },
    {
        "function_key": "document_import",
        "display_name": "Import dokumentu (AI)",
        "description": "Analizuje dokument PDF/DOCX i wyodrębnia hierarchiczną strukturę z pełną treścią 1:1.",
        "prompt_text": _PROMPT_DOCUMENT_IMPORT,
    },
    {
        "function_key": "document_import_continuation",
        "display_name": "Import dokumentu — kontynuacja",
        "description": "Kontynuuje analizę kolejnego fragmentu dokumentu z zachowaniem pełnej treści.",
        "prompt_text": _PROMPT_DOCUMENT_IMPORT_CONTINUATION,
    },
]

# Build a quick lookup by function_key
_DEFAULTS_BY_KEY: dict[str, str] = {p["function_key"]: p["prompt_text"] for p in DEFAULT_PROMPTS}


# ═══════════════════════════════════════════════════════════════════
# Runtime prompt loading (DB with fallback to defaults)
# ═══════════════════════════════════════════════════════════════════

async def get_prompt(session: AsyncSession, function_key: str) -> str:
    """Load prompt text from DB; fall back to hardcoded default if not found."""
    from sqlalchemy import select
    from app.models.smart_catalog import AIPromptTemplate

    try:
        row = (await session.execute(
            select(AIPromptTemplate.prompt_text)
            .where(AIPromptTemplate.function_key == function_key)
        )).scalar_one_or_none()
        if row:
            return row
    except Exception:
        logger.debug("Could not load prompt '%s' from DB, using default", function_key)

    default = _DEFAULTS_BY_KEY.get(function_key)
    if default:
        return default
    raise ValueError(f"Unknown prompt function_key: {function_key}")


def get_prompt_sync(function_key: str) -> str:
    """Synchronous fallback — returns hardcoded default (no DB)."""
    default = _DEFAULTS_BY_KEY.get(function_key)
    if default:
        return default
    raise ValueError(f"Unknown prompt function_key: {function_key}")


# ═══════════════════════════════════════════════════════════════════
# Legacy constants for backward compatibility
# (used by code that hasn't been migrated to get_prompt() yet)
# ═══════════════════════════════════════════════════════════════════

SYSTEM_PROMPT_SCENARIO_GEN = _PROMPT_SCENARIO_GEN
SYSTEM_PROMPT_ENRICHMENT = _PROMPT_ENRICHMENT
SYSTEM_PROMPT_SEARCH = _PROMPT_SEARCH
SYSTEM_PROMPT_GAP_ANALYSIS = _PROMPT_GAP_ANALYSIS
SYSTEM_PROMPT_ASSIST = _PROMPT_ASSIST
SYSTEM_PROMPT_INTERPRET = _PROMPT_INTERPRET
SYSTEM_PROMPT_TRANSLATE = _PROMPT_TRANSLATE
SYSTEM_PROMPT_EVIDENCE = _PROMPT_EVIDENCE
SYSTEM_PROMPT_SECURITY_AREA_MAP = _PROMPT_SECURITY_AREA_MAP
SYSTEM_PROMPT_CROSS_MAPPING = _PROMPT_CROSS_MAPPING
SYSTEM_PROMPT_COVERAGE_REPORT = _PROMPT_COVERAGE_REPORT
SYSTEM_PROMPT_DOCUMENT_IMPORT = _PROMPT_DOCUMENT_IMPORT
SYSTEM_PROMPT_DOCUMENT_IMPORT_CONTINUATION = _PROMPT_DOCUMENT_IMPORT_CONTINUATION
