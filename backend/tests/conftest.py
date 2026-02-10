"""
Shared test fixtures — in-memory SQLite async database + FastAPI TestClient.

Strategy:
1. Set DATABASE_URL to SQLite before anything loads
2. Inject a mock app.database module into sys.modules before app.main imports
3. All routers will use our test session via dependency override
"""
import os
import sys
import types
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ── 1. Environment ──
os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"
os.environ["DEBUG"] = "false"

# ── 2. Test engine (SQLite in-memory) ──
TEST_ENGINE = create_async_engine(
    "sqlite+aiosqlite://",
    echo=False,
    connect_args={"check_same_thread": False},
)

TestSession = async_sessionmaker(
    TEST_ENGINE,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── 3. SQLite compat: register MySQL functions ──
@event.listens_for(TEST_ENGINE.sync_engine, "connect")
def _register_sqlite_functions(dbapi_conn, connection_record):
    dbapi_conn.create_function("FIND_IN_SET", 2, _find_in_set)
    dbapi_conn.create_function("datediff", 2, _datediff)


def _find_in_set(needle, haystack):
    if haystack is None or needle is None:
        return 0
    items = str(haystack).split(",")
    needle_str = str(needle)
    for i, item in enumerate(items, 1):
        if item.strip() == needle_str:
            return i
    return 0


def _datediff(date1, date2):
    """SQLite implementation of MySQL DATEDIFF(date1, date2) -> days."""
    from datetime import datetime as _dt
    if date1 is None or date2 is None:
        return None
    try:
        fmts = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d"]
        d1 = d2 = None
        for fmt in fmts:
            if d1 is None:
                try:
                    d1 = _dt.strptime(str(date1), fmt)
                except ValueError:
                    pass
            if d2 is None:
                try:
                    d2 = _dt.strptime(str(date2), fmt)
                except ValueError:
                    pass
        if d1 and d2:
            return (d1 - d2).days
        return 0
    except Exception:
        return 0


# ── 4. Replace app.database module BEFORE app.main is imported ──
async def _test_get_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session


async def _test_check_db() -> bool:
    return True


# Build a fake database module
_fake_db = types.ModuleType("app.database")
_fake_db.engine = TEST_ENGINE
_fake_db.async_session = TestSession
_fake_db.get_session = _test_get_session
_fake_db.check_db_connection = _test_check_db
sys.modules["app.database"] = _fake_db

# ── 5. Now import the app — all routers will see our fake database ──
from app.models.base import Base  # noqa: E402
from app.models import *  # noqa: E402, F401, F403
from app.main import app as fastapi_app  # noqa: E402

# Override the dependency (routers use Depends(get_session))
fastapi_app.dependency_overrides[_test_get_session] = _test_get_session


# ── Fixtures ──

@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test, drop after."""
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session


# ── Seed data helpers ──

@pytest_asyncio.fixture
async def seed_org(db: AsyncSession):
    from app.models.org_unit import OrgLevel, OrgUnit

    level = OrgLevel(level_number=1, name="Pion")
    db.add(level)
    await db.flush()

    unit = OrgUnit(level_id=level.id, name="IT", symbol="IT", owner="Jan Kowalski")
    db.add(unit)
    await db.commit()
    return level.id, unit.id


@pytest_asyncio.fixture
async def seed_dicts(db: AsyncSession):
    from app.models.dictionary import DictionaryType, DictionaryEntry

    result = {}
    defs = {
        "risk_status": [("open", "Otwarty"), ("closed", "Zamkniete"), ("accepted", "Zaakceptowane")],
        "risk_strategy": [("modify", "Modyfikacja ryzyka"), ("retain", "Utrzymanie ryzyka")],
        "risk_category": [("strategic", "Strategiczne"), ("operational", "Operacyjne")],
        "control_effectiveness": [("none", "Brak kontroli"), ("effective", "Skuteczna")],
        "asset_category": [("hardware", "Sprzet"), ("software", "Oprogramowanie")],
        "sensitivity": [("low", "Niska"), ("high", "Wysoka")],
        "criticality": [("low", "Niska"), ("high", "Wysoka")],
        "action_priority": [("high", "Wysoki"), ("medium", "Sredni")],
        "action_status": [("new", "Nowy"), ("in_progress", "W trakcie"), ("completed", "Zakonczone")],
        "action_source": [("risk_analysis", "Analiza ryzyka"), ("audit", "Audyt")],
    }
    for type_code, entries in defs.items():
        dt = DictionaryType(code=type_code, name=type_code)
        db.add(dt)
        await db.flush()
        type_entries = {}
        for i, (code, label) in enumerate(entries):
            de = DictionaryEntry(dict_type_id=dt.id, code=code, label=label, sort_order=i)
            db.add(de)
            await db.flush()
            type_entries[code] = de.id
        result[type_code] = type_entries

    await db.commit()
    return result


@pytest_asyncio.fixture
async def seed_security_area(db: AsyncSession):
    from app.models.security_area import SecurityArea

    area = SecurityArea(name="Bezpieczenstwo informacji")
    db.add(area)
    await db.commit()
    return area.id


@pytest_asyncio.fixture
async def seed_catalog(db: AsyncSession, seed_security_area):
    from app.models.catalog import Threat, Vulnerability, Safeguard

    t = Threat(name="Ransomware")
    v = Vulnerability(name="Brak backupu", security_area_id=seed_security_area)
    s = Safeguard(name="Firewall")
    db.add_all([t, v, s])
    await db.commit()
    return t.id, v.id, s.id
