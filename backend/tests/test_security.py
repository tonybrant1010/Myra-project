import pytest
import os
import logging
import io
from fastapi import Request
from unittest.mock import Mock, patch
from server import (
    _client_ip,
    _call_llm,
    _hash_reset_token,
    _safe_upload_filename,
    _sanitize_log_line,
    SecretRedactionFilter,
    _should_no_store_response,
    _validate_pdf_bytes,
    HTTPException,
)

# Tell pytest to use anyio for async tests
@pytest.fixture
def anyio_backend():
    return "asyncio"

def test_client_ip_no_trust_proxy():
    # Remove TRUST_PROXY if set
    if "TRUST_PROXY" in os.environ:
        del os.environ["TRUST_PROXY"]
        
    mock_request = Mock(spec=Request)
    mock_request.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
    mock_request.client = Mock()
    mock_request.client.host = "127.0.0.1"
    
    # Should ignore x-forwarded-for and use request.client.host
    assert _client_ip(mock_request) == "127.0.0.1"

def test_client_ip_with_trust_proxy_true():
    os.environ["TRUST_PROXY"] = "true"
    try:
        mock_request = Mock(spec=Request)
        mock_request.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
        mock_request.client = Mock()
        mock_request.client.host = "127.0.0.1"
        
        # Should trust x-forwarded-for and return first IP
        assert _client_ip(mock_request) == "1.2.3.4"
    finally:
        del os.environ["TRUST_PROXY"]

def test_client_ip_with_trust_proxy_false():
    os.environ["TRUST_PROXY"] = "false"
    try:
        mock_request = Mock(spec=Request)
        mock_request.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
        mock_request.client = Mock()
        mock_request.client.host = "127.0.0.1"
        
        # Should ignore x-forwarded-for
        assert _client_ip(mock_request) == "127.0.0.1"
    finally:
        del os.environ["TRUST_PROXY"]


def test_reset_token_hash_does_not_store_plain_code():
    code = "123456"
    hashed = _hash_reset_token(code)

    assert hashed != code
    assert len(hashed) == 64
    assert _hash_reset_token(code) == hashed
    assert _hash_reset_token("654321") != hashed


def test_safe_upload_filename_rejects_path_traversal():
    with pytest.raises(HTTPException) as exc_info:
        _safe_upload_filename("../evil.pdf", (".pdf",))

    assert exc_info.value.status_code == 400


def test_safe_upload_filename_rejects_wrong_extension():
    with pytest.raises(HTTPException) as exc_info:
        _safe_upload_filename("notes.exe", (".pdf", ".txt"))

    assert exc_info.value.status_code == 400


def test_validate_pdf_bytes_checks_magic_header():
    _validate_pdf_bytes(b"%PDF-1.7\n%...")
    with pytest.raises(HTTPException) as exc_info:
        _validate_pdf_bytes(b"not really a pdf")

    assert exc_info.value.status_code == 400


def test_sanitize_log_line_masks_api_credentials():
    line = (
        "POST https://generativelanguage.googleapis.com/v1beta/models/x:generateContent"
        "?key=AIzaSyDrxRwZqITYSLSvOWCQKMep6yIzTUmPV8w "
        "headers={'Authorization': 'Bearer sk-proj-secret1234567890', 'x-api-key': 'secret-value'}"
    )
    sanitized = _sanitize_log_line(line)

    assert "AIzaSyDrxRwZqITYSLSvOWCQKMep6yIzTUmPV8w" not in sanitized
    assert "sk-proj-secret1234567890" not in sanitized
    assert "secret-value" not in sanitized
    assert "[redacted]" in sanitized


def test_secret_redaction_filter_masks_log_record_before_handlers():
    record = logging.LogRecord(
        name="httpx",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="GET https://example.test/api?key=%s",
        args=("AIzaSyDrxRwZqITYSLSvOWCQKMep6yIzTUmPV8w",),
        exc_info=None,
    )

    assert SecretRedactionFilter().filter(record) is True
    rendered = record.getMessage()
    assert "AIzaSyDrxRwZqITYSLSvOWCQKMep6yIzTUmPV8w" not in rendered
    assert "[redacted]" in rendered


