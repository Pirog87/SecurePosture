# SPECYFIKACJA: Compliance & Audit — Frameworki, Ocena Zgodności i Audyt

## SecurePosture — Moduł zarządzania dokumentami referencyjnymi, oceną zgodności i audytem wewnętrznym

**Wersja:** 1.0
**Data:** 2026-02-13
**Status:** SPECYFIKACJA DO IMPLEMENTACJI (Claude Code)
**Zasada architektoniczna:** AI jako opcjonalny plugin (identycznie jak Smart Catalog v2). System w pełni funkcjonalny bez AI.

---

## Spis treści

1. Podsumowanie założeń
2. KRYTYCZNE: Instrukcje dla agenta implementującego
3. Model danych — Framework i wymagania
4. Model danych — Compliance Assessment (ocena zgodności)
5. Model danych — Audit Workflow (planowanie i realizacja audytu)
6. Model danych — Framework Mapping (mapowanie wymagań)
7. Model danych — Katalog testów audytowych
8. Model danych — Nowe obiekty scope (Service, Process)
9. Silnik pokrycia i analizy luk (rule-based)
10. AI jako opcjonalny plugin — 8 use case'ów
11. Integracja z istniejącymi modułami
12. Import frameworków — źródła i parsery
13. API Endpoints
14. Interfejs użytkownika
15. Generowanie raportów (PDF + DOCX)
16. Sekwencja implementacji
17. Migracja bazy danych

---

## 1. Podsumowanie założeń

### 1.1. Problem

Organizacja zarządza wieloma dokumentami referencyjnymi jednocześnie: standardy (ISO 27001, CIS, NIST CSF), regulacje (RODO, NIS2, DORA, AI Act), regulacje wewnętrzne (Standard zabezpieczenia SI). Dla każdego z nich musi:

- Oceniać bieżącą zgodność punkt po punkcie
- Planować i realizować cykliczne audyty wewnętrzne
- Zbierać i zarządzać dowodami
- Formułować ustalenia i śledzić działania naprawcze
- Rozumieć, jak wymagania jednego dokumentu mapują się na inny (np. "mam ISO 27001 — ile pokrywam NIS2?")
- Raportować stan zgodności per organizacja, pion, dział, projekt, usługa

Dziś robią to w Excelu, co prowadzi do: duplikacji pracy, braku spójności między audytami, niemoożności mapowania cross-framework, braku śladu audytowego.

### 1.2. Rozwiązanie

Moduł Compliance & Audit z trzema warstwami:

1. **Framework Library** — import lub ręczne tworzenie dokumentów referencyjnych z hierarchią wymagań
2. **Compliance Assessment** — bieżąca (continuous) i cykliczna (planned audit) ocena zgodności
3. **Audit Workflow** — planowanie, realizacja i raportowanie audytów zgodnie z IIA 2024

Plus opcjonalnie:
4. **AI Intelligence** — mapowanie frameworków, generowanie testów, formułowanie ustaleń (aktywowane po podłączeniu API LLM przez admina)

### 1.3. Kluczowa zasada: AI jako opcjonalny plugin

Identycznie jak w Smart Catalog v2:

1. **ZERO ZALEŻNOŚCI OD AI** — silnik pokrycia i analizy luk jest rule-based, kompletny bez AI
2. **ZERO WIDOCZNOŚCI AI BEZ KONFIGURACJI** — gdy AI nie jest skonfigurowane, użytkownik nie widzi żadnych elementów AI w UI
3. **GRACEFUL ACTIVATION** — po skonfigurowaniu API przez admina, funkcje AI pojawiają się automatycznie
4. **GRACEFUL DEGRADATION** — gdy API przestanie działać, system wraca do trybu rule-based
5. **AGNOSTYCZNY PROVIDER** — ten sam mechanizm co Smart Catalog (Anthropic / OpenAI-compatible adapters)

AI korzysta z TEGO SAMEGO `ai_provider_config` co Smart Catalog — jeden config dla całego systemu. Feature toggles per moduł:

```
ai_provider_config.feature_framework_mapping    BOOLEAN DEFAULT TRUE
ai_provider_config.feature_test_generation      BOOLEAN DEFAULT TRUE
ai_provider_config.feature_gap_analysis_ai      BOOLEAN DEFAULT TRUE
ai_provider_config.feature_finding_formulation  BOOLEAN DEFAULT TRUE
ai_provider_config.feature_report_summary       BOOLEAN DEFAULT TRUE
ai_provider_config.feature_trend_analysis       BOOLEAN DEFAULT TRUE
ai_provider_config.feature_requirement_classify BOOLEAN DEFAULT TRUE
ai_provider_config.feature_translation          BOOLEAN DEFAULT TRUE
```

### 1.4. Dwie perspektywy oceny — Continuous + Planned

**Continuous Compliance** (codziennie, ad-hoc):
- Każdy uprawniony użytkownik może w dowolnym momencie wejść w dowolny punkt dokumentu referencyjnego i zaktualizować ocenę
- Reakcja na zgłoszenia, incydenty, zmiany regulacji, obserwacje
- Wynik: aktualny „żywy" stan zgodności organizacji

**Planned Audit** (cyklicznie, zaplanowany):
- Program roczny audytów z przypisanymi audytorami i terminami
- Formalne zadanie audytowe (engagement) z lifecycle'em: planning → fieldwork → reporting → follow-up
- Audytor przy fieldworku „widzi" aktualny stan continuous assessment jako punkt wyjścia
- Wynik: raport audytowy z ustaleniami, rekomendacjami i działaniami

**Jak się przenikają:**
- Continuous assessment to „żywy" stan — zawsze aktualny
- Audit engagement pobiera snapshot continuous assessment na starcie fieldworku
- Audytor weryfikuje/potwierdza/kwestionuje bieżące oceny
- Po zakończeniu audytu, zweryfikowane oceny aktualizują continuous assessment z flagą `last_audited_at`, `last_audited_by`
- Historia zmian: pełny audit trail kto, kiedy, co zmienił, z jakiego powodu

### 1.5. Czego NIE robimy (świadome ograniczenia)

| Wykluczenie | Uzasadnienie |
|-------------|--------------|
| Automatyczne sprawdzanie compliance (technical checks) | Nie jesteśmy skanerem. Ocena jest ekspercka. |
| External audit management | Skupiamy się na audycie wewnętrznym. Zewnętrzny audytor dostaje raport. |
| Real-time regulatory change tracking | Nie monitorujemy zmian w prawie automatycznie. Import nowych wersji frameworków jest ręczny. |
| AI bez human-in-the-loop | Każdy output AI to DRAFT wymagający zatwierdzenia |
| Strategia audytowa wieloletnia (v1) | Jednopoziomowy plan roczny na start. Wielopoziomowy jako rozszerzenie. |

### 1.6. Terminologia

| Termin w SecurePosture | Odpowiednik | Opis |
|------------------------|-------------|------|
| Framework | Dokument referencyjny | Standard branżowy (ISO, CIS, NIST), regulacja (RODO, NIS2), polityka wewnętrzna |
| Requirement Node | Wymaganie / punkt | Element hierarchii frameworka. Może być ocenialny (assessable) lub organizacyjny (sekcja, tytuł) |
| Compliance Assessment | Ocena zgodności | Instancja oceny frameworka w danym scope |
| Requirement Assessment | Ocena wymagania | Ocena pojedynczego wymagania: status, score, maturity, dowody |
| Audit Program | Program audytów | Roczny plan zadań audytowych |
| Audit Engagement | Zadanie audytowe | Konkretny audyt z lifecycle'em IIA |
| Audit Test | Test audytowy | Test weryfikujący spełnienie wymagania |
| Test Template | Szablon testu | Reużywalny wzorzec testu z katalogu |
| Audit Finding | Ustalenie audytowe | Sformalizowane ustalenie w formacie IIA (condition, criteria, cause, effect) |
| Framework Mapping | Mapowanie | Powiązanie wymagań między frameworkami |
| Evidence | Dowód | Plik, link lub opis uzasadniający ocenę |

---

## 2. KRYTYCZNE: Instrukcje dla agenta implementującego

### 2.1. Analiza istniejącego kodu PRZED implementacją

ZANIM zaczniesz implementować cokolwiek z tej specyfikacji, MUSISZ:

1. **PRZEANALIZOWAĆ ISTNIEJĄCY KOD** — sprawdź aktualne modele, szczególnie:

   a. **Framework / FrameworkControl** — w CISO Assistant istnieje już model Framework. Sprawdź:
      - Czy w naszym kodzie istnieje już model Framework
      - Jeśli tak — jaka jest jego struktura, czy ma hierarchię wymagań
      - Czy możemy go rozszerzyć czy musimy stworzyć nowy
      
   b. **AppliedControl / ReferenceControl** — sprawdź powiązanie z frameworkami:
      - Czy applied_controls mają już powiązanie z framework requirements
      - Czy istnieje reference_control_id FK
      
   c. **OrgUnit** — sprawdź strukturę organizacyjną:
      - Czy org_units mają hierarchię (parent_id)
      - Jakie typy/poziomy obsługują
      
   d. **Moduł Actions** — sprawdź:
      - Czy istnieje moduł działań/action plans
      - Jak wygląda jego model (status, odpowiedzialny, termin)
      - Jak powiązać audit findings z actions
      
   e. **Moduł Evidence** — sprawdź:
      - Czy istnieje już model Evidence
      - Jaka jest struktura plików/linków
      
   f. **Istniejący moduł audytu** — sprawdź czy jest już jakikolwiek model audytowy:
      - ComplianceAssessment
      - Audit-related tables
      - Jeśli istnieje — co zawiera, jak go rozszerzyć vs zastąpić

2. **DOSTOSOWAĆ SPECYFIKACJĘ DO STANU FAKTYCZNEGO** — ta specyfikacja zakłada pewien model danych. Jeśli rzeczywisty kod jest inny:

   a. Nazwy tabel/pól — dostosuj DDL do istniejących konwencji
   b. Relacje — jeśli Framework ma inną strukturę, adaptuj
   c. Konwencje API — użyj tych samych wzorców co istniejące endpointy
   d. Frontend — użyj tych samych wzorców co istniejące moduły

3. **RAPORTUJ ROZBIEŻNOŚCI** — przed pisaniem kodu:
   - Opisz co znalazłeś
   - Zaproponuj adaptację
   - Zapytaj o potwierdzenie w przypadku istotnych zmian

### 2.2. Relacja z modułem Smart Catalog

Moduł Compliance & Audit współistnieje z modułem Smart Catalog (T↔W↔C):

- **control_catalog** (z Smart Catalog) może być mapowany na **requirement_node** (z tego modułu)
- **applied_control** wdrożony w organizacji jest dowodem spełnienia wymagania
- **Wspólna tabela ai_provider_config** — jeden config AI dla obu modułów
- **Wspólna tabela ai_audit_log** — jedno miejsce logowania wywołań AI

Nie duplikuj tabel konfiguracji AI — rozszerzaj istniejące o nowe feature toggles.

### 2.3. Kolejność implementacji

