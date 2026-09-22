import secrets
import string
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from psycopg2.extras import RealDictCursor
import psycopg2

from models.schemas import (
    TeamCreate,
    TeamOut,
    TeamRegistrationResponse,
    TeamConfirmationResponse,
)
from database import get_db
from utils.auth import require_role, get_current_user
from utils.mailer import send_team_confirmation_email_task

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
    background_tasks: BackgroundTasks,
    db=Depends(get_db),
):
    """
    Registers a new team for CodeShield 2026.
    Generates a unique team_code, creates the team in an unconfirmed state,
    creates a confirmation_token, and sends a confirmation email in the background.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # Acquire transaction-level advisory lock to strictly serialize concurrent registrations
            cur.execute("SELECT pg_advisory_xact_lock(hashtext('team_registration_lock'));")

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

            # 1. Intra-team duplicate college ID check
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

            # Validate duplicate email addresses across all submitted members
            submitted_emails = [
                team_data.leader_email.strip().lower(),
                team_data.member2_email.strip().lower() if team_data.member2_email else None,
                team_data.member3_email.strip().lower() if team_data.member3_email else None,
                team_data.member4_email.strip().lower() if team_data.member4_email else None,
            ]
            submitted_emails = [em for em in submitted_emails if em]

            # 1. Intra-team duplicate email check
            seen_emails = set()
            for em in submitted_emails:
                if em in seen_emails:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Duplicate email address '{em}' submitted within the same team registration.",
                    )
                seen_emails.add(em)

            # 2. Cross-team duplicate email check
            cur.execute(
                """
                SELECT team_name, team_code, email FROM (
                    SELECT team_name, team_code, LOWER(leader_email) AS email FROM teams WHERE leader_email IS NOT NULL
                    UNION ALL
                    SELECT team_name, team_code, LOWER(member2_email) AS email FROM teams WHERE member2_email IS NOT NULL
                    UNION ALL
                    SELECT team_name, team_code, LOWER(member3_email) AS email FROM teams WHERE member3_email IS NOT NULL
                    UNION ALL
                    SELECT team_name, team_code, LOWER(member4_email) AS email FROM teams WHERE member4_email IS NOT NULL
                ) existing_emails
                WHERE email = ANY(%s);
                """,
                (submitted_emails,),
            )
            existing_email_dup = cur.fetchone()
            if existing_email_dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email address '{existing_email_dup['email']}' is already registered under team '{existing_email_dup['team_name']}' ({existing_email_dup['team_code']}).",
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

            insert_query = """
                INSERT INTO teams (
                    team_name, team_code, team_size,
                    leader_name, leader_email, leader_phone, leader_college_id,
                    leader_department, leader_year,
                    member2_name, member2_college_id, member2_email,
                    member3_name, member3_college_id, member3_email,
                    member4_name, member4_college_id, member4_email,
                    problem_statement_id,
                    attendance_day1, attendance_day2,
                    confirmed
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s,
                    FALSE, FALSE,
                    TRUE
                ) RETURNING id, team_code, leader_email, confirmed;
            """
            cur.execute(
                insert_query,
                (
                    team_data.team_name.strip(),
                    team_code,
                    team_data.team_size,
                    team_data.leader_name.strip(),
                    team_data.leader_email.strip().lower(),
                    team_data.leader_phone.strip(),
                    team_data.leader_college_id.strip(),
                    team_data.leader_department.strip(),
                    team_data.leader_year.strip(),
                    team_data.member2_name.strip() if team_data.member2_name else None,
                    team_data.member2_college_id.strip() if team_data.member2_college_id else None,
                    team_data.member2_email.strip().lower() if team_data.member2_email else None,
                    team_data.member3_name.strip() if team_data.member3_name else None,
                    team_data.member3_college_id.strip() if team_data.member3_college_id else None,
                    team_data.member3_email.strip().lower() if team_data.member3_email else None,
                    team_data.member4_name.strip() if team_data.member4_name else None,
                    team_data.member4_college_id.strip() if team_data.member4_college_id else None,
                    team_data.member4_email.strip().lower() if team_data.member4_email else None,
                    str(team_data.problem_statement_id) if team_data.problem_statement_id else None,
                ),
            )
            created = cur.fetchone()
            db.commit()

            # Prepare member summary for confirmation email
            members = [f"{team_data.leader_name.strip()} (Leader)"]
            if team_data.member2_name:
                members.append(f"{team_data.member2_name.strip()} ({team_data.member2_college_id or 'Member 2'})")
            if team_data.member3_name:
                members.append(f"{team_data.member3_name.strip()} ({team_data.member3_college_id or 'Member 3'})")
            if team_data.member4_name:
                members.append(f"{team_data.member4_name.strip()} ({team_data.member4_college_id or 'Member 4'})")

            # Send registration details email via FastAPI BackgroundTask to leader only
            background_tasks.add_task(
                send_team_confirmation_email_task,
                team_id=str(created["id"]),
                leader_email=team_data.leader_email.strip().lower(),
                leader_name=team_data.leader_name.strip(),
                team_name=team_data.team_name.strip(),
                team_code=created["team_code"],
                members=members,
            )

            return TeamRegistrationResponse(
                message="Team registered and confirmed successfully! Check your email for details.",
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
    "/mine",
    response_model=TeamOut,
    status_code=status.HTTP_200_OK,
    summary="Get active team for the logged-in team leader or member",
)
def get_my_team(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Returns the authenticated user's team details.
    If no team is found and user is a leader/member, auto-provisions a starter team.
    """
    email = current_user.get("email", "").strip().lower()
    user_id = current_user.get("id")
    name = current_user.get("name") or "Team Leader"

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Lookup by leader_email, member emails, or team id
            cur.execute(
                """
                SELECT * FROM teams 
                WHERE LOWER(leader_email) = %s 
                   OR LOWER(COALESCE(member2_email, '')) = %s
                   OR LOWER(COALESCE(member3_email, '')) = %s
                   OR LOWER(COALESCE(member4_email, '')) = %s
                   OR id::text = %s;
                """,
                (email, email, email, email, str(user_id)),
            )
            team = cur.fetchone()

            if not team:
                # Auto-assign team_code and provision starter team
                team_code = generate_unique_team_code(cur)
                team_name = f"{name}'s Team"
                insert_query = """
                    INSERT INTO teams (
                        team_name, team_code, team_size,
                        leader_name, leader_email, leader_phone, leader_college_id,
                        leader_department, leader_year,
                        attendance_day1, attendance_day2, confirmed
                    ) VALUES (
                        %s, %s, 2,
                        %s, %s, 'N/A', %s,
                        'General', '1st Year',
                        FALSE, FALSE, TRUE
                    ) RETURNING *;
                """
                cur.execute(
                    insert_query,
                    (team_name, team_code, name, email, f"ID-{team_code}"),
                )
                team = cur.fetchone()
                db.commit()

            return dict(team)
    except Exception as exc:
        logger.error(f"Error fetching/auto-provisioning team for {email}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve team details",
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
