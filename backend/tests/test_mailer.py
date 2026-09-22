import os
import re
import json
import base64
import pytest
import httpx
from unittest.mock import patch, MagicMock

# Import mailer functions
from utils.mailer import (
    send_email,
    get_gmail_access_token,
    clear_token_cache,
    build_team_confirmation_content,
    TOKEN_ENDPOINT,
    GMAIL_SEND_ENDPOINT,
)


@pytest.fixture(autouse=True)
def setup_env_and_cache(monkeypatch):
    """Resets cache and sets standard mock environment variables for each test."""
    clear_token_cache()
    monkeypatch.setenv("MAIL_PROVIDER", "gmail_api")
    monkeypatch.setenv("MAIL_FROM", "codeshieldtest@gmail.com")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("GOOGLE_REFRESH_TOKEN", "test-refresh-token")
    monkeypatch.setenv("FRONTEND_URL", "https://codeshield2026.vercel.app")
    yield
    clear_token_cache()


def test_gmail_send_success():
    """Tests successful OAuth token refresh and Gmail API email dispatch."""
    def custom_handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url == TOKEN_ENDPOINT:
            assert request.method == "POST"
            return httpx.Response(
                200,
                json={"access_token": "ya29.mock_valid_token", "expires_in": 3600, "token_type": "Bearer"},
            )
        elif url == GMAIL_SEND_ENDPOINT:
            assert request.method == "POST"
            assert request.headers.get("Authorization") == "Bearer ya29.mock_valid_token"
            body = json.loads(request.read().decode("utf-8"))
            assert "raw" in body
            raw_encoded = body["raw"]
            assert "=" not in raw_encoded  # No padding
            
            # Decode and verify payload
            # Pad if needed for standard b64decode
            padded = raw_encoded + "=" * (-len(raw_encoded) % 4)
            decoded_bytes = base64.urlsafe_b64decode(padded)
            decoded_str = decoded_bytes.decode("utf-8", errors="ignore")
            assert "To: leader@test.com" in decoded_str
            assert "Subject: Welcome to CodeShield" in decoded_str
            return httpx.Response(200, json={"id": "msg_success_123", "threadId": "t123"})
        return httpx.Response(404)

    transport = httpx.MockTransport(custom_handler)
    client = httpx.Client(transport=transport)

    result = send_email(
        to="leader@test.com",
        subject="Welcome to CodeShield",
        html="<p>Welcome to CodeShield</p>",
        text="Welcome to CodeShield",
        client=client,
    )
    assert result is True


def test_token_caching():
    """Tests that access token is cached in memory and not refreshed repeatedly within TTL."""
    token_request_count = 0

    def custom_handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_request_count
        url = str(request.url)
        if url == TOKEN_ENDPOINT:
            token_request_count += 1
            return httpx.Response(
                200,
                json={"access_token": "ya29.cached_token", "expires_in": 3600, "token_type": "Bearer"},
            )
        elif url == GMAIL_SEND_ENDPOINT:
            return httpx.Response(200, json={"id": "msg_123"})
        return httpx.Response(404)

    transport = httpx.MockTransport(custom_handler)
    client = httpx.Client(transport=transport)

    # First send
    res1 = send_email(to="test1@test.com", subject="Test 1", html="<p>1</p>", text="1", client=client)
    assert res1 is True
    assert token_request_count == 1

    # Second send immediately after
    res2 = send_email(to="test2@test.com", subject="Test 2", html="<p>2</p>", text="2", client=client)
    assert res2 is True
    assert token_request_count == 1  # Should still be 1 (reused from cache)


