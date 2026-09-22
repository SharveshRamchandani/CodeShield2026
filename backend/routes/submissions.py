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


# =========================================================================
# Team Leader Submissions (require_role("leader"))
# =========================================================================

from datetime import datetime, timezone
import json

def get_submission_window_status(cur, is_admin: bool = False):
    """
    Checks if current UTC time falls within the configured submission window.
    Returns dictionary with is_locked, opens_at, closes_at, and reason.
    """
    try:
        cur.execute("SELECT value FROM system_settings WHERE key = 'submission_window';")
        row = cur.fetchone()
    except Exception:
        row = None

    opens_at = None
    closes_at = None
    if row and row.get("value"):
        val = row["value"]
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except Exception:
                val = {}
        if val.get("opens_at"):
            try:
                opens_at = datetime.fromisoformat(str(val["opens_at"]).replace("Z", "+00:00"))
            except Exception:
                pass
        if val.get("closes_at"):
            try:
                closes_at = datetime.fromisoformat(str(val["closes_at"]).replace("Z", "+00:00"))
            except Exception:
                pass

    now = datetime.now(timezone.utc)
    is_locked = False
    reason = None

    if opens_at and now < opens_at:
        is_locked = True
        reason = f"Submissions have not opened yet. Window opens at {opens_at.strftime('%Y-%m-%d %H:%M:%S UTC')}."
    elif closes_at and now > closes_at:
        is_locked = True
        reason = f"Submission deadline has passed. Submissions closed at {closes_at.strftime('%Y-%m-%d %H:%M:%S UTC')}."

    return {
        "is_locked": is_locked if not is_admin else False,
        "raw_is_locked": is_locked,
        "opens_at": opens_at,
        "closes_at": closes_at,
        "reason": reason,
    }


@router.get(
    "/mine",
    response_model=Optional[SubmissionOut],
    status_code=status.HTTP_200_OK,
    summary="Get active submission for the logged-in team leader",
)
def get_my_team_submission(
    current_user: dict = Depends(require_role("leader")),
    db=Depends(get_db),
):
    """
    Returns submission deliverable for the authenticated team leader's team along with submission window lock status.
    """
    team_id = current_user["id"]
    is_admin = current_user.get("role") == "admin"

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            window_status = get_submission_window_status(cur, is_admin=is_admin)

            query = """
                SELECT
                    s.id, s.team_id, s.idea_title, s.idea_description,
                    s.repo_url, s.deck_file_url, s.submitted_at,
                    t.team_name, t.team_code,
                    ps.code AS problem_statement_code,
                    ps.title AS problem_statement_title
                FROM submissions s
                JOIN teams t ON s.team_id = t.id
                LEFT JOIN problem_statements ps ON t.problem_statement_id = ps.id
                WHERE s.team_id = %s;
            """
            cur.execute(query, (team_id,))
            row = cur.fetchone()
            if not row:
                return None
            res = dict(row)
            res["is_locked"] = window_status["is_locked"]
            res["opens_at"] = window_status["opens_at"]
            res["closes_at"] = window_status["closes_at"]
            return res
    except psycopg2.Error as db_err:
        logger.error(f"Database error fetching leader submission: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve team submission",
        )


@router.put(
    "/mine",
    response_model=SubmissionOut,
    status_code=status.HTTP_200_OK,
    summary="Create or update project submission for the logged-in team leader",
)
def upsert_my_team_submission(
    submission_data: SubmissionCreate,
    current_user: dict = Depends(require_role("leader")),
    db=Depends(get_db),
):
    """
    Creates or updates project deliverables scoped strictly to the authenticated team leader's team.
    Enforces server-side submission window deadline lock (participants are locked out, admins bypass).
    """
    team_id = current_user["id"]
    is_admin = current_user.get("role") == "admin"

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # Enforce server-side submission window lock for non-admin participants
            window_status = get_submission_window_status(cur, is_admin=is_admin)
            if window_status["raw_is_locked"] and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=window_status["reason"] or "Submissions are closed. The deadline has passed.",
                )

            # Check team
            cur.execute("SELECT id, team_name, team_code FROM teams WHERE id = %s;", (team_id,))
            team = cur.fetchone()
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found.",
                )

            # Check existing submission
            cur.execute("SELECT id FROM submissions WHERE team_id = %s;", (team_id,))
            existing = cur.fetchone()

            if existing:
                cur.execute(
                    """
                    UPDATE submissions
                    SET idea_title = %s,
                        idea_description = %s,
                        repo_url = %s,
                        deck_file_url = %s,
                        submitted_at = NOW()
                    WHERE id = %s
                    RETURNING id, team_id, idea_title, idea_description, repo_url, deck_file_url, submitted_at;
                    """,
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
                cur.execute(
                    """
                    INSERT INTO submissions (team_id, idea_title, idea_description, repo_url, deck_file_url)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, team_id, idea_title, idea_description, repo_url, deck_file_url, submitted_at;
                    """,
                    (
                        team_id,
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
            res["is_locked"] = window_status["is_locked"]
            res["opens_at"] = window_status["opens_at"]
            res["closes_at"] = window_status["closes_at"]
            return res
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error during leader submission upsert: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record project submission",
        )


# =========================================================================
# General & Staff Submissions Endpoints
# =========================================================================

@router.post(
    "/",
    response_model=SubmissionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit project deliverables (Public / Team)",
)
def create_submission(
    submission_data: SubmissionCreate,
    db=Depends(get_db),
):
    """
    Submits project deliverables for a registered team.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, team_name, team_code FROM teams WHERE id = %s;",
                (str(submission_data.team_id),),
            )
            team = cur.fetchone()
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found for submission.",
                )

            cur.execute(
                "SELECT id FROM submissions WHERE team_id = %s;",
                (str(submission_data.team_id),),
            )
            existing = cur.fetchone()

            if existing:
                cur.execute(
                    """
                    UPDATE submissions
                    SET idea_title = %s,
                        idea_description = %s,
                        repo_url = %s,
                        deck_file_url = %s,
                        submitted_at = NOW()
                    WHERE id = %s
                    RETURNING id, team_id, idea_title, idea_description, repo_url, deck_file_url, submitted_at;
                    """,
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
                cur.execute(
                    """
                    INSERT INTO submissions (team_id, idea_title, idea_description, repo_url, deck_file_url)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, team_id, idea_title, idea_description, repo_url, deck_file_url, submitted_at;
                    """,
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
    summary="List all submissions (Admin & Judge)",
    dependencies=[Depends(require_role("admin", "judge"))],
)
def list_submissions(
    db=Depends(get_db),
):
    """
    Retrieves all team submissions with team and problem statement details.
    Accessible to authenticated Staff (Admin & Judge).
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
    summary="Get submission for a specific team (Public)",
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
