import io
import csv
import logging
from typing import List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status
from psycopg2.extras import RealDictCursor
import psycopg2

from models.schemas import TeamOut, AttendanceUpdate
from database import get_db
from utils.auth import require_role

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Admin Management"],
    dependencies=[Depends(require_role("admin"))],
)


@router.get(
    "/stats",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Get overall hackathon analytics and counts (Admin)",
)
def get_admin_stats(
    db=Depends(get_db),
):
    """
    Returns dashboard overview metrics: total teams, confirmed teams,
    unconfirmed teams, submissions count, Day 1 & Day 2 attendance counts.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    COUNT(*) AS total_teams,
                    COUNT(*) FILTER (WHERE confirmed = TRUE) AS confirmed_teams,
                    COUNT(*) FILTER (WHERE confirmed = FALSE) AS unconfirmed_teams,
                    COUNT(*) FILTER (WHERE attendance_day1 = TRUE) AS day1_attendance,
                    COUNT(*) FILTER (WHERE attendance_day2 = TRUE) AS day2_attendance
                FROM teams;
            """)
            team_stats = cur.fetchone()

            cur.execute("SELECT COUNT(*) AS total_submissions FROM submissions;")
            sub_stats = cur.fetchone()

            cur.execute("SELECT COUNT(*) AS total_scores, COUNT(DISTINCT judge_name) AS active_judges FROM scores;")
            score_stats = cur.fetchone()

            return {
                "total_teams": team_stats["total_teams"] or 0,
                "confirmed_teams": team_stats["confirmed_teams"] or 0,
                "unconfirmed_teams": team_stats["unconfirmed_teams"] or 0,
                "day1_attendance": team_stats["day1_attendance"] or 0,
                "day2_attendance": team_stats["day2_attendance"] or 0,
                "total_submissions": sub_stats["total_submissions"] or 0,
                "total_evaluations": score_stats["total_scores"] or 0,
                "active_judges": score_stats["active_judges"] or 0,
            }
    except psycopg2.Error as db_err:
        logger.error(f"Database error fetching admin stats: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve admin stats",
        )


@router.get(
    "/teams",
    response_model=List[TeamOut],
    status_code=status.HTTP_200_OK,
    summary="List all teams with full metadata (Admin)",
)
def list_admin_teams(
    db=Depends(get_db),
):
    """
    Returns all registered teams ordered by confirmed status and creation date.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM teams ORDER BY confirmed DESC, created_at DESC;")
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    except psycopg2.Error as db_err:
        logger.error(f"Database error fetching teams for admin: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve teams",
        )


@router.patch(
    "/teams/{team_id}/attendance",
    response_model=TeamOut,
    status_code=status.HTTP_200_OK,
    summary="Update team attendance (Day 1 / Day 2) (Admin)",
)
def update_team_attendance(
    team_id: UUID,
    attendance_data: AttendanceUpdate,
    db=Depends(get_db),
):
    """
    Toggles Day 1 and Day 2 attendance check-in for a team.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            updates = []
            params = []

            if attendance_data.attendance_day1 is not None:
                updates.append("attendance_day1 = %s")
                params.append(attendance_data.attendance_day1)

            if attendance_data.attendance_day2 is not None:
                updates.append("attendance_day2 = %s")
                params.append(attendance_data.attendance_day2)

            if not updates:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No attendance fields provided for update.",
                )

            params.append(str(team_id))
            query = f"UPDATE teams SET {', '.join(updates)} WHERE id = %s RETURNING *;"
            cur.execute(query, tuple(params))
            updated = cur.fetchone()

            if not updated:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found.",
                )

            db.commit()
            return dict(updated)
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error updating attendance: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update attendance",
        )


@router.delete(
    "/teams/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a team record (Admin)",
)
def delete_team(
    team_id: UUID,
    db=Depends(get_db),
):
    """
    Permanently removes a team record and cascading dependencies.
    """
    try:
        with db.cursor() as cur:
            cur.execute("DELETE FROM teams WHERE id = %s;", (str(team_id),))
            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found.",
                )
            db.commit()
            return
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error deleting team: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete team",
        )


@router.get(
    "/export/csv",
    summary="Export all registered teams to CSV (Admin)",
)
def export_teams_csv(
    db=Depends(get_db),
):
    """
    Generates downloadable CSV containing all team information,
    leader contacts, members, tracks, confirmation, and attendance status.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT
                    t.team_code, t.team_name, t.confirmed, t.team_size,
                    t.leader_name, t.leader_email, t.leader_phone,
                    t.leader_college_id, t.leader_department, t.leader_year,
                    t.member2_name, t.member2_college_id,
                    t.member3_name, t.member3_college_id,
                    t.member4_name, t.member4_college_id,
                    ps.code AS problem_code, ps.title AS problem_title, ps.domain AS problem_domain,
                    t.attendance_day1, t.attendance_day2, t.created_at
                FROM teams t
                LEFT JOIN problem_statements ps ON t.problem_statement_id = ps.id
                ORDER BY t.confirmed DESC, t.created_at ASC;
            """
            cur.execute(query)
            rows = cur.fetchall()

            output = io.StringIO()
            writer = csv.writer(output)

            # Header row
            writer.writerow([
                "Team Code", "Team Name", "Confirmed", "Team Size",
                "Leader Name", "Leader Email", "Leader Phone", "College ID", "Department", "Year",
                "Member 2 Name", "Member 2 College ID",
                "Member 3 Name", "Member 3 College ID",
                "Member 4 Name", "Member 4 College ID",
                "PS Code", "PS Title", "Track",
                "Day 1 Attendance", "Day 2 Attendance", "Registered At"
            ])

            for r in rows:
                writer.writerow([
                    r["team_code"],
                    r["team_name"],
                    "Yes" if r["confirmed"] else "No",
                    r["team_size"],
                    r["leader_name"],
                    r["leader_email"],
                    r["leader_phone"],
                    r["leader_college_id"],
                    r["leader_department"],
                    r["leader_year"],
                    r["member2_name"] or "",
                    r["member2_college_id"] or "",
                    r["member3_name"] or "",
                    r["member3_college_id"] or "",
                    r["member4_name"] or "",
                    r["member4_college_id"] or "",
                    r["problem_code"] or "",
                    r["problem_title"] or "",
                    r["problem_domain"] or "",
                    "Present" if r["attendance_day1"] else "Absent",
                    "Present" if r["attendance_day2"] else "Absent",
                    r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if r["created_at"] else "",
                ])

            csv_content = output.getvalue()
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": "attachment; filename=codeshield2026_teams_export.csv"
                },
            )
    except psycopg2.Error as db_err:
        logger.error(f"Database error exporting CSV: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export CSV",
        )