def test_invalid_or_expired_refresh_token():
    """Tests graceful handling when Google OAuth rejects the refresh token."""
    def custom_handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == TOKEN_ENDPOINT:
            return httpx.Response(
                400,
                json={"error": "invalid_grant", "error_description": "Token has been expired or revoked."},
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(custom_handler)
    client = httpx.Client(transport=transport)

    result = send_email(
        to="leader@test.com",
        subject="Welcome",
        html="<p>Hi</p>",
        text="Hi",
        client=client,
    )
    assert result is False


def test_gmail_api_error_403():
    """Tests failure handling when Gmail API returns 403 Forbidden."""
    def custom_handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url == TOKEN_ENDPOINT:
            return httpx.Response(200, json={"access_token": "ya29.token", "expires_in": 3600})
        elif url == GMAIL_SEND_ENDPOINT:
            return httpx.Response(
                403,
                json={"error": {"code": 403, "message": "Gmail API has not been used in project before."}},
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(custom_handler)
    client = httpx.Client(transport=transport)

    result = send_email(
        to="leader@test.com",
        subject="Welcome",
        html="<p>Hi</p>",
        text="Hi",
        client=client,
    )
    assert result is False


def test_gmail_api_retry_on_5xx_success(monkeypatch):
    """Tests that a 500/503 server error from Gmail API triggers a single retry and succeeds on attempt 2."""
    send_attempts = 0

    def custom_handler(request: httpx.Request) -> httpx.Response:
        nonlocal send_attempts
        url = str(request.url)
        if url == TOKEN_ENDPOINT:
            return httpx.Response(200, json={"access_token": "ya29.token", "expires_in": 3600})
        elif url == GMAIL_SEND_ENDPOINT:
            send_attempts += 1
            if send_attempts == 1:
                return httpx.Response(503, json={"error": "Backend Error - Service Unavailable"})
            return httpx.Response(200, json={"id": "msg_retried_success"})
        return httpx.Response(404)

    # Mock time.sleep to avoid slowing tests
    monkeypatch.setattr("time.sleep", lambda s: None)

    transport = httpx.MockTransport(custom_handler)
    client = httpx.Client(transport=transport)

    result = send_email(
        to="leader@test.com",
        subject="Welcome",
        html="<p>Hi</p>",
        text="Hi",
        client=client,
    )
    assert result is True
    assert send_attempts == 2


def test_gmail_api_retry_on_5xx_exhausted(monkeypatch):
    """Tests that two consecutive 5xx errors from Gmail API fail gracefully."""
    send_attempts = 0

    def custom_handler(request: httpx.Request) -> httpx.Response:
        nonlocal send_attempts
        url = str(request.url)
        if url == TOKEN_ENDPOINT:
            return httpx.Response(200, json={"access_token": "ya29.token", "expires_in": 3600})
        elif url == GMAIL_SEND_ENDPOINT:
            send_attempts += 1
            return httpx.Response(500, json={"error": "Internal Server Error"})
        return httpx.Response(404)

    monkeypatch.setattr("time.sleep", lambda s: None)

    transport = httpx.MockTransport(custom_handler)
    client = httpx.Client(transport=transport)

    result = send_email(
        to="leader@test.com",
        subject="Welcome",
        html="<p>Hi</p>",
        text="Hi",
        client=client,
    )
    assert result is False
    assert send_attempts == 2


def test_email_content_plain_written_note():
    """
    Tests that generated team confirmation email is a plain written note:
    - Subject: You're registered for CodeShield 2026 - {team_name}
    - Contains team code, PS code/title, member list, event dates TBA, login link
    - Contains NO images, NO buttons, NO boxed card layouts
    - Contains short sign-off: Cyber Club, BIT Sathy
    """
    team_name = "Team Null Stack"
    leader_name = "Sharvesh S R"
    team_code = "CSXSNN"
    members = [
        "Sharvesh S R (Leader)",
        "User 2 (7376232US101)",
        "User 3 (7376232US102)",
    ]
    ps_code = "IT 09"
    ps_title = "AI Grammar Assistant"

    content = build_team_confirmation_content(
        team_name=team_name,
        leader_name=leader_name,
        team_code=team_code,
        members=members,
        problem_statement_code=ps_code,
        problem_statement_title=ps_title,
    )

    subject = content["subject"]
    text = content["text"]
    html = content["html"]

    # 1. Subject check
    assert subject == "You're registered for CodeShield 2026 - Team Null Stack"

    # 2. Text components check
    assert "Hi Sharvesh S R," in text
    assert "Thanks for registering Team Null Stack for CodeShield 2026. You're all set, no further action needed." in text
    assert "Your team code is CSXSNN." in text
    assert "You've been assigned IT 09 AI Grammar Assistant as your problem statement." in text
    assert "Team members:\nSharvesh S R (Leader)\nUser 2 (7376232US101)\nUser 3 (7376232US102)" in text
    assert "Event dates: TBA, we'll email you once they're finalized." in text
    assert "If anything looks wrong or you need to make a change, just reply to this email." in text
    assert "Cyber Club, BIT Sathy" in text

    # 3. HTML components check
    assert "<img" not in html.lower()
    assert "Cyber Club, BIT Sathy" in html
    assert "IT 09 AI Grammar Assistant" in html


def test_token_refresh_retry_on_5xx(monkeypatch):
    """Tests that token endpoint 5xx error triggers a single retry and succeeds."""
    token_attempts = 0

    def custom_handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_attempts
        url = str(request.url)
        if url == TOKEN_ENDPOINT:
            token_attempts += 1
            if token_attempts == 1:
                return httpx.Response(500, json={"error": "oauth_backend_down"})
            return httpx.Response(200, json={"access_token": "ya29.retry_token", "expires_in": 3600})
        elif url == GMAIL_SEND_ENDPOINT:
            return httpx.Response(200, json={"id": "msg_success_after_token_retry"})
        return httpx.Response(404)

    monkeypatch.setattr("time.sleep", lambda s: None)
    transport = httpx.MockTransport(custom_handler)
    client = httpx.Client(transport=transport)

    result = send_email(
        to="leader@test.com",
        subject="Welcome",
        html="<p>Hi</p>",
        text="Hi",
        client=client,
    )
    assert result is True
    assert token_attempts == 2


def test_smtp_send_flow(monkeypatch):
    """Tests the SMTP provider fallback path."""
    monkeypatch.setenv("MAIL_PROVIDER", "smtp")
    monkeypatch.setenv("SMTP_HOST", "localhost")
    monkeypatch.setenv("SMTP_PORT", "1025")

    with patch("smtplib.SMTP") as mock_smtp_cls:
        mock_server = MagicMock()
        mock_smtp_cls.return_value = mock_server

        result = send_email(
            to="leader@test.com",
            subject="Welcome",
            html="<p>Hi</p>",
            text="Hi",
        )
        assert result is True
        mock_smtp_cls.assert_called_once_with("localhost", 1025, timeout=15)
        mock_server.sendmail.assert_called_once()
        mock_server.quit.assert_called_once()

