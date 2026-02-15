# SPECYFIKACJA: Moduł Program Audytów

## SecurePosture — Planowanie, wersjonowanie i zarządzanie programami audytów

**Wersja:** 1.0
**Data:** 2026-02-15
**Status:** SPECYFIKACJA DO IMPLEMENTACJI (Claude Code)
**Normy bazowe:** IIA Global Internal Audit Standards 2024 (Standard 9.4), ISO 19011:2018 (Rozdział 5)

---

## Spis treści

1. Podsumowanie założeń
2. KRYTYCZNE: Instrukcje dla agenta implementującego
3. Model danych
4. State Machine — cykl życia programu
5. Wersjonowanie programów
6. Mechanizm Change Request
7. Auto-diff między wersjami
8. Zarządzanie listą audytów
9. Przepinanie audytów między programami
10. Powiązania z innymi modułami
11. API Endpoints
12. Interfejs użytkownika
13. Permissions (RBAC)
14. Seed Data
15. AI jako opcjonalny plugin — 2 use case'y
16. Sekwencja implementacji

---

## 1. Podsumowanie założeń

### 1.1. Problem

Organizacja musi planować i zarządzać cyklicznym programem audytów obejmującym różnorodne typy audytów: procesowe (risk-based, IIA), zgodności (ISO 19011), dostawców (second-party), bezpieczeństwa fizycznego lokalizacji, follow-up i ad-hoc. Program audytów jest formalnym dokumentem zatwierdzanym przez organ nadzorczy (Komitet Audytu, Zarząd) i podlegającym rygorystycznej kontroli zmian.

Dziś organizacje zarządzają programami w Excelu/Wordzie, co prowadzi do: braku formalnego workflow zatwierdzania, braku rozliczalności zmian, niemożności śledzenia wersji, braku powiązania z wykonaniem audytów.

### 1.2. Rozwiązanie

Moduł Program Audytów z następującymi cechami:

1. **Formalny dokument z wersjonowaniem** — program to wersjonowany dokument (v1, v2, v3...) z pełnym lifecycle'em zatwierdzania
2. **Zatwierdzony = zablokowany** — żadna edycja bez korekty (nowa wersja)
3. **Wszystkie zmiany przez Change Request** — propozycja zmiany z uzasadnieniem → zatwierdzenie → korekta
4. **Wielotypowość audytów** — jeden program obejmuje audyty procesowe, zgodności, dostawców, lokalizacji, follow-up, ad-hoc
5. **Elastyczny okres** — roczny, wieloletni, kwartalny, dowolny custom
6. **Pełna rozliczalność** — audit trail każdej zmiany: kto, kiedy, co, dlaczego

### 1.3. Wymagania norm

**IIA 2024 Standard 9.4 — Internal Audit Plan:**
- Plan oparty na udokumentowanej ocenie ryzyka (co najmniej raz w roku)
- Zarząd i senior management muszą zatwierdzić: ocenę ryzyka, strategię IA, plan audytów, budżet
- Istotne zmiany w planie komunikowane zarządowi i zatwierdzane
- Udokumentowany proces zatwierdzania zmian

**ISO 19011:2018 Rozdział 5 — Managing an audit programme:**
- Program = zestaw ustaleń dotyczących realizacji audytów w określonym celu i okresie
- Cykl PDCA: planuj → wdrażaj → monitoruj → przeglądaj i ulepszaj
- Wymagana identyfikacja ryzyk i szans programu
- Rola „osoby zarządzającej programem audytów"
- Program uwzględnia: cele organizacji, kontekst, potrzeby stron zainteresowanych
- Zakres obejmuje: audyty wewnętrzne, dostawców, lokalizacje, procesy
- Pełne utrzymanie zapisów programu

### 1.4. Typy audytów obsługiwane w programie

| Typ audytu | Norma | Przykład | Kod |
|------------|-------|---------|-----|
| Audyt procesu (risk-based) | IIA 2024 | Audyt procesu zarządzania zmianami IT | `process` |
| Audyt zgodności (compliance) | ISO 19011 | Audyt ISO 27001 — Dział IT | `compliance` |
| Audyt dostawcy (second-party) | ISO 19011 | Audyt dostawcy chmury — AWS | `supplier` |
| Audyt lokalizacji (physical) | ISO 19011 | Audyt bezpieczeństwa fizycznego — DC Warszawa | `physical` |
| Audyt follow-up | IIA 2024 | Weryfikacja realizacji ustaleń z Q1 | `follow_up` |
| Audyt ad-hoc (specjalny) | IIA / ISO | Audyt incydentu bezpieczeństwa | `ad_hoc` |
| Audyt kombinowany | ISO 19011 | Audyt ISO 27001 + NIS2 łączony | `combined` |

### 1.5. Role

| Rola | Opis | Uprawnienia |
|------|------|-------------|
| **Program Owner** | CAE lub wyznaczona osoba zarządzająca programem | Tworzy program, edytuje draft, składa do zatwierdzenia, inicjuje korektę, zarządza listą audytów w drafcie |
| **Program Approver** | Zarząd / Komitet Audytu / CAE | Zatwierdza lub odrzuca program i change requesty |
| **Audit Manager** | Kierownik audytu | Może składać Change Requesty, podgląd programu |
| **Auditor** | Audytor | Tylko podgląd programu i przypisanych audytów |
| **Admin** | Administrator systemu | Pełen dostęp, konfiguracja |

### 1.6. Czego NIE robimy (świadome ograniczenia v1)

| Wykluczenie | Uzasadnienie |
|-------------|--------------|
| Wielopoziomowa strategia audytowa (3-year → annual → quarterly) | Rozszerzenie w v2. Teraz: jeden poziom z elastycznym okresem |
| Automatyczne generowanie programu z oceny ryzyk | Rozszerzenie w v2. Teraz: ręczne planowanie |
| Automatyczne przypisywanie audytorów na bazie kompetencji | Rozszerzenie w v2. Teraz: ręczne przypisanie |
| Integracja z kalendarzem zewnętrznym (Outlook, Google) | Rozszerzenie. Teraz: daty w systemie |

---

## 2. KRYTYCZNE: Instrukcje dla agenta implementującego

### 2.1. Analiza istniejącego kodu PRZED implementacją

ZANIM zaczniesz implementować, MUSISZ:

1. **Sprawdź istniejące modele** — w szczególności:
   a. Czy istnieje już model `AuditProgram` lub `AuditPlan`
   b. Czy istnieje model `AuditEngagement` lub `Audit`
   c. Jak wygląda model `User` — pola, relacje, rola
   d. Jak wygląda model `OrgUnit` — hierarchia, pola
   e. Czy istnieje moduł `Evidence` lub `Attachment`
   f. Czy istnieje mechanizm audit trail / activity log

2. **Sprawdź konwencje** — nazwy tabel, style API, paginacja, serializers, permissions

3. **Raportuj rozbieżności** — zanim zaczniesz kodować, opisz co znalazłeś i zaproponuj adaptację

### 2.2. Relacja z przyszłymi modułami

Ten moduł tworzy **fundament** dla kolejnych modułów:
- **Moduł Audit Engagement** (następny) — audit_engagements będą linkowane do audit_programs
- **Moduł Compliance Assessment** — assessment może być powiązany z engagement w programie
- **Moduł Actions** — ustalenia z audytów generują działania naprawcze

Program Audytów definiuje „CO" i „KIEDY" audytujemy. Audit Engagement definiuje „JAK" audytujemy.

### 2.3. Kolejność implementacji

1. Analiza istniejącego kodu (2.1)
2. Migration: tabele programu (sekcja 3)
3. State machine + wersjonowanie (sekcja 4, 5)
4. Change Request mechanism (sekcja 6)
5. Auto-diff engine (sekcja 7)
6. API endpoints (sekcja 11)
7. Frontend (sekcja 12)
8. Permissions RBAC (sekcja 13)
9. Seed data (sekcja 14)

---

## 3. Model danych

### 3.1. audit_programs — Program audytów

```sql
CREATE TABLE audit_programs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identyfikacja
    ref_id                  VARCHAR(30) NOT NULL,            -- "AP-2025-001"
    name                    VARCHAR(300) NOT NULL,           -- "Program Audytów IT 2025"
    description             TEXT,                            -- szczegółowy opis programu

    -- Wersjonowanie
    version                 INTEGER NOT NULL DEFAULT 1,      -- 1, 2, 3...
    version_group_id        UUID NOT NULL,                   -- łączy wszystkie wersje tego samego programu
    is_current_version      BOOLEAN NOT NULL DEFAULT TRUE,   -- tylko jedna wersja = TRUE per group
    previous_version_id     UUID REFERENCES audit_programs(id), -- link do poprzedniej wersji

    -- Okres programu (elastyczny)
    period_type             VARCHAR(20) NOT NULL DEFAULT 'annual',
                            -- 'annual' | 'multi_year' | 'quarterly' | 'semi_annual' | 'custom'
    period_start            DATE NOT NULL,                   -- początek okresu
    period_end              DATE NOT NULL,                   -- koniec okresu
    year                    INTEGER,                         -- rok główny (dla rocznych)

    -- Kontekst ISO 19011 / IIA
    strategic_objectives    TEXT,                            -- cele strategiczne programu (ISO 19011 §5.2)
    risks_and_opportunities TEXT,                            -- ryzyka i szanse programu (ISO 19011 §5.3)
    scope_description       TEXT,                            -- zakres: jednostki, procesy, lokalizacje, dostawcy (ISO 19011 §5.4)
    audit_criteria          TEXT,                            -- wspólne kryteria audytu: normy, regulacje
    methods                 TEXT,                            -- metody: on-site, remote, combined (ISO 19011 §5.4)
    risk_assessment_ref     TEXT,                            -- referencja do oceny ryzyka będącej podstawą (IIA 9.4)

    -- Budżet i zasoby
    budget_planned_days     DECIMAL(8,1),                    -- planowane osobodni
    budget_actual_days      DECIMAL(8,1) DEFAULT 0,          -- zrealizowane osobodni (auto-kalkulowane)
    budget_planned_cost     DECIMAL(12,2),                   -- planowany budżet (waluta)
    budget_actual_cost      DECIMAL(12,2) DEFAULT 0,         -- zrealizowany budżet
    budget_currency         VARCHAR(3) DEFAULT 'PLN',        -- waluta budżetu

    -- KPI (IIA QAIP)
    kpis                    JSONB DEFAULT '[]',              -- wskaźniki efektywności programu
                            -- [{"name": "% audytów zrealizowanych", "target": "90%", "actual": null}, ...]

    -- Kontynuacja
    previous_program_id     UUID,                            -- link do programu z poprzedniego okresu (FK dodana po weryfikacji)

    -- Lifecycle
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
                            -- 'draft' | 'submitted' | 'approved' | 'in_execution' |
                            -- 'completed' | 'archived' | 'superseded' | 'rejected'
    status_changed_at       TIMESTAMPTZ,
    status_changed_by       UUID REFERENCES users(id),

    -- Zatwierdzenie
    submitted_at            TIMESTAMPTZ,
    submitted_by            UUID REFERENCES users(id),
    approval_justification  TEXT,                            -- uzasadnienie zatwierdzenia (wymagane dla v2+)
    approved_at             TIMESTAMPTZ,
    approved_by             UUID REFERENCES users(id),
    rejection_reason        TEXT,                            -- powód odrzucenia
    rejected_at             TIMESTAMPTZ,
    rejected_by             UUID REFERENCES users(id),

    -- Korekta
    correction_reason       TEXT,                            -- powód inicjacji korekty (wymagane)
    correction_initiated_at TIMESTAMPTZ,
    correction_initiated_by UUID REFERENCES users(id),

    -- Role
    owner_id                UUID NOT NULL REFERENCES users(id),   -- właściciel programu (CAE)
    approver_id             UUID NOT NULL REFERENCES users(id),   -- osoba zatwierdzająca

    -- Organizacja
    org_unit_id             UUID REFERENCES org_units(id),   -- NULL = cała organizacja

    -- Metadata
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_period CHECK (period_end > period_start),
    CONSTRAINT chk_version CHECK (version >= 1)
);

CREATE INDEX idx_ap_version_group ON audit_programs(version_group_id);
CREATE INDEX idx_ap_status ON audit_programs(status);
CREATE INDEX idx_ap_current ON audit_programs(version_group_id, is_current_version) WHERE is_current_version = TRUE;
CREATE INDEX idx_ap_owner ON audit_programs(owner_id);
CREATE INDEX idx_ap_period ON audit_programs(period_start, period_end);
CREATE INDEX idx_ap_year ON audit_programs(year);

-- Partial unique: tylko jedna aktualna wersja per group
CREATE UNIQUE INDEX idx_ap_one_current_per_group
    ON audit_programs(version_group_id) WHERE is_current_version = TRUE;
```

