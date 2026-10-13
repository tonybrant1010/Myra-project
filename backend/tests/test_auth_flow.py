import os
import sys
import uuid
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _unique_email() -> str:
    return f"test_{uuid.uuid4().hex[:12]}@example.com"


TEST_PASSWORD = "SecureTest!2026"
NEW_PASSWORD = "NewSecure!2026x"


@pytest.fixture
async def registered_user(client):
    email = _unique_email()
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Teszt Felhasználó",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    return {
        "email": email,
        "password": TEST_PASSWORD,
        "response": resp,
        "data": resp.json() if resp.status_code == 200 else None,
    }


@pytest.fixture
async def auth_token(registered_user):
    data = registered_user["data"]
    assert data is not None, "A regisztráció sikertelen volt, nem lehet tokent kinyerni"
    return data["access_token"]


@pytest.mark.anyio
async def test_register_success(client):
    email = _unique_email()
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Új Felhasználó",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp.status_code == 200, f"Sikertelen regisztráció: {resp.text}"
    data = resp.json()
    assert "access_token" in data, "Hiányzó access_token a válaszból"
    assert "user" in data, "Hiányzó user objektum a válaszból"
    assert data["user"]["email"] == email.lower()


@pytest.mark.anyio
async def test_register_without_accepted_terms_rejected(client):
    email = _unique_email()
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Feltétel Nélkül",
        "password": TEST_PASSWORD,
        "accepted_terms": False,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp.status_code == 400, f"Várt 400, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_register_duplicate_email_rejected(client):
    email = _unique_email()
    resp1 = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Első Felhasználó",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp1.status_code == 200, f"Első regisztráció sikertelen: {resp1.text}"

    resp2 = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Duplikált Felhasználó",
        "password": "AnotherPass!2026",
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp2.status_code == 400, f"Várt 400, kapott: {resp2.status_code}"
    assert "már regisztrálva" in resp2.json().get("detail", "").lower() or \
           "already" in resp2.json().get("detail", "").lower() or \
           resp2.status_code == 400


@pytest.mark.anyio
async def test_register_short_password_rejected(client):
    email = _unique_email()
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Rövid Jelszó",
        "password": "short",
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp.status_code == 422, f"Várt 422 validációs hiba, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_login_success(client, registered_user):
    resp = await client.post("/api/auth/login", json={
        "email": registered_user["email"],
        "password": registered_user["password"],
    })
    assert resp.status_code == 200, f"Sikertelen bejelentkezés: {resp.text}"
    data = resp.json()
    assert "access_token" in data or "mfa_required" in data, \
        f"Sem access_token, sem mfa_required nincs a válaszban: {data}"


@pytest.mark.anyio
async def test_login_wrong_password_rejected(client, registered_user):
    resp = await client.post("/api/auth/login", json={
        "email": registered_user["email"],
        "password": "TeljesenHibasJelszo!2026",
    })
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_login_nonexistent_email_rejected(client):
    resp = await client.post("/api/auth/login", json={
        "email": "nemletezo@example.com",
        "password": TEST_PASSWORD,
    })
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_auth_me_with_valid_token(client, registered_user, auth_token):
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200, f"Sikertelen /auth/me hívás: {resp.text}"
    data = resp.json()
    assert "user" in data
    assert data["user"]["email"] == registered_user["email"].lower()


@pytest.mark.anyio
async def test_auth_me_without_token_rejected(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_auth_me_with_invalid_token_rejected(client):
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer this.is.not.a.valid.token"},
    )
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_auth_me_with_malformed_auth_header(client):
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
    )
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_change_password_success(client):
    email = _unique_email()
    reg_resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Jelszóváltó",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]

    change_resp = await client.post(
        "/api/auth/change-password",
        json={
            "current_password": TEST_PASSWORD,
            "new_password": NEW_PASSWORD,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert change_resp.status_code == 200, f"Sikertelen jelszóváltás: {change_resp.text}"
    data = change_resp.json()
    assert data.get("ok") is True


@pytest.mark.anyio
async def test_change_password_wrong_current_rejected(client, auth_token):
    resp = await client.post(
        "/api/auth/change-password",
        json={
            "current_password": "RosszJelenlegiJelszo!2026",
            "new_password": NEW_PASSWORD,
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 400, f"Várt 400, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_change_password_same_as_current_rejected(client):
    email = _unique_email()
    reg_resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Ugyanaz Jelszó",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]

    resp = await client.post(
        "/api/auth/change-password",
        json={
            "current_password": TEST_PASSWORD,
            "new_password": TEST_PASSWORD,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400, f"Várt 400, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_change_password_without_auth_rejected(client):
    resp = await client.post(
        "/api/auth/change-password",
        json={
            "current_password": TEST_PASSWORD,
            "new_password": NEW_PASSWORD,
        },
    )
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_login_after_password_change(client):
    email = _unique_email()
    original_pw = "Original!Pass2026"
    changed_pw = "Changed!Pass2026x"

    reg_resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Jelszóváltás Teszt",
        "password": original_pw,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]

    change_resp = await client.post(
        "/api/auth/change-password",
        json={
            "current_password": original_pw,
            "new_password": changed_pw,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert change_resp.status_code == 200

    login_resp = await client.post("/api/auth/login", json={
        "email": email,
        "password": changed_pw,
    })
    assert login_resp.status_code == 200, f"Bejelentkezés az új jelszóval sikertelen: {login_resp.text}"
