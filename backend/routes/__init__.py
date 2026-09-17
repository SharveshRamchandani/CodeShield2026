from .auth import router as auth_router
from .problem_statements import router as problem_statements_router
from .teams import router as teams_router
from .submissions import router as submissions_router
from .scores import router as scores_router
from .admin import router as admin_router

__all__ = [
    "auth_router",
    "problem_statements_router",
    "teams_router",
    "submissions_router",
    "scores_router",
    "admin_router",
]
