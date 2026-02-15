#!/usr/bin/env python3
"""SecurePosture — Weryfikacja bazy danych po migracji.

Uruchom z katalogu backend/ (z aktywnym venv):
    python ../scripts/verify_db.py

Sprawdza:
  1. Polaczenie z baza (z .env)
  2. Istnienie wszystkich tabel wymaganych przez modele
  3. Dzialanie widokow
  4. Wersje alembic
  5. Podstawowe dane (seed data)
"""
import asyncio
import os
import sys
from pathlib import Path

# Ustaw sciezke na backend/
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))
os.chdir(str(backend_dir))

# Parsuj .env
env_file = backend_dir / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())


GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
NC = "\033[0m"


def ok(msg):
    print(f"  {GREEN}[OK]{NC} {msg}")

def fail(msg):
    print(f"  {RED}[FAIL]{NC} {msg}")

def warn(msg):
    print(f"  {YELLOW}[!]{NC} {msg}")

def step(msg):
    print(f"\n{BLUE}=== {msg} ==={NC}")


REQUIRED_TABLES = [
    "users", "dictionary_types", "dictionary_entries",
    "org_levels", "org_units", "security_domains",
    "risks", "risk_review_config", "risk_reviews",
    "threats", "vulnerabilities", "safeguards",
    "cis_controls", "cis_sub_controls", "cis_assessments",
    "cis_assessment_answers", "audit_log",
    # Alembic-created tables
    "frameworks", "framework_nodes", "assessment_dimensions",
    "dimension_levels", "assessments", "assessment_answers",
    "assets", "vulnerabilities_registry", "incidents",
    "policies", "policy_exceptions", "audit_findings",
    "vendors", "awareness_campaigns",
    "security_score_config",
    "threat_catalog", "weakness_catalog", "control_catalog",
    "risk_threats", "risk_vulnerabilities", "risk_safeguards",
    "control_implementations",
    "mapping_sets", "framework_mappings",
    "framework_node_ai_cache",
    "ai_provider_config",
    "document_metrics", "framework_attachments", "ai_prompt_templates",
    # Audit Program V2 (migration 024)
    "audit_programs_v2", "audit_program_items", "audit_program_change_requests",
    "audit_program_history", "audit_program_version_diffs",
    "suppliers", "locations",
    "alembic_version",
]

REQUIRED_VIEWS = [
    "v_overdue_risks",
    "v_risk_summary_by_area",
    "v_risk_summary_by_org",
    "v_cis_control_scores",
    "v_latest_cis_assessment",
]

SEED_CHECKS = [
    ("dictionary_types", 10),
    ("dictionary_entries", 30),
    ("security_domains", 10),
    ("cis_controls", 18),
    ("org_levels", 3),
]


async def main():
    import asyncmy

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        fail("DATABASE_URL nie ustawione w .env")
        sys.exit(1)

    # Parsuj URL
    # mysql+asyncmy://user:pass@host:port/dbname
    from urllib.parse import urlparse, unquote
    parsed = urlparse(db_url.replace("mysql+asyncmy://", "mysql://"))
    host = parsed.hostname or "localhost"
    port = parsed.port or 3306
    user = unquote(parsed.username or "root")
    password = unquote(parsed.password or "")
    dbname = parsed.path.lstrip("/")

    step("1. Polaczenie z baza")
    print(f"  Host: {host}:{port}, DB: {dbname}, User: {user}")

    try:
        conn = await asyncmy.connect(
            host=host, port=port, user=user, password=password, db=dbname,
            connect_timeout=10
        )
        ok("Polaczenie OK")
    except Exception as e:
        fail(f"Nie mozna polaczyc: {e}")
        sys.exit(1)

    cur = conn.cursor()
    errors = 0

    # ── 2. Tabele ──
    step("2. Tabele")
    await cur.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema=%s AND table_type='BASE TABLE'", (dbname,)
    )
    existing_tables = {row[0] for row in await cur.fetchall()}
    print(f"  Znaleziono {len(existing_tables)} tabel")

    missing = []
    for t in REQUIRED_TABLES:
        if t not in existing_tables:
            missing.append(t)

    if missing:
        fail(f"Brakujace tabele ({len(missing)}): {', '.join(missing)}")
        errors += len(missing)
    else:
        ok(f"Wszystkie {len(REQUIRED_TABLES)} wymagane tabele istnieja")

    # ── 3. Widoki ──
    step("3. Widoki")
    await cur.execute(
        "SELECT table_name FROM information_schema.views WHERE table_schema=%s", (dbname,)
    )
    existing_views = {row[0] for row in await cur.fetchall()}

    for v in REQUIRED_VIEWS:
        if v not in existing_views:
            warn(f"Brak widoku: {v}")
        else:
            try:
                await cur.execute(f"SELECT COUNT(*) FROM `{v}`")
                count = (await cur.fetchone())[0]
                ok(f"{v}: {count} rows")
            except Exception as e:
                fail(f"{v}: {e}")
                errors += 1

    # ── 4. Alembic ──
    step("4. Alembic version")
    try:
        await cur.execute("SELECT version_num FROM alembic_version")
        row = await cur.fetchone()
        ver = row[0] if row else "EMPTY"
        if ver == "021_doc_metrics_att_prompt":
            ok(f"Alembic: {ver} (najnowsza)")
        else:
            warn(f"Alembic: {ver} (oczekiwano: 021_doc_metrics_att_prompt)")
    except Exception as e:
        fail(f"alembic_version: {e}")
        errors += 1

    # ── 5. Seed data ──
    step("5. Dane seedowe")
    for table, min_count in SEED_CHECKS:
        try:
            await cur.execute(f"SELECT COUNT(*) FROM `{table}`")
            count = (await cur.fetchone())[0]
            if count >= min_count:
                ok(f"{table}: {count} rows (>= {min_count})")
            else:
                warn(f"{table}: {count} rows (oczekiwano >= {min_count})")
        except Exception as e:
            fail(f"{table}: {e}")
            errors += 1

    # ── 6. Kluczowe dane ──
    step("6. Kluczowe dane")
    for table in ["risks", "frameworks", "framework_nodes", "ai_prompt_templates", "users"]:
        try:
            await cur.execute(f"SELECT COUNT(*) FROM `{table}`")
            count = (await cur.fetchone())[0]
            ok(f"{table}: {count} rows")
        except Exception as e:
            fail(f"{table}: {e}")

    await cur.close()
    conn.close()

    # ── Podsumowanie ──
    step("Podsumowanie")
    if errors == 0:
        ok("Baza danych jest w dobrym stanie!")
    else:
        fail(f"Znaleziono {errors} problemow — wymagaja naprawy")

    return errors


if __name__ == "__main__":
    errors = asyncio.run(main())
    sys.exit(1 if errors > 0 else 0)
