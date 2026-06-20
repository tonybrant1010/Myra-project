import pytest
import os
import sys
import hashlib
import time
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

# Set environment variables for testing before importing server
os.environ["DB_DIALECT"] = "sqlite"
os.environ["ENVIRONMENT"] = "development"

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from server import app, Base, User, get_db, get_current_user

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

def generate_test_signature(game_type: str, score: int, timestamp: int, salt: str = "myra-default-leaderboard-salt-2026") -> str:
    payload = f"{game_type}:{score}:{timestamp}:{salt}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

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

    # 2. Test POST /user/nickname (HTML tags should be stripped)
    headers = {"Authorization": "Bearer fake-token"}
    r = client.post("/api/user/nickname", json={"nickname": "<b>Gamer123</b>"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["nickname"] == "Gamer123"

    # Verify nickname in db (without HTML)
    async with TestingSessionLocal() as db:
        res = await db.execute(select(User).where(User.id == 1))
        updated_user = res.scalar_one()
        assert updated_user.nickname == "Gamer123"

    # 3. Test POST /leaderboard/submit
    # Match game - should submit 150 points
    now_ts = int(time.time())
    sig = generate_test_signature("match", 150, now_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "match",
        "score": 150,
        "timestamp": now_ts,
        "signature": sig
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 150

    # Submit a lower match score - best score should remain 150
    sig = generate_test_signature("match", 120, now_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "match",
        "score": 120,
        "timestamp": now_ts,
        "signature": sig
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 150

    # Submit a higher match score - best score should update to 200
    sig = generate_test_signature("match", 200, now_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "match",
        "score": 200,
        "timestamp": now_ts,
        "signature": sig
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 200

    # Sudoku game - should submit 3000 points
    sig = generate_test_signature("sudoku", 3000, now_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "sudoku",
        "score": 3000,
        "timestamp": now_ts,
        "signature": sig
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 3000

    # Submit a lower sudoku score - best score should remain 3000 (since higher is better now)
    sig = generate_test_signature("sudoku", 2500, now_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "sudoku",
        "score": 2500,
        "timestamp": now_ts,
        "signature": sig
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 3000

    # Submit a higher sudoku score - best score should update to 4000
    sig = generate_test_signature("sudoku", 4000, now_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "sudoku",
        "score": 4000,
        "timestamp": now_ts,
        "signature": sig
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["best_score"] == 4000

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
    assert sudoku_list[0]["score"] == 4000

    # 5. Security test: Invalid signature should return 403
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "match",
        "score": 300,
        "timestamp": now_ts,
        "signature": "invalid-sig-here"
    }, headers=headers)
    assert r.status_code == 403

    # 6. Security test: Expired timestamp should return 400
    old_ts = now_ts - 120
    sig_old = generate_test_signature("match", 300, old_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "match",
        "score": 300,
        "timestamp": old_ts,
        "signature": sig_old
    }, headers=headers)
    assert r.status_code == 400

    # 7. Security test: Score limits should return 400
    # Match limit: score > 35000 is invalid
    sig_limit = generate_test_signature("match", 999999, now_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "match",
        "score": 999999,
        "timestamp": now_ts,
        "signature": sig_limit
    }, headers=headers)
    assert r.status_code == 400

    # Snake limit: score of 240 is valid, but 1600 is invalid
    sig_snake_valid = generate_test_signature("snake", 240, now_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "snake",
        "score": 240,
        "timestamp": now_ts,
        "signature": sig_snake_valid
    }, headers=headers)
    assert r.status_code == 200

    sig_snake_invalid = generate_test_signature("snake", 1600, now_ts)
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "snake",
        "score": 1600,
        "timestamp": now_ts,
        "signature": sig_snake_invalid
    }, headers=headers)
    assert r.status_code == 400
