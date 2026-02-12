# SPECYFIKACJA: Smart Catalog + Opcjonalna Inteligencja AI

## SecurePosture — Moduł katalogów zagrożeń, słabości i zabezpieczeń

**Wersja:** 2.0
**Data:** 2026-02-12
**Status:** SPECYFIKACJA DO IMPLEMENTACJI (Claude Code)
**Zmiana vs v1.0:** AI jako opcjonalny plugin, nie zależność. System w pełni funkcjonalny bez AI.

---

## Spis treści

1. Podsumowanie założeń
2. KRYTYCZNE: Instrukcje dla agenta implementującego
3. Model danych — tabele katalogowe
4. Trójstronna korelacja
5. Smart Engine — filtrowanie i sugestie (rule-based)
6. AI jako opcjonalny plugin
7. Integracja z istniejącymi modułami
8. Seed Data
9. API Endpoints
10. Interfejs użytkownika
11. Sekwencja implementacji
12. Migracja bazy danych

---

## 1. Podsumowanie założeń

### 1.1. Problem

Analityk tworzący scenariusz ryzyka musi ręcznie wybierać zagrożenia, podatności i zabezpieczenia z rozległych, płaskich katalogów. Powoduje to:

- Szum informacyjny — zagrożenie "atak brute-force" pojawia się przy kategorii aktywa "Dokumentacja papierowa"
- Brak korelacji — zagrożenia, słabości i zabezpieczenia żyją w osobnych silosach
- Stracona wiedza — wdrożone MFA nie jest automatycznie sugerowane przy zagrożeniu "przejęcie konta"
- Duplikacja pracy — każdy analityk szuka kombinacji od zera

### 1.2. Rozwiązanie

Smart Catalog — trzy katalogi (zagrożeń, słabości, zabezpieczeń) powiązane:

- Tagowaniem po kategorii aktywa — każdy wpis oznaczony, dla jakich typów aktywów jest relevantny
- Trójstronną korelacją — predefiniowane i rozszerzalne powiązania threat↔weakness↔control
- Auto-detekcją — system wykrywa, że organizacja ma już wdrożone zabezpieczenia pasujące do scenariusza
- Opcjonalnie: AI intelligence — jeśli admin skonfiguruje zewnętrzne API LLM, system zyskuje dodatkowe funkcje AI

### 1.3. Kluczowa zasada architektoniczna: AI jako opcjonalny plugin

System MUSI działać w 100% bez jakiejkolwiek konfiguracji AI. Funkcjonalności AI są opcjonalnym rozszerzeniem, które aktywuje się dopiero gdy administrator skonfiguruje połączenie z zewnętrznym API LLM.

Zasady:

1. ZERO ZALEŻNOŚCI OD AI — Smart Engine (rule-based) jest kompletnym produktem sam w sobie
2. ZERO WIDOCZNOŚCI AI BEZ KONFIGURACJI — gdy AI nie jest skonfigurowane, użytkownik nie widzi żadnych elementów UI związanych z AI (przycisków, paneli, ikon, zakładek). Nie ma świadomości, że takie możliwości istnieją.
3. GRACEFUL ACTIVATION — gdy admin skonfiguruje API, funkcje AI pojawiają się w UI automatycznie
4. GRACEFUL DEGRADATION — gdy API przestanie działać lub admin je wyłączy, system wraca do trybu rule-based bez błędów
5. AGNOSTYCZNY PROVIDER — system nie jest przywiązany do konkretnego dostawcy AI. Obsługuje dowolne API kompatybilne z OpenAI lub Anthropic

### 1.4. Czego NIE robimy (świadome ograniczenia)

| Wykluczenie | Uzasadnienie |
|-------------|--------------|
| Integracja ze skanerami CVE (Qualys, Tenable) | Inny scope — my operujemy na ISO 27005 asset-based, nie na podatnościach technicznych |
| Wymuszanie korelacji | Użytkownik ZAWSZE może wybrać dowolny element, sugestie nie blokują |
| Realtime threat feeds | Nie jesteśmy SOC/SIEM — nasze zagrożenia to katalog analityczny |
| Zastępowanie MITRE ATT&CK | Nasz katalog jest wyższy poziom abstrakcji (ryzyko organizacyjne) |
| Autonomiczne decyzje AI | AI sugeruje, człowiek decyduje — AI nigdy nie tworzy scenariusza bez review |
| Hardkodowanie providera AI | Admin podłącza dowolne API — Claude, OpenAI, vLLM, Ollama, cokolwiek |
| Wymuszanie AI | System jest kompletny bez AI. AI to bonus, nie wymóg |

### 1.5. Terminologia

| Termin w SecurePosture | Odpowiednik ISO 27005 | Opis |
|------------------------|----------------------|------|
| Threat (zagrożenie) | Threat | Potencjalna przyczyna niepożądanego incydentu |
| Weakness (słabość) | Vulnerability | Słabość aktywa lub kontroli, którą zagrożenie może wykorzystać. Celowo NIE "vulnerability" — to nie CVE |
| Control (zabezpieczenie referencyjne) | Security measure | Środek redukujący ryzyko — szablon/wzorzec |
| Applied Control (wdrożone zabezpieczenie) | Implemented control | Konkretna implementacja Control w organizacji |
| Asset Category (kategoria aktywa) | Asset type | Typ aktywa: serwer, stacja robocza, dokument itp. |

---

## 2. KRYTYCZNE: Instrukcje dla agenta implementującego

### 2.1. Analiza istniejącego kodu PRZED implementacją

ZANIM zaczniesz implementować cokolwiek z tej specyfikacji, MUSISZ:

1. PRZEANALIZOWAĆ ISTNIEJĄCY KOD — moduły aktywów (assets) i ryzyk (risks) zostały przerobione w międzyczasie. Mogą się różnić od tego, co zakłada ta specyfikacja. Musisz:

   a. Przejrzeć aktualne modele Django/SQLAlchemy w katalogu models/ — w szczególności: Asset, RiskScenario, AppliedControl, OrgUnit, Framework, FrameworkControl i powiązane modele. Sprawdź ich aktualne pola, relacje FK i M2M, metody.

   b. Przejrzeć aktualne migracje — zrozum aktualny schemat bazy danych. Szukaj tabel: assets, risk_scenarios, applied_controls, org_units, frameworks, framework_controls.

   c. Przejrzeć istniejące API endpoints — sprawdź routery/views w katalogach api/ lub views/. Zrozum konwencje nazewnictwa, paginację, serializers, permissions.

   d. Przejrzeć istniejący frontend — sprawdź strukturę komponentów React, sposób zarządzania stanem (Context/Redux/Zustand), routing, konwencje API calls.

2. DOSTOSOWAĆ SPECYFIKACJĘ DO STANU FAKTYCZNEGO — ta specyfikacja zakłada pewną strukturę tabel i relacji. Jeśli rzeczywisty kod jest inny:

   a. Nazwy tabel/pól — dostosuj DDL do istniejących konwencji (np. jeśli używany jest camelCase zamiast snake_case, albo inne prefixy)

   b. Relacje — jeśli Asset nie ma pola asset_category_id ale ma inne podejście do kategoryzacji (np. tags, type field), dostosuj integrację

   c. Risk Scenarios — jeśli model ryzyk wygląda inaczej niż zakładamy (np. inne pola, inna struktura), dostosuj powiązania M2M

   d. Applied Controls — jeśli wdrożone kontrole mają inną strukturę, dostosuj FK reference_control_id

   e. Konwencje API — użyj tych samych konwencji co istniejące endpointy (URL patterns, response format, error handling, pagination)

3. RAPORTUJ ROZBIEŻNOŚCI — jeśli znajdziesz istotne różnice między specyfikacją a kodem, zanim zaczniesz pisać kod:
   - Opisz co znalazłeś
   - Zaproponuj adaptację
   - Zapytaj o potwierdzenie w przypadku istotnych zmian architektonicznych

### 2.2. Kolejność implementacji

Implementuj w następującej kolejności:

1. Analiza istniejącego kodu (sekcja 2.1)
2. Tabele katalogowe + seed data (sekcje 3, 8)
3. Tabele korelacji (sekcja 4)
4. Smart Engine rule-based (sekcja 5)
5. Integracja z istniejącymi modułami (sekcja 7) — ALTER TABLE po analizie
6. API endpoints — katalogi + sugestie (sekcja 9.1, 9.2)
7. Konfiguracja AI + tabela audytu (sekcja 6)
8. AI Service + AI endpoints (sekcja 6, 9.3) — jako osobny moduł
9. Frontend — najpierw bez AI, potem warunkowe komponenty AI (sekcja 10)