1. Analiza istniejącego kodu (sekcja 2.1)
2. Tabele framework + requirement_node + seed data (sekcja 3, 12)
3. Tabele compliance_assessment + requirement_assessment + evidence (sekcja 4)
4. Tabele audit workflow: audit_program, audit_engagement, audit_test, audit_finding, audit_report (sekcja 5)
5. Tabele framework_mapping (sekcja 6)
6. Tabele test_template_catalog (sekcja 7)
7. Tabele service, business_process (sekcja 8)
8. Silnik pokrycia i analizy luk (sekcja 9)
9. Import frameworków — CISO Assistant YAML parser (sekcja 12)
10. API endpoints (sekcja 13)
11. AI feature toggles — rozszerzenie ai_provider_config (sekcja 10)
12. AI Service — 8 use case'ów z prompt templates (sekcja 10)
13. Frontend — najpierw bez AI, potem warunkowe komponenty (sekcja 14)
14. Generowanie raportów PDF + DOCX (sekcja 15)

### 2.4. Testy

Dla każdego etapu:

- Unit tests: modele, serializers, coverage engine, YAML parser
- Integration tests: API endpoints, import frameworków, audit lifecycle workflow
- AI-specific: mock AI responses, graceful degradation, feature flags
- E2E: pełny cykl: import framework → create assessment → assess requirements → plan audit → fieldwork → findings → report → actions

---

## 3. Model danych — Framework i wymagania

### 3.1. frameworks — Dokumenty referencyjne

```sql
CREATE TABLE frameworks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_id              VARCHAR(50) NOT NULL,           -- "iso-27001-2022", "nis2-2022", "internal-si-standard-v3"
    urn                 VARCHAR(200),                    -- URN zgodny z CISO Assistant (opcjonalnie)
    name                VARCHAR(300) NOT NULL,           -- "ISO/IEC 27001:2022"
    description         TEXT,
    document_type       VARCHAR(20) NOT NULL DEFAULT 'standard',
                        -- 'standard' = ISO, CIS, NIST, COBIT
                        -- 'regulation' = RODO, NIS2, DORA, AI Act
                        -- 'internal_policy' = regulacje wewnętrzne
    provider            VARCHAR(200),                    -- "ISO", "NIST", "European Commission", "Nasza organizacja"
    version             VARCHAR(50),                     -- "2022", "2.0", "rev5"
    locale              VARCHAR(10) DEFAULT 'en',        -- język oryginału: 'en', 'pl', 'de'
    
    -- Scoring configuration per framework
    scoring_mode        VARCHAR(20) DEFAULT 'status',    
                        -- 'status' = tylko status (compliant/non-compliant/partial/NA)
                        -- 'score' = status + score numeryczny
                        -- 'maturity' = status + maturity level
                        -- 'full' = status + score + maturity (wszystkie trzy)
    min_score           INTEGER DEFAULT 0,               -- dolna granica skali (np. 0)
    max_score           INTEGER DEFAULT 100,             -- górna granica skali (np. 100)
    score_definition    JSONB,                           -- definicja skali: {"0": "Not implemented", "25": "Partially", ...}
    maturity_scale      JSONB DEFAULT '["initial", "managed", "defined", "quantitatively_managed", "optimizing"]',
    
    -- Implementation groups (np. CIS: IG1, IG2, IG3)
    implementation_groups JSONB,                          -- ["IG1", "IG2", "IG3"] lub null
    default_selected_groups JSONB,                        -- ["IG1"] — domyślnie wybrane
    
    -- Metadata
    publication_date    DATE,
    effective_date      DATE,                             -- kiedy wchodzi w życie (dla regulacji)
    source_url          VARCHAR(500),                     -- link do źródła
    source_type         VARCHAR(20) DEFAULT 'manual',     -- 'manual' | 'ciso_assistant' | 'oscal' | 'scf' | 'excel'
    is_active           BOOLEAN DEFAULT TRUE,
    is_system           BOOLEAN DEFAULT FALSE,            -- importowany z library (niemodyfikowalny)
    org_unit_id         UUID REFERENCES org_units(id),    -- NULL = globalny
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(ref_id, org_unit_id)
);

CREATE INDEX idx_frameworks_type ON frameworks(document_type);
CREATE INDEX idx_frameworks_active ON frameworks(is_active);
```

UWAGA: Sprawdź czy istnieje już tabela `frameworks` w systemie. Jeśli tak — rozszerzaj ją o nowe pola zamiast tworzyć nową.

### 3.2. requirement_nodes — Hierarchia wymagań

```sql
CREATE TABLE requirement_nodes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id        UUID NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
    urn                 VARCHAR(200),                    -- URN kompatybilny z CISO Assistant
    ref_id              VARCHAR(50) NOT NULL,            -- "A.5.1", "Art.21.2.a", "4.1"
    name                VARCHAR(500) NOT NULL,           -- tytuł wymagania
    description         TEXT,                            -- pełna treść wymagania
    annotation          TEXT,                            -- dodatkowe komentarze/interpretacje
    
    -- Hierarchy
    parent_id           UUID REFERENCES requirement_nodes(id) ON DELETE CASCADE,
    depth               INTEGER NOT NULL DEFAULT 1,      -- poziom zagnieżdżenia (1 = top)
    display_order       INTEGER DEFAULT 0,               -- kolejność wyświetlania w obrębie rodzica
    
    -- Assessment properties
    assessable          BOOLEAN NOT NULL DEFAULT FALSE,   -- true = można ocenić, false = sekcja organizacyjna
    
    -- Classification (opcjonalne, mogą być wypełnione ręcznie lub przez AI)
    cia_impact          JSONB DEFAULT '{}',              -- {"C": true, "I": false, "A": true}
    category            VARCHAR(50),                      -- np. "governance", "technical", "organizational", "legal"
    tags                JSONB DEFAULT '[]',               -- ["encryption", "access_control", "incident_response"]
    
    -- Implementation groups (jeśli framework je definiuje)
    implementation_groups VARCHAR(100),                    -- "IG1,IG2" lub null
    
    -- Metadata
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_req_nodes_framework ON requirement_nodes(framework_id);
CREATE INDEX idx_req_nodes_parent ON requirement_nodes(parent_id);
CREATE INDEX idx_req_nodes_assessable ON requirement_nodes(framework_id, assessable);
CREATE INDEX idx_req_nodes_ref ON requirement_nodes(framework_id, ref_id);
```

### 3.3. Translations — Tłumaczenia wymagań (opcjonalne)

```sql
CREATE TABLE requirement_translations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_node_id UUID NOT NULL REFERENCES requirement_nodes(id) ON DELETE CASCADE,
    locale              VARCHAR(10) NOT NULL,             -- 'pl', 'de', 'fr'
    name                VARCHAR(500),
    description         TEXT,
    annotation          TEXT,
    source              VARCHAR(20) DEFAULT 'manual',     -- 'manual' | 'ai_translated' | 'imported'
    translated_by       UUID REFERENCES users(id),        -- NULL jeśli AI
    confirmed_by        UUID REFERENCES users(id),        -- NULL jeśli niepotwierdzone
    confirmed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(requirement_node_id, locale)
);
```

---

## 4. Model danych — Compliance Assessment (ocena zgodności)

### 4.1. compliance_assessments — Instancja oceny

```sql
CREATE TABLE compliance_assessments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id        UUID NOT NULL REFERENCES frameworks(id),
    
    -- Scope — co oceniamy
    scope_type          VARCHAR(20) NOT NULL DEFAULT 'organization',
                        -- 'organization' | 'org_unit' | 'project' | 'service' | 'process'
    scope_id            UUID,                             -- FK do odpowiedniej tabeli (polymorphic)
    scope_name          VARCHAR(300),                     -- czytelna nazwa scope'u (denormalizacja)
    
    -- Assessment type
    assessment_type     VARCHAR(20) NOT NULL DEFAULT 'continuous',
                        -- 'continuous' = bieżąca ocena (jedna per framework+scope)
                        -- 'audit_snapshot' = snapshot na potrzeby audytu (read-only po utworzeniu)
    
    -- Scoring mode (dziedziczony z framework, ale można nadpisać)
    scoring_mode        VARCHAR(20),                      -- NULL = dziedzicz z framework
    min_score           INTEGER,
    max_score           INTEGER,
    
    -- Implementation groups (podzbiór z framework)
    selected_impl_groups JSONB,                           -- ["IG1", "IG2"] lub NULL = wszystkie
    
    -- Status
    status              VARCHAR(20) DEFAULT 'draft',      
                        -- 'draft' | 'in_progress' | 'completed' | 'archived'
    
    -- Computed scores (read-only, przeliczane automatycznie)
    compliance_score    DECIMAL(5,2),                     -- % zgodności (assessable & compliant / assessable total)
    total_requirements  INTEGER DEFAULT 0,
    assessed_count      INTEGER DEFAULT 0,
    compliant_count     INTEGER DEFAULT 0,
    partially_count     INTEGER DEFAULT 0,
    non_compliant_count INTEGER DEFAULT 0,
    not_applicable_count INTEGER DEFAULT 0,
    
    -- Metadata
    name                VARCHAR(300),                     -- opcjonalna nazwa: "ISO 27001 - IT Department - 2025"
    description         TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: jeden continuous assessment per framework + scope
    UNIQUE NULLS NOT DISTINCT (framework_id, scope_type, scope_id, assessment_type) 
    -- uwaga: wymaga PostgreSQL 15+ dla NULLS NOT DISTINCT; alternatywnie: partial unique index
);

CREATE INDEX idx_ca_framework ON compliance_assessments(framework_id);
CREATE INDEX idx_ca_scope ON compliance_assessments(scope_type, scope_id);
CREATE INDEX idx_ca_type ON compliance_assessments(assessment_type);
```

UWAGA: Sprawdź czy tabela compliance_assessments już istnieje w CISO Assistant fork. Jeśli tak — rozszerzaj.

### 4.2. requirement_assessments — Ocena per wymaganie

```sql
CREATE TABLE requirement_assessments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_assessment_id UUID NOT NULL REFERENCES compliance_assessments(id) ON DELETE CASCADE,
    requirement_node_id     UUID NOT NULL REFERENCES requirement_nodes(id),
    
    -- Assessment result
    result                  VARCHAR(20) DEFAULT 'not_assessed',
                            -- 'compliant' | 'partially_compliant' | 'non_compliant' | 
                            -- 'not_applicable' | 'not_assessed'
    score                   INTEGER,                      -- numeryczny score (opcjonalny, wg scoring_mode)
    maturity_level          VARCHAR(30),                   -- 'initial' | 'managed' | 'defined' | 
                                                           -- 'quantitatively_managed' | 'optimizing'
    
    -- Audit metadata
    assessor_id             UUID REFERENCES users(id),     -- kto ocenił
    assessed_at             TIMESTAMPTZ,                   -- kiedy
    
    -- Audit trail
    last_audited_at         TIMESTAMPTZ,                   -- kiedy ostatnio zweryfikowane w audycie
    last_audited_by         UUID REFERENCES users(id),     -- przez kogo
    audit_engagement_id     UUID,                          -- w ramach jakiego audytu (FK dodana później)
    
    -- Content
    notes                   TEXT,                          -- notatki oceniającego
    justification           TEXT,                          -- uzasadnienie (szczególnie dla not_applicable)
    
    -- Implementation groups
    selected                BOOLEAN DEFAULT TRUE,          -- czy wymaganie jest w scope (na bazie impl groups)
    
    -- Metadata
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(compliance_assessment_id, requirement_node_id)
);

CREATE INDEX idx_ra_assessment ON requirement_assessments(compliance_assessment_id);
CREATE INDEX idx_ra_requirement ON requirement_assessments(requirement_node_id);
CREATE INDEX idx_ra_result ON requirement_assessments(result);
```

