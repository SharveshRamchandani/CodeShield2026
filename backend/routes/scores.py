import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg2.extras import RealDictCursor
import psycopg2

from models.schemas import ScoreSubmit, ScoreOut
from database import get_db
from utils.auth import require_role, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Judging & Scores"])


@router.post(
    "/",
    response_model=ScoreOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit judge scoring evaluation (Judge Only)",
)
def submit_score(
    score_data: ScoreSubmit,
    current_user: dict = Depends(require_role("judge")),
    db=Depends(get_db),
):
    """
    Records judge scoring evaluation for a team.
    Enforces judge role; judge_name is securely derived from JWT user credentials.
    """
    judge_name = current_user.get("name") or "Judge"

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if team exists
            cur.execute(
                "SELECT id, team_name, team_code FROM teams WHERE id = %s;",
                (str(score_data.team_id),),
            )
            team = cur.fetchone()
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found for score submission.",
                )

            # Insert score record
            insert_query = """
                INSERT INTO scores (
                    team_id, judge_name, innovation_score,
                    execution_score, presentation_score, usefulness_score, notes
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id, team_id, judge_name, innovation_score, execution_score, presentation_score, usefulness_score, notes, created_at;
            """
            cur.execute(
                insert_query,
                (
                    str(score_data.team_id),
                    judge_name,
                    score_data.innovation_score,
                    score_data.execution_score,
                    score_data.presentation_score,
                    score_data.usefulness_score,
                    score_data.notes,
                ),
            )
            created = cur.fetchone()
            db.commit()

            res = dict(created)
            res["team_name"] = team["team_name"]
            res["team_code"] = team["team_code"]
            return res
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error while saving score: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record score in database",
        )


@router.get(
    "/",
    response_model=List[ScoreOut],
    status_code=status.HTTP_200_OK,
    summary="List scores (Authenticated)",
)
def list_scores(
    team_id: Optional[UUID] = Query(None, description="Filter scores by team ID"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Fetches evaluation scores.
    Judges only see their own scores, Admins see all scores.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT
                    s.id, s.team_id, s.judge_name,
                    s.innovation_score, s.execution_score,
                    s.presentation_score, s.usefulness_score,
                    s.notes, s.created_at,
                    t.team_name, t.team_code
                FROM scores s
                LEFT JOIN teams t ON s.team_id = t.id
            """
            params = []
            conditions = []

            # If user is a judge, filter by judge name
            if current_user["role"] == "judge":
                conditions.append("s.judge_name = %s")
                params.append(current_user["name"])

            if team_id:
                conditions.append("s.team_id = %s")
                params.append(str(team_id))

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY s.created_at DESC;"

            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    except psycopg2.Error as db_err:
        logger.error(f"Database error retrieving scores: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error retrieving scores",
        )
