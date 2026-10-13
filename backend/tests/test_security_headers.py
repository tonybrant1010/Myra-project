import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


@pytest.mark.anyio
async def test_csp_header_present(client):
    resp = await client.get("/api/config")
    assert "content-security-policy" in resp.headers
    assert "default-src 'none'" in resp.headers["content-security-policy"]


@pytest.mark.anyio
async def test_x_content_type_options_header(client):
    resp = await client.get("/api/config")
    assert resp.headers.get("x-content-type-options") == "nosniff"


@pytest.mark.anyio
async def test_x_frame_options_header(client):
    resp = await client.get("/api/config")
    assert resp.headers.get("x-frame-options") == "DENY"


@pytest.mark.anyio
async def test_referrer_policy_header(client):
    resp = await client.get("/api/config")
    assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


@pytest.mark.anyio
async def test_permissions_policy_header(client):
    resp = await client.get("/api/config")
    pp = resp.headers.get("permissions-policy", "")
    assert "geolocation=()" in pp
    assert "camera=()" in pp
    assert "payment=()" in pp


@pytest.mark.anyio
async def test_cross_origin_opener_policy_header(client):
    resp = await client.get("/api/config")
    assert resp.headers.get("cross-origin-opener-policy") == "same-origin"


@pytest.mark.anyio
async def test_cross_origin_resource_policy_header(client):
    resp = await client.get("/api/config")
    assert resp.headers.get("cross-origin-resource-policy") == "same-site"


@pytest.mark.anyio
async def test_x_permitted_cross_domain_policies_header(client):
    resp = await client.get("/api/config")
    assert resp.headers.get("x-permitted-cross-domain-policies") == "none"


@pytest.mark.anyio
async def test_all_security_headers_present(client):
    resp = await client.get("/api/config")
    expected_headers = {
        "content-security-policy",
        "x-content-type-options",
        "x-frame-options",
        "referrer-policy",
        "permissions-policy",
        "cross-origin-opener-policy",
        "cross-origin-resource-policy",
        "x-permitted-cross-domain-policies",
    }
    response_header_keys = {k.lower() for k in resp.headers.keys()}
    missing = expected_headers - response_header_keys
    assert not missing, f"Hiányzó biztonsági fejlécek: {missing}"


@pytest.mark.anyio
async def test_cache_control_no_store_auth_endpoint(client):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "noone@example.com", "password": "irrelevant"},
    )
    cache_control = resp.headers.get("cache-control", "")
    assert "no-store" in cache_control, f"Hiányzó no-store az auth endpointon: {cache_control}"


@pytest.mark.anyio
async def test_cache_control_no_store_admin_endpoint(client):
    resp = await client.get("/api/admin/settings")
    cache_control = resp.headers.get("cache-control", "")
    assert "no-store" in cache_control, f"Hiányzó no-store az admin endpointon: {cache_control}"


@pytest.mark.anyio
async def test_cache_control_no_store_chat_endpoint(client):
    resp = await client.get("/api/chat/history")
    cache_control = resp.headers.get("cache-control", "")
    assert "no-store" in cache_control, f"Hiányzó no-store a chat endpointon: {cache_control}"


@pytest.mark.anyio
async def test_pragma_no_cache_sensitive_endpoint(client):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "noone@example.com", "password": "irrelevant"},
    )
    pragma = resp.headers.get("pragma", "")
    assert "no-cache" in pragma, f"Hiányzó Pragma: no-cache az auth endpointon: {pragma}"


@pytest.mark.anyio
async def test_config_endpoint_no_cache_control_no_store(client):
    resp = await client.get("/api/config")
    cache_control = resp.headers.get("cache-control", "")
    assert "no-store" not in cache_control, \
        f"A /api/config nem kellene no-store-t kapnia, de kapott: {cache_control}"


@pytest.mark.anyio
async def test_cors_allowed_localhost_origin(client):
    resp = await client.options(
        "/api/config",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    allow_origin = resp.headers.get("access-control-allow-origin", "")
    assert allow_origin == "http://localhost:3000", \
        f"Várt: http://localhost:3000, kapott: {allow_origin}"


@pytest.mark.anyio
async def test_cors_allowed_production_origin(client):
    resp = await client.options(
        "/api/config",
        headers={
            "Origin": "https://www.myra-project.hu",
            "Access-Control-Request-Method": "GET",
        },
    )
    allow_origin = resp.headers.get("access-control-allow-origin", "")
    assert allow_origin == "https://www.myra-project.hu", \
        f"Várt: https://www.myra-project.hu, kapott: {allow_origin}"


@pytest.mark.anyio
async def test_cors_disallowed_origin(client):
    resp = await client.options(
        "/api/config",
        headers={
            "Origin": "https://evil-site.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    allow_origin = resp.headers.get("access-control-allow-origin", "")
    assert allow_origin != "https://evil-site.com", \
        "Az evil-site.com origin NEM kellene, hogy engedélyezve legyen"


@pytest.mark.anyio
async def test_cors_credentials_not_allowed(client):
    resp = await client.options(
        "/api/config",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    cred = resp.headers.get("access-control-allow-credentials", "")
    assert cred.lower() != "true", \
        "A credentials nem kellene, hogy engedélyezve legyen (allow_credentials=False)"


@pytest.mark.anyio
async def test_cors_allowed_methods(client):
    resp = await client.options(
        "/api/config",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    allowed_methods = resp.headers.get("access-control-allow-methods", "")
    for method in ["GET", "POST", "PUT", "DELETE"]:
        assert method in allowed_methods, f"Hiányzó engedélyezett metódus: {method}"


@pytest.mark.anyio
async def test_cors_allowed_headers(client):
    resp = await client.options(
        "/api/config",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )
    allowed_headers = resp.headers.get("access-control-allow-headers", "").lower()
    assert "authorization" in allowed_headers, "Hiányzó Authorization az engedélyezett headerek közül"
    assert "content-type" in allowed_headers, "Hiányzó Content-Type az engedélyezett headerek közül"
