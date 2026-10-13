import pytest
import os
import sys
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

os.environ["DB_DIALECT"] = "sqlite"
os.environ["ENVIRONMENT"] = "development"

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from server import app, Base, User, get_db, get_current_user

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
async def init_db():
    app.dependency_overrides[get_db] = override_get_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()


def start_game_session(client: TestClient, headers: dict, game_type: str) -> str:
    r = client.post("/api/leaderboard/start", json={"game_type": game_type}, headers=headers)
    assert r.status_code == 200, f"Nem sikerult jatek-sessiont inditani: {r.text}"
    token = r.json().get("session_token")
    assert isinstance(token, str) and len(token) >= 16
    return token


def submit_score(client: TestClient, headers: dict, game_type: str, score: int):
    token = start_game_session(client, headers, game_type)
    return client.post("/api/leaderboard/submit", json={
        "game_type": game_type,
        "score": score,
        "session_token": token,
    }, headers=headers)


@pytest.mark.anyio
async def test_leaderboard_operations():
    client = TestClient(app)

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

    headers = {"Authorization": "Bearer fake-token"}
    r = client.post("/api/user/nickname", json={"nickname": "<b>Gamer123</b>"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["nickname"] == "Gamer123"

    async with TestingSessionLocal() as db:
        res = await db.execute(select(User).where(User.id == 1))
        updated_user = res.scalar_one()
        assert updated_user.nickname == "Gamer123"

    r = submit_score(client, headers, "match", 150)
    assert r.status_code == 200
    assert r.json()["best_score"] == 150

    r = submit_score(client, headers, "match", 120)
    assert r.status_code == 200
    assert r.json()["best_score"] == 150

    r = submit_score(client, headers, "match", 200)
    assert r.status_code == 200
    assert r.json()["best_score"] == 200

    r = submit_score(client, headers, "sudoku", 3000)
    assert r.status_code == 200
    assert r.json()["best_score"] == 3000

    r = submit_score(client, headers, "sudoku", 2500)
    assert r.status_code == 200
    assert r.json()["best_score"] == 3000

    r = submit_score(client, headers, "sudoku", 4000)
    assert r.status_code == 200
    assert r.json()["best_score"] == 4000

    app.dependency_overrides.pop(get_current_user, None)
    r = client.get("/api/leaderboard")
    assert r.status_code == 401
    app.dependency_overrides[get_current_user] = mock_get_current_user

    r = client.get("/api/leaderboard", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "match" in data
    assert "snake" in data
    assert "sudoku" in data

    match_list = data["match"]
    assert len(match_list) == 1
    assert match_list[0]["name"] == "Gamer123"
    assert match_list[0]["score"] == 200

    sudoku_list = data["sudoku"]
    assert len(sudoku_list) == 1
    assert sudoku_list[0]["name"] == "Gamer123"
    assert sudoku_list[0]["score"] == 4000

    r = client.post("/api/leaderboard/submit", json={
        "game_type": "match",
        "score": 300,
        "session_token": "x" * 32,
    }, headers=headers)
    assert r.status_code == 403

    token = start_game_session(client, headers, "match")
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "match", "score": 300, "session_token": token,
    }, headers=headers)
    assert r.status_code == 200
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "match", "score": 310, "session_token": token,
    }, headers=headers)
    assert r.status_code == 403

    token = start_game_session(client, headers, "match")
    r = client.post("/api/leaderboard/submit", json={
        "game_type": "snake", "score": 100, "session_token": token,
    }, headers=headers)
    assert r.status_code == 403

    r = submit_score(client, headers, "match", 999999)
    assert r.status_code == 400

    r = submit_score(client, headers, "snake", 240)
    assert r.status_code == 200

    r = submit_score(client, headers, "snake", 1600)
    assert r.status_code == 400
