from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from models.schemas import TeamOut, ScoreCreate, ScoreOut, AttendanceUpdate
from database import get_db
from utils.auth import require_admin

router = APIRouter(tags=["Admin & Judging"], dependencies=[Depends(require_admin)])


@router.get(
    "/teams",
    response_model=List[TeamOut],
    status_code=status.HTTP_200_OK,
    summary="List all registered teams (Admin)",
)
def list_all_teams(
    db=Depends(get_db),
):
    """
    Admin overview: Lists all registered teams, members, and selected problem statements.
    Query logic will be implemented in the feature pass.
    """
    # Stub: Query logic to be implemented
    return []


@router.patch(
    "/teams/{team_id}/attendance",
    response_model=TeamOut,
    status_code=status.HTTP_200_OK,
    summary="Update team attendance (Day 1 / Day 2)",
)
def update_team_attendance(
    team_id: UUID,
    attendance_data: AttendanceUpdate,
    db=Depends(get_db),
):
    """
    Updates attendance check-ins for Day 1 and Day 2 of CodeShield 2026.
    Query logic will be implemented in the feature pass.
    """
    # Stub: Attendance update logic to be implemented
    return None


@router.post(
    "/scores",
    response_model=ScoreOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit judge scoring evaluation",
)
def submit_score(
    score_data: ScoreCreate,
    db=Depends(get_db),
):
    """
    Records judge scoring across innovation, execution, presentation, and usefulness (0-10 each).
    Query logic will be implemented in the feature pass.
    """
    # Stub: Score submission logic to be implemented
    return None
