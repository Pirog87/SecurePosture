# SecurePosture — Analiza Wymagań v2.0

> **Wersja:** 2.0 | **Data:** 2026-02-11 | **Autor:** CISO + Claude AI | **Status:** W realizacji

Dokument zawiera kompletną analizę wymagań projektu SecurePosture — od koncepcji po specyfikację rozszerzenia v2.0. Przeznaczony dla zespołu developerskiego, architektów, AI oraz osób nietechnicznych potrzebujących pełnego obrazu rozwiązania.

---

## 1. Streszczenie wykonawcze

SecurePosture to wewnętrzna aplikacja webowa typu dashboard, budowana na potrzeby CISO firmy IT dostarczającej software i usługi. Firma ma wielopionową strukturę organizacyjną. CISO potrzebuje jednego spójnego narzędzia, które:

- **Agreguje dane z wielu źródeł** — ryzyka, podatności, incydenty, audyty, wyjątki, dostawcy, szkolenia, polityki, CMDB, frameworki bezpieczeństwa (CIS, ISO, NIST, SOC2...)
- **Pokazuje stan bezpieczeństwa** na pierwszy rzut oka — dla zarządu (executive summary) i dla zespołu security (drill-down)
- **Umożliwia porównania** — między pionami biznesowymi i śledzenie trendów w czasie
- **Generuje Security Score 0-100** — jeden wskaźnik łączący 10 filarów bezpieczeństwa z konfigurowalnymi wagami
- **Jest transparentny** — auto-generowana strona Metodologii wyjaśnia każdy aspekt scoringu

Projekt jest realizowany iteracyjnie. **Wersja 1.1** (backend + frontend) jest zbudowana i działająca. **Wersja 2.0** (8 nowych modułów + Security Score) jest w fazie specyfikacji.

---

## 2. Kontekst i problem biznesowy

### 2.1. Kim jest użytkownik

Główny użytkownik to CISO (Chief Information Security Officer) w średniej/dużej firmie IT. Firma dostarcza software i usługi IT, ma wiele pionów biznesowych (development, infrastruktura, wsparcie, sprzedaż itd.). CISO odpowiada za bezpieczeństwo całej organizacji i raportuje do zarządu.

### 2.2. Problem

CISO operuje równolegle na wielu źródłach informacji o bezpieczeństwie:

- **Rejestr ryzyk** — analiza ryzyka per obszar cyberbezpieczeństwa (13 obszarów: stacje robocze, urządzenia mobilne, ochrona danych, infrastruktura sieciowa, serwerowa, M365, chmury publiczne, kontrola dostępu itd.)
- **Ocena dojrzałości** wg wielu frameworków (CIS Controls v8, ISO 27001, NIST CSF, SOC 2 i innych)
- **Podatności** ze skanerów i pentestów
- **Incydenty** bezpieczeństwa
- **Wyniki audytów** (wewnętrznych, zewnętrznych, regulacyjnych)
- **Wyjątki** od polityk bezpieczeństwa
- **Oceny ryzyka dostawców** IT
- **Metryki szkoleń** i phishing simulations
- **Rejestr polityk** i potwierdzeń
- **Inwentarz aktywów** IT (CMDB w Excelu)

**Problem:** Brak jednego spójnego obrazu. Dane są rozproszone, trudno odpowiedzieć na pytanie zarządu: "Jak u nas jest z bezpieczeństwem?". Potrzebny jest "prędkościomierz" + trend + drill-down.

### 2.3. Cel rozwiązania

Zbudować aplikację webową, która:
- Centralizuje wszystkie dane o bezpieczeństwie w jednym miejscu
- Generuje Security Score 0-100 łączący 10 filarów bezpieczeństwa
- Wizualizuje dane w formie nowoczesnych dashboardów (dark theme, interaktywne wykresy)
- Pozwala na drill-down: organizacja → pion → detal (ryzyko, podatność, finding)
- Śledzi trendy w czasie (snapshotowanie wyników)
- Jest transparentny — strona Metodologii wyjaśnia każdy aspekt scoringu
- Jest konfigurowalny — wagi, progi, parametry zmieniane bez kodu

---

## 3. Architektura techniczna

### 3.1. Stos technologiczny

| Warstwa | Technologia | Uzasadnienie |
|---------|-------------|-------------|
| Backend API | Python + FastAPI | Async, auto-dokumentacja OpenAPI, szybki development |
| Baza danych | MariaDB 11 (Synology NAS) | Istniejąca infrastruktura, relacyjna, transakcje |
| ORM / Migracje | SQLAlchemy + Alembic | Standardowy stack Python, wersjonowanie schematu |
| Frontend | React 18 + Tailwind CSS | Komponentowy, responsywny, dark theme |
| Hosting | Debian 12 (192.168.200.69) | Backend + frontend na tym samym serwerze |
| Repozytorium | GitHub (prywatne) | Wersjonowanie kodu |
| Wykresy | Recharts / Chart.js | Interaktywne dashboardy |

### 3.2. Zasady projektowe