### 4.3. requirement_assessment_controls — Powiązanie oceny z kontrolami

```sql
CREATE TABLE requirement_assessment_controls (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_assessment_id UUID NOT NULL REFERENCES requirement_assessments(id) ON DELETE CASCADE,
    applied_control_id      UUID NOT NULL REFERENCES applied_controls(id),
    relevance               VARCHAR(20) DEFAULT 'primary',  -- 'primary' | 'supporting' | 'partial'
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(requirement_assessment_id, applied_control_id)
);
```

UWAGA: Sprawdź rzeczywistą nazwę tabeli applied_controls w kodzie.

### 4.4. evidences — Dowody

```sql
CREATE TABLE evidences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(300) NOT NULL,
    description         TEXT,
    
    -- Source
    evidence_type       VARCHAR(20) NOT NULL DEFAULT 'file',
                        -- 'file' | 'url' | 'description' | 'screenshot'
    file_path           VARCHAR(500),                    -- ścieżka do pliku (jeśli file)
    file_name           VARCHAR(300),                    -- oryginalna nazwa pliku
    file_size           BIGINT,                          -- rozmiar w bajtach
    mime_type           VARCHAR(100),                    -- "application/pdf", "image/png"
    url                 VARCHAR(500),                    -- link (jeśli url)
    
    -- Validity
    valid_from          DATE,                            -- od kiedy dowód jest aktualny
    valid_until         DATE,                            -- do kiedy (reminder do odświeżenia)
    
    -- Metadata
    uploaded_by         UUID REFERENCES users(id),
    org_unit_id         UUID REFERENCES org_units(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- M2M: evidence ↔ requirement_assessment (jeden dowód może pokrywać wiele wymagań)
CREATE TABLE requirement_assessment_evidences (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_assessment_id UUID NOT NULL REFERENCES requirement_assessments(id) ON DELETE CASCADE,
    evidence_id             UUID NOT NULL REFERENCES evidences(id) ON DELETE CASCADE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(requirement_assessment_id, evidence_id)
);

-- M2M: evidence ↔ audit_test (dowody z testów audytowych)
CREATE TABLE audit_test_evidences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_test_id       UUID NOT NULL,                   -- FK dodana po utworzeniu audit_tests
    evidence_id         UUID NOT NULL REFERENCES evidences(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(audit_test_id, evidence_id)
);
```

UWAGA: Sprawdź czy tabela evidences już istnieje w systemie. Jeśli tak — rozszerzaj.

### 4.5. assessment_history — Audit trail zmian ocen

```sql
CREATE TABLE assessment_history (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_assessment_id UUID NOT NULL REFERENCES requirement_assessments(id) ON DELETE CASCADE,
    
    -- What changed
    field_name              VARCHAR(50) NOT NULL,          -- 'result', 'score', 'maturity_level', 'notes'
    old_value               TEXT,
    new_value               TEXT,
    
    -- Context
    change_reason           VARCHAR(20),                   -- 'manual' | 'audit' | 'import' | 'ai_suggestion_accepted'
    change_source           VARCHAR(200),                  -- np. "Audit engagement AE-2025-003"
    
    -- Who & when
    changed_by              UUID REFERENCES users(id),
    changed_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ah_assessment ON assessment_history(requirement_assessment_id);
CREATE INDEX idx_ah_date ON assessment_history(changed_at);
```

---

## 5. Model danych — Audit Workflow

### 5.1. audit_programs — Program roczny audytów

```sql
CREATE TABLE audit_programs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(300) NOT NULL,           -- "Program Audytów IT 2025"
    year                INTEGER NOT NULL,                -- 2025
    description         TEXT,
    
    -- Approval
    status              VARCHAR(20) DEFAULT 'draft',     
                        -- 'draft' | 'submitted' | 'approved' | 'active' | 'completed' | 'archived'
    prepared_by         UUID REFERENCES users(id),       -- kto przygotował
    approved_by         UUID REFERENCES users(id),       -- kto zatwierdził (CAE / Komitet Audytu)
    approved_at         TIMESTAMPTZ,
    
    -- Scope
    org_unit_id         UUID REFERENCES org_units(id),   -- NULL = cała organizacja
    
    -- Metadata
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ap_year ON audit_programs(year);
```

### 5.2. audit_engagements — Zadania audytowe

```sql
CREATE TABLE audit_engagements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_program_id    UUID REFERENCES audit_programs(id),  -- NULL = ad-hoc audit (poza programem)
    ref_id              VARCHAR(20) NOT NULL,                 -- "AE-2025-001"
    name                VARCHAR(300) NOT NULL,                -- "Audyt ISO 27001 — Dział IT"
    
    -- What we audit
    framework_id        UUID NOT NULL REFERENCES frameworks(id),
    compliance_assessment_id UUID REFERENCES compliance_assessments(id), -- powiązana continuous assessment
    
    -- Scope
    scope_type          VARCHAR(20) NOT NULL DEFAULT 'organization',
    scope_id            UUID,
    scope_name          VARCHAR(300),
    
    -- Planning
    objective           TEXT NOT NULL,                        -- cel audytu
    methodology         TEXT,                                 -- opis metodyki
    criteria            TEXT,                                 -- kryteria audytu
    
    -- Schedule
    planned_quarter     INTEGER,                              -- 1, 2, 3, 4
    planned_month       INTEGER,                              -- 1-12
    planned_start       DATE,
    planned_end         DATE,
    actual_start        DATE,
    actual_end          DATE,
    
    -- Team
    lead_auditor_id     UUID NOT NULL REFERENCES users(id),
    supervisor_id       UUID REFERENCES users(id),           -- reviewer (quality assurance)
    
    -- Lifecycle status (state machine)
    status              VARCHAR(20) DEFAULT 'planned',
                        -- 'planned' → 'scoping' → 'fieldwork' → 'reporting' → 'review' → 'completed' → 'closed'
                        -- Alt: 'cancelled'
    status_changed_at   TIMESTAMPTZ,
    
    -- Priority & risk
    priority            VARCHAR(10) DEFAULT 'medium',        -- 'critical' | 'high' | 'medium' | 'low'
    risk_rating         VARCHAR(10),                         -- risk-based priorytetyzacja
    
    -- Metadata
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- M2M: engagement ↔ audytorzy (zespół audytowy)
CREATE TABLE audit_engagement_auditors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_engagement_id UUID NOT NULL REFERENCES audit_engagements(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    role                VARCHAR(20) DEFAULT 'auditor',    -- 'lead' | 'auditor' | 'observer' | 'specialist'
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(audit_engagement_id, user_id)
);

-- M2M: engagement ↔ requirement_nodes (zakres audytu — które wymagania audytujemy)
CREATE TABLE audit_engagement_scope (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_engagement_id UUID NOT NULL REFERENCES audit_engagements(id) ON DELETE CASCADE,
    requirement_node_id UUID NOT NULL REFERENCES requirement_nodes(id),
    in_scope            BOOLEAN DEFAULT TRUE,             -- audytor może wykluczyć poszczególne wymagania
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(audit_engagement_id, requirement_node_id)
);

CREATE INDEX idx_ae_program ON audit_engagements(audit_program_id);
CREATE INDEX idx_ae_framework ON audit_engagements(framework_id);
CREATE INDEX idx_ae_status ON audit_engagements(status);
CREATE INDEX idx_ae_lead ON audit_engagements(lead_auditor_id);
```

### 5.3. audit_tests — Testy audytowe

```sql
CREATE TABLE audit_tests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_engagement_id     UUID NOT NULL REFERENCES audit_engagements(id) ON DELETE CASCADE,
    test_template_id        UUID,                            -- FK do test_templates (opcjonalnie)
    requirement_node_id     UUID REFERENCES requirement_nodes(id),
    
    -- Test definition
    ref_id                  VARCHAR(20),                     -- "T-001" w obrębie engagement
    name                    VARCHAR(300) NOT NULL,
    description             TEXT,                            -- co testujemy
    test_steps              TEXT,                            -- szczegółowe kroki
    expected_result         TEXT,                            -- czego oczekujemy
    
    -- Test type
    test_type               VARCHAR(20) DEFAULT 'design',    
                            -- 'design' = czy kontrola jest zaprojektowana
                            -- 'operating' = czy działa w praktyce
                            -- 'both' = design + operating
    
    -- Execution
    actual_result           TEXT,                            -- co faktycznie stwierdzono
    test_result             VARCHAR(20) DEFAULT 'not_tested',
                            -- 'pass' | 'fail' | 'partial' | 'not_tested' | 'inconclusive'
    auditor_id              UUID REFERENCES users(id),       -- kto wykonał
    tested_at               TIMESTAMPTZ,
    
    -- Workpaper
    workpaper_ref           VARCHAR(50),                     -- "WP-003" referencja do papierów roboczych
    workpaper_notes         TEXT,                            -- notatki z pracy
    
    -- Sampling
    sample_size             INTEGER,                         -- wielkość próbki
    sample_description      TEXT,                            -- opis próbki
    exceptions_count        INTEGER DEFAULT 0,               -- ilość wyjątków/błędów w próbce
    
    -- Metadata
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Dodaj FK do audit_test_evidences
ALTER TABLE audit_test_evidences 
    ADD CONSTRAINT fk_ate_audit_test FOREIGN KEY (audit_test_id) REFERENCES audit_tests(id) ON DELETE CASCADE;

CREATE INDEX idx_at_engagement ON audit_tests(audit_engagement_id);
CREATE INDEX idx_at_requirement ON audit_tests(requirement_node_id);
CREATE INDEX idx_at_result ON audit_tests(test_result);
```

### 5.4. audit_findings — Ustalenia audytowe (format IIA)

