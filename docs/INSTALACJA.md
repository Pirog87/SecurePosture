# SecurePosture — Instalacja i zależności

## Wymagania systemowe

| Komponent | Wersja minimalna |
|-----------|-----------------|
| **Node.js** | 18.x+ (zalecane 20.x LTS) |
| **npm** | 9.x+ |
| **Python** | 3.12+ |
| **pip** | 23.x+ |
| **MariaDB** | 10.6+ |

---

## 1. Baza danych (MariaDB)

```bash
# Import schematu
mysql -u root -p < db/schema.sql

# Import danych CIS Controls
mysql -u root -p secureposture < db/seed_cis_subcontrols.sql
```

---

## 2. Backend (Python / FastAPI)

### Zależności (`backend/requirements.txt`)

| Paczka | Wersja | Opis |
|--------|--------|------|
| fastapi | 0.115.6 | Framework webowy (REST API) |
| uvicorn[standard] | 0.34.0 | Serwer ASGI |
| pydantic-settings | 2.7.1 | Konfiguracja z pliku .env |
| sqlalchemy[asyncio] | 2.0.36 | ORM z obsługą async |
| asyncmy | 0.2.9 | Async driver MariaDB/MySQL |
| python-dotenv | 1.0.1 | Ładowanie zmiennych .env |
| alembic | 1.18.4 | Migracje bazy danych |
| openpyxl | 3.1.5 | Obsługa plików Excel (import/eksport) |
| pyyaml | 6.0+ | Parsowanie YAML |
| httpx | 0.28.1 | Async HTTP client |

### Instalacja

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # skonfiguruj DATABASE_URL
```

### Uruchomienie

```bash
# Development
uvicorn app.main:app --reload --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 3. Frontend (React / TypeScript)

### Zależności produkcyjne (`frontend/package.json` — dependencies)

| Paczka | Wersja | Opis |
|--------|--------|------|
| react | ^19.2.0 | Biblioteka UI |
| react-dom | ^19.2.0 | Renderer DOM |
| react-router-dom | ^7.13.0 | Routing SPA |
| tailwindcss | ^4.1.18 | Framework CSS (utility-first) |
| @tailwindcss/vite | ^4.1.18 | Plugin Tailwind dla Vite |
| xlsx | ^0.18.5 | Eksport danych do XLSX/CSV (SheetJS) |

### Zależności deweloperskie (`frontend/package.json` — devDependencies)

| Paczka | Wersja | Opis |
|--------|--------|------|
| typescript | ~5.9.3 | Kompilator TypeScript |
| vite | ^7.3.1 | Bundler / dev server |
| @vitejs/plugin-react | ^5.1.1 | Plugin React dla Vite |
| @types/react | ^19.2.7 | Typy TS dla React |
| @types/react-dom | ^19.2.3 | Typy TS dla ReactDOM |
| @types/node | ^24.10.1 | Typy TS dla Node.js |
| eslint | ^9.39.1 | Linter JS/TS |
| @eslint/js | ^9.39.1 | Konfiguracja ESLint |
| eslint-plugin-react-hooks | ^7.0.1 | Reguły ESLint dla React Hooks |
| eslint-plugin-react-refresh | ^0.4.24 | ESLint + React Fast Refresh |
| globals | ^16.5.0 | Definicje zmiennych globalnych |
| typescript-eslint | ^8.48.0 | ESLint parser TypeScript |

### Instalacja

```bash
cd frontend
npm install
```

### Budowanie

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build

# Podgląd produkcyjnego builda
npm run preview
```

---

## 4. Deployment — procedura aktualizacji na serwerze

Po każdym `git pull` z nowymi zmianami:

```bash
# 1. Pobierz zmiany
cd ~/SecurePosture
git pull

# 2. Backend — zaktualizuj zależności Python
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart secureposture-backend   # lub odpowiedni serwis

# 3. Frontend — zaktualizuj zależności npm i przebuduj
cd ../frontend
npm install       # <-- WAŻNE: zawsze przed build!
npm run build

# 4. (Opcjonalnie) Migracje bazy danych
cd ../backend
alembic upgrade head
```

> **UWAGA**: `npm install` jest wymagany po każdym `git pull`, jeśli zmieniły się zależności w `package.json`. Pominięcie tego kroku spowoduje błędy typu:
> ```
> error TS2307: Cannot find module 'xlsx' or its corresponding type declarations.
> ```

---

## 5. Zmienne środowiskowe

### Backend (`backend/.env`)

```env
DATABASE_URL=mysql+asyncmy://user:password@localhost:3306/secureposture
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

W produkcji `VITE_API_URL` powinien wskazywać na adres serwera API (np. `https://api.example.com`).
