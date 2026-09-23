import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Ensure .env is loaded from the backend directory regardless of cwd
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

from database import init_db_migrations
from routes.auth import router as auth_router
from routes.problem_statements import router as problem_statements_router
from routes.teams import router as teams_router, register_team
from routes.submissions import router as submissions_router
from routes.scores import router as scores_router
from routes.admin import router as admin_router
from routes.chat import router as chat_router

app = FastAPI(
    title="CodeShield 2026 API",
    description="Backend API services for CodeShield 2026 Hackathon (Cyber Club BIT)",
    version="1.0.0",
)


@app.on_event("startup")
def on_startup():
    init_db_migrations()


# Configure CORS
origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,https://codeshield2026.vercel.app",
)
allowed_origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router, prefix="/api/auth")
app.include_router(problem_statements_router, prefix="/api/problem-statements")
app.include_router(teams_router, prefix="/api/teams")
app.include_router(submissions_router, prefix="/api/submissions")
app.include_router(scores_router, prefix="/api/scores")
app.include_router(admin_router, prefix="/api/admin")
app.include_router(chat_router, prefix="/api/chat")

# Top-level route aliases for convenience
app.add_api_route(
    "/api/register",
    register_team,
    methods=["POST"],
    tags=["Teams & Registration"],
    summary="Register a new team (Alias)",
)


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"], include_in_schema=False)
def health_check():
    """Ultra-lightweight keep-alive & cold-start ping endpoint (No DB, no auth)."""
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
