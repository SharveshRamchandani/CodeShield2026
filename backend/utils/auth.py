import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from psycopg2.extras import RealDictCursor
import psycopg2
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from database import get_db

# Password hashing context (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "codeshield2026_super_secure_jwt_secret_key_change_in_prod")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # Default 24 hours

# Google OAuth Client ID
GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    "317519964205-ci2ugcntg0hbkq8qgcbhifjhmt5tgsoo.apps.googleusercontent.com",
)

# Security Bearer scheme
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash plain text password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    THE single shared JWT-issuing function across ALL authentication paths:
    (Staff Password, Staff Google, Team Password, Team Google).
    
    Expected claims in data:
      - sub: user_id or team_id (UUID string)
      - email: user or leader email
      - role: 'admin' | 'judge' | 'leader'
      - type: 'staff' | 'team'
      - name: display name
      - optional: team_code, team_name
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_google_token(id_token_str: str) -> Dict[str, Any]:
    """
    Verifies a Google ID token from Google Identity Services (GIS).
    Validates token signature and audience.
    Returns decoded token payload dictionary.
    Domain checks (@bitsathy.ac.in) are intentionally handled by specific callers.
    """
    try:
        payload = id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not payload.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google email address is not verified.",
        )

    return payload


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db=Depends(get_db),
) -> Dict[str, Any]:
    """
    FastAPI security dependency to authenticate and fetch current user/leader from JWT token.
    Decodes token, inspects 'type' claim ('staff' vs 'team'), and queries the appropriate table.
    Returns normalized dictionary: {id, role, name, email, type, ...}.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    user_id: Optional[str] = payload.get("sub")
    email: Optional[str] = payload.get("email")
    token_type: Optional[str] = payload.get("type")
    token_role: Optional[str] = payload.get("role")

    if not user_id and not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Handle Team Leader token (type='team' or role='leader')
            if token_type == "team" or token_role == "leader":
                if user_id:
                    cur.execute("SELECT * FROM teams WHERE id = %s;", (user_id,))
                else:
                    cur.execute("SELECT * FROM teams WHERE LOWER(leader_email) = LOWER(%s);", (email,))
                team = cur.fetchone()

                if not team:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Team account associated with this token no longer exists",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

                team_dict = dict(team)
                return {
                    "id": str(team_dict["id"]),
                    "email": team_dict["leader_email"],
                    "role": "leader",
                    "name": team_dict["leader_name"],
                    "team_code": team_dict.get("team_code"),
                    "team_name": team_dict.get("team_name"),
                    "confirmed": team_dict.get("confirmed", False),
                    "type": "team",
                    "created_at": team_dict.get("created_at"),
                }

            # 2. Handle Staff token (type='staff' or role in ['admin', 'judge'])
            if user_id:
                cur.execute(
                    "SELECT id, email, role, name, created_at FROM users WHERE id = %s;",
                    (user_id,),
                )
            else:
                cur.execute(
                    "SELECT id, email, role, name, created_at FROM users WHERE LOWER(email) = LOWER(%s);",
                    (email,),
                )
            user = cur.fetchone()

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Staff user account associated with this token no longer exists",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            user_dict = dict(user)
            return {
                "id": str(user_dict["id"]),
                "email": user_dict["email"],
                "role": user_dict["role"],
                "name": user_dict["name"],
                "type": "staff",
                "created_at": user_dict.get("created_at"),
            }
    except HTTPException:
        raise
    except psycopg2.Error as db_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during authentication: {db_err}",
        )


def require_role(*roles: str):
    """
    Dependency factory for Role-Based Access Control (RBAC).
    Supports single or multiple roles (e.g. require_role("admin") or require_role("admin", "judge")).
    """
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role")
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of {list(roles)} role(s) (current: '{user_role}')",
            )
        return current_user

    return role_checker
