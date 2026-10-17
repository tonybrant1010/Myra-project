import pytest
import os
import logging
import io
import time


import server as server_module
from fastapi import Request
from unittest.mock import Mock, patch
from server import (
    _client_ip,
    _call_llm,
    _hash_reset_token,
    _admin_action_attempts,
    _check_and_record_admin_action_limit,
    _check_and_record_mfa_issue_limit,
    _cleanup_piper_cache,
    _diagnostic_file_status,
    _mfa_issue_attempts,
    _prune_rate_limit_map,
    _safe_upload_filename,
    _sanitize_log_line,
    _secret_preview,
    SecretRedactionFilter,
    _clean_session_id,
    app,
    hash_password,
    _is_allowed_cors_origin,
    _build_chat_kb_query,
    _request_body_limit,
    require_admin,
    _should_no_store_response,
    _safe_kb_pdf_filename,
    _safe_download_filename,
    _validate_pdf_bytes,
    ChangePasswordBody,
    ChatSendBody,
    CodeVerifyBody,
    EmergencyAdminActionBody,
    LoginBody,
    MaintenanceModeBody,
    MfaTrustedDeviceDeleteBody,
    QuizSubmitBody,
    ReindexPdfKnowledgeBody,
    ResetPasswordBody,
    SettingsIn,
    StateCodeIn,
    SubmitScoreBody,
    StateCode,
    User,
    HTTPException,
)

@pytest.fixture
def anyio_backend():
    return "asyncio"

def test_client_ip_no_trust_proxy():
    if "TRUST_PROXY" in os.environ:
        del os.environ["TRUST_PROXY"]
        
    mock_request = Mock(spec=Request)
    mock_request.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
    mock_request.client = Mock()
    mock_request.client.host = "127.0.0.1"
    
    assert _client_ip(mock_request) == "127.0.0.1"

def test_client_ip_with_trust_proxy_true():
    os.environ["TRUST_PROXY"] = "true"
    try:
        mock_request = Mock(spec=Request)
        mock_request.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
        mock_request.client = Mock()
        mock_request.client.host = "127.0.0.1"
        
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
        
        assert _client_ip(mock_request) == "127.0.0.1"
    finally:
        del os.environ["TRUST_PROXY"]


def test_reset_token_hash_does_not_store_plain_code():
    code = "123456"
    email = "user@example.com"
    hashed = _hash_reset_token(code, email)

    assert hashed != code
    assert len(hashed) == 64
    assert _hash_reset_token(code, email) == hashed
    assert _hash_reset_token("654321", email) != hashed
    assert _hash_reset_token(code, "masik@example.com") != hashed


def test_mfa_issue_limit_blocks_repeated_code_sends():
    _mfa_issue_attempts.clear()
    mock_request = Mock(spec=Request)
    mock_request.headers = {}
    mock_request.client = Mock()
    mock_request.client.host = "127.0.0.1"

    for _ in range(3):
        _check_and_record_mfa_issue_limit(mock_request, 123, "login")

    with pytest.raises(HTTPException) as exc_info:
        _check_and_record_mfa_issue_limit(mock_request, 123, "login")

    assert exc_info.value.status_code == 429


def test_admin_action_limit_blocks_repeated_emergency_actions():
    _admin_action_attempts.clear()
    mock_request = Mock(spec=Request)
    mock_request.headers = {}
    mock_request.client = Mock()
    mock_request.client.host = "127.0.0.1"

    for _ in range(3):
        _check_and_record_admin_action_limit(mock_request, 1, "down")

    with pytest.raises(HTTPException) as exc_info:
        _check_and_record_admin_action_limit(mock_request, 1, "down")

    assert exc_info.value.status_code == 429


def test_rate_limit_map_prune_removes_old_overflow_entries():
    store = {
        "old-1": {"first": 1.0, "blocked_until": 0},
        "old-2": {"first": 2.0, "blocked_until": 0},
        "fresh-1": {"first": 98.0, "blocked_until": 0},
        "fresh-2": {"first": 99.0, "blocked_until": 0},
    }

    _prune_rate_limit_map(store, now=100.0, max_age_s=50, max_entries=2)

    assert "old-1" not in store
    assert "old-2" not in store
    assert set(store) == {"fresh-1", "fresh-2"}


