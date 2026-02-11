# SecurePosture — CISO Security Posture Dashboard

## O projekcie

Wewnętrzna aplikacja webowa (dashboard) dla CISO firmy IT. Centralizuje dane o bezpieczeństwie z 10 obszarów, generuje Security Score 0-100, wizualizuje trendy i umożliwia drill-down od organizacji przez piony biznesowe do konkretnych ryzyk/podatności/incydentów.

## Dokumentacja — PRZECZYTAJ PRZED KODOWANIEM

| Dokument | Opis | Kiedy czytać |
|----------|------|-------------|
| `docs/ANALIZA_WYMAGAN_v2.0.md` | Kompletna analiza wymagań — cel, kontekst, wszystkie moduły, Security Score, formuły, powiązania | **Zawsze na starcie** — daje pełny obraz systemu |
| `docs/SPECYFIKACJA_ROZSZERZENIE_v2.0.md` | Szczegółowa specyfikacja 8 nowych modułów operacyjnych v2.0 + Security Score — tabele, endpointy API, formuły scoringu | **Przed implementacją modułów 13-21** |
| `docs/SPECYFIKACJA_FRAMEWORK_ENGINE.md` | Silnik Frameworków — zastępuje stary moduł CIS. Import z CISO Assistant (100+ frameworków), uniwersalne assessment'y, mapowanie nodes→obszary | **Przed pracą z frameworkami, assessment'ami, obszarami bezpieczeństwa** |

Jeśli czegoś nie rozumiesz lub brakuje informacji — **zapytaj** zanim zaczniesz kodować.

## Stack technologiczny

| Warstwa | Technologia | Uwagi |
|---------|-------------|-------|
| Backend | Python 3.12 + FastAPI + Uvicorn | Async, auto-docs OpenAPI |
| ORM | SQLAlchemy 2.0 + Alembic | Wersjonowane migracje |
| Baza | MariaDB 11 | Host: Synology NAS `192.168.200.55:3307`, db: `secureposture` |
| Frontend | React 18 + Vite + Tailwind CSS | Dark theme |
| Wykresy | Recharts / Chart.js | Interaktywne dashboardy |
| Serwer | Debian 12 (`192.168.200.69`) | Backend + frontend na tym samym serwerze |
| Repo | GitHub (prywatne) | Osobne repo: backend, frontend |

## Struktura projektu

```
secureposture-backend/
├── app/
│   ├── main.py              # FastAPI app, middleware, startup
│   ├── config.py             # Settings (env vars, DB connection)
│   ├── database.py           # SQLAlchemy engine, session
│   ├── models/               # SQLAlchemy models (1 plik per moduł)
│   │   ├── org_unit.py
│   │   ├── dictionary.py
│   │   ├── security_area.py
│   │   ├── risk.py
│   │   ├── framework.py      # Framework Engine (zastępuje cis.py)
│   │   └── ...
│   ├── schemas/              # Pydantic schemas (request/response)
│   ├── routers/              # FastAPI routers (1 plik per moduł)
│   │   ├── org_units.py
│   │   ├── dictionaries.py
│   │   ├── risks.py
│   │   └── ...
│   ├── services/             # Business logic (scoring, formuły)
│   └── middleware/           # Audit trail, error handling
├── alembic/                  # Migracje DB
├── requirements.txt
├── alembic.ini
└── .env
```

## Konwencje kodowania — WAŻNE

### Ogólne zasady
- **Język kodu**: angielski (nazwy zmiennych, funkcji, endpointów, modeli)
- **Język treści**: polski (nazwy w słownikach, opisy, komunikaty UI)
- **Komentarze**: angielski

