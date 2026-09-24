import io
import csv
import logging
import secrets
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status, BackgroundTasks
from psycopg2.extras import RealDictCursor
import psycopg2

import json
from datetime import datetime, timezone
from models.schemas import (
    TeamOut,
    AttendanceUpdate,
    UserOut,
    UserRoleUpdate,
    UserCreateAdmin,
    TeamConfirmUpdate,
    SubmissionWindowSettings,
    SubmissionCreate,
    SubmissionOut,
    SubmissionLockUpdate,
    SystemSettingsOut,
    ProblemStatementCreate,
    ProblemStatementUpdate,
    ProblemStatementOut,
)
from database import get_db
from utils.auth import require_role, hash_password, get_current_user
from utils.mailer import send_team_confirmation_email_task

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


@router.post(
    "/teams/{team_id}/resend-confirmation",
    status_code=status.HTTP_200_OK,
    summary="Resend registration confirmation email to team leader (Admin)",
)
def resend_team_confirmation(
    team_id: UUID,
    background_tasks: BackgroundTasks,
    db=Depends(get_db),
):
    """
    Resends confirmation email with verification and dashboard links to the team leader.
    Dispatches via FastAPI BackgroundTasks and updates email_sent flag.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    t.*, 
                    ps.code AS problem_code, 
                    ps.title AS problem_title 
                FROM teams t 
                LEFT JOIN problem_statements ps ON t.problem_statement_id = ps.id
                WHERE t.id = %s;
            """, (str(team_id),))
            team = cur.fetchone()
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found.",
                )

            members = [f"{team['leader_name']} (Leader)"]
            if team.get("member2_name"):
                members.append(f"{team['member2_name']} ({team.get('member2_college_id') or 'Member 2'})")
            if team.get("member3_name"):
                members.append(f"{team['member3_name']} ({team.get('member3_college_id') or 'Member 3'})")
            if team.get("member4_name"):
                members.append(f"{team['member4_name']} ({team.get('member4_college_id') or 'Member 4'})")

            background_tasks.add_task(
                send_team_confirmation_email_task,
                team_id=str(team["id"]),
                leader_email=team["leader_email"].strip().lower(),
                leader_name=team["leader_name"].strip(),
                team_name=team["team_name"].strip(),
                team_code=team["team_code"],
                members=members,
                problem_statement_code=team.get("problem_code"),
                problem_statement_title=team.get("problem_title"),
            )

            return {
                "success": True,
                "message": f"Registration email queued successfully for {team['leader_email']}.",
                "team_code": team["team_code"],
                "leader_email": team["leader_email"],
            }
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error resending confirmation: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue confirmation email",
        )