def test_rate_limit_map_prune_caps_entries_when_no_expired_records_exist():
    store = {
        "a": {"first": 10.0, "blocked_until": 0},
        "b": {"first": 20.0, "blocked_until": 0},
        "c": {"first": 30.0, "blocked_until": 0},
    }

    _prune_rate_limit_map(store, now=40.0, max_age_s=100, max_entries=2)

    assert len(store) == 2
    assert "a" not in store


def test_safe_upload_filename_rejects_path_traversal():
    with pytest.raises(HTTPException) as exc_info:
        _safe_upload_filename("../evil.pdf", (".pdf",))

    assert exc_info.value.status_code == 400


def test_safe_upload_filename_rejects_wrong_extension():
    with pytest.raises(HTTPException) as exc_info:
        _safe_upload_filename("notes.exe", (".pdf", ".txt"))

    assert exc_info.value.status_code == 400


def test_safe_upload_filename_rejects_control_chars_and_oversized_names():
    assert _safe_upload_filename("ESV_modell_HUN.pdf", (".pdf",)) == "ESV_modell_HUN.pdf"

    with pytest.raises(HTTPException) as exc_info:
        _safe_upload_filename("bad\nname.pdf", (".pdf",))
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        _safe_upload_filename(("a" * 181) + ".pdf", (".pdf",))
    assert exc_info.value.status_code == 400


def test_safe_kb_pdf_filename_uses_strict_pdf_rules():
    assert _safe_kb_pdf_filename("ESV_modell_HUN.pdf") == "ESV_modell_HUN.pdf"
    assert _safe_kb_pdf_filename("ESV_modell_HUN.PDF") == "ESV_modell_HUN.PDF"

    for bad_name in ("../evil.pdf", ".hidden.pdf", "notes.txt", "bad\nname.pdf", "x" * 181 + ".pdf"):
        with pytest.raises(HTTPException):
            _safe_kb_pdf_filename(bad_name)


def test_clean_session_id_rejects_unsafe_values():
    assert _clean_session_id(None) is None
    assert _clean_session_id("") is None
    assert _clean_session_id(" session-1234 ") == "session-1234"
    assert _clean_session_id("abc_DEF-123") == "abc_DEF-123"

    for bad_value in ("../x", "x/y", "x y", "x.y", "a" * 41):
        with pytest.raises(HTTPException):
            _clean_session_id(bad_value)


def test_safe_download_filename_strips_unsafe_header_characters():
    assert _safe_download_filename("../Antal Teszt\r\nX-Bad: 1.csv") == "Antal_Teszt_X-Bad_1.csv"
    assert _safe_download_filename("...") == "download"
    assert _safe_download_filename("a" * 200 + ".csv") == "a" * 120


def test_rag_search_query_stays_compact_for_short_message():
    state = StateCode(
        code="RAGT",
        title="Teszt profil",
        profile=("profil resz " * 500),
        severity="kozepes",
    )

    query = _build_chat_kb_query("aktuális kérdés", [], state)

    assert query == "aktuális kérdés"
    assert "Teszt profil" not in query
    assert "kozepes" not in query
    assert len(query) < len(state.profile)


def test_rag_search_query_excludes_profile_for_specific_message():
    state = StateCode(
        code="RAGT",
        title="Teszt profil",
        profile=("profil resz " * 500),
        severity="kozepes",
    )

    message = "Mostanában nagyon nehezen alszom el és feszült vagyok minden este."
    query = _build_chat_kb_query(message, [], state)

    assert query == message
    assert "Teszt profil" not in query


def test_fastembed_embedding_cache_reuses_normalized_query():
    class FakeEmbeddingModel:
        def __init__(self):
            self.calls = 0

        def embed(self, texts):
            self.calls += 1
            return iter([[0.25] * 384])

    previous_model = server_module._fastembed_model
    fake_model = FakeEmbeddingModel()
    server_module._fastembed_embedding_cache.clear()
    server_module._fastembed_model = fake_model
    try:
        first = server_module._sync_get_fastembed_embedding("testi   feszultseg")
        first[0] = 999.0
        second = server_module._sync_get_fastembed_embedding("testi feszultseg")

        assert fake_model.calls == 1
        assert second[0] == 0.25
    finally:
        server_module._fastembed_embedding_cache.clear()
        server_module._fastembed_model = previous_model