### 3.2. audit_program_items — Pozycje programu (zaplanowane audyty)

Każda pozycja to zaplanowany audyt w programie. Może być powiązana z rzeczywistym audit_engagement (gdy engagement zostanie utworzony) lub istnieć jako „slot" w planie.

```sql
CREATE TABLE audit_program_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_program_id        UUID NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,

    -- Identyfikacja
    ref_id                  VARCHAR(30),                     -- "API-001" (numer w obrębie programu)
    name                    VARCHAR(300) NOT NULL,           -- "Audyt ISO 27001 — Dział IT"
    description             TEXT,

    -- Typ audytu
    audit_type              VARCHAR(20) NOT NULL DEFAULT 'compliance',
                            -- 'process' | 'compliance' | 'supplier' | 'physical' |
                            -- 'follow_up' | 'ad_hoc' | 'combined'

    -- Planowanie czasowe
    planned_quarter         INTEGER,                         -- 1, 2, 3, 4 (opcjonalnie)
    planned_month           INTEGER,                         -- 1-12 (opcjonalnie)
    planned_start           DATE,
    planned_end             DATE,

    -- Scope / co audytujemy
    scope_type              VARCHAR(30),
                            -- 'organization' | 'org_unit' | 'department' | 'process' |
                            -- 'service' | 'supplier' | 'location' | 'project' | 'system'
    scope_id                UUID,                            -- FK polymorphic do odpowiedniej tabeli
    scope_name              VARCHAR(300),                    -- czytelna nazwa (denormalizacja)

    -- Framework / kryteria
    framework_ids           JSONB DEFAULT '[]',              -- frameworki/normy będące kryteriami audytu
    criteria_description    TEXT,                            -- opis kryteriów audytu

    -- Zasoby
    planned_days            DECIMAL(6,1),                    -- planowane osobodni
    planned_cost            DECIMAL(10,2),                   -- planowany koszt

    -- Priorytet (risk-based, IIA 9.4)
    priority                VARCHAR(10) DEFAULT 'medium',    -- 'critical' | 'high' | 'medium' | 'low'
    risk_rating             VARCHAR(10),                     -- ocena ryzyka audytowanego obszaru
    risk_justification      TEXT,                            -- uzasadnienie priorytetu

    -- Zespół (wstępne przypisanie)
    lead_auditor_id         UUID REFERENCES users(id),       -- planowany lead auditor
    auditor_ids             JSONB DEFAULT '[]',              -- planowani audytorzy ["uuid1", "uuid2"]

    -- Powiązanie z engagement (wypełniane gdy engagement zostanie utworzony)
    audit_engagement_id     UUID,                            -- FK do audit_engagements (dodana po weryfikacji tabeli)

    -- Status pozycji
    item_status             VARCHAR(20) DEFAULT 'planned',
                            -- 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'deferred'
    cancellation_reason     TEXT,                            -- powód anulowania
    deferral_reason         TEXT,                            -- powód odroczenia
    deferred_to_program_id  UUID REFERENCES audit_programs(id), -- do jakiego programu odroczone

    -- Metody (ISO 19011)
    audit_method            VARCHAR(20) DEFAULT 'on_site',   -- 'on_site' | 'remote' | 'combined'

    -- Kolejność wyświetlania
    display_order           INTEGER DEFAULT 0,

    -- Metadata
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_program ON audit_program_items(audit_program_id);
CREATE INDEX idx_api_type ON audit_program_items(audit_type);
CREATE INDEX idx_api_status ON audit_program_items(item_status);
CREATE INDEX idx_api_quarter ON audit_program_items(planned_quarter);
CREATE INDEX idx_api_engagement ON audit_program_items(audit_engagement_id);
```

### 3.3. audit_program_change_requests — Wnioski o zmianę

Change Request to formalny wniosek o zmianę zatwierdzonego programu. Po zatwierdzeniu CR, system automatycznie tworzy korektę (nową wersję) programu z wprowadzonymi zmianami.

```sql
CREATE TABLE audit_program_change_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_program_id        UUID NOT NULL REFERENCES audit_programs(id),

    -- Identyfikacja
    ref_id                  VARCHAR(30) NOT NULL,            -- "CR-2025-001"
    title                   VARCHAR(300) NOT NULL,           -- "Dodanie audytu NIS2"

    -- Opis zmiany
    change_type             VARCHAR(20) NOT NULL,
                            -- 'add_audit' | 'remove_audit' | 'modify_audit' |
                            -- 'modify_schedule' | 'modify_scope' | 'modify_budget' |
                            -- 'modify_team' | 'other'
    justification           TEXT NOT NULL,                    -- uzasadnienie zmiany (WYMAGANE)
    change_description      TEXT NOT NULL,                    -- szczegółowy opis proponowanych zmian
    impact_assessment       TEXT,                            -- ocena wpływu na budżet, zasoby, harmonogram

    -- Powiązanie z konkretnym item (jeśli dotyczy jednego audytu)
    affected_item_id        UUID REFERENCES audit_program_items(id), -- NULL = zmiana na poziomie programu

    -- Proponowane wartości (JSON z nowymi wartościami)
    proposed_changes        JSONB DEFAULT '{}',
                            -- Przykład dla add_audit:
                            -- {"action": "add", "item": {"name": "Audyt NIS2", "audit_type": "compliance", ...}}
                            -- Przykład dla remove_audit:
                            -- {"action": "remove", "item_id": "uuid", "item_name": "Audyt dostawcy X"}
                            -- Przykład dla modify_audit:
                            -- {"action": "modify", "item_id": "uuid", "changes": {"planned_quarter": {"from": 2, "to": 3}}}

    -- Lifecycle
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
                            -- 'draft' | 'submitted' | 'approved' | 'rejected' | 'implemented' | 'cancelled'
    status_changed_at       TIMESTAMPTZ,

    -- Wnioskodawca
    requested_by            UUID NOT NULL REFERENCES users(id),
    requested_at            TIMESTAMPTZ DEFAULT NOW(),

    -- Zatwierdzenie
    submitted_at            TIMESTAMPTZ,
    reviewed_by             UUID REFERENCES users(id),       -- approver
    reviewed_at             TIMESTAMPTZ,
    review_comment          TEXT,                            -- komentarz approver'a

    -- Implementacja (po zatwierdzeniu → jaką wersję programu utworzono)
    resulting_version_id    UUID REFERENCES audit_programs(id), -- nowa wersja programu utworzona z tego CR
    implemented_at          TIMESTAMPTZ,

    -- Metadata
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_apcr_program ON audit_program_change_requests(audit_program_id);
CREATE INDEX idx_apcr_status ON audit_program_change_requests(status);
CREATE INDEX idx_apcr_requested_by ON audit_program_change_requests(requested_by);
```

### 3.4. audit_program_history — Audit trail (pełna rozliczalność)

```sql
CREATE TABLE audit_program_history (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Co się zmieniło
    entity_type             VARCHAR(30) NOT NULL,
                            -- 'program' | 'program_item' | 'change_request'
    entity_id               UUID NOT NULL,                   -- ID zmienionego obiektu
    audit_program_id        UUID NOT NULL REFERENCES audit_programs(id),

    -- Akcja
    action                  VARCHAR(30) NOT NULL,
                            -- 'created' | 'updated' | 'deleted' |
                            -- 'status_changed' | 'submitted' | 'approved' | 'rejected' |
                            -- 'correction_initiated' | 'version_created' |
                            -- 'item_added' | 'item_removed' | 'item_modified' |
                            -- 'item_transferred_out' | 'item_transferred_in' |
                            -- 'cr_submitted' | 'cr_approved' | 'cr_rejected' | 'cr_implemented'

    -- Szczegóły
    field_changes           JSONB,                           -- {"field": {"old": "val1", "new": "val2"}, ...}
    description             TEXT,                            -- czytelny opis zmiany
    justification           TEXT,                            -- uzasadnienie (jeśli wymagane)

    -- Powiązania
    change_request_id       UUID REFERENCES audit_program_change_requests(id), -- powiązany CR (jeśli zmiana z CR)
    related_program_id      UUID,                            -- np. program źródłowy/docelowy przy transfer

    -- Kto i kiedy
    performed_by            UUID NOT NULL REFERENCES users(id),
    performed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Kontekst
    ip_address              VARCHAR(45),                     -- opcjonalnie: IP użytkownika
    user_agent              VARCHAR(500)                     -- opcjonalnie: przeglądarka
);

CREATE INDEX idx_aph_program ON audit_program_history(audit_program_id);
CREATE INDEX idx_aph_entity ON audit_program_history(entity_type, entity_id);
CREATE INDEX idx_aph_action ON audit_program_history(action);
CREATE INDEX idx_aph_date ON audit_program_history(performed_at);
CREATE INDEX idx_aph_user ON audit_program_history(performed_by);
```

### 3.5. audit_program_version_diffs — Automatyczne diffy między wersjami

```sql
CREATE TABLE audit_program_version_diffs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_group_id        UUID NOT NULL,                   -- grupa wersji
    from_version_id         UUID NOT NULL REFERENCES audit_programs(id),
    to_version_id           UUID NOT NULL REFERENCES audit_programs(id),
    from_version            INTEGER NOT NULL,
    to_version              INTEGER NOT NULL,

    -- Diff treści
    program_field_changes   JSONB DEFAULT '{}',              -- zmiany pól programu
                            -- {"name": {"from": "...", "to": "..."}, "budget_planned_days": {"from": 100, "to": 120}}

    items_added             JSONB DEFAULT '[]',              -- dodane pozycje
                            -- [{"ref_id": "API-009", "name": "Audyt NIS2", "audit_type": "compliance"}]

    items_removed           JSONB DEFAULT '[]',              -- usunięte pozycje
                            -- [{"ref_id": "API-003", "name": "Audyt dostawcy X", "reason": "Koniec umowy"}]

    items_modified          JSONB DEFAULT '[]',              -- zmodyfikowane pozycje
                            -- [{"ref_id": "API-005", "changes": {"planned_quarter": {"from": 2, "to": 3}}}]

    items_unchanged         INTEGER DEFAULT 0,               -- ile pozycji bez zmian

    -- Podsumowanie
    summary                 TEXT,                            -- automatyczne podsumowanie czytelne dla człowieka
    change_request_ids      JSONB DEFAULT '[]',              -- CR-y które doprowadziły do tej wersji

    -- Metadata
    generated_at            TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(from_version_id, to_version_id)
);

CREATE INDEX idx_apvd_group ON audit_program_version_diffs(version_group_id);
```

---

## 4. State Machine — cykl życia programu

### 4.1. Diagram stanów

