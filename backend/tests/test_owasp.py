"""
OWASP biztonsági tesztek a Myra API-hoz.

Ellenőrzi:
- SQL injection kísérletek elutasítása
- XSS payload elutasítása input mezőkben
- Túl nagy request elutasítása (body size limit)
- Érvénytelen JWT token elutasítása
- Lejárt JWT token elutasítása
- Jogosultsági szint bypass kísérlet (nem-admin -> admin endpoint)
"""
import os
import sys
import uuid
import time
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import jwt as pyjwt
from server import JWT_SECRET, JWT_ALG


TEST_PASSWORD = "OwaspTest!2026"


def _unique_email() -> str:
    """Egyedi teszt email generálása."""
    return f"owasp_{uuid.uuid4().hex[:12]}@example.com"


def _create_fake_jwt(payload: dict, secret: str = JWT_SECRET, algorithm: str = JWT_ALG) -> str:
    """Teszt JWT token generálása megadott payload-dal."""
    return pyjwt.encode(payload, secret, algorithm=algorithm)


@pytest.fixture
async def normal_user(client):
    """
    Regisztrál egy normál (nem-admin) felhasználót és visszaadja a tokent.
    """
    email = _unique_email()
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "OWASP Tesztelő",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp.status_code == 200, f"Regisztráció sikertelen: {resp.text}"
    data = resp.json()
    return {
        "email": email,
        "token": data["access_token"],
        "user": data["user"],
    }


@pytest.mark.anyio
async def test_sql_injection_in_login_email(client):
    """SQL injection kísérlet az email mezőben elutasításra kerül."""
    sql_payloads = [
        "admin@test.com' OR '1'='1",
        "admin@test.com'; DROP TABLE users;--",
        "' UNION SELECT * FROM users--@test.com",
        "admin@test.com' AND 1=1--",
    ]
    for payload in sql_payloads:
        resp = await client.post("/api/auth/login", json={
            "email": payload,
            "password": "irrelevant",
        })
        assert resp.status_code in (401, 422), \
            f"SQL injection nem került elutasításra: '{payload}' -> {resp.status_code}"


@pytest.mark.anyio
async def test_sql_injection_in_register_email(client):
    """SQL injection kísérlet a regisztrációs email mezőben elutasításra kerül."""
    resp = await client.post("/api/auth/register", json={
        "email": "'; DROP TABLE users;--@evil.com",
        "name": "SQL Injector",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp.status_code in (400, 422), \
        f"SQL injection regisztrációban nem került elutasításra: {resp.status_code}"


@pytest.mark.anyio
async def test_sql_injection_in_register_name(client):
    """SQL injection kísérlet a name mezőben nem okoz hibát (sanitized)."""
    email = _unique_email()
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "'; DROP TABLE users;--",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp.status_code in (200, 400, 422), \
        f"Váratlan válasz SQL injection a name mezőben: {resp.status_code}"


@pytest.mark.anyio
async def test_xss_in_register_name(client):
    """XSS payload a name mezőben nem jelenik meg a válaszban védetlenül."""
    xss_payloads = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert('xss')>",
        "javascript:alert('xss')",
        "<svg onload=alert('xss')>",
    ]
    for payload in xss_payloads:
        resp = await client.post("/api/auth/register", json={
            "email": _unique_email(),
            "name": payload,
            "password": TEST_PASSWORD,
            "accepted_terms": True,
            "accepted_terms_version": "2026-06-15",
            "accepted_privacy_version": "2026-06-15",
        })
        if resp.status_code == 200:
            content_type = resp.headers.get("content-type", "")
            assert "application/json" in content_type, \
                f"A válasz Content-Type-nak JSON-nek kell lennie: {content_type}"
            assert resp.headers.get("x-content-type-options") == "nosniff", \
                "Hiányzó X-Content-Type-Options: nosniff a válaszból"


@pytest.mark.anyio
async def test_xss_in_login_email(client):
    """XSS payload a login email mezőben elutasításra kerül."""
    resp = await client.post("/api/auth/login", json={
        "email": "<script>alert('xss')</script>",
        "password": TEST_PASSWORD,
    })
    assert resp.status_code in (401, 422), \
        f"XSS payload a login emailben nem került elutasításra: {resp.status_code}"


@pytest.mark.anyio
async def test_oversized_request_body_rejected(client):
    """Túl nagy request body (>1MB) elutasításra kerül 413-as hibával."""
    oversized_data = "A" * (2 * 1024 * 1024)
    resp = await client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": oversized_data},
    )
    assert resp.status_code in (413, 422), \
        f"Túl nagy request nem került elutasításra: {resp.status_code}"


@pytest.mark.anyio
async def test_oversized_request_with_content_length(client):
    """Túl nagy Content-Length header esetén a kérés elutasításra kerül."""
    resp = await client.post(
        "/api/auth/login",
        content=b'{"email":"a@b.com","password":"x"}',
        headers={
            "Content-Type": "application/json",
            "Content-Length": str(20 * 1024 * 1024),
        },
    )
    assert resp.status_code in (413, 422, 400), \
        f"Túl nagy Content-Length nem került elutasításra: {resp.status_code}"