def test_diagnostic_file_status_does_not_leak_local_paths(tmp_path):
    missing = tmp_path / "private" / "secret" / "piper.exe"

    status = _diagnostic_file_status(missing, "piper binary")

    assert status == "error: piper binary not found"
    assert str(tmp_path) not in status


def test_cleanup_piper_cache_removes_stale_wav_and_tmp_files(tmp_path):
    old_wav = tmp_path / "old.wav"
    old_tmp = tmp_path / "old.tmp.wav"
    fresh_wav = tmp_path / "fresh.wav"
    other_file = tmp_path / "note.txt"

    for path in (old_wav, old_tmp, fresh_wav, other_file):
        path.write_bytes(b"data")

    old_time = time.time() - (3 * 86400)
    os.utime(old_wav, (old_time, old_time))
    os.utime(old_tmp, (old_time, old_time))

    _cleanup_piper_cache(tmp_path, max_age_days=1)

    assert not old_wav.exists()
    assert not old_tmp.exists()
    assert fresh_wav.exists()
    assert other_file.exists()


def test_validate_pdf_bytes_checks_magic_header():
    _validate_pdf_bytes(b"%PDF-1.7\n%...")
    with pytest.raises(HTTPException) as exc_info:
        _validate_pdf_bytes(b"not really a pdf")

    assert exc_info.value.status_code == 400


# Teszt-fixtúra: valódi kulcsformátum, de futásidőben áll össze, így a
# titokszkenerek nem találják meg a repóban. Ide SOHA ne kerüljön valódi kulcs.
FAKE_GEMINI_KEY = "AIza" + "Sy" + "A" * 33


def test_sanitize_log_line_masks_api_credentials():
    line = (
        "POST https://generativelanguage.googleapis.com/v1beta/models/x:generateContent"
        f"?key={FAKE_GEMINI_KEY} "
        "headers={'Authorization': 'Bearer sk-proj-secret1234567890', 'x-api-key': 'secret-value'}"
    )
    sanitized = _sanitize_log_line(line)

    assert FAKE_GEMINI_KEY not in sanitized
    assert "sk-proj-secret1234567890" not in sanitized
    assert "secret-value" not in sanitized
    assert "[redacted]" in sanitized

    provider_error = (
        f'{{"error":"bad","api_key":"{FAKE_GEMINI_KEY}",'
        '"authorization":"Bearer sk-proj-secret1234567890"}'
    )
    sanitized_error = _sanitize_log_line(provider_error)
    assert FAKE_GEMINI_KEY not in sanitized_error
    assert "sk-proj-secret1234567890" not in sanitized_error


def test_secret_redaction_filter_masks_log_record_before_handlers():
    record = logging.LogRecord(
        name="httpx",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="GET https://example.test/api?key=%s",
        args=(FAKE_GEMINI_KEY,),
        exc_info=None,
    )

    assert SecretRedactionFilter().filter(record) is True
    rendered = record.getMessage()
    assert FAKE_GEMINI_KEY not in rendered
    assert "[redacted]" in rendered


def test_secret_redaction_filter_masks_handler_output():
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(SecretRedactionFilter())
    logger = logging.getLogger("test-secret-redaction")
    logger.handlers = [handler]
    logger.propagate = False
    logger.setLevel(logging.INFO)

    logger.info("POST https://example.test/api?key=%s", FAKE_GEMINI_KEY)
    output = stream.getvalue()

    assert FAKE_GEMINI_KEY not in output
    assert "[redacted]" in output


def test_secret_preview_only_exposes_suffix():
    assert _secret_preview("") == ""
    assert _secret_preview("abcd") == "****"
    assert _secret_preview("sk-proj-1234567890") == "****7890"
    assert "sk-proj" not in _secret_preview("sk-proj-1234567890")


def test_http_client_success_logs_are_not_info_level():
    assert logging.getLogger("httpx").getEffectiveLevel() >= logging.WARNING
    assert logging.getLogger("httpcore").getEffectiveLevel() >= logging.WARNING


