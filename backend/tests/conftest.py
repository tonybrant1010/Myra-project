import os
import sys
import pytest
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment
os.environ["DB_DIALECT"] = "sqlite"
os.environ["ENVIRONMENT"] = "development"

from server import app, Base, get_db

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def configure_rate_limits(request):
    """Automatikusan beállítja a rate limit környezeti változót a tesztfájl alapján."""
    # Ha a test_security.py fájlban vagyunk, engedélyezzük a rate limit teszteket (eltávolítjuk a bypass-t)
    if "test_security.py" in request.node.fspath.strpath:
        os.environ.pop("DISABLE_RATE_LIMITS", None)
    else:
        os.environ["DISABLE_RATE_LIMITS"] = "true"


@pytest.fixture
async def init_db():
    app.dependency_overrides[get_db] = override_get_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()


@pytest.fixture
async def client(init_db):
    """Async HTTP kliens a FastAPI app teszteléséhez."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
