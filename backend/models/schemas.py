from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr


# ==========================================
# User & Auth Schemas
# ==========================================
class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    name: str
    team_code: Optional[str] = None
    team_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserRoleUpdate(BaseModel):
    role: str = Field(..., description="Role to assign: 'admin', 'judge', or 'leader'")


class UserCreateAdmin(BaseModel):
    email: str
    name: str
    role: Optional[str] = Field("judge", description="Role to assign: 'admin', 'judge', or 'leader'")
    password: Optional[str] = "codeshield2026"


class TeamConfirmUpdate(BaseModel):
    confirmed: bool



class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    type: Optional[str] = None
    team_code: Optional[str] = None
    team_name: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    credential: str


class GoogleAuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    role: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    team_code: Optional[str] = None
    team_name: Optional[str] = None
    needs_registration: Optional[bool] = False
    email: Optional[str] = None



# ==========================================
# Problem Statement Schemas
# ==========================================
class ProblemStatementBase(BaseModel):
    code: str
    title: str
    description: str
    domain: str


class ProblemStatementOut(ProblemStatementBase):
    id: Optional[UUID] = None

    class Config:
        from_attributes = True


# ==========================================
# Team & Registration Schemas
# ==========================================
class TeamCreate(BaseModel):
    team_name: str
    team_size: int = Field(..., ge=2, le=4, description="Team size between 2 and 4 members")
    leader_name: str
    leader_email: str
    leader_phone: str
    leader_college_id: str
    leader_department: str
    leader_year: str
    member2_name: Optional[str] = None
    member2_college_id: Optional[str] = None
    member2_email: Optional[str] = None
    member3_name: Optional[str] = None
    member3_college_id: Optional[str] = None
    member3_email: Optional[str] = None
    member4_name: Optional[str] = None
    member4_college_id: Optional[str] = None
    member4_email: Optional[str] = None
    problem_statement_id: Optional[UUID] = None


class TeamOut(TeamCreate):
    id: UUID
    team_code: str
    attendance_day1: bool = False
    attendance_day2: bool = False
    confirmed: bool = False
    email_sent: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class TeamRegistrationResponse(BaseModel):
    message: str
    team_code: str
    leader_email: str
    confirmed: bool = False


class TeamConfirmationResponse(BaseModel):
    success: bool
    message: str
    team_code: Optional[str] = None
    team_name: Optional[str] = None


class AttendanceUpdate(BaseModel):
    attendance_day1: Optional[bool] = None
    attendance_day2: Optional[bool] = None


# ==========================================
# Submission Schemas
# ==========================================
class SubmissionCreate(BaseModel):
    team_id: UUID
    idea_title: str
    idea_description: str
    repo_url: Optional[str] = None
    deck_file_url: Optional[str] = None


class SubmissionWindowSettings(BaseModel):
    opens_at: Optional[datetime] = None
    closes_at: Optional[datetime] = None


class SubmissionOut(SubmissionCreate):
    id: UUID
    submitted_at: datetime
    team_name: Optional[str] = None
    team_code: Optional[str] = None
    problem_statement_code: Optional[str] = None
    problem_statement_title: Optional[str] = None
    is_locked: bool = False
    opens_at: Optional[datetime] = None
    closes_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubmissionLockUpdate(BaseModel):
    is_locked: bool


class SystemSettingsOut(BaseModel):
    submission_window: SubmissionWindowSettings


# ==========================================
# Score Schemas
# ==========================================
class ScoreSubmit(BaseModel):
    team_id: UUID
    innovation_score: int = Field(..., ge=0, le=10, description="Innovation & Creativity (0-10)")
    execution_score: int = Field(..., ge=0, le=10, description="Technical Execution & Feasibility (0-10)")
    presentation_score: int = Field(..., ge=0, le=10, description="Presentation & Pitch (0-10)")
    usefulness_score: int = Field(..., ge=0, le=10, description="Practical Utility & Impact (0-10)")
    notes: Optional[str] = None


class ScoreCreate(ScoreSubmit):
    judge_name: str


class ScoreOut(ScoreCreate):
    id: UUID
    created_at: datetime
    team_name: Optional[str] = None
    team_code: Optional[str] = None

    class Config:
        from_attributes = True