### Baza danych
- **Soft delete**: NIGDY nie kasuj fizycznie. Każda tabela ma `is_active BOOLEAN DEFAULT TRUE`. Zamiast DELETE → `UPDATE SET is_active = FALSE`
- **Audit trail**: Każda zmiana w tabelach operacyjnych logowana do `audit_trail` (kto, kiedy, tabela, pole, stara wartość, nowa wartość)
- **Autonumeracja ref_id**: Każdy obiekt ma czytelny identyfikator: `RISK-0001`, `VULN-0042`, `INC-0007`, `EXC-0003`, `FND-0015`, `AST-0001`, `VND-0001`, `POL-0001`
- **Słowniki**: Wszystkie listy wyboru (statusy, kategorie, typy) trzymane w tabeli `dictionary_items` z `dictionary_code`. Nie hardcoduj wartości w kodzie.
- **Timestamp**: Zawsze `created_at`, `updated_at` (auto). UTC.
- **FK naming**: `{tabela_docelowa}_id` (np. `org_unit_id`, `risk_id`)
- **Migracje**: Alembic. Każda zmiana schematu = osobna migracja z opisową nazwą.

### API
- **Prefix**: `/api/v1/{resource}`
- **REST**: GET (list + detail), POST, PUT, PATCH, DELETE (soft)
- **Paginacja**: `?skip=0&limit=50` (domyślnie limit=50)
- **Filtrowanie**: Query params: `?org_unit_id=5&status=active&severity=critical`
- **Sortowanie**: `?sort_by=created_at&sort_order=desc`
- **Response**: Zawsze Pydantic schema. List endpoint zwraca `{ items: [...], total: N }`
- **Errors**: HTTPException z sensownym message (po polsku dla UI)
- **Swagger**: Każdy endpoint ma `summary` i `description`

### Frontend
- **Dark theme** domyślnie (Tailwind: `bg-gray-900`, `text-gray-100`)
- **Kolory statusów**: Zielony=OK, Żółty=Uwaga, Pomarańczowy=Problem, Czerwony=Krytyczny
- **Kolory ryzyka**: Zielony (R<10), Żółty (10≤R<50), Czerwony (R≥50)
- **Tabele**: Sortowalne, filtrowalne, z paginacją. Bulk actions gdzie sensowne.
- **Formularze**: Walidacja real-time, conditional fields, auto-save drafts
- **Responsywność**: Desktop-first, mobile-friendly

## Co jest ZBUDOWANE (v1.1)

Moduły 1-12 mają działające CRUD API + frontend:

| Moduł | API Router | Model | Status |
|-------|-----------|-------|--------|
| Ustawienia systemowe | `/api/v1/settings` | SystemSetting | ✅ |
| Struktura organizacyjna | `/api/v1/org-units` | OrgUnit | ✅ |
| Słowniki | `/api/v1/dictionaries` | DictionaryItem | ✅ |
| Obszary bezpieczeństwa | `/api/v1/security-areas` | SecurityArea | ✅ |
| Katalog zagrożeń | `/api/v1/threats` | Threat | ✅ |
| Katalog podatności (ref.) | `/api/v1/catalog-vulnerabilities` | CatalogVulnerability | ✅ |
| Katalog zabezpieczeń | `/api/v1/safeguards` | Safeguard | ✅ |
| Analiza ryzyka | `/api/v1/risks` | Risk | ✅ |
| Przeglądy ryzyka | `/api/v1/risk-reviews` | RiskReview | ✅ |
| CIS Benchmark | `/api/v1/cis-*` | CisControl, CisAssessment, CisAnswer | ⚠️ Migracja → Framework Engine |
| Audit trail | `/api/v1/audit-trail` | AuditTrail | ✅ |

**Wzoruj się na istniejących modułach** — każdy nowy moduł powinien mieć taką samą strukturę (model, schema, router, service).

**⚠️ WAŻNA ZMIANA: Moduł CIS Benchmark jest zastępowany przez Silnik Frameworków.**
Stare tabele `cis_controls`, `cis_sub_controls`, `cis_assessments`, `cis_answers` → migracja do nowych tabel `frameworks`, `framework_nodes`, `assessments`, `assessment_answers`. CIS v8 staje się jednym z wielu importowalnych frameworków. Szczegóły: `docs/SPECYFIKACJA_FRAMEWORK_ENGINE.md`.

## Co do ZBUDOWANIA (v2.0)

**Kolejność implementacji:**

