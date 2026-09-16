import os
from fastapi import Header, HTTPException, status
from dotenv import load_dotenv

load_dotenv()

ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "codeshield2026admin")


def verify_admin_key(provided_key: str) -> bool:
    """
    Validates provided admin password against environment configured secret.
    """
    return bool(provided_key and provided_key == ADMIN_SECRET_KEY)


def require_admin(x_admin_key: str = Header(..., description="Admin authorization secret key")):
    """
    FastAPI dependency to protect admin dashboard endpoints.
    """
    if not verify_admin_key(x_admin_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )
    return True
