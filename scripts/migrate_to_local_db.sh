#!/usr/bin/env bash
# ============================================================
# SecurePosture — Migracja z remote DB → local MariaDB
#
# Wymagania (juz spelnione):
#   - MariaDB 11.8.3 zainstalowane lokalnie
#   - Baza 'secureposture' utworzona (CREATE DATABASE)
#   - Backup: ~/SecurePosture/backend/secureposture_backup.sql
#
# Uzycie:  ./migrate_to_local_db.sh
# ============================================================
set -euo pipefail

# ── Konfiguracja ──
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
BACKUP_FILE="$BACKEND_DIR/secureposture_backup.sql"
DB_NAME="secureposture"
DB_USER="root"
# Haslo MariaDB — zostaniesz zapytany interaktywnie

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[X]${NC} $1"; }
step() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

# ── Walidacja ──
step "Walidacja"

if [ ! -f "$BACKUP_FILE" ]; then
    err "Brak pliku backupu: $BACKUP_FILE"
    exit 1
fi
log "Backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

if ! command -v mariadb &>/dev/null; then
    err "mariadb CLI niedostepne"
    exit 1
fi
log "MariaDB CLI dostepne"

# Sprawdz polaczenie lokalne
if mariadb -u "$DB_USER" -p -e "SELECT 1" &>/dev/null; then
    log "Polaczenie z lokalna baza OK"
else
    warn "Nie mozna sie polaczyc — sprawdz haslo root"
fi

# ── Krok 1: Import backupu ──
step "Krok 1: Import backupu do lokalnej bazy"
echo "Importuje $BACKUP_FILE -> $DB_NAME ..."
echo "Podaj haslo root MariaDB:"

mariadb -u "$DB_USER" -p "$DB_NAME" < "$BACKUP_FILE"

# Sprawdz ile tabel
TABLE_COUNT=$(mariadb -u "$DB_USER" -p -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_type='BASE TABLE'")
log "Zaimportowano $TABLE_COUNT tabel"

# ── Krok 2: Napraw widoki ──
step "Krok 2: Naprawa uszkodzonych widokow"

mariadb -u "$DB_USER" -p "$DB_NAME" <<'SQLEOF'
-- Usun stare uszkodzone widoki
DROP VIEW IF EXISTS v_overdue_risks;
DROP VIEW IF EXISTS v_risk_summary_by_area;

-- Odtworz v_overdue_risks (explicit columns)
CREATE OR REPLACE VIEW v_overdue_risks AS
SELECT
    r.id,
    r.org_unit_id,
    r.asset_name,
    r.security_area_id,
    r.impact_level,
    r.probability_level,
    r.safeguard_rating,
    r.risk_score,
    r.risk_level,
    r.status_id,
    r.strategy_id,
    r.owner,
    r.identified_at,
    r.last_review_at,
    rc.review_interval_days,
    DATEDIFF(NOW(), COALESCE(r.last_review_at, r.identified_at)) AS days_since_review,
    CASE
        WHEN DATEDIFF(NOW(), COALESCE(r.last_review_at, r.identified_at)) > rc.review_interval_days
        THEN TRUE ELSE FALSE
    END AS is_overdue
FROM risks r
CROSS JOIN risk_review_config rc
WHERE r.risk_level IN ('high', 'medium', 'low');

-- Odtworz v_risk_summary_by_area (explicit columns)
CREATE OR REPLACE VIEW v_risk_summary_by_area AS
SELECT
    sa.id AS area_id,
    sa.name AS area_name,
    COUNT(r.id) AS total_risks,
    SUM(CASE WHEN r.risk_level = 'high' THEN 1 ELSE 0 END) AS high_risks,
    SUM(CASE WHEN r.risk_level = 'medium' THEN 1 ELSE 0 END) AS medium_risks,
    SUM(CASE WHEN r.risk_level = 'low' THEN 1 ELSE 0 END) AS low_risks,
    ROUND(AVG(r.risk_score), 1) AS avg_risk_score
FROM security_domains sa
LEFT JOIN risks r ON r.security_area_id = sa.id
WHERE sa.is_active = 1
GROUP BY sa.id, sa.name;
SQLEOF

log "Widoki naprawione"

# ── Krok 3: Sprawdz alembic_version ──
step "Krok 3: Weryfikacja alembic_version"

ALEMBIC_VER=$(mariadb -u "$DB_USER" -p -N -e "SELECT version_num FROM $DB_NAME.alembic_version LIMIT 1" 2>/dev/null || echo "BRAK")

if [ "$ALEMBIC_VER" = "021_doc_metrics_att_prompt" ]; then
    log "Alembic jest na najnowszej wersji: $ALEMBIC_VER"
elif [ "$ALEMBIC_VER" = "BRAK" ]; then
    warn "Brak tabeli alembic_version — tworze i stampuje do head"
    mariadb -u "$DB_USER" -p "$DB_NAME" -e "
        CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, PRIMARY KEY (version_num));
        INSERT INTO alembic_version (version_num) VALUES ('021_doc_metrics_att_prompt');
    "
    log "Alembic stamped to 021_doc_metrics_att_prompt"
