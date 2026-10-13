import datetime
import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

os.environ["DB_DIALECT"] = "sqlite"
os.environ["ENVIRONMENT"] = "development"

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

import server
from server import (
    app,
    AppSetting,
    Base,
    ChatMessage,
    QuizSubmission,
    StateCode,
    User,
    UserGoal,
    FPDF_AVAILABLE,
    GOAL_TEMPLATES,
    _goal_suggestions_for,
    _scale_badness,
    get_current_user,
    get_db,
    hash_password,
)

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


NORMS_H_WORST = {"a": 0.2, "p": 0.9, "h": 0.8, "c": 0.1, "v": 2}


async def _seed_user(user_id: int = 71, *, with_submission: bool = True, verified_days_ago: int = 1) -> None:
    now = datetime.datetime.now(datetime.timezone.utc)
    async with TestingSessionLocal() as db:
        db.add(StateCode(code="1111", a=1, p=1, h=1, c=1, title="Teszt állapot", severity="Enyhe", profile="p"))
        user = User(
            id=user_id,
            email=f"goal-user-{user_id}@example.com",
            name="Goal Teszt",
            password_hash=hash_password("correct-password"),
            is_admin=False,
            state_code="1111",
            code_verified_at=now - datetime.timedelta(days=verified_days_ago),
        )
        db.add(user)
        if with_submission:
            db.add(QuizSubmission(
                id=f"goal-session-{user_id}", user_id=user_id,
                answers=[1] * 16 + [0] * 5, norms=NORMS_H_WORST, code="1111",
            ))
        await db.commit()
        res = await db.execute(select(User).where(User.id == user_id))
        db_user = res.scalar_one()
        app.dependency_overrides[get_current_user] = lambda: db_user


@pytest.mark.anyio
async def test_scale_badness_p_inverted():
    ranked = _scale_badness(NORMS_H_WORST)
    assert ranked[0][0] == "h"
    keys = [k for k, _ in ranked]
    assert set(keys) == {"a", "p", "h", "c"}


@pytest.mark.anyio
async def test_goal_suggestions_focus_and_dedupe():
    suggestions = _goal_suggestions_for(NORMS_H_WORST, "seed-1", set())
    assert len(suggestions) == 3
    assert suggestions[0]["scale"] == "h"
    assert suggestions[1]["scale"] == "h"
    existing = {s["text"] for s in suggestions}
    again = _goal_suggestions_for(NORMS_H_WORST, "seed-1", existing)
    assert not ({s["text"] for s in again} & existing)