@router.post(
    "/teams/send-all-confirmation",
    status_code=status.HTTP_200_OK,
    summary="Send confirmation and registration details email to all registered teams (Admin)",
)
def send_all_teams_confirmation(
    background_tasks: BackgroundTasks,
    db=Depends(get_db),
):
    """
    Broadcasts registration details and confirmation emails to all registered team leaders.
    Queues tasks via FastAPI BackgroundTasks.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    t.*, 
                    ps.code AS problem_code, 
                    ps.title AS problem_title 
                FROM teams t 
                LEFT JOIN problem_statements ps ON t.problem_statement_id = ps.id
                ORDER BY t.created_at ASC;
            """)
            teams = cur.fetchall()

            if not teams:
                return {
                    "success": True,
                    "count": 0,
                    "message": "No registered teams found to notify.",
                }

            queued_count = 0
            for team in teams:
                members = [f"{team['leader_name']} (Leader)"]
                if team.get("member2_name"):
                    members.append(f"{team['member2_name']} ({team.get('member2_college_id') or 'Member 2'})")
                if team.get("member3_name"):
                    members.append(f"{team['member3_name']} ({team.get('member3_college_id') or 'Member 3'})")
                if team.get("member4_name"):
                    members.append(f"{team['member4_name']} ({team.get('member4_college_id') or 'Member 4'})")

                background_tasks.add_task(
                    send_team_confirmation_email_task,
                    team_id=str(team["id"]),
                    leader_email=team["leader_email"].strip().lower(),
                    leader_name=team["leader_name"].strip(),
                    team_name=team["team_name"].strip(),
                    team_code=team["team_code"],
                    members=members,
                    problem_statement_code=team.get("problem_code"),
                    problem_statement_title=team.get("problem_title"),
                )
                queued_count += 1

            return {
                "success": True,
                "count": queued_count,
                "message": f"Successfully queued registration emails for {queued_count} teams.",
            }
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error queuing emails for all teams: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue emails for all teams",
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
    between 'admin', 'judge', 'leader', and 'member' with immediate transaction commit.
    """
    new_role = role_data.role.strip().lower()
    allowed_roles = ["admin", "judge", "leader", "member"]
    if new_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {allowed_roles}",
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


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user directly with assigned role (Admin Only)",
)
def create_admin_user(
    user_data: UserCreateAdmin,
    db=Depends(get_db),
):
    """
    Directly creates a new Admin, Judge, Team Leader, or Team Member account in the Supabase/Postgres database.
    Works seamlessly with both Password and Google Identity login.
    """
    role = user_data.role.strip().lower()
    allowed_roles = ["admin", "judge", "leader", "member"]
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {allowed_roles}",
        )

    email = user_data.email.strip().lower()
    name = user_data.name.strip()
    if not name:
        name = "Staff Member"
    password = user_data.password.strip() if user_data.password else "codeshield2026"
    password_hash = hash_password(password)

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            # Check for duplicate email
            cur.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(%s);", (email,))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A user with email '{email}' already exists.",
                )

            cur.execute(
                """
                INSERT INTO users (email, password_hash, role, name)
                VALUES (%s, %s, %s, %s)
                RETURNING id, email, role, name, created_at;
                """,
                (email, password_hash, role, name),
            )
            created = cur.fetchone()

            team_code = None
            team_name = None

            # If user is a leader or member, auto-assign a team code and starter team if not existing
            if role in ["leader", "member"]:
                cur.execute("SELECT team_code, team_name FROM teams WHERE LOWER(leader_email) = LOWER(%s);", (email,))
                existing_team = cur.fetchone()
                if not existing_team:
                    import secrets, string
                    chars = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
                    team_code = f"CS-{chars}"
                    team_name = f"{name}'s Team"
                    cur.execute(
                        """
                        INSERT INTO teams (
                            team_name, team_code, team_size,
                            leader_name, leader_email, leader_phone, leader_college_id,
                            leader_department, leader_year,
                            attendance_day1, attendance_day2, confirmed
                        ) VALUES (
                            %s, %s, 2,
                            %s, %s, 'N/A', %s,
                            'General', '1st Year',
                            FALSE, FALSE, TRUE
                        );
                        """,
                        (team_name, team_code, name, email, f"ID-{team_code}"),
                    )
                else:
                    team_code = existing_team["team_code"]
                    team_name = existing_team["team_name"]

            db.commit()

            return {
                "id": str(created["id"]),
                "email": created["email"],
                "role": created["role"],
                "name": created["name"],
                "team_code": team_code,
                "team_name": team_name,
                "created_at": created["created_at"],
            }
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error creating staff user: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user in database",
        )


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a staff user (Admin Only)",
)
def delete_admin_user(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Permanently deletes a staff user account.
    Admins are prevented from deleting their own active account.
    """
    if str(user_id) == str(current_user.get("id")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own active administrator account.",
        )

    try:
        with db.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s;", (str(user_id),))
            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found.",
                )
            db.commit()
            return
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error deleting staff user: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user",
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
                    t.team_code, t.team_name, t.confirmed, t.email_sent, t.team_size,
                    t.leader_name, t.leader_email, t.leader_phone,
                    t.leader_college_id, t.leader_department, t.leader_year,
                    t.member2_name, t.member2_college_id, t.member2_email,
                    t.member3_name, t.member3_college_id, t.member3_email,
                    t.member4_name, t.member4_college_id, t.member4_email,
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
                "Team Code", "Team Name", "Confirmed", "Email Sent", "Team Size",
                "Leader Name", "Leader Email", "Leader Phone", "College ID", "Department", "Year",
                "Member 2 Name", "Member 2 College ID", "Member 2 Email",
                "Member 3 Name", "Member 3 College ID", "Member 3 Email",
                "Member 4 Name", "Member 4 College ID", "Member 4 Email",
                "PS Code", "PS Title", "Track",
                "Day 1 Attendance", "Day 2 Attendance", "Registered At"
            ])

            for r in rows:
                writer.writerow([
                    r["team_code"],
                    r["team_name"],
                    "Yes" if r["confirmed"] else "No",
                    "Yes" if r.get("email_sent") else "No",
                    r["team_size"],
                    r["leader_name"],
                    r["leader_email"],
                    r["leader_phone"],
                    r["leader_college_id"],
                    r["leader_department"],
                    r["leader_year"],
                    r["member2_name"] or "",
                    r["member2_college_id"] or "",
                    r["member2_email"] or "",
                    r["member3_name"] or "",
                    r["member3_college_id"] or "",
                    r["member3_email"] or "",
                    r["member4_name"] or "",
                    r["member4_college_id"] or "",
                    r["member4_email"] or "",
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


# =========================================================================
# 7. System Settings & Submission Window Management (Admin)
# =========================================================================

@router.get(
    "/settings",
    response_model=SystemSettingsOut,
    status_code=status.HTTP_200_OK,
    summary="Get hackathon system settings and submission window config (Admin)",
)
def get_system_settings(
    db=Depends(get_db),
):
    """
    Returns system settings including submission window opens_at and closes_at.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT key, value FROM system_settings WHERE key = 'submission_window';")
            row = cur.fetchone()
            val = row["value"] if row and row.get("value") else {}
            if isinstance(val, str):
                try:
                    val = json.loads(val)
                except Exception:
                    val = {}
            return {
                "submission_window": {
                    "opens_at": val.get("opens_at"),
                    "closes_at": val.get("closes_at"),
                }
            }
    except Exception as exc:
        logger.error(f"Error fetching system settings: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system settings",
        )


@router.patch(
    "/settings/submission-window",
    response_model=SystemSettingsOut,
    status_code=status.HTTP_200_OK,
    summary="Update hackathon submission window (Admin)",
)
def update_submission_window(
    window_data: SubmissionWindowSettings,
    db=Depends(get_db),
):
    """
    Updates the submission window opens_at and closes_at timestamps.
    Changes take effect live immediately without requiring server restarts.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            payload = {
                "opens_at": window_data.opens_at.isoformat() if window_data.opens_at else None,
                "closes_at": window_data.closes_at.isoformat() if window_data.closes_at else None,
            }
            cur.execute(
                """
                INSERT INTO system_settings (key, value, updated_at)
                VALUES ('submission_window', %s::jsonb, NOW())
                ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value, updated_at = NOW()
                RETURNING value;
                """,
                (json.dumps(payload),),
            )
            db.commit()
            return {
                "submission_window": {
                    "opens_at": window_data.opens_at,
                    "closes_at": window_data.closes_at,
                }
            }
    except Exception as exc:
        db.rollback()
        logger.error(f"Error updating submission window: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update submission window",
        )


@router.put(
    "/submissions/{team_id}",
    response_model=SubmissionOut,
    status_code=status.HTTP_200_OK,
    summary="Admin override to create or update any team's submission deliverables (Bypasses window lock)",
)
def admin_override_team_submission(
    team_id: UUID,
    submission_data: SubmissionCreate,
    db=Depends(get_db),
):
    """
    Allows administrators to edit or create project deliverables for any team,
    bypassing submission window deadline locks.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, team_name, team_code FROM teams WHERE id = %s;", (str(team_id),))
            team = cur.fetchone()
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found.",
                )

            cur.execute("SELECT id FROM submissions WHERE team_id = %s;", (str(team_id),))
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
                        str(team_id),
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
            res["is_locked"] = False
            return res
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error(f"Error in admin submission override: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update team submission via admin override",
        )


@router.patch(
    "/submissions/{submission_id}/lock",
    response_model=SubmissionOut,
    status_code=status.HTTP_200_OK,
    summary="Admin lock or unlock a team project submission",
)
def admin_toggle_submission_lock(
    submission_id: UUID,
    lock_data: SubmissionLockUpdate,
    db=Depends(get_db),
):
    """
    Allows administrators to lock or unlock a specific team's project deliverables.
    Unlocking enables the team leader to edit and resubmit their project deliverables.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE submissions
                SET is_locked = %s
                WHERE id = %s
                RETURNING id, team_id, idea_title, idea_description, repo_url, deck_file_url, submitted_at, is_locked;
                """,
                (lock_data.is_locked, str(submission_id)),
            )
            saved = cur.fetchone()
            if not saved:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Submission not found.",
                )

            # Get team info
            cur.execute("SELECT team_name, team_code FROM teams WHERE id = %s;", (saved["team_id"],))
            team = cur.fetchone()
            db.commit()

            res = dict(saved)
            res["team_name"] = team["team_name"] if team else None
            res["team_code"] = team["team_code"] if team else None
            return res
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error toggling submission lock: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update submission lock status",
        )


# =========================================================================
# 7. Problem Statements Management (Admin)
# =========================================================================

@router.get(
    "/problem-statements",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="List all problem statements with assigned team count (Admin)",
)
def admin_list_problem_statements(
    db=Depends(get_db),
):
    """
    Fetch all problem statements along with the number of registered teams
    that have selected each problem statement.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    ps.id, 
                    ps.code, 
                    ps.title, 
                    ps.description, 
                    ps.domain,
                    COUNT(t.id) AS team_count
                FROM problem_statements ps
                LEFT JOIN teams t ON t.problem_statement_id = ps.id
                GROUP BY ps.id, ps.code, ps.title, ps.description, ps.domain
                ORDER BY ps.domain ASC, ps.code ASC;
            """)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except Exception as exc:
        logger.error(f"Error fetching problem statements for admin: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve problem statements",
        )


@router.post(
    "/problem-statements",
    response_model=ProblemStatementOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new problem statement (Admin)",
)
def admin_create_problem_statement(
    ps_data: ProblemStatementCreate,
    db=Depends(get_db),
):
    """
    Create a new problem statement directly in the database.
    Immediately reflects across public catalogue and team registrations.
    """
    code = ps_data.code.strip()
    title = ps_data.title.strip()
    description = ps_data.description.strip()
    domain = ps_data.domain.strip()

    if not code or not title or not description or not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code, Title, Description, and Domain are all required.",
        )

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id FROM problem_statements WHERE LOWER(code) = LOWER(%s);", (code,))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A problem statement with code '{code}' already exists.",
                )

            cur.execute("""
                INSERT INTO problem_statements (code, title, description, domain)
                VALUES (%s, %s, %s, %s)
                RETURNING id, code, title, description, domain;
            """, (code, title, description, domain))
            created = cur.fetchone()
            db.commit()
            return dict(created)
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error creating problem statement: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while saving problem statement",
        )


@router.put(
    "/problem-statements/{ps_id}",
    response_model=ProblemStatementOut,
    status_code=status.HTTP_200_OK,
    summary="Update an existing problem statement (Admin)",
)
def admin_update_problem_statement(
    ps_id: UUID,
    ps_data: ProblemStatementCreate,
    db=Depends(get_db),
):
    """
    Update an existing problem statement's code, title, description, and domain.
    """
    code = ps_data.code.strip()
    title = ps_data.title.strip()
    description = ps_data.description.strip()
    domain = ps_data.domain.strip()

    if not code or not title or not description or not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code, Title, Description, and Domain are all required.",
        )

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id FROM problem_statements WHERE id = %s;", (str(ps_id),))
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Problem statement not found.",
                )

            cur.execute(
                "SELECT id FROM problem_statements WHERE LOWER(code) = LOWER(%s) AND id != %s;",
                (code, str(ps_id)),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Another problem statement with code '{code}' already exists.",
                )

            cur.execute("""
                UPDATE problem_statements
                SET code = %s, title = %s, description = %s, domain = %s
                WHERE id = %s
                RETURNING id, code, title, description, domain;
            """, (code, title, description, domain, str(ps_id)))
            updated = cur.fetchone()
            db.commit()
            return dict(updated)
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error updating problem statement: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating problem statement",
        )


@router.delete(
    "/problem-statements/{ps_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a problem statement (Admin)",
)
def admin_delete_problem_statement(
    ps_id: UUID,
    db=Depends(get_db),
):
    """
    Delete a problem statement directly from the database.
    Any teams assigned to this problem statement will have their assignment unlinked safely.
    """
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, code, title FROM problem_statements WHERE id = %s;", (str(ps_id),))
            ps = cur.fetchone()
            if not ps:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Problem statement not found.",
                )

            # Safely unlink any teams assigned to this problem statement
            cur.execute("UPDATE teams SET problem_statement_id = NULL WHERE problem_statement_id = %s;", (str(ps_id),))
            cur.execute("DELETE FROM problem_statements WHERE id = %s;", (str(ps_id),))
            db.commit()

            return {
                "message": f"Problem statement '{ps['code']} - {ps['title']}' was deleted successfully.",
                "deleted_id": str(ps_id),
                "code": ps["code"],
            }
    except HTTPException:
        db.rollback()
        raise
    except psycopg2.Error as db_err:
        db.rollback()
        logger.error(f"Database error deleting problem statement: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting problem statement",
        )


