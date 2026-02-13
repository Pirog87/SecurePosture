# SecurePosture — Kontekst Organizacyjny (Organizational Context)

> **Wersja:** 1.0 | **Data:** 2026-02-11 | **Status:** Wymagania analityczne
> **Powiązania:** Moduł 4 (Struktura organizacyjna), ISO 27001:2022 klauzula 4, ISO 22301:2019 klauzula 4

---

## 1. Cel funkcjonalności

### 1.1. Problem

CISO musi udokumentować **kontekst organizacji** na potrzeby:
- **ISO 27001:2022** — klauzula 4.1 (kontekst wewnętrzny/zewnętrzny), 4.2 (interesariusze), 4.3 (zakres ISMS)
- **ISO 22301:2019** — klauzula 4.1 (kontekst BCMS), 4.2 (wymagania interesariuszy), 4.3 (zakres BCMS)
- **NIS2, DORA** — analogiczne wymagania dot. identyfikacji kontekstu i zobowiązań

Dziś te informacje leżą w rozproszonych dokumentach Word/Excel. Brak centralnego źródła prawdy, brak powiązania kontekstu z poziomem organizacyjnym, brak mechanizmu dziedziczenia (to co dotyczy spółki, dotyczy też jej pionów).

### 1.2. Rozwiązanie

Rozszerzenie istniejącego modułu Struktury Organizacyjnej o **formularze kontekstu organizacyjnego** na każdym poziomie drzewa (Spółka → Pion → Dział → Zespół) z **mechanizmem dziedziczenia w dół** — jeśli RODO jest zdefiniowane na Spółce, automatycznie obowiązuje na wszystkich Pionach, Działach i Zespołach bez konieczności powielania.

### 1.3. Korzyści

- Jedno źródło prawdy o kontekście organizacyjnym — koniec z rozproszonymi dokumentami
- Gotowy dowód audytowy (klauzula 4 ISO 27001 / 22301) — eksport do PDF/Word
- Dziedziczenie eliminuje powielanie — RODO definiujesz raz na Spółce, nie 50 razy
- Kontekst powiązany ze strukturą org. → możliwość drill-down i raportowania per pion
- Przeglądanie i aktualizacja kontekstu z cyklem review (np. co 12 miesięcy)

---

## 2. Struktura organizacyjna — rozszerzenie

### 2.1. Drzewo (istniejące, bez zmian)

```
Spółka (depth=1)
├── Pion Rozwoju (depth=2)
│   ├── Dział Frontend (depth=3)
│   │   ├── Zespół UI (depth=4)
│   │   └── Zespół Mobile (depth=4)
│   └── Dział Backend (depth=3)
├── Pion Infrastruktury (depth=2)
│   ├── Dział Sieci (depth=3)
│   └── Dział Systemów (depth=3)
└── Pion Sprzedaży (depth=2)
```

Maksymalnie 4 poziomy. Każdy węzeł = `org_units` z `parent_id` (self-ref FK).

### 2.2. Atrybuty jednostki organizacyjnej (istniejące + nowe)

| Atrybut | Typ | Istniejący? | Opis |
|---------|-----|-------------|------|
| name | VARCHAR | ✅ Tak | Nazwa: "Pion Rozwoju" |
| code | VARCHAR | ✅ Tak | Symbol: "DEV", "INFRA", "SALES" |
| depth | INT | ✅ Tak | Poziom: 1-4 |
| parent_id | FK | ✅ Tak | Jednostka nadrzędna w drzewie |
| owner | VARCHAR | ✅ Tak | Właściciel biznesowy jednostki |
| security_coordinator | VARCHAR | ✅ Tak (zmiana nazwy) | Koordynator bezpieczeństwa (dawniej: Security Contact) |
| description | TEXT | 🆕 Nowe | Krótki opis jednostki |
| headcount | INT | 🆕 Nowe | Liczba pracowników (opcjonalne) |
| context_review_date | DATE | 🆕 Nowe | Data ostatniego przeglądu kontekstu |
| context_next_review | DATE | 🆕 Nowe | Data następnego przeglądu (auto: +12m) |
| context_reviewer | VARCHAR | 🆕 Nowe | Kto dokonał przeglądu |
| context_status | ENUM | 🆕 Nowe | `draft`, `reviewed`, `approved`, `outdated` |

---

## 3. Kontekst organizacyjny — formularze

Na każdym poziomie drzewa CISO może wypełnić formularz kontekstu. Formularz składa się z **7 sekcji**, z których każda odpowiada wymaganiom ISO.

### 3.1. Sekcja 1: Opis ogólny (rich text)