### 2.3. Testy

Dla każdego etapu pisz testy:

- Unit tests: modele, serializers, suggestion engine, AI adapter
- Integration tests: API endpoints, seed data loading
- Specyficzne testy AI: mock AI responses, test graceful degradation gdy API niedostępne
- Test feature flag: upewnij się że ai_enabled=false ukrywa WSZYSTKO związane z AI

---

## 3. Model danych — tabele katalogowe

### 3.1. asset_categories — Kategorie aktywów

```sql
CREATE TABLE asset_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_id          VARCHAR(10) NOT NULL UNIQUE,  -- AC-01, AC-02...
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    icon            VARCHAR(50),                   -- ikona w UI (opcjonalnie)
    parent_id       UUID REFERENCES asset_categories(id),
    display_order   INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    org_unit_id     UUID REFERENCES org_units(id), -- NULL = globalny
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

UWAGA: Sprawdź czy assets mają już pole kategoryzacji. Jeśli tak — rozważ czy asset_categories to dodatkowa tabela czy zastępuje istniejące rozwiązanie.

### 3.2. threat_catalog — Katalog zagrożeń

```sql
CREATE TABLE threat_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_id          VARCHAR(20) NOT NULL,           -- T-001, T-002...
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    category        VARCHAR(30) NOT NULL,            -- NATURAL, ENVIRONMENTAL, HUMAN_INTENTIONAL, HUMAN_ACCIDENTAL, TECHNICAL, ORGANIZATIONAL
    source          VARCHAR(15) DEFAULT 'BOTH',      -- INTERNAL, EXTERNAL, BOTH
    cia_impact      JSONB DEFAULT '{}',              -- {"C": true, "I": false, "A": true}
    is_system       BOOLEAN DEFAULT FALSE,           -- seed data (niemodyfikowalny)
    is_active       BOOLEAN DEFAULT TRUE,
    org_unit_id     UUID REFERENCES org_units(id),   -- NULL = globalny
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ref_id, org_unit_id)
);
```

### 3.3. weakness_catalog — Katalog słabości

```sql
CREATE TABLE weakness_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_id          VARCHAR(20) NOT NULL,           -- W-001, W-002...
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    category        VARCHAR(20) NOT NULL,            -- HARDWARE, SOFTWARE, NETWORK, PERSONNEL, SITE, ORGANIZATION, PROCESS
    is_system       BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    org_unit_id     UUID REFERENCES org_units(id),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ref_id, org_unit_id)
);
```

### 3.4. control_catalog — Katalog zabezpieczeń referencyjnych

```sql
CREATE TABLE control_catalog (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_id              VARCHAR(20) NOT NULL,       -- C-001, C-002...
    name                VARCHAR(300) NOT NULL,
    description         TEXT,
    category            VARCHAR(20) NOT NULL,        -- TECHNICAL, ORGANIZATIONAL, PHYSICAL, LEGAL
    implementation_type VARCHAR(20) NOT NULL,         -- PREVENTIVE, DETECTIVE, CORRECTIVE, DETERRENT, COMPENSATING
    is_system           BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    org_unit_id         UUID REFERENCES org_units(id),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ref_id, org_unit_id)
);
```

### 3.5. Tabele relacji M2M — przypisanie do kategorii aktywów

```sql
CREATE TABLE threat_asset_category (
    threat_id           UUID REFERENCES threat_catalog(id) ON DELETE CASCADE,
    asset_category_id   UUID REFERENCES asset_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (threat_id, asset_category_id)
);

CREATE TABLE weakness_asset_category (
    weakness_id         UUID REFERENCES weakness_catalog(id) ON DELETE CASCADE,
    asset_category_id   UUID REFERENCES asset_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (weakness_id, asset_category_id)
);

CREATE TABLE control_asset_category (
    control_id          UUID REFERENCES control_catalog(id) ON DELETE CASCADE,
    asset_category_id   UUID REFERENCES asset_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (control_id, asset_category_id)
);
```

---

## 4. Trójstronna korelacja

### 4.1. Koncepcja

Trzy katalogi łączy sieć predefiniowanych (seed) i użytkownikowskich (custom) powiązań:

```
        THREAT ←────── threat_weakness_link ──────→ WEAKNESS
          │                                            │
          │                                            │
   threat_control_link                        weakness_control_link
          │                                            │
          ▼                                            ▼
                          CONTROL
```

Każde powiązanie ma:
- relevance/effectiveness — siła korelacji (HIGH, MEDIUM, LOW)
- is_system — czy pochodzi z seed data
- description — opcjonalny opis kontekstu korelacji

### 4.2. Tabele korelacji

```sql
-- Zagrożenie eksploatuje słabość
CREATE TABLE threat_weakness_link (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_id       UUID NOT NULL REFERENCES threat_catalog(id) ON DELETE CASCADE,
    weakness_id     UUID NOT NULL REFERENCES weakness_catalog(id) ON DELETE CASCADE,
    relevance       VARCHAR(10) NOT NULL DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    description     TEXT,
    is_system       BOOLEAN DEFAULT FALSE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(threat_id, weakness_id)
);

-- Zabezpieczenie mityguje zagrożenie
CREATE TABLE threat_control_link (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_id       UUID NOT NULL REFERENCES threat_catalog(id) ON DELETE CASCADE,
    control_id      UUID NOT NULL REFERENCES control_catalog(id) ON DELETE CASCADE,
    effectiveness   VARCHAR(10) NOT NULL DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    description     TEXT,
    is_system       BOOLEAN DEFAULT FALSE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(threat_id, control_id)
);

-- Zabezpieczenie adresuje słabość
CREATE TABLE weakness_control_link (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    weakness_id     UUID NOT NULL REFERENCES weakness_catalog(id) ON DELETE CASCADE,
    control_id      UUID NOT NULL REFERENCES control_catalog(id) ON DELETE CASCADE,
    effectiveness   VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    description     TEXT,
    is_system       BOOLEAN DEFAULT FALSE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(weakness_id, control_id)
);
```

### 4.3. Jak to działa — przepływ korelacji

Scenariusz: Użytkownik tworzy scenariusz ryzyka dla serwera

```
1. Wybiera aktywo typu "Serwer produkcyjny" (kategoria: AC-01 Serwery)
   → System filtruje:
     threat_catalog JOIN threat_asset_category WHERE asset_category = AC-01
   → Widzi: "Atak brute-force", "Ransomware", "Awaria sprzętowa"
   → NIE widzi: "Kradzież dokumentów papierowych", "Powódź w archiwum"

2. Wybiera zagrożenie "T-015 Atak brute-force"
   → System odpytuje threat_weakness_link WHERE threat_id = T-015
   → Panel SUGESTIE SŁABOŚCI:
     ✦ W-031 Brak polityki złożoności haseł [HIGH]
     ✦ W-032 Brak blokady konta po N próbach [HIGH]
     ○ W-033 Brak monitoringu prób logowania [MEDIUM]

3. System odpytuje threat_control_link WHERE threat_id = T-015
   → Panel SUGEROWANE ZABEZPIECZENIA:
     ✦ C-041 MFA [HIGH]
     ✦ C-043 Automatyczna blokada konta [HIGH]
     ○ C-042 Polityka haseł [MEDIUM]

4. System sprawdza applied_controls (wdrożone w organizacji)
   → Znajduje: "MFA — wdrożone, status=IMPLEMENTED"
   → Panel ⚡ MASZ JUŻ WDROŻONE:
     ✅ MFA (wdrożone 2025-03-15, odpowiedzialny: Jan Kowalski)
        Effectiveness vs brute-force: HIGH
        → Uwzględnij w ocenie ryzyka rezydualnego

5. Użytkownik zatwierdza scenariusz → kalkulacja ryzyka
```

---

## 5. Smart Engine — filtrowanie i sugestie (rule-based)

To jest RDZEŃ systemu. Działa ZAWSZE, niezależnie od AI.

### 5.1. Silnik filtrowania

```
REQUEST                    FILTERS                         RESULT
────────────────────────────────────────────────────────────────────
GET /threats    →  [asset_category_filter]  →  [is_active]  →  threats[]
                   [category_filter]           [org_unit_scope]
                   [cia_filter]                [search_text]
