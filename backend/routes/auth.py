import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from psycopg2.extras import RealDictCursor
import psycopg2

from models.schemas import (
    UserLogin,
    UserOut,
    TokenResponse,
    GoogleAuthRequest,
    GoogleAuthResponse,
)
from database import get_db
from utils.auth import (
    verify_password,
    create_access_token,
    get_current_user,
    verify_google_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])


# =========================================================================
# Staff Authentication (Admin & Judge)
# =========================================================================

@router.post(
    "/staff/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate staff (Admin / Judge) via email and password",
)
@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def staff_login(
    credentials: UserLogin,
    db=Depends(get_db),
):
    """
    Validates staff credentials against the users table.
    Issues a shared JWT access token with type='staff'.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, email, password_hash, role, name FROM users WHERE LOWER(email) = LOWER(%s);",
                (credentials.email.strip(),),
            )
            user = cur.fetchone()

            if not user or not user.get("password_hash"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            is_valid = verify_password(credentials.password, user["password_hash"])
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            token_data = {
                "sub": str(user["id"]),
                "email": user["email"],
                "role": user["role"],
                "name": user["name"],
                "type": "staff",
            }
            access_token = create_access_token(data=token_data)

            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                role=user["role"],
                name=user["name"],
                type="staff",
            )
    except HTTPException:
        raise
    except psycopg2.Error as db_err:
        logger.error(f"Database error during staff login: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during authentication",
        )


# =========================================================================
# Unified Google Sign-In (Staff, Team Leader, or Pre-Registration)
# =========================================================================

@router.post(
    "/google",
    response_model=GoogleAuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Unified Google Sign-In (Auto-routes Staff, Team Leader, or Registration)",
)
@router.post(
    "/staff/google",
    response_model=GoogleAuthResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
@router.post(
    "/team/google",
    response_model=GoogleAuthResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def unified_google_login(
    auth_req: GoogleAuthRequest,
    db=Depends(get_db),
):
    """
    Unified Google Identity Services authentication endpoint.
    1. Verifies Google token, extracts email & name.
    2. Check `users` table: If row exists, issue type='staff' token with user's role (admin/judge).
       (Staff accounts are NEVER auto-created; only manually seeded accounts have staff roles).
    3. If not in `users`:
       - Enforces @bitsathy.ac.in domain check. Non-@bitsathy emails are rejected with 403.
       - Checks `teams` table by leader_email:
         - If team exists & confirmed: issue type='team' token, role='leader'.
         - If team exists & unconfirmed: confirms team and issues type='team' token, role='leader'.
         - If no team exists: returns needs_registration=True with prefilled email & name.
    """
    payload = verify_google_token(auth_req.credential)
    google_email = payload["email"].strip().lower()
    google_name = payload.get("name", "").strip()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # Step 1: Check users table for staff (admin / judge)
            cur.execute(
                "SELECT id, email, role, name FROM users WHERE LOWER(email) = LOWER(%s);",
                (google_email,),
            )
            staff_user = cur.fetchone()

            if staff_user:
                token_data = {
                    "sub": str(staff_user["id"]),
                    "email": staff_user["email"],
                    "role": staff_user["role"],
                    "name": staff_user["name"],
                    "type": "staff",
                }
                access_token = create_access_token(data=token_data)
                return GoogleAuthResponse(
                    access_token=access_token,
                    token_type="bearer",
                    role=staff_user["role"],
                    name=staff_user["name"],
                    type="staff",
                    needs_registration=False,
                    email=staff_user["email"],
                )

            # Step 2: Not in users table -> verify @bitsathy.ac.in domain for participants
            if not google_email.endswith("@bitsathy.ac.in"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only BIT Sathy college accounts (@bitsathy.ac.in) can register as participants.",
                )

            # Step 3: Check teams table by leader_email
            cur.execute(
                "SELECT * FROM teams WHERE LOWER(leader_email) = LOWER(%s);",
                (google_email,),
            )
            team = cur.fetchone()

            if not team:
                return GoogleAuthResponse(
                    needs_registration=True,
                    email=google_email,
                    name=google_name,
                )

            # Auto-confirm unconfirmed team since Google verified email ownership
            if not team["confirmed"]:
                cur.execute(
                    """
                    UPDATE teams
                    SET confirmed = TRUE, confirmation_token = NULL
                    WHERE id = %s
                    RETURNING *;
                    """,
                    (team["id"],),
                )
                team = cur.fetchone()
                db.commit()

            token_data = {
                "sub": str(team["id"]),
                "email": team["leader_email"],
                "role": "leader",
                "name": team["leader_name"],
                "team_code": team.get("team_code"),
                "team_name": team.get("team_name"),
                "type": "team",
            }
            access_token = create_access_token(data=token_data)

            return GoogleAuthResponse(
                access_token=access_token,
                token_type="bearer",
                role="leader",
                name=team["leader_name"],
                team_code=team.get("team_code"),
                team_name=team.get("team_name"),
                type="team",
                needs_registration=False,
                email=team["leader_email"],
            )
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error during Google authentication: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during Google authentication",
        )



# =========================================================================
# Team Leader Authentication (Leader Password Login)
# =========================================================================

@router.post(
    "/team/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate team leader via email and password",
)
def team_login(
    credentials: UserLogin,
    db=Depends(get_db),
):
    """
    Authenticates team leader credentials and issues a shared JWT access token with type='team'.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM teams WHERE LOWER(leader_email) = LOWER(%s);",
                (credentials.email.strip(),),
            )
            team = cur.fetchone()

            if not team:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="No team registered with this leader email address.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            if not team["confirmed"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Team registration is pending email confirmation. Please click the confirmation link sent to your email or sign in with your @bitsathy.ac.in Google account.",
                )

            token_data = {
                "sub": str(team["id"]),
                "email": team["leader_email"],
                "role": "leader",
                "name": team["leader_name"],
                "team_code": team.get("team_code"),
                "team_name": team.get("team_name"),
                "type": "team",
            }
            access_token = create_access_token(data=token_data)

            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                role="leader",
                name=team["leader_name"],
                team_code=team.get("team_code"),
                team_name=team.get("team_name"),
                type="team",
            )
    except HTTPException:
        raise
    except psycopg2.Error as db_err:
        logger.error(f"Database error during team login: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during team login",
        )


# =========================================================================
# Shared Profile Endpoint
# =========================================================================


@router.get(
    "/me",
    response_model=UserOut,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated user/leader profile (Any Role)",
)
def get_authenticated_user_profile(
    current_user: dict = Depends(get_current_user),
):
    """
    Returns current authenticated profile for staff (admin/judge) and team leaders.
    """
    return UserOut(
        id=str(current_user["id"]),
        email=current_user["email"],
        role=current_user["role"],
        name=current_user["name"],
        team_code=current_user.get("team_code"),
        team_name=current_user.get("team_name"),
        created_at=current_user.get("created_at"),
    )
