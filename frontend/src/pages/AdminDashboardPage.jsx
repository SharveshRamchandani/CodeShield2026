import { useState, useEffect, useMemo, useCallback } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [scores, setScores] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'teams' | 'users' | 'submissions' | 'scores' | 'exports'
  
  // Team Filters & Modal State
  const [teamFilter, setTeamFilter] = useState("all"); // 'all' | 'confirmed' | 'unconfirmed'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeamForDetails, setSelectedTeamForDetails] = useState(null);
  
  // User Management Filters & Creation State
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    role: "judge",
    password: "codeshield2026",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  
  // Actions & Alerts
  const [actionStatus, setActionStatus] = useState(null);
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceResult, setRebalanceResult] = useState(null);
  const [downloadingExport, setDownloadingExport] = useState(null);

  // Auto-dismiss alert messages after 5 seconds
  useEffect(() => {
    if (actionStatus) {
      const timer = setTimeout(() => setActionStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionStatus]);

  // Load all telemetry & portal data
  const loadAllAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, teamsData, subsData, scoresData, usersData] = await Promise.all([
        apiClient.get("/api/admin/stats").catch(() => null),
        apiClient.get("/api/admin/teams").catch(() => []),
        apiClient.get("/api/submissions/").catch(() => []),
        apiClient.get("/api/scores/").catch(() => []),
        apiClient.get("/api/admin/users").catch(() => []),
      ]);
      setStats(statsData);
      setTeams(teamsData || []);
      setSubmissions(subsData || []);
      setScores(scoresData || []);
      setUsersList(usersData || []);
    } catch {
      setActionStatus({ type: "error", text: "Failed to load telemetry data from server." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllAdminData();
  }, [loadAllAdminData]);

  // Filtered Teams List
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (teamFilter === "confirmed" && !t.confirmed) return false;
      if (teamFilter === "unconfirmed" && t.confirmed) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        t.team_name?.toLowerCase().includes(q) ||
        t.team_code?.toLowerCase().includes(q) ||
        t.leader_name?.toLowerCase().includes(q) ||
        t.leader_email?.toLowerCase().includes(q) ||
        t.leader_college_id?.toLowerCase().includes(q) ||
        t.leader_phone?.toLowerCase().includes(q) ||
        t.leader_department?.toLowerCase().includes(q) ||
        t.member2_name?.toLowerCase().includes(q) ||
        t.member2_college_id?.toLowerCase().includes(q) ||
        t.member3_name?.toLowerCase().includes(q) ||
        t.member3_college_id?.toLowerCase().includes(q) ||
        t.member4_name?.toLowerCase().includes(q) ||
        t.member4_college_id?.toLowerCase().includes(q)
      );
    });
  }, [teams, teamFilter, searchQuery]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [usersList, userSearchQuery]);

  // Aggregate Scores for Leaderboard
  const leaderboard = useMemo(() => {
    const map = {};
    for (const s of scores) {
      if (!map[s.team_id]) {
        map[s.team_id] = {
          team_id: s.team_id,
          team_name: s.team_name || "Unknown Team",
          team_code: s.team_code || "-",
          total_score: 0,
          evaluations: 0,
          details: [],
        };
      }
      const scoreTotal =
        (s.innovation_score || 0) +
        (s.execution_score || 0) +
        (s.presentation_score || 0) +
        (s.usefulness_score || 0);
      map[s.team_id].total_score += scoreTotal;
      map[s.team_id].evaluations += 1;
      map[s.team_id].details.push(s);
    }

    const arr = Object.values(map).map((item) => ({
      ...item,
      avg_score: (item.total_score / (item.evaluations || 1)).toFixed(1),
    }));

    return arr.sort((a, b) => b.total_score - a.total_score);
  }, [scores]);

  // ==========================================
  // Action Handlers
  // ==========================================

  // Create New Staff User Directly
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserForm.name.trim() || !newUserForm.email.trim()) {
      setActionStatus({ type: "error", text: "Name and email are required to create a user." });
      return;
    }

    setCreatingUser(true);
    try {
      const created = await apiClient.post("/api/admin/users", {
        name: newUserForm.name.trim(),
        email: newUserForm.email.trim().toLowerCase(),
        role: newUserForm.role,
        password: newUserForm.password || "codeshield2026",
      });

      setUsersList((prev) => [created, ...prev]);
      setIsAddUserModalOpen(false);
      setNewUserForm({
        name: "",
        email: "",
        role: "judge",
        password: "codeshield2026",
      });

      setActionStatus({
        type: "success",
        text: `Created user ${created.name} (${created.email}) as [${created.role.toUpperCase()}].`,
      });

      // Refresh telemetry counts
      apiClient.get("/api/admin/stats").then((res) => res && setStats(res)).catch(() => {});
    } catch (err) {
      setActionStatus({
        type: "error",
        text: err?.message || "Failed to create user in database.",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  // Delete Staff User
  const handleDeleteUser = async (userId, userName, userEmail) => {
    if (!window.confirm(`Are you sure you want to permanently delete staff user '${userName}' (${userEmail})?`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/admin/users/${userId}`);
      setUsersList((prev) => prev.filter((u) => u.id !== userId));

      setActionStatus({
        type: "success",
        text: `User '${userName}' (${userEmail}) was deleted.`,
      });

      apiClient.get("/api/admin/stats").then((res) => res && setStats(res)).catch(() => {});
    } catch (err) {
      setActionStatus({
        type: "error",
        text: err?.message || "Failed to delete user.",
      });
    }
  };

  // Instant User Role Promotion / Demotion
  const handleUpdateUserRole = async (userId, currentRole, newRole) => {
    if (currentRole === newRole) return;
    setUpdatingUserId(userId);

    // Optimistic UI update
    const previousUsers = [...usersList];
    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );

    try {
      const updatedUser = await apiClient.patch(`/api/admin/users/${userId}/role`, {
        role: newRole,
      });

      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...updatedUser } : u))
      );

      setActionStatus({
        type: "success",
        text: `User ${updatedUser.email} role instantly updated to [${newRole.toUpperCase()}].`,
      });

      // Refresh telemetry stats in background
      apiClient.get("/api/admin/stats").then((res) => res && setStats(res)).catch(() => {});
    } catch (err) {
      // Rollback on failure
      setUsersList(previousUsers);
      setActionStatus({
        type: "error",
        text: err?.message || "Failed to update user role in database.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Toggle Attendance
  const handleToggleAttendance = async (teamId, field, currentValue) => {
    try {
      const payload = { [field]: !currentValue };
      const updated = await apiClient.patch(`/api/admin/teams/${teamId}/attendance`, payload);

      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, ...updated } : t))
      );

      if (selectedTeamForDetails && selectedTeamForDetails.id === teamId) {
        setSelectedTeamForDetails((prev) => ({ ...prev, ...updated }));
      }

      const newStats = await apiClient.get("/api/admin/stats").catch(() => null);
      if (newStats) setStats(newStats);

      setActionStatus({
        type: "success",
        text: `Updated ${field === "attendance_day1" ? "Day 1" : "Day 2"} attendance for ${updated.team_name}.`,
      });
    } catch {
      setActionStatus({ type: "error", text: "Failed to update attendance record." });
    }
  };

  // Toggle Team Confirmation
  const handleToggleConfirmation = async (teamId, currentVal) => {
    try {
      const updated = await apiClient.patch(`/api/admin/teams/${teamId}/confirm`, {
        confirmed: !currentVal,
      });

      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, ...updated } : t))
      );

      if (selectedTeamForDetails && selectedTeamForDetails.id === teamId) {
        setSelectedTeamForDetails((prev) => ({ ...prev, ...updated }));
      }

      const newStats = await apiClient.get("/api/admin/stats").catch(() => null);
      if (newStats) setStats(newStats);

      setActionStatus({
        type: "success",
        text: `Team '${updated.team_name}' status set to ${!currentVal ? "CONFIRMED" : "UNCONFIRMED"}.`,
      });
    } catch {
      setActionStatus({ type: "error", text: "Failed to update team confirmation status." });
    }
  };

  // Delete Team
  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to permanently delete team '${teamName}'? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/admin/teams/${teamId}`);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));

      if (selectedTeamForDetails && selectedTeamForDetails.id === teamId) {
        setSelectedTeamForDetails(null);
      }

      const newStats = await apiClient.get("/api/admin/stats").catch(() => null);
      if (newStats) setStats(newStats);

      setActionStatus({ type: "success", text: `Team '${teamName}' was deleted.` });
    } catch {
      setActionStatus({ type: "error", text: "Failed to delete team." });
    }
  };

  // Trigger Judge Load Balancing Callback
  const handleRebalanceJudges = async () => {
    setRebalancing(true);
    setRebalanceResult(null);
    try {
      const res = await apiClient.post("/api/admin/rebalance-judges", {});
      setRebalanceResult(res);
      setActionStatus({
        type: "success",
        text: res.message || "Judge workload successfully rebalanced!",
      });
    } catch (err) {
      setActionStatus({
        type: "error",
        text: err?.message || "Failed to trigger judge load balancing callback.",
      });
    } finally {
      setRebalancing(false);
    }
  };

  // Download CSV helper
  const handleDownloadCsv = async (endpoint, defaultFilename) => {
    setDownloadingExport(defaultFilename);
    try {
      await apiClient.downloadFile(endpoint, defaultFilename);
      setActionStatus({ type: "success", text: `Exported ${defaultFilename} successfully.` });
    } catch (err) {
      setActionStatus({ type: "error", text: err?.message || "Export failed." });
    } finally {
      setDownloadingExport(null);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-base text-content font-mono px-4 sm:px-8 py-8">
      {/* Header Banner */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-hairline pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
              // ADMIN MANAGEMENT CONSOLE &middot; RESTRICTED
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
              CodeShield 2026 Admin Portal
            </h1>
            <p className="text-xs text-muted mt-1">
              Authenticated Administrator: <span className="text-cyan font-semibold">{user?.name || user?.email}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadAllAdminData}
              disabled={loading}
              className="px-3 py-1.5 text-xs border border-hairline bg-panel hover:bg-panel/80 text-content flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <span className={loading ? "animate-spin" : ""}>&circlearrowright;</span>
              {loading ? "Syncing..." : "Refresh Telemetry"}
            </button>
          </div>
        </div>

        {/* Global Toast Alert */}
        {actionStatus && (
          <div
            className={`mt-4 p-3 border text-xs flex items-center justify-between transition-all ${
              actionStatus.type === "success"
                ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300"
                : "border-rose-500/50 bg-rose-950/30 text-rose-300"
            }`}
          >
            <span>&gt; {actionStatus.text}</span>
            <button
              type="button"
              onClick={() => setActionStatus(null)}
              className="text-muted hover:text-content text-sm ml-4"
            >
              &times;
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-hairline mt-6 pt-2 text-xs overflow-x-auto">
          {[
            { id: "overview", label: "[01 // OVERVIEW & METRICS]" },
            { id: "teams", label: `[02 // TEAMS & MEMBERS (${teams.length})]` },
            { id: "users", label: `[03 // USER & ROLE MGMT (${usersList.length})]` },
            { id: "submissions", label: `[04 // DELIVERABLES (${submissions.length})]` },
            { id: "scores", label: `[05 // LEADERBOARD (${leaderboard.length})]` },
            { id: "exports", label: "[06 // EXPORTS & LOAD BALANCER]" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-cyan text-cyan bg-panel/60"
                  : "border-transparent text-muted hover:text-content"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto">
        {/* TAB 1: OVERVIEW & TELEMETRY */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-4 border border-hairline bg-panel">
                <div className="text-[10px] text-muted uppercase">// TOTAL TEAMS</div>
                <div className="text-2xl font-bold text-cyan mt-1">{stats?.total_teams ?? teams.length}</div>
                <div className="text-[10px] text-subtle mt-1">Registered</div>
              </div>

              <div className="p-4 border border-hairline bg-panel">
                <div className="text-[10px] text-muted uppercase">// CONFIRMED</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">{stats?.confirmed_teams ?? 0}</div>
                <div className="text-[10px] text-subtle mt-1">Verified spots</div>
              </div>

              <div className="p-4 border border-hairline bg-panel">
                <div className="text-[10px] text-muted uppercase">// DAY 1 ATTENDANCE</div>
                <div className="text-2xl font-bold text-amber mt-1">{stats?.day1_attendance ?? 0}</div>
                <div className="text-[10px] text-subtle mt-1">Checked in</div>
              </div>

              <div className="p-4 border border-hairline bg-panel">
                <div className="text-[10px] text-muted uppercase">// DAY 2 ATTENDANCE</div>
                <div className="text-2xl font-bold text-amber mt-1">{stats?.day2_attendance ?? 0}</div>
                <div className="text-[10px] text-subtle mt-1">Checked in</div>
              </div>

              <div className="p-4 border border-hairline bg-panel">
                <div className="text-[10px] text-muted uppercase">// SUBMISSIONS</div>
                <div className="text-2xl font-bold text-cyan mt-1">{stats?.total_submissions ?? submissions.length}</div>
                <div className="text-[10px] text-subtle mt-1">Repos & Decks</div>
              </div>

              <div className="p-4 border border-hairline bg-panel">
                <div className="text-[10px] text-muted uppercase">// STAFF / JUDGES</div>
                <div className="text-2xl font-bold text-purple-400 mt-1">{stats?.judge_count ?? 0} / {stats?.total_staff_users ?? usersList.length}</div>
                <div className="text-[10px] text-subtle mt-1">Active staff</div>
              </div>
            </div>

            {stats?.track_distribution && stats.track_distribution.length > 0 && (
              <div className="border border-hairline bg-panel p-5">
                <div className="text-xs font-semibold text-cyan uppercase mb-4">
                  // TRACK & PROBLEM STATEMENT REGISTRATION DIVERSITY
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stats.track_distribution.map((track) => (
                    <div key={track.code} className="p-3 border border-hairline/60 bg-base/50 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-cyan">{track.code}</span>
                        <div className="text-[11px] text-content truncate max-w-[200px]">{track.title}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-content">{track.team_count}</span>
                        <div className="text-[10px] text-muted">teams</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TEAMS & ATTENDANCE & MEMBER INSPECTION */}
        {activeTab === "teams" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border border-hairline bg-panel">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team, code, member name, roll no, email..."
                  className="px-3 py-1.5 text-xs bg-base border border-hairline text-content focus:border-cyan focus:outline-none w-full sm:w-80 font-mono"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-xs text-muted hover:text-content px-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-end">
                <span className="text-muted">Filter:</span>
                {["all", "confirmed", "unconfirmed"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTeamFilter(f)}
                    className={`px-2.5 py-1 text-xs uppercase border transition-colors ${
                      teamFilter === f
                        ? "border-cyan bg-cyan/10 text-cyan font-bold"
                        : "border-hairline text-muted hover:text-content"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-hairline bg-panel overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-hairline bg-base/60 text-muted uppercase text-[10px]">
                    <th className="p-3">Team Code / Name</th>
                    <th className="p-3">Team Leader (Personal)</th>
                    <th className="p-3">Members Personal Details</th>
                    <th className="p-3 text-center">Confirmed</th>
                    <th className="p-3 text-center">Day 1</th>
                    <th className="p-3 text-center">Day 2</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline/60">
                  {filteredTeams.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        No teams match the selected search or filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-base/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-cyan">{team.team_code}</div>
                          <div className="text-content font-medium">{team.team_name}</div>
                          <div className="text-[10px] text-muted">Size: {team.team_size} members</div>
                          <button
                            type="button"
                            onClick={() => setSelectedTeamForDetails(team)}
                            className="mt-1 text-[10px] text-cyan hover:underline inline-flex items-center gap-1"
                          >
                            <span>🔍</span> Full Roster Inspector &rarr;
                          </button>
                        </td>

                        <td className="p-3">
                          <div className="font-semibold text-content flex items-center gap-1.5">
                            <span>{team.leader_name}</span>
                            <span className="text-[9px] px-1 bg-cyan/10 border border-cyan/40 text-cyan font-mono">LEAD</span>
                          </div>
                          <div className="text-[11px] text-muted font-mono">{team.leader_email}</div>
                          <div className="text-[10px] text-subtle font-mono">
                            ID: <strong className="text-content">{team.leader_college_id}</strong> &middot; {team.leader_department} ({team.leader_year})
                          </div>
                          {team.leader_phone && (
                            <div className="text-[10px] text-subtle font-mono">
                              Phone: <a href={`tel:${team.leader_phone}`} className="text-cyan hover:underline">{team.leader_phone}</a>
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-subtle text-[11px] space-y-1">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-cyan font-bold">•</span>
                              <span className="text-content font-medium">{team.member2_name || "Member 2"}</span>
                              <span className="text-[10px] font-mono text-muted">[{team.member2_college_id || "No ID"}]</span>
                            </div>
                            {team.member2_email && (
                              <div className="text-[10px] text-muted font-mono pl-3">{team.member2_email}</div>
                            )}
                          </div>

                          {team.member3_name && (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-cyan font-bold">•</span>
                                <span className="text-content font-medium">{team.member3_name}</span>
                                <span className="text-[10px] font-mono text-muted">[{team.member3_college_id || "No ID"}]</span>
                              </div>
                              {team.member3_email && (
                                <div className="text-[10px] text-muted font-mono pl-3">{team.member3_email}</div>
                              )}
                            </div>
                          )}

                          {team.member4_name && (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-cyan font-bold">•</span>
                                <span className="text-content font-medium">{team.member4_name}</span>
                                <span className="text-[10px] font-mono text-muted">[{team.member4_college_id || "No ID"}]</span>
                              </div>
                              {team.member4_email && (
                                <div className="text-[10px] text-muted font-mono pl-3">{team.member4_email}</div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleConfirmation(team.id, team.confirmed)}
                            className={`px-2 py-0.5 text-[10px] font-bold border transition-colors ${
                              team.confirmed
                                ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
                                : "border-amber/60 bg-amber/10 text-amber hover:bg-amber/20"
                            }`}
                          >
                            {team.confirmed ? "CONFIRMED" : "PENDING"}
                          </button>
                        </td>

                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(team.id, "attendance_day1", team.attendance_day1)}
                            className={`w-7 h-7 inline-flex items-center justify-center border font-bold text-xs transition-colors ${
                              team.attendance_day1
                                ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                                : "border-hairline bg-base text-muted hover:border-hairline/80"
                            }`}
                          >
                            {team.attendance_day1 ? "✓" : "—"}
                          </button>
                        </td>

                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(team.id, "attendance_day2", team.attendance_day2)}
                            className={`w-7 h-7 inline-flex items-center justify-center border font-bold text-xs transition-colors ${
                              team.attendance_day2
                                ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                                : "border-hairline bg-base text-muted hover:border-hairline/80"
                            }`}
                          >
                            {team.attendance_day2 ? "✓" : "—"}
                          </button>
                        </td>

                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(team.id, team.team_name)}
                            className="px-2 py-1 text-[10px] text-rose-400 border border-rose-500/30 hover:bg-rose-950/40 transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: USER & ROLE MANAGEMENT (INSTANT PROMOTE / DEMOTE & DIRECT USER ADDITION) */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Header & Quick Action info */}
            <div className="p-4 border border-cyan/40 bg-cyan/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-cyan uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
                  // RBAC STAFF MANAGEMENT & DIRECT USER PROVISIONING
                </div>
                <p className="text-[11px] text-muted mt-0.5">
                  Directly provision new staff accounts or change assigned roles between <strong className="text-cyan">ADMIN</strong> and <strong className="text-amber">JUDGE</strong>.
                </p>
              </div>

              {/* Actions: Add User Button & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span className="text-sm leading-none">+</span> Add Staff User
                </button>

                <div className="w-full sm:w-56">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search name, email, role..."
                    className="px-3 py-1.5 text-xs bg-base border border-hairline text-content focus:border-cyan focus:outline-none w-full font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="border border-hairline bg-panel overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-hairline bg-base/60 text-muted uppercase text-[10px]">
                    <th className="p-3">Staff / User</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Current Role</th>
                    <th className="p-3 text-center">Direct Role Selector</th>
                    <th className="p-3 text-right">Instant Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted">
                        No users found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = u.email === user?.email;
                      const isUpdating = updatingUserId === u.id;

                      return (
                        <tr key={u.id} className="hover:bg-base/40 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-content flex items-center gap-2">
                              {u.name || "Staff Member"}
                              {isSelf && (
                                <span className="text-[9px] px-1.5 py-0.2 border border-cyan/50 text-cyan bg-cyan/10">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-subtle font-mono">{u.id}</div>
                          </td>

                          <td className="p-3 font-mono text-[11px] text-muted">
                            {u.email}
                          </td>

                          <td className="p-3">
                            <span
                              className={`px-2.5 py-1 text-[10px] font-bold border inline-block ${
                                u.role === "admin"
                                  ? "border-cyan text-cyan bg-cyan/10"
                                  : u.role === "judge"
                                  ? "border-amber text-amber bg-amber/10"
                                  : u.role === "leader"
                                  ? "border-emerald-400 text-emerald-400 bg-emerald-950/20"
                                  : "border-sky-400 text-sky-400 bg-sky-950/20"
                              }`}
                            >
                              {u.role === "leader"
                                ? "TEAM LEADER"
                                : u.role === "member"
                                ? "TEAM MEMBER"
                                : u.role
                                ? u.role.toUpperCase()
                                : "UNKNOWN"}
                            </span>
                          </td>

                          {/* Role Selector Dropdown */}
                          <td className="p-3 text-center">
                            <select
                              value={u.role}
                              disabled={isUpdating || isSelf}
                              onChange={(e) => handleUpdateUserRole(u.id, u.role, e.target.value)}
                              className="px-2 py-1 text-xs bg-base border border-hairline text-content focus:border-cyan focus:outline-none disabled:opacity-50 cursor-pointer font-mono"
                            >
                              <option value="admin">ADMIN</option>
                              <option value="judge">JUDGE</option>
                              <option value="leader">TEAM LEADER</option>
                            </select>
                          </td>

                          {/* Quick 1-Click Promote / Demote / Delete Action */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {u.role !== "admin" ? (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateUserRole(u.id, u.role, "admin")}
                                  className="px-3 py-1 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors disabled:opacity-50"
                                >
                                  {isUpdating ? "Updating..." : "▲ Make Admin"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isUpdating || isSelf}
                                  onClick={() => handleUpdateUserRole(u.id, u.role, "judge")}
                                  title={isSelf ? "Cannot demote your own account" : "Demote to Judge"}
                                  className="px-3 py-1 text-xs text-amber border border-amber/60 hover:bg-amber/10 transition-colors disabled:opacity-40"
                                >
                                  {isUpdating ? "Updating..." : "▼ Set Judge"}
                                </button>
                              )}

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id, u.name, u.email)}
                                  className="px-2 py-1 text-[11px] text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:bg-rose-950/30 transition-colors ml-1"
                                  title="Delete user"
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DELIVERABLES & SUBMISSIONS */}
        {activeTab === "submissions" && (
          <div className="space-y-4">
            <div className="border border-hairline bg-panel overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-hairline bg-base/60 text-muted uppercase text-[10px]">
                    <th className="p-3">Team</th>
                    <th className="p-3">Project Title & Description</th>
                    <th className="p-3">GitHub Repository</th>
                    <th className="p-3">Slide Deck / Demo</th>
                    <th className="p-3 text-right">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline/60">
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted">
                        No team deliverables submitted yet.
                      </td>
                    </tr>
                  ) : (
                    submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-base/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-cyan">{sub.team_code}</div>
                          <div className="text-content">{sub.team_name}</div>
                        </td>

                        <td className="p-3 max-w-sm">
                          <div className="font-bold text-content">{sub.idea_title}</div>
                          <div className="text-[11px] text-muted line-clamp-2 mt-0.5">{sub.idea_description}</div>
                        </td>

                        <td className="p-3">
                          {sub.repo_url ? (
                            <a
                              href={sub.repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan hover:underline inline-flex items-center gap-1 font-mono"
                            >
                              <span>&lt;/&gt;</span> Open Repo &rarr;
                            </a>
                          ) : (
                            <span className="text-muted text-[10px]">Not provided</span>
                          )}
                        </td>

                        <td className="p-3">
                          {sub.deck_file_url ? (
                            <a
                              href={sub.deck_file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber hover:underline inline-flex items-center gap-1 font-mono"
                            >
                              <span>▣</span> View Deck &rarr;
                            </a>
                          ) : (
                            <span className="text-muted text-[10px]">Not provided</span>
                          )}
                        </td>

                        <td className="p-3 text-right text-muted font-mono text-[10px]">
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: LEADERBOARD & SCORES */}
        {activeTab === "scores" && (
          <div className="space-y-4">
            <div className="border border-hairline bg-panel overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-hairline bg-base/60 text-muted uppercase text-[10px]">
                    <th className="p-3 text-center">Rank</th>
                    <th className="p-3">Team</th>
                    <th className="p-3 text-center">Evaluations</th>
                    <th className="p-3 text-center">Avg Score (/40)</th>
                    <th className="p-3 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline/60">
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted">
                        No scores recorded by judges yet.
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((team, idx) => (
                      <tr key={team.team_id} className="hover:bg-base/40 transition-colors">
                        <td className="p-3 text-center font-bold">
                          {idx === 0 ? (
                            <span className="text-amber">🥇 1</span>
                          ) : idx === 1 ? (
                            <span className="text-slate-300">🥈 2</span>
                          ) : idx === 2 ? (
                            <span className="text-amber-600">🥉 3</span>
                          ) : (
                            `#${idx + 1}`
                          )}
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-cyan">{team.team_code}</div>
                          <div className="text-content font-semibold">{team.team_name}</div>
                        </td>

                        <td className="p-3 text-center text-muted">
                          {team.evaluations} judge(s)
                        </td>

                        <td className="p-3 text-center font-bold text-content">
                          {team.avg_score}
                        </td>

                        <td className="p-3 text-right font-bold text-cyan text-sm">
                          {team.total_score}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: EXPORTS & LOAD BALANCING */}
        {activeTab === "exports" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border border-hairline bg-panel space-y-4">
              <div className="text-xs font-bold text-cyan uppercase">
                // DATA EXPORT UTILITIES (CSV)
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Download real-time CSV spreadsheets for attendance verification, registrations, and judging rubric scores.
              </p>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={downloadingExport === "codeshield2026_teams.csv"}
                  onClick={() => handleDownloadCsv("/api/admin/export/csv", "codeshield2026_teams.csv")}
                  className="w-full px-4 py-2.5 text-xs text-left border border-hairline bg-base hover:border-cyan text-content flex items-center justify-between transition-colors disabled:opacity-50"
                >
                  <span>
                    {downloadingExport === "codeshield2026_teams.csv" ? "⬇ Generating Teams CSV..." : "⬇ Download Complete Teams & Members Roster (CSV)"}
                  </span>
                  <span className="text-cyan font-bold">&rarr;</span>
                </button>

                <button
                  type="button"
                  disabled={downloadingExport === "codeshield2026_scores.csv"}
                  onClick={() => handleDownloadCsv("/api/admin/export/scores", "codeshield2026_scores.csv")}
                  className="w-full px-4 py-2.5 text-xs text-left border border-hairline bg-base hover:border-cyan text-content flex items-center justify-between transition-colors disabled:opacity-50"
                >
                  <span>
                    {downloadingExport === "codeshield2026_scores.csv" ? "⬇ Generating Scores CSV..." : "⬇ Download Judge Rubric Evaluations & Scores (CSV)"}
                  </span>
                  <span className="text-cyan font-bold">&rarr;</span>
                </button>
              </div>
            </div>

            <div className="p-6 border border-hairline bg-panel space-y-4">
              <div className="text-xs font-bold text-cyan uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                // DYNAMIC JUDGE LOAD BALANCING
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Trigger the round-robin workload distribution algorithm to allocate team deliverable queues evenly across all active panel judges.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={rebalancing}
                  onClick={handleRebalanceJudges}
                  className="px-5 py-2.5 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {rebalancing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-zinc-950 border-t-transparent animate-spin" />
                      <span>Rebalancing Workload...</span>
                    </>
                  ) : (
                    <span>⚡ Rebalance Judge Workload</span>
                  )}
                </button>
              </div>

              {rebalanceResult && (
                <div className="mt-4 p-3 border border-cyan/40 bg-base text-xs space-y-2">
                  <div className="text-emerald-400 font-bold">&gt; {rebalanceResult.message}</div>
                  <div className="text-subtle text-[11px]">
                    Total Teams: {rebalanceResult.total_teams} | Active Judges: {rebalanceResult.total_judges}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE NEW STAFF USER MODAL */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-panel border border-cyan/40 w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-hairline pb-3">
              <div>
                <div className="text-xs font-bold text-cyan uppercase">// PROVISION NEW USER</div>
                <h2 className="text-xl font-bold text-content mt-1">Add Staff Account</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-muted hover:text-content text-xl font-bold px-2 py-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase text-subtle font-semibold block">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder="e.g. Dr. Jane Doe"
                  className="w-full px-3 py-2 bg-base border border-hairline text-content focus:border-cyan focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase text-subtle font-semibold block">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="e.g. judge@gmail.com or staff@bitsathy.ac.in"
                  className="w-full px-3 py-2 bg-base border border-hairline text-content focus:border-cyan focus:outline-none"
                />
                <span className="text-[10px] text-muted">
                  * Can sign in using Google OAuth or Password.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase text-subtle font-semibold block">
                  Assigned User Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUserForm({ ...newUserForm, role: "judge" })}
                    className={`py-2 px-3 border text-center font-bold text-xs transition-colors ${
                      newUserForm.role === "judge"
                        ? "border-amber bg-amber/10 text-amber"
                        : "border-hairline bg-base text-muted hover:text-content"
                    }`}
                  >
                    JUDGE
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewUserForm({ ...newUserForm, role: "admin" })}
                    className={`py-2 px-3 border text-center font-bold text-xs transition-colors ${
                      newUserForm.role === "admin"
                        ? "border-cyan bg-cyan/10 text-cyan"
                        : "border-hairline bg-base text-muted hover:text-content"
                    }`}
                  >
                    ADMIN
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewUserForm({ ...newUserForm, role: "leader" })}
                    className={`py-2 px-3 border text-center font-bold text-xs transition-colors ${
                      newUserForm.role === "leader"
                        ? "border-emerald-500 bg-emerald-950/30 text-emerald-400"
                        : "border-hairline bg-base text-muted hover:text-content"
                    }`}
                  >
                    TEAM LEADER
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase text-subtle font-semibold block">
                  Initial Password
                </label>
                <input
                  type="text"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  placeholder="codeshield2026"
                  className="w-full px-3 py-2 bg-base border border-hairline text-content focus:border-cyan focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 border border-hairline text-muted hover:text-content"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingUser ? "Creating..." : "✓ Create Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEAM MEMBER ROSTER INSPECTOR MODAL */}
      {selectedTeamForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-panel border border-hairline w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-hairline pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-cyan uppercase">// TEAM ROSTER & PERSONAL PROFILES</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold border border-cyan/40 bg-cyan/10 text-cyan">
                    {selectedTeamForDetails.team_code}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold border ${
                      selectedTeamForDetails.confirmed
                        ? "border-emerald-500/60 text-emerald-400 bg-emerald-950/40"
                        : "border-amber/60 text-amber bg-amber/10"
                    }`}
                  >
                    {selectedTeamForDetails.confirmed ? "CONFIRMED" : "PENDING"}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-content">{selectedTeamForDetails.team_name}</h2>
                <div className="text-xs text-muted mt-1">
                  Registered: {selectedTeamForDetails.created_at ? new Date(selectedTeamForDetails.created_at).toLocaleString() : "-"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTeamForDetails(null)}
                className="text-muted hover:text-content text-xl font-bold px-2 py-1"
              >
                &times;
              </button>
            </div>

            <div className="p-3 border border-hairline bg-base/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted">Attendance:</span>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleAttendance(
                      selectedTeamForDetails.id,
                      "attendance_day1",
                      selectedTeamForDetails.attendance_day1
                    )
                  }
                  className={`px-3 py-1 border text-xs font-bold ${
                    selectedTeamForDetails.attendance_day1
                      ? "border-emerald-500 bg-emerald-950/30 text-emerald-400"
                      : "border-hairline text-muted"
                  }`}
                >
                  Day 1: {selectedTeamForDetails.attendance_day1 ? "PRESENT ✓" : "ABSENT"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleToggleAttendance(
                      selectedTeamForDetails.id,
                      "attendance_day2",
                      selectedTeamForDetails.attendance_day2
                    )
                  }
                  className={`px-3 py-1 border text-xs font-bold ${
                    selectedTeamForDetails.attendance_day2
                      ? "border-emerald-500 bg-emerald-950/30 text-emerald-400"
                      : "border-hairline text-muted"
                  }`}
                >
                  Day 2: {selectedTeamForDetails.attendance_day2 ? "PRESENT ✓" : "ABSENT"}
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleConfirmation(
                      selectedTeamForDetails.id,
                      selectedTeamForDetails.confirmed
                    )
                  }
                  className={`px-3 py-1 border text-xs font-bold ${
                    selectedTeamForDetails.confirmed
                      ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-300"
                      : "border-amber/60 bg-amber/10 text-amber"
                  }`}
                >
                  {selectedTeamForDetails.confirmed ? "Spot Confirmed" : "Mark as Confirmed"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-xs font-semibold text-cyan uppercase">// TEAM MEMBER DOSSIERS</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border-2 border-cyan/40 bg-panel space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-cyan text-zinc-950">
                      TEAM LEADER
                    </span>
                    <span className="text-[10px] text-cyan font-mono">{selectedTeamForDetails.leader_college_id}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-content">{selectedTeamForDetails.leader_name}</h3>
                    <div className="text-xs text-cyan font-mono mt-0.5">{selectedTeamForDetails.leader_email}</div>
                  </div>

                  <div className="pt-2 border-t border-hairline/60 text-xs text-subtle space-y-1 font-mono">
                    <div>
                      <span className="text-muted">College / Roll ID:</span> <strong className="text-content">{selectedTeamForDetails.leader_college_id}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Department:</span> {selectedTeamForDetails.leader_department}
                    </div>
                    <div>
                      <span className="text-muted">Academic Year:</span> {selectedTeamForDetails.leader_year}
                    </div>
                    {selectedTeamForDetails.leader_phone && (
                      <div>
                        <span className="text-muted">Phone Contact:</span>{" "}
                        <a href={`tel:${selectedTeamForDetails.leader_phone}`} className="text-cyan hover:underline">
                          {selectedTeamForDetails.leader_phone}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <a
                      href={`mailto:${selectedTeamForDetails.leader_email}`}
                      className="px-3 py-1 text-[11px] border border-cyan/60 bg-cyan/10 text-cyan hover:bg-cyan/20 transition-colors"
                    >
                      ✉ Send Email
                    </a>
                  </div>
                </div>

                <div className="p-4 border border-hairline bg-panel space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 border border-hairline bg-base text-muted">
                      MEMBER 02
                    </span>
                    <span className="text-[10px] text-muted font-mono">{selectedTeamForDetails.member2_college_id || "No ID"}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-content">{selectedTeamForDetails.member2_name || "Member 2"}</h3>
                    <div className="text-xs text-muted font-mono mt-0.5">Team Contributor</div>
                  </div>

                  <div className="pt-2 border-t border-hairline/60 text-xs text-subtle space-y-1 font-mono">
                    {selectedTeamForDetails.member2_email && (
                      <div>
                        <span className="text-muted">Email:</span>{" "}
                        <span className="text-content">{selectedTeamForDetails.member2_email}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted">College / Roll ID:</span>{" "}
                      <strong className="text-content">{selectedTeamForDetails.member2_college_id || "Not Provided"}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Affiliation:</span> Verified Team Member
                    </div>
                  </div>

                  {selectedTeamForDetails.member2_email && (
                    <div className="pt-2">
                      <a
                        href={`mailto:${selectedTeamForDetails.member2_email}`}
                        className="px-3 py-1 text-[11px] border border-hairline bg-base hover:bg-panel transition-colors text-content"
                      >
                        ✉ Send Email
                      </a>
                    </div>
                  )}
                </div>

                {selectedTeamForDetails.member3_name && (
                  <div className="p-4 border border-hairline bg-panel space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 border border-hairline bg-base text-muted">
                        MEMBER 03
                      </span>
                      <span className="text-[10px] text-muted font-mono">{selectedTeamForDetails.member3_college_id || "No ID"}</span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-content">{selectedTeamForDetails.member3_name}</h3>
                      <div className="text-xs text-muted font-mono mt-0.5">Team Contributor</div>
                    </div>

                    <div className="pt-2 border-t border-hairline/60 text-xs text-subtle space-y-1 font-mono">
                      {selectedTeamForDetails.member3_email && (
                        <div>
                          <span className="text-muted">Email:</span>{" "}
                          <span className="text-content">{selectedTeamForDetails.member3_email}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted">College / Roll ID:</span>{" "}
                        <strong className="text-content">{selectedTeamForDetails.member3_college_id || "Not Provided"}</strong>
                      </div>
                      <div>
                        <span className="text-muted">Affiliation:</span> Verified Team Member
                      </div>
                    </div>

                    {selectedTeamForDetails.member3_email && (
                      <div className="pt-2">
                        <a
                          href={`mailto:${selectedTeamForDetails.member3_email}`}
                          className="px-3 py-1 text-[11px] border border-hairline bg-base hover:bg-panel transition-colors text-content"
                        >
                          ✉ Send Email
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {selectedTeamForDetails.member4_name && (
                  <div className="p-4 border border-hairline bg-panel space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 border border-hairline bg-base text-muted">
                        MEMBER 04
                      </span>
                      <span className="text-[10px] text-muted font-mono">{selectedTeamForDetails.member4_college_id || "No ID"}</span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-content">{selectedTeamForDetails.member4_name}</h3>
                      <div className="text-xs text-muted font-mono mt-0.5">Team Contributor</div>
                    </div>

                    <div className="pt-2 border-t border-hairline/60 text-xs text-subtle space-y-1 font-mono">
                      {selectedTeamForDetails.member4_email && (
                        <div>
                          <span className="text-muted">Email:</span>{" "}
                          <span className="text-content">{selectedTeamForDetails.member4_email}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted">College / Roll ID:</span>{" "}
                        <strong className="text-content">{selectedTeamForDetails.member4_college_id || "Not Provided"}</strong>
                      </div>
                      <div>
                        <span className="text-muted">Affiliation:</span> Verified Team Member
                      </div>
                    </div>

                    {selectedTeamForDetails.member4_email && (
                      <div className="pt-2">
                        <a
                          href={`mailto:${selectedTeamForDetails.member4_email}`}
                          className="px-3 py-1 text-[11px] border border-hairline bg-base hover:bg-panel transition-colors text-content"
                        >
                          ✉ Send Email
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-hairline flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTeamForDetails(null)}
                className="px-5 py-2 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