### Faza 0: Silnik Frameworków + Obszary (PRIORYTET)
0. **Silnik Frameworków** — nowe tabele (`frameworks`, `framework_nodes`, `assessment_dimensions`, `dimension_levels`, `assessments` v2, `assessment_answers` v2, `framework_node_security_areas`), migracja danych CIS z v1.1, import Excel/YAML/GitHub z CISO Assistant. **Szczegóły: `docs/SPECYFIKACJA_FRAMEWORK_ENGINE.md`**
0. **Przebudowa Obszarów Bezpieczeństwa** — z 13 hardcoded na pełną konfigurowalność (CISO definiuje od zera). Domyślny szablon 13 obszarów jako importowalny seed.

### Faza 1: Fundamenty operacyjne
1. **Moduł 17: CMDB (Inwentaryzacja Aktywów)** — `assets` table, CRUD, hierarchia (self-ref FK), typy: Serwer/Aplikacja/Baza danych/Stacja/Sieć/Mobilne/Chmura/Dane
2. **Moduł 13: Rejestr Podatności** — `vulnerabilities` table, CVSS→severity auto-mapping, SLA deadlines per severity, cykl życia: Nowa→W analizie→W remediacji→Zamknięta
3. **Moduł 14: Rejestr Incydentów** — `incidents` table, TTR tracking, flagi RODO, M2M z risks i vulnerabilities

### Faza 2: Governance
4. **Moduł 15: Wyjątki od Polityk** — `policy_exceptions` table, mandatory expiry date, auto-alert 30d przed, auto-status Wygasły
5. **Moduł 16: Audyty i Findings** — `audits` + `audit_findings` tables, SLA tracking per finding severity
6. **Moduł 20: Polityki** — `policies` + `policy_acknowledgments` + `policy_standard_mappings` (ISO/CIS/NIST/SOC2/RODO/PCI)

### Faza 3: Kontekst zewnętrzny
7. **Moduł 18: TPRM (Dostawcy)** — `vendors` + `vendor_assessments` + `vendor_assessment_answers`, rating A-D
8. **Moduł 19: Awareness** — `awareness_campaigns` + `awareness_results` + `awareness_employee_reports`

### Faza 4: Scoring
9. **Moduł 21: Security Score** — `score_config_versions` + `security_score_snapshots`, formuły 10 filarów, konfigurowalne wagi
10. **Strona Metodologii** — auto-generowana z aktualnej konfiguracji, z przykładami obliczeń
11. **Dashboard v2** — gauge 0-100, trend liniowy, breakdown 10 filarów, top 3 gaps, alerty

### Dla każdego modułu zrób:
1. Migracja Alembic (nowa tabela + seed data słowników)
2. Model SQLAlchemy
3. Pydantic schemas (Create, Update, Response, List)
4. CRUD router FastAPI
5. Endpoint `/api/v1/{resource}/metrics` — dane do Security Score
6. Testy (logika biznesowa, formuły)

## Kluczowe formuły

### Ryzyko (istniejące, zaimplementowane)
```
R = EXP(W) × (P / Z)
W = Wpływ (0.1-1.0), P = Prawdopodobieństwo (0.1-1.0), Z = Zabezpieczenia (0.1-1.0)
R < 10 → Niskie (zielony), 10 ≤ R < 50 → Średnie (żółty), R ≥ 50 → Wysokie (czerwony)
```

### Security Score (nowy, do zbudowania)
```
Security_Score = Σ(waga_i × clamp(filar_score_i, 0, 100))

10 filarów z domyślnymi wagami:
  Ryzyka: 20%              — statusy, poziomy R, trendy
  Podatności: 15%          — otwarte per severity, SLA compliance
  Incydenty: 12%           — count 90d rolling, TTR vs target, lessons learned
  Wyjątki: 10%             — aktywne, wygasłe, kompensacje
  Control Maturity: 10%    — z wybranego frameworka (domyślnie CIS v8), overall_assessment_score
  Audyty: 10%              — otwarte findings, SLA compliance
  Aktywa: 8%               — coverage, EOL, scan coverage, hygiene
  Dostawcy: 6%             — assessment coverage, rating distribution
  Polityki: 5%             — acknowledgment rate, review timeliness
  Awareness: 4%            — training completion, phishing click rate

Wagi konfigurowalne przez CISO (suma musi = 100%)
Szczegółowe formuły per filar → docs/SPECYFIKACJA_ROZSZERZENIE_v2.0.md
```

