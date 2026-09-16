import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routes.problem_statements import router as problem_statements_router
from routes.teams import router as teams_router
from routes.submissions import router as submissions_router
from routes.admin import router as admin_router

load_dotenv()

app = FastAPI(
    title="CodeShield 2026 API",
    description="Backend API services for CodeShield 2026 Hackathon (Cyber Club BIT)",
    version="1.0.0",
)

# Configure CORS
origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://codeshield2026.vercel.app")
allowed_origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(problem_statements_router, prefix="/api/problem-statements")
app.include_router(teams_router, prefix="/api/teams")
app.include_router(submissions_router, prefix="/api/submissions")
app.include_router(admin_router, prefix="/api/admin")


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "CodeShield 2026 Backend",
        "version": "1.0.0",
    }