```

Reguły scope:
- Wpisy is_system=TRUE + org_unit_id=NULL → widoczne dla wszystkich (seed data)
- Wpisy org_unit_id=X → widoczne tylko dla użytkowników w org_unit X i wyżej
- Wpisy is_active=FALSE → ukryte, ale nie usunięte (soft delete)

### 5.2. Silnik sugestii (rule-based)

```python
class SuggestionEngine:

    def suggest_weaknesses(self, threat_id: UUID) -> list[WeaknessSuggestion]:
        """Dla wybranego zagrożenia, zwróć posortowane słabości."""
        links = ThreatWeaknessLink.objects.filter(threat_id=threat_id)
        return sorted(links, key=lambda l: RELEVANCE_ORDER[l.relevance])

    def suggest_controls(self, threat_id: UUID) -> list[ControlSuggestion]:
        """Dla wybranego zagrożenia, zwróć sugerowane zabezpieczenia
        z informacją, które są już wdrożone."""
        catalog_controls = ThreatControlLink.objects.filter(threat_id=threat_id)
        applied = AppliedControl.objects.filter(
            reference_control__in=[c.control_id for c in catalog_controls],
            status='IMPLEMENTED'
        )
        return merge_with_applied_status(catalog_controls, applied)

    def detect_existing_controls(self, threat_id: UUID, org_unit_id: UUID):
        """Wyszukaj wdrożone zabezpieczenia, które mitygują dane zagrożenie."""
        relevant_controls = ThreatControlLink.objects.filter(threat_id=threat_id)
        return AppliedControl.objects.filter(
            reference_control__in=[c.control_id for c in relevant_controls],
            org_unit_id=org_unit_id,
            status__in=['IMPLEMENTED', 'PARTIALLY_IMPLEMENTED']
        )

    def reverse_lookup(self, control_id: UUID) -> list[ThreatInfo]:
        """Jakie zagrożenia mityguje to zabezpieczenie?"""
        return ThreatControlLink.objects.filter(control_id=control_id)

    def coverage_analysis(self, asset_category_id: UUID, org_unit_id: UUID):
        """Analiza pokrycia: ile zagrożeń ma kontrole, ile jest gaps."""
        threats = ThreatCatalog.objects.filter(
            asset_categories=asset_category_id
        )
        covered = threats.filter(
            threat_control_links__control__applied_controls__status='IMPLEMENTED'
        ).distinct()
        return {
            'total_threats': threats.count(),
            'covered': covered.count(),
            'gaps': threats.exclude(id__in=covered).values_list('name', flat=True),
            'coverage_pct': (covered.count() / threats.count()) * 100
        }
```

### 5.3. Quick Risk — auto-generacja scenariuszy (rule-based)

Dla danego aktywa system generuje draft scenariuszy na bazie seed data:

```python
def generate_quick_risks(asset_id: UUID) -> list[RiskScenarioDraft]:
    asset = Asset.objects.get(id=asset_id)
    category = asset.asset_category

    threats = ThreatCatalog.objects.filter(
        asset_categories=category, is_active=True
    )

    drafts = []
    for threat in threats:
        weaknesses = ThreatWeaknessLink.objects.filter(
            threat=threat, relevance='HIGH'
        )
        controls_suggested = ThreatControlLink.objects.filter(threat=threat)
        controls_existing = detect_existing_controls(threat.id, asset.org_unit_id)

        drafts.append(RiskScenarioDraft(
            asset=asset,
            threat=threat,
            weaknesses=[w.weakness for w in weaknesses],
            suggested_controls=[c.control for c in controls_suggested],
            existing_controls=controls_existing,
            auto_generated=True,
            status='DRAFT'
        ))

    return drafts
```

---

## 6. AI jako opcjonalny plugin

### 6.1. Mechanizm konfiguracji

#### 6.1.1. Tabela konfiguracji AI

```sql
CREATE TABLE ai_provider_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id     UUID REFERENCES org_units(id),    -- NULL = global
    provider_type   VARCHAR(20) NOT NULL DEFAULT 'none',
                    -- 'none' | 'anthropic' | 'openai_compatible'
    api_endpoint    VARCHAR(500),
                    -- Anthropic: https://api.anthropic.com
                    -- OpenAI: https://api.openai.com
                    -- vLLM/Ollama: http://localhost:8000
    api_key_encrypted BYTEA,                -- szyfrowany klucz API (AES-256)
    model_name      VARCHAR(100),           -- np. "claude-sonnet-4-20250514", "gpt-4o", "llama-3.3-70b"
    is_active       BOOLEAN DEFAULT FALSE,  -- TRUE tylko gdy test połączenia OK
    max_tokens      INTEGER DEFAULT 4000,
    temperature     DECIMAL(3,2) DEFAULT 0.3,

    -- Rate limiting
    max_requests_per_user_per_hour  INTEGER DEFAULT 20,
    max_requests_per_user_per_day   INTEGER DEFAULT 100,
    max_requests_per_org_per_day    INTEGER DEFAULT 500,

    -- Feature toggles — które use case'y są aktywne
    feature_scenario_generation     BOOLEAN DEFAULT TRUE,
    feature_correlation_enrichment  BOOLEAN DEFAULT TRUE,
    feature_natural_language_search BOOLEAN DEFAULT TRUE,
    feature_gap_analysis            BOOLEAN DEFAULT TRUE,
    feature_entry_assist            BOOLEAN DEFAULT TRUE,

    -- Metadata
    last_test_at    TIMESTAMPTZ,
    last_test_ok    BOOLEAN,
    last_test_error TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      UUID REFERENCES users(id)
);
```

UWAGA: provider_type='none' lub brak rekordu = AI wyłączone. To jest stan domyślny.

#### 6.1.2. Feature flag endpoint

```
GET /api/v1/config/features
```

Response (AI wyłączone — stan domyślny):
```json
{
  "ai_enabled": false,
  "ai_features": {}
}
```

Response (AI włączone — po konfiguracji):
```json
{
  "ai_enabled": true,
  "ai_features": {
    "scenario_generation": true,
    "correlation_enrichment": true,
    "natural_language_search": true,
    "gap_analysis": true,
    "entry_assist": true
  }
}
```

Ten endpoint jest wywoływany przez frontend przy inicjalizacji aplikacji i cache'owany w kontekście sesji. Nie wymaga osobnego call per-page.

#### 6.1.3. Panel administracyjny — konfiguracja AI

Dostępny TYLKO dla administratorów w: Ustawienia → Integracja AI

```
┌─────────────────────────────────────────────────────────────┐
│  USTAWIENIA > Integracja AI                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: ● Nieaktywne                                       │
│                                                             │
│  Typ providera:    [▼ Wybierz...]                           │
│                     • Anthropic (Claude)                     │
│                     • OpenAI-compatible (OpenAI/vLLM/Ollama) │
│                                                             │
│  Endpoint API:     [https://api.anthropic.com              ]│
│  Klucz API:        [sk-ant-...                             ]│
│  Model:            [claude-sonnet-4-20250514                ]│
│                                                             │
│  [🔍 Test połączenia]                                       │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Gdy test OK, pojawia się:                                  │
│                                                             │
│  ✅ Połączenie OK (test: 2026-02-12 14:30, 1.2s)           │
│  Model odpowiedział poprawnie.                              │
│                                                             │
│  Aktywne funkcje AI:                                        │
│  ☑ Generacja scenariuszy ryzyka                             │
│  ☑ Wzbogacanie korelacji                                    │
│  ☑ Wyszukiwanie w języku naturalnym                         │
│  ☑ Analiza luk (gap analysis)                               │
│  ☑ Asystent tworzenia wpisów                                │
│                                                             │
│  Limity:                                                    │
│  Zapytań/użytkownik/godzinę: [20]                           │
│  Zapytań/użytkownik/dzień:   [100]                          │
│  Zapytań/organizacja/dzień:  [500]                          │
│                                                             │
│  [Aktywuj AI]  [Anuluj]                                     │
└─────────────────────────────────────────────────────────────┘
```

Przycisk "Test połączenia" wysyła prosty request do API:
- Anthropic: POST /v1/messages z treścią "Respond with exactly: OK"
- OpenAI-compatible: POST /v1/chat/completions z treścią "Respond with exactly: OK"

Jeśli test przechodzi → is_active = TRUE → ai_enabled = TRUE w feature flags.

#### 6.1.4. Przycisk "Aktywuj AI" / "Dezaktywuj AI"

- Aktywuj: ustawia is_active=TRUE, frontend przy kolejnym renderze widzi ai_enabled=true
- Dezaktywuj: ustawia is_active=FALSE, provider_type pozostaje (łatwa reaktywacja)
- Dezaktywacja NIE kasuje klucza API — admin może łatwo przywrócić

### 6.2. Adapter AI — agnostyczny provider

```python
# backend/ai/adapters.py

from abc import ABC, abstractmethod

class AIAdapter(ABC):
    """Bazowy adapter dla dowolnego providera AI."""

    @abstractmethod
    def chat_completion(self, system: str, user_message: str,
                        max_tokens: int, temperature: float) -> str:
        """Wyślij zapytanie i zwróć tekst odpowiedzi."""
        pass

    @abstractmethod
    def test_connection(self) -> tuple[bool, str]:
        """Test połączenia. Zwraca (success, message)."""
        pass


class AnthropicAdapter(AIAdapter):
    """Adapter dla Anthropic Claude API (/v1/messages)."""

    def __init__(self, endpoint: str, api_key: str, model: str):
        self.endpoint = endpoint.rstrip('/')
        self.api_key = api_key
        self.model = model

    def chat_completion(self, system, user_message, max_tokens, temperature):
        response = requests.post(
            f"{self.endpoint}/v1/messages",
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "system": system,
                "messages": [{"role": "user", "content": user_message}]
            }
        )
        response.raise_for_status()
        data = response.json()
        return data["content"][0]["text"]

    def test_connection(self):
        try:
            result = self.chat_completion(
                system="Respond with exactly: OK",
                user_message="Test",
                max_tokens=10,
                temperature=0
            )
            return ("OK" in result, f"Model responded: {result[:50]}")
        except Exception as e:
            return (False, str(e))