```
                                ┌─────────────────────────────────────┐
                                │                                     │
    ┌───────┐   ┌───────────┐  │  ┌──────────┐   ┌─────────────┐   │  ┌───────────┐
    │ Draft │──>│ Submitted │──┼─>│ Approved │──>│In Execution │───┼─>│ Completed │
    └───────┘   └───────────┘  │  └──────────┘   └─────────────┘   │  └───────────┘
        │            │         │       │               │            │       │
        │            │         │       └───────┬───────┘            │       │
        ▼            ▼         │               ▼                    │       ▼
    ┌─────────┐  ┌──────────┐ │        ┌─────────────┐             │  ┌──────────┐
    │ Deleted │  │ Rejected │─┘        │ Superseded  │             │  │ Archived │
    └─────────┘  └──────────┘          │ (old version│             │  └──────────┘
                      │                └─────────────┘             │
                      │                       ▲                    │
                      └──> Draft              │                    │
                           (nowa wersja) ─────┘                    │
                                                                   │
                 Korekta (z Approved lub In Execution) ────────────┘
                 → Stara wersja: Superseded
                 → Nowa wersja: Draft
```

### 4.2. Tabela przejść

| # | Z | Do | Warunek | Kto może | Uzasadnienie wymagane |
|---|---|----|---------|----------|----------------------|
| T1 | `draft` | `submitted` | Min. 1 pozycja (audit_program_item) w programie. Wypełnione pola: name, period_start, period_end, owner_id, approver_id | Owner | Nie |
| T2 | `draft` | `deleted` | Tylko wersja 1 (nowe programy). Wersje ≥2 nie mogą być usunięte — można je anulować wracając do poprzedniej | Owner | Nie |
| T3 | `submitted` | `approved` | — | Approver | Nie (dla v1). Tak (dla v2+ — pole `approval_justification`) |
| T4 | `submitted` | `rejected` | — | Approver | Tak (pole `rejection_reason`) |
| T5 | `rejected` | `draft` | Auto-reset po odrzuceniu | System (auto) | Nie |
| T6 | `approved` | `in_execution` | Co najmniej 1 audit_program_item zmienił item_status na `in_progress` | System (auto) | Nie |
| T7 | `approved` | `superseded` | Inicjacja korekty (nowa wersja) | System (auto, triggered by Owner) | Tak (pole `correction_reason`) |
| T8 | `in_execution` | `superseded` | Inicjacja korekty (nowa wersja) | System (auto, triggered by Owner) | Tak (pole `correction_reason`) |
| T9 | `in_execution` | `completed` | Wszystkie audit_program_items mają status `completed`, `cancelled` lub `deferred` | Owner | Nie |
| T10 | `completed` | `archived` | — | Owner / Admin | Nie |
| T11 | `superseded` | — | Stan terminalny. Nie można zmienić. | — | — |

### 4.3. Implementacja state machine

```python
VALID_TRANSITIONS = {
    'draft':         ['submitted', 'deleted'],
    'submitted':     ['approved', 'rejected'],
    'rejected':      ['draft'],  # auto
    'approved':      ['in_execution', 'superseded'],
    'in_execution':  ['completed', 'superseded'],
    'completed':     ['archived'],
    'superseded':    [],  # terminal
    'archived':      [],  # terminal
    'deleted':       [],  # terminal
}

REQUIRES_JUSTIFICATION = {
    ('submitted', 'rejected'): 'rejection_reason',
    ('approved', 'superseded'): 'correction_reason',
    ('in_execution', 'superseded'): 'correction_reason',
}

# Warunek specjalny: zatwierdzenie wersji 2+ wymaga approval_justification
def validate_approval(program):
    if program.version > 1 and not program.approval_justification:
        raise ValidationError("Zatwierdzenie korekty (wersja ≥2) wymaga uzasadnienia")
```

---

## 5. Wersjonowanie programów

### 5.1. Mechanizm tworzenia korekty

```python
def initiate_correction(program_id: UUID, correction_reason: str, user: User) -> AuditProgram:
    """
    Inicjuje korektę programu. Tworzy nową wersję jako kopię.

    1. Walidacja: program musi mieć status 'approved' lub 'in_execution'
    2. Stary program: status → 'superseded', is_current_version → FALSE
    3. Nowy program: kopia z version + 1, status = 'draft', is_current_version = TRUE
    4. Kopiowanie audit_program_items (z zachowaniem engagement powiązań)
    5. Zapis w audit_program_history
    6. Generowanie diffu (na razie pusty — diff wygeneruje się przy zatwierdzeniu)
    """

    original = AuditProgram.objects.get(id=program_id)

    # Walidacja
    if original.status not in ('approved', 'in_execution'):
        raise ValidationError("Korekta możliwa tylko dla programu 'approved' lub 'in_execution'")
    if not correction_reason or len(correction_reason.strip()) < 10:
        raise ValidationError("Uzasadnienie korekty jest wymagane (min. 10 znaków)")

    with transaction.atomic():
        # 1. Oznacz starą wersję jako superseded
        original.status = 'superseded'
        original.is_current_version = False
        original.correction_reason = correction_reason
        original.correction_initiated_at = now()
        original.correction_initiated_by = user
        original.save()

        # 2. Utwórz nową wersję
        new_program = AuditProgram(
            ref_id=original.ref_id,
            name=original.name,
            description=original.description,
            version=original.version + 1,
            version_group_id=original.version_group_id,
            is_current_version=True,
            previous_version_id=original.id,
            # Kopiuj wszystkie pola merytoryczne
            period_type=original.period_type,
            period_start=original.period_start,
            period_end=original.period_end,
            year=original.year,
            strategic_objectives=original.strategic_objectives,
            risks_and_opportunities=original.risks_and_opportunities,
            scope_description=original.scope_description,
            audit_criteria=original.audit_criteria,
            methods=original.methods,
            risk_assessment_ref=original.risk_assessment_ref,
            budget_planned_days=original.budget_planned_days,
            budget_actual_days=original.budget_actual_days,
            budget_planned_cost=original.budget_planned_cost,
            budget_actual_cost=original.budget_actual_cost,
            budget_currency=original.budget_currency,
            kpis=original.kpis,
            previous_program_id=original.previous_program_id,
            status='draft',
            owner_id=original.owner_id,
            approver_id=original.approver_id,
            org_unit_id=original.org_unit_id,
            created_by=user,
        )
        new_program.save()

        # 3. Kopiuj pozycje programu
        for item in AuditProgramItem.objects.filter(audit_program_id=original.id):
            AuditProgramItem.objects.create(
                audit_program_id=new_program.id,
                ref_id=item.ref_id,
                name=item.name,
                description=item.description,
                audit_type=item.audit_type,
                planned_quarter=item.planned_quarter,
                planned_month=item.planned_month,
                planned_start=item.planned_start,
                planned_end=item.planned_end,
                scope_type=item.scope_type,
                scope_id=item.scope_id,
                scope_name=item.scope_name,
                framework_ids=item.framework_ids,
                criteria_description=item.criteria_description,
                planned_days=item.planned_days,
                planned_cost=item.planned_cost,
                priority=item.priority,
                risk_rating=item.risk_rating,
                risk_justification=item.risk_justification,
                lead_auditor_id=item.lead_auditor_id,
                auditor_ids=item.auditor_ids,
                audit_engagement_id=item.audit_engagement_id,  # zachowaj powiązanie!
                item_status=item.item_status,
                audit_method=item.audit_method,
                display_order=item.display_order,
            )

        # 4. Log
        AuditProgramHistory.objects.create(
            entity_type='program',
            entity_id=new_program.id,
            audit_program_id=new_program.id,
            action='version_created',
            description=f"Utworzono korektę v{new_program.version} programu '{new_program.name}'",
            justification=correction_reason,
            performed_by=user,
        )

    return new_program
```

### 5.2. Widok historii wersji

```python
def get_version_history(version_group_id: UUID) -> list:
    """
    Zwraca wszystkie wersje programu w kolejności chronologicznej.
    """
    return AuditProgram.objects.filter(
        version_group_id=version_group_id
    ).order_by('version').values(
        'id', 'version', 'status', 'name',
        'approved_at', 'approved_by__username',
        'correction_reason', 'approval_justification',
        'created_at'
    )
```

---

## 6. Mechanizm Change Request

### 6.1. Workflow Change Request

W trybie „Opcja A" (tylko korekta), Change Request pełni rolę formalnego wniosku o korektę programu:

```
Ktoś zgłasza potrzebę zmiany
         │
         ▼
  ┌─────────────┐
  │  CR: Draft  │  ← Owner lub Audit Manager tworzy CR
  └──────┬──────┘
         │ submit
         ▼
  ┌─────────────┐
  │ CR:Submitted│  ← Approver widzi CR do review
  └──────┬──────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│Approved│ │ Rejected │  ← Approver decyduje
└───┬────┘ └──────────┘
    │
    │ system automatycznie:
    │ 1. Inicjuje korektę programu (nowa wersja)
    │ 2. Aplikuje zmiany z CR do nowej wersji
    │ 3. Nowa wersja → submitted → do zatwierdzenia
    ▼
┌─────────────┐
│Implemented  │  ← CR zamknięty, nowa wersja istnieje
└─────────────┘
```

### 6.2. Typy zmian i ich obsługa

| change_type | Co robi | proposed_changes format |
|-------------|---------|------------------------|
| `add_audit` | Dodaje nową pozycję do programu | `{"action": "add", "item": {name, audit_type, planned_quarter, scope_type, scope_name, priority, planned_days, ...}}` |
| `remove_audit` | Usuwa pozycję z programu (lub zmienia status na cancelled) | `{"action": "remove", "item_id": "uuid", "item_ref_id": "API-003", "cancel_reason": "Koniec umowy"}` |
| `modify_audit` | Modyfikuje istniejącą pozycję | `{"action": "modify", "item_id": "uuid", "changes": {"planned_quarter": {"from": 2, "to": 3}, "priority": {"from": "medium", "to": "high"}}}` |
| `modify_schedule` | Zmienia harmonogram pozycji | `{"action": "modify", "item_id": "uuid", "changes": {"planned_start": {...}, "planned_end": {...}}}` |
| `modify_scope` | Zmienia zakres pozycji | `{"action": "modify", "item_id": "uuid", "changes": {"scope_name": {...}, "criteria_description": {...}}}` |
| `modify_budget` | Zmienia budżet programu | `{"action": "modify_program", "changes": {"budget_planned_days": {"from": 100, "to": 130}}}` |
| `modify_team` | Zmienia zespół audytowy | `{"action": "modify", "item_id": "uuid", "changes": {"lead_auditor_id": {...}}}` |
| `other` | Inna zmiana | `{"action": "other", "description": "..."}` |

### 6.3. Automatyczna implementacja CR

```python
def implement_change_request(cr_id: UUID, user: User) -> AuditProgram:
    """
    Po zatwierdzeniu CR: tworzy korektę programu i aplikuje zmiany.
    """
    cr = AuditProgramChangeRequest.objects.get(id=cr_id)

    if cr.status != 'approved':
        raise ValidationError("Tylko zatwierdzone CR mogą być implementowane")

    with transaction.atomic():
        # 1. Inicjuj korektę (nowa wersja)
        new_program = initiate_correction(
            program_id=cr.audit_program_id,
            correction_reason=f"Change Request {cr.ref_id}: {cr.justification}",
            user=user
        )

        # 2. Aplikuj zmiany z CR do nowej wersji
        changes = cr.proposed_changes
        action = changes.get('action')

        if action == 'add':
            item_data = changes['item']
            AuditProgramItem.objects.create(
                audit_program_id=new_program.id,
                **item_data
            )
        elif action == 'remove':
            item_id = changes['item_id']
            # Znajdź skopiowany item w nowej wersji (match by ref_id)
            item_ref = changes.get('item_ref_id')
            copied_item = AuditProgramItem.objects.filter(
                audit_program_id=new_program.id,
                ref_id=item_ref
            ).first()
            if copied_item:
                copied_item.item_status = 'cancelled'
                copied_item.cancellation_reason = changes.get('cancel_reason', cr.justification)
                copied_item.save()
        elif action == 'modify':
            item_ref = changes.get('item_ref_id')
            copied_item = AuditProgramItem.objects.filter(
                audit_program_id=new_program.id,
                ref_id=item_ref
            ).first()
            if copied_item:
                for field, vals in changes.get('changes', {}).items():
                    setattr(copied_item, field, vals['to'])
                copied_item.save()
        elif action == 'modify_program':
            for field, vals in changes.get('changes', {}).items():
                setattr(new_program, field, vals['to'])
            new_program.save()

        # 3. Oznacz CR jako implemented
        cr.status = 'implemented'
        cr.resulting_version_id = new_program.id
        cr.implemented_at = now()
        cr.save()

        # 4. Log
        AuditProgramHistory.objects.create(
            entity_type='change_request',
            entity_id=cr.id,
            audit_program_id=new_program.id,
            action='cr_implemented',
            description=f"CR {cr.ref_id} zaimplementowany → Program v{new_program.version}",
            justification=cr.justification,
            change_request_id=cr.id,
            performed_by=user,
        )

    return new_program
```

