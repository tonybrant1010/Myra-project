import os
import sys
import uuid
from unittest.mock import patch

import pytest
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import server  # noqa: E402
from server import ForumPost, User, _hash_reset_token  # noqa: E402

from conftest import TestingSessionLocal  # noqa: E402

TEST_PASSWORD = "DeletionTest!2026"
NEW_PASSWORD = "BrandNewPass!2026"


def _unique_email() -> str:
    return f"deletion_{uuid.uuid4().hex[:12]}@example.com"


async def _register(client, email: str) -> str:
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Törlés Teszt",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
    })
    assert resp.status_code == 200, f"Regisztráció sikertelen: {resp.text}"
    return resp.json()["access_token"]


async def _create_forum_post(client, headers) -> None:
    nick = await client.post("/api/forum/profile", json={
        "nickname": f"nick_{uuid.uuid4().hex[:8]}",
        "avatar": "🦊",
    }, headers=headers)
    assert nick.status_code == 200, f"Becenév beállítása sikertelen: {nick.text}"

    post = await client.post("/api/forum/posts", json={
        "content": "Teszt hozzászólás a törlési regresszióhoz.",
    }, headers=headers)
    assert post.status_code == 200, f"Fórum-bejegyzés sikertelen: {post.text}"


@pytest.mark.anyio
async def test_delete_account_succeeds_with_forum_post(client):
    email = _unique_email()
    token = await _register(client, email)
    headers = {"Authorization": f"Bearer {token}"}

    await _create_forum_post(client, headers)

    resp = await client.request("DELETE", "/api/auth/delete-account",
                                json={"current_password": TEST_PASSWORD}, headers=headers)
    assert resp.status_code == 200, f"A fióktörlés elbukott: {resp.status_code} {resp.text}"

    async with TestingSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        assert user is None, "A felhasználó sora megmaradt a törlés után"


@pytest.mark.anyio
async def test_data_delete_removes_forum_posts(client):
    email = _unique_email()
    token = await _register(client, email)
    headers = {"Authorization": f"Bearer {token}"}

    await _create_forum_post(client, headers)

    async with TestingSessionLocal() as db:
        user_id = (await db.execute(select(User.id).where(User.email == email))).scalar_one()

    resp = await client.request("DELETE", "/api/user/data-delete",
                                json={"current_password": TEST_PASSWORD}, headers=headers)
    assert resp.status_code == 200, f"Az adattörlés elbukott: {resp.status_code} {resp.text}"

    async with TestingSessionLocal() as db:
        orphans = (await db.execute(select(ForumPost).where(ForumPost.user_id == user_id))).scalars().all()
        assert orphans == [], f"{len(orphans)} árva fórum-bejegyzés maradt a törlés után"


async def _issue_reset_token(client, email: str) -> tuple[str, str]:
    captured: dict[str, str] = {}

    def _capture(to_email: str, token: str):
        captured["code"] = token
        return True

    with patch.object(server, "_send_password_reset_email", _capture):
        resp = await client.post("/api/auth/forgot-password", json={"email": email})
    assert resp.status_code == 200

    async with TestingSessionLocal() as db:
        stored = (await db.execute(select(User.reset_token).where(User.email == email))).scalar_one()
    assert stored, "Nem jött létre reset token"
    assert captured.get("code"), "A reset-kód nem került kiküldésre"
    assert _hash_reset_token(captured["code"], email) == stored
    return captured["code"], stored


@pytest.mark.anyio
async def test_reset_token_hash_is_not_accepted_as_token(client):
    email = _unique_email()
    await _register(client, email)
    _code, stored_hash = await _issue_reset_token(client, email)

    resp = await client.post("/api/auth/reset-password", json={
        "email": email,
        "token": stored_hash,
        "new_password": NEW_PASSWORD,
    })
    assert resp.status_code == 400, f"A tárolt hash tokenként elfogadásra került: {resp.text}"

    login = await client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert login.status_code == 200, "Az eredeti jelszó nem működik — a hash mégis átment"


@pytest.mark.anyio
async def test_reset_token_is_bound_to_the_requesting_account(client):
    victim_email = _unique_email()
    attacker_email = _unique_email()
    await _register(client, victim_email)
    await _register(client, attacker_email)

    victim_code, _victim_hash = await _issue_reset_token(client, victim_email)

    await _issue_reset_token(client, attacker_email)
    resp = await client.post("/api/auth/reset-password", json={
        "email": attacker_email,
        "token": victim_code,
        "new_password": NEW_PASSWORD,
    })
    assert resp.status_code in (400, 429), f"Idegen fiók kódja elfogadásra került: {resp.text}"


@pytest.mark.anyio
async def test_reset_token_dies_after_five_wrong_attempts(client):
    email = _unique_email()
    await _register(client, email)
    real_code, _stored_hash = await _issue_reset_token(client, email)

    wrong_code = "000000" if real_code != "000000" else "111111"
    for _ in range(5):
        await client.post("/api/auth/reset-password", json={
            "email": email, "token": wrong_code, "new_password": NEW_PASSWORD,
        })

    resp = await client.post("/api/auth/reset-password", json={
        "email": email, "token": real_code, "new_password": NEW_PASSWORD,
    })
    assert resp.status_code in (400, 429), (
        f"A token túlélt 5 hibás próbálkozást: {resp.status_code} {resp.text}"
    )


@pytest.mark.anyio
async def test_password_reset_invalidates_existing_sessions(client):
    email = _unique_email()
    old_token = await _register(client, email)
    old_headers = {"Authorization": f"Bearer {old_token}"}

    assert (await client.get("/api/auth/me", headers=old_headers)).status_code == 200

    real_code, _stored_hash = await _issue_reset_token(client, email)

    resp = await client.post("/api/auth/reset-password", json={
        "email": email, "token": real_code, "new_password": NEW_PASSWORD,
    })
    assert resp.status_code == 200, f"A jelszócsere elbukott: {resp.text}"

    after = await client.get("/api/auth/me", headers=old_headers)
    assert after.status_code == 401, (
        f"A régi munkamenet túlélte a jelszó-visszaállítást: {after.status_code}"
    )


@pytest.mark.anyio
async def test_reset_password_requires_email(client):
    resp = await client.post("/api/auth/reset-password", json={
        "token": "123456", "new_password": NEW_PASSWORD,
    })
    assert resp.status_code == 422, f"Az email nélküli kérés átment: {resp.status_code}"


@pytest.mark.anyio
async def test_registration_never_returns_mfa_verified_token(client):
    import jwt as _jwt
    from server import JWT_ALG, JWT_SECRET

    email = _unique_email()
    token = await _register(client, email)
    payload = _jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    assert payload.get("mfa") is False, "A regisztráció MFA-verifikált tokent adott ki"