def test_secret_redaction_filter_masks_handler_output():
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(SecretRedactionFilter())
    logger = logging.getLogger("test-secret-redaction")
    logger.handlers = [handler]
    logger.propagate = False
    logger.setLevel(logging.INFO)

    logger.info("POST https://example.test/api?key=%s", "AIzaSyDrxRwZqITYSLSvOWCQKMep6yIzTUmPV8w")
    output = stream.getvalue()

    assert "AIzaSyDrxRwZqITYSLSvOWCQKMep6yIzTUmPV8w" not in output
    assert "[redacted]" in output


def test_should_no_store_response_only_for_sensitive_api_paths():
    assert _should_no_store_response("/api/auth/me") is True
    assert _should_no_store_response("/api/admin/logs") is True
    assert _should_no_store_response("/api/chat/send") is True
    assert _should_no_store_response("/api/live/token") is True
    assert _should_no_store_response("/api/config") is False
    assert _should_no_store_response("/assets/app.js") is False

@pytest.mark.anyio
@patch("httpx.AsyncClient.post")
async def test_call_llm_anthropic_error_masking(mock_post):
    # Mock httpx response to return 500 with sensitive detail
    mock_response = Mock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error: API Key expired or invalid signature or secret prompt leaked"
    mock_post.return_value = mock_response
    
    with pytest.raises(HTTPException) as exc_info:
        await _call_llm(
            provider="anthropic",
            model="claude-3",
            api_key="fake-key",
            system_prompt="secret sys prompt",
            history=[],
            user_message="hello"
        )
    
    # Verify status code is 502
    assert exc_info.value.status_code == 502
    # Verify detail is masked and does NOT contain the sensitive response text
    assert "leak" not in exc_info.value.detail
    assert "expired" not in exc_info.value.detail
    assert "Hiba történt az AI szolgáltatónál" in exc_info.value.detail

@pytest.mark.anyio
@patch("httpx.AsyncClient.post")
async def test_call_llm_gemini_error_masking(mock_post):
    # Mock httpx response to return 500
    mock_response = Mock()
    mock_response.status_code = 500
    mock_response.text = "Gemini failure: User quota exceeded, developer info leaked"
    mock_post.return_value = mock_response
    
    with pytest.raises(HTTPException) as exc_info:
        await _call_llm(
            provider="gemini",
            model="gemini-1.5",
            api_key="fake-key",
            system_prompt="secret sys prompt",
            history=[],
            user_message="hello"
        )
    
    assert exc_info.value.status_code == 502
    assert "quota" not in exc_info.value.detail
    assert "Gemini API hiba" in exc_info.value.detail

def test_verify_vercel_proxy_middleware():
    from fastapi.testclient import TestClient
    import server
    
    # Register a dummy endpoint dynamically on the app instance
    # to test middleware without hitting database dependency
    @server.app.get("/test-middleware-ping")
    def ping():
        return {"ping": "pong"}
    
    # Preserve original state
    orig_env = os.environ.get("ENVIRONMENT")
    orig_secret = server.MYRA_PROXY_SECRET
    
    client = TestClient(server.app)
    
    try:
        # Case 1: ENVIRONMENT is development -> bypass check
        os.environ["ENVIRONMENT"] = "development"
        r = client.get("/test-middleware-ping")
        assert r.status_code == 200
        assert r.json() == {"ping": "pong"}
        
        # Case 2: ENVIRONMENT is production -> enforce check
        os.environ["ENVIRONMENT"] = "production"
        server.MYRA_PROXY_SECRET = "test-proxy-secret-123"
        
        # Without header -> 403 Forbidden
        r = client.get("/test-middleware-ping")
        assert r.status_code == 403
        assert r.json()["detail"] == "Direct access to origin is forbidden."
        
        # With incorrect header -> 403 Forbidden
        r = client.get("/test-middleware-ping", headers={"X-Myra-Proxy-Secret": "wrong-secret"})
        assert r.status_code == 403
        
        # With correct header -> 200 OK
        r = client.get("/test-middleware-ping", headers={"X-Myra-Proxy-Secret": "test-proxy-secret-123"})
        assert r.status_code == 200
        assert r.json() == {"ping": "pong"}
        
        # OPTIONS request should bypass even in production
        r = client.options("/test-middleware-ping")
        assert r.status_code != 403 or (r.status_code == 403 and r.json().get("detail") != "Direct access to origin is forbidden.")

    finally:
        # Restore original state
        if orig_env is not None:
            os.environ["ENVIRONMENT"] = orig_env
        else:
            os.environ.pop("ENVIRONMENT", None)
        server.MYRA_PROXY_SECRET = orig_secret
