# SecurePosture — Instrukcje dla Claude Code

## Kontekst Projektu

Budujesz **SecurePosture** — webową platformę bezpieczeństwa dla CISO. Aplikacja służy do zarządzania ryzykami cyberbezpieczeństwa i oceny dojrzałości organizacji wg CIS Controls v8.

**Odbiorca**: CISO i kadra zarządzająca (osoby nietechniczne). UI musi być przejrzysty, wizualnie atrakcyjny i zrozumiały na pierwszy rzut oka.

## Architektura

- **Backend**: Python 3.12+ / FastAPI / SQLAlchemy 2.0 (async) / Alembic
- **Frontend**: React 18+ / TypeScript / Tailwind CSS / Recharts / D3.js / shadcn/ui
- **Baza**: MariaDB 10.6+ (schemat w `db/schema.sql`)
- **Architektura**: API-first REST (SPA). Frontend i backend to osobne aplikacje.

## Kluczowe Pliki

- `docs/SPECYFIKACJA_v1.1.md` — PEŁNA specyfikacja wymagań. **Zawsze czytaj ten plik przed implementacją modułu.**
- `docs/prototype.html` — interaktywny prototyp UI. Otwórz w przeglądarce jako referencja wizualna.
- `db/schema.sql` — schemat bazy danych ze wszystkimi tabelami, relacjami i seed data.
- `db/seed_cis_subcontrols.sql` — 148 sub-kontroli CIS v8 z opisami EN/PL, NIST CSF, Implementation Groups.

## Konwencje Kodu

### Backend (Python / FastAPI)

```
backend/app/
├── main.py            # FastAPI app, middleware, CORS
├── config.py          # Settings (pydantic-settings, .env)
├── database.py        # SQLAlchemy engine, session
├── models/            # SQLAlchemy ORM models (1 plik per tabela/moduł)
│   ├── user.py
│   ├── dictionary.py
│   ├── org_unit.py
│   ├── catalog.py     # threats, vulnerabilities, safeguards
│   ├── risk.py
│   ├── cis.py         # controls, sub_controls, assessments, answers
│   └── audit.py
├── schemas/           # Pydantic schemas (request/response)
├── routers/           # API route handlers (1 plik per moduł)
├── services/          # Business logic (scoring, calculations)
└── middleware/        # Audit trail middleware
```

- Nazewnictwo: snake_case dla plików i zmiennych, PascalCase dla klas
- Każdy router = osobny plik z prefixem API: `/api/v1/{module}`
- Pydantic v2 schemas dla walidacji
- Async SQLAlchemy sessions
- Audit trail: middleware/decorator logujący każdą zmianę do tabeli `audit_log`

### Frontend (React / TypeScript)

```
frontend/src/
├── components/        # Reusable UI components
│   ├── ui/            # shadcn/ui base components
│   ├── charts/        # Recharts/D3 wrappers
│   ├── layout/        # Sidebar, Topbar, Layout
│   └── common/        # DataTable, Modal, ScoreBadge, etc.
├── pages/             # Route pages (1 per view)
├── hooks/             # Custom React hooks
├── services/          # API client (fetch/axios)
├── types/             # TypeScript interfaces
├── lib/               # Utilities, scoring functions
└── App.tsx
```

- TypeScript strict mode
- Tailwind utility classes (dark theme — patrz prototyp)
- Kolorystyka: `bg-[#0a0e1a]` primary, `bg-[#1a2035]` cards, blue/green/yellow/red semantyczne
- Font: DM Sans (UI) + JetBrains Mono (liczby, kody, metryki)
- Responsive: sidebar collapses na < 1100px

## Design System (z prototypu)

### Kolory
```
--bg-primary: #0a0e1a      (tło główne)
--bg-card: #1a2035          (karty)
--border: #2a3554           (obramowania)
--text-primary: #e8ecf4     (tekst główny)
--text-secondary: #8896b3   (tekst pomocniczy)
--green: #22c55e            (niskie ryzyko, dobry wynik)
--yellow: #eab308           (średnie ryzyko)
--orange: #f97316           (podwyższone ryzyko)
--red: #ef4444              (krytyczne ryzyko)
--blue: #3b82f6             (akcje, aktywne elementy)
--purple: #8b5cf6           (audit, statusy)
```

### Poziomy ryzyka → kolory
- Wysokie (R ≥ 221): red
- Średnie (R 31–220): orange/yellow
- Niskie (R < 31): green

### CIS scoring → kolory
- ≥ 70%: green
- 40–69%: yellow
- > 0% i < 40%: orange
- 0%: red

## Formuła Ryzyka

```
R = EXP(W) × (P / Z)
```

- W = Poziom wpływu (1–3)
- P = Poziom prawdopodobieństwa (1–3)
- Z = Ocena zabezpieczeń (0.10 / 0.25 / 0.70 / 0.95)
- Zaokrąglanie: 1 miejsce po przecinku
- Kolumna computed w bazie (GENERATED ALWAYS AS ... STORED)

## Kolejność Implementacji (Rekomendowana)

1. **Backend scaffold** — FastAPI app, config, database connection, CORS
2. **Moduł słowników** — CRUD dictionary_types + entries (fundament wszystkiego)
3. **Moduł struktury org.** — CRUD org_levels + org_units (drzewo)
4. **Moduł obszarów bezpieczeństwa** — CRUD security_areas
5. **Moduł katalogów** — CRUD threats, vulnerabilities, safeguards
6. **Moduł analizy ryzyka** — CRUD risks + risk_safeguards + scoring
7. **Moduł przeglądów ryzyka** — risk_reviews + overdue view
8. **Moduł CIS Benchmark** — assessments + answers + scoring + views
9. **Audit trail** — middleware logujący zmiany
10. **Frontend** — React app z routingiem, layout, i widoki moduł po module
11. **Dashboardy** — agregacje, wykresy, heatmapy

## API Conventions

```
GET    /api/v1/{module}           # List (z filtrami query params)
GET    /api/v1/{module}/{id}      # Get single
POST   /api/v1/{module}           # Create
PUT    /api/v1/{module}/{id}      # Update
DELETE /api/v1/{module}/{id}      # Soft delete (is_active = false)

# Przykłady:
GET    /api/v1/risks?org_unit_id=3&risk_level=high&status=mitigating
GET    /api/v1/cis/assessments?org_unit_id=3
POST   /api/v1/cis/assessments/{id}/answers
GET    /api/v1/dictionaries/risk_status/entries
GET    /api/v1/org-units/tree
GET    /api/v1/dashboard/executive-summary
```

## Ważne Uwagi

- **Język UI**: Polski (etykiety, komunikaty). Nazwy zmiennych/kodu po angielsku.
- **Audit trail**: Każda operacja zapisu/edycji/usunięcia musi tworzyć wpis w `audit_log`.
- **Soft delete**: Nigdy nie kasuj rekordów — ustaw `is_active = FALSE` lub odpowiedni status.
- **Computed fields**: `risk_score` i `risk_level` w tabeli `risks` to kolumny GENERATED — nie ustawiaj ich ręcznie.
- **CIS N/A**: Sub-kontrole oznaczone jako N/A nie wliczają się do żadnych średnich/scoringów.
- **Seed data**: Słowniki i CIS controls mają seed data w `schema.sql` i `seed_cis_subcontrols.sql`.