else
    warn "Alembic na wersji: $ALEMBIC_VER (oczekiwano: 021_doc_metrics_att_prompt)"
    echo "Uruchom 'alembic upgrade head' z katalogu backend/"
fi

# ── Krok 4: Weryfikacja ──
step "Krok 4: Weryfikacja"

echo ""
echo "Tabele:"
mariadb -u "$DB_USER" -p -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_type='BASE TABLE'" | xargs echo "  Tabele bazowe:"
mariadb -u "$DB_USER" -p -N -e "SELECT COUNT(*) FROM information_schema.views WHERE table_schema='$DB_NAME'" | xargs echo "  Widoki:"

echo ""
echo "Dane (sample):"
mariadb -u "$DB_USER" -p -N -e "SELECT COUNT(*) FROM $DB_NAME.risks" 2>/dev/null | xargs echo "  Ryzyka:" || echo "  Ryzyka: 0"
mariadb -u "$DB_USER" -p -N -e "SELECT COUNT(*) FROM $DB_NAME.security_domains" 2>/dev/null | xargs echo "  Security domains:" || echo "  Security domains: 0"
mariadb -u "$DB_USER" -p -N -e "SELECT COUNT(*) FROM $DB_NAME.frameworks" 2>/dev/null | xargs echo "  Frameworki:" || echo "  Frameworki: 0"
mariadb -u "$DB_USER" -p -N -e "SELECT COUNT(*) FROM $DB_NAME.dictionary_entries" 2>/dev/null | xargs echo "  Slowniki:" || echo "  Slowniki: 0"

echo ""
echo "Widoki (test):"
mariadb -u "$DB_USER" -p -N -e "SELECT 'v_overdue_risks OK, rows:', COUNT(*) FROM $DB_NAME.v_overdue_risks" 2>/dev/null || err "v_overdue_risks BROKEN"
mariadb -u "$DB_USER" -p -N -e "SELECT 'v_risk_summary_by_area OK, rows:', COUNT(*) FROM $DB_NAME.v_risk_summary_by_area" 2>/dev/null || err "v_risk_summary_by_area BROKEN"

# ── Krok 5: Info o .env ──
step "Krok 5: Aktualizacja .env"

CURRENT_URL=$(grep "^DATABASE_URL=" "$BACKEND_DIR/.env" | head -1)
echo "Obecny: $CURRENT_URL"
echo ""
echo "Aby przlaczyc aplikacje na lokalna baze, zmien .env:"
echo "  DATABASE_URL=mysql+asyncmy://root:TWOJE_HASLO@localhost:3306/secureposture"
echo ""
echo "Lub uruchom:"
echo "  sed -i 's|DATABASE_URL=.*|DATABASE_URL=mysql+asyncmy://root:TWOJE_HASLO@localhost:3306/secureposture|' $BACKEND_DIR/.env"
echo ""

step "Gotowe!"
echo "Nastepne kroki:"
echo "  1. Zaktualizuj .env (DATABASE_URL -> localhost)"
echo "  2. Restart backendu: kill uvicorn + uruchom ponownie"
echo "  3. Sprawdz: curl http://localhost:8000/health"
echo ""
