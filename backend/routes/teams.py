import secrets
import string
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg2.extras import RealDictCursor
import psycopg2

from models.schemas import (
    TeamCreate,
    TeamOut,
    TeamRegistrationResponse,
    TeamConfirmationResponse,
)
from database import get_db
from utils.auth import require_role
from utils.email import send_confirmation_email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Teams & Registration"])


def generate_unique_team_code(cur) -> str:
    """Generate a unique human-friendly team code like CS-8F3K."""
    for _ in range(10):
        chars = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
        code = f"CS-{chars}"
        cur.execute("SELECT id FROM teams WHERE team_code = %s;", (code,))
        if not cur.fetchone():
            return code
    # Fallback to 6 chars
    chars = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    return f"CS-{chars}"


@router.post(
    "/register",
    response_model=TeamRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new team (Public)",
)
def register_team(
    team_data: TeamCreate,
    db=Depends(get_db),
):
    """
    Registers a new team for CodeShield 2026.
    Generates a unique team_code, creates the team in an unconfirmed state,
    creates a confirmation_token, and sends a confirmation email.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # Check for existing team with same leader email or team name
            cur.execute(
                "SELECT id FROM teams WHERE LOWER(leader_email) = LOWER(%s);",
                (team_data.leader_email.strip(),),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A team has already been registered with this leader email address.",
                )

            cur.execute(
                "SELECT id FROM teams WHERE LOWER(team_name) = LOWER(%s);",
                (team_data.team_name.strip(),),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Team name is already taken. Please choose a different team name.",
                )

            # Validate unique college ID / roll number across all team members and existing teams
            submitted_college_ids = [
                team_data.leader_college_id.strip().upper(),
                team_data.member2_college_id.strip().upper() if team_data.member2_college_id else None,
                team_data.member3_college_id.strip().upper() if team_data.member3_college_id else None,
                team_data.member4_college_id.strip().upper() if team_data.member4_college_id else None,
            ]
            submitted_college_ids = [cid for cid in submitted_college_ids if cid]

            # 1. Intra-team duplicate check
            seen_ids = set()
            for cid in submitted_college_ids:
                if cid in seen_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Duplicate College ID / Roll Number '{cid}' submitted within the same team registration.",
                    )
                seen_ids.add(cid)

            # 2. Cross-team duplicate check across all 4 columns of all existing teams
            cur.execute(
                """
                SELECT team_name, team_code, college_id FROM (
                    SELECT team_name, team_code, UPPER(leader_college_id) AS college_id FROM teams WHERE leader_college_id IS NOT NULL
                    UNION ALL
                    SELECT team_name, team_code, UPPER(member2_college_id) AS college_id FROM teams WHERE member2_college_id IS NOT NULL
                    UNION ALL
                    SELECT team_name, team_code, UPPER(member3_college_id) AS college_id FROM teams WHERE member3_college_id IS NOT NULL
                    UNION ALL
                    SELECT team_name, team_code, UPPER(member4_college_id) AS college_id FROM teams WHERE member4_college_id IS NOT NULL
                ) existing_members
                WHERE college_id = ANY(%s);
                """,
                (submitted_college_ids,),
            )
            existing_dup = cur.fetchone()
            if existing_dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"College ID / Roll Number '{existing_dup['college_id']}' is already registered under team '{existing_dup['team_name']}' ({existing_dup['team_code']}). A student can only be part of one team.",
                )

            # Validate problem_statement_id if provided
            if team_data.problem_statement_id:
                cur.execute(
                    "SELECT id FROM problem_statements WHERE id = %s;",
                    (str(team_data.problem_statement_id),),
                )
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Selected problem statement does not exist.",
                    )

            team_code = generate_unique_team_code(cur)
            confirmation_token = secrets.token_urlsafe(32)


            insert_query = """
                INSERT INTO teams (
                    team_name, team_code, team_size,
                    leader_name, leader_email, leader_phone, leader_college_id,
                    leader_department, leader_year,
                    member2_name, member2_college_id,
                    member3_name, member3_college_id,
                    member4_name, member4_college_id,
                    problem_statement_id,
                    attendance_day1, attendance_day2,
                    confirmed, confirmation_token
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s,
                    FALSE, FALSE,
                    FALSE, %s
                ) RETURNING id, team_code, leader_email, confirmed;
            """
            cur.execute(
                insert_query,
                (
                    team_data.team_name.strip(),
                    team_code,
                    team_data.team_size,
                    team_data.leader_name.strip(),
                    team_data.leader_email.strip(),
                    team_data.leader_phone.strip(),
                    team_data.leader_college_id.strip(),
                    team_data.leader_department.strip(),
                    team_data.leader_year.strip(),
                    team_data.member2_name.strip() if team_data.member2_name else None,
                    team_data.member2_college_id.strip() if team_data.member2_college_id else None,
                    team_data.member3_name.strip() if team_data.member3_name else None,
                    team_data.member3_college_id.strip() if team_data.member3_college_id else None,
                    team_data.member4_name.strip() if team_data.member4_name else None,
                    team_data.member4_college_id.strip() if team_data.member4_college_id else None,
                    str(team_data.problem_statement_id) if team_data.problem_statement_id else None,
                    confirmation_token,
                ),
            )
            created = cur.fetchone()
            db.commit()

            # Send email
            send_confirmation_email(
                to_email=team_data.leader_email.strip(),
                team_name=team_data.team_name.strip(),
                leader_name=team_data.leader_name.strip(),
                confirmation_token=confirmation_token,
            )

            return TeamRegistrationResponse(
                message="Registration initiated! Please check your email to confirm your team.",
                team_code=created["team_code"],
                leader_email=created["leader_email"],
                confirmed=created["confirmed"],
            )
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error during team registration: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register team in database",
        )


@router.get(
    "/confirm/{token}",
    response_model=TeamConfirmationResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm team registration via email token (Public)",
)
def confirm_team(
    token: str,
    db=Depends(get_db),
):
    """
    Confirms a registered team using the secret token sent to the team leader's email.
    Marks confirmed=True and clears the confirmation token.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, team_name, team_code, confirmed FROM teams WHERE confirmation_token = %s;",
                (token.strip(),),
            )
            team = cur.fetchone()

            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Invalid or expired confirmation token.",
                )

            if team["confirmed"]:
                return TeamConfirmationResponse(
                    success=True,
                    message="Team registration is already confirmed!",
                    team_code=team["team_code"],
                    team_name=team["team_name"],
                )

            cur.execute(
                "UPDATE teams SET confirmed = TRUE, confirmation_token = NULL WHERE id = %s RETURNING team_name, team_code;",
                (team["id"],),
            )
            updated = cur.fetchone()
            db.commit()

            return TeamConfirmationResponse(
                success=True,
                message="Team registration confirmed successfully! Your spot is secured.",
                team_code=updated["team_code"],
                team_name=updated["team_name"],
            )
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error during team confirmation: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm team",
        )