> **Pola opisowe:** Wszystkie pola tekstowe przeznaczone na większą ilość tekstu (oznaczone jako RICH TEXT lub TEXT w tabelach poniżej) wyposażone są w pasek formatowania: wybór czcionki, pogrubienie, kursywa, podkreślenie, kolor czcionki, listy punktowane/numerowane, nagłówki, linki. Dotyczy to całej funkcjonalności kontekstu organizacyjnego.

| Pole | Typ | Dziedziczenie | Opis |
|------|-----|---------------|------|
| mission_vision | RICH TEXT | Tak (z nadpisaniem) | Misja, wizja, wartości organizacji / jednostki |
| description | RICH TEXT | Nie | Opis działalności jednostki — czym się zajmuje, jaki jest zakres |
| key_products_services | RICH TEXT | Tak (addytywne) | Główne produkty i usługi dostarczane przez jednostkę |
| strategic_objectives | RICH TEXT | Tak (addytywne) | Cele strategiczne istotne z perspektywy bezpieczeństwa |

**Źródło ISO:** 27001:2022 klauzula 4.1 (kontekst organizacji), 22301:2019 klauzula 4.1.

### 3.2. Sekcja 2: Czynniki wewnętrzne i zewnętrzne (ISO 4.1)

Rejestr czynników (issues) wpływających na zdolność organizacji do osiągnięcia celów ISMS/BCMS.

**Tabela: `org_context_issues`**

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK | — |
| org_unit_id | FK → org_units | Na którym poziomie zdefiniowany |
| issue_type | ENUM | `internal`, `external` |
| category | FK → dictionary_items | Kategoria (słownik: patrz 3.2.1) |
| title | VARCHAR(500) | Tytuł czynnika |
| description | TEXT | Opis wpływu na organizację |
| impact_level | ENUM | `positive` (szansa), `negative` (zagrożenie), `neutral` |
| relevance | ENUM | `high`, `medium`, `low` |
| response_action | TEXT | Jak organizacja reaguje / planuje reagować |
| review_date | DATE | Data ostatniej weryfikacji |
| is_inherited | BOOLEAN (wyliczeniowe) | Czy odziedziczony z wyższego poziomu |
| source_org_unit_id | FK → org_units NULLABLE | Jeśli odziedziczony — skąd pochodzi |
| is_active | BOOLEAN | Soft delete |
| created_at, updated_at | DATETIME | — |

#### 3.2.1. Słownik kategorii czynników (`CONTEXT_ISSUE_CATEGORY`)

