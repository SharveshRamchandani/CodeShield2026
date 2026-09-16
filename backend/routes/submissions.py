from uuid import UUID
from fastapi import APIRouter, Depends, status
from models.schemas import SubmissionCreate, SubmissionOut
from database import get_db

router = APIRouter(tags=["Submissions"])


@router.post(
    "/",
    response_model=SubmissionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit project idea and repository",
)
def create_submission(
    submission_data: SubmissionCreate,
    db=Depends(get_db),
):
    """
    Submits project deliverables (title, description, repo URL, presentation deck URL)
    for a registered team. Enforces one submission per team.
    Query logic will be implemented in the feature pass.
    """
    # Stub: Submission logic to be implemented
    return None


@router.get(
    "/team/{team_id}",
    response_model=SubmissionOut,
    status_code=status.HTTP_200_OK,
    summary="Get submission for a team",
)
def get_submission_by_team(
    team_id: UUID,
    db=Depends(get_db),
):
    """
    Retrieves the active submission for a given team.
    Query logic will be implemented in the feature pass.
    """
    # Stub: Query logic to be implemented
    return None
