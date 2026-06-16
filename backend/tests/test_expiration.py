import pytest
import datetime
from datetime import timezone
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, delete

# Set environment variables for testing before importing server
import os
os.environ["DB_DIALECT"] = "sqlite"
os.environ["ENVIRONMENT"] = "development"


import sys
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from server import app, Base, User, StateCode, QuizSubmission, ChatMessage, get_db, get_current_user

# Setup test in-memory SQLite database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

# Override get_db dependency
async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

app.dependency_overrides[get_db] = override_get_db

# Tell pytest to use anyio for async tests
@pytest.fixture
def anyio_backend():
    return "asyncio"

# Create a fixture to initialize the database
@pytest.fixture(autouse=True)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.anyio
async def test_expiration_scenarios():
    client = TestClient(app)

    # 1. Setup test data (User, StateCode, QuizSubmission)
    async def setup_data(verified_days_ago: int, user_id: int, session_id: str):
        async with TestingSessionLocal() as db:
            # Clear old records to avoid integrity errors
            await db.execute(delete(ChatMessage))
            await db.execute(delete(QuizSubmission))
            await db.execute(delete(User))
            await db.execute(delete(StateCode))
            await db.commit()

            # Add state code
            sc = StateCode(
                code="1221",
                a=1, p=2, h=2, c=1,
                title="Átlagos állapot",
                severity="NORMAL",
                profile="Minden rendben van."
            )
            db.add(sc)
            
            # Add user
            now = datetime.datetime.now(timezone.utc)
            verified_at = now - datetime.timedelta(days=verified_days_ago)
            user = User(
                id=user_id,
                email="test@example.com",
                name="Teszt User",
                password_hash="fakehash",
                is_admin=False,
                state_code="1221",
                code_verified_at=verified_at
            )
            db.add(user)
            
            # Add quiz submission (session)
            submission = QuizSubmission(
                id=session_id,
                user_id=user_id,
                answers=[1,2,3,4],
                norms={"a": 0.1, "p": 0.2, "h": 0.2, "c": 0.1},
                code="1221",
                created_at=verified_at
            )
            db.add(submission)
            
            await db.commit()
            
            # Set dependency override to return this specific user
            res = await db.execute(select(User).where(User.id == user_id))
            db_user = res.scalar_one()
            app.dependency_overrides[get_current_user] = lambda: db_user

    # Scenario 1: Pre-expiration (28 days ago) -> Active with 2 days remaining
    await setup_data(verified_days_ago=28, user_id=1, session_id="session-1234")
    
    # Test /api/codes/me
    headers = {"Authorization": "Bearer fake-token"}
    r = client.get("/api/codes/me", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_expired"] is False
    assert data["days_remaining"] == 2
    
    # Test /api/auth/me
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    user_data = r.json()["user"]
    assert user_data["is_code_expired"] is False
    assert user_data["code_days_remaining"] == 2

    # Scenario 2: Post-expiration (31 days ago) -> Expired
    await setup_data(verified_days_ago=31, user_id=2, session_id="session-5678")
    
    # Test /api/codes/me
    r = client.get("/api/codes/me", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_expired"] is True
    assert data["days_remaining"] == 0
    
    # Test /api/auth/me
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    user_data = r.json()["user"]
    assert user_data["is_code_expired"] is True
    assert user_data["code_days_remaining"] == 0
    
    # Test /api/chat/send (should return 403 Forbidden with custom detail)
    r = client.post("/api/chat/send", json={"message": "Szia", "session_id": "session-5678"}, headers=headers)
    assert r.status_code == 403
    assert r.json()["detail"] == "Ez a mérési ciklus lezárult. Kérjük, tölts ki egy új kérdőívet."
