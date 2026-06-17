import pytest
import os
import sys
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, delete

# Set environment variables for testing before importing server
os.environ["DB_DIALECT"] = "sqlite"
os.environ["ENVIRONMENT"] = "development"

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from server import app, Base, User, LeaderboardEntry, get_db, get_current_user

# Setup test in-memory SQLite database
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

# Tell pytest to use anyio for async tests
@pytest.fixture
def anyio_backend():
    return "asyncio"

# Create a fixture to initialize the database
@pytest.fixture(autouse=True)
async def init_db():
    app.dependency_overrides[get_db] = override_get_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_leaderboard_operations():
    client = TestClient(app)

    # 1. Setup a test user
    async with TestingSessionLocal() as db:
        user = User(
            id=1,
            email="test_user@example.com",
            name="Test User One",
            password_hash="fakehash",
            is_admin=False
        )
        db.add(user)
        await db.commit()

    from fastapi import Depends
    async def mock_get_current_user(db: AsyncSession = Depends(get_db)):
        res = await db.execute(select(User).where(User.id == 1))
        return res.scalar_one()
    app.dependency_overrides[get_current_user] = mock_get_current_user

    # 2. Test POST /user/nickname
    headers = {"Authorization": "Bearer fake-token"}
    r = client.post("/api/user/nickname", json={"nickname": "Gamer123"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["nickname"] == "Gamer123"

    # Verify nickname in db
    async with TestingSessionLocal() as db:
        res = await db.execute(select(User).where(User.id == 1))
        updated_user = res.scalar_one()
        assert updated_user.nickname == "Gamer123"

    # 3. Test POST /leaderboard/submit
    # Match game - should submit 150 points
    r = client.post("/api/leaderboard/submit", json={"game_type": "match", "score": 150}, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 150

    # Submit a lower match score - best score should remain 150
    r = client.post("/api/leaderboard/submit", json={"game_type": "match", "score": 120}, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 150

    # Submit a higher match score - best score should update to 200
    r = client.post("/api/leaderboard/submit", json={"game_type": "match", "score": 200}, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 200

    # Sudoku game - should submit 300 seconds
    r = client.post("/api/leaderboard/submit", json={"game_type": "sudoku", "score": 300}, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 300

    # Submit a higher sudoku time - best time should remain 300 (since lower is better)
    r = client.post("/api/leaderboard/submit", json={"game_type": "sudoku", "score": 400}, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 300

    # Submit a lower sudoku time - best time should update to 250
    r = client.post("/api/leaderboard/submit", json={"game_type": "sudoku", "score": 250}, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 250

    # 4. Test GET /leaderboard
    r = client.get("/api/leaderboard")
    assert r.status_code == 200
    data = r.json()
    assert "match" in data
    assert "snake" in data
    assert "sudoku" in data

    # Verify match entry
    match_list = data["match"]
    assert len(match_list) == 1
    assert match_list[0]["name"] == "Gamer123"
    assert match_list[0]["score"] == 200

    # Verify sudoku entry
    sudoku_list = data["sudoku"]
    assert len(sudoku_list) == 1
    assert sudoku_list[0]["name"] == "Gamer123"
    assert sudoku_list[0]["score"] == 250