- **Soft delete:** Żadne dane nie są fizycznie kasowane (pole `is_active`). Historia jest zachowana.
- **Audit trail:** Każda zmiana logowana: kto, kiedy, co, stara wartość, nowa wartość.
- **Słowniki:** Wszystkie listy wyboru są konfigurowalne (tabela `dictionary_items`).
- **Autonumeracja:** Każdy obiekt ma czytelny `ref_id` (np. `RISK-0001`, `VULN-0042`).
- **REST API:** Każdy moduł ma pełne CRUD + endpointy metryczne dla scoringu.

---

## 4. Katalog modułów

### 4.1. Warstwa fundamentalna (v1.0) — ✅ Zbudowane

| # | Moduł | Cel |
|---|-------|-----|
| 1 | Ustawienia systemowe | Konfiguracja globalna |
| 4 | Struktura organizacyjna | Drzewo hierarchiczne (organizacja → pion → dział → zespół) |
| 5 | Słowniki | Konfigurowalne listy wyboru |
| 6 | Obszary bezpieczeństwa | Konfigurowalne domeny bezpieczeństwa (CISO definiuje od zera, domyślny szablon 13 obszarów) |

### 4.2. Warstwa katalogów i analizy ryzyka (v1.1) — ✅ Zbudowane

| # | Moduł | Cel |
|---|-------|-----|
| 7-9 | Katalogi (zagrożenia, podatności ref., zabezpieczenia) | Bazy wiedzy referencyjne |
| 10 | Analiza ryzyka | Rejestr ryzyk z formułą R = EXP(W) × (P/Z) |
| 11 | Przeglądy ryzyka | Cykliczne reoceny |
| 12 | Silnik Frameworków | Import i ocena dowolnych frameworków (CIS, ISO, NIST...) — zastępuje stary moduł CIS |
| -- | Audit Trail | Logowanie zmian |

### 4.3. Warstwa operacyjna (v2.0) — 📝 Specyfikacja

| # | Moduł | Cel |
|---|-------|-----|
| 13 | Rejestr Podatności | Instancje ze skanerów + ręczne, cykl remediacji, SLA |
| 14 | Rejestr Incydentów | Obsługa incydentów z root cause i lessons learned |
| 15 | Rejestr Wyjątków | Odstępstwa od polityk z datą wygaśnięcia |
| 16 | Rejestr Audytów | Audyty → Findings → Remediacja z SLA |
| 17 | CMDB | Rejestr aktywów IT z relacjami hierarchicznymi |
| 18 | TPRM | Ocena ryzyka dostawców (kwestionariusze, rating A-D) |
| 19 | Awareness | Metryki szkoleń, phishing simulations |
| 20 | Polityki | Wersjonowanie, potwierdzenia, mapowanie na standardy |

### 4.4. Warstwa scoringowa (v2.0) — 📝 Specyfikacja

| # | Moduł | Cel |
|---|-------|-----|
| 21 | Security Score | Scoring 0-100 z 10 filarów, snapshoty, trend |
| -- | Metodologia | Auto-generowana dokumentacja scoringu |
| -- | Dashboard v2 | Gauge + trend + breakdown + alerty |

---

## 5. Analiza ryzyka — metodologia

### Formuła: R = EXP(W) × (P / Z)

| Parametr | Nazwa | Zakres | Opis |
|----------|-------|--------|------|
| W | Wpływ | 0.1-1.0 | Ocena wpływu materializacji zagrożenia |
| P | Prawdopodobieństwo | 0.1-1.0 | Ocena prawdopodobieństwa wystąpienia |
| Z | Zabezpieczenia | 0.1-1.0 | Ocena skuteczności zabezpieczeń |
| R | Poziom ryzyka | auto | Niskie (<10) / Średnie (10-50) / Wysokie (≥50) |

---

## 6. Silnik Frameworków (Framework Engine)

**Zmiana architektoniczna v2.0:** Stary moduł CIS Benchmark (dedykowany, hardcoded) zastąpiony uniwersalnym silnikiem frameworków. CIS v8 staje się jednym z wielu importowalnych frameworków.

### Kluczowe cechy:
- **Import z CISO Assistant** (100+ frameworków): Excel (.xlsx) + YAML + automatyczny pull z GitHub API
- **Hierarchiczne drzewo wymagań** (requirement nodes): sekcje → kontrole → sub-kontrole, dowolna głębokość
- **Skala ocen per framework**: CIS ma 4 wymiary × 5 poziomów, ISO może mieć 1 wymiar × 4 poziomy, każdy framework definiuje własną
- **Assessment = Framework × Org Unit** (pełne badanie) lub **Framework × Org Unit × Obszar** (zawężone do zmapowanych nodes)
- **Mapowanie nodes → obszary bezpieczeństwa** (M2M): pre-built seed dla CIS + ręczna edycja CISO
- **Obszary bezpieczeństwa** — w pełni konfigurowalne (CISO definiuje od zera, domyślny szablon 13 obszarów jako import)

### Dostępne frameworki (przykłady z CISO Assistant):
CIS Controls v8 (148 nodes), ISO 27001:2022 (93), NIST CSF 2.0 (~108), SOC 2 (~64), PCI DSS 4.0 (~250), NIS2 (~40), DORA (~50), GDPR (~88), NIST 800-53 Rev 5 (~1000+), CMMC v2 (~110) i 90+ innych.

