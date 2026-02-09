# 🛡 SecurePosture — CISO Security Platform

Aplikacja webowa do zarządzania i wizualizacji stanu bezpieczeństwa organizacji.

## Cel

Dashboard dla CISO i kadry zarządzającej — pokazuje braki, ryzyka i problemy bezpieczeństwa na poziomie całej organizacji i poszczególnych jednostek biznesowych. Umożliwia analizę ryzyka oraz ocenę dojrzałości wg CIS Controls v8.

## Moduły

| Moduł | Opis | Status |
|-------|------|--------|
| Struktura organizacyjna | Hierarchiczna struktura jednostek | 🔲 TODO |
| Słowniki | Centralne listy słownikowe | 🔲 TODO |
| Obszary bezpieczeństwa | Definiowalna lista obszarów | 🔲 TODO |
| Katalogi | Zagrożenia, podatności, zabezpieczenia | 🔲 TODO |
| Analiza ryzyka | Rejestr ryzyk z formułą R=EXP(W)×P/Z | 🔲 TODO |
| Przeglądy ryzyka | Cykliczne przeglądy, alerty | 🔲 TODO |
| CIS Benchmark | Ocena CIS Controls v8 per firma/jednostka | 🔲 TODO |
| Dashboardy | Widoki executive, heatmapy, trendy | 🔲 TODO |
| Audit trail | Pełne logowanie zmian | 🔲 TODO |

## Tech Stack

| Warstwa | Technologia |
|---------|-------------|
| **Backend** | Python 3.12+ / FastAPI / SQLAlchemy / Alembic |
| **Frontend** | React 18+ / TypeScript / Tailwind CSS / Recharts / shadcn/ui |
| **Baza danych** | MariaDB 10.6+ |
| **Architektura** | API-first (SPA) — REST API + osobna aplikacja React |

## Struktura Projektu

```
secureposture/
├── .claude/                    # Kontekst dla Claude Code
│   └── instructions.md
├── docs/                       # Dokumentacja
│   ├── SPECYFIKACJA_v1.1.md    # Pełna specyfikacja wymagań
│   └── prototype.html          # Interaktywny prototyp UI (mockup)
├── db/                         # Baza danych
│   ├── schema.sql              # Schemat MariaDB
│   └── seed_cis_subcontrols.sql # 148 sub-kontroli CIS v8
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── routers/            # API endpoints
│   │   ├── services/           # Business logic
│   │   └── middleware/         # Auth, audit trail
│   ├── alembic/                # DB migrations
│   ├── requirements.txt
│   └── alembic.ini
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/           # API client
│   │   └── types/
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

## Quick Start

### 1. Baza danych

```bash
mysql -u root -p < db/schema.sql
mysql -u root -p secureposture < db/seed_cis_subcontrols.sql
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Skonfiguruj connection string
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs (Swagger)

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Dokumentacja

- **Specyfikacja wymagań**: [`docs/SPECYFIKACJA_v1.1.md`](docs/SPECYFIKACJA_v1.1.md)
- **Prototyp UI**: [`docs/prototype.html`](docs/prototype.html) — otwórz w przeglądarce
- **Schemat bazy**: [`db/schema.sql`](db/schema.sql)

## Licencja

Projekt wewnętrzny. Dane CIS Controls na licencji CC BY-SA 4.0 (AuditScripts).
