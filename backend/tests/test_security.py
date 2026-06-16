import pytest
import os
from fastapi import Request
from unittest.mock import Mock, patch
from server import _client_ip, _call_llm, HTTPException

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