```sql
CREATE TABLE audit_findings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_engagement_id     UUID NOT NULL REFERENCES audit_engagements(id) ON DELETE CASCADE,
    ref_id                  VARCHAR(20) NOT NULL,            -- "F-2025-001"
    title                   VARCHAR(500) NOT NULL,
    
    -- IIA Finding Format (4 elements)
    condition               TEXT NOT NULL,                   -- STAN FAKTYCZNY: co jest (co stwierdzono)
    criteria                TEXT NOT NULL,                   -- KRYTERIUM: co powinno być (wymaganie)
    cause                   TEXT,                            -- PRZYCZYNA: dlaczego tak jest
    effect                  TEXT,                            -- SKUTEK/RYZYKO: jakie konsekwencje
    
    -- Auditor's assessment
    severity                VARCHAR(10) NOT NULL DEFAULT 'medium',
                            -- 'critical' | 'high' | 'medium' | 'low' | 'informational'
    recommendation          TEXT,                            -- rekomendacja audytora
    
    -- Management response
    management_response     TEXT,                            -- odpowiedź kierownictwa
    management_response_by  UUID REFERENCES users(id),
    management_response_at  TIMESTAMPTZ,
    agreed                  BOOLEAN,                         -- czy kierownictwo się zgadza
    
    -- Lifecycle
    status                  VARCHAR(20) DEFAULT 'draft',
                            -- 'draft' | 'open' | 'acknowledged' | 'in_remediation' | 
                            -- 'remediated' | 'verified' | 'closed'
    status_changed_at       TIMESTAMPTZ,
    
    -- Dates
    target_date             DATE,                            -- planowany termin usunięcia
    actual_close_date       DATE,                            -- faktyczna data zamknięcia
    
    -- Verification
    verified_by             UUID REFERENCES users(id),       -- kto zweryfikował usunięcie
    verified_at             TIMESTAMPTZ,
    verification_notes      TEXT,
    
    -- AI metadata
    ai_generated            BOOLEAN DEFAULT FALSE,           -- czy wygenerowane przez AI
    ai_accepted             BOOLEAN,                         -- NULL = pending, TRUE = zaakceptowane
    
    -- Metadata
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- M2M: finding ↔ requirement_nodes (jakie wymagania dotyka ustalenie)
CREATE TABLE audit_finding_requirements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_finding_id    UUID NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
    requirement_node_id UUID NOT NULL REFERENCES requirement_nodes(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(audit_finding_id, requirement_node_id)
);

-- M2M: finding ↔ audit_tests (jakie testy wykazały problem)
CREATE TABLE audit_finding_tests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_finding_id    UUID NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
    audit_test_id       UUID NOT NULL REFERENCES audit_tests(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(audit_finding_id, audit_test_id)
);

-- M2M: finding ↔ actions (powiązanie z modułem Działań)
CREATE TABLE audit_finding_actions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_finding_id    UUID NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
    action_id           UUID NOT NULL,                    -- FK do tabeli actions (sprawdź rzeczywistą nazwę!)
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(audit_finding_id, action_id)
);

CREATE INDEX idx_af_engagement ON audit_findings(audit_engagement_id);
CREATE INDEX idx_af_severity ON audit_findings(severity);
CREATE INDEX idx_af_status ON audit_findings(status);
```

### 5.5. audit_reports — Raporty audytowe

```sql
CREATE TABLE audit_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_engagement_id     UUID NOT NULL REFERENCES audit_engagements(id),
    
    -- Report content
    report_type             VARCHAR(10) DEFAULT 'draft',    -- 'draft' | 'final'
    version                 INTEGER DEFAULT 1,              -- numer wersji raportu
    
    -- Sections
    executive_summary       TEXT,
    scope_description       TEXT,
    methodology_description TEXT,
    findings_summary        TEXT,
    conclusion              TEXT,
    
    -- Opinion
    opinion                 VARCHAR(20),                    
                            -- 'positive' | 'qualified' | 'adverse' | 'disclaimer' | null
    opinion_rationale       TEXT,
    
    -- Workflow
    prepared_by             UUID REFERENCES users(id),
    prepared_at             TIMESTAMPTZ,
    reviewed_by             UUID REFERENCES users(id),      -- supervisory review
    reviewed_at             TIMESTAMPTZ,
    review_notes            TEXT,
    approved_by             UUID REFERENCES users(id),      -- CAE approval
    approved_at             TIMESTAMPTZ,
    
    -- Distribution
    distributed             BOOLEAN DEFAULT FALSE,
    distributed_at          TIMESTAMPTZ,
    distribution_list       JSONB DEFAULT '[]',             -- ["user_id_1", "user_id_2"]
    
    -- Generated files
    pdf_file_path           VARCHAR(500),                   -- ścieżka do wygenerowanego PDF
    docx_file_path          VARCHAR(500),                   -- ścieżka do wygenerowanego DOCX
    
    -- Metadata
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Attachments to report
CREATE TABLE audit_report_attachments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_report_id     UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
    evidence_id         UUID NOT NULL REFERENCES evidences(id),
    attachment_type     VARCHAR(20) DEFAULT 'appendix',   -- 'appendix' | 'supporting'
    display_order       INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(audit_report_id, evidence_id)
);
```

### 5.6. State Machine — Audit Engagement Lifecycle

```
    ┌─────────┐      ┌─────────┐      ┌───────────┐      ┌───────────┐      ┌────────┐      ┌───────────┐      ┌────────┐
    │ planned │─────>│ scoping │─────>│ fieldwork │─────>│ reporting │─────>│ review │─────>│ completed │─────>│ closed │
    └─────────┘      └─────────┘      └───────────┘      └───────────┘      └────────┘      └───────────┘      └────────┘
         │                                    │
         │                                    │
         └──────────────┐                     │
                        ▼                     ▼
                   ┌───────────┐        ┌───────────┐
                   │ cancelled │        │ cancelled │
                   └───────────┘        └───────────┘
```

**Reguły przejść:**

| Z | Do | Warunek | Kto może |
|---|-----|---------|----------|
| planned | scoping | Przypisany lead auditor + zatwierdzony program | Lead auditor |
| scoping | fieldwork | Scope zdefiniowany (wymagania in_scope) | Lead auditor |
| fieldwork | reporting | Min. 1 test wykonany | Lead auditor |
| reporting | review | Report draft utworzony | Lead auditor |
| review | completed | Report reviewed (supervisor) | Supervisor |
| completed | closed | Wszystkie findings mają status ≥ 'acknowledged' | CAE / Lead |
| * | cancelled | — | Lead auditor / CAE |

---

## 6. Model danych — Framework Mapping

### 6.1. framework_mappings — Mapowanie wymagań między frameworkami

```sql
CREATE TABLE framework_mappings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source
    source_framework_id     UUID NOT NULL REFERENCES frameworks(id),
    source_requirement_id   UUID NOT NULL REFERENCES requirement_nodes(id),
    
    -- Target
    target_framework_id     UUID NOT NULL REFERENCES frameworks(id),
    target_requirement_id   UUID NOT NULL REFERENCES requirement_nodes(id),
    
    -- Mapping details
    relationship_type       VARCHAR(20) NOT NULL DEFAULT 'related',
                            -- 'equal' = semantycznie identyczne
                            -- 'subset' = source jest podzbiorem target
                            -- 'superset' = source jest nadzbiorem target
                            -- 'intersect' = częściowe pokrycie
                            -- 'related' = luźno powiązane
    strength                VARCHAR(10) DEFAULT 'moderate',
                            -- 'strong' | 'moderate' | 'weak'
    rationale               TEXT,                            -- uzasadnienie mapowania
    
    -- Source of mapping
    mapping_source          VARCHAR(20) DEFAULT 'manual',    
                            -- 'manual' | 'imported_ciso' | 'imported_scf' | 'imported_olir' | 'ai_suggested'
    
    -- Human review
    mapping_status          VARCHAR(20) DEFAULT 'confirmed',
                            -- 'draft' | 'confirmed' | 'rejected' | 'ai_pending_review'
    confirmed_by            UUID REFERENCES users(id),
    confirmed_at            TIMESTAMPTZ,
    
    -- Metadata
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicates
    UNIQUE(source_requirement_id, target_requirement_id)
);

CREATE INDEX idx_fm_source ON framework_mappings(source_framework_id, source_requirement_id);
CREATE INDEX idx_fm_target ON framework_mappings(target_framework_id, target_requirement_id);
CREATE INDEX idx_fm_status ON framework_mappings(mapping_status);
```

### 6.2. Coverage Analysis — jak obliczamy pokrycie

**Algorytm rule-based (bez AI):**

Dla frameworka A (oceniony) i frameworka B (docelowy):

```python
def calculate_coverage(framework_a_assessment, framework_b_id, mappings):
    """
    Oblicza ile wymagań frameworka B jest pokrytych przez ocenę frameworka A.
    """
    # 1. Pobierz wszystkie assessable wymagania frameworka B
    b_requirements = get_assessable_requirements(framework_b_id)
    
    # 2. Dla każdego wymagania B, znajdź mapowania na A
    coverage = {}
    for b_req in b_requirements:
        mapped = get_mappings_to_a(b_req.id, framework_a_assessment.framework_id)
        
        if not mapped:
            coverage[b_req.id] = {
                'status': 'no_coverage',      # brak mapowania — trzeba ocenić osobno
                'coverage_score': 0
            }
        else:
            # 3. Sprawdź oceny zmapowanych wymagań w assessment A
            a_assessments = get_assessments_for_requirements(
                framework_a_assessment.id, 
                [m.source_requirement_id for m in mapped]
            )
            
            # 4. Oblicz coverage score na bazie result + strength mapowania
            score = calculate_requirement_coverage(a_assessments, mapped)
            
            if score >= 80:
                status = 'fully_covered'
            elif score >= 40:
                status = 'partially_covered'
            else:
                status = 'weakly_covered'
                
            coverage[b_req.id] = {
                'status': status,
                'coverage_score': score,
                'mapped_from': [m.source_requirement_id for m in mapped],
                'gap_description': generate_gap_description(a_assessments, mapped)
            }
    
    # 5. Podsumowanie
    total = len(b_requirements)
    fully = sum(1 for c in coverage.values() if c['status'] == 'fully_covered')
    partially = sum(1 for c in coverage.values() if c['status'] == 'partially_covered')
    no_cov = sum(1 for c in coverage.values() if c['status'] == 'no_coverage')
    
    return {
        'total_requirements': total,
        'fully_covered': fully,
        'partially_covered': partially,
        'no_coverage': no_cov,
        'coverage_percent': round((fully + partially * 0.5) / total * 100, 1),
        'details': coverage
    }
```

---

## 7. Model danych — Katalog testów audytowych

### 7.1. test_templates — Szablony testów (reużywalne)

```sql
CREATE TABLE test_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_id              VARCHAR(20),                     -- "TT-001"
    name                VARCHAR(300) NOT NULL,           -- "Weryfikacja polityki haseł"
    description         TEXT,
    
    -- Test procedure
    test_steps          JSONB NOT NULL DEFAULT '[]',     -- ["1. Uzyskaj...", "2. Sprawdź..."]
    expected_evidence   JSONB DEFAULT '[]',              -- ["Polityka haseł", "Screenshot AD"]
    success_criteria    TEXT,                            -- co oznacza "pass"
    failure_criteria    TEXT,                            -- co oznacza "fail"
    
    -- Classification
    test_type           VARCHAR(20) DEFAULT 'both',      -- 'design' | 'operating' | 'both'
    category            VARCHAR(30),                     -- 'technical' | 'organizational' | 'legal' | 'physical'
    difficulty          VARCHAR(15) DEFAULT 'basic',     -- 'basic' | 'intermediate' | 'advanced'
    estimated_hours     DECIMAL(4,1),                    -- szacowany czas realizacji
    
    -- Tags for search
    tags                JSONB DEFAULT '[]',              -- ["identity", "access_control", "passwords"]
    
    -- Metadata
    is_system           BOOLEAN DEFAULT FALSE,           -- seed data
    is_active           BOOLEAN DEFAULT TRUE,
    org_unit_id         UUID REFERENCES org_units(id),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- M2M: test_template ↔ requirement_nodes (jakie wymagania ten test pokrywa)
CREATE TABLE test_template_requirements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_template_id    UUID NOT NULL REFERENCES test_templates(id) ON DELETE CASCADE,
    requirement_node_id UUID NOT NULL REFERENCES requirement_nodes(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(test_template_id, requirement_node_id)
);

CREATE INDEX idx_tt_category ON test_templates(category);
CREATE INDEX idx_tt_active ON test_templates(is_active);
```

