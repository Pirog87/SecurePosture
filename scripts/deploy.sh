#!/usr/bin/env bash
# ============================================================
# SecurePosture — uniwersalny skrypt deploy/restart
# Użycie:  ./deploy.sh              (pull + pełny restart)
#          ./deploy.sh --no-pull    (restart bez git pull)
#          ./deploy.sh --backend    (tylko backend)
#          ./deploy.sh --frontend   (tylko frontend)
#          ./deploy.sh --db         (tylko migracje DB)
# ============================================================
set -euo pipefail

# ── Konfiguracja ──
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"
BACKEND_SERVICE="secureposture-backend"   # nazwa systemd service (jeśli istnieje)
BACKEND_PORT=8000
FRONTEND_PORT=5176

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
step() { echo -e "\n${BLUE}═══ $1 ═══${NC}"; }

# ── Parsowanie flag ──
DO_PULL=true
DO_BACKEND=true
DO_FRONTEND=true
DO_DB=true

for arg in "$@"; do
    case $arg in
        --no-pull)   DO_PULL=false ;;
        --backend)   DO_FRONTEND=false; DO_DB=false ;;
        --frontend)  DO_BACKEND=false; DO_DB=false ;;
        --db)        DO_BACKEND=false; DO_FRONTEND=false ;;
        --help|-h)
            echo "Użycie: $0 [--no-pull] [--backend] [--frontend] [--db]"
            exit 0 ;;
    esac
done

# ── 1. Git pull ──
if $DO_PULL; then
    step "Git pull"
    cd "$PROJECT_DIR"
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    log "Branch: $BRANCH"

    BEFORE=$(git rev-parse HEAD)
    git pull origin "$BRANCH" 2>&1 | tail -5
    AFTER=$(git rev-parse HEAD)

    if [ "$BEFORE" = "$AFTER" ]; then
        log "Brak nowych zmian (already up-to-date)"
    else
        log "Pobrano nowe commity: $(git log --oneline "$BEFORE".."$AFTER" | wc -l)"
        git log --oneline "$BEFORE".."$AFTER" | head -10
    fi
fi

# ── 2. Backend ──
if $DO_BACKEND; then
    step "Backend"

    # Aktywuj venv
    if [ -d "$VENV_DIR" ]; then
        source "$VENV_DIR/bin/activate"
        log "venv aktywowane"
    else
        warn "Brak venv w $VENV_DIR — używam systemowego Pythona"
    fi

    # Zainstaluj zależności jeśli requirements.txt się zmienił
    cd "$BACKEND_DIR"
    if $DO_PULL && git diff "$BEFORE".."$AFTER" --name-only 2>/dev/null | grep -q "requirements.txt"; then
        log "requirements.txt zmieniony — instaluję zależności..."
        pip install -q -r requirements.txt
    fi

    # Restart backendu
    if systemctl is-active --quiet "$BACKEND_SERVICE" 2>/dev/null; then
        log "Restartuję systemd service: $BACKEND_SERVICE"
        sudo systemctl restart "$BACKEND_SERVICE"
        sleep 2
        if systemctl is-active --quiet "$BACKEND_SERVICE"; then
            log "Backend działa (systemd)"
        else
            err "Backend nie wystartował! Sprawdź: journalctl -u $BACKEND_SERVICE -n 30"
            exit 1
        fi
    else
        warn "Brak systemd service '$BACKEND_SERVICE' — restartuję ręcznie"

        # Zabij istniejący proces uvicorn
        PIDS=$(pgrep -f "uvicorn app.main:app" || true)
        if [ -n "$PIDS" ]; then
            log "Zatrzymuję uvicorn (PID: $PIDS)..."
            kill $PIDS 2>/dev/null || true
            sleep 2
            # Force kill jeśli nadal żyje
            kill -9 $PIDS 2>/dev/null || true
        fi

        # Uruchom uvicorn w tle
        cd "$BACKEND_DIR"
        nohup uvicorn app.main:app \
            --host 0.0.0.0 \
            --port "$BACKEND_PORT" \
            --workers 2 \
            >> "$BACKEND_DIR/uvicorn.log" 2>&1 &

        # Sprawdź health (retry do 15s)
        HEALTH_OK=false
        for i in 1 2 3 4 5; do
            sleep 3
            if curl -sf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
                HEALTH_OK=true
                break
            fi
            warn "Health check próba $i/5 — czekam..."
        done

        if $HEALTH_OK; then
            log "Backend działa na porcie $BACKEND_PORT (PID: $!)"
        else
            err "Backend nie odpowiada na /health! Sprawdź: tail -30 $BACKEND_DIR/uvicorn.log"
            exit 1
        fi
    fi
fi

# ── 3. Migracje DB ──
if $DO_DB; then
    step "Migracje bazy danych"
    cd "$BACKEND_DIR"

    if [ -d "$VENV_DIR" ]; then
        source "$VENV_DIR/bin/activate"
    fi

    if command -v alembic &>/dev/null; then
        log "Uruchamiam alembic upgrade head..."
        alembic upgrade head 2>&1 | tail -5 && log "Migracje OK" || warn "Migracje nie powiodły się (może brak zmian)"
    else
        warn "Alembic niedostępny — pomiń migracje lub uruchom ręcznie"
    fi
fi

# ── 4. Frontend ──
if $DO_FRONTEND; then
    step "Frontend"
    cd "$FRONTEND_DIR"

    # Sprawdź czy node_modules jest aktualny
    if [ ! -d "node_modules" ]; then
        log "Brak node_modules — instaluję..."
        npm install
    elif $DO_PULL && git diff "$BEFORE".."$AFTER" --name-only 2>/dev/null | grep -q "package.json\|package-lock.json"; then
        log "package.json zmieniony — npm install..."
        npm install
    fi

    # Build produkcyjny
    log "Buduję frontend (npm run build)..."
    npm run build 2>&1 | tail -5
    log "Frontend zbudowany → $FRONTEND_DIR/dist/"

    # Restart vite dev server jeśli działa
    VITE_PIDS=$(pgrep -f "vite" || true)
    if [ -n "$VITE_PIDS" ]; then
        log "Restartuję vite dev server..."
        kill $VITE_PIDS 2>/dev/null || true
        sleep 1
        cd "$FRONTEND_DIR"
        nohup npm run dev >> "$FRONTEND_DIR/vite.log" 2>&1 &
        sleep 2
        log "Vite dev server uruchomiony na porcie $FRONTEND_PORT"
    fi

    # Przeładuj nginx jeśli działa (serwuje dist/)
    if systemctl is-active --quiet nginx 2>/dev/null; then
        log "Przeładowuję nginx..."
        sudo nginx -s reload
    fi
fi

# ── 5. Podsumowanie ──
step "Gotowe!"
echo ""
log "Backend:  http://localhost:$BACKEND_PORT/health"
log "Frontend: http://localhost:$FRONTEND_PORT"
echo ""
warn "Odśwież przeglądarkę (Ctrl+Shift+R) aby załadować nową wersję"
echo ""