@pytest.mark.anyio
async def test_goals_crud_flow():
    await _seed_user(72)
    client = TestClient(app)
    headers = {"Authorization": "Bearer fake-token"}

    r = client.get("/api/goals/suggest", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["focus_scale"] == "h"
    assert len(data["suggestions"]) == 3
    assert data["max_active"] == 3

    items = [{"text": s["text"], "scale": s["scale"]} for s in data["suggestions"][:2]]
    r = client.post("/api/goals", headers=headers, json={"items": items})
    assert r.status_code == 200
    assert len(r.json()["created"]) == 2

    r = client.post("/api/goals", headers=headers, json={"items": [
        {"text": "Extra cél egy", "scale": "a"},
        {"text": "Extra cél kettő", "scale": "a"},
    ]})
    assert r.status_code == 400

    r = client.get("/api/goals", headers=headers)
    assert r.status_code == 200
    goals = r.json()["goals"]
    assert len(goals) == 2
    goal_id = goals[0]["id"]

    r = client.post(f"/api/goals/{goal_id}/done", headers=headers)
    assert r.status_code == 200
    assert r.json()["goal"]["status"] == "done"

    other_id = goals[1]["id"]
    r = client.request("DELETE", f"/api/goals/{other_id}", headers=headers)
    assert r.status_code == 200

    async with TestingSessionLocal() as db:
        remaining = (await db.execute(select(UserGoal).where(UserGoal.user_id == 72))).scalars().all()
        assert len(remaining) == 1
        assert remaining[0].status == "done"


@pytest.mark.anyio
async def test_goals_suggest_requires_submission():
    await _seed_user(73, with_submission=False)
    client = TestClient(app)
    r = client.get("/api/goals/suggest", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 400


async def _add_messages(user_id: int, session_id: str, roles_and_ages_days: list[tuple[str, float]]) -> None:
    now = datetime.datetime.now(datetime.timezone.utc)
    async with TestingSessionLocal() as db:
        for idx, (role, age_days) in enumerate(roles_and_ages_days):
            db.add(ChatMessage(
                id=f"m-{user_id}-{idx}", user_id=user_id, session_id=session_id,
                state_code="1111", role=role, text=f"üzenet {idx}",
                created_at=(now - datetime.timedelta(days=age_days)).replace(tzinfo=None),
            ))
        await db.commit()


@pytest.mark.anyio
async def test_checkin_skips_without_api_key():
    await _seed_user(74)
    await _add_messages(74, "goal-session-74", [("user", 5.0), ("assistant", 5.0)])
    client = TestClient(app)
    r = client.post("/api/chat/checkin", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 200
    assert r.json()["message"] is None


@pytest.mark.anyio
async def test_checkin_skips_recent_conversation(monkeypatch):
    await _seed_user(75)
    await _add_messages(75, "goal-session-75", [("user", 0.5), ("assistant", 0.4)])

    async def fake_llm(*args, **kwargs):
        raise AssertionError("Friss beszélgetésnél nem szabad LLM-et hívni")

    monkeypatch.setattr(server, "_call_llm", fake_llm)
    async with TestingSessionLocal() as db:
        db.add(AppSetting(key="llm_api_key", value="test-key"))
        await db.commit()

    client = TestClient(app)
    r = client.post("/api/chat/checkin", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 200
    assert r.json()["message"] is None


@pytest.mark.anyio
async def test_checkin_skips_unanswered_previous_checkin(monkeypatch):
    await _seed_user(76)
    await _add_messages(76, "goal-session-76", [("user", 9.0), ("assistant", 8.9), ("assistant", 5.0)])

    async def fake_llm(*args, **kwargs):
        raise AssertionError("Megválaszolatlan check-in után nem szabad újat küldeni")

    monkeypatch.setattr(server, "_call_llm", fake_llm)
    async with TestingSessionLocal() as db:
        db.add(AppSetting(key="llm_api_key", value="test-key"))
        await db.commit()

    client = TestClient(app)
    r = client.post("/api/chat/checkin", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 200
    assert r.json()["message"] is None


@pytest.mark.anyio
async def test_checkin_generates_and_stores_message(monkeypatch):
    await _seed_user(77)
    await _add_messages(77, "goal-session-77", [("user", 5.0), ("assistant", 4.9)])

    async def fake_llm(provider, model, api_key, system_prompt, history, user_message):
        assert "BELSŐ RENDSZERUTASÍTÁS" in user_message
        return "Szia! A múltkor a munkahelyi feszültséget említetted – hogy alakult azóta?"

    monkeypatch.setattr(server, "_call_llm", fake_llm)
    async with TestingSessionLocal() as db:
        db.add(AppSetting(key="llm_api_key", value="test-key"))
        await db.commit()

    client = TestClient(app)
    r = client.post("/api/chat/checkin", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 200
    msg = r.json()["message"]
    assert msg is not None
    assert msg["role"] == "assistant"
    assert "munkahelyi" in msg["text"]

    async with TestingSessionLocal() as db:
        stored = (await db.execute(
            select(ChatMessage).where(ChatMessage.user_id == 77, ChatMessage.id == msg["id"])
        )).scalar_one()
        assert stored.role == "assistant"
        assert stored.session_id == "goal-session-77"


@pytest.mark.anyio
async def test_checkin_respects_disabled_setting(monkeypatch):
    await _seed_user(78)
    await _add_messages(78, "goal-session-78", [("user", 9.0), ("assistant", 8.9)])

    async def fake_llm(*args, **kwargs):
        raise AssertionError("Kikapcsolt check-innél nem szabad LLM-et hívni")

    monkeypatch.setattr(server, "_call_llm", fake_llm)
    async with TestingSessionLocal() as db:
        db.add(AppSetting(key="llm_api_key", value="test-key"))
        db.add(AppSetting(key="proactive_checkin_days", value="0"))
        await db.commit()

    client = TestClient(app)
    r = client.post("/api/chat/checkin", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 200
    assert r.json()["message"] is None


@pytest.mark.anyio
async def test_goals_included_in_chat_system_prompt(monkeypatch):
    await _seed_user(79)
    captured: dict = {}

    async def fake_llm(provider, model, api_key, system_prompt, history, user_message, **_kwargs):
        captured["system_prompt"] = system_prompt
        return "Rendben, itt vagyok."

    async def fake_rag(db, query, limit=5):
        return []

    monkeypatch.setattr(server, "_call_llm", fake_llm)
    monkeypatch.setattr(server, "search_pdf_knowledge", fake_rag)
    async with TestingSessionLocal() as db:
        db.add(AppSetting(key="llm_api_key", value="test-key"))
        db.add(UserGoal(user_id=79, session_id="goal-session-79", scale="h",
                        text="A napomba beiktatok egy 10 perces szünetet.", status="active"))
        await db.commit()

    client = TestClient(app)
    r = client.post("/api/chat/send", headers={"Authorization": "Bearer fake-token"},
                    json={"message": "Szia Myra!"})
    assert r.status_code == 200
    assert "MIKRO-CÉLOK" in captured["system_prompt"]
    assert "10 perces szünetet" in captured["system_prompt"]


@pytest.mark.skipif(not FPDF_AVAILABLE, reason="fpdf2 nincs telepítve")
@pytest.mark.anyio
async def test_report_pdf_generation():
    await _seed_user(80)
    client = TestClient(app)
    r = client.get("/api/quiz/report.pdf", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content[:5] == b"%PDF-"
    assert "myra_esv25_osszefoglalo_" in r.headers.get("content-disposition", "")

    from pypdf import PdfReader
    import io as _io
    raw = "".join(page.extract_text() for page in PdfReader(_io.BytesIO(r.content)).pages)
    text = " ".join(raw.split())
    assert "ESV25 Inventory" in text
    assert "MYRA PROJECT" in text
    assert "FIGYELMEZTETÉS" in text
    assert "orvostechnikai" in text
    assert text.index("FIGYELMEZTETÉS") < text.index("Mérési előzmények")
    assert "Percent of Maximum Possible" in text
    assert "Módszertan" in text
    assert "STAI" in text and "PHQ-15" in text
    assert "0,91" in text
    assert "elméleti alapon rögzítettek" in text


@pytest.mark.anyio
async def test_report_pdf_requires_measurement():
    await _seed_user(81, with_submission=False)
    client = TestClient(app)
    r = client.get("/api/quiz/report.pdf", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 400


@pytest.mark.anyio
async def test_data_export_includes_goals():
    await _seed_user(82)
    async with TestingSessionLocal() as db:
        db.add(UserGoal(user_id=82, session_id="goal-session-82", scale="a",
                        text="Exportálandó cél", status="active"))
        await db.commit()
    client = TestClient(app)
    r = client.post("/api/user/data-export", headers={"Authorization": "Bearer fake-token"},
                    json={"current_password": "correct-password"})
    assert r.status_code == 200
    goals = r.json()["goals"]
    assert len(goals) == 1
    assert goals[0]["text"] == "Exportálandó cél"


@pytest.mark.anyio
async def test_interpretation_endpoint_bands():
    await _seed_user(83)
    client = TestClient(app)
    r = client.get("/api/quiz/interpretation", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 200
    data = r.json()
    by_key = {s["key"]: s for s in data["scales"]}
    assert by_key["a"]["band"] == 1
    assert by_key["p"]["band"] == 4
    assert by_key["p"]["band_label"] == "erős érzelemszabályozás"
    assert by_key["h"]["band"] == 3
    assert by_key["c"]["band"] == 1
    assert by_key["h"]["pomp"] == 80
    assert data["overall"]["title"] == "Teszt állapot"
    assert "nem diagnózis" in data["disclaimer"]
    for s in data["scales"]:
        assert len(s["text"]) > 20


@pytest.mark.anyio
async def test_interpretation_requires_measurement():
    await _seed_user(84, with_submission=False)
    client = TestClient(app)
    r = client.get("/api/quiz/interpretation", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 400


@pytest.mark.skipif(not FPDF_AVAILABLE, reason="fpdf2 nincs telepítve")
@pytest.mark.anyio
async def test_report_pdf_contains_interpretation():
    await _seed_user(85)
    async with TestingSessionLocal() as db:
        db.add(QuizSubmission(
            id="goal-session-85-b", user_id=85,
            answers=[1] * 16 + [0] * 5,
            norms={"a": 0.5, "p": 0.5, "h": 0.5, "c": 0.5, "v": 2}, code="1111",
        ))
        await db.commit()
    client = TestClient(app)
    r = client.get("/api/quiz/report.pdf", headers={"Authorization": "Bearer fake-token"})
    assert r.status_code == 200
    from pypdf import PdfReader
    import io as _io
    text = "".join(page.extract_text() for page in PdfReader(_io.BytesIO(r.content)).pages)
    assert "értelmezése" in text
    assert "Változás az előző méréshez képest" in text


@pytest.mark.anyio
async def test_goal_templates_cover_all_scales():
    assert set(GOAL_TEMPLATES.keys()) == {"a", "p", "h", "c"}
    for scale, items in GOAL_TEMPLATES.items():
        assert len(items) >= 3
        assert all(3 <= len(t) <= 300 for t in items)