**Kluczowa cecha:** Jeden test template może być powiązany z wymaganiami z WIELU frameworków. Np. test "Weryfikacja polityki haseł" pokrywa ISO 27001 A.5.17, NIS2 Art.21.2.j, CIS CSC 5.2 jednocześnie.

---

## 8. Model danych — Nowe obiekty scope

### 8.1. services — Usługi / Produkty

```sql
CREATE TABLE services (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(300) NOT NULL,
    description         TEXT,
    service_type        VARCHAR(20) NOT NULL DEFAULT 'service',
                        -- 'product' | 'service' | 'system' | 'application'
    owner_id            UUID REFERENCES users(id),
    org_unit_id         UUID REFERENCES org_units(id),
    
    -- Classification
    criticality         VARCHAR(10) DEFAULT 'medium',    -- 'critical' | 'high' | 'medium' | 'low'
    data_classification VARCHAR(20) DEFAULT 'internal',  -- 'public' | 'internal' | 'confidential' | 'restricted'
    
    -- Status
    status              VARCHAR(20) DEFAULT 'active',    -- 'active' | 'decommissioned' | 'planned' | 'under_review'
    
    -- Metadata
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- M2M: service ↔ assets (jakie zasoby IT obsługują usługę)
CREATE TABLE service_assets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id          UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    asset_id            UUID NOT NULL,                   -- FK do tabeli assets (sprawdź nazwę!)
    relationship_type   VARCHAR(20) DEFAULT 'supports',  -- 'supports' | 'hosts' | 'depends_on'
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(service_id, asset_id)
);
```

### 8.2. business_processes — Procesy biznesowe

```sql
CREATE TABLE business_processes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(300) NOT NULL,
    description         TEXT,
    process_type        VARCHAR(20) DEFAULT 'operational',
                        -- 'strategic' | 'operational' | 'support'
    owner_id            UUID REFERENCES users(id),
    org_unit_id         UUID REFERENCES org_units(id),
    
    -- Classification
    criticality         VARCHAR(10) DEFAULT 'medium',
    
    -- Status
    status              VARCHAR(20) DEFAULT 'active',
    
    -- Metadata
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- M2M: process ↔ services (jakie usługi wspierają proces)
CREATE TABLE process_services (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_process_id UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
    service_id          UUID NOT NULL REFERENCES services(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(business_process_id, service_id)
);
```

---

## 9. Silnik pokrycia i analizy luk (rule-based)

### 9.1. Funkcje silnika (WSZYSTKIE bez AI)

```python
class ComplianceCoverageEngine:
    """
    Silnik analizy pokrycia — działa w 100% bez AI.
    Nigdy nie wywołuje AI Service.
    """
    
    def calculate_assessment_score(self, assessment_id: UUID) -> dict:
        """
        Oblicza agregatowy score assessment'u na bazie requirement_assessments.
        Zwraca: compliance_score %, counters per status.
        """
        
    def calculate_cross_framework_coverage(
        self, 
        source_assessment_id: UUID, 
        target_framework_id: UUID
    ) -> CoverageReport:
        """
        Ile wymagań target_framework jest pokrytych przez source_assessment?
        Wykorzystuje framework_mappings.
        Zwraca: fully_covered, partially_covered, no_coverage, coverage_percent, details per requirement.
        """
    
    def find_unmapped_requirements(
        self, 
        framework_a_id: UUID, 
        framework_b_id: UUID
    ) -> list:
        """
        Wymagania frameworka B które nie mają żadnego mapowania na framework A.
        Zwraca listę requirement_nodes bez pokrycia.
        """
    
    def calculate_audit_coverage(self, engagement_id: UUID) -> dict:
        """
        Jaki % wymagań w scope audytu został przetestowany?
        Ile testów pass/fail/not_tested?
        """
    
    def suggest_tests_for_requirement(self, requirement_node_id: UUID) -> list:
        """
        Na bazie test_template_requirements, zwraca pasujące szablony testów.
        """
    
    def suggest_tests_for_engagement(self, engagement_id: UUID) -> list:
        """
        Dla wszystkich wymagań in_scope, sugeruje test templates z katalogu.
        """
    
    def calculate_finding_stats(self, engagement_id: UUID) -> dict:
        """
        Statystyki ustaleń per severity, status.
        """
    
    def calculate_org_compliance_dashboard(
        self, 
        org_unit_id: UUID = None
    ) -> dict:
        """
        Zagregowany dashboard: ile frameworków, jaki % compliance per framework,
        ile open findings, ile overdue actions.
        """
    
    def get_requirement_assessment_with_controls(
        self, 
        requirement_assessment_id: UUID
    ) -> dict:
        """
        Ocena wymagania + powiązane applied_controls ze Smart Catalog.
        Audytor widzi: wymaganie + jakie kontrole są wdrożone.
        """
    
    def track_compliance_trend(
        self,
        assessment_id: UUID,
        period: str = 'monthly'  # 'weekly' | 'monthly' | 'quarterly'
    ) -> list:
        """
        Historia compliance_score w czasie na bazie assessment_history.
        Rule-based: agreguje historyczne zmiany.
        """
```

### 9.2. Automatyczne przeliczanie scores

Scores w `compliance_assessments` są przeliczane automatycznie przy każdej zmianie `requirement_assessment`:

```python
def recalculate_assessment_scores(assessment_id: UUID):
    """
    Trigger po INSERT/UPDATE na requirement_assessments.
    """
    assessments = RequirementAssessment.objects.filter(
        compliance_assessment_id=assessment_id,
        selected=True,  # tylko wymagania w scope
        requirement_node__assessable=True  # tylko ocenialne
    )
    
    total = assessments.count()
    assessed = assessments.exclude(result='not_assessed').count()
    compliant = assessments.filter(result='compliant').count()
    partial = assessments.filter(result='partially_compliant').count()
    non_compliant = assessments.filter(result='non_compliant').count()
    na = assessments.filter(result='not_applicable').count()
    
    assessable_total = total - na  # not_applicable nie liczy się do %
    
    if assessable_total > 0:
        score = round(
            (compliant + partial * 0.5) / assessable_total * 100, 2
        )
    else:
        score = None
    
    ComplianceAssessment.objects.filter(id=assessment_id).update(
        compliance_score=score,
        total_requirements=total,
        assessed_count=assessed,
        compliant_count=compliant,
        partially_count=partial,
        non_compliant_count=non_compliant,
        not_applicable_count=na,
        updated_at=now()
    )
```

---

## 10. AI jako opcjonalny plugin — 8 use case'ów

### 10.1. Zasada działania

Identycznie jak w Smart Catalog v2:

- AI korzysta z TEGO SAMEGO `ai_provider_config` — jeden config, jeden adapter
- Feature toggles dodane do istniejącej tabeli (ALTER TABLE)
- AI Service sprawdza `is_available` i `_require_feature()` przed każdym wywołaniem
- Frontend: `{aiEnabled && aiFeatures.framework_mapping && <AIMapButton />}`
- Gdy AI off: ZERO elementów AI w UI. System kompletny i funkcjonalny.

### 10.2. Rozszerzenie ai_provider_config

```sql
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_framework_mapping    BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_test_generation      BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_gap_analysis_ai      BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_finding_formulation  BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_report_summary       BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_trend_analysis       BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_requirement_classify BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_translation          BOOLEAN DEFAULT TRUE;
```

### 10.3. Rozszerzenie GET /api/v1/config/features

```json
{
  "ai_enabled": true,
  "ai_features": {
    "scenario_generation": true,
    "correlation_enrichment": true,
    "natural_language_search": true,
    "gap_analysis": true,
    "entry_assist": true,
    
    "framework_mapping": true,
    "test_generation": true,
    "gap_analysis_ai": true,
    "finding_formulation": true,
    "report_summary": true,
    "trend_analysis": true,
    "requirement_classify": true,
    "translation": true
  }
}
```

### 10.4. MUST HAVE AI Use Cases (4 core)

#### UC-CA-1: AI Framework Mapping

**Trigger:** Przycisk "Zasugeruj mapowania AI" na stronie framework mapping  
**Feature toggle:** `feature_framework_mapping`  
**Input:** Wymagania z frameworka A + wymagania z frameworka B (z kontekstem rodzic/dziadek)  
**Process:**
1. Buduje kontekst per wymaganie: ref_id + name + description + parent.name + grandparent.name
2. Wysyła pary do AI z instrukcją: porównaj semantycznie, zwróć relationship_type, strength, rationale
3. Przetwarza batch (np. 20 wymagań na raz)
4. Zapisuje jako `framework_mappings` z `mapping_source='ai_suggested'`, `mapping_status='ai_pending_review'`

**Output:** Lista sugerowanych mapowań do review  
**Human-in-the-loop:** Każde mapowanie wymaga potwierdzenia/odrzucenia  

**Prompt template (szkic):**
```
You are an expert in cybersecurity compliance and regulatory frameworks.
Compare the following requirement from {framework_a.name} with requirements from {framework_b.name}.
For each match, provide:
- target_requirement_ref_id
- relationship_type: equal | subset | superset | intersect | related
- strength: strong | moderate | weak
- rationale: 1-2 sentence explanation

Source requirement:
- Ref: {req.ref_id}
- Name: {req.name}
- Description: {req.description}
- Context: {parent.name} > {grandparent.name}

Target requirements:
{list of target requirements with ref_id, name, description}

Respond in JSON array format.
```

#### UC-CA-2: AI Test Generation

**Trigger:** Przycisk "Wygeneruj test AI" przy wymaganiu (w engagement fieldwork)  
**Feature toggle:** `feature_test_generation`  
**Input:** Treść wymagania + kontekst organizacyjny (scope, branża) + istniejące kontrole  
**Output:** Draft test_steps, expected_evidence, success_criteria  
**Human-in-the-loop:** Audytor modyfikuje i zatwierdza  

#### UC-CA-3: AI Cross-Framework Gap Analysis

**Trigger:** Przycisk "AI Gap Analysis" na dashboardzie pokrycia  
**Feature toggle:** `feature_gap_analysis_ai`  
**Input:** Wyniki `calculate_cross_framework_coverage()` + kontekst organizacji  
**Output:** Priorytetyzowana lista luk z:
- Dlaczego ta luka jest krytyczna
- Szacowany nakład pracy na pokrycie
- Sugerowana kolejność adresowania
- Powiązanie z ryzykami organizacyjnymi  
**Human-in-the-loop:** Draft → review  

