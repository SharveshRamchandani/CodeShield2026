from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr


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
    member3_name: Optional[str] = None
    member3_college_id: Optional[str] = None
    member4_name: Optional[str] = None
    member4_college_id: Optional[str] = None
    problem_statement_id: Optional[UUID] = None


class TeamOut(TeamCreate):
    id: UUID
    team_code: str
    attendance_day1: bool = False
    attendance_day2: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


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


class SubmissionOut(SubmissionCreate):
    id: UUID
    submitted_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Score Schemas
# ==========================================
class ScoreCreate(BaseModel):
    team_id: UUID
    judge_name: str
    innovation_score: int = Field(..., ge=0, le=10)
    execution_score: int = Field(..., ge=0, le=10)
    presentation_score: int = Field(..., ge=0, le=10)
    usefulness_score: int = Field(..., ge=0, le=10)
    notes: Optional[str] = None


class ScoreOut(ScoreCreate):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Admin Auth Schemas
# ==========================================
class AdminLogin(BaseModel):
    password: str