def test_should_no_store_response_only_for_sensitive_api_paths():
    assert _should_no_store_response("/api/auth/me") is True
    assert _should_no_store_response("/api/admin/logs") is True
    assert _should_no_store_response("/api/chat/send") is True
    assert _should_no_store_response("/api/config") is False
    assert _should_no_store_response("/assets/app.js") is False


def test_security_headers_are_added_to_responses():
    from fastapi.testclient import TestClient
    import server

    @server.app.get("/test-security-headers-ping")
    def ping_headers():
        return {"ping": "pong"}

    orig_env = os.environ.get("ENVIRONMENT")
    client = TestClient(server.app)

    try:
        os.environ["ENVIRONMENT"] = "development"
        r = client.get("/test-security-headers-ping", headers={"x-forwarded-proto": "https"})

        assert r.status_code == 200
        assert r.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["x-frame-options"] == "DENY"
        assert r.headers["cross-origin-opener-policy"] == "same-origin"
        assert r.headers["x-permitted-cross-domain-policies"] == "none"
        assert r.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"
    finally:
        if orig_env is not None:
            os.environ["ENVIRONMENT"] = orig_env
        else:
            os.environ.pop("ENVIRONMENT", None)


def test_cors_allows_known_origins_without_wildcard():
    from fastapi.testclient import TestClient
    import server

    @server.app.get("/test-cors-ping")
    def ping_cors():
        return {"ping": "pong"}

    orig_env = os.environ.get("ENVIRONMENT")
    client = TestClient(server.app)

    try:
        os.environ["ENVIRONMENT"] = "development"
        allowed = client.get("/test-cors-ping", headers={"Origin": "https://www.myra-project.hu"})
        denied = client.get("/test-cors-ping", headers={"Origin": "https://evil.example"})

        assert allowed.status_code == 200
        assert allowed.headers.get("access-control-allow-origin") == "https://www.myra-project.hu"
        assert denied.status_code == 200
        assert "access-control-allow-origin" not in denied.headers
    finally:
        if orig_env is not None:
            os.environ["ENVIRONMENT"] = orig_env
        else:
            os.environ.pop("ENVIRONMENT", None)


def test_allowed_cors_origin_helper_is_strict():
    assert _is_allowed_cors_origin("https://www.myra-project.hu") is True
    assert _is_allowed_cors_origin("https://myra-project.hu/") is True
    assert _is_allowed_cors_origin("http://localhost:8081") is True
    assert _is_allowed_cors_origin("https://evil.example") is False
    assert _is_allowed_cors_origin("") is False


def test_request_body_limit_allows_larger_kb_uploads():
    assert _request_body_limit("/api/admin/kb/files/upload") > _request_body_limit("/api/chat/send")
    assert _request_body_limit("/api/admin/kb/upload") > _request_body_limit("/api/auth/login")


def test_request_body_limit_middleware_rejects_oversized_api_payload():
    from fastapi import Request as FastApiRequest
    from fastapi.testclient import TestClient
    import server

    @server.app.post("/api/test-request-size-limit-ping")
    async def request_size_ping(request: FastApiRequest):
        return {"len": len(await request.body())}

    orig_limit = server._request_body_limit
    orig_env = os.environ.get("ENVIRONMENT")
    server._request_body_limit = lambda path: 3
    client = TestClient(server.app)
    try:
        os.environ["ENVIRONMENT"] = "development"
        r = client.post("/api/test-request-size-limit-ping", content=b"abcdef")
        assert r.status_code == 413
    finally:
        server._request_body_limit = orig_limit
        if orig_env is None:
            os.environ.pop("ENVIRONMENT", None)
        else:
            os.environ["ENVIRONMENT"] = orig_env


def test_chat_send_body_rejects_oversized_message():
    ChatSendBody(message="a" * 8000)
    with pytest.raises(Exception):
        ChatSendBody(message="a" * 8001)

    ChatSendBody(message="ok", session_id="a" * 40)
    with pytest.raises(Exception):
        ChatSendBody(message="ok", session_id="a" * 41)