### Control Maturity — Silnik Frameworków (zastępuje CIS-only)
```
Uniwersalny silnik frameworków: CIS v8, ISO 27001, NIST CSF, SOC 2, PCI DSS, NIS2, DORA...
Import z CISO Assistant (100+ frameworków): Excel (.xlsx) + YAML + GitHub API
Każdy framework ma: hierarchiczne drzewo nodes, własną skalę ocen (wymiary × poziomy)
Assessment = Framework × Org Unit (pełny) lub Framework × Org Unit × Obszar (zawężony)
Mapowanie nodes → konfigurowalne obszary bezpieczeństwa (M2M, pre-built seed + ręczne)
CIS v8: 4 wymiary (Policy/Implemented/Automated/Reported) × 5 poziomów — migracja z v1.1
Szczegóły: docs/SPECYFIKACJA_FRAMEWORK_ENGINE.md
```

## Powiązania między modułami

```
Podatność (VULN) ──→ może generować ──→ Ryzyko (RISK)
Incydent (INC) ───M2M──→ Ryzyko (RISK)
Incydent (INC) ───M2M──→ Podatność (VULN)
Finding (FND) ────→ może generować ──→ Ryzyko (RISK)
Wyjątek (EXC) ───→ zawsze generuje ──→ Ryzyko (RISK)
Wyjątek (EXC) ───→ dotyczy ──→ Polityka (POL)
Ryzyko (RISK) ────→ może dotyczyć ──→ Aktyw (AST) lub Dostawca (VND)
Framework nodes ──M2M──→ Obszary bezpieczeństwa (konfigurowalne)
Assessment = Framework × Org Unit × [Obszar]
KAŻDY moduł operacyjny ──FK──→ org_units (raportowanie per pion biznesowy)
```

## Deployment

- Backend: `systemd` service, Uvicorn za Nginx reverse proxy
- Frontend: `npm run build` → static files serwowane przez Nginx
- DB: MariaDB na Synology NAS, backup: cron mysqldump daily
- Python venv: `/opt/secureposture/venv`

## Częste pułapki — UNIKAJ

1. **Nie hardcoduj słowników** — zawsze czytaj z `dictionary_items` po `dictionary_code`
2. **Nie kasuj rekordów** — soft delete (`is_active = FALSE`)
3. **Nie zapomnij o `org_unit_id`** — każdy obiekt operacyjny MUSI mieć FK do org_units
4. **Nie zapomnij o audit trail** — loguj zmiany w middleware/hooks
5. **Nie mieszaj języków** — kod po angielsku, treści (seed data, komunikaty) po polsku
6. **Security Score liczy się ze WSZYSTKICH modułów** — każdy moduł musi eksponować endpoint `/metrics`
7. **Nie zmieniaj istniejących modeli v1.1** bez pytania — mogą być w użyciu
8. **Ref ID format** — `RISK-0001` nie `RISK-1` (zero-padded 4 cyfry)
9. **NIE używaj starych tabel CIS** (`cis_controls`, `cis_sub_controls`, `cis_assessments`, `cis_answers`) — są deprecated, używaj nowych tabel Framework Engine (`frameworks`, `framework_nodes`, `assessments`, `assessment_answers`)
10. **Obszary bezpieczeństwa nie są hardcoded** — CISO definiuje je od zera, domyślne 13 to importowalny szablon
11. **Framework nodes → obszary to M2M** — jeden node może mieć wiele obszarów, mapowanie w `framework_node_security_areas`
12. **Skala ocen jest per framework** — nie zakładaj 4 wymiarów × 5 poziomów, czytaj z `assessment_dimensions` + `dimension_levels`