class OpenAICompatibleAdapter(AIAdapter):
    """Adapter dla OpenAI-compatible API (OpenAI, vLLM, Ollama, LocalAI)."""

    def __init__(self, endpoint: str, api_key: str, model: str):
        self.endpoint = endpoint.rstrip('/')
        self.api_key = api_key
        self.model = model

    def chat_completion(self, system, user_message, max_tokens, temperature):
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        response = requests.post(
            f"{self.endpoint}/v1/chat/completions",
            headers=headers,
            json={
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_message}
                ]
            }
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    def test_connection(self):
        try:
            result = self.chat_completion(
                system="Respond with exactly: OK",
                user_message="Test",
                max_tokens=10,
                temperature=0
            )
            return ("OK" in result, f"Model responded: {result[:50]}")
        except Exception as e:
            return (False, str(e))


def get_ai_adapter(config: AIProviderConfig) -> AIAdapter | None:
    """Factory: zwraca adapter na podstawie konfiguracji.
    Zwraca None jeśli AI nie jest skonfigurowane."""

    if not config or config.provider_type == 'none' or not config.is_active:
        return None

    api_key = decrypt_api_key(config.api_key_encrypted)

    if config.provider_type == 'anthropic':
        return AnthropicAdapter(config.api_endpoint, api_key, config.model_name)
    elif config.provider_type == 'openai_compatible':
        return OpenAICompatibleAdapter(config.api_endpoint, api_key, config.model_name)
    else:
        return None
```

### 6.3. AI Service — z graceful degradation

```python
# backend/ai/service.py

class AIService:
    """Centralna usługa AI. Zwraca None/rzuca wyjątek gdy AI niedostępne."""

    def __init__(self, org_unit_id: UUID = None):
        config = AIProviderConfig.objects.filter(
            org_unit_id=org_unit_id, is_active=True
        ).first() or AIProviderConfig.objects.filter(
            org_unit_id=None, is_active=True
        ).first()

        self.adapter = get_ai_adapter(config)
        self.config = config

    @property
    def is_available(self) -> bool:
        """Czy AI jest dostępne i skonfigurowane?"""
        return self.adapter is not None

    def _require_ai(self):
        """Rzuć wyjątek jeśli AI nie jest skonfigurowane."""
        if not self.is_available:
            raise AINotConfiguredException(
                "AI nie jest skonfigurowane. "
                "Administrator może aktywować AI w Ustawienia > Integracja AI."
            )

    def _require_feature(self, feature_name: str):
        """Rzuć wyjątek jeśli konkretna funkcja AI jest wyłączona."""
        self._require_ai()
        if not getattr(self.config, f'feature_{feature_name}', False):
            raise AIFeatureDisabledException(
                f"Funkcja AI '{feature_name}' jest wyłączona."
            )

    def _call_llm(self, system: str, user_message: str,
                  max_tokens: int = None) -> dict:
        """Wywołanie LLM z parsowaniem JSON i logowaniem."""
        self._require_ai()

        max_tokens = max_tokens or self.config.max_tokens
        start_time = time.time()

        try:
            text = self.adapter.chat_completion(
                system=system,
                user_message=user_message,
                max_tokens=max_tokens,
                temperature=float(self.config.temperature)
            )

            # Parsowanie JSON
            try:
                result = json.loads(text)
            except json.JSONDecodeError:
                match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
                if match:
                    result = json.loads(match.group(1))
                else:
                    raise AIParsingError(f"AI zwróciło nieprawidłowy JSON")

            # Log success
            self._log_call(
                action_type=self._current_action,
                duration_ms=int((time.time() - start_time) * 1000),
                success=True
            )
            return result

        except Exception as e:
            self._log_call(
                action_type=self._current_action,
                duration_ms=int((time.time() - start_time) * 1000),
                success=False,
                error=str(e)
            )
            raise

    # === USE CASE 1: AI-assisted scenario generation ===

    def generate_scenarios(self, asset, org_context) -> list:
        """Generuj scenariusze ryzyka AI. Wymaga feature_scenario_generation."""
        self._require_feature('scenario_generation')
        self._current_action = 'SCENARIO_GEN'

        context = self._build_scenario_context(asset, org_context)
        prompt = self._format_scenario_prompt(context)

        result = self._call_llm(
            system=SYSTEM_PROMPT_SCENARIO_GEN,
            user_message=prompt,
            max_tokens=4000
        )
        return self._map_scenarios_to_catalog(result)

    # === USE CASE 2: AI-powered correlation enrichment ===

    def enrich_correlations(self, scope='all') -> list:
        """Wzbogać korelacje AI. Wymaga feature_correlation_enrichment."""
        self._require_feature('correlation_enrichment')
        self._current_action = 'ENRICHMENT'
        # ... implementacja analogiczna do v1.0

    # === USE CASE 3: Natural language search ===

    def search_catalog(self, query: str, org_unit_id: UUID) -> dict:
        """Wyszukiwanie NL. Wymaga feature_natural_language_search."""
        self._require_feature('natural_language_search')
        self._current_action = 'SEARCH'
        # ... implementacja analogiczna do v1.0

    # === USE CASE 4: AI gap analysis ===

    def gap_analysis(self, org_unit_id: UUID) -> dict:
        """Analiza luk AI. Wymaga feature_gap_analysis."""
        self._require_feature('gap_analysis')
        self._current_action = 'GAP_ANALYSIS'
        # ... implementacja analogiczna do v1.0

    # === USE CASE 5: AI-assisted entry creation ===

    def assist_entry(self, entry_type: str, name: str, description: str) -> dict:
        """Asystent AI. Wymaga feature_entry_assist."""
        self._require_feature('entry_assist')
        self._current_action = 'ASSIST'
        # ... implementacja analogiczna do v1.0
```

### 6.4. Tabela audytu AI

```sql
CREATE TABLE ai_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    org_unit_id     UUID REFERENCES org_units(id),
    action_type     VARCHAR(30) NOT NULL,  -- SCENARIO_GEN, ENRICHMENT, SEARCH, GAP_ANALYSIS, ASSIST, TEST_CONNECTION
    provider_type   VARCHAR(20) NOT NULL,  -- anthropic, openai_compatible
    model_used      VARCHAR(100) NOT NULL,
    input_summary   TEXT,
    output_summary  TEXT,
    tokens_input    INTEGER,
    tokens_output   INTEGER,
    cost_usd        DECIMAL(10,6),
    accepted        BOOLEAN,               -- NULL = pending, TRUE = accepted, FALSE = rejected
    duration_ms     INTEGER,
    success         BOOLEAN DEFAULT TRUE,
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_audit_user ON ai_audit_log(user_id, created_at);
CREATE INDEX idx_ai_audit_org ON ai_audit_log(org_unit_id, created_at);
```

### 6.5. System prompt templates

```python
# backend/ai/prompts.py

