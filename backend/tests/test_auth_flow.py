"""
Autentikációs folyamat integrációs tesztek a Myra API-hoz.

Ellenőrzi:
- Sikeres regisztráció
- Duplikált email regisztráció elutasítása
- Sikeres bejelentkezés
- Hibás jelszó elutasítása
- Token érvényesség (Authorization: Bearer <token>)
- /api/auth/me endpoint
- Jelszóváltás (/api/auth/change-password)
"""
import os
import sys
import uuid
import pytest
import httpx

# A backend mappa a tesztfájl szülőjének szülője
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from server import app


# ---------- Segédfüggvények ----------

def _unique_email() -> str:
    """Egyedi teszt email generálása ütközések elkerülésére."""
    return f"test_{uuid.uuid4().hex[:12]}@example.com"


TEST_PASSWORD = "SecureTest!2026"
NEW_PASSWORD = "NewSecure!2026x"


# ---------- Fixtures ----------


@pytest.fixture
async def registered_user(client):
    """
    Regisztrál egy új felhasználót és visszaadja az email-t, jelszót és a regisztrációs választ.
    """
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
    """Egy bejelentkezett felhasználó access tokenje."""
    data = registered_user["data"]
    assert data is not None, "A regisztráció sikertelen volt, nem lehet tokent kinyerni"
    return data["access_token"]


# ---------- Regisztrációs tesztek ----------

@pytest.mark.anyio
async def test_register_success(client):
    """Sikeres regisztráció a kötelező mezőkkel."""
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
    """Regisztráció elfogadott feltételek nélkül elutasításra kerül."""
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
    """Duplikált email regisztráció elutasításra kerül."""
    email = _unique_email()
    # Első regisztráció — sikeresnek kell lennie
    resp1 = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Első Felhasználó",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp1.status_code == 200, f"Első regisztráció sikertelen: {resp1.text}"

    # Második regisztráció ugyanazzal az emaillel — elutasításra kell kerülnie
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
    """Túl rövid jelszóval történő regisztráció elutasításra kerül (min 8 karakter)."""
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


# ---------- Bejelentkezési tesztek ----------

@pytest.mark.anyio
async def test_login_success(client, registered_user):
    """Sikeres bejelentkezés regisztrált felhasználóval."""
    resp = await client.post("/api/auth/login", json={
        "email": registered_user["email"],
        "password": registered_user["password"],
    })
    assert resp.status_code == 200, f"Sikertelen bejelentkezés: {resp.text}"
    data = resp.json()
    # A válasz vagy access_token-t vagy mfa_required-et tartalmaz
    assert "access_token" in data or "mfa_required" in data, \
        f"Sem access_token, sem mfa_required nincs a válaszban: {data}"


@pytest.mark.anyio
async def test_login_wrong_password_rejected(client, registered_user):
    """Hibás jelszóval történő bejelentkezés 401-es hibát ad."""
    resp = await client.post("/api/auth/login", json={
        "email": registered_user["email"],
        "password": "TeljesenHibasJelszo!2026",
    })
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_login_nonexistent_email_rejected(client):
    """Nem létező email címmel történő bejelentkezés 401-es hibát ad."""
    resp = await client.post("/api/auth/login", json={
        "email": "nemletezo@example.com",
        "password": TEST_PASSWORD,
    })
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


# ---------- Token / Auth header tesztek ----------

@pytest.mark.anyio
async def test_auth_me_with_valid_token(client, registered_user, auth_token):
    """A /api/auth/me endpoint valid tokennel visszaadja a felhasználó adatait."""
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
    """A /api/auth/me endpoint token nélkül 401-es hibát ad."""
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_auth_me_with_invalid_token_rejected(client):
    """A /api/auth/me endpoint érvénytelen tokennel 401-es hibát ad."""
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer this.is.not.a.valid.token"},
    )
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_auth_me_with_malformed_auth_header(client):
    """Hibás Authorization header formátum (Bearer nélkül) 401-es hibát ad."""
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
    )
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


# ---------- Jelszóváltás tesztek ----------

@pytest.mark.anyio
async def test_change_password_success(client):
    """Sikeres jelszóváltás helyes régi jelszóval."""
    # Regisztráljunk egy új felhasználót kifejezetten erre a tesztre
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

    # Jelszóváltás
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
    """Jelszóváltás hibás jelenlegi jelszóval elutasításra kerül."""
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
    """Jelszóváltás ahol az új jelszó megegyezik a jelenlegivel, elutasításra kerül."""
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
            "new_password": TEST_PASSWORD,  # Ugyanaz mint a jelenlegi
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400, f"Várt 400, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_change_password_without_auth_rejected(client):
    """Jelszóváltás autentikáció nélkül 401-es hibát ad."""
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
    """Jelszóváltás után az új jelszóval be lehet jelentkezni."""
    email = _unique_email()
    original_pw = "Original!Pass2026"
    changed_pw = "Changed!Pass2026x"

    # Regisztráció
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

    # Jelszóváltás
    change_resp = await client.post(
        "/api/auth/change-password",
        json={
            "current_password": original_pw,
            "new_password": changed_pw,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert change_resp.status_code == 200

    # Bejelentkezés az új jelszóval
    login_resp = await client.post("/api/auth/login", json={
        "email": email,
        "password": changed_pw,
    })
    assert login_resp.status_code == 200, f"Bejelentkezés az új jelszóval sikertelen: {login_resp.text}"
