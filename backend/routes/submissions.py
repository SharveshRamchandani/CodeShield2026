import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from psycopg2.extras import RealDictCursor
import psycopg2

from models.schemas import SubmissionCreate, SubmissionOut
from database import get_db
from utils.auth import require_role, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Submissions"])


@router.post(
    "/",
    response_model=SubmissionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit project idea and repository (Public / Team)",
)
def create_submission(
    submission_data: SubmissionCreate,
    db=Depends(get_db),
):
    """
    Submits project deliverables (title, description, repo URL, presentation deck URL)
    for a registered team. Enforces one active submission per team (upsert).
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if team exists
            cur.execute(
                "SELECT id, team_name, team_code, problem_statement_id FROM teams WHERE id = %s;",
                (str(submission_data.team_id),),
            )
            team = cur.fetchone()
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found for submission.",
                )

            # Check if submission already exists for this team
            cur.execute(
                "SELECT id FROM submissions WHERE team_id = %s;",
                (str(submission_data.team_id),),
            )
            existing = cur.fetchone()

            if existing:
                # Update existing submission
                update_query = """
                    UPDATE submissions
                    SET idea_title = %s,
                        idea_description = %s,
                        repo_url = %s,
                        deck_file_url = %s,
                        submitted_at = NOW()
                    WHERE id = %s
                    RETURNING id, team_id, idea_title, idea_description, repo_url, deck_file_url, submitted_at;
                """
                cur.execute(
                    update_query,
                    (
                        submission_data.idea_title.strip(),
                        submission_data.idea_description.strip(),
                        submission_data.repo_url.strip() if submission_data.repo_url else None,
                        submission_data.deck_file_url.strip() if submission_data.deck_file_url else None,
                        existing["id"],
                    ),
                )
                saved = cur.fetchone()
            else:
                # Insert new submission
                insert_query = """
                    INSERT INTO submissions (
                        team_id, idea_title, idea_description, repo_url, deck_file_url
                    ) VALUES (
                        %s, %s, %s, %s, %s
                    ) RETURNING id, team_id, idea_title, idea_description, repo_url, deck_file_url, submitted_at;
                """
                cur.execute(
                    insert_query,
                    (
                        str(submission_data.team_id),
                        submission_data.idea_title.strip(),
                        submission_data.idea_description.strip(),
                        submission_data.repo_url.strip() if submission_data.repo_url else None,
                        submission_data.deck_file_url.strip() if submission_data.deck_file_url else None,
                    ),
                )
                saved = cur.fetchone()

            db.commit()

            res = dict(saved)
            res["team_name"] = team["team_name"]
            res["team_code"] = team["team_code"]
            return res
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error during submission: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record project submission",
        )


@router.get(
    "/",
    response_model=List[SubmissionOut],
    status_code=status.HTTP_200_OK,
    summary="List all submissions (Admin / Judge Evaluation)",
    dependencies=[Depends(get_current_user)],
)
def list_submissions(
    db=Depends(get_db),
):
    """
    Retrieves all team submissions with team and problem statement details.
    Accessible to authenticated Admins and Judges.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT
                    s.id, s.team_id, s.idea_title, s.idea_description,
                    s.repo_url, s.deck_file_url, s.submitted_at,
                    t.team_name, t.team_code,
                    ps.code AS problem_statement_code,
                    ps.title AS problem_statement_title
                FROM submissions s
                LEFT JOIN teams t ON s.team_id = t.id
                LEFT JOIN problem_statements ps ON t.problem_statement_id = ps.id
                ORDER BY s.submitted_at DESC;
            """
            cur.execute(query)
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    except psycopg2.Error as db_err:
        logger.error(f"Database error fetching submissions: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve submissions",
        )


@router.get(
    "/team/{team_id}",
    response_model=SubmissionOut,
    status_code=status.HTTP_200_OK,
    summary="Get submission for a specific team",
)
def get_submission_by_team(
    team_id: UUID,
    db=Depends(get_db),
):
    """
    Retrieves the active submission for a given team.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT
                    s.id, s.team_id, s.idea_title, s.idea_description,
                    s.repo_url, s.deck_file_url, s.submitted_at,
                    t.team_name, t.team_code
                FROM submissions s
                LEFT JOIN teams t ON s.team_id = t.id
                WHERE s.team_id = %s;
            """
            cur.execute(query, (str(team_id),))
            row = cur.fetchone()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No submission found for this team.",
                )

            return dict(row)
    except HTTPException:
        raise
    except psycopg2.Error as db_err:
        logger.error(f"Database error fetching team submission: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error retrieving submission",
        )


@router.delete(
    "/{submission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a submission (Admin Only)",
    dependencies=[Depends(require_role("admin"))],
)
def delete_submission(
    submission_id: UUID,
    db=Depends(get_db),
):
    """
    Admin deletion of a submission deliverable.
    """
    try:
        with db.cursor() as cur:
            cur.execute("DELETE FROM submissions WHERE id = %s;", (str(submission_id),))
            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Submission not found for deletion.",
                )
            db.commit()
            return
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error deleting submission: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete submission",
        )