def test_auth_and_admin_code_schemas_reject_oversized_tokens():
    LoginBody(email="user@example.com", password="p", device_token="a" * 128)
    with pytest.raises(Exception):
        LoginBody(email="user@example.com", password="a" * 129)

    ResetPasswordBody(email="user@example.com", token="1234", new_password="password123")
    with pytest.raises(Exception):
        ResetPasswordBody(email="user@example.com", token="x" * 129, new_password="password123")
    with pytest.raises(Exception):
        ResetPasswordBody(token="1234", new_password="password123")

    ChangePasswordBody(
        current_password="old",
        new_password="new-password",
        admin_security_challenge_id="a" * 80,
        admin_security_code="123456",
    )
    with pytest.raises(Exception):
        ChangePasswordBody(
            current_password="old",
            new_password="new-password",
            admin_security_challenge_id="a" * 81,
            admin_security_code="123456",
        )

    CodeVerifyBody(code="1111")
    with pytest.raises(Exception):
        CodeVerifyBody(code="x" * 17)

    MaintenanceModeBody(maintenance_mode=True, current_password="admin-password")
    EmergencyAdminActionBody(current_password="admin-password")
    MfaTrustedDeviceDeleteBody(current_password="current-password")
    with pytest.raises(Exception):
        MaintenanceModeBody(maintenance_mode=True, current_password="")
    with pytest.raises(Exception):
        EmergencyAdminActionBody(current_password="")
    with pytest.raises(Exception):
        MfaTrustedDeviceDeleteBody(current_password="")
    with pytest.raises(Exception):
        EmergencyAdminActionBody(current_password="x" * 129)


@pytest.mark.anyio
async def test_emergency_admin_routes_reject_wrong_current_password(init_db):
    from fastapi.testclient import TestClient

    from conftest import TestingSessionLocal

    admin = User(
        id=990,
        email="admin@example.com",
        name="Admin",
        password_hash=hash_password("correct-password"),
        is_admin=True,
        is_active=True,
    )

    async with TestingSessionLocal() as db:
        db.add(admin)
        await db.commit()
        db.expunge(admin)

    orig_env = os.environ.get("ENVIRONMENT")
    app.dependency_overrides[require_admin] = lambda: admin
    client = TestClient(app)
    try:
        os.environ["ENVIRONMENT"] = "development"
        routes = [
            ("/api/admin/maintenance", {"maintenance_mode": True, "current_password": "wrong-password"}),
            ("/api/admin/force-logout-all", {"current_password": "wrong-password"}),
            ("/api/admin/restart", {"current_password": "wrong-password"}),
            ("/api/admin/down", {"current_password": "wrong-password"}),
        ]
        for path, payload in routes:
            r = client.post(path, json=payload)
            assert r.status_code == 400
            assert "jelszo" in r.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(require_admin, None)
        if orig_env is None:
            os.environ.pop("ENVIRONMENT", None)
        else:
            os.environ["ENVIRONMENT"] = orig_env


def test_leaderboard_and_reindex_schemas_reject_invalid_payloads():
    SubmitScoreBody(game_type="match", score=35000, session_token="a" * 32)

    with pytest.raises(Exception):
        SubmitScoreBody(game_type="match", score=1000001, session_token="a" * 32)

    with pytest.raises(Exception):
        SubmitScoreBody(game_type="match", score=10, session_token="a" * 8)

    with pytest.raises(Exception):
        SubmitScoreBody(game_type="match", score=10, session_token="a" * 129)

    ReindexPdfKnowledgeBody(source_dir="a" * 500)
    with pytest.raises(Exception):
        ReindexPdfKnowledgeBody(source_dir="a" * 501)


def test_quiz_submit_body_rejects_invalid_answer_payloads():
    QuizSubmitBody(answers=[3] * 16 + [1] * 5)

    with pytest.raises(Exception):
        QuizSubmitBody(answers=[3] * 20)

    with pytest.raises(Exception):
        QuizSubmitBody(answers=[6] + [3] * 15 + [1] * 5)

    with pytest.raises(Exception):
        QuizSubmitBody(answers=[3] * 16 + [3] + [1] * 4)


def test_admin_settings_schema_rejects_oversized_fields():
    SettingsIn(llm_model="gemini-3.1-flash-lite", global_notice_text="a" * 1200)

    with pytest.raises(Exception):
        SettingsIn(llm_model="x" * 161)

    with pytest.raises(Exception):
        SettingsIn(global_notice_text="a" * 1201)