#### UC-CA-4: AI Finding Formulation

**Trigger:** Przycisk "Sformułuj ustalenie AI" po test result = fail  
**Feature toggle:** `feature_finding_formulation`  
**Input:** Wyniki failed testów + treść wymagania + kontekst engagement  
**Output:** Draft ustalenia w formacie IIA:
- condition (stan faktyczny)
- criteria (kryterium/wymaganie)
- cause (prawdopodobna przyczyna)
- effect (skutek/ryzyko)
- severity suggestion
- recommendation draft  
**Human-in-the-loop:** Audytor finalizuje treść  

### 10.5. NICE-TO-HAVE AI Use Cases (4 dodatkowe)

#### UC-CA-5: AI Report Summary

**Trigger:** Przycisk "Generuj podsumowanie AI" w raporcie audytowym  
**Feature toggle:** `feature_report_summary`  
**Input:** Wszystkie findings, test results, assessment scores  
**Output:** Draft executive_summary + conclusion + opinion suggestion  

#### UC-CA-6: AI Trend Analysis

**Trigger:** Przycisk "Analiza trendów AI" w dashboardzie  
**Feature toggle:** `feature_trend_analysis`  
**Input:** Historyczne dane compliance_score + assessment_history  
**Output:** Narracyjna analiza: co się poprawiło, co pogorszyło, dlaczego, co rekomendować  

#### UC-CA-7: AI Requirement Classification

**Trigger:** Przycisk "Sklasyfikuj AI" przy imporcie nowego frameworka  
**Feature toggle:** `feature_requirement_classify`  
**Input:** Treść wymagań nowo-importowanego frameworka  
**Output:** Sugestie: cia_impact, category, tags dla każdego wymagania  

#### UC-CA-8: AI Translation

**Trigger:** Przycisk "Przetłumacz AI" przy frameworku / wymaganiu  
**Feature toggle:** `feature_translation`  
**Input:** Treść wymagania (name + description) + target locale  
**Output:** Tłumaczenie zapisane w `requirement_translations` z `source='ai_translated'`  
**Human-in-the-loop:** Wymaga `confirmed_by` przed oficjalnym użyciem  

### 10.6. AI Security (identycznie jak Smart Catalog)

| Wymóg | Implementacja |
|-------|---------------|
| Dane wrażliwe | Context builder sanityzuje PII przed wysyłką do API |
| Human-in-the-loop | Każdy output AI = DRAFT/PENDING, wymaga zatwierdzenia |
| Audit trail | ai_audit_log (ta sama tabela co Smart Catalog) |
| Kill-switch | Admin dezaktywuje jednym kliknięciem |
| Rate limiting | Te same limity co Smart Catalog (20/h, 100/d user, 500/d org) |
| No vendor lock-in | Ten sam adapter pattern |

---

## 11. Integracja z istniejącymi modułami

### 11.1. Smart Catalog (T↔W↔C) → Compliance Assessment

```
control_catalog.id ←→ applied_controls.reference_control_id
                           ↓
              requirement_assessment_controls
                           ↓
              requirement_assessments (ocena wymagania)
```

**Scenariusz:** Audytor ocenia wymaganie ISO 27001 A.5.17 "Authentication information". System automatycznie pokazuje:
- "Kontrola CTRL-ACC-005 'Password Policy' jest wdrożona (applied_control status: implemented)"
- "Kontrola CTRL-ACC-007 'MFA for privileged' jest wdrożona (status: implemented)"
- Na tej podstawie audytor ocenia wymaganie jako 'compliant'

### 11.2. Moduł Działań (Actions)

```
audit_findings → audit_finding_actions → actions (istniejący moduł)
```

**Scenariusz:** Audytor tworzy finding "F-2025-003: Brak MFA dla adminów". Definiuje action:
- Akcja: "Wdrożenie MFA dla kont administracyjnych"
- Odpowiedzialny: Jan Kowalski (IT Security)
- Termin: 2025-06-30
- Status: open → in_progress → completed → verified

UWAGA: Sprawdź rzeczywistą nazwę i strukturę tabeli actions w kodzie.

### 11.3. Risk Scenarios

```
requirement_assessment (non_compliant) → risk_scenario (sugestia)
```

**Scenariusz:** Wymaganie NIS2 Art.21.2.a ocenione jako 'non_compliant'. System (rule-based) sugeruje:
- "Rozważ dodanie scenariusza ryzyka: Brak odpowiednich polityk bezpieczeństwa (zagrożenie T-ORG-001 z Smart Catalog)"

### 11.4. Assets → Services → Scope

```
business_processes → process_services → services → service_assets → assets
                                           ↓
                              compliance_assessments (scope_type='service')
                              audit_engagements (scope_type='service')
```

---

## 12. Import frameworków — źródła i parsery

### 12.1. CISO Assistant YAML (priorytet #1)

**Źródło:** github.com/intuitem/ciso-assistant-community/backend/library/libraries/  
**Format:** YAML z hierarchią requirement_nodes  
**Zawartość:** 100+ frameworków: ISO 27001, NIST CSF 2.0, NIS2, DORA, GDPR, CIS, SOC2, PCI DSS i wiele więcej  

**Parser:**
```python
def import_ciso_assistant_yaml(file_path: str, org_unit_id: UUID = None) -> Framework:
    """
    Parsuje YAML w formacie CISO Assistant i tworzy Framework + RequirementNodes.
    
    Format CISO Assistant YAML:
    urn: urn:intuitem:risk:library:iso27001-2022
    locale: en
    objects:
      framework:
        urn: urn:intuitem:risk:framework:iso27001-2022
        ref_id: ISO-27001-2022
        name: ISO/IEC 27001:2022
        requirement_nodes:
          - urn: urn:intuitem:risk:req_node:iso27001-2022:4
            ref_id: "4"
            name: "Context of the organization"
            assessable: false
            depth: 1
          - urn: urn:intuitem:risk:req_node:iso27001-2022:4.1
            ref_id: "4.1"
            parent_urn: urn:intuitem:risk:req_node:iso27001-2022:4
            name: "Understanding the organization..."
            assessable: true
            depth: 2
    """
    # 1. Parse YAML
    # 2. Create Framework
    # 3. Create RequirementNodes with parent resolution via URN
    # 4. Set source_type = 'ciso_assistant'
    # 5. Mark as is_system = True
```

**Import mapowań:**
```python
def import_ciso_assistant_mapping(file_path: str) -> int:
    """
    Parsuje mapping YAML z CISO Assistant.
    
    Format:
    mapping:
      - source_urn: urn:intuitem:risk:req_node:iso27001-2022:A.5.1
        target_urn: urn:intuitem:risk:req_node:nis2:art21.2.a
        relationship: intersect
        rationale: "Both address..."
    """
    # Resolve URNs to requirement_node IDs
    # Create framework_mappings with mapping_source = 'imported_ciso'
```

### 12.2. Excel/CSV (custom frameworks)

**Format:** Excel z kolumnami:
| ref_id | name | description | parent_ref_id | assessable | category | tags |
|--------|------|-------------|---------------|------------|----------|------|
| 1 | Governance | | | false | | |
| 1.1 | Security Policy | Must have... | 1 | true | governance | policy |
| 1.2 | Risk Management | Must perform... | 1 | true | governance | risk |

**Parser:**
```python
def import_excel_framework(file_path: str, framework_name: str, document_type: str) -> Framework:
    """
    Import z Excel/CSV. Hierarchy przez parent_ref_id.
    """
```

### 12.3. UI Editor (ręczne tworzenie)

Drag & drop builder w UI:
1. Utwórz framework (name, type, scoring_mode)
2. Dodawaj requirement_nodes z hierarchią (drag to reorder/nest)
3. Zaznacz assessable / non-assessable
4. Opcjonalnie: dodaj tagi, CIA, kategorie

---

## 13. API Endpoints

### 13.1. Framework Library — zawsze dostępne

```
# CRUD Frameworks
GET    /api/v1/frameworks                     # lista z filtrami: document_type, is_active, search
POST   /api/v1/frameworks                     # utwórz nowy framework
GET    /api/v1/frameworks/{id}                # szczegóły frameworka
PUT    /api/v1/frameworks/{id}                # edycja
DELETE /api/v1/frameworks/{id}                # usunięcie (soft delete)

# Requirement Nodes (hierarchia)
GET    /api/v1/frameworks/{id}/requirements    # drzewo wymagań (hierarchiczne)
POST   /api/v1/frameworks/{id}/requirements    # dodaj wymaganie
PUT    /api/v1/requirements/{id}               # edycja wymagania
DELETE /api/v1/requirements/{id}               # usunięcie

# Import
POST   /api/v1/frameworks/import/ciso-yaml     # import z CISO Assistant YAML
POST   /api/v1/frameworks/import/excel          # import z Excel/CSV
POST   /api/v1/frameworks/import/mapping        # import mapowań

# Translations
GET    /api/v1/requirements/{id}/translations
POST   /api/v1/requirements/{id}/translations
PUT    /api/v1/translations/{id}
```

### 13.2. Compliance Assessment — zawsze dostępne

```
# Assessment CRUD
GET    /api/v1/compliance-assessments           # lista z filtrami: framework_id, scope_type, status
POST   /api/v1/compliance-assessments           # utwórz assessment
GET    /api/v1/compliance-assessments/{id}      # szczegóły
PUT    /api/v1/compliance-assessments/{id}      # edycja
DELETE /api/v1/compliance-assessments/{id}      # usunięcie

# Requirement Assessments (oceny per wymaganie)
GET    /api/v1/compliance-assessments/{id}/requirements    # lista ocen wymagań
PUT    /api/v1/requirement-assessments/{id}                 # zmień ocenę wymagania
POST   /api/v1/requirement-assessments/{id}/evidence        # dodaj dowód
DELETE /api/v1/requirement-assessments/{id}/evidence/{eid}   # usuń dowód

# Scores & Dashboard
GET    /api/v1/compliance-assessments/{id}/score            # przeliczony score
GET    /api/v1/compliance-dashboard                          # zagregowany dashboard per org/unit
GET    /api/v1/compliance-assessments/{id}/trend             # trend w czasie
```

### 13.3. Framework Mapping — zawsze dostępne

```
GET    /api/v1/framework-mappings                # lista mapowań (filtr: source_framework, target_framework)
POST   /api/v1/framework-mappings                # utwórz mapowanie
PUT    /api/v1/framework-mappings/{id}           # edycja
DELETE /api/v1/framework-mappings/{id}           # usunięcie

# Coverage Analysis
GET    /api/v1/coverage/cross-framework          # ?source_assessment_id=X&target_framework_id=Y
GET    /api/v1/coverage/unmapped                 # ?framework_a=X&framework_b=Y
```

### 13.4. Audit Workflow — zawsze dostępne