SYSTEM_PROMPT_SCENARIO_GEN = """
Jesteś ekspertem ds. zarządzania ryzykiem bezpieczeństwa informacji
wg ISO 27005 i ISO 27001.

Na podstawie podanego kontekstu wygeneruj scenariusze ryzyka.
Każdy scenariusz musi zawierać:
- threat: zagrożenie (z ref_id jeśli istnieje w katalogu, lub "NEW")
- weaknesses: lista słabości które zagrożenie eksploatuje
- suggested_controls: lista proponowanych zabezpieczeń
- rationale: krótkie uzasadnienie
- estimated_likelihood: VERY_LOW / LOW / MEDIUM / HIGH / VERY_HIGH
- estimated_impact: jw.

Odpowiedz WYŁĄCZNIE w formacie JSON.
Skup się na scenariuszach specyficznych dla podanej kategorii aktywa
i branży organizacji. Preferuj scenariusze NIE pokryte przez istniejące kontrole.
"""

SYSTEM_PROMPT_ENRICHMENT = """
Jesteś ekspertem ds. bezpieczeństwa informacji.
Analizujesz katalog zagrożeń i zabezpieczeń.
Zaproponuj BRAKUJĄCE powiązania threat→control.
Odpowiedz WYŁĄCZNIE w formacie JSON.
Maksymalnie 20 sugestii, priorytetyzuj najważniejsze.
"""

SYSTEM_PROMPT_SEARCH = """
Jesteś asystentem wyszukiwania w katalogu bezpieczeństwa.
Na podstawie pytania użytkownika zidentyfikuj:
asset_categories, threat_categories, keywords.
Odpowiedz WYŁĄCZNIE w JSON.
"""

SYSTEM_PROMPT_GAP_ANALYSIS = """
Jesteś ekspertem ds. zarządzania ryzykiem.
Przeanalizuj stan bezpieczeństwa organizacji i wygeneruj raport gap analysis.
Odpowiedz WYŁĄCZNIE w JSON z polami:
critical_gaps[], recommendations[], coverage_pct, immediate_actions[].
"""

SYSTEM_PROMPT_ASSIST = """
Jesteś ekspertem ds. bezpieczeństwa informacji.
Użytkownik tworzy nowy wpis w katalogu.
Na podstawie nazwy i opisu zasugeruj:
applicable_asset_categories, category, cia_impact (dla zagrożeń),
suggested_correlations z istniejącymi wpisami.
Odpowiedz WYŁĄCZNIE w JSON.
"""
```

### 6.6. Bezpieczeństwo AI

| Wymóg | Implementacja |
|-------|---------------|
| Dane wrażliwe nie idą do AI | Context builder sanityzuje nazwy własne, dane osobowe — zamienia na placeholdery przed wysłaniem |
| AI nie podejmuje decyzji | Każdy output AI ma status DRAFT/PENDING, wymaga human review |
| Audit trail | Każde wywołanie logowane w ai_audit_log z pełnym kontekstem |
| Kill-switch | Admin dezaktywuje jednym klikiem w panelu konfiguracji |
| Rate limiting | Per-user i per-org limity konfigurowane przez admina |
| Szyfrowanie klucza API | AES-256 encryption at rest, klucz nigdy nie jest eksponowany w API response |
| Fallback | Gdy API niedostępne → AINotConfiguredException → frontend ukrywa elementy AI |
| Brak vendor lock-in | Adapter pattern — zmiana providera = zmiana konfiguracji, nie kodu |

---

## 7. Integracja z istniejącymi modułami

### 7.1. Mapa integracji

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SecurePosture — mapa modułów                   │
│                                                                     │
│  NOWE (Smart Catalog)                   ISTNIEJĄCE                  │
│  ─────────────────────                  ──────────                  │
│  asset_categories ──────────────────→ assets.asset_category_id      │
│                                                                     │
│  threat_catalog ────────────────────→ risk_scenarios.threats (M2M)  │
│                                                                     │
│  weakness_catalog ──────────────────→ risk_scenarios.weaknesses(M2M)│
│                                                                     │
│  control_catalog ───────────────────→ applied_controls              │
│    (referencyjne)                       .reference_control_id       │
│                                                                     │
│  threat_control_link ───────────────→ "⚡ Masz już wdrożone!"       │
│    (korelacja threat↔control)           auto-match z applied_controls│
│                                                                     │
│  control_catalog ───────────────────→ framework_controls            │
│    .mapped_frameworks (M2M)             .control_catalog_id          │
│                                                                     │
│  OPCJONALNE (AI plugin):                                            │
│  ai_provider_config ────────────────→ admin panel (Ustawienia)      │
│  ai_audit_log ──────────────────────→ audit/reporting               │
│  ai_service ────────────────────────→ org_context (branża, scope)   │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2. Zmiany w istniejących tabelach

KRYTYCZNE: Poniższe ALTER TABLE to propozycja. Agent implementujący MUSI sprawdzić aktualne schematy i dostosować.

```sql
-- assets: dodanie FK do asset_categories
-- SPRAWDŹ: czy assets już ma pole kategoryzacji (type, category, tags?)
ALTER TABLE assets ADD COLUMN asset_category_id UUID REFERENCES asset_categories(id);

-- risk_scenarios: dodanie M2M do nowych katalogów
-- SPRAWDŹ: czy risk_scenarios ma już pola threat/vulnerability
CREATE TABLE risk_scenario_threats (
    risk_scenario_id UUID REFERENCES risk_scenarios(id) ON DELETE CASCADE,
    threat_id        UUID REFERENCES threat_catalog(id) ON DELETE CASCADE,
    PRIMARY KEY (risk_scenario_id, threat_id)
);

CREATE TABLE risk_scenario_weaknesses (
    risk_scenario_id UUID REFERENCES risk_scenarios(id) ON DELETE CASCADE,
    weakness_id      UUID REFERENCES weakness_catalog(id) ON DELETE CASCADE,
    PRIMARY KEY (risk_scenario_id, weakness_id)
);

-- applied_controls: dodanie FK do control_catalog
-- SPRAWDŹ: czy applied_controls ma już reference do kontroli
ALTER TABLE applied_controls
ADD COLUMN reference_control_id UUID REFERENCES control_catalog(id);

