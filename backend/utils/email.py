import logging
from typing import Optional, List
from utils.mailer import send_email, build_team_confirmation_content

logger = logging.getLogger(__name__)


def send_confirmation_email(
    to_email: str,
    team_name: str,
    leader_name: str,
    confirmation_token: str,
    team_code: Optional[str] = "PENDING",
    members: Optional[List[str]] = None,
) -> bool:
    """
    Backward-compatible wrapper for sending team registration confirmation email.
    Delegates to the unified mailer.
    """
    member_list = members or [f"{leader_name} (Leader)"]
    content = build_team_confirmation_content(
        team_name=team_name,
        leader_name=leader_name,
        team_code=team_code or "PENDING",
        members=member_list,
        confirmation_token=confirmation_token,
    )

    return send_email(
        to=to_email,
        subject=content["subject"],
        html=content["html"],
        text=content["text"],
    )
