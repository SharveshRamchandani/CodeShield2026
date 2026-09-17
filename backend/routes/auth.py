import logging
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


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate admin/judge user and issue JWT access token",
)
def login(
    credentials: UserLogin,
    db=Depends(get_db),
):
    """
    Validates user email and password against the users database table.
    Issues a signed JWT access token containing role, user ID, email, and name.
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
                "type": "user",
            }
            access_token = create_access_token(data=token_data)

            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                role=user["role"],
                name=user["name"],
            )
    except HTTPException:
        raise
    except psycopg2.Error as db_err:
        logger.error(f"Database error during login: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during login",
        )
    except Exception as exc:
        logger.error(f"Unexpected error during login: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred",
        )


@router.post(
    "/team/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate team leader via password/credentials",
)
def team_login(
    credentials: UserLogin,
    db=Depends(get_db),
):
    """
    Authenticates team leader credentials and issues a team JWT token.
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
                "team_code": team["team_code"],
                "team_name": team["team_name"],
                "type": "team",
            }
            access_token = create_access_token(data=token_data)

            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                role="leader",
                name=team["leader_name"],
                team_code=team["team_code"],
                team_name=team["team_name"],
            )
    except HTTPException:
        raise
    except psycopg2.Error as db_err:
        logger.error(f"Database error during team login: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during team login",
        )


@router.post(
    "/team/google",
    response_model=GoogleAuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate team leader via Google Identity Services (@bitsathy.ac.in)",
)
def team_google_login(
    auth_req: GoogleAuthRequest,
    db=Depends(get_db),
):
    """
    Validates Google ID token for @bitsathy.ac.in accounts.
    - If team exists & confirmed: issues JWT token.
    - If team exists & unconfirmed: confirms team and issues JWT token.
    - If team does not exist: returns needs_registration=True with prefilled email & name.
    """
    google_payload = verify_google_token(auth_req.credential)
    google_email = google_payload["email"].strip().lower()
    google_name = google_payload.get("name", "").strip()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM teams WHERE LOWER(leader_email) = LOWER(%s);",
                (google_email,),
            )
            team = cur.fetchone()

            if not team:
                # User has not registered a team yet
                return GoogleAuthResponse(
                    needs_registration=True,
                    email=google_email,
                    name=google_name,
                )

            # If team exists but is unconfirmed, verify & confirm now
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

            # Issue team leader JWT token
            token_data = {
                "sub": str(team["id"]),
                "email": team["leader_email"],
                "role": "leader",
                "name": team["leader_name"],
                "team_code": team["team_code"],
                "team_name": team["team_name"],
                "type": "team",
            }
            access_token = create_access_token(data=token_data)

            return GoogleAuthResponse(
                access_token=access_token,
                token_type="bearer",
                role="leader",
                name=team["leader_name"],
                team_code=team["team_code"],
                team_name=team["team_name"],
                needs_registration=False,
                email=team["leader_email"],
            )
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error during Google team login: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during Google authentication",
        )


@router.get(
    "/me",
    response_model=UserOut,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated user/leader profile",
)
def get_authenticated_user_profile(
    current_user: dict = Depends(get_current_user),
):
    """
    Returns current authenticated user details extracted from verified JWT token.
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