def test_state_code_schema_rejects_oversized_profile_fields():
    StateCodeIn(code="1111", title="T", profile="P", severity="", a=1, p=2, h=3, c=4)

    with pytest.raises(Exception):
        StateCodeIn(code="1111", title="T" * 241, profile="P", severity="")

    with pytest.raises(Exception):
        StateCodeIn(code="1111", title="T", profile="P", severity="x" * 81)

    with pytest.raises(Exception):
        StateCodeIn(code="1111", title="T", profile="P", severity="", a=0)

    with pytest.raises(Exception):
        StateCodeIn(code="1111", title="T", profile="P", severity="", c=5)

@pytest.mark.anyio
@patch("httpx.AsyncClient.post")
async def test_call_llm_anthropic_error_masking(mock_post):
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
    
    assert exc_info.value.status_code == 502
    assert "leak" not in exc_info.value.detail
    assert "expired" not in exc_info.value.detail
    assert "Hiba történt az AI szolgáltatónál" in exc_info.value.detail

@pytest.mark.anyio
@patch("httpx.AsyncClient.post")
async def test_call_llm_gemini_error_masking(mock_post):
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

def test_verify_proxy_secret_middleware():
    from fastapi.testclient import TestClient
    import server
    
    @server.app.get("/test-middleware-ping")
    def ping():
        return {"ping": "pong"}
    
    orig_env = os.environ.get("ENVIRONMENT")
    orig_secret = server.MYRA_PROXY_SECRET
    
    client = TestClient(server.app)
    
    try:
        os.environ["ENVIRONMENT"] = "development"
        r = client.get("/test-middleware-ping")
        assert r.status_code == 200
        assert r.json() == {"ping": "pong"}
        
        os.environ["ENVIRONMENT"] = "production"
        server.MYRA_PROXY_SECRET = "test-proxy-secret-123"
        
        r = client.get("/test-middleware-ping")
        assert r.status_code == 403
        assert r.json()["detail"] == "Direct access to origin is forbidden."
        
        r = client.get("/test-middleware-ping", headers={"X-Myra-Proxy-Secret": "wrong-secret"})
        assert r.status_code == 403
        
        r = client.get("/test-middleware-ping", headers={"X-Myra-Proxy-Secret": "test-proxy-secret-123"})
        assert r.status_code == 200
        assert r.json() == {"ping": "pong"}
        
        r = client.options("/test-middleware-ping", headers={"Origin": "https://www.myra-project.hu"})
        assert r.status_code != 403 or (r.status_code == 403 and r.json().get("detail") != "Direct access to origin is forbidden.")

        r = client.options("/test-middleware-ping")
        assert r.status_code == 403
        assert r.json()["detail"] == "Direct access to origin is forbidden."

        r = client.options("/test-middleware-ping", headers={"Origin": "https://evil.example"})
        assert r.status_code == 403

    finally:
        if orig_env is not None:
            os.environ["ENVIRONMENT"] = orig_env
        else:
            os.environ.pop("ENVIRONMENT", None)
        server.MYRA_PROXY_SECRET = orig_secret


@pytest.mark.asyncio
async def test_require_admin_logs_structured_signal_only_for_authenticated_user(caplog):
    import logging as _logging
    import server

    class _FakeClient:
        host = "203.0.113.7"

    class _FakeRequest:
        url = type("_U", (), {"path": "/api/admin/settings"})()
        headers = {}
        client = _FakeClient()
        state = type("_S", (), {"via_trusted_proxy": False})()

    class _NonAdmin:
        id = 42
        is_admin = False

    class _Admin:
        id = 43
        is_admin = True

    with caplog.at_level(_logging.WARNING, logger="myra"):
        with pytest.raises(server.HTTPException) as exc:
            await server.require_admin(_FakeRequest(), _NonAdmin())

    assert exc.value.status_code == 403
    assert exc.value.detail == "Csak adminok férnek hozzá"
    assert "MYRA_SECURITY_SIGNAL kind=admin_forbidden" in caplog.text
    assert "user_id=42" in caplog.text
    assert "ip=203.0.113.7" in caplog.text

    caplog.clear()
    with caplog.at_level(_logging.WARNING, logger="myra"):
        returned = await server.require_admin(_FakeRequest(), _Admin())
    assert returned is not None
    assert "MYRA_SECURITY_SIGNAL" not in caplog.text
