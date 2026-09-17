import { useState, useEffect, useMemo, useCallback } from "react";
import { apiClient, TOKEN_STORAGE_KEY } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState("teams"); // 'teams' | 'submissions' | 'scores'
  const [teamFilter, setTeamFilter] = useState("all"); // 'all' | 'confirmed' | 'unconfirmed'
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [actionStatus, setActionStatus] = useState(null);

  const loadAllAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, teamsData, subsData, scoresData] = await Promise.all([
        apiClient.get("/api/admin/stats").catch(() => null),
        apiClient.get("/api/admin/teams").catch(() => []),
        apiClient.get("/api/submissions/").catch(() => []),
        apiClient.get("/api/scores/").catch(() => []),
      ]);
      setStats(statsData);
      setTeams(teamsData || []);
      setSubmissions(subsData || []);
      setScores(scoresData || []);
    } catch {
      setActionStatus({ type: "error", text: "Failed to load admin telemetry data." });
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
        t.leader_college_id?.toLowerCase().includes(q)
      );
    });
  }, [teams, teamFilter, searchQuery]);

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
        s.innovation_score + s.execution_score + s.presentation_score + s.usefulness_score;
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

  // Toggle Attendance
  const handleToggleAttendance = async (teamId, field, currentValue) => {
    try {
      const payload = { [field]: !currentValue };
      const updated = await apiClient.patch(`/api/admin/teams/${teamId}/attendance`, payload);

      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, ...updated } : t))
      );
      // Refresh stats
      const newStats = await apiClient.get("/api/admin/stats");
      setStats(newStats);
    } catch (err) {
      setActionStatus({ type: "error", text: err.message || "Failed to update attendance." });
    }
  };

  // Delete Team
  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to permanently delete team "${teamName}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/admin/teams/${teamId}`);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setActionStatus({ type: "success", text: `Team "${teamName}" deleted.` });
      const newStats = await apiClient.get("/api/admin/stats");
      setStats(newStats);
    } catch (err) {
      setActionStatus({ type: "error", text: err.message || "Failed to delete team." });
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE_URL}/api/admin/export/csv`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!res.ok) throw new Error("Failed to export CSV");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "codeshield2026_teams.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setActionStatus({ type: "error", text: err.message || "CSV download failed." });
    }
  };

  return (
    <div className="w-full min-h-screen bg-base text-content font-mono">
      {/* Admin Header */}
      <section className="w-full border-b border-hairline px-6 sm:px-10 lg:px-12 py-10 bg-panel/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-semibold text-cyan uppercase mb-2">
              // CONTROL CENTER &middot; FULL ACCESS
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-content">
              Admin Operations
            </h1>
            <p className="text-xs text-muted mt-1">
              Hackathon attendance management, team confirmations, judging oversight, and data export.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2 text-xs font-semibold text-content border border-hairline bg-panel hover:border-cyan/50 transition-colors flex items-center gap-2"
            >
              <span>\u2193</span>
              <span>Export Teams CSV</span>
            </button>
            <div className="border border-hairline bg-panel px-3.5 py-2 text-xs text-subtle">
              ADMIN: <strong className="text-cyan">{user?.name || user?.email}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Banner */}
      <section className="w-full border-b border-hairline bg-panel/20 px-6 sm:px-10 lg:px-12 py-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 border border-hairline bg-panel/40">
            <div className="text-[10px] text-subtle uppercase mb-1">// TOTAL TEAMS</div>
            <div className="text-2xl font-bold text-content">{stats?.total_teams ?? teams.length}</div>
          </div>

          <div className="p-4 border border-hairline bg-panel/40">
            <div className="text-[10px] text-cyan uppercase mb-1">// CONFIRMED</div>
            <div className="text-2xl font-bold text-cyan">{stats?.confirmed_teams ?? "-"}</div>
          </div>

          <div className="p-4 border border-hairline bg-panel/40">
            <div className="text-[10px] text-amber uppercase mb-1">// UNCONFIRMED</div>
            <div className="text-2xl font-bold text-amber">{stats?.unconfirmed_teams ?? "-"}</div>
          </div>

          <div className="p-4 border border-hairline bg-panel/40">
            <div className="text-[10px] text-subtle uppercase mb-1">// SUBMISSIONS</div>
            <div className="text-2xl font-bold text-content">{stats?.total_submissions ?? submissions.length}</div>
          </div>

          <div className="p-4 border border-hairline bg-panel/40">
            <div className="text-[10px] text-subtle uppercase mb-1">// DAY 1 ATTENDANCE</div>
            <div className="text-2xl font-bold text-content">{stats?.day1_attendance ?? "-"}</div>
          </div>

          <div className="p-4 border border-hairline bg-panel/40">
            <div className="text-[10px] text-subtle uppercase mb-1">// DAY 2 ATTENDANCE</div>
            <div className="text-2xl font-bold text-content">{stats?.day2_attendance ?? "-"}</div>
          </div>
        </div>
      </section>

      {/* Action Notification */}
      {actionStatus && (
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 pt-6">
          <div
            role="alert"
            className={`p-3.5 text-xs border flex items-center justify-between ${
              actionStatus.type === "success"
                ? "border-cyan/50 bg-cyan/10 text-cyan"
                : "border-amber/50 bg-amber/10 text-amber"
            }`}
          >
            <span>{actionStatus.text}</span>
            <button
              type="button"
              onClick={() => setActionStatus(null)}
              className="text-xs hover:underline"
            >
              [dismiss]
            </button>
          </div>
        </div>
      )}

      {/* Main Tabs and Content */}
      <section className="w-full px-6 sm:px-10 lg:px-12 py-8 max-w-7xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-6 border-b border-hairline pb-4 mb-6 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("teams")}
            className={`transition-colors ${
              activeTab === "teams"
                ? "text-cyan font-bold border-b-2 border-cyan pb-1"
                : "text-muted hover:text-content"
            }`}
          >
            [TEAMS &amp; ATTENDANCE ({teams.length})]
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("submissions")}
            className={`transition-colors ${
              activeTab === "submissions"
                ? "text-cyan font-bold border-b-2 border-cyan pb-1"
                : "text-muted hover:text-content"
            }`}
          >
            [PROJECT DELIVERABLES ({submissions.length})]
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("scores")}
            className={`transition-colors ${
              activeTab === "scores"
                ? "text-cyan font-bold border-b-2 border-cyan pb-1"
                : "text-muted hover:text-content"
            }`}
          >
            [LEADERBOARD &amp; SCORING ({scores.length})]
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-muted">
            <div className="inline-flex items-center gap-3">
              <div className="w-3 h-3 border-2 border-cyan border-t-transparent animate-spin" />
              <span>FETCHING DATABASE RECORDS...</span>
            </div>
          </div>
        ) : activeTab === "teams" ? (
          /* TAB 1: TEAMS MANAGEMENT */
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-subtle">FILTER:</span>
                {["all", "confirmed", "unconfirmed"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTeamFilter(f)}
                    className={`uppercase px-2.5 py-1 border text-[11px] ${
                      teamFilter === f
                        ? "border-cyan bg-cyan/10 text-cyan font-semibold"
                        : "border-hairline text-muted hover:text-content"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team, leader, ID..."
                  className="w-full px-3 py-1.5 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan placeholder-subtle"
                />
              </div>
            </div>

            {/* Teams List Table */}
            <div className="border border-hairline divide-y divide-hairline bg-panel/30 overflow-x-auto">
              <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-panel/70 text-[11px] font-semibold text-subtle uppercase">
                <div className="col-span-2">Code &amp; Name</div>
                <div className="col-span-3">Leader Contact</div>
                <div className="col-span-2">Dept / Year</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-center">Attendance</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {filteredTeams.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">No teams match criteria.</div>
              ) : (
                filteredTeams.map((t) => {
                  const isExpanded = expandedTeamId === t.id;
                  return (
                    <div key={t.id} className="transition-colors hover:bg-panel/50">
                      <div className="grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs">
                        <div className="col-span-2">
                          <div className="font-bold text-cyan">{t.team_code}</div>
                          <div className="text-content font-medium truncate">{t.team_name}</div>
                        </div>

                        <div className="col-span-3">
                          <div className="text-content">{t.leader_name}</div>
                          <div className="text-[11px] text-muted truncate">{t.leader_email}</div>
                          <div className="text-[10px] text-subtle">{t.leader_phone}</div>
                        </div>

                        <div className="col-span-2 text-muted">
                          <div>{t.leader_department || "General"}</div>
                          <div className="text-[11px] text-subtle">Year: {t.leader_year} | ID: {t.leader_college_id}</div>
                        </div>

                        <div className="col-span-2 text-center">
                          {t.confirmed ? (
                            <span className="px-2 py-0.5 text-[10px] bg-cyan/20 text-cyan font-semibold">
                              CONFIRMED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] bg-amber/20 text-amber font-semibold">
                              PENDING EMAIL
                            </span>
                          )}
                        </div>

                        <div className="col-span-2 flex items-center justify-center gap-3">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(t.attendance_day1)}
                              onChange={() => handleToggleAttendance(t.id, "attendance_day1", t.attendance_day1)}
                              className="accent-cyan cursor-pointer"
                            />
                            <span className="text-[10px] text-muted">D1</span>
                          </label>

                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(t.attendance_day2)}
                              onChange={() => handleToggleAttendance(t.id, "attendance_day2", t.attendance_day2)}
                              className="accent-cyan cursor-pointer"
                            />
                            <span className="text-[10px] text-muted">D2</span>
                          </label>
                        </div>

                        <div className="col-span-1 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedTeamId(isExpanded ? null : t.id)}
                            className="text-cyan text-xs hover:underline"
                            title="Toggle Details"
                          >
                            {isExpanded ? "[-]" : "[+]"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(t.id, t.team_name)}
                            className="text-amber text-xs hover:underline"
                            title="Delete Team"
                          >
                            [del]
                          </button>
                        </div>
                      </div>

                      {/* Expanded Team Members View */}
                      {isExpanded && (
                        <div className="px-6 py-4 bg-panel/80 border-t border-hairline/60 text-xs text-muted space-y-2">
                          <div className="font-semibold text-content uppercase text-[11px] mb-2">
                            // REGISTERED MEMBERS ({t.team_size} TOTAL)
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {t.member2_name && (
                              <div className="p-2 border border-hairline bg-base">
                                <div className="text-content font-medium">{t.member2_name}</div>
                                <div className="text-subtle text-[11px]">ID: {t.member2_college_id || "N/A"}</div>
                              </div>
                            )}
                            {t.member3_name && (
                              <div className="p-2 border border-hairline bg-base">
                                <div className="text-content font-medium">{t.member3_name}</div>
                                <div className="text-subtle text-[11px]">ID: {t.member3_college_id || "N/A"}</div>
                              </div>
                            )}
                            {t.member4_name && (
                              <div className="p-2 border border-hairline bg-base">
                                <div className="text-content font-medium">{t.member4_name}</div>
                                <div className="text-subtle text-[11px]">ID: {t.member4_college_id || "N/A"}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : activeTab === "submissions" ? (
          /* TAB 2: SUBMISSIONS */
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted border border-hairline bg-panel/30">
                No team deliverables submitted yet.
              </div>
            ) : (
              submissions.map((sub) => (
                <div key={sub.id} className="p-5 border border-hairline bg-panel/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline/40 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 text-xs font-bold text-zinc-950 bg-cyan">
                        {sub.team_code}
                      </span>
                      <span className="font-bold text-content">{sub.team_name}</span>
                    </div>
                    <span className="text-subtle text-xs">
                      Submitted: {new Date(sub.submitted_at).toLocaleString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-content">{sub.idea_title}</h3>
                  <p className="text-xs text-muted leading-relaxed">{sub.idea_description}</p>

                  <div className="flex flex-wrap items-center gap-6 pt-2 text-xs">
                    {sub.repo_url && (
                      <a
                        href={sub.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan hover:underline"
                      >
                        &rarr; Git Repository: {sub.repo_url}
                      </a>
                    )}
                    {sub.deck_file_url && (
                      <a
                        href={sub.deck_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan hover:underline"
                      >
                        &rarr; Pitch Deck URL
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* TAB 3: LEADERBOARD & SCORING */
          <div className="space-y-6">
            <div className="border border-hairline bg-panel/30 divide-y divide-hairline">
              <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-panel/70 text-[11px] font-semibold text-subtle uppercase">
                <div className="col-span-1">Rank</div>
                <div className="col-span-3">Team</div>
                <div className="col-span-2 text-center">Evaluations</div>
                <div className="col-span-3 text-center">Avg Score (/40)</div>
                <div className="col-span-3 text-right">Total Aggregate</div>
              </div>

              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">No scores submitted yet.</div>
              ) : (
                leaderboard.map((item, idx) => (
                  <div key={item.team_id} className="grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs">
                    <div className="col-span-1 font-bold text-cyan">#{idx + 1}</div>
                    <div className="col-span-3">
                      <div className="font-bold text-content">{item.team_name}</div>
                      <div className="text-[11px] text-muted">{item.team_code}</div>
                    </div>
                    <div className="col-span-2 text-center text-content font-medium">
                      {item.evaluations} Judge(s)
                    </div>
                    <div className="col-span-3 text-center font-semibold text-cyan">
                      {item.avg_score} / 40
                    </div>
                    <div className="col-span-3 text-right font-bold text-content text-sm">
                      {item.total_score} PTS
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
