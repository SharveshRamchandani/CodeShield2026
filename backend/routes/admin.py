import io
import csv
import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status
from psycopg2.extras import RealDictCursor
import psycopg2

from models.schemas import TeamOut, AttendanceUpdate, UserOut, UserRoleUpdate, TeamConfirmUpdate
from database import get_db
from utils.auth import require_role

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Admin Management"],
    dependencies=[Depends(require_role("admin"))],
)


# =========================================================================
# 1. Telemetry & Stats
# =========================================================================

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
    unconfirmed teams, submissions count, Day 1 & Day 2 attendance counts,
    and active judge metrics.
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

            cur.execute("SELECT COUNT(*) AS total_users, COUNT(*) FILTER (WHERE role = 'admin') AS admin_count, COUNT(*) FILTER (WHERE role = 'judge') AS judge_count FROM users;")
            user_stats = cur.fetchone()

            # Problem statement distribution
            cur.execute("""
                SELECT ps.code, ps.title, COUNT(t.id) as team_count
                FROM problem_statements ps
                LEFT JOIN teams t ON t.problem_statement_id = ps.id
                GROUP BY ps.id, ps.code, ps.title
                ORDER BY ps.code ASC;
            """)
            track_distribution = [dict(row) for row in cur.fetchall()]

            return {
                "total_teams": team_stats["total_teams"] or 0,
                "confirmed_teams": team_stats["confirmed_teams"] or 0,
                "unconfirmed_teams": team_stats["unconfirmed_teams"] or 0,
                "day1_attendance": team_stats["day1_attendance"] or 0,
                "day2_attendance": team_stats["day2_attendance"] or 0,
                "total_submissions": sub_stats["total_submissions"] or 0,
                "total_evaluations": score_stats["total_scores"] or 0,
                "active_judges": score_stats["active_judges"] or 0,
                "total_staff_users": user_stats["total_users"] or 0,
                "admin_count": user_stats["admin_count"] or 0,
                "judge_count": user_stats["judge_count"] or 0,
                "track_distribution": track_distribution,
            }
    except psycopg2.Error as db_err:
        logger.error(f"Database error fetching admin stats: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve admin stats",
        )


# =========================================================================
# 2. Team Management & Attendance
# =========================================================================

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


@router.patch(
    "/teams/{team_id}/confirm",
    response_model=TeamOut,
    status_code=status.HTTP_200_OK,
    summary="Toggle manual team confirmation (Admin)",
)
def update_team_confirmation(
    team_id: UUID,
    confirm_data: TeamConfirmUpdate,
    db=Depends(get_db),
):
    """
    Manually toggles confirmed status of a team from the Admin dashboard.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "UPDATE teams SET confirmed = %s, confirmation_token = NULL WHERE id = %s RETURNING *;",
                (confirm_data.confirmed, str(team_id)),
            )
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
        logger.error(f"Database error updating confirmation: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update team confirmation",
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


# =========================================================================
# 3. User & Role Management (Instant Role Promotion / Demotion)
# =========================================================================

@router.get(
    "/users",
    response_model=List[UserOut],
    status_code=status.HTTP_200_OK,
    summary="List all staff & users for role management (Admin)",
)
def list_admin_users(
    db=Depends(get_db),
):
    """
    Returns all registered users with their current assigned roles (admin / judge).
    Sorted by admin role first, then alphabetical name.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, email, role, name, created_at
                FROM users
                ORDER BY 
                    CASE WHEN role = 'admin' THEN 1 WHEN role = 'judge' THEN 2 ELSE 3 END,
                    name ASC;
            """)
            rows = cur.fetchall()
            return [
                {
                    "id": str(row["id"]),
                    "email": row["email"],
                    "role": row["role"],
                    "name": row["name"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
    except psycopg2.Error as db_err:
        logger.error(f"Database error listing users: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users list",
        )


@router.patch(
    "/users/{user_id}/role",
    response_model=UserOut,
    status_code=status.HTTP_200_OK,
    summary="Instant promote or demote user role in Supabase / Postgres (Admin)",
)
def update_user_role(
    user_id: UUID,
    role_data: UserRoleUpdate,
    db=Depends(get_db),
):
    """
    Instantly updates a user's role in the Supabase/PostgreSQL users table
    between 'admin' and 'judge' with immediate transaction commit.
    """
    new_role = role_data.role.strip().lower()
    if new_role not in ["admin", "judge"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'admin' or 'judge'.",
        )

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE users
                SET role = %s
                WHERE id = %s
                RETURNING id, email, role, name, created_at;
                """,
                (new_role, str(user_id)),
            )
            updated_user = cur.fetchone()

            if not updated_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User with ID '{user_id}' not found.",
                )

            db.commit()
            logger.info(f"User {updated_user['email']} role updated to '{new_role}' by admin.")

            return {
                "id": str(updated_user["id"]),
                "email": updated_user["email"],
                "role": updated_user["role"],
                "name": updated_user["name"],
                "created_at": updated_user["created_at"],
            }
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error updating user role: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user role in database",
        )