-- control_catalog → framework mapowanie (opcjonalne, P4)
CREATE TABLE control_framework_mapping (
    control_id           UUID REFERENCES control_catalog(id) ON DELETE CASCADE,
    framework_control_id UUID REFERENCES framework_controls(id) ON DELETE CASCADE,
    PRIMARY KEY (control_id, framework_control_id)
);
```

---

## 8. Seed Data

### 8.1. Asset Categories (12 kategorii)

| ref_id | Nazwa | Przykłady |
|--------|-------|-----------|
| AC-01 | Serwery i infrastruktura | Serwery fizyczne, wirtualne, hypervisory |
| AC-02 | Stacje robocze i urządzenia końcowe | PC, laptopy, tablety, telefony |
| AC-03 | Urządzenia sieciowe | Routery, switche, firewalle, access pointy |
| AC-04 | Aplikacje i systemy | Oprogramowanie biznesowe, webowe, mobilne |
| AC-05 | Bazy danych | Systemy bazodanowe, hurtownie danych |
| AC-06 | Usługi chmurowe | IaaS, PaaS, SaaS |
| AC-07 | Dane i informacje | Dane osobowe, tajemnice przedsiębiorstwa |
| AC-08 | Dokumentacja papierowa | Umowy, akta, dokumentacja archiwalna |
| AC-09 | Infrastruktura fizyczna | Budynki, serwerownie, pomieszczenia |
| AC-10 | Personel | Pracownicy, kontrahenci, administratorzy |
| AC-11 | Nośniki wymienne | USB, dyski zewnętrzne, taśmy backup |
| AC-12 | Usługi komunikacyjne | E-mail, VoIP, wideokonferencje, messaging |

### 8.2. Threats — przykładowe (planowane ~60)

| ref_id | Nazwa | Kategoria | Źródło | CIA | Asset Categories |
|--------|-------|-----------|--------|-----|------------------|
| T-001 | Pożar | ENVIRONMENTAL | EXTERNAL | A | AC-01, AC-08, AC-09, AC-11 |
| T-002 | Powódź / zalanie | ENVIRONMENTAL | EXTERNAL | A | AC-01, AC-08, AC-09 |
| T-003 | Awaria zasilania | TECHNICAL | EXTERNAL | A | AC-01, AC-03, AC-09 |
| T-010 | Ransomware | HUMAN_INTENTIONAL | EXTERNAL | C,I,A | AC-01, AC-02, AC-04, AC-05, AC-06 |
| T-011 | Phishing | HUMAN_INTENTIONAL | EXTERNAL | C,I | AC-02, AC-04, AC-10, AC-12 |
| T-015 | Atak brute-force | HUMAN_INTENTIONAL | EXTERNAL | C,I | AC-04, AC-05, AC-06, AC-12 |
| T-020 | Kradzież sprzętu | HUMAN_INTENTIONAL | EXTERNAL | C,A | AC-02, AC-09, AC-11 |
| T-030 | Błąd konfiguracji | HUMAN_ACCIDENTAL | INTERNAL | C,I,A | AC-01, AC-03, AC-04, AC-06 |
| T-040 | Wyciek danych przez pracownika | HUMAN_INTENTIONAL | INTERNAL | C | AC-05, AC-07, AC-10, AC-12 |
| T-042 | Kradzież dokumentacji papierowej | HUMAN_INTENTIONAL | BOTH | C,A | AC-08, AC-09 |
| T-050 | Utrata kluczowego pracownika | ORGANIZATIONAL | INTERNAL | A | AC-10 |
| T-060 | Atak DDoS | HUMAN_INTENTIONAL | EXTERNAL | A | AC-01, AC-03, AC-04, AC-06 |

Pełny seed: ~60 zagrożeń pokrywających wszystkie kategorie i typy.

### 8.3. Weaknesses — przykładowe (planowane ~80)

| ref_id | Nazwa | Kategoria | Asset Categories |
|--------|-------|-----------|------------------|
| W-001 | Brak redundancji zasilania (UPS) | HARDWARE | AC-01, AC-03, AC-09 |
| W-010 | Brak segmentacji sieci | NETWORK | AC-01, AC-03, AC-04 |
| W-020 | Brak polityki złożoności haseł | SOFTWARE | AC-04, AC-05, AC-06 |
| W-021 | Brak blokady konta po N próbach | SOFTWARE | AC-04, AC-05, AC-06 |
| W-030 | Brak szkolenia awareness | PERSONNEL | AC-10 |
| W-040 | Brak zamykanych szaf na dokumenty | SITE | AC-08, AC-09 |
| W-050 | Brak procedury backup | PROCESS | AC-01, AC-04, AC-05, AC-06 |
| W-060 | Brak planu ciągłości działania | ORGANIZATION | AC-01, AC-04, AC-09, AC-10 |

Pełny seed: ~80 słabości.

### 8.4. Controls — przykładowe (planowane ~70)

| ref_id | Nazwa | Kategoria | Typ | Asset Categories |
|--------|-------|-----------|-----|------------------|
| C-001 | UPS i zasilanie awaryjne | PHYSICAL | PREVENTIVE | AC-01, AC-03, AC-09 |
| C-010 | Segmentacja sieci (VLAN/FW) | TECHNICAL | PREVENTIVE | AC-01, AC-03, AC-04 |
| C-020 | Uwierzytelnianie wieloskładnikowe (MFA) | TECHNICAL | PREVENTIVE | AC-04, AC-05, AC-06 |
| C-021 | Polityka złożoności i rotacji haseł | ORGANIZATIONAL | PREVENTIVE | AC-04, AC-05, AC-06 |
| C-030 | Program szkolenia awareness | ORGANIZATIONAL | PREVENTIVE | AC-10, AC-02 |
| C-040 | Szafy zamykane na klucz/kod | PHYSICAL | PREVENTIVE | AC-08, AC-09 |
| C-050 | Automatyczny backup (3-2-1) | TECHNICAL | CORRECTIVE | AC-01, AC-04, AC-05, AC-06 |
| C-060 | Plan ciągłości działania (BCP) | ORGANIZATIONAL | CORRECTIVE | AC-01, AC-04, AC-09, AC-10 |
| C-070 | SIEM / monitoring logów | TECHNICAL | DETECTIVE | AC-01, AC-03, AC-04, AC-06 |

Pełny seed: ~70 zabezpieczeń.

### 8.5. Seed correlations — przykładowe (~370 łącznie)

```yaml
# threat_weakness_links (~150)
- threat: T-015  # Atak brute-force
  weaknesses:
    - {ref: W-020, relevance: HIGH}    # Brak polityki haseł
    - {ref: W-021, relevance: HIGH}    # Brak blokady konta
    - {ref: W-030, relevance: MEDIUM}  # Brak szkolenia awareness

# threat_control_links (~120)
- threat: T-015  # Atak brute-force
  controls:
    - {ref: C-020, effectiveness: HIGH}    # MFA
    - {ref: C-021, effectiveness: MEDIUM}  # Polityka haseł
    - {ref: C-070, effectiveness: MEDIUM}  # SIEM monitoring

# weakness_control_links (~100)
- weakness: W-020  # Brak polityki haseł
  controls:
    - {ref: C-021, effectiveness: HIGH}    # Polityka haseł
    - {ref: C-020, effectiveness: HIGH}    # MFA (kompensujące)
```

---

## 9. API Endpoints

### 9.1. Katalogi — CRUD z filtrowaniem

```
# Threats
GET    /api/v1/threat-catalog
       ?asset_category_id={uuid}
       ?category=HUMAN_INTENTIONAL
       ?cia=C,I
       ?search=brute
       ?is_active=true
POST   /api/v1/threat-catalog
PUT    /api/v1/threat-catalog/{id}
DELETE /api/v1/threat-catalog/{id}   # soft-delete

# Weaknesses — analogiczne parametry
GET    /api/v1/weakness-catalog
POST   /api/v1/weakness-catalog
PUT    /api/v1/weakness-catalog/{id}
DELETE /api/v1/weakness-catalog/{id}

# Controls — analogiczne + ?implementation_type=PREVENTIVE
GET    /api/v1/control-catalog
POST   /api/v1/control-catalog
PUT    /api/v1/control-catalog/{id}
DELETE /api/v1/control-catalog/{id}

# Asset Categories
GET    /api/v1/asset-categories
POST   /api/v1/asset-categories      # tylko admin
```

### 9.2. Smart Suggestions (rule-based) — ZAWSZE DOSTĘPNE

```
GET /api/v1/suggestions/weaknesses?threat_id={uuid}
    → [{weakness, relevance, is_in_current_scenario}]

GET /api/v1/suggestions/controls?threat_id={uuid}
    → [{control, effectiveness, applied_status, applied_control_id}]

GET /api/v1/suggestions/threats-for-control?control_id={uuid}
    → [{threat, effectiveness}]

POST /api/v1/suggestions/quick-risk
    Body: {asset_id}
    → [{threat, weaknesses[], suggested_controls[], existing_controls[]}]

GET /api/v1/coverage/asset-category/{id}
    → {total_threats, covered, gaps[], coverage_pct}

GET /api/v1/coverage/control/{id}
    → {mitigated_threats[], risk_scenarios_using[], effectiveness_avg}
```

### 9.3. Feature flags

```
GET /api/v1/config/features
    → {ai_enabled: bool, ai_features: {...}}
```

### 9.4. AI Configuration — tylko admin

```
GET    /api/v1/admin/ai-config
       → {provider_type, api_endpoint, model_name, is_active, features..., last_test_at}
       UWAGA: api_key NIE jest zwracany (masked: "sk-ant-...***")

PUT    /api/v1/admin/ai-config
       Body: {provider_type, api_endpoint, api_key?, model_name, features...}

POST   /api/v1/admin/ai-config/test
       → {success: bool, message: string, response_time_ms: int}

POST   /api/v1/admin/ai-config/activate
POST   /api/v1/admin/ai-config/deactivate
```

### 9.5. AI Endpoints — DOSTĘPNE TYLKO GDY ai_enabled=TRUE

Każdy z tych endpointów sprawdza:
1. ai_enabled == true (z config)
2. Konkretna feature jest włączona
3. Rate limit nie przekroczony

Jeśli warunek nie spełniony → HTTP 503 z odpowiednim komunikatem.

```
# AI: Generacja scenariuszy
POST /api/v1/ai/generate-scenarios
    Body: {asset_id, org_context_id?}
    → 503 gdy AI wyłączone
    → {scenarios: [...], ai_request_id}