```
# Audit Program
GET    /api/v1/audit-programs                    # lista
POST   /api/v1/audit-programs                    # utwórz
GET    /api/v1/audit-programs/{id}               # szczegóły
PUT    /api/v1/audit-programs/{id}               # edycja
POST   /api/v1/audit-programs/{id}/approve        # zatwierdź program

# Audit Engagements
GET    /api/v1/audit-engagements                  # lista (filtr: program_id, status, framework_id)
POST   /api/v1/audit-engagements                  # utwórz engagement
GET    /api/v1/audit-engagements/{id}             # szczegóły
PUT    /api/v1/audit-engagements/{id}             # edycja
POST   /api/v1/audit-engagements/{id}/transition   # zmień status (body: {target_status})

# Audit Tests
GET    /api/v1/audit-engagements/{id}/tests       # lista testów w engagement
POST   /api/v1/audit-engagements/{id}/tests       # dodaj test
PUT    /api/v1/audit-tests/{id}                    # edycja testu (wyniki, dowody)
DELETE /api/v1/audit-tests/{id}                    # usunięcie

# Audit Findings
GET    /api/v1/audit-engagements/{id}/findings    # lista ustaleń
POST   /api/v1/audit-engagements/{id}/findings    # utwórz ustalenie
PUT    /api/v1/audit-findings/{id}                 # edycja
POST   /api/v1/audit-findings/{id}/respond         # odpowiedź kierownictwa
POST   /api/v1/audit-findings/{id}/verify          # weryfikacja usunięcia

# Audit Reports
GET    /api/v1/audit-engagements/{id}/report      # aktualny raport
POST   /api/v1/audit-engagements/{id}/report      # utwórz/aktualizuj raport
POST   /api/v1/audit-reports/{id}/generate-pdf     # generuj PDF
POST   /api/v1/audit-reports/{id}/generate-docx    # generuj DOCX

# Test Templates
GET    /api/v1/test-templates                      # katalog (filtr: category, tags, framework_id)
POST   /api/v1/test-templates                      # utwórz
PUT    /api/v1/test-templates/{id}                 # edycja
GET    /api/v1/test-templates/suggest               # ?requirement_node_id=X → pasujące szablony
```

### 13.5. Nowe scope'y — zawsze dostępne

```
# Services
GET    /api/v1/services
POST   /api/v1/services
GET    /api/v1/services/{id}
PUT    /api/v1/services/{id}
DELETE /api/v1/services/{id}

# Business Processes
GET    /api/v1/business-processes
POST   /api/v1/business-processes
GET    /api/v1/business-processes/{id}
PUT    /api/v1/business-processes/{id}
DELETE /api/v1/business-processes/{id}
```

### 13.6. Feature Flags — rozszerzenie

```
GET /api/v1/config/features
```

Rozszerza istniejący endpoint o nowe feature toggles (patrz sekcja 10.3).

### 13.7. AI Endpoints — tylko gdy ai_enabled=TRUE

Każdy endpoint sprawdza: ai_enabled + specific feature toggle + rate limit.
Jeśli warunek niespełniony → HTTP 503.

```
POST   /api/v1/ai/suggest-mappings              # UC-CA-1: framework mapping suggestions
POST   /api/v1/ai/generate-test                  # UC-CA-2: test generation
POST   /api/v1/ai/gap-analysis-ai                # UC-CA-3: AI gap analysis
POST   /api/v1/ai/formulate-finding              # UC-CA-4: finding formulation
POST   /api/v1/ai/report-summary                 # UC-CA-5: report summary
POST   /api/v1/ai/trend-analysis                 # UC-CA-6: trend analysis
POST   /api/v1/ai/classify-requirements           # UC-CA-7: auto-classification
POST   /api/v1/ai/translate                       # UC-CA-8: translation
POST   /api/v1/ai/review                          # accept/reject AI suggestions (common)
```

---

## 14. Interfejs użytkownika

### 14.1. Nawigacja (nowa sekcja w menu)

```
📋 Compliance & Audit
├── 📚 Framework Library          # przeglądanie, import, tworzenie frameworków
├── 📊 Compliance Dashboard       # zagregowany widok: % per framework, trends
├── ✅ Assessments                 # lista compliance assessments
├── 🔗 Framework Mapping           # mapowanie + coverage analysis
├── 📋 Audit Program               # planowanie roczne
├── 🔍 Audit Engagements           # lista zadań audytowych
├── 📝 Findings & Actions          # ustalenia i powiązane działania
├── 📖 Test Template Catalog       # katalog testów reużywalnych
├── 🏢 Services                    # usługi / produkty
└── ⚙️ Business Processes          # procesy biznesowe
```

### 14.2. Framework Library — widok listy

```
┌─────────────────────────────────────────────────────────────────┐
│ 📚 Framework Library                           [+ New] [Import] │
│                                                                 │
│ Filters: [Type ▼] [Status ▼] [Search...          ]             │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 🏛️ ISO/IEC 27001:2022          Standard    93 req  Active │   │
│ │    Information Security Management System                  │   │
│ │    Scoring: maturity  |  Assessments: 3  |  Last: 87%     │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │ ⚖️ NIS2 (Directive 2022/2555)  Regulation  42 req  Active │   │
│ │    Network and Information Security Directive 2            │   │
│ │    Scoring: status  |  Assessments: 1  |  Last: 62%       │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │ 📜 Standard zabezpieczenia SI   Internal    28 req  Active │   │
│ │    Wewnętrzny standard bezpieczeństwa v3.1                 │   │
│ │    Scoring: score  |  Assessments: 5  |  Last: 71%        │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 14.3. Requirement Tree — widok drzewa wymagań z ocenami

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ISO/IEC 27001:2022 — IT Department (continuous)           Score: 87%   │
│                                                                         │
│ ▼ 5. Organizational controls                              [14/16 ✅]   │
│   ▼ 5.1 Policies for information security                              │
│     ├── [✅ Compliant] Maturity: Defined                                │
│     │   Controls: CTRL-GOV-001 (Polityka bezp.)                        │
│     │   Evidence: 📎 Polityka_v3.pdf  📎 Zarządzenie_2024.pdf          │
│     │   Last audited: 2024-11-15 by Anna Nowak                         │
│     │                                                                   │
│   ▼ 5.2 Information security roles                                      │
│     ├── [⚠️ Partial] Maturity: Managed                                  │
│     │   Controls: CTRL-GOV-002 (RACI matrix)                           │
│     │   Evidence: 📎 RACI_matrix.xlsx                                   │
│     │   Notes: "Brak formalnego przeglądu ról w Q3"                    │
│     │                                                     [Edit] [📝]   │
│     │                                                                   │
│   ▼ 5.3 Segregation of duties                                          │
│     ├── [❌ Non-compliant] Maturity: Initial                            │
│     │   Controls: (none)                                                │
│     │   Evidence: (none)                                                │
│     │   Notes: "Nie wdrożono SoD dla systemów krytycznych"             │
│     │                                         [Edit] [📝] [Create Action]│
│                                                                         │
│ ▼ 6. People controls                                      [8/8 ✅]     │
│   ...                                                                   │
│                                                                         │
│ ── gdy AI włączone: ──────────────────────────────────────────────────  │
│ [✨ Classify requirements AI] [✨ Translate to PL]                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 14.4. Audit Engagement Workspace

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔍 AE-2025-003: Audyt ISO 27001 — Dział IT                            │
│ Status: [■ Fieldwork]  Lead: Anna Nowak  Planned: Q2 2025              │
│                                                                         │
│ [Planning] [Scope] [■ Fieldwork] [Reporting] [Review]                  │
│                                                                         │
│ ── Fieldwork Tab ──────────────────────────────────────────────────────│
│                                                                         │
│ Requirements in scope: 42 | Tested: 28 | Pass: 22 | Fail: 4 | N/T: 14│
│ [Progress bar: ██████████████░░░░░░ 67%]                               │
│                                                                         │
│ ┌──────────────────────────────────────────────────────────┐           │
│ │ A.5.1 Policies for information security                   │           │
│ │ Current assessment: ✅ Compliant (continuous)              │           │
│ │                                                           │           │
│ │ Tests:                                                    │           │
│ │   T-001: Verify policy exists and is current   [✅ Pass]  │           │
│ │   T-002: Verify policy approval and review     [✅ Pass]  │           │
│ │                                                           │           │
│ │ Audit conclusion: ✅ Confirmed (compliant)                │           │
│ │ [Add Test] [Add Finding]                                  │           │
│ │                                                           │           │
│ │ ── gdy AI włączone: ──                                    │           │
│ │ [✨ Generate test AI] [✨ Formulate finding AI]            │           │
│ └──────────────────────────────────────────────────────────┘           │
│                                                                         │
│ ┌──────────────────────────────────────────────────────────┐           │
│ │ A.5.3 Segregation of duties                               │           │
│ │ Current assessment: ❌ Non-compliant (continuous)          │           │
│ │                                                           │           │
│ │ Tests:                                                    │           │
│ │   T-005: Verify SoD matrix exists              [❌ Fail]  │           │
│ │   T-006: Verify SoD enforcement in systems     [❌ Fail]  │           │
│ │                                                           │           │
│ │ Finding: F-2025-003 (High) — Brak SoD                    │           │
│ │ [View Finding] [Add Test]                                 │           │
│ └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 14.5. Cross-Framework Coverage Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔗 Framework Mapping: ISO 27001 → NIS2                                 │
│                                                                         │
│ Coverage: 78% of NIS2 covered by ISO 27001 assessment                  │
│                                                                         │
│ [██████████████████░░░░░] 78%                                          │
│                                                                         │
│ ✅ Fully covered: 26/42  ⚠️ Partially: 7/42  ❌ No coverage: 9/42      │
│                                                                         │
│ ── Requirements without coverage (need separate assessment) ──          │
│                                                                         │
│ │ Art.23 — Incident reporting to CSIRT              [❌ No mapping]     │
│ │ Art.24 — Use of European certification schemes    [❌ No mapping]     │
│ │ Art.25 — Standardisation                          [❌ No mapping]     │
│ │ ...                                                                   │
│                                                                         │
│ [Export gap report] [Create assessment for uncovered]                   │
│                                                                         │
│ ── gdy AI włączone: ──                                                  │
│ [✨ AI Gap Analysis] [✨ Suggest mappings AI]                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 14.6. Warunkowy rendering AI (identycznie jak Smart Catalog)

```javascript
const { aiEnabled, aiFeatures } = useFeatureFlags();

// NIGDY nie renderuj AI elementów gdy wyłączone
{aiEnabled && aiFeatures.framework_mapping && (
  <AIMappingSuggestButton />
)}

{aiEnabled && aiFeatures.test_generation && (
  <AITestGenerateButton />
)}

{aiEnabled && aiFeatures.finding_formulation && (
  <AIFindingDraftButton />
)}

