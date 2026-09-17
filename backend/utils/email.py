import os
import logging
from typing import Optional
import resend

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
FROM_EMAIL = os.getenv("FROM_EMAIL", "CodeShield 2026 <onboarding@resend.dev>")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def send_confirmation_email(
    to_email: str,
    team_name: str,
    leader_name: str,
    confirmation_token: str,
) -> bool:
    """
    Sends team registration confirmation email with verification link.
    """
    confirmation_link = f"{FRONTEND_URL}/confirm/{confirmation_token}"

    if not RESEND_API_KEY:
        logger.warning(
            f"RESEND_API_KEY not configured. Mocking confirmation email for '{to_email}'."
        )
        logger.info(f"===> Confirmation URL for Team '{team_name}': {confirmation_link}")
        return True

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0B0F14; color: #E7EDF3; padding: 32px; border: 1px solid #1C2633; border-radius: 8px;">
        <div style="color: #22D3EE; font-family: monospace; font-size: 14px; font-weight: bold; margin-bottom: 8px;">
            // CODESHIELD 2026 &middot; CYBER CLUB BIT
        </div>
        <h1 style="color: #FFFFFF; font-size: 24px; margin-top: 0; margin-bottom: 16px;">
            Confirm Your Team Registration
        </h1>
        <p style="color: #8B9BB0; font-size: 15px; line-height: 1.6;">
            Hello <strong>{leader_name}</strong>,
        </p>
        <p style="color: #8B9BB0; font-size: 15px; line-height: 1.6;">
            Thank you for registering team <strong>{team_name}</strong> for <strong>CodeShield 2026</strong>. Please confirm your registration by clicking the button below to secure your team's slot.
        </p>
        <div style="margin: 28px 0; text-align: left;">
            <a href="{confirmation_link}" style="background-color: #22D3EE; color: #0B0F14; font-family: monospace; font-size: 14px; font-weight: bold; padding: 12px 24px; text-decoration: none; display: inline-block; border-radius: 4px;">
                CONFIRM REGISTRATION &rarr;
            </a>
        </div>
        <p style="color: #5A687A; font-size: 13px; line-height: 1.5;">
            Or copy and paste this link into your browser:<br />
            <a href="{confirmation_link}" style="color: #22D3EE; text-decoration: underline;">{confirmation_link}</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #1C2633; margin: 24px 0;" />
        <p style="color: #5A687A; font-size: 12px; margin: 0;">
            CodeShield 2026 &middot; Cyber Club, Bannari Amman Institute of Technology
        </p>
    </div>
    """

    try:
        params: resend.Emails.SendParams = {
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": f"Confirm Team Registration: {team_name} — CodeShield 2026",
            "html": html_content,
        }
        resend.Emails.send(params)
        logger.info(f"Confirmation email sent successfully to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send confirmation email to {to_email}: {exc}")
        return False