### Migracja CIS v8 z v1.1:
Dane z tabel `cis_controls`, `cis_sub_controls`, `cis_assessments`, `cis_answers` migrowane do nowych tabel: `frameworks`, `framework_nodes`, `assessment_dimensions`, `dimension_levels`, `assessments`, `assessment_answers`.

Pełna specyfikacja: `docs/SPECYFIKACJA_FRAMEWORK_ENGINE.md`

---

## 7. Rozszerzenie v2.0 — 8 nowych modułów

Szczegóły: `docs/SPECYFIKACJA_ROZSZERZENIE_v2.0.md`

| Moduł | Kluczowe cechy |
|-------|---------------|
| 13: Podatności | CVSS→severity auto-mapping, SLA per priorytet (P1:7d-P4:180d), cykl remediacji |
| 14: Incydenty | TTR tracking, flagi RODO, M2M z risks i vulns, lessons learned |
| 15: Wyjątki | Mandatory expiry, auto-alert 30d, auto-status Wygasły, kompensacje |
| 16: Audyty | Dwupoziomowy: Audyt→Findings, SLA per finding type |
| 17: CMDB | Hierarchia self-ref, EOL tracking, import CSV/Excel |
| 18: TPRM | Kwestionariusze 0-5, rating A-D, harmonogram reocen |
| 19: Awareness | Kampanie→Wyniki, phishing metrics, zgłoszenia pracowników |
| 20: Polityki | Wersjonowanie, acknowledgments per pracownik, mapowanie CIS/ISO/NIST/SOC2/RODO/PCI |

---

## 8. Security Score

### Formuła: Security_Score = Σ(waga_i × clamp(filar_score_i, 0, 100))

| # | Filar | Waga | Źródło |
|---|-------|------|--------|
| 1 | Ryzyka | 20% | Statusy, poziomy R, trendy |
| 2 | Podatności | 15% | Otwarte per severity, SLA |
| 3 | Incydenty | 12% | Count 90d, TTR, lessons |
| 4 | Wyjątki | 10% | Aktywne, wygasłe, kompensacje |
| 5 | Control Maturity | 10% | Z wybranego frameworka (domyślnie CIS v8), overall_assessment_score |
| 6 | Audyty | 10% | Otwarte findings, SLA |
| 7 | Aktywa | 8% | Coverage, EOL, scan |
| 8 | Dostawcy | 6% | Assessment coverage, rating |
| 9 | Polityki | 5% | Acknowledgment, review |
| 10 | Awareness | 4% | Training, phishing |

Klasyfikacja: 80-100 Dobry 🟢 / 60-79 Zadowalający 🟡 / 40-59 Wymaga poprawy 🟠 / 0-39 Krytyczny 🔴

Wagi konfigurowalne (suma=100%), wersjonowanie konfiguracji, auto-snapshoty, strona Metodologii z przykładami obliczeń.

---

## 9. Powiązania między modułami

```
VULN ──→ RISK       INC ──M2M──→ RISK       FND ──→ RISK
EXC ──→ RISK        RISK ──→ AST/VND        KAŻDY ──FK──→ org_units
INC ──M2M──→ VULN   EXC ──→ POL
Framework nodes ──M2M──→ Obszary bezpieczeństwa (konfigurowalne)
Assessment = Framework × Org Unit × [Obszar]
```

---

## 10. Kolejność implementacji v2.0

| Faza | Moduły | Uzasadnienie |
|------|--------|-------------|
| **0** | **Silnik Frameworków + Przebudowa Obszarów** | **Fundament architektury — migracja CIS, import frameworków, konfigurowalne obszary** |
| 1 | CMDB, Podatności, Incydenty | Fundament danych operacyjnych |
| 2 | Wyjątki, Audyty, Polityki | Governance |
| 3 | TPRM, Awareness | Kontekst zewnętrzny |
| 4 | Security Score, Metodologia, Dashboard | Wymaga wszystkich danych |

---

## 11. Kluczowe decyzje projektowe

| Data | Decyzja |
|------|---------|
| 09.02 | Formuła R = EXP(W) × (P/Z) — autorska CISO |
| 09.02 | CIS Controls v8, słowniki konfigurowalne, soft delete, audit trail |
| 10.02 | FastAPI + React + Tailwind, MariaDB na Synology NAS |
| 10.02 | CIS per jednostka org. + reocena w czasie |
| 11.02 | 10 filarów (z 6), konfigurowalne wagi, strona Metodologii |
| 11.02 | Silnik Frameworków zamiast dedykowanego modułu CIS — import z CISO Assistant (100+ frameworków) |
| 11.02 | Obszary bezpieczeństwa w pełni konfigurowalne (CISO definiuje od zera) |
| 11.02 | Assessment = Framework × Org Unit × Obszar (precyzyjne podejście) |
| 11.02 | Mapowanie nodes→obszary: hybrydowe (pre-built seed + ręczna edycja CISO) |
| 11.02 | Filar Security Score "CIS" → "Control Maturity" z wyborem frameworka bazowego |
