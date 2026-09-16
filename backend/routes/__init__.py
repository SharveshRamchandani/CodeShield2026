from .problem_statements import router as problem_statements_router
from .teams import router as teams_router
from .submissions import router as submissions_router
from .admin import router as admin_router

__all__ = [
    "problem_statements_router",
    "teams_router",
    "submissions_router",
    "admin_router",
]