// Gdy AI off: zero buttonów, zero ikon, zero wzmianek
```

---

## 15. Generowanie raportów

### 15.1. Szybki PDF (w systemie)

Generowany z danych w bazie → Markdown/HTML → PDF (wkhtmltopdf lub weasyprint).

**Zawartość:**
1. Strona tytułowa (nazwa engagement, scope, daty, zespół)
2. Executive summary
3. Scope & methodology
4. Summary of findings (tabela: ref, title, severity, status)
5. Detailed findings (per finding: condition, criteria, cause, effect, recommendation)
6. Management responses
7. Conclusion & opinion
8. Appendices

### 15.2. Profesjonalny DOCX (z szablonu)

Generowany z docx-js z firmowym templatem:
1. Admin uploaduje szablon DOCX (z placeholderami lub firmowym nagłówkiem/stopką)
2. System wypełnia sekcje danymi z audit_report + audit_findings
3. Użytkownik pobiera gotowy DOCX do dalszej edycji jeśli potrzeba

UWAGA: Wykorzystaj SKILL.md z /mnt/skills/public/docx/ i /mnt/skills/public/pdf/ do implementacji.

---

## 16. Sekwencja implementacji

### Faza CA-1: Fundament — Framework & Assessment (3 tygodnie)

| # | Zadanie | Zależność |
|---|---------|-----------|
| CA-1.0 | **ANALIZA istniejącego kodu** (modele, API, frontend) | — |
| CA-1.1 | Raport rozbieżności + propozycja adaptacji | CA-1.0 |
| CA-1.2 | Migration: tabela `frameworks` (lub ALTER TABLE) | CA-1.1 |
| CA-1.3 | Migration: tabela `requirement_nodes` | CA-1.2 |
| CA-1.4 | Migration: tabela `requirement_translations` | CA-1.3 |
| CA-1.5 | Migration: tabele `compliance_assessments`, `requirement_assessments` | CA-1.3 |
| CA-1.6 | Migration: tabele `evidences`, `requirement_assessment_evidences`, `requirement_assessment_controls` | CA-1.5 |
| CA-1.7 | Migration: tabela `assessment_history` (audit trail) | CA-1.5 |
| CA-1.8 | Migration: tabele `services`, `service_assets`, `business_processes`, `process_services` | CA-1.1 |
| CA-1.9 | Import: CISO Assistant YAML parser (frameworks + requirement_nodes) | CA-1.3 |
| CA-1.10 | Import: Excel/CSV parser | CA-1.3 |
| CA-1.11 | API CRUD: frameworks, requirement_nodes, translations | CA-1.3 |
| CA-1.12 | API CRUD: compliance_assessments, requirement_assessments, evidences | CA-1.5 |
| CA-1.13 | Auto-recalculate scores (trigger on requirement_assessment change) | CA-1.5 |
| CA-1.14 | API CRUD: services, business_processes | CA-1.8 |

### Faza CA-2: Audit Workflow & Mapping (3 tygodnie)

| # | Zadanie | Zależność |
|---|---------|-----------|
| CA-2.1 | Migration: tabele `audit_programs`, `audit_engagements`, `audit_engagement_auditors`, `audit_engagement_scope` | Faza CA-1 |
| CA-2.2 | Migration: tabele `audit_tests`, `audit_test_evidences` | CA-2.1 |
| CA-2.3 | Migration: tabele `audit_findings`, `audit_finding_requirements`, `audit_finding_tests`, `audit_finding_actions` | CA-2.1 |
| CA-2.4 | Migration: tabele `audit_reports`, `audit_report_attachments` | CA-2.1 |
| CA-2.5 | Migration: tabele `framework_mappings` | Faza CA-1 |
| CA-2.6 | Migration: tabele `test_templates`, `test_template_requirements` | Faza CA-1 |
| CA-2.7 | Audit lifecycle state machine (status transitions) | CA-2.1 |
| CA-2.8 | Coverage engine: `calculate_cross_framework_coverage()` | CA-2.5 |
| CA-2.9 | Coverage engine: `suggest_tests_for_requirement()` | CA-2.6 |
| CA-2.10 | Coverage engine: `calculate_audit_coverage()`, `calculate_finding_stats()` | CA-2.2, CA-2.3 |
| CA-2.11 | Coverage engine: `calculate_org_compliance_dashboard()` | Faza CA-1 |
| CA-2.12 | Import: CISO Assistant mapping YAML parser | CA-2.5 |
| CA-2.13 | API: audit_programs, audit_engagements, audit_tests, audit_findings, audit_reports | CA-2.1–CA-2.4 |
| CA-2.14 | API: framework_mappings, coverage analysis | CA-2.5, CA-2.8 |
| CA-2.15 | API: test_templates CRUD + suggest | CA-2.6 |
| CA-2.16 | Integracja: audit_finding → Actions module (FK) | CA-2.3 |
| CA-2.17 | Seed data: 10-20 bazowych test templates | CA-2.6 |

### Faza CA-3: UI (3 tygodnie)

| # | Zadanie | Zależność |
|---|---------|-----------|
| CA-3.1 | UI: Framework Library (lista, import, tworzenie) | Faza CA-1 |
| CA-3.2 | UI: Requirement Tree Viewer (drzewo + oceny) | CA-1.12 |
| CA-3.3 | UI: Compliance Assessment (bieżąca ocena) | CA-1.12 |
| CA-3.4 | UI: Evidence management (upload, link) | CA-1.6 |
| CA-3.5 | UI: Compliance Dashboard (scores, progress bars, per framework) | CA-2.11 |
| CA-3.6 | UI: Framework Mapping viewer + editor | CA-2.14 |
| CA-3.7 | UI: Cross-Framework Coverage Dashboard | CA-2.8 |
| CA-3.8 | UI: Audit Program (plan roczny, kanban/timeline) | CA-2.13 |
| CA-3.9 | UI: Audit Engagement Workspace (planning → fieldwork → reporting) | CA-2.13 |
| CA-3.10 | UI: Test execution (wyniki, dowody, workpapers) | CA-2.13 |
| CA-3.11 | UI: Finding Editor (IIA format: condition/criteria/cause/effect) | CA-2.13 |
| CA-3.12 | UI: Audit Report viewer + generate PDF/DOCX | CA-2.4 |
| CA-3.13 | UI: Test Template Catalog (browse, create, assign) | CA-2.15 |
| CA-3.14 | UI: Services & Business Processes CRUD | CA-1.14 |
| CA-3.15 | PDF report generator (sekcja 15.1) | CA-2.4 |
| CA-3.16 | DOCX report generator (sekcja 15.2) | CA-2.4 |

**W TYM MOMENCIE SYSTEM JEST KOMPLETNY I GOTOWY DO UŻYCIA BEZ AI.**

### Faza CA-4: AI Plugin (2 tygodnie, OPCJONALNY MODUŁ)

| # | Zadanie | Zależność |
|---|---------|-----------|
| CA-4.1 | ALTER TABLE: ai_provider_config + 8 feature toggles | — |
| CA-4.2 | Rozszerzenie GET /config/features o nowe toggles | CA-4.1 |
| CA-4.3 | Prompt templates: mapping, test gen, finding, summary, trends, classify, translate | Faza CA-2 |
| CA-4.4 | AI UC-CA-1: Framework mapping suggestions | CA-4.3 |
| CA-4.5 | AI UC-CA-2: Test generation | CA-4.3 |
| CA-4.6 | AI UC-CA-3: Cross-framework gap analysis AI | CA-4.3 |
| CA-4.7 | AI UC-CA-4: Finding formulation | CA-4.3 |
| CA-4.8 | AI UC-CA-5: Report summary | CA-4.3 |
| CA-4.9 | AI UC-CA-6: Trend analysis | CA-4.3 |
| CA-4.10 | AI UC-CA-7: Requirement classification | CA-4.3 |
| CA-4.11 | AI UC-CA-8: Translation | CA-4.3 |
| CA-4.12 | API: /ai/* endpoints z 503 protection | CA-4.4–CA-4.11 |
| CA-4.13 | UI: Conditional AI buttons/panels (identycznie jak Smart Catalog) | CA-4.12, CA-4.2 |
| CA-4.14 | UI: AI review screen (accept/reject mapping suggestions, finding drafts, translations) | CA-4.12 |
| CA-4.15 | Tests: AI mocks, graceful degradation, feature flags | CA-4.12 |

**Faza CA-4 może być wdrożona kiedykolwiek lub nigdy — system jest kompletny bez niej.**

### Faza CA-5: Extensions (przyszłość)

| # | Zadanie |
|---|---------|
| CA-5.1 | Strategia audytowa wieloletnia (3-year plan → annual → engagements) |
| CA-5.2 | Import OSCAL (NIST 800-53 w formacie maszynowym) |
| CA-5.3 | Import SCF mappings (200+ regulacji w Excelu) |
| CA-5.4 | Statement of Applicability (SoA) generator dla ISO 27001 |
| CA-5.5 | Automatyczne generowanie risk scenarios z non-compliant requirements |
| CA-5.6 | Notification engine: reminders o evidence expiry, audit deadlines, overdue actions |
| CA-5.7 | OSCAL export (maszynowy format compliance data) |

**Czas całkowity: ~11 tygodni** (Fazy CA-1 do CA-4)
**MVP bez AI: ~9 tygodni** (Fazy CA-1 do CA-3)

---

## 17. Migracja bazy danych

### 17.1. Nowe tabele

Łącznie **~25 nowych tabel** (plus indeksy):

**Sekcja 3 — Framework & Requirements (3 tabele):**
- `frameworks`
- `requirement_nodes`
- `requirement_translations`

**Sekcja 4 — Compliance Assessment (5 tabel):**
- `compliance_assessments`
- `requirement_assessments`
- `requirement_assessment_controls`
- `requirement_assessment_evidences`
- `assessment_history`

**Sekcja 4 — Evidence (1 tabela, jeśli nie istnieje):**
- `evidences`

**Sekcja 5 — Audit Workflow (9 tabel):**
- `audit_programs`
- `audit_engagements`
- `audit_engagement_auditors`
- `audit_engagement_scope`
- `audit_tests`
- `audit_test_evidences`
- `audit_findings`
- `audit_finding_requirements`
- `audit_finding_tests`
- `audit_finding_actions`
- `audit_reports`
- `audit_report_attachments`

**Sekcja 6 — Framework Mapping (1 tabela):**
- `framework_mappings`

**Sekcja 7 — Test Templates (2 tabele):**
- `test_templates`
- `test_template_requirements`

**Sekcja 8 — New Scope Objects (4 tabele):**
- `services`
- `service_assets`
- `business_processes`
- `process_services`

### 17.2. Modyfikacje istniejących tabel

```sql
-- Rozszerzenie ai_provider_config o nowe feature toggles (jeśli istnieje z Smart Catalog)
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS feature_framework_mapping BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS feature_test_generation BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS feature_gap_analysis_ai BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS feature_finding_formulation BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS feature_report_summary BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS feature_trend_analysis BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS feature_requirement_classify BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS feature_translation BOOLEAN DEFAULT TRUE;
```

### 17.3. Kolejność migracji

1. Frameworks + requirement_nodes + translations (baza)
2. Evidences (jeśli nie istnieje)
3. Compliance assessment + requirement_assessments + history
4. Services + business_processes (nowe scope'y)
5. Audit workflow tables (programs, engagements, tests, findings, reports)
6. Framework mappings
7. Test templates
8. ALTER ai_provider_config (feature toggles)

UWAGA: Przed tworzeniem migracji sprawdź czy tabele o tych nazwach lub podobnych nie istnieją już w systemie. Jeśli tak — adaptuj nazwy lub rozszerzaj istniejące.
