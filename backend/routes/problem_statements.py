from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from models.schemas import ProblemStatementOut
from database import get_db

router = APIRouter(tags=["Problem Statements"])


@router.get(
    "/",
    response_model=List[ProblemStatementOut],
    status_code=status.HTTP_200_OK,
    summary="List all problem statements",
)
def list_problem_statements(
    domain: Optional[str] = Query(None, description="Filter by domain: Cybersecurity or Innovation & Emerging Technologies"),
    db=Depends(get_db),
):
    """
    Fetch all 32 problem statements ordered by code.
    Allows optional query filtering by domain.
    Query logic will be implemented in the feature pass.
    """
    # Stub: Query logic to be implemented
    return []


@router.get(
    "/{code}",
    response_model=ProblemStatementOut,
    status_code=status.HTTP_200_OK,
    summary="Get single problem statement by code",
)
def get_problem_statement(
    code: str,
    db=Depends(get_db),
):
    """
    Fetch a single problem statement by its code identifier (e.g. CS 01, IT 02).
    Query logic will be implemented in the feature pass.
    """
    # Stub: Query logic to be implemented
    return None
