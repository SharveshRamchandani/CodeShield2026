import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg2.extras import RealDictCursor
import psycopg2

from models.schemas import ProblemStatementOut
from database import get_db

logger = logging.getLogger(__name__)

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
    Fetch all problem statements ordered by domain then code ascending.
    Supports optional domain filtering.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            if domain:
                query = """
                    SELECT id, code, title, description, domain
                    FROM problem_statements
                    WHERE domain = %s
                    ORDER BY domain ASC, code ASC;
                """
                cur.execute(query, (domain,))
            else:
                query = """
                    SELECT id, code, title, description, domain
                    FROM problem_statements
                    ORDER BY domain ASC, code ASC;
                """
                cur.execute(query)

            rows = cur.fetchall()
            return [dict(row) for row in rows]
    except psycopg2.Error as db_err:
        logger.error(f"Database error while fetching problem statements: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve problem statements from database",
        )
    except Exception as exc:
        logger.error(f"Unexpected error while fetching problem statements: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred",
        )


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
    Fetch a single problem statement by its code identifier (e.g. 'CS 01', 'IT 01').
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT id, code, title, description, domain
                FROM problem_statements
                WHERE code = %s;
            """
            cur.execute(query, (code,))
            row = cur.fetchone()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Problem statement with code '{code}' not found",
                )

            return dict(row)
    except HTTPException:
        raise
    except psycopg2.Error as db_err:
        logger.error(f"Database error while fetching problem statement {code}: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve problem statement '{code}'",
        )
    except Exception as exc:
        logger.error(f"Unexpected error while fetching problem statement {code}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred",
        )