# =========================================================================
# 4. Dynamic Judge Load Balancing Callback
# =========================================================================

@router.post(
    "/rebalance-judges",
    status_code=status.HTTP_200_OK,
    summary="Trigger dynamic load-balancing algorithm across judges (Admin)",
)
def trigger_judge_load_balancing(
    db=Depends(get_db),
):
    """
    Dispatches and calculates balanced assignment of submitted teams across active judges.
    Ensures even review load distribution across judge panels.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # Get active judges
            cur.execute("SELECT id, name, email FROM users WHERE role = 'judge' ORDER BY name ASC;")
            judges = cur.fetchall()

            if not judges:
                return {
                    "success": True,
                    "message": "No active judges found in system to allocate.",
                    "total_judges": 0,
                    "total_teams": 0,
                    "allocations": [],
                }

            # Get submitted teams
            cur.execute("""
                SELECT t.id, t.team_name, t.team_code, ps.code as track_code
                FROM teams t
                JOIN submissions s ON s.team_id = t.id
                LEFT JOIN problem_statements ps ON t.problem_statement_id = ps.id
                ORDER BY t.created_at ASC;
            """)
            teams = cur.fetchall()

            # Balanced round-robin allocation
            allocations = []
            judge_count = len(judges)
            for idx, team in enumerate(teams):
                assigned_judge = judges[idx % judge_count]
                allocations.append({
                    "team_id": str(team["id"]),
                    "team_name": team["team_name"],
                    "team_code": team["team_code"],
                    "assigned_judge_id": str(assigned_judge["id"]),
                    "assigned_judge_name": assigned_judge["name"],
                    "track": team.get("track_code") or "General",
                })

            return {
                "success": True,
                "message": f"Successfully rebalanced {len(teams)} submissions across {judge_count} judges.",
                "total_judges": judge_count,
                "total_teams": len(teams),
                "allocations": allocations,
            }
    except psycopg2.Error as db_err:
        logger.error(f"Database error during judge rebalancing: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to execute judge load balancing",
        )


# =========================================================================
# 5. CSV Exports (Teams, Attendance, Scores)
# =========================================================================

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


@router.get(
    "/export/scores",
    summary="Export all evaluation scores to CSV (Admin)",
)
def export_scores_csv(
    db=Depends(get_db),
):
    """
    Generates downloadable CSV containing all judge evaluations, rubric breakdown, and notes.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT
                    t.team_code, t.team_name,
                    s.judge_name,
                    s.innovation_score, s.execution_score, s.presentation_score, s.usefulness_score,
                    (s.innovation_score + s.execution_score + s.presentation_score + s.usefulness_score) AS total_score,
                    s.notes, s.created_at
                FROM scores s
                JOIN teams t ON s.team_id = t.id
                ORDER BY total_score DESC, s.created_at ASC;
            """
            cur.execute(query)
            rows = cur.fetchall()

            output = io.StringIO()
            writer = csv.writer(output)

            writer.writerow([
                "Team Code", "Team Name", "Judge Name",
                "Innovation (10)", "Execution (10)", "Presentation (10)", "Impact/Utility (10)",
                "Total Score (40)", "Judge Notes", "Evaluated At"
            ])

            for r in rows:
                writer.writerow([
                    r["team_code"],
                    r["team_name"],
                    r["judge_name"],
                    r["innovation_score"],
                    r["execution_score"],
                    r["presentation_score"],
                    r["usefulness_score"],
                    r["total_score"],
                    r["notes"] or "",
                    r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if r["created_at"] else "",
                ])

            csv_content = output.getvalue()
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": "attachment; filename=codeshield2026_scores_export.csv"
                },
            )
    except psycopg2.Error as db_err:
        logger.error(f"Database error exporting scores CSV: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export scores CSV",
        )