# AI: Wzbogacenie korelacji
POST /api/v1/ai/enrich-correlations
    Body: {scope: "threats"|"weaknesses"|"controls"|"all"}
    → 503 gdy AI wyłączone
    → {suggestions: [...], ai_request_id}

# AI: Wyszukiwanie NL
POST /api/v1/ai/search
    Body: {query: "jakie zagrożenia dotyczą pracy zdalnej?"}
    → 503 gdy AI wyłączone
    → {threats[], weaknesses[], controls[], interpretation}

# AI: Gap analysis
POST /api/v1/ai/gap-analysis
    Body: {org_unit_id, scope?: "all"|asset_category_id}
    → 503 gdy AI wyłączone
    → {gaps[], recommendations[], coverage_pct, priority_actions[]}

# AI: Asystent tworzenia wpisu
POST /api/v1/ai/assist-entry
    Body: {entry_type, name, description}
    → 503 gdy AI wyłączone
    → {suggested_categories[], suggested_cia?, suggested_correlations[]}

# AI: Review sugestii
POST /api/v1/ai/review
    Body: {ai_request_id, items: [{id, action: "accept"|"reject"|"modify"}]}

# AI: Statystyki użycia (admin)
GET /api/v1/ai/usage-stats?period=month
    → {requests_count, tokens_used, cost_usd, acceptance_rate}
```

### 9.6. Korelacje — zarządzanie

```
GET    /api/v1/links/threat-weakness?threat_id={uuid}
POST   /api/v1/links/threat-weakness
DELETE /api/v1/links/threat-weakness/{id}

GET    /api/v1/links/threat-control?threat_id={uuid}
POST   /api/v1/links/threat-control
DELETE /api/v1/links/threat-control/{id}

GET    /api/v1/links/weakness-control?weakness_id={uuid}
POST   /api/v1/links/weakness-control
DELETE /api/v1/links/weakness-control/{id}
```

---

## 10. Interfejs użytkownika

### 10.1. Zasada warunkowego renderowania AI

Frontend pobiera feature flags przy inicjalizacji:

```javascript
// React Context
const { aiEnabled, aiFeatures } = useFeatureFlags();

// Warunkowe renderowanie — ZERO elementów AI gdy wyłączone
{aiEnabled && aiFeatures.scenario_generation && (
  <AIScenarioButton />
)}

{aiEnabled && aiFeatures.gap_analysis && (
  <AIGapAnalysisPanel />
)}

{aiEnabled && aiFeatures.entry_assist && (
  <AIAssistIcon />
)}
```

KRYTYCZNE: Gdy ai_enabled=false, użytkownik NIE WIDZI:
- Żadnych przycisków "Wygeneruj AI", "Uzupełnij AI"
- Żadnych ikon ✨ przy polach formularzy
- Żadnej zakładki "AI" w dashboardzie
- Żadnych paneli "AI Gap Analysis"
- Żadnych wzmianek o AI w tooltipach, onboardingu, menu
- Żadnych wyszarzonych/zablokowanych elementów "upgrade to unlock"
- Zero śladów istnienia AI w interfejsie

System wygląda jak kompletny produkt bez AI. Bo nim jest.

### 10.2. Trzy tryby pracy (BEZ AI)

Tryb GUIDED (prowadzony):
```
┌─────────────────────────────────────────────────────────────┐
│  KREATOR SCENARIUSZA RYZYKA                     Tryb: Guided│
├─────────────────────────────────────────────────────────────┤
│  Krok 1/4 ● ○ ○ ○                                          │
│                                                             │
│  Wybierz kategorię aktywa:                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐   │
│  │ Serwery   │ │ Stacje    │ │ Sieć      │ │ Cloud    │   │
│  │  ✓ wybrane │ │  robocze  │ │           │ │          │   │
│  └───────────┘ └───────────┘ └───────────┘ └──────────┘   │
│                                                             │
│  Wybrano: Serwery → filtrujemy katalog (42→18 zagrożeń)    │
│                                           [Dalej →]        │
└─────────────────────────────────────────────────────────────┘
```

Tryb FREE (swobodny):
- Pełen dostęp do wszystkich katalogów bez filtrowania
- Sugestie w bocznym panelu (nie blokują)
- Dla zaawansowanych analityków

### 10.3. Panel sugestii (BEZ AI)

```
┌─────────────────────────────────────────────────────────────┐
│  SCENARIUSZ RYZYKA: Serwer produkcyjny ERP                  │
├──────────────────────────────┬──────────────────────────────┤
│  Zagrożenie: T-015           │  SUGESTIE                    │
│  Atak brute-force            │                              │
│                              │  Słabości (3 sugerowane):    │
│  Słabości:                   │  ✦ W-020 Brak polityki [HIGH]│
│  ☑ W-020 Brak polityki haseł│  ✦ W-021 Brak blokady [HIGH] │
│  ☑ W-021 Brak blokady konta │  ○ W-033 Brak monit.  [MED]  │
│                              │                              │
│  Zabezpieczenia sugerowane:  │  Zabezpieczenia (4 suger.):  │
│  ☑ C-020 MFA                │  ✦ C-020 MFA         [HIGH]  │
│  ☑ C-021 Polityka haseł     │  ✦ C-043 Blokada konta[HIGH]  │
│                              │  ○ C-021 Polityka haseł[MED]  │
│  ⚡ MASZ JUŻ WDROŻONE:       │  ○ C-070 SIEM         [MED]  │
│  ✅ MFA (od 2025-03-15)     │                              │
│     Jan Kowalski             │                              │
│     Effectiveness: HIGH      │                              │
│                              │                              │
│  [Zapisz draft] [Zatwierdź]  │                              │
└──────────────────────────────┴──────────────────────────────┘
```

### 10.4. Panel sugestii (Z AI — gdy ai_enabled=true)

```
┌─────────────────────────────────────────────────────────────┐
│  SCENARIUSZ RYZYKA: Serwer produkcyjny ERP                  │
├──────────────────────────────┬──────────────────────────────┤
│  Zagrożenie: T-015           │  SUGESTIE                    │
│  Atak brute-force            │                              │
│                              │  Słabości (3 sugerowane):    │
│  Słabości:                   │  ✦ W-020 Brak polityki [HIGH]│
│  ☑ W-020 Brak polityki haseł│  ✦ W-021 Brak blokady [HIGH] │
│  ☑ W-021 Brak blokady konta │  ○ W-033 Brak monit.  [MED]  │
│                              │                              │
│  Zabezpieczenia sugerowane:  │  Zabezpieczenia (4 suger.):  │
│  ☑ C-020 MFA                │  ✦ C-020 MFA         [HIGH]  │
│  ☑ C-021 Polityka haseł     │  ✦ C-043 Blokada konta[HIGH]  │
│                              │                              │
│  ⚡ MASZ JUŻ WDROŻONE:       │  ─────────────────────────── │
│  ✅ MFA (od 2025-03-15)     │  ✨ AI Analysis:              │
│     Jan Kowalski             │  "Brakuje monitoringu prób   │
│     Effectiveness: HIGH      │   logowania — rozważ SIEM"   │
│                              │                              │
│  [Zapisz draft] [Zatwierdź]  │  [✨ Wygeneruj scenariusze AI]│
└──────────────────────────────┴──────────────────────────────┘
```

Jedyna różnica: sekcja "✨ AI Analysis" i przycisk "Wygeneruj scenariusze AI" pojawiają się warunkowe. Reszta UI identyczna.

### 10.5. Tryb AI-ASSISTED (tylko gdy ai_enabled=true)

Pojawia się jako trzeci tryb w selectorze:
```
Tryb: [Guided] [Free] [✨ AI-Assisted]
```

Użytkownik opisuje aktywo i kontekst → AI generuje draft → użytkownik reviewuje.

### 10.6. Coverage Dashboard (BEZ AI)

Zawsze dostępny — oparty na rule-based coverage_analysis():

```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD POKRYCIA                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AC-01 Serwery       ████████████░░░░  78%  3 luki         │
│  AC-02 Stacje robocze ██████████████░░  87%  2 luki         │
│  AC-03 Sieć          ██████░░░░░░░░░░  45%  6 luk          │
│  AC-04 Aplikacje     ████████████████  95%  1 luka         │
│  ...                                                        │
│                                                             │
│  Kliknij kategorię aby zobaczyć szczegóły luk               │
│                                                             │
│  [Gdy AI aktywne — pojawia się tu przycisk:]                │
│  [✨ AI Gap Analysis — szczegółowa analiza]                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Sekwencja implementacji