### 6.4. Grupowanie wielu CR w jedną korektę

Jeśli jest kilka zatwierdzonych CR naraz, Owner może:
1. Zainicjować korektę ręcznie (przycisk „Korekta")
2. System pokazuje wszystkie zatwierdzone, niezaimplementowane CR
3. Owner wybiera które CR zaimplementować w tej korekcie
4. System tworzy jedną nową wersję z wszystkimi wybranymi zmianami
5. Diff zawiera referencje do wszystkich CR

---

## 7. Auto-diff między wersjami

### 7.1. Algorytm generowania diffu

```python
def generate_version_diff(from_version_id: UUID, to_version_id: UUID) -> dict:
    """
    Generuje automatyczny diff między dwiema wersjami programu.
    Wywołany automatycznie po zatwierdzeniu nowej wersji.
    """
    v_from = AuditProgram.objects.get(id=from_version_id)
    v_to = AuditProgram.objects.get(id=to_version_id)

    # 1. Diff pól programu
    PROGRAM_FIELDS = [
        'name', 'description', 'period_type', 'period_start', 'period_end',
        'strategic_objectives', 'risks_and_opportunities', 'scope_description',
        'audit_criteria', 'methods', 'risk_assessment_ref',
        'budget_planned_days', 'budget_planned_cost', 'kpis',
        'owner_id', 'approver_id',
    ]
    program_field_changes = {}
    for field in PROGRAM_FIELDS:
        old_val = getattr(v_from, field)
        new_val = getattr(v_to, field)
        if old_val != new_val:
            program_field_changes[field] = {
                'from': str(old_val) if old_val else None,
                'to': str(new_val) if new_val else None,
            }

    # 2. Diff pozycji (match by ref_id)
    from_items = {
        item.ref_id: item
        for item in AuditProgramItem.objects.filter(audit_program_id=from_version_id)
    }
    to_items = {
        item.ref_id: item
        for item in AuditProgramItem.objects.filter(audit_program_id=to_version_id)
    }

    from_refs = set(from_items.keys())
    to_refs = set(to_items.keys())

    # Dodane
    items_added = []
    for ref in to_refs - from_refs:
        item = to_items[ref]
        items_added.append({
            'ref_id': ref,
            'name': item.name,
            'audit_type': item.audit_type,
            'planned_quarter': item.planned_quarter,
            'priority': item.priority,
        })

    # Usunięte (lub anulowane w nowej wersji ale nie w starej)
    items_removed = []
    for ref in from_refs - to_refs:
        item = from_items[ref]
        items_removed.append({
            'ref_id': ref,
            'name': item.name,
            'audit_type': item.audit_type,
        })
    # + pozycje które w nowej wersji mają status cancelled a w starej nie
    for ref in from_refs & to_refs:
        if from_items[ref].item_status != 'cancelled' and to_items[ref].item_status == 'cancelled':
            items_removed.append({
                'ref_id': ref,
                'name': from_items[ref].name,
                'reason': to_items[ref].cancellation_reason,
                'change_type': 'cancelled',
            })

    # Zmodyfikowane
    ITEM_FIELDS = [
        'name', 'description', 'audit_type', 'planned_quarter', 'planned_month',
        'planned_start', 'planned_end', 'scope_type', 'scope_name',
        'planned_days', 'planned_cost', 'priority', 'risk_rating',
        'lead_auditor_id', 'audit_method', 'item_status',
    ]
    items_modified = []
    for ref in from_refs & to_refs:
        if to_items[ref].item_status == 'cancelled' and from_items[ref].item_status != 'cancelled':
            continue  # already handled in items_removed
        changes = {}
        for field in ITEM_FIELDS:
            old_val = getattr(from_items[ref], field)
            new_val = getattr(to_items[ref], field)
            if old_val != new_val:
                changes[field] = {
                    'from': str(old_val) if old_val else None,
                    'to': str(new_val) if new_val else None,
                }
        if changes:
            items_modified.append({
                'ref_id': ref,
                'name': to_items[ref].name,
                'changes': changes,
            })

    items_unchanged = len(from_refs & to_refs) - len(items_modified)

    # 3. Generuj podsumowanie czytelne
    summary_parts = []
    if items_added:
        summary_parts.append(f"Dodano {len(items_added)} audyt(ów): {', '.join(i['name'] for i in items_added)}")
    if items_removed:
        summary_parts.append(f"Usunięto/anulowano {len(items_removed)} audyt(ów): {', '.join(i['name'] for i in items_removed)}")
    if items_modified:
        summary_parts.append(f"Zmodyfikowano {len(items_modified)} audyt(ów): {', '.join(i['name'] for i in items_modified)}")
    if program_field_changes:
        summary_parts.append(f"Zmieniono {len(program_field_changes)} pól programu: {', '.join(program_field_changes.keys())}")
    summary = '. '.join(summary_parts) if summary_parts else "Brak zmian"

    # 4. Zapisz diff
    diff = AuditProgramVersionDiff.objects.create(
        version_group_id=v_to.version_group_id,
        from_version_id=from_version_id,
        to_version_id=to_version_id,
        from_version=v_from.version,
        to_version=v_to.version,
        program_field_changes=program_field_changes,
        items_added=items_added,
        items_removed=items_removed,
        items_modified=items_modified,
        items_unchanged=max(0, items_unchanged),
        summary=summary,
        change_request_ids=[],  # wypełniane przy implementacji CR
    )

    return diff
```

---

## 8. Zarządzanie listą audytów

### 8.1. Reguły edycji pozycji programu

| Status programu | Dodawanie pozycji | Usuwanie pozycji | Edycja pozycji | Przez kogo |
|-----------------|-------------------|------------------|----------------|------------|
| `draft` | ✅ Bezpośrednio | ✅ Bezpośrednio | ✅ Bezpośrednio | Owner |
| `submitted` | ❌ Zablokowane | ❌ Zablokowane | ❌ Zablokowane | — |
| `approved` | ❌ Tylko przez CR → Korektę | ❌ Tylko przez CR → Korektę | ❌ Tylko przez CR → Korektę | Owner (CR) → Approver |
| `in_execution` | ❌ Tylko przez CR → Korektę | ❌ Tylko przez CR → Korektę | ❌ Tylko przez CR → Korektę | Owner (CR) → Approver |
| `completed` | ❌ | ❌ | ❌ | — |
| `superseded` | ❌ | ❌ | ❌ | — |
| `archived` | ❌ | ❌ | ❌ | — |

### 8.2. Status pozycji programu (item_status)

```
┌─────────┐      ┌─────────────┐      ┌───────────┐
│ Planned │─────>│ In Progress │─────>│ Completed │
└─────────┘      └─────────────┘      └───────────┘
     │                  │
     │                  │
     ▼                  ▼
┌───────────┐    ┌───────────┐
│ Cancelled │    │ Cancelled │
└───────────┘    └───────────┘
     │
     ▼
┌──────────┐
│ Deferred │
└──────────┘
```

- `planned` → `in_progress`: Gdy engagement zostaje utworzony i rozpoczęty
- `in_progress` → `completed`: Gdy engagement zostaje zakończony
- `planned` / `in_progress` → `cancelled`: Anulowanie audytu (wymaga powodu)
- `planned` → `deferred`: Odroczenie do następnego programu (wymaga powodu + opcjonalnie `deferred_to_program_id`)

### 8.3. Automatyczna synchronizacja z engagement

Gdy audit_engagement zmienia status:
- Engagement `status = scoping/fieldwork` → item `item_status = in_progress` (auto)
- Engagement `status = completed/closed` → item `item_status = completed` (auto)
- Engagement `status = cancelled` → item `item_status = cancelled` (auto)

---

## 9. Przepinanie audytów między programami

### 9.1. Reguły

- Pozycja programu (`audit_program_item`) może być przepięta z programu A do programu B
- Warunek: program docelowy musi mieć status `draft` (nowa wersja po korekcie)
- Mechanizm: **zawsze przez Change Request** — CR w programie źródłowym (usunięcie) + CR w programie docelowym (dodanie), lub jeden CR typu `transfer`
- Jeśli pozycja ma powiązany `audit_engagement_id`, engagement przepinany jest razem z pozycją
- Pełny audit trail w obu programach

### 9.2. Transfer flow

```python
def transfer_audit_item(
    source_program_id: UUID,
    item_ref_id: str,
    target_program_id: UUID,
    justification: str,
    user: User
) -> dict:
    """
    Przepina pozycję audytu między programami.
    Oba programy muszą mieć status 'draft'.
    """
    source_program = AuditProgram.objects.get(id=source_program_id)
    target_program = AuditProgram.objects.get(id=target_program_id)

    if source_program.status != 'draft':
        raise ValidationError("Program źródłowy musi mieć status 'draft'")
    if target_program.status != 'draft':
        raise ValidationError("Program docelowy musi mieć status 'draft'")

    source_item = AuditProgramItem.objects.get(
        audit_program_id=source_program_id,
        ref_id=item_ref_id
    )

    with transaction.atomic():
        # 1. Utwórz kopię w programie docelowym
        new_item = AuditProgramItem.objects.create(
            audit_program_id=target_program_id,
            # ... kopiuj wszystkie pola z source_item ...
            audit_engagement_id=source_item.audit_engagement_id,
        )

        # 2. Oznacz źródłowy jako cancelled/transferred
        source_item.item_status = 'cancelled'
        source_item.cancellation_reason = f"Przeniesiono do programu {target_program.ref_id} v{target_program.version}"
        source_item.save()

        # 3. Log w obu programach
        for prog_id, action in [
            (source_program_id, 'item_transferred_out'),
            (target_program_id, 'item_transferred_in')
        ]:
            AuditProgramHistory.objects.create(
                entity_type='program_item',
                entity_id=source_item.id if action == 'item_transferred_out' else new_item.id,
                audit_program_id=prog_id,
                action=action,
                description=f"Pozycja '{source_item.name}' przeniesiona z {source_program.ref_id} do {target_program.ref_id}",
                justification=justification,
                related_program_id=target_program_id if action == 'item_transferred_out' else source_program_id,
                performed_by=user,
            )

    return {'source_item': source_item, 'new_item': new_item}
```

---

## 10. Powiązania z innymi modułami

### 10.1. Audit Engagements (moduł definiowany następnie)

```
audit_program_items.audit_engagement_id → audit_engagements.id
```

- Pozycja programu to „slot" planistyczny
- Engagement to realizacja audytu (testy, ustalenia, raport)
- Engagement może istnieć bez programu (audyt ad-hoc)
- Jeden item → max jeden engagement
- Engagement powstaje z pozycji programu: przycisk „Utwórz engagement" → wypełnia dane z item

### 10.2. Frameworks (biblioteka frameworków)

```
audit_program_items.framework_ids → frameworks.id (JSONB array)
```

- Pozycja programu może wskazywać frameworki/normy będące kryteriami audytu
- Np. pozycja „Audyt ISO 27001" → framework_ids: ["uuid-iso27001"]
- Pozycja „Audyt kombinowany ISO + NIS2" → framework_ids: ["uuid-iso27001", "uuid-nis2"]

### 10.3. Organizational Structure

```
audit_programs.org_unit_id → org_units.id
audit_program_items.scope_type + scope_id → org_units / services / business_processes / suppliers / locations
```

### 10.4. Suppliers (nowy obiekt scope — do zdefiniowania)

Audyt dostawcy wymaga obiektu `Supplier`:

```sql
-- Minimalna struktura (rozbudowa w przyszłości)
CREATE TABLE suppliers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(300) NOT NULL,
    description         TEXT,
    contact_info        TEXT,
    criticality         VARCHAR(10) DEFAULT 'medium',    -- 'critical' | 'high' | 'medium' | 'low'
    data_classification VARCHAR(20) DEFAULT 'internal',
    contract_ref        VARCHAR(100),                    -- numer umowy
    status              VARCHAR(20) DEFAULT 'active',    -- 'active' | 'inactive' | 'under_review'
    org_unit_id         UUID REFERENCES org_units(id),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 10.5. Locations (nowy obiekt scope — do zdefiniowania)

Audyt fizyczny wymaga obiektu `Location`:

```sql
CREATE TABLE locations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(300) NOT NULL,           -- "DC Warszawa", "Biuro Kraków"
    description         TEXT,
    location_type       VARCHAR(20) NOT NULL DEFAULT 'office',
                        -- 'office' | 'data_center' | 'warehouse' | 'factory' | 'remote_site'
    address             TEXT,
    city                VARCHAR(100),
    country             VARCHAR(100),
    criticality         VARCHAR(10) DEFAULT 'medium',
    status              VARCHAR(20) DEFAULT 'active',
    org_unit_id         UUID REFERENCES org_units(id),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 11. API Endpoints

### 11.1. Audit Programs — CRUD

```
GET    /api/v1/audit-programs
       Params: ?status=approved&year=2025&owner_id=X&org_unit_id=X&current_only=true
       Response: lista programów (domyślnie: tylko is_current_version=TRUE)

POST   /api/v1/audit-programs
       Body: {name, period_type, period_start, period_end, year, owner_id, approver_id, ...}
       Note: version=1, version_group_id=new UUID, status=draft

GET    /api/v1/audit-programs/{id}
       Response: program ze wszystkimi polami + summary stats (ile items, ile completed, budżet)

PUT    /api/v1/audit-programs/{id}
       Body: {name, description, strategic_objectives, ...}
       Constraint: tylko gdy status = 'draft'

DELETE /api/v1/audit-programs/{id}
       Constraint: tylko gdy status = 'draft' AND version = 1
```

### 11.2. Audit Programs — Lifecycle

```
POST   /api/v1/audit-programs/{id}/submit
       Constraint: status = 'draft', min. 1 item
       Effect: status → 'submitted'

POST   /api/v1/audit-programs/{id}/approve
       Body: {approval_justification?}  // wymagane dla version > 1
       Constraint: status = 'submitted', user = approver
       Effect: status → 'approved', generuje diff (jeśli version > 1)

POST   /api/v1/audit-programs/{id}/reject
       Body: {rejection_reason}  // wymagane
       Constraint: status = 'submitted', user = approver
       Effect: status → 'rejected' → auto 'draft'

POST   /api/v1/audit-programs/{id}/initiate-correction
       Body: {correction_reason}  // wymagane, min. 10 znaków
       Constraint: status = 'approved' OR 'in_execution', user = owner
       Effect: current → 'superseded', nowa wersja (draft) utworzona
       Response: nowy program (draft)

POST   /api/v1/audit-programs/{id}/complete
       Constraint: status = 'in_execution', wszystkie items zakończone/anulowane/odroczone
       Effect: status → 'completed'

POST   /api/v1/audit-programs/{id}/archive
       Constraint: status = 'completed'
       Effect: status → 'archived'
```

### 11.3. Version History & Diff

```
GET    /api/v1/audit-programs/{id}/versions
       Response: lista wszystkich wersji tego programu (po version_group_id)

GET    /api/v1/audit-programs/{id}/diff
       Params: ?compare_to={other_version_id}  // opcjonalnie, domyślnie: previous_version
       Response: AuditProgramVersionDiff (summary, items_added, items_removed, items_modified, program_field_changes)
```

### 11.4. Audit Program Items — pozycje

```
GET    /api/v1/audit-programs/{id}/items
       Response: lista pozycji programu

POST   /api/v1/audit-programs/{id}/items
       Body: {name, audit_type, planned_quarter, scope_type, scope_name, priority, planned_days, ...}
       Constraint: program status = 'draft'

PUT    /api/v1/audit-program-items/{id}
       Body: {name, planned_quarter, priority, ...}
       Constraint: program status = 'draft'

DELETE /api/v1/audit-program-items/{id}
       Constraint: program status = 'draft'

POST   /api/v1/audit-program-items/{id}/create-engagement
       Effect: tworzy audit_engagement z danych pozycji, linkuje engagement_id
       Constraint: item_status = 'planned', program status = 'approved' OR 'in_execution'

POST   /api/v1/audit-program-items/{id}/cancel
       Body: {cancellation_reason}
       Constraint: item_status IN ('planned', 'in_progress'), program status = 'draft'

POST   /api/v1/audit-program-items/{id}/defer
       Body: {deferral_reason, deferred_to_program_id?}
       Constraint: item_status = 'planned', program status = 'draft'
```

### 11.5. Change Requests

```
GET    /api/v1/audit-programs/{id}/change-requests
       Params: ?status=submitted
       Response: lista CR dla danego programu

POST   /api/v1/audit-programs/{id}/change-requests
       Body: {title, change_type, justification, change_description, proposed_changes, affected_item_id?}
       Constraint: program status IN ('approved', 'in_execution')

GET    /api/v1/change-requests/{id}
       Response: szczegóły CR

PUT    /api/v1/change-requests/{id}
       Body: {title, justification, proposed_changes, ...}
       Constraint: cr.status = 'draft'

POST   /api/v1/change-requests/{id}/submit
       Constraint: cr.status = 'draft'
       Effect: cr.status → 'submitted'

POST   /api/v1/change-requests/{id}/approve
       Body: {review_comment?}
       Constraint: cr.status = 'submitted', user = program approver
       Effect: cr.status → 'approved'

POST   /api/v1/change-requests/{id}/reject
       Body: {review_comment}  // wymagane
       Constraint: cr.status = 'submitted', user = program approver
       Effect: cr.status → 'rejected'

POST   /api/v1/change-requests/{id}/implement
       Constraint: cr.status = 'approved'
       Effect: tworzy korektę programu, aplikuje zmiany, cr.status → 'implemented'
       Response: nowy program (draft)

POST   /api/v1/audit-programs/{id}/implement-change-requests
       Body: {change_request_ids: ["uuid1", "uuid2"]}
       Effect: grupowa implementacja wielu CR w jedną korektę
       Response: nowy program (draft)
```

### 11.6. Transfer audytów

```
POST   /api/v1/audit-program-items/{id}/transfer
       Body: {target_program_id, justification}
       Constraint: source & target program status = 'draft'
       Effect: item transferred, logs in both programs
```

### 11.7. Audit Trail

```
GET    /api/v1/audit-programs/{id}/history
       Params: ?action=status_changed&from=2025-01-01&to=2025-12-31&performed_by=X
       Response: lista wpisów audit_program_history
```

### 11.8. Suppliers & Locations — CRUD

```
GET    /api/v1/suppliers
POST   /api/v1/suppliers
GET    /api/v1/suppliers/{id}
PUT    /api/v1/suppliers/{id}
DELETE /api/v1/suppliers/{id}

GET    /api/v1/locations
POST   /api/v1/locations
GET    /api/v1/locations/{id}
PUT    /api/v1/locations/{id}
DELETE /api/v1/locations/{id}
```

---

## 12. Interfejs użytkownika

### 12.1. Lista programów audytów

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📋 Programy Audytów                                     [+ Nowy program] │
│                                                                           │
│ Filtry: [Rok ▼] [Status ▼] [Właściciel ▼] [Szukaj...        ]           │
│ ☑ Pokaż tylko aktualne wersje                                            │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ AP-2025-001  Program Audytów IT 2025 (v3.0)                        │   │
│ │ 📅 2025-01-01 → 2025-12-31  |  Roczny                             │   │
│ │ Właściciel: Jan Kowalski  |  Status: 🟢 In Execution              │   │
│ │ Audyty: 12 (4 ✅ / 6 🔄 / 2 📅)  |  Budżet: 120/150 dni (80%)   │   │
│ │ 🔔 2 Change Requests oczekujące                                    │   │
│ ├─────────────────────────────────────────────────────────────────────┤   │
│ │ AP-2025-002  Program Audytów Finansowych 2025 (v1.0)               │   │
│ │ 📅 2025-01-01 → 2025-12-31  |  Roczny                             │   │
│ │ Właściciel: Anna Nowak  |  Status: 🟡 Approved                    │   │
│ │ Audyty: 6 (0 ✅ / 0 🔄 / 6 📅)  |  Budżet: 0/80 dni (0%)       │   │
│ ├─────────────────────────────────────────────────────────────────────┤   │
│ │ AP-2024-001  Program Audytów IT 2024 (v2.0)                        │   │
│ │ 📅 2024-01-01 → 2024-12-31  |  Roczny                             │   │
│ │ Właściciel: Jan Kowalski  |  Status: ⬜ Archived                   │   │
│ │ Audyty: 10 (8 ✅ / 0 🔄 / 0 📅 / 2 ❌)                           │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 12.2. Widok programu — Dashboard

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📋 AP-2025-001: Program Audytów IT 2025 (v3.0)                           │
│ Status: 🟢 In Execution  |  Wersja 3 z 3                                │
│ Właściciel: Jan Kowalski  |  Zatwierdził: Maria Nowak (2025-04-10)       │
│ Okres: 2025-01-01 → 2025-12-31 (Roczny)                                 │
│                                                                           │
│ [📝 Korekta] [📊 Raport postępu] [📜 Historia wersji] [🔔 CR (2)]       │
│                                                                           │
│ ── Podsumowanie ──────────────────────────────────────────────────────── │
│                                                                           │
│ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐        │
│ │   12    │ │    4     │ │    6     │ │     2     │ │    0    │        │
│ │ Łącznie │ │ ✅ Done  │ │ 🔄 WIP  │ │ 📅 Plan.  │ │ ❌ Anul.│        │
│ └─────────┘ └──────────┘ └──────────┘ └───────────┘ └─────────┘        │
│                                                                           │
│ Budżet osobodni:  [████████████████░░░░] 120 / 150 (80%)                │
│ Budżet kosztowy:  [██████████████░░░░░░] 96k / 150k PLN (64%)           │
│                                                                           │
│ ── Tabs ──────────────────────────────────────────────────────────────── │
│ [📋 Lista audytów] [📅 Timeline] [🔔 Change Requests] [📜 Historia]     │
│ [📊 Metryki KPI] [📝 Szczegóły programu]                                │
│                                                                           │
│ ── Tab: Lista audytów ────────────────────────────────────────────────── │
│ [+ Dodaj audyt] — widoczny tylko w statusie 'draft'                      │
│ [+ Złóż Change Request] — widoczny w 'approved' / 'in_execution'        │
│                                                                           │
│  Q │ Ref     │ Nazwa                        │ Typ        │ Priorytet│ St.│
│ ───┼─────────┼──────────────────────────────┼────────────┼──────────┼────│
│  1 │ API-001 │ Audyt ISO 27001 - IT         │ Compliance │ 🔴 High  │ ✅ │
│  1 │ API-002 │ Audyt procesu zmian          │ Process    │ 🟡 Med   │ ✅ │
│  2 │ API-003 │ Audyt dostawcy AWS           │ Supplier   │ 🔴 High  │ 🔄 │
│  2 │ API-004 │ Audyt DC Warszawa            │ Physical   │ 🟡 Med   │ 🔄 │
│  2 │ API-005 │ Audyt NIS2 compliance        │ Compliance │ 🔴 Crit  │ 🔄 │
│  2 │ API-006 │ Audyt RODO - HR              │ Compliance │ 🟡 Med   │ 🔄 │
│  3 │ API-007 │ Follow-up Q1                 │ Follow-up  │ 🟡 Med   │ 📅 │
│  3 │ API-008 │ Audyt procesu incydentów     │ Process    │ 🟡 Med   │ 📅 │
│  4 │ API-009 │ Audyt ciągłości działania    │ Process    │ 🔴 High  │ 🔄 │
│  4 │ API-010 │ Audyt dostawcy Azure         │ Supplier   │ 🟡 Med   │ 🔄 │
│  4 │ API-011 │ Audyt biuro Kraków           │ Physical   │ 🟢 Low   │ 📅 │  
│  4 │ API-012 │ Audyt DORA - Treasury        │ Compliance │ 🔴 Crit  │ 📅 │
│                                                                           │
│ ── Tab: Change Requests ──────────────────────────────────────────────── │
│                                                                           │
│  ⏳ CR-2025-003: Dodanie audytu AI Act (nowa regulacja)                  │
│     Typ: add_audit  |  Zgłosił: Piotr Wiśniewski  |  2025-06-01         │
│     Uzasadnienie: "Wejście w życie AI Act wymaga audytu..."              │
│     [✅ Approve] [❌ Reject] [👁 Szczegóły]                              │
│                                                                           │
│  ⏳ CR-2025-004: Przesunięcie audytu API-011 na Q1 2026                  │
│     Typ: modify_schedule  |  Zgłosił: Jan Kowalski  |  2025-06-05       │
│     Uzasadnienie: "Brak zasobów w Q4, remont biura..."                   │
│     [✅ Approve] [❌ Reject] [👁 Szczegóły]                              │
│                                                                           │
│ ── Tab: Historia wersji ──────────────────────────────────────────────── │
│                                                                           │
│  v3.0 — 🟢 In Execution (aktualna)                                      │
│    Zatwierdzona: 2025-04-10 przez Maria Nowak                            │
│    Uzasadnienie: "Dodano audyt NIS2 po wejściu regulacji w życie"        │
│    Zmiany: +1 audyt (NIS2), przesunięto Q audytu ISO                    │
│    [👁 Diff v2→v3]                                                       │
│                                                                           │
│  v2.0 — ⬜ Superseded                                                    │
│    Zatwierdzona: 2025-02-20 przez Maria Nowak                            │
│    Uzasadnienie: "Korekta budżetu po przeglądzie Q1"                    │
│    Zmiany: zmiana budget_planned_days 120→150, +1 audyt follow-up        │
│    [👁 Diff v1→v2]                                                       │
│                                                                           │
│  v1.0 — ⬜ Superseded                                                    │
│    Zatwierdzona: 2025-01-15 przez Maria Nowak                            │
│    Audyty: 8 pozycji                                                     │
│                                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

### 12.3. Timeline / Gantt

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📅 Timeline: Program Audytów IT 2025                                      │
│                                                                           │
│            │ Sty │ Lut │ Mar │ Kwi │ Maj │ Cze │ Lip │ Sie │ Wrz │ Paź │
│ ───────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────│
│ API-001 ISO│ ████████  │     │     │     │     │     │     │     │     │
│ API-002 Zm.│     │ ████████  │     │     │     │     │     │     │     │
│ API-003 AWS│     │     │     │ ████████████████│     │     │     │     │
│ API-004 DC │     │     │     │     │ ██████████ │     │     │     │     │
│ API-005 NIS│     │     │     │     │     │ ████████████████│     │     │
│ ...        │     │     │     │     │     │     │     │     │     │     │
│                                                                           │
│ 🟢 Completed  🔵 In Progress  ⬜ Planned  🔴 Overdue                     │
└────────────────────────────────────────────────────────────────────────────┘
```

### 12.4. Diff viewer

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📊 Porównanie: v2.0 → v3.0                                               │
│ Program: AP-2025-001 Program Audytów IT 2025                              │
│ Korekta zainicjowana: 2025-04-01 przez Jan Kowalski                      │
│ Powód: "Dodano audyt NIS2 po wejściu regulacji w życie"                  │
│ CR: CR-2025-001, CR-2025-002                                             │
│                                                                           │
│ ── Zmiany w polach programu ──────────────────────────────────────────── │
│                                                                           │
│  budget_planned_days:  130 → 150  (+20 dni)                              │
│                                                                           │
│ ── Dodane audyty (+1) ───────────────────────────────────────────────── │
│                                                                           │
│  ➕ API-009: Audyt NIS2 compliance (Compliance, Q2, Priority: Critical)  │
│                                                                           │
│ ── Usunięte/anulowane audyty (0) ────────────────────────────────────── │
│                                                                           │
│  (brak)                                                                   │
│                                                                           │
│ ── Zmodyfikowane audyty (1) ─────────────────────────────────────────── │
│                                                                           │
│  ✏️ API-001: Audyt ISO 27001 - IT                                        │
│     planned_quarter:  1 → 2                                              │
│     planned_start:  2025-01-15 → 2025-04-01                             │
│                                                                           │
│ ── Bez zmian (7 audytów) ────────────────────────────────────────────── │
│                                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Permissions (RBAC)

### 13.1. Matryca uprawnień

| Akcja | Admin | Program Owner | Program Approver | Audit Manager | Auditor |
|-------|-------|---------------|------------------|---------------|---------|
| Wyświetl programy | ✅ | ✅ (swoje + przypisane) | ✅ (do zatwierdzenia) | ✅ (read) | ✅ (read) |
| Utwórz program | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edytuj draft | ✅ | ✅ (swoje) | ❌ | ❌ | ❌ |
| Submit | ✅ | ✅ (swoje) | ❌ | ❌ | ❌ |
| Approve / Reject | ✅ | ❌ | ✅ (przypisane) | ❌ | ❌ |
| Inicjuj korektę | ✅ | ✅ (swoje) | ❌ | ❌ | ❌ |
| Utwórz Change Request | ✅ | ✅ | ❌ | ✅ | ❌ |
| Approve/Reject CR | ✅ | ❌ | ✅ (przypisane) | ❌ | ❌ |
| Implement CR | ✅ | ✅ (swoje) | ❌ | ❌ | ❌ |
| Transfer item | ✅ | ✅ (swoje programy) | ❌ | ❌ | ❌ |
| Wyświetl historię | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wyświetl diff | ✅ | ✅ | ✅ | ✅ | ✅ |
| Usuń program | ✅ | ✅ (draft v1) | ❌ | ❌ | ❌ |
| Archiwizuj | ✅ | ✅ | ❌ | ❌ | ❌ |

### 13.2. Implementacja

```python
# Sprawdzaj uprawnienia na poziomie API view
def check_program_permission(user, program, action):
    if user.is_admin:
        return True

    if action in ('view', 'view_history', 'view_diff'):
        return True  # wszyscy mogą podglądać

    if action in ('create', 'edit_draft', 'submit', 'initiate_correction', 'complete', 'archive', 'delete'):
        return program.owner_id == user.id

    if action in ('approve', 'reject', 'approve_cr', 'reject_cr'):
        return program.approver_id == user.id

    if action == 'create_cr':
        return program.owner_id == user.id or user.has_role('audit_manager')

    return False
```

---

## 14. Seed Data

### 14.1. Przykładowy program (do dev/demo)

```json
{
  "ref_id": "AP-2025-001",
  "name": "Program Audytów IT 2025",
  "period_type": "annual",
  "period_start": "2025-01-01",
  "period_end": "2025-12-31",
  "year": 2025,
  "strategic_objectives": "Zapewnienie zgodności z NIS2, ISO 27001 i RODO. Weryfikacja skuteczności kontroli bezpieczeństwa.",
  "risks_and_opportunities": "Ryzyka: nowa regulacja NIS2 wymaga szybkiej adaptacji. Szanse: usprawnienie procesów po audycie 2024.",
  "scope_description": "Dział IT, zewnętrzni dostawcy chmury, lokalizacje DC Warszawa i DC Kraków.",
  "audit_criteria": "ISO/IEC 27001:2022, NIS2 (Dyrektywa 2022/2555), RODO, Wewnętrzny Standard Bezpieczeństwa SI v3.1",
  "methods": "Audyty on-site i remote. Wywiady, przegląd dokumentacji, testy kontroli, obserwacja.",
  "budget_planned_days": 150,
  "budget_currency": "PLN",
  "items": [
    {"ref_id": "API-001", "name": "Audyt ISO 27001 — Dział IT", "audit_type": "compliance", "planned_quarter": 1, "priority": "high", "planned_days": 20, "scope_type": "org_unit", "scope_name": "Dział IT"},
    {"ref_id": "API-002", "name": "Audyt procesu zarządzania zmianami", "audit_type": "process", "planned_quarter": 1, "priority": "medium", "planned_days": 10, "scope_type": "process", "scope_name": "Change Management"},
    {"ref_id": "API-003", "name": "Audyt dostawcy AWS", "audit_type": "supplier", "planned_quarter": 2, "priority": "high", "planned_days": 15, "scope_type": "supplier", "scope_name": "Amazon Web Services"},
    {"ref_id": "API-004", "name": "Audyt bezp. fizycznego DC Warszawa", "audit_type": "physical", "planned_quarter": 2, "priority": "medium", "planned_days": 8, "scope_type": "location", "scope_name": "DC Warszawa"},
    {"ref_id": "API-005", "name": "Audyt NIS2 compliance", "audit_type": "compliance", "planned_quarter": 2, "priority": "critical", "planned_days": 25, "scope_type": "organization"},
    {"ref_id": "API-006", "name": "Audyt RODO — Dział HR", "audit_type": "compliance", "planned_quarter": 2, "priority": "medium", "planned_days": 12, "scope_type": "org_unit", "scope_name": "Dział HR"},
    {"ref_id": "API-007", "name": "Follow-up ustaleń Q1", "audit_type": "follow_up", "planned_quarter": 3, "priority": "medium", "planned_days": 5},
    {"ref_id": "API-008", "name": "Audyt procesu incydentów bezpieczeństwa", "audit_type": "process", "planned_quarter": 3, "priority": "medium", "planned_days": 12, "scope_type": "process", "scope_name": "Incident Response"},
    {"ref_id": "API-009", "name": "Audyt ciągłości działania (BCP/DR)", "audit_type": "process", "planned_quarter": 4, "priority": "high", "planned_days": 15, "scope_type": "process", "scope_name": "Business Continuity"},
    {"ref_id": "API-010", "name": "Audyt dostawcy Microsoft Azure", "audit_type": "supplier", "planned_quarter": 4, "priority": "medium", "planned_days": 12, "scope_type": "supplier", "scope_name": "Microsoft Azure"},
    {"ref_id": "API-011", "name": "Audyt bezp. fizycznego biuro Kraków", "audit_type": "physical", "planned_quarter": 4, "priority": "low", "planned_days": 6, "scope_type": "location", "scope_name": "Biuro Kraków"},
    {"ref_id": "API-012", "name": "Audyt DORA — Treasury", "audit_type": "compliance", "planned_quarter": 4, "priority": "critical", "planned_days": 20, "scope_type": "org_unit", "scope_name": "Treasury"}
  ]
}
```

---

## 15. AI jako opcjonalny plugin — 2 use case'y

### 15.1. Zasada działania

Identycznie jak w pozostałych modułach: AI korzysta z TEGO SAMEGO `ai_provider_config`. Feature toggles:

```sql
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_audit_program_suggest  BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS
    feature_audit_program_review   BOOLEAN DEFAULT TRUE;
```

Rozszerzenie GET `/api/v1/config/features`:

```json
{
  "ai_enabled": true,
  "ai_features": {
    "audit_program_suggest": true,
    "audit_program_review": true
  }
}
```

Gdy AI off: ZERO elementów AI w UI programu audytów. System kompletny bez AI.

### 15.2. UC-AP-1: AI-sugerowany program na bazie kontekstu i danych systemowych (MUST HAVE)

#### Problem

CAE/CISO tworzy nowy program audytów. Musi przejrzeć: ryzyka, compliance assessments, otwarte ustalenia, dostawców, lokalizacje, poprzednie programy — i złożyć priorytetyzowaną listę. To 2-4 tygodnie pracy, a dane są rozproszone po wielu modułach systemu.

#### Kluczowe ograniczenie: kontekst programu

Programów w organizacji może być wiele, specjalizowanych:

| Program | Kto tworzy | Zakres | Dane wejściowe AI |
|---------|-----------|--------|-------------------|
| Audyt wewnętrzny (risk-based) | CAE | Procesy, systemy, governance | Rejestr ryzyk, poprzednie ustalenia |
| Audyty zgodności CISO | CISO | ISO 27001, NIS2, DORA, RODO | Compliance assessments, frameworki |
| Audyty dostawców | CISO / Procurement | Dostawcy krytyczni | Lista dostawców, krytyczność, daty audytów |
| Audyty lokalizacji | CISO / Facility | DC, biura, magazyny | Lista lokalizacji, krytyczność, daty audytów |
| Audyty finansowe | CFO / IA | SOX, kontrole finansowe | Odrębny kontekst |
| Audyty jakości | Quality Manager | ISO 9001, procesy produkcyjne | Odrębny kontekst |

**AI NIE MOŻE zgadywać** jaki to program. Dlatego przed generowaniem sugestii, Owner musi podać kontekst.

#### Trigger

Przycisk **"✨ Zasugeruj pozycje AI"** — widoczny tylko w programie ze statusem `draft`, gdy AI włączone.

#### Krok 1: Dialog kontekstowy (WYMAGANY przed wywołaniem AI)

Owner wypełnia formularz kontekstu:

```
┌────────────────────────────────────────────────────────────────┐
│ ✨ AI: Zasugeruj pozycje programu audytów                      │
│                                                                 │
│ Kontekst programu (wymagane):                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Zakres tematyczny programu: *                               │ │
│ │ [▼ Wybierz jeden lub więcej]                                │ │
│ │   ☑ Audyty zgodności (compliance frameworks)                │ │
│ │   ☐ Audyty procesowe (risk-based)                           │ │
│ │   ☑ Audyty dostawców                                        │ │
│ │   ☑ Audyty lokalizacji (bezpieczeństwo fizyczne)            │ │
│ │   ☐ Audyty follow-up (weryfikacja ustaleń)                  │ │
│ │   ☐ Inne                                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Dodatkowy kontekst (opcjonalny, free-text):                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ "Jestem CISO. Chcę zaplanować audyty zgodności z ISO 27001 │ │
│ │  i NIS2 dla całej organizacji, plus audyty kluczowych       │ │
│ │  dostawców chmury i obu data center. Budżet ~100 osobodni." │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Uwzględnij dane z systemu:                                      │
│   ☑ Compliance assessments (aktualny % zgodności per framework)│
│   ☑ Otwarte audit findings (niezamknięte ustalenia)            │
│   ☑ Rejestr ryzyk (scenariusze ryzyka high/critical)           │
│   ☑ Lista dostawców (z krytycznością)                           │
│   ☑ Lista lokalizacji (z krytycznością)                         │
│   ☑ Poprzedni program (co było audytowane, kiedy)               │
│   ☐ Frameworki z datą wejścia w życie                           │
│                                                                 │
│                              [Anuluj] [✨ Generuj sugestie]     │
└────────────────────────────────────────────────────────────────┘
```

#### Krok 2: Context Builder (backend)

Na bazie wybranych opcji, system buduje kontekst dla AI:

```python
def build_audit_program_context(
    program: AuditProgram,
    scope_themes: list[str],        # ['compliance', 'supplier', 'physical']
    additional_context: str,         # free-text od usera
    include_assessments: bool,
    include_findings: bool,
    include_risks: bool,
    include_suppliers: bool,
    include_locations: bool,
    include_previous_program: bool,
    include_frameworks: bool,
) -> str:
    """
    Buduje kontekst tekstowy na potrzeby promptu AI.
    Zbiera dane z wielu modułów systemu i formatuje je.
    """
    context_parts = []

    # Podstawowe info o programie
    context_parts.append(f"""
PROGRAM: {program.name}
Okres: {program.period_start} → {program.period_end}
Organizacja: {program.org_unit.name if program.org_unit else 'Cała organizacja'}
Zakres tematyczny: {', '.join(scope_themes)}
""")

    if additional_context:
        context_parts.append(f"KONTEKST OD UŻYTKOWNIKA: {additional_context}")

    # Compliance assessments
    if include_assessments and 'compliance' in scope_themes:
        assessments = ComplianceAssessment.objects.filter(
            status='in_progress',
            org_unit_id=program.org_unit_id
        ).select_related('framework')
        if assessments.exists():
            lines = ["AKTUALNE OCENY ZGODNOŚCI:"]
            for a in assessments:
                lines.append(
                    f"- {a.framework.name}: {a.compliance_score}% "
                    f"({a.non_compliant_count} niezgodności, "
                    f"{a.partially_count} częściowo)"
                )
            context_parts.append('\n'.join(lines))

    # Otwarte findings
    if include_findings:
        findings = AuditFinding.objects.filter(
            status__in=['open', 'acknowledged', 'in_remediation'],
            audit_engagement__org_unit_id=program.org_unit_id
        ).order_by('-severity')[:20]
        if findings.exists():
            lines = ["OTWARTE USTALENIA AUDYTOWE:"]
            for f in findings:
                lines.append(
                    f"- [{f.severity.upper()}] {f.title} "
                    f"(z audytu: {f.audit_engagement.name}, "
                    f"status: {f.status})"
                )
            context_parts.append('\n'.join(lines))

    # Risk scenarios
    if include_risks:
        risks = RiskScenario.objects.filter(
            risk_level__in=['high', 'critical'],
        ).order_by('-risk_level')[:20]
        if risks.exists():
            lines = ["SCENARIUSZE RYZYKA (HIGH/CRITICAL):"]
            for r in risks:
                lines.append(f"- [{r.risk_level.upper()}] {r.name}")
            context_parts.append('\n'.join(lines))

    # Dostawcy
    if include_suppliers and 'supplier' in scope_themes:
        suppliers = Supplier.objects.filter(
            status='active'
        ).order_by('-criticality')
        if suppliers.exists():
            lines = ["AKTYWNI DOSTAWCY:"]
            for s in suppliers:
                last_audit = get_last_audit_date(scope_type='supplier', scope_id=s.id)
                lines.append(
                    f"- {s.name} (krytyczność: {s.criticality}, "
                    f"ostatni audyt: {last_audit or 'nigdy'})"
                )
            context_parts.append('\n'.join(lines))

    # Lokalizacje
    if include_locations and 'physical' in scope_themes:
        locations = Location.objects.filter(
            status='active'
        ).order_by('-criticality')
        if locations.exists():
            lines = ["AKTYWNE LOKALIZACJE:"]
            for loc in locations:
                last_audit = get_last_audit_date(scope_type='location', scope_id=loc.id)
                lines.append(
                    f"- {loc.name} ({loc.location_type}, krytyczność: {loc.criticality}, "
                    f"ostatni audyt: {last_audit or 'nigdy'})"
                )
            context_parts.append('\n'.join(lines))

    # Poprzedni program
    if include_previous_program:
        prev = get_previous_program(program)
        if prev:
            items = AuditProgramItem.objects.filter(audit_program_id=prev.id)
            lines = [f"POPRZEDNI PROGRAM: {prev.name} ({prev.period_start} → {prev.period_end})"]
            for item in items:
                lines.append(
                    f"- {item.name} ({item.audit_type}, {item.item_status})"
                )
            context_parts.append('\n'.join(lines))

    # Frameworki z datą wejścia w życie
    if include_frameworks and 'compliance' in scope_themes:
        frameworks = Framework.objects.filter(
            is_active=True,
            document_type__in=['regulation', 'standard']
        )
        if frameworks.exists():
            lines = ["AKTYWNE FRAMEWORKI / REGULACJE:"]
            for fw in frameworks:
                lines.append(
                    f"- {fw.name} (typ: {fw.document_type}, "
                    f"wejście w życie: {fw.effective_date or 'N/A'})"
                )
            context_parts.append('\n'.join(lines))

    return '\n\n'.join(context_parts)
```

#### Krok 3: Prompt template

```
You are an experienced Chief Audit Executive (CAE) / CISO helping to build
an annual audit program.

Based on the context below, suggest audit program items (planned audits).

RULES:
- Only suggest audits within the declared scope themes
- Prioritize based on: risk level, compliance gaps, time since last audit,
  regulatory deadlines, open findings
- For each suggested audit, provide:
  * name (concise, descriptive)
  * audit_type (process | compliance | supplier | physical | follow_up | combined)
  * planned_quarter (1-4)
  * priority (critical | high | medium | low) with justification
  * estimated_days (realistic, consider scope complexity)
  * scope_type and scope_name
  * framework_names (if compliance audit)
  * brief rationale (1-2 sentences: WHY this audit, WHY this priority)
- If there are open high/critical findings, suggest follow-up audits
- If critical suppliers/locations were not audited in 12+ months, flag them
- Stay within the budget hint if provided
- Respond ONLY in JSON array format

CONTEXT:
{context}

Respond with a JSON array of suggested audit program items.
```

#### Krok 4: Output → review

AI zwraca JSON → system parsuje → wyświetla jako propozycje do review:

```
┌────────────────────────────────────────────────────────────────┐
│ ✨ AI zasugerowało 8 pozycji programu                          │
│                                                                 │
│ ☑ Q1 | Audyt ISO 27001 — Dział IT          | Compliance | High │
│   Uzasadnienie: "Compliance score 72%, 5 niezgodności.         │
│   Ostatni audyt: 14 mies. temu. Priorytet ze względu           │
│   na zbliżający się audyt certyfikacyjny."                     │
│   Szacowane dni: 20                                            │
│                                                                 │
│ ☑ Q1 | Audyt dostawcy AWS                   | Supplier  | High │
│   Uzasadnienie: "Krytyczność: critical. Ostatni audyt: nigdy.  │
│   Dostawca hostuje systemy produkcyjne."                       │
│   Szacowane dni: 15                                            │
│                                                                 │
│ ☑ Q2 | Audyt NIS2 compliance                | Compliance| Crit │
│   Uzasadnienie: "Nowa regulacja, effective date 2024-10-17.    │
│   Compliance assessment: 62%. Brak wcześniejszego audytu."     │
│   Szacowane dni: 25                                            │
│                                                                 │
│ ☑ Q2 | Audyt DC Warszawa — bezp. fizyczne   | Physical  | Med  │
│   ...                                                          │
│                                                                 │
│ ☐ Q3 | Follow-up ustaleń High z 2024        | Follow-up | Med  │
│   ...  (odznaczone = user nie chce tej pozycji)                │
│                                                                 │
│ Suma zaznaczonych: 7 audytów, ~115 osobodni                    │
│                                                                 │
│                    [Anuluj] [Dodaj zaznaczone do programu]     │
└────────────────────────────────────────────────────────────────┘
```

Owner zaznacza/odznacza, modyfikuje, i klika "Dodaj zaznaczone" → pozycje lądują w draft programu jako zwykłe `audit_program_items`.

#### Feature toggle

`ai_provider_config.feature_audit_program_suggest`

### 15.3. UC-AP-2: AI przegląd kompletności programu (MUST HAVE)

#### Problem

Owner stworzył program (ręcznie lub z pomocą AI) i chce go złożyć do zatwierdzenia. Zanim to zrobi, chce upewnić się, że niczego nie pominął — żaden krytyczny dostawca, żadna regulacja, żaden open finding.

#### Trigger

Przycisk **"✨ Sprawdź kompletność AI"** — widoczny w programie ze statusem `draft`, gdy AI włączone. Rekomendowany do użycia PRZED submittem.

#### Krok 1: Context Builder

System automatycznie buduje kontekst:
- Aktualny program (wszystkie pozycje)
- Te same źródła danych co UC-AP-1 (assessments, findings, ryzyka, dostawcy, lokalizacje, frameworki, poprzedni program)
- Różnica: NIE wymaga dialogu kontekstowego — system czyta istniejące pozycje programu i wnioskuje zakres

```python
def infer_program_scope(program: AuditProgram) -> list[str]:
    """
    Na bazie istniejących pozycji programu, wnioskuje zakres tematyczny.
    """
    items = AuditProgramItem.objects.filter(audit_program_id=program.id)
    types = set(item.audit_type for item in items)

    scope = []
    if 'compliance' in types:
        scope.append('compliance')
    if 'process' in types:
        scope.append('process')
    if 'supplier' in types:
        scope.append('supplier')
    if 'physical' in types:
        scope.append('physical')
    if 'follow_up' in types:
        scope.append('follow_up')
    return scope
```

#### Krok 2: Prompt template

```
You are an experienced Chief Audit Executive reviewing an audit program
for completeness before approval.

Analyze the program below and identify:
1. GAPS — important areas NOT covered by the program that SHOULD be
   (based on active risks, compliance status, supplier/location criticality,
   open findings, regulatory requirements)
2. WARNINGS — potential issues with the current program
   (unrealistic timelines, insufficient days for scope, missing follow-ups,
   over/under-coverage)
3. CONFIRMATIONS — areas that ARE well covered

For each observation, provide:
- type: "gap" | "warning" | "confirmation"
- severity: "critical" | "high" | "medium" | "info"
- title: short description
- details: 1-3 sentences explaining the observation
- recommendation: what to do about it (for gaps and warnings)
- related_data: reference to specific risk/finding/supplier/framework

CURRENT PROGRAM:
{program_items_json}

SYSTEM DATA:
{context}

Respond ONLY in JSON array format.
```

#### Krok 3: Output → review

```
┌────────────────────────────────────────────────────────────────┐
│ ✨ AI: Przegląd kompletności programu                          │
│ Program: AP-2025-002 Program Audytów CISO 2025 (draft)         │
│                                                                 │
│ ── Luki (2) ──────────────────────────────────────────────────│
│                                                                 │
│ 🔴 CRITICAL: Brak audytu NIS2                                  │
│    Framework NIS2 jest aktywny, compliance assessment: 62%.     │
│    Regulacja obowiązuje od 10/2024. Żadna pozycja programu     │
│    nie pokrywa NIS2.                                           │
│    → Rekomendacja: Dodaj audyt NIS2 compliance (Q1-Q2,         │
│      est. 20-25 dni)                                           │
│                           [+ Dodaj do programu]                │
│                                                                 │
│ 🟡 HIGH: Dostawca AWS (critical) — brak audytu od 14 mies.    │
│    Amazon Web Services jest klasyfikowany jako critical.        │
│    Ostatni audyt: 2023-11. Rekomendowany cykl: 12 mies.       │
│    → Rekomendacja: Dodaj audyt dostawcy AWS (Q2, est. 15 dni) │
│                           [+ Dodaj do programu]                │
│                                                                 │
│ ── Ostrzeżenia (2) ──────────────────────────────────────────│
│                                                                 │
│ 🟡 MEDIUM: 3 otwarte findings High bez follow-up              │
│    Z programu 2024 pozostały 3 ustalenia severity: High        │
│    w statusie 'in_remediation'. Brak pozycji follow-up.        │
│    → Rekomendacja: Dodaj follow-up w Q2-Q3                     │
│                           [+ Dodaj do programu]                │
│                                                                 │
│ 🟡 MEDIUM: API-005 (Audyt NIS2) — 10 dni może być             │
│    niewystarczające                                            │
│    NIS2 ma 42 wymagania, compliance 62%. Przy takim zakresie   │
│    rekomendowane minimum to 20 osobodni.                       │
│    → Rekomendacja: Zwiększ planned_days do 20-25               │
│                                                                 │
│ ── Potwierdzone pokrycie (4) ────────────────────────────────│
│                                                                 │
│ ✅ INFO: ISO 27001 — pokryty (API-001, Q1, 20 dni)            │
│ ✅ INFO: DC Warszawa — pokryty (API-004, Q2, 8 dni)           │
│ ✅ INFO: Dostawca Azure — pokryty (API-010, Q4, 12 dni)       │
│ ✅ INFO: Budżet 150 dni — realistyczny na 12 audytów          │
│                                                                 │
│                                              [Zamknij]         │
└────────────────────────────────────────────────────────────────┘
```

Przycisk **"+ Dodaj do programu"** przy każdej luce: AI od razu proponuje gotowy `audit_program_item` na bazie swojej rekomendacji. Owner klika → pozycja trafia do draft.

#### Feature toggle

`ai_provider_config.feature_audit_program_review`

### 15.4. AI Endpoints

```
POST   /api/v1/ai/audit-program/suggest-items
       Body: {
         program_id,
         scope_themes: ["compliance", "supplier", "physical"],
         additional_context: "free text...",
         include_assessments: true,
         include_findings: true,
         include_risks: true,
         include_suppliers: true,
         include_locations: true,
         include_previous_program: true,
         include_frameworks: true
       }
       Constraint: program status = 'draft', ai_enabled, feature_audit_program_suggest
       Response: {suggestions: [{name, audit_type, planned_quarter, priority, ...}, ...]}

POST   /api/v1/ai/audit-program/review-completeness
       Body: {program_id}
       Constraint: program status = 'draft', ai_enabled, feature_audit_program_review
       Response: {observations: [{type, severity, title, details, recommendation, ...}, ...]}
```

Oba endpointy: HTTP 503 gdy AI niedostępne. Logi w `ai_audit_log`.

### 15.5. UI: warunkowy rendering

```javascript
const { aiEnabled, aiFeatures } = useFeatureFlags();

// Tylko w draft programu
{program.status === 'draft' && aiEnabled && aiFeatures.audit_program_suggest && (
  <AISuggestItemsButton programId={program.id} />
)}

{program.status === 'draft' && aiEnabled && aiFeatures.audit_program_review && (
  <AIReviewCompletenessButton programId={program.id} />
)}

// Gdy AI off: zero buttonów, zero ikon, zero wzmianek
```

---

## 16. Sekwencja implementacji

### Faza AP-1: Model i API (1.5 tygodnia)

| # | Zadanie | Zależność |
|---|---------|-----------|
| AP-1.0 | ANALIZA istniejącego kodu (modele, API, frontend) | — |
| AP-1.1 | Raport rozbieżności + propozycja adaptacji | AP-1.0 |
| AP-1.2 | Migration: tabela `audit_programs` | AP-1.1 |
| AP-1.3 | Migration: tabela `audit_program_items` | AP-1.2 |
| AP-1.4 | Migration: tabela `audit_program_change_requests` | AP-1.2 |
| AP-1.5 | Migration: tabela `audit_program_history` | AP-1.2 |
| AP-1.6 | Migration: tabela `audit_program_version_diffs` | AP-1.2 |
| AP-1.7 | Migration: tabela `suppliers` | AP-1.1 |
| AP-1.8 | Migration: tabela `locations` | AP-1.1 |
| AP-1.9 | State machine: walidacja przejść statusów | AP-1.2 |
| AP-1.10 | Wersjonowanie: `initiate_correction()` | AP-1.2, AP-1.3 |
| AP-1.11 | Auto-diff: `generate_version_diff()` | AP-1.6 |
| AP-1.12 | Change Request workflow | AP-1.4 |
| AP-1.13 | CR implementation: `implement_change_request()` | AP-1.10, AP-1.12 |
| AP-1.14 | Transfer: `transfer_audit_item()` | AP-1.3 |
| AP-1.15 | Audit trail: automatyczne logowanie do history | AP-1.5 |
| AP-1.16 | API CRUD: audit_programs, items, CR, history, diff | AP-1.2–AP-1.15 |
| AP-1.17 | API: suppliers, locations CRUD | AP-1.7, AP-1.8 |
| AP-1.18 | Auto-recalculate: budget_actual_days, item counts | AP-1.3 |
| AP-1.19 | Seed data: demo program z 12 pozycjami | AP-1.16 |

### Faza AP-2: Frontend (1.5 tygodnia)

| # | Zadanie | Zależność |
|---|---------|-----------|
| AP-2.1 | UI: Lista programów (filtrowanie, sortowanie) | Faza AP-1 |
| AP-2.2 | UI: Dashboard programu (tabs, stats, progress bars) | Faza AP-1 |
| AP-2.3 | UI: Lista pozycji programu (tabela z sortowaniem, filterami) | Faza AP-1 |
| AP-2.4 | UI: Formularz programu (tworzenie/edycja draft) | Faza AP-1 |
| AP-2.5 | UI: Formularz pozycji programu (tworzenie/edycja) | Faza AP-1 |
| AP-2.6 | UI: Workflow statusów (submit, approve, reject buttons + dialogi) | AP-1.9 |
| AP-2.7 | UI: Korekta — dialog z uzasadnieniem + nowa wersja | AP-1.10 |
| AP-2.8 | UI: Change Request — formularz, lista, approve/reject | AP-1.12 |
| AP-2.9 | UI: Historia wersji (timeline z diff links) | AP-1.11 |
| AP-2.10 | UI: Diff viewer (porównanie wersji) | AP-1.11 |
| AP-2.11 | UI: Audit trail (historia zmian z filtrami) | AP-1.15 |
| AP-2.12 | UI: Timeline / Gantt (pozycje w czasie) | AP-2.3 |
| AP-2.13 | UI: Transfer audytu między programami (dialog) | AP-1.14 |
| AP-2.14 | UI: Suppliers CRUD | AP-1.17 |
| AP-2.15 | UI: Locations CRUD | AP-1.17 |

**SYSTEM KOMPLETNY I GOTOWY BEZ AI PO FAZIE AP-2 (~3 tygodnie)**

### Faza AP-3: AI Plugin (3-4 dni, OPCJONALNA)

| # | Zadanie | Zależność |
|---|---------|-----------|
| AP-3.1 | ALTER `ai_provider_config`: +2 feature toggles | Faza AP-1 |
| AP-3.2 | Rozszerzenie `/api/v1/config/features` o nowe toggles | AP-3.1 |
| AP-3.3 | Context Builder: `build_audit_program_context()` | Faza AP-1 |
| AP-3.4 | UC-AP-1: Prompt template + endpoint `POST /ai/audit-program/suggest-items` | AP-3.3 |
| AP-3.5 | UC-AP-2: Prompt template + endpoint `POST /ai/audit-program/review-completeness` | AP-3.3 |
| AP-3.6 | UI: Dialog kontekstowy AI Suggest (multi-select scope, free-text, checkboxy źródeł) | AP-3.4 |
| AP-3.7 | UI: Panel review sugestii (checkbox list, dodaj zaznaczone) | AP-3.4 |
| AP-3.8 | UI: Panel przeglądu kompletności (gaps, warnings, confirmations, quick-add) | AP-3.5 |
| AP-3.9 | UI: Warunkowy rendering (zero AI gdy off) | AP-3.1 |
| AP-3.10 | Testy: mocks, degradacja, feature flags, 503 when off | AP-3.4, AP-3.5 |

**Czas całkowity: ~3.5 tygodnia** (3 tyg. MVP bez AI + 3-4 dni AI plugin)

Po zakończeniu tego modułu, przechodzimy do **Modułu Audit Engagement** (realizacja audytu: scoping → fieldwork → findings → reporting).