> **Zarządzanie słownikiem:** Wartości poniżej to wstępny seed. Słownik trafia do sekcji Słowniki (`dictionary_items`) z pełną możliwością: edycji, usuwania, dodawania nowych pozycji, ustawiania kolejności wyświetlania. Dodatkowo z poziomu formularza kontekstu użytkownik może dodać nową pozycję do słownika inline (przycisk "+" obok dropdown'a).

**Czynniki wewnętrzne (seed):**
- Kultura organizacyjna
- Struktura zarządzania i governance
- Zasoby ludzkie i kompetencje
- Infrastruktura IT i technologia
- Procesy biznesowe
- Dojrzałość bezpieczeństwa
- Budżet i finanse
- Zarządzanie zmianą

**Czynniki zewnętrzne (seed):**
- Otoczenie prawne i regulacyjne
- Otoczenie rynkowe i konkurencja
- Otoczenie technologiczne
- Otoczenie polityczne i geopolityczne
- Warunki ekonomiczne
- Zmiany klimatyczne i środowisko (ISO 27001 Amendment 1)
- Łańcuch dostaw
- Oczekiwania klientów
- Media i reputacja

### 3.3. Sekcja 3: Zobowiązania prawne i regulacyjne

Rejestr aktów prawnych, regulacji i standardów obowiązujących organizację / jednostkę.

**Tabela: `org_context_obligations`**

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK | — |
| org_unit_id | FK → org_units | Na którym poziomie zdefiniowany |
| obligation_type | ENUM | `legal` (ustawa), `regulatory` (regulator), `contractual` (umowa), `standard` (norma dobrowolna), `internal` (polityka wewnętrzna) |
| regulation_id | FK → dictionary_items | Regulacja ze słownika (patrz 3.3.1) |
| custom_name | VARCHAR(500) | Nazwa własna (jeśli nie w słowniku) |
| description | TEXT | Opis zobowiązania i wpływ na jednostkę |
| responsible_person | VARCHAR(200) | Osoba odpowiedzialna za compliance |
| compliance_status | ENUM | `compliant`, `partially_compliant`, `non_compliant`, `not_assessed` |
| compliance_evidence | TEXT | Dowody/referencje do dokumentacji zgodności |
| effective_from | DATE | Od kiedy obowiązuje |
| review_date | DATE | Data ostatniego przeglądu |
| notes | TEXT | Dodatkowe uwagi |
| is_active | BOOLEAN | Soft delete |
| created_at, updated_at | DATETIME | — |

**Dziedziczenie:** Pełne w dół. Jeśli RODO jest zdefiniowane na Spółce → automatycznie widoczne na Pionie, Dziale, Zespole. Jednostka niższa **nie może usunąć** odziedziczonego zobowiązania — może jedynie dodać notatki/uszczegółowienie lokalne.

#### 3.3.1. Słownik regulacji (`REGULATION`)

> **Zarządzanie słownikiem:** Wartości poniżej to wstępny seed. Słownik trafia do sekcji Słowniki z pełną edycją (dodawanie, usuwanie, zmiana kolejności). Z poziomu formularza kontekstu użytkownik może dodać nową regulację inline.

| Kod | Nazwa | Typ | Opis |
|-----|-------|-----|------|
| RODO | RODO / GDPR | legal | Rozporządzenie o ochronie danych osobowych |
| NIS2 | Dyrektywa NIS2 | regulatory | Cyberbezpieczeństwo infrastruktury krytycznej |
| DORA | Rozporządzenie DORA | regulatory | Odporność cyfrowa sektora finansowego |
| KSC | Krajowy System Cyberbezpieczeństwa | legal | Ustawa o KSC |
| PCI_DSS | PCI DSS 4.0 | standard | Standard bezpieczeństwa danych kart płatniczych |
| ISO27001 | ISO/IEC 27001:2022 | standard | System zarządzania bezpieczeństwem informacji |
| ISO22301 | ISO 22301:2019 | standard | System zarządzania ciągłością działania |
| SOC2 | SOC 2 Type II | standard | Service Organization Controls |
| KODEKS_PRACY | Kodeks Pracy | legal | Wymagania dot. ochrony danych pracowników |
| USTAWA_SOX | SOX (jeśli dotyczy) | legal | Sarbanes-Oxley Act |
| INNE | Inne | — | Regulacja spoza słownika (użyj custom_name) |

### 3.4. Sekcja 4: Interesariusze (Interested Parties) — ISO 4.2

Rejestr stron zainteresowanych i ich wymagań wobec bezpieczeństwa / ciągłości.

**Tabela: `org_context_stakeholders`**

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK | — |
| org_unit_id | FK → org_units | Na którym poziomie zdefiniowany |
| stakeholder_type | ENUM | `internal`, `external` |
| category | FK → dictionary_items | Kategoria (słownik: patrz 3.4.1) |
| name | VARCHAR(500) | Nazwa interesariusza (np. "Klienci enterprise", "UODO", "Pracownicy pionu DEV") |
| description | TEXT | Kim jest, jaka jest jego rola |
| needs_expectations | TEXT | Potrzeby i oczekiwania dot. bezpieczeństwa / ciągłości |
| requirements_type | ENUM | `legal` (prawne), `contractual` (umowne), `voluntary` (dobrowolne) |
| requirements_detail | TEXT | Szczegóły wymagań |
| communication_channel | VARCHAR(200) | Jak komunikujemy się z tą stroną (opcjonalne) |
| influence_level | ENUM | `high`, `medium`, `low` | 
| relevance | ENUM | `high`, `medium`, `low` |
| is_active | BOOLEAN | — |
| created_at, updated_at | DATETIME | — |

#### 3.4.1. Słownik kategorii interesariuszy (`STAKEHOLDER_CATEGORY`)

> **Zarządzanie słownikiem:** Wartości poniżej to wstępny seed. Słownik edytowalny w sekcji Słowniki oraz inline z poziomu formularza kontekstu (przycisk "+" obok dropdown'a).

**Wewnętrzni (seed):**
- Zarząd / Rada Nadzorcza
- Pracownicy
- Związki zawodowe
- Audyt wewnętrzny
- Dział prawny
- Dział IT / Security

**Zewnętrzni (seed):**
- Klienci
- Dostawcy i partnerzy biznesowi
- Organy regulacyjne (UODO, KNF, CSIRT, ABW)
- Audytorzy zewnętrzni / certyfikujący
- Akcjonariusze / Inwestorzy
- Ubezpieczyciele
- Media
- Społeczność lokalna
- Organy ścigania

### 3.5. Sekcja 5: Zakres systemu zarządzania (Scope) — ISO 4.3

Definicja zakresu systemu/systemów zarządzania per jednostka organizacyjna. Uniwersalne pod różne normy ISO.

**Tabela: `org_context_scope`**

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK | — |
| org_unit_id | FK → org_units | — |
| management_system | FK → dictionary_items | System zarządzania ze słownika (patrz 3.5.1) |
| scope_statement | RICH TEXT | Oświadczenie o zakresie — co jest objęte systemem zarządzania |
| in_scope_description | RICH TEXT | Co jest w zakresie: procesy, lokalizacje, systemy IT, dane |
| out_of_scope_description | RICH TEXT | Co jest wyłączone z zakresu (z uzasadnieniem!) |
| geographic_boundaries | TEXT | Granice geograficzne (np. "Siedziba Warszawa + DC Kraków") |
| technology_boundaries | TEXT | Granice technologiczne (np. "Chmura AWS eu-central-1 + on-premise DC") |
| organizational_boundaries | TEXT | Granice organizacyjne (np. "Piony DEV i INFRA, bez Pionu Sprzedaży") |
| interfaces_dependencies | TEXT | Interfejsy i zależności z jednostkami poza zakresem |
| approved_by | VARCHAR(200) | Kto zatwierdził zakres |
| approved_date | DATE | Data zatwierdzenia |
| version | INT | Wersja zakresu (auto-increment przy zmianach) |
| is_active | BOOLEAN | — |
| created_at, updated_at | DATETIME | — |

**UNIQUE:** `(org_unit_id, management_system)` — jedna jednostka może mieć osobny zakres per system zarządzania (np. inny zakres dla ISMS, inny dla BCMS, inny dla QMS).

**Uwaga audytowa:** Audytorzy ISO szczególnie sprawdzają uzasadnienie wyłączeń (out_of_scope). Każde wyłączenie musi mieć uzasadnienie.

#### 3.5.1. Słownik systemów zarządzania (`MANAGEMENT_SYSTEM`)

> **Zarządzanie słownikiem:** Wartości poniżej to wstępny seed. Edytowalny w sekcji Słowniki + inline z formularza.

| Kod | Nazwa | Norma bazowa |
|-----|-------|-------------|
| ISMS | System Zarządzania Bezpieczeństwem Informacji | ISO/IEC 27001:2022 |
| BCMS | System Zarządzania Ciągłością Działania | ISO 22301:2019 |
| QMS | System Zarządzania Jakością | ISO 9001:2015 |
| EMS | System Zarządzania Środowiskowego | ISO 14001:2015 |
| ITSMS | System Zarządzania Usługami IT | ISO/IEC 20000-1:2018 |
| PIMS | System Zarządzania Informacjami o Prywatności | ISO/IEC 27701:2019 |
| COMBINED | Zintegrowany System Zarządzania | Wiele norm |

### 3.6. Sekcja 6: Kluczowe procesy / usługi / produkty (linkowanie)

> **Decyzja projektowa:** Procesy, usługi i produkty definiowane są w **oddzielnym module/sekcji menu** (przyszła implementacja: Katalog Procesów Biznesowych). W kontekście organizacyjnym wyświetlamy jedynie **listę zlinkowanych procesów** przypisanych do danej jednostki org.

**W formularzu kontekstu:**
- Lista read-only zlinkowanych procesów (nazwa, właściciel, krytyczność, RTO/RPO — jeśli zdefiniowane)
- Przycisk "Zarządzaj powiązaniami" → otwiera modal z wyborem procesów z Katalogu
- Przycisk "Przejdź do Katalogu Procesów" → nawigacja do oddzielnego modułu

**W przyszłym module Katalog Procesów:**
- CRUD procesów/usług/produktów z atrybutami: nazwa, opis, właściciel, krytyczność, RTO, RPO, MTPD, zależności, kluczowe aktywa
- Powiązanie M2M: proces ↔ org_unit (proces może dotyczyć wielu jednostek)
- Input do BIA (Business Impact Analysis) wg ISO 22301 klauzula 8.2

**Tymczasowo (przed budową Katalogu):** Pole tekstowe rich text `key_processes_notes` w kontekście jednostki — CISO może wpisać notatki o procesach do czasu uruchomienia dedykowanego modułu.

### 3.7. Sekcja 7: Apetyt na ryzyko (Risk Appetite)

Definicja tolerancji ryzyka per poziom organizacyjny.

**Tabela: `org_context_risk_appetite`**

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK | — |
| org_unit_id | FK → org_units UNIQUE | Jeden rekord per jednostka |
| risk_appetite_statement | RICH TEXT | Oświadczenie o apetycie na ryzyko |
| max_acceptable_risk_level | ENUM | `low`, `medium`, `high` — powyżej tego → wymagana mitygacja |
| max_acceptable_risk_score | DECIMAL(5,2) NULLABLE | Maksymalny akceptowalny wynik R (np. 50.00) |
| exception_approval_authority | VARCHAR(200) | Kto może zatwierdzić wyjątek powyżej progu |
| financial_risk_tolerance | TEXT | Tolerancja finansowa (np. "max 500k PLN single loss") |
| reputational_risk_tolerance | TEXT | Tolerancja reputacyjna |
| operational_risk_tolerance | TEXT | Tolerancja operacyjna (np. "max 4h downtime klasy critical") |
| approved_by | VARCHAR(200) | Kto zatwierdził |
| approved_date | DATE | — |
| is_active | BOOLEAN | — |
| created_at, updated_at | DATETIME | — |

**Dziedziczenie:** Jeśli Pion nie ma własnego apetytu na ryzyko → dziedziczy ze Spółki. Jeśli zdefiniuje własny → nadpisuje (ale nie może przekroczyć progu rodzica — system waliduje).

---

## 4. Mechanizm dziedziczenia

### 4.1. Zasady

Dziedziczenie jest **kluczową cechą** tej funkcjonalności. Eliminuje powielanie danych i zapewnia spójność.

| Typ | Opis | Przykład |
|-----|------|---------|
| **Pełne (addytywne)** | Elementy rodzica + elementy własne = widok na danym poziomie | Zobowiązania, Interesariusze, Czynniki |
| **Nadpisywalne** | Dziecko dziedziczy wartość rodzica, ale może ją nadpisać własną | Apetyt na ryzyko, Misja/wizja |
| **Lokalne** | Nie dziedziczy — każdy poziom definiuje samodzielnie | Opis jednostki, Zakres ISMS |

### 4.2. Logika dziedziczenia per sekcja

| Sekcja | Typ dziedziczenia | Zachowanie |
|--------|-------------------|------------|
| Opis ogólny (mission/vision) | Nadpisywalne | Dziecko widzi wartość rodzica; może nadpisać |
| Produkty/usługi, cele strategiczne | Addytywne | Dziecko widzi swoje + odziedziczone z góry |
| Czynniki wew./zew. (issues) | Addytywne | Dziecko widzi swoje + odziedziczone. Nie może usunąć odziedziczonego. |
| Zobowiązania prawne | Addytywne + blokowane | Dziecko widzi swoje + odziedziczone. **Nie może usunąć odziedziczonego.** Może dodać lokalne uszczegółowienie. |
| Interesariusze | Addytywne | Dziecko widzi swoje + odziedziczone |
| Zakres systemu zarządzania | Lokalne | Każdy poziom definiuje własny per system zarządzania (brak dziedziczenia) |
| Procesy (linkowanie) | — | Przyszły moduł — brak dziedziczenia, linkowanie per jednostka |
| Apetyt na ryzyko | Nadpisywalne + walidacja | Dziecko może zdefiniować własny, ale **nie wyższy** niż rodzic |

### 4.3. Wizualizacja w UI

W formularzu kontekstu jednostki każdy element ma oznaczenie:

| Badge | Kolor | Znaczenie |
|-------|-------|-----------|
| 🏢 Spółka | Szary | Odziedziczone ze Spółki (depth=1) |
| 📊 Pion | Niebieski | Odziedziczone z Pionu (depth=2) |
| 🏗️ Dział | Zielony | Odziedziczone z Działu (depth=3) |
| ⭐ Własne | Złoty | Zdefiniowane na tym poziomie |

Odziedziczone elementy wyświetlane z lekko przyciemnionym tłem, read-only. Przycisk "Pokaż źródło" przenosi do poziomu, gdzie element został zdefiniowany.

### 4.4. Implementacja techniczna

**Podejście:** Nie kopiujemy danych fizycznie. Dziedziczenie jest **wyliczeniowe** (query-time).

```sql
-- Pobranie wszystkich zobowiązań dla Działu Frontend (id=15)
-- Łańcuch: Dział (15) → Pion (5) → Spółka (1)

SELECT o.*, 
       CASE WHEN o.org_unit_id = 15 THEN 'own'
            ELSE 'inherited' END AS source_type,
       ou.name AS source_unit_name
FROM org_context_obligations o
JOIN org_units ou ON ou.id = o.org_unit_id
WHERE o.org_unit_id IN (
    -- Rekurencyjne pobranie łańcucha rodziców
    WITH RECURSIVE ancestors AS (
        SELECT id, parent_id FROM org_units WHERE id = 15
        UNION ALL
        SELECT ou.id, ou.parent_id FROM org_units ou
        JOIN ancestors a ON a.id = ou.parent_id
    )
    SELECT id FROM ancestors
)
AND o.is_active = TRUE
ORDER BY ou.depth ASC, o.created_at ASC;
```

**Backend:** Endpoint `GET /api/v1/org-units/{id}/context/obligations` zwraca elementy własne + odziedziczone z flagą `is_inherited` i `source_org_unit_id`.

---

## 5. Przeglądy kontekstu (Context Review)

### 5.1. Cykl przeglądów

ISO 27001 wymaga regularnego przeglądu kontekstu organizacji. System wspiera to przez:

- **Automatyczny reminder:** 30 dni przed `context_next_review` → alert dla CISO
- **Status `outdated`:** Jeśli `context_next_review` < today → status automatycznie zmienia się na `outdated`
- **Review workflow:** CISO otwiera przegląd → przegląda sekcje → potwierdza lub aktualizuje → zatwierdza → nowa data przeglądu = +12 miesięcy

### 5.2. Tabela: `org_context_reviews`

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK | — |
| org_unit_id | FK → org_units | Której jednostki dotyczy przegląd |
| review_date | DATE | Data przeglądu |
| reviewer | VARCHAR(200) | Kto dokonał przeglądu |
| review_type | ENUM | `scheduled` (planowy), `triggered` (po zdarzeniu), `initial` (pierwsza definicja) |
| sections_reviewed | JSON | Które sekcje przejrzano: `["issues", "obligations", "stakeholders", ...]` |
| changes_summary | TEXT | Podsumowanie zmian dokonanych |
| approved_by | VARCHAR(200) | Kto zatwierdził |
| approved_date | DATE | — |
| next_review_date | DATE | Następny przegląd |
| is_active | BOOLEAN | — |
| created_at | DATETIME | — |

---

## 6. Wersjonowanie i historia zmian

### 6.1. Snapshoty kontekstu

Każdy zatwierdzony przegląd generuje snapshot stanu kontekstu — kompletny zapis wszystkich sekcji na dany moment. Pozwala to na:
- Porównanie "było / jest" między przeglądami
- Dowód audytowy: "Tak wyglądał nasz kontekst w momencie certyfikacji"
- Śledzenie ewolucji kontekstu w czasie

**Tabela: `org_context_snapshots`**

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK | — |
| org_unit_id | FK → org_units | — |
| review_id | FK → org_context_reviews | Powiązany przegląd |
| snapshot_date | DATE | — |
| snapshot_data | JSON | Pełen dump kontekstu (wszystkie sekcje) |
| created_at | DATETIME | — |

### 6.2. Audit trail

Każda zmiana w tabelach kontekstu logowana przez istniejący mechanizm audit trail (kto, kiedy, co zmienił, stara/nowa wartość). Zapewnia pełną rozliczalność wymaganą przez ISO.

---

## 7. Eksport i raportowanie

### 7.1. Eksport kontekstu do PDF/DOCX

Przycisk "Eksportuj kontekst" na widoku jednostki organizacyjnej generuje dokument:

**Struktura dokumentu:**

1. Strona tytułowa (nazwa jednostki, data, wersja, zatwierdzający)
2. Opis organizacji / jednostki
3. Czynniki wewnętrzne i zewnętrzne (tabela)
4. Zobowiązania prawne i regulacyjne (tabela — z oznaczeniem odziedziczonych)
5. Rejestr interesariuszy (tabela)
6. Zakres systemu/systemów zarządzania (per norma)
7. Powiązane procesy (lista zlinkowanych z Katalogu Procesów, jeśli dostępne)
8. Apetyt na ryzyko
9. Historia przeglądów

**Format:** PDF (domyślny) lub DOCX (do edycji). Gotowy do przekazania audytorowi.

### 7.2. Dashboard kontekstu

Widok podsumowujący dla CISO:

- Ile jednostek ma zdefiniowany kontekst (% pokrycia)
- Ile kontekstów jest `outdated` (wymaga przeglądu)
- Liczba zobowiązań prawnych per typ
- Mapa interesariuszy (macierz influence × relevance)
- Jednostki bez zdefiniowanego apetytu na ryzyko (alert)

---

## 8. Powiązania z innymi modułami

### 8.1. Istniejące powiązania

| Moduł | Powiązanie |
|-------|-----------|
| Analiza ryzyka (RISK) | Ryzyko ma `org_unit_id` → kontekst daje tło: jakie regulacje, jacy interesariusze, jaki apetyt na ryzyko |
| Wyjątki od polityk (EXC) | Wyjątek dotyczy regulacji → powiązanie z `org_context_obligations` |
| Audyty i findings (AUD) | Audyt ISO sprawdza kontekst → findings mogą dotyczyć braków w kontekście |
| Security Score | Potencjalny dodatkowy KPI: % jednostek z aktualnym kontekstem |

### 8.2. Przyszłe powiązania

| Moduł | Powiązanie |
|-------|-----------|
| Katalog Procesów (nowy) | Procesy/usługi/produkty definiowane oddzielnie → linkowane do org_units → widoczne w kontekście |
| CMDB (aktywa) | Aktywa → procesy → jednostka org. (traceability) |
| BIA (Business Impact Analysis) | Katalog Procesów z RTO/RPO → input do BIA formularzy (ISO 22301 klauzula 8.2) |
| Framework Engine | Framework assessment per org unit → kontekst uzasadnia zakres assessment'u |
| Polityki | Polityka mapowana na regulację → powiązanie z `org_context_obligations` |

---

## 9. API Endpoints

### 9.1. Kontekst jednostki

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/org-units/{id}/context` | Pełny kontekst (własny + odziedziczony) |
| GET | `/api/v1/org-units/{id}/context/summary` | Podsumowanie kontekstu (do dashboard) |

### 9.2. Czynniki (Issues)

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/org-units/{id}/context/issues` | Lista (własne + odziedziczone, flaga `is_inherited`) |
| POST | `/api/v1/org-units/{id}/context/issues` | Dodaj czynnik |
| PUT | `/api/v1/org-units/{id}/context/issues/{issue_id}` | Edytuj (tylko własne) |
| DELETE | `/api/v1/org-units/{id}/context/issues/{issue_id}` | Soft delete (tylko własne) |

### 9.3. Zobowiązania (Obligations)

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/org-units/{id}/context/obligations` | Lista (własne + odziedziczone) |
| POST | `/api/v1/org-units/{id}/context/obligations` | Dodaj zobowiązanie |
| PUT | `/api/v1/org-units/{id}/context/obligations/{obl_id}` | Edytuj |
| DELETE | `/api/v1/org-units/{id}/context/obligations/{obl_id}` | Soft delete (tylko własne!) |

### 9.4. Interesariusze (Stakeholders)

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/org-units/{id}/context/stakeholders` | Lista (własne + odziedziczone) |
| POST | `/api/v1/org-units/{id}/context/stakeholders` | Dodaj |
| PUT | `/api/v1/org-units/{id}/context/stakeholders/{st_id}` | Edytuj |
| DELETE | `/api/v1/org-units/{id}/context/stakeholders/{st_id}` | Soft delete (tylko własne) |

### 9.5. Zakres (Scope)

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/org-units/{id}/context/scope` | Lista zakresów (per management system) |
| POST | `/api/v1/org-units/{id}/context/scope` | Dodaj zakres dla systemu zarządzania |
| PUT | `/api/v1/org-units/{id}/context/scope/{scope_id}` | Edytuj zakres |
| DELETE | `/api/v1/org-units/{id}/context/scope/{scope_id}` | Soft delete |

### 9.6. Procesy (linkowanie — przyszły moduł)

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/org-units/{id}/context/processes` | Lista zlinkowanych procesów (z przyszłego Katalogu) |
| PUT | `/api/v1/org-units/{id}/context/processes-notes` | Tymczasowe notatki o procesach (rich text) |

### 9.7. Apetyt na ryzyko

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/org-units/{id}/context/risk-appetite` | Pobranie (własny lub odziedziczony) |
| PUT | `/api/v1/org-units/{id}/context/risk-appetite` | Upsert |

### 9.8. Przeglądy i eksport

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/org-units/{id}/context/reviews` | Historia przeglądów |
| POST | `/api/v1/org-units/{id}/context/reviews` | Nowy przegląd (generuje snapshot) |
| GET | `/api/v1/org-units/{id}/context/export?format=pdf` | Eksport do PDF/DOCX |
| GET | `/api/v1/org-units/{id}/context/export?format=docx` | Eksport do DOCX |

---

## 10. UI — widoki

### 10.1. Widok drzewa org. z oznaczeniem kontekstu

Na istniejącym drzewie organizacyjnym dodajemy:
- Badge z liczbą elementów kontekstu per jednostka
- Ikonka statusu: ✅ reviewed / ⚠️ outdated / 📝 draft / ❌ brak
- Tooltip z datą ostatniego przeglądu

### 10.2. Formularz kontekstu (edycja)

Zakładki: Ogólne | Czynniki | Zobowiązania | Interesariusze | Zakres | Procesy (link) | Ryzyko

Każda zakładka:
- Sekcja "Odziedziczone" (read-only, przyciemnione tło, badge źródła)
- Sekcja "Własne" (edytowalne, przycisk "Dodaj")
- Rich text editor dla pól opisowych (np. TipTap / Quill)

### 10.3. Widok porównawczy (diff)

Porównanie kontekstu między:
- Dwoma przeglądami tej samej jednostki (co się zmieniło?)
- Dwoma jednostkami (jak kontekst DEV różni się od INFRA?)

---

## 11. Dodatkowe usprawnienia

### 11.1. Matryca PESTLE

Automatyczne grupowanie czynników zewnętrznych w kategorie PESTLE (Political, Economic, Social, Technological, Legal, Environmental) — popularna metoda wymagana przez wielu audytorów. Na podstawie `category` z słownika, system mapuje czynniki do macierzy PESTLE i generuje raport/wykres.

### 11.2. Macierz interesariuszy (Power/Interest Grid)

Wizualizacja interesariuszy na siatce 2×2:
- Oś X: Influence (low → high)
- Oś Y: Relevance (low → high)
- Kwadranty: Monitor / Keep Informed / Keep Satisfied / Manage Closely

### 11.3. Compliance heatmap

Macierz: Jednostki org. × Regulacje. Komórka = `compliance_status` (kolorowana). Na pierwszy rzut oka widać: kto gdzie nie jest compliant.

### 11.4. Auto-alerty

| Alert | Trigger | Odbiorca |
|-------|---------|----------|
| Kontekst wymaga przeglądu | `context_next_review` ≤ today + 30d | Właściciel jednostki + CISO |
| Brak kontekstu | Jednostka org. bez żadnych elementów kontekstu | CISO |
| Niezgodność (non-compliant) | `compliance_status` = `non_compliant` | CISO |
| Brak apetytu na ryzyko | Jednostka bez własnego ani odziedziczonego | CISO |

### 11.5. Mapowanie kontekst → frameworki

Powiązanie elementów kontekstu z wymaganiami frameworków (z Silnika Frameworków):
- Zobowiązanie RODO → mapowanie na ISO 27001 kontrole A.5.34 (Privacy), A.5.31 (Legal requirements)
- Interesariusze → mapowanie na ISO 27001 klauzula 4.2
- Procesy (z Katalogu Procesów) → mapowanie na ISO 22301 klauzula 8.2 (BIA)

Pomaga w śledzeniu: "Czy mamy pokryte wszystkie wymagania klauzuli 4?"

### 11.6. Import z Excel

Formularz importu: CISO może zaimportować istniejące dane kontekstu z Excel (np. aktualny rejestr interesariuszy, lista regulacji). Mapowanie kolumn → pola w systemie.

---

## 12. Słowniki do utworzenia

| Kod słownika | Typ | Przykładowe wartości |
|-------------|-----|---------------------|
| `CONTEXT_ISSUE_CATEGORY` | Kategoria czynników | Kultura org., Infrastruktura IT, Otoczenie prawne... |
| `REGULATION` | Lista regulacji | RODO, NIS2, DORA, KSC, PCI DSS, ISO 27001, ISO 22301... |
| `STAKEHOLDER_CATEGORY` | Kategoria interesariuszy | Zarząd, Pracownicy, Klienci, Regulatorzy, Dostawcy... |
| `MANAGEMENT_SYSTEM` | System zarządzania | ISMS, BCMS, QMS, EMS, ITSMS, PIMS, COMBINED |
| `COMPLIANCE_STATUS` | Status zgodności | Compliant, Partially Compliant, Non-compliant, Not Assessed |
| `OBLIGATION_TYPE` | Typ zobowiązania | Legal, Regulatory, Contractual, Standard, Internal |

---

## 13. Nowe tabele — podsumowanie

| Tabela | Rekordów (szacunkowo) | Dziedziczenie |
|--------|----------------------|---------------|
| org_context_issues | 30-100 | Addytywne |
| org_context_obligations | 10-30 | Addytywne + blokowane |
| org_context_stakeholders | 20-60 | Addytywne |
| org_context_scope | 1-5 per unit (per system zarządzania) | Lokalne |
| org_context_risk_appetite | 1 per unit (lub odziedziczony) | Nadpisywalne + walidacja |
| org_context_reviews | 1-4 per unit per year | — |
| org_context_snapshots | 1 per review | — |

**Rozszerzenia istniejących tabel:**
- `org_units` — nowe kolumny: description, headcount, context_review_date, context_next_review, context_reviewer, context_status + zmiana nazwy: security_contact → security_coordinator

---

## 14. Kolejność implementacji

| Krok | Co | Zależności |
|------|-----|-----------|
| 1 | Rozszerzenie `org_units` (nowe kolumny + rename security_contact) | Migracja Alembic |
| 2 | Nowe słowniki (6 sztuk) | Seed data |
| 3 | Tabele kontekstu (7 tabel) | Migracja Alembic |
| 4 | Mechanizm dziedziczenia (recursive CTE) | Backend service |
| 5 | API endpoints (CRUD + dziedziczenie) | Router + schemas |
| 6 | Formularz kontekstu (frontend, zakładki, rich text editor) | React + TipTap/Quill |
| 7 | Przeglądy i snapshoty | Backend + frontend |
| 8 | Eksport PDF/DOCX | Backend (python-docx / reportlab) |
| 9 | Dashboard kontekstu | Frontend |
| 10 | Usprawnienia (PESTLE, macierz, heatmap) | Frontend + dane |