@router.get(
    "/",
    response_model=List[TeamOut],
    status_code=status.HTTP_200_OK,
    summary="List all teams (Admin Only)",
    dependencies=[Depends(require_role("admin"))],
)
def list_teams(
    confirmed_only: Optional[bool] = Query(None, description="Filter for confirmed teams only"),
    db=Depends(get_db),
):
    """
    Admin-only overview: Lists all registered teams with member details and attendance.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            if confirmed_only is True:
                cur.execute("SELECT * FROM teams WHERE confirmed = TRUE ORDER BY created_at DESC;")
            elif confirmed_only is False:
                cur.execute("SELECT * FROM teams WHERE confirmed = FALSE ORDER BY created_at DESC;")
            else:
                cur.execute("SELECT * FROM teams ORDER BY created_at DESC;")

            rows = cur.fetchall()
            return [dict(row) for row in rows]
    except psycopg2.Error as db_err:
        logger.error(f"Database error fetching teams: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error retrieving teams",
        )


@router.get(
    "/{team_code}",
    response_model=TeamOut,
    status_code=status.HTTP_200_OK,
    summary="Get team profile by team code (Public)",
)
def get_team_by_code(
    team_code: str,
    db=Depends(get_db),
):
    """
    Retrieves team details, members, and selected track by unique team code.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM teams WHERE UPPER(team_code) = UPPER(%s);",
                (team_code.strip(),),
            )
            row = cur.fetchone()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Team with code '{team_code}' not found.",
                )

            return dict(row)
    except HTTPException:
        raise
    except psycopg2.Error as db_err:
        logger.error(f"Database error fetching team {team_code}: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error retrieving team '{team_code}'",
        )