### Faza 1: Analiza + Fundament — ~3 tygodnie

| # | Zadanie | Zależności |
|---|---------|-----------|
| 1.0 | ANALIZA istniejącego kodu: modele, migracje, API, frontend (sekcja 2.1) | — |
| 1.1 | Raport rozbieżności + propozycja adaptacji | 1.0 |
| 1.2 | Migracja: tabele asset_categories, threat_catalog, weakness_catalog, control_catalog | 1.1 |
| 1.3 | Migracja: tabele M2M asset category assignments | 1.2 |
| 1.4 | Migracja: tabele korelacji threat_weakness_link, threat_control_link, weakness_control_link | 1.2 |
| 1.5 | Seed data: 12 asset categories | 1.2 |
| 1.6 | Seed data: ~60 threats, ~80 weaknesses, ~70 controls z przypisaniem do asset categories | 1.3 |
| 1.7 | Seed data: ~370 korelacji (links) | 1.4, 1.6 |
| 1.8 | API CRUD: wszystkie katalogi z filtrowaniem | 1.2 |
| 1.9 | Zmiana istniejących tabel: assets, risk_scenarios, applied_controls (po analizie z 1.0) | 1.2 |

### Faza 2: Smart Engine — ~2 tygodnie

| # | Zadanie | Zależności |
|---|---------|-----------|
| 2.1 | Suggestion Engine: suggest_weaknesses(), suggest_controls() | Faza 1 |
| 2.2 | Auto-detection: detect_existing_controls() | 2.1 |
| 2.3 | Reverse lookup: threats_for_control() | 2.1 |
| 2.4 | Coverage analysis: coverage_analysis() | 2.1 |
| 2.5 | Quick Risk: generate_quick_risks() | 2.1, 2.2 |
| 2.6 | API endpoints: /suggestions/*, /coverage/* | 2.1-2.5 |

### Faza 3: UI (bez AI) — ~3 tygodnie

| # | Zadanie | Zależności |
|---|---------|-----------|
| 3.1 | Feature flags: GET /config/features + useFeatureFlags() hook | — |
| 3.2 | UI: Zarządzanie katalogami (CRUD, filtrowanie, wyszukiwanie) | Faza 1 |
| 3.3 | UI: Kreator scenariusza Guided mode | Faza 2 |
| 3.4 | UI: Panel sugestii (boczny panel) | 2.1, 2.2 |
| 3.5 | UI: Panel "Masz już wdrożone" | 2.2 |
| 3.6 | UI: Quick Risk — widok auto-generowanych scenariuszy | 2.5 |
| 3.7 | UI: Dashboard pokrycia (coverage) | 2.4 |
| 3.8 | UI: Zarządzanie korelacjami (edycja links) | Faza 1 |

NA TYM ETAPIE SYSTEM JEST KOMPLETNY I GOTOWY DO UŻYCIA BEZ AI.

### Faza 4: AI Plugin (opcjonalny) — ~3 tygodnie

| # | Zadanie | Zależności |
|---|---------|-----------|
| 4.1 | Tabela ai_provider_config + ai_audit_log | — |
| 4.2 | AI Adapters: AnthropicAdapter, OpenAICompatibleAdapter | — |
| 4.3 | AI Service: bazowa klasa z graceful degradation | 4.2 |
| 4.4 | Admin API: /admin/ai-config (CRUD + test + activate/deactivate) | 4.1 |
| 4.5 | Admin UI: Panel konfiguracji AI (Ustawienia > Integracja AI) | 4.4 |
| 4.6 | Prompt templates + context builder | 4.3 |
| 4.7 | AI Rate limiting middleware | 4.1 |
| 4.8 | AI Use Case 1: Generacja scenariuszy | 4.6, Faza 2 |
| 4.9 | AI Use Case 2: Wzbogacenie korelacji | 4.6 |
| 4.10 | AI Use Case 3: Natural language search | 4.6 |
| 4.11 | AI Use Case 4: Gap analysis | 4.6, 2.4 |
| 4.12 | AI Use Case 5: Asystent tworzenia wpisów | 4.6 |
| 4.13 | API endpoints: /ai/* (z ochroną 503) | 4.8-4.12 |
| 4.14 | UI: Warunkowe komponenty AI (przyciski, panele, tryb AI-Assisted) | 4.13, 3.1 |
| 4.15 | UI: Dashboard AI usage stats (admin) | 4.1 |
| 4.16 | UI: Ekran review sugestii AI | 4.8, 4.9 |
| 4.17 | Testy: AI mocks, graceful degradation, feature flags | 4.13, 4.14 |

### Faza 5: Rozszerzenia (przyszłość)

| # | Zadanie |
|---|---------|
| 5.1 | Import/export katalogów (YAML/Excel) |
| 5.2 | Mapowanie control_catalog → framework_controls (ISO 27001 Annex A) |
| 5.3 | AI: Fine-tuning promptów na bazie feedback |
| 5.4 | Integracja z MITRE ATT&CK |
| 5.5 | AI: Automatyczne wykrywanie nowych zagrożeń z newsów/CVE |

---

## 12. Migracja bazy danych

### 12.1. Plan migracji

```
migrations/
  001_create_asset_categories.py
  002_create_threat_catalog.py
  003_create_weakness_catalog.py
  004_create_control_catalog.py
  005_create_asset_category_m2m.py
  006_create_correlation_links.py
  007_alter_assets_add_category.py          # PO ANALIZIE ISTNIEJĄCEGO KODU
  008_alter_risk_scenarios_add_m2m.py       # PO ANALIZIE ISTNIEJĄCEGO KODU
  009_alter_applied_controls_add_ref.py     # PO ANALIZIE ISTNIEJĄCEGO KODU
  010_seed_asset_categories.py
  011_seed_threat_catalog.py
  012_seed_weakness_catalog.py
  013_seed_control_catalog.py
  014_seed_correlations.py
  015_create_ai_provider_config.py          # osobna, AI-specific
  016_create_ai_audit_log.py                # osobna, AI-specific
  017_create_control_framework_mapping.py   # opcjonalna, P4
```

UWAGA: Migracje 007-009 wymagają wcześniejszej analizy istniejących tabel (krok 1.0). Nie pisz ich na ślepo!

### 12.2. Backward compatibility

- Istniejące risk_scenarios dalej działają — nowe pola M2M są opcjonalne
- Istniejące applied_controls dalej działają — reference_control_id jest nullable
- Istniejące assets dalej działają — asset_category_id jest nullable
- ai_provider_config domyślnie pusta — AI wyłączone
- Stopniowa migracja: użytkownicy przypisują kategorie do istniejących aktywów w swoim tempie

---

## Podsumowanie

Smart Catalog to moduł łączący:

1. Trzy katalogi (threats, weaknesses, controls) z tagowaniem po kategorii aktywa
2. Trójstronną korelację — predefiniowane i rozszerzalne powiązania między katalogami
3. Smart Engine — rule-based filtrowanie, sugestie, auto-detekcja wdrożonych kontroli
4. Opcjonalny AI plugin — 5 use case'ów LLM, aktywowanych przez admina bez zmian w kodzie

Kluczowa zasada: System jest kompletny i wartościowy bez AI. AI to premium rozszerzenie dla tych, którzy chcą i mogą je skonfigurować. Użytkownik bez AI nie wie, że AI istnieje.

Kompatybilni providerzy AI (po konfiguracji przez admina):
- Anthropic Claude (Sonnet, Opus, Haiku)
- OpenAI (GPT-4o, GPT-4)
- Self-hosted: vLLM, Ollama, LocalAI (OpenAI-compatible endpoint)
- Azure OpenAI
- Dowolne API kompatybilne z /v1/chat/completions

Przewaga nad konkurencją:
- vs CISO Assistant — mamy weakness jako obiekt, korelacje, filtrowanie po asset category, opcjonalne AI
- vs ServiceNow — nie wymagamy CMDB, pracujemy na ISO 27005, niższy próg wejścia
- vs Centraleyes/6clicks — open, self-hostable, pełna kontrola nad danymi i AI, brak vendor lock-in