@pytest.mark.anyio
async def test_invalid_jwt_signature_rejected(client):
    """Rossz kulccsal aláírt JWT token elutasításra kerül."""
    now = int(time.time())
    fake_token = _create_fake_jwt(
        {
            "sub": "1",
            "email": "fake@example.com",
            "is_admin": False,
            "token_version": 0,
            "mfa": False,
            "mfa_at": None,
            "iat": now,
            "exp": now + 3600,
            "type": "access",
        },
        secret="this_is_a_completely_wrong_secret_key_12345",
    )
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {fake_token}"},
    )
    assert resp.status_code == 401, f"Rossz aláírású JWT nem került elutasításra: {resp.status_code}"


@pytest.mark.anyio
async def test_expired_jwt_rejected(client):
    """Lejárt JWT token elutasításra kerül."""
    now = int(time.time())
    expired_token = _create_fake_jwt({
        "sub": "1",
        "email": "expired@example.com",
        "is_admin": False,
        "token_version": 0,
        "mfa": False,
        "mfa_at": None,
        "iat": now - 7200,
        "exp": now - 3600,
        "type": "access",
    })
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp.status_code == 401, f"Lejárt JWT nem került elutasításra: {resp.status_code}"


@pytest.mark.anyio
async def test_jwt_wrong_type_rejected(client):
    """Rossz típusú JWT (nem 'access') elutasításra kerül."""
    now = int(time.time())
    wrong_type_token = _create_fake_jwt({
        "sub": "1",
        "email": "wrong_type@example.com",
        "is_admin": False,
        "token_version": 0,
        "mfa": False,
        "mfa_at": None,
        "iat": now,
        "exp": now + 3600,
        "type": "refresh",
    })
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {wrong_type_token}"},
    )
    assert resp.status_code == 401, f"Rossz típusú JWT nem került elutasításra: {resp.status_code}"


@pytest.mark.anyio
async def test_jwt_tampered_payload_rejected(client):
    """Manipulált JWT payload (pl. is_admin=True) érvénytelen aláírással elutasításra kerül."""
    now = int(time.time())
    tampered_token = _create_fake_jwt(
        {
            "sub": "1",
            "email": "tampered@example.com",
            "is_admin": True,
            "token_version": 0,
            "mfa": True,
            "mfa_at": now,
            "iat": now,
            "exp": now + 3600,
            "type": "access",
        },
        secret="wrong_secret_for_tampering_attempt_2026",
    )
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {tampered_token}"},
    )
    assert resp.status_code == 401, \
        f"Manipulált JWT nem került elutasításra: {resp.status_code}"


@pytest.mark.anyio
async def test_completely_random_jwt_rejected(client):
    """Teljesen véletlenszerű JWT string elutasításra kerül."""
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer aGVsbG8ud29ybGQuZm9v.YmFyLmJheg.cXV4"},
    )
    assert resp.status_code == 401, \
        f"Véletlenszerű JWT nem került elutasításra: {resp.status_code}"


@pytest.mark.anyio
async def test_normal_user_cannot_access_admin_settings(client, normal_user):
    """Normál (nem-admin) felhasználó nem fér hozzá az admin beállításokhoz."""
    resp = await client.get(
        "/api/admin/settings",
        headers={"Authorization": f"Bearer {normal_user['token']}"},
    )
    assert resp.status_code == 403, \
        f"Normál user admin/settings hozzáférés: várt 403, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_normal_user_cannot_access_admin_codes(client, normal_user):
    """Normál felhasználó nem fér hozzá az admin kódokhoz."""
    resp = await client.get(
        "/api/admin/codes",
        headers={"Authorization": f"Bearer {normal_user['token']}"},
    )
    assert resp.status_code == 403, \
        f"Normál user admin/codes hozzáférés: várt 403, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_normal_user_cannot_create_admin_codes(client, normal_user):
    """Normál felhasználó nem tud admin kódot létrehozni."""
    resp = await client.post(
        "/api/admin/codes",
        json={"code": "TESTCODE", "max_uses": 10},
        headers={"Authorization": f"Bearer {normal_user['token']}"},
    )
    assert resp.status_code == 403, \
        f"Normál user admin kód létrehozás: várt 403, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_normal_user_cannot_access_admin_diagnostics(client, normal_user):
    """Normál felhasználó nem fér hozzá az admin diagnosztikai endpointhoz."""
    resp = await client.get(
        "/api/admin/diagnostics",
        headers={"Authorization": f"Bearer {normal_user['token']}"},
    )
    assert resp.status_code == 403, \
        f"Normál user admin/diagnostics hozzáférés: várt 403, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_normal_user_cannot_force_logout_all(client, normal_user):
    """Normál felhasználó nem tud force logout all műveletet végrehajtani."""
    resp = await client.post(
        "/api/admin/force-logout-all",
        headers={"Authorization": f"Bearer {normal_user['token']}"},
    )
    assert resp.status_code == 403, \
        f"Normál user force-logout-all: várt 403, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_unauthenticated_cannot_access_admin(client):
    """Autentikálatlan kérés nem fér hozzá az admin endpointokhoz."""
    admin_endpoints = [
        ("GET", "/api/admin/settings"),
        ("GET", "/api/admin/codes"),
        ("GET", "/api/admin/diagnostics"),
        ("GET", "/api/admin/maintenance"),
    ]
    for method, path in admin_endpoints:
        if method == "GET":
            resp = await client.get(path)
        else:
            resp = await client.post(path)
        assert resp.status_code == 401, \
            f"Autentikálatlan {method} {path}: várt 401, kapott: {resp.status_code}"
