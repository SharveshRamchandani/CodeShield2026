import os
import time
import base64
import smtplib
import logging
import threading
from typing import Optional, List, Dict, Any
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

logger = logging.getLogger(__name__)

# Environment Configurations
MAIL_PROVIDER = os.getenv("MAIL_PROVIDER", "gmail_api").strip().lower()
MAIL_FROM = os.getenv("MAIL_FROM", "codeshieldhackathon@gmail.com").strip()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# SMTP Configuration (for local dev)
SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "1025"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_TLS = os.getenv("SMTP_TLS", "false").lower() in ("true", "1", "yes")

# In-Memory Token Cache
_token_cache: Dict[str, Any] = {
    "access_token": None,
    "expires_at": 0.0,
}
_token_lock = threading.Lock()

TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def get_gmail_access_token(client: Optional[httpx.Client] = None) -> Optional[str]:
    """
    Retrieves a valid short lived access token using the OAuth2 refresh token.
    Caches the access token in memory until near expiry (with 60 second safety buffer).
    Retries once on 5xx server errors.
    """
    global _token_cache

    now = time.time()
    with _token_lock:
        if _token_cache["access_token"] and now < _token_cache["expires_at"]:
            return _token_cache["access_token"]

    client_id = os.getenv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID).strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET).strip()
    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN", GOOGLE_REFRESH_TOKEN).strip()

    if not client_id or not client_secret or not refresh_token:
        logger.error(
            "Gmail API configuration incomplete: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, "
            "and GOOGLE_REFRESH_TOKEN must all be set."
        )
        return None

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }

    local_client = client or httpx.Client(timeout=10.0)
    should_close = client is None

    try:
        response = None
        for attempt in range(2):
            try:
                response = local_client.post(
                    TOKEN_ENDPOINT,
                    data=payload,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                if response.status_code >= 500 and attempt == 0:
                    logger.warning(
                        f"OAuth2 token refresh attempt 1 returned {response.status_code}. Retrying once..."
                    )
                    time.sleep(1.0)
                    continue
                break
            except httpx.RequestError as exc:
                if attempt == 0:
                    logger.warning(f"OAuth2 token request error: {exc}. Retrying once...")
                    time.sleep(1.0)
                    continue
                logger.error(f"OAuth2 token request failed after retry: {exc}")
                return None

        if response is None:
            logger.error("OAuth2 token refresh failed: No response received.")
            return None

        if response.status_code != 200:
            logger.error(
                f"OAuth2 token refresh error [Status {response.status_code}]: {response.text}"
            )
            return None

        data = response.json()
        access_token = data.get("access_token")
        expires_in = int(data.get("expires_in", 3600))

        if not access_token:
            logger.error("OAuth2 token response did not contain access_token.")
            return None

        with _token_lock:
            _token_cache["access_token"] = access_token
            # Safety buffer of 60 seconds before actual expiration
            _token_cache["expires_at"] = time.time() + float(expires_in) - 60.0

        return access_token
    finally:
        if should_close:
            local_client.close()


def clear_token_cache():
    """Clears the in memory OAuth2 access token cache (useful for tests)."""
    global _token_cache
    with _token_lock:
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = 0.0


def _build_rfc2822_message(to: str, subject: str, html: str, text: str, mail_from: str) -> str:
    """
    Constructs a multipart alternative RFC 2822 MIME message (text + HTML)
    and encodes it as URL safe base64 with no padding.
    """
    msg = MIMEMultipart("alternative")
    msg["From"] = mail_from
    msg["To"] = to
    msg["Subject"] = subject

    # Plain text and HTML parts
    part_text = MIMEText(text, "plain", "utf-8")
    part_html = MIMEText(html, "html", "utf-8")
    msg.attach(part_text)
    msg.attach(part_html)

    raw_bytes = msg.as_bytes()
    # base64url encode with no padding
    encoded = base64.urlsafe_b64encode(raw_bytes).decode("utf-8").rstrip("=")
    return encoded


def _send_via_gmail_api(to: str, subject: str, html: str, text: str, client: Optional[httpx.Client] = None) -> bool:
    """
    Sends an email using the Gmail REST API (users.me.messages.send).
    Retries once on 5xx status codes.
    """
    access_token = get_gmail_access_token(client=client)
    if not access_token:
        logger.error(f"Cannot send email to {to}: Failed to acquire Gmail access token.")
        return False

    mail_from = os.getenv("MAIL_FROM", MAIL_FROM).strip()
    encoded_raw = _build_rfc2822_message(to=to, subject=subject, html=html, text=text, mail_from=mail_from)

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    body = {"raw": encoded_raw}

    local_client = client or httpx.Client(timeout=15.0)
    should_close = client is None

    try:
        response = None
        for attempt in range(2):
            try:
                response = local_client.post(GMAIL_SEND_ENDPOINT, json=body, headers=headers)
                if response.status_code >= 500 and attempt == 0:
                    logger.warning(
                        f"Gmail API send to {to} attempt 1 returned {response.status_code}. Retrying once..."
                    )
                    time.sleep(1.0)
                    continue
                break
            except httpx.RequestError as exc:
                if attempt == 0:
                    logger.warning(f"Gmail API network error sending to {to}: {exc}. Retrying once...")
                    time.sleep(1.0)
                    continue
                logger.error(f"Gmail API network request failed after retry for {to}: {exc}")
                return False

        if response is None:
            logger.error(f"Gmail API send failed for {to}: No response received.")
            return False

        if response.status_code not in (200, 201):
            logger.error(
                f"Gmail API send failed for {to} [Status {response.status_code}]: {response.text}"
            )
            return False

        logger.info(f"Email sent successfully to {to} via Gmail API.")
        return True
    finally:
        if should_close:
            local_client.close()


def _send_via_smtp(to: str, subject: str, html: str, text: str) -> bool:
    """
    Sends email via standard SMTP (intended for local development).
    """
    mail_from = os.getenv("MAIL_FROM", MAIL_FROM).strip()
    msg = MIMEMultipart("alternative")
    msg["From"] = mail_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    host = os.getenv("SMTP_HOST", SMTP_HOST)
    port = int(os.getenv("SMTP_PORT", str(SMTP_PORT)))
    user = os.getenv("SMTP_USER", SMTP_USER)
    password = os.getenv("SMTP_PASSWORD", SMTP_PASSWORD)
    tls = os.getenv("SMTP_TLS", str(SMTP_TLS)).lower() in ("true", "1", "yes")

    try:
        server = smtplib.SMTP(host, port, timeout=15)
        if tls:
            server.starttls()
        if user and password:
            server.login(user, password)
        server.sendmail(mail_from, [to], msg.as_string())
        server.quit()
        logger.info(f"Email sent successfully to {to} via SMTP ({host}:{port}).")
        return True
    except Exception as exc:
        logger.error(f"SMTP email sending failed to {to} ({host}:{port}): {exc}")
        return False


def send_email(to: str, subject: str, html: str, text: str, client: Optional[httpx.Client] = None) -> bool:
    """
    Unified mail dispatcher function.
    Reads MAIL_PROVIDER ("gmail_api" or "smtp").
    """
    provider = os.getenv("MAIL_PROVIDER", MAIL_PROVIDER).strip().lower()

    if provider == "smtp":
        return _send_via_smtp(to=to, subject=subject, html=html, text=text)

    # Default to gmail_api
    return _send_via_gmail_api(to=to, subject=subject, html=html, text=text, client=client)


def build_team_confirmation_content(
    team_name: str,
    leader_name: str,
    team_code: str,
    members: List[str],
    problem_statement_code: Optional[str] = None,
    problem_statement_title: Optional[str] = None,
    confirmation_token: Optional[str] = None,
) -> Dict[str, str]:
    """
    Builds a natural plain written confirmation note (both plaintext and clean text HTML).
    No boxes, no buttons, no colored blocks, one plain link, and a short sign-off.
    """
    frontend_url = os.getenv("FRONTEND_URL", FRONTEND_URL).rstrip("/")
    login_link = f"{frontend_url}/login"

    # Problem statement text
    ps_sentence = ""
    ps_sentence_html = ""
    if problem_statement_code or problem_statement_title:
        ps_full = f"{problem_statement_code or ''} {problem_statement_title or ''}".strip()
        ps_sentence = f" You've been assigned {ps_full} as your problem statement."
        ps_sentence_html = f" You've been assigned <strong>{ps_full}</strong> as your problem statement."

    # Format member lines
    member_lines_text = "\n".join(members)
    member_lines_html = "<br>\n  ".join(members)

    subject = f"You're registered for CodeShield 2026 - {team_name}"

    text_body = f"""Hi {leader_name},

Thanks for registering {team_name} for CodeShield 2026. You're all set, no further action needed.

Your team code is {team_code}.{ps_sentence}

Team members:
{member_lines_text}

Event dates: TBA, we'll email you once they're finalized.

If anything looks wrong or you need to make a change, just reply to this email.

Cyber Club, BIT Sathy"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111827; margin: 0; padding: 16px;">
  <p>Hi {leader_name},</p>

  <p>Thanks for registering {team_name} for CodeShield 2026. You're all set, no further action needed.</p>

  <p>Your team code is <strong>{team_code}</strong>.{ps_sentence_html}</p>

  <p>Team members:<br>
  {member_lines_html}</p>

  <p>Event dates: TBA, we'll email you once they're finalized.</p>

  <p>If anything looks wrong or you need to make a change, just reply to this email.</p>

  <p>Cyber Club, BIT Sathy</p>
</body>
</html>"""

    return {
        "subject": subject,
        "text": text_body,
        "html": html_body,
    }


def send_team_confirmation_email_task(
    team_id: str,
    leader_email: str,
    leader_name: str,
    team_name: str,
    team_code: str,
    members: List[str],
    confirmation_token: Optional[str] = None,
    problem_statement_code: Optional[str] = None,
    problem_statement_title: Optional[str] = None,
):
    """
    Background task target for sending team confirmation email and updating email_sent in DB.
    Never raises an uncaught exception to avoid crashing FastAPI background workers.
    """
    from database import get_connection

    # If problem statement details were not provided, look them up
    ps_code = problem_statement_code
    ps_title = problem_statement_title
    if ps_code is None and ps_title is None:
        try:
            conn = get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT ps.code, ps.title 
                    FROM teams t 
                    LEFT JOIN problem_statements ps ON t.problem_statement_id = ps.id 
                    WHERE t.id = %s;
                    """,
                    (str(team_id),),
                )
                row = cur.fetchone()
                if row and row[0]:
                    ps_code, ps_title = row[0], row[1]
            conn.close()
        except Exception as err:
            logger.warning(f"Could not load problem statement for team {team_id}: {err}")

    logger.info(f"Starting background confirmation email delivery for team '{team_name}' ({team_code}) to {leader_email}")
    content = build_team_confirmation_content(
        team_name=team_name,
        leader_name=leader_name,
        team_code=team_code,
        members=members,
        problem_statement_code=ps_code,
        problem_statement_title=ps_title,
    )

    success = send_email(
        to=leader_email,
        subject=content["subject"],
        html=content["html"],
        text=content["text"],
    )

    if success:
        try:
            conn = get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE teams SET email_sent = TRUE WHERE id = %s;",
                    (str(team_id),),
                )
                conn.commit()
            conn.close()
            logger.info(f"Updated email_sent = TRUE for team {team_id}")
        except Exception as db_err:
            logger.error(f"Failed to update email_sent status in database for team {team_id}: {db_err}")
    else:
        logger.error(f"Background email delivery failed for team '{team_name}' ({team_code}) to {leader_email}")
