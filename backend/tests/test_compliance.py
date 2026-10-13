import os
import sys
import uuid
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


TEST_PASSWORD = "ComplianceTest!2026"


def _unique_email() -> str:
    return f"compliance_{uuid.uuid4().hex[:12]}@example.com"


@pytest.fixture
async def auth_headers(client):
    email = _unique_email()
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "name": "Compliance Teszt",
        "password": TEST_PASSWORD,
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })
    assert resp.status_code == 200, f"Regisztráció sikertelen: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "_email": email}


@pytest.mark.anyio
async def test_data_export_returns_200(client, auth_headers):
    resp = await client.post(
        "/api/user/data-export",
        json={"current_password": TEST_PASSWORD},
        headers=auth_headers,
    )
    assert resp.status_code == 200, f"Várt 200, kapott: {resp.status_code}"
    data = resp.json()
    assert isinstance(data, dict), "A válasznak JSON objektumnak kell lennie"


@pytest.mark.anyio
async def test_data_export_requires_auth(client):
    resp = await client.post(
        "/api/user/data-export",
        json={"current_password": TEST_PASSWORD}
    )
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_data_export_contains_user_data(client, auth_headers):
    resp = await client.post(
        "/api/user/data-export",
        json={"current_password": TEST_PASSWORD},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "user_profile" in data, "Hiányzó felhasználói profil az exportból"
    assert data["user_profile"]["email"] == auth_headers["_email"]


@pytest.mark.anyio
async def test_data_delete_with_password_confirmation(client, auth_headers):
    resp = await client.request(
        "DELETE",
        "/api/user/data-delete",
        json={"current_password": TEST_PASSWORD},
        headers=auth_headers,
    )
    assert resp.status_code == 200, f"Várt 200, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_data_delete_wrong_password_rejected(client, auth_headers):
    resp = await client.request(
        "DELETE",
        "/api/user/data-delete",
        json={"current_password": "WrongPassword"},
        headers=auth_headers,
    )
    assert resp.status_code == 400, f"Várt 400, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_data_delete_requires_auth(client):
    resp = await client.request(
        "DELETE",
        "/api/user/data-delete",
        json={"current_password": TEST_PASSWORD},
    )
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_privacy_endpoint_returns_version(client):
    resp = await client.get("/api/legal/privacy")
    assert resp.status_code == 200, f"Várt 200, kapott: {resp.status_code}"
    data = resp.json()
    assert "version" in data, "Hiányzó 'version' mező a válaszból"
    assert isinstance(data["version"], str), "A version mezőnek string-nek kell lennie"


@pytest.mark.anyio
async def test_privacy_version_format(client):
    resp = await client.get("/api/legal/privacy")
    assert resp.status_code == 200
    data = resp.json()
    version = data.get("version", "")
    parts = version.split("-")
    assert len(parts) == 3, f"A verziónak YYYY-MM-DD formátumúnak kell lennie, kapott: {version}"


@pytest.mark.anyio
async def test_terms_endpoint_returns_version(client):
    resp = await client.get("/api/legal/terms")
    assert resp.status_code == 200, f"Várt 200, kapott: {resp.status_code}"
    data = resp.json()
    assert "version" in data, "Hiányzó 'version' mező a válaszból"
    assert isinstance(data["version"], str), "A version mezőnek string-nek kell lennie"


@pytest.mark.anyio
async def test_terms_version_format(client):
    resp = await client.get("/api/legal/terms")
    assert resp.status_code == 200
    data = resp.json()
    version = data.get("version", "")
    parts = version.split("-")
    assert len(parts) == 3, f"A verziónak YYYY-MM-DD formátumúnak kell lennie, kapott: {version}"


@pytest.mark.anyio
async def test_consent_post_success(client, auth_headers):
    resp = await client.post(
        "/api/user/consent",
        json={"consent_given": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200, f"Várt 200, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_consent_revoke(client, auth_headers):
    resp = await client.post(
        "/api/user/consent",
        json={"consent_given": False},
        headers=auth_headers,
    )
    assert resp.status_code == 200, f"Várt 200, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_consent_requires_auth(client):
    resp = await client.post(
        "/api/user/consent",
        json={"consent_given": True},
    )
    assert resp.status_code == 401, f"Várt 401, kapott: {resp.status_code}"


@pytest.mark.anyio
async def test_consent_invalid_type_rejected(client, auth_headers):
    resp = await client.post(
        "/api/user/consent",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code in (400, 422), f"Várt 400 vagy 422, kapott: {resp.status_code}"
