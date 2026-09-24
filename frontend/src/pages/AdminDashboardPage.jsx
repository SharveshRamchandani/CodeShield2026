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
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'teams' | 'problem_statements' | 'users' | 'submissions' | 'scores' | 'exports'
  
  // Team Filters & Modal State
  const [teamFilter, setTeamFilter] = useState("all"); // 'all' | 'confirmed' | 'unconfirmed'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeamForDetails, setSelectedTeamForDetails] = useState(null);
  
  // Problem Statement Filters & State
  const [problemStatements, setProblemStatements] = useState([]);
  const [psSearchQuery, setPsSearchQuery] = useState("");
  const [psDomainFilter, setPsDomainFilter] = useState(""); // "" means category cards overview first
  const [psSortBy, setPsSortBy] = useState("code_asc"); // 'code_asc' | 'code_desc' | 'domain_asc' | 'title_asc' | 'teams_desc'
  const [psPage, setPsPage] = useState(1);
  const [psPerPage, setPsPerPage] = useState(10);
  const [isAddPsModalOpen, setIsAddPsModalOpen] = useState(false);
  const [editingPs, setEditingPs] = useState(null);
  const [deletingPs, setDeletingPs] = useState(null);
  const [psForm, setPsForm] = useState({
    code: "",
    title: "",
    description: "",
    domain: "Cybersecurity",
    customDomain: "",
  });
  const [savingPs, setSavingPs] = useState(false);
  const [deletingPsLoading, setDeletingPsLoading] = useState(false);

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
  const [submissionWindow, setSubmissionWindow] = useState({ opens_at: "", closes_at: "" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingEmailTeamId, setSendingEmailTeamId] = useState(null);
  const [sendingAllEmails, setSendingAllEmails] = useState(false);
  const [lockingSubId, setLockingSubId] = useState(null);

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
      const [statsData, teamsData, subsData, scoresData, usersData, settingsData, psData] = await Promise.all([
        apiClient.get("/api/admin/stats").catch(() => null),
        apiClient.get("/api/admin/teams").catch(() => []),
        apiClient.get("/api/submissions/").catch(() => []),
        apiClient.get("/api/scores/").catch(() => []),
        apiClient.get("/api/admin/users").catch(() => []),
        apiClient.get("/api/admin/settings").catch(() => null),
        apiClient.get("/api/admin/problem-statements").catch(() => []),
      ]);
      setStats(statsData);
      setTeams(teamsData || []);
      setSubmissions(subsData || []);
      setScores(scoresData || []);
      setUsersList(usersData || []);
      setProblemStatements(psData || []);

      if (settingsData?.submission_window) {
        setSubmissionWindow({
          opens_at: settingsData.submission_window.opens_at ? settingsData.submission_window.opens_at.slice(0, 16) : "",
          closes_at: settingsData.submission_window.closes_at ? settingsData.submission_window.closes_at.slice(0, 16) : "",
        });
      }
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

  // Distinct Domains for Filters & Forms
  const psDomainsList = useMemo(() => {
    const list = Array.from(new Set(problemStatements.map((ps) => ps.domain).filter(Boolean)));
    if (!list.includes("Cybersecurity")) list.unshift("Cybersecurity");
    if (!list.includes("Innovation & Emerging Technologies")) list.push("Innovation & Emerging Technologies");
    return list;
  }, [problemStatements]);

  // Filtered & Sorted Problem Statements List
  const filteredAndSortedProblemStatements = useMemo(() => {
    let list = problemStatements.filter((ps) => {
      if (psDomainFilter && psDomainFilter !== "all" && ps.domain !== psDomainFilter) return false;
      const q = psSearchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        ps.code?.toLowerCase().includes(q) ||
        ps.title?.toLowerCase().includes(q) ||
        ps.description?.toLowerCase().includes(q) ||
        ps.domain?.toLowerCase().includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      if (psSortBy === "code_asc") {
        return (a.code || "").localeCompare(b.code || "", undefined, { numeric: true, sensitivity: "base" });
      }
      if (psSortBy === "code_desc") {
        return (b.code || "").localeCompare(a.code || "", undefined, { numeric: true, sensitivity: "base" });
      }
      if (psSortBy === "domain_asc") {
        const domainCmp = (a.domain || "").localeCompare(b.domain || "");
        if (domainCmp !== 0) return domainCmp;
        return (a.code || "").localeCompare(b.code || "", undefined, { numeric: true, sensitivity: "base" });
      }
      if (psSortBy === "title_asc") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (psSortBy === "teams_desc") {
        return (b.team_count || 0) - (a.team_count || 0);
      }
      if (psSortBy === "teams_asc") {
        return (a.team_count || 0) - (b.team_count || 0);
      }
      return 0;
    });

    return list;
  }, [problemStatements, psDomainFilter, psSearchQuery, psSortBy]);

  // Paginated list
  const psTotalPages = Math.max(1, Math.ceil(filteredAndSortedProblemStatements.length / (psPerPage || 10)));
  const paginatedProblemStatements = useMemo(() => {
    if (psPerPage === 0) return filteredAndSortedProblemStatements;
    const start = (psPage - 1) * psPerPage;
    return filteredAndSortedProblemStatements.slice(start, start + psPerPage);
  }, [filteredAndSortedProblemStatements, psPage, psPerPage]);

  const hasActivePsSelection = Boolean(psDomainFilter || psSearchQuery.trim());

  // ==========================================
  // Action Handlers
  // ==========================================

  // Problem Statement Handlers
  const handleOpenAddPsModal = () => {
    setPsForm({
      code: "",
      title: "",
      description: "",
      domain: psDomainFilter && psDomainFilter !== "all" ? psDomainFilter : "Cybersecurity",
      customDomain: "",
    });
    setEditingPs(null);
    setIsAddPsModalOpen(true);
  };

  const handleOpenEditPsModal = (ps) => {
    const isStandardOrKnown = psDomainsList.includes(ps.domain);
    setPsForm({
      code: ps.code,
      title: ps.title,
      description: ps.description,
      domain: isStandardOrKnown ? ps.domain : "Custom",
      customDomain: isStandardOrKnown ? "" : ps.domain,
    });
    setEditingPs(ps);
    setIsAddPsModalOpen(true);
  };

  const handleSaveProblemStatement = async (e) => {
    e.preventDefault();
    let finalDomain = "";
    if (psForm.domain === "Custom") {
      finalDomain = psForm.customDomain.trim();
    } else if (psForm.domain) {
      finalDomain = psForm.domain.trim();
    }
    
    if (!finalDomain && psForm.customDomain) {
      finalDomain = psForm.customDomain.trim();
    }

    if (!psForm.code.trim() || !psForm.title.trim() || !psForm.description.trim() || !finalDomain) {
      setActionStatus({ type: "error", text: "Please complete Code, Title, Description, and Category Name." });
      return;
    }

    setSavingPs(true);
    const payload = {
      code: psForm.code.trim().toUpperCase(),
      title: psForm.title.trim(),
      description: psForm.description.trim(),
      domain: finalDomain,
    };

    try {
      if (editingPs) {
        const updated = await apiClient.put(`/api/admin/problem-statements/${editingPs.id}`, payload);
        setProblemStatements((prev) =>
          prev.map((item) => (item.id === editingPs.id ? { ...item, ...updated } : item))
        );
        setActionStatus({
          type: "success",
          text: `Problem statement '${updated.code} - ${updated.title}' updated under track [${updated.domain}].`,
        });
      } else {
        const created = await apiClient.post("/api/admin/problem-statements", payload);
        setProblemStatements((prev) => [...prev, { ...created, team_count: 0 }]);
        setActionStatus({
          type: "success",
          text: `Problem statement '${created.code} - ${created.title}' added to track [${created.domain}] successfully.`,
        });
      }
      setIsAddPsModalOpen(false);
      setEditingPs(null);
      // Auto-filter to the new/updated domain so it's immediately visible
      setPsDomainFilter(finalDomain);
      setPsPage(1);
      apiClient.get("/api/admin/problem-statements").then((data) => data && setProblemStatements(data)).catch(() => {});
    } catch (err) {
      setActionStatus({
        type: "error",
        text: err?.message || "Failed to save problem statement.",
      });
    } finally {
      setSavingPs(false);
    }
  };

  const handleConfirmDeletePs = async () => {
    if (!deletingPs) return;
    setDeletingPsLoading(true);
    try {
      await apiClient.delete(`/api/admin/problem-statements/${deletingPs.id}`);
      setProblemStatements((prev) => prev.filter((item) => item.id !== deletingPs.id));
      setActionStatus({
        type: "success",
        text: `Problem statement '${deletingPs.code} - ${deletingPs.title}' removed from database.`,
      });
      setDeletingPs(null);
      apiClient.get("/api/admin/teams").then((data) => data && setTeams(data)).catch(() => {});
    } catch (err) {
      setActionStatus({
        type: "error",
        text: err?.message || "Failed to delete problem statement.",
      });
    } finally {
      setDeletingPsLoading(false);
    }
  };

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

  // Send Registration Details & Confirmation Email to Single Team
  const handleSendEmailToTeam = async (teamId, leaderEmail, teamName) => {
    setSendingEmailTeamId(teamId);
    try {
      const res = await apiClient.post(`/api/admin/teams/${teamId}/resend-confirmation`);
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, email_sent: true } : t))
      );
      if (selectedTeamForDetails && selectedTeamForDetails.id === teamId) {
        setSelectedTeamForDetails((prev) => ({ ...prev, email_sent: true }));
      }
      setActionStatus({
        type: "success",
        text: res?.message || `Registration email queued for team '${teamName}' (${leaderEmail}).`,
      });
    } catch (err) {
      setActionStatus({
        type: "error",
        text: err?.message || `Failed to send email to team '${teamName}'.`,
      });
    } finally {
      setSendingEmailTeamId(null);
    }
  };

  // Broadcast Confirmation / Details Email to All Registered Teams
  const handleSendEmailToAllTeams = async () => {
    if (!window.confirm(`Are you sure you want to send registration details and confirmation emails to all ${teams.length} registered teams?`)) {
      return;
    }

    setSendingAllEmails(true);
    try {
      const res = await apiClient.post("/api/admin/teams/send-all-confirmation");
      setTeams((prev) => prev.map((t) => ({ ...t, email_sent: true })));
      setActionStatus({
        type: "success",
        text: res?.message || `Registration emails queued for all ${teams.length} teams.`,
      });
    } catch (err) {
      setActionStatus({
        type: "error",
        text: err?.message || "Failed to broadcast emails to all teams.",
      });
    } finally {
      setSendingAllEmails(false);
    }
  };

  // Toggle Submission Lock for a Team
  const handleToggleSubmissionLock = async (submissionId, currentLockStatus, teamName) => {
    setLockingSubId(submissionId);
    try {
      const updated = await apiClient.patch(`/api/admin/submissions/${submissionId}/lock`, {
        is_locked: !currentLockStatus,
      });

      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, is_locked: updated.is_locked } : s))
      );

      setActionStatus({
        type: "success",
        text: `Deliverables for team '${teamName || updated.team_name}' are now ${updated.is_locked ? "LOCKED" : "UNLOCKED / REOPENED"}.`,
      });
    } catch (err) {
      setActionStatus({
        type: "error",
        text: err?.message || "Failed to update submission lock status.",
      });
    } finally {
      setLockingSubId(null);
    }
  };

  // Update Submission Window Settings Live
  const handleSaveSubmissionWindow = async (customClosesAt = undefined, customOpensAt = undefined) => {
    setSavingSettings(true);
    try {
      const opens = customOpensAt !== undefined ? customOpensAt : (submissionWindow.opens_at ? new Date(submissionWindow.opens_at).toISOString() : null);
      const closes = customClosesAt !== undefined ? customClosesAt : (submissionWindow.closes_at ? new Date(submissionWindow.closes_at).toISOString() : null);

      const res = await apiClient.patch("/api/admin/settings/submission-window", {
        opens_at: opens,
        closes_at: closes,
      });

      if (res?.submission_window) {
        setSubmissionWindow({
          opens_at: res.submission_window.opens_at ? res.submission_window.opens_at.slice(0, 16) : "",
          closes_at: res.submission_window.closes_at ? res.submission_window.closes_at.slice(0, 16) : "",
        });
      }

      setActionStatus({
        type: "success",
        text: "Submission window updated live. Changes take effect immediately.",
      });
    } catch (err) {
      setActionStatus({
        type: "error",
        text: err.message || "Failed to update submission window.",
      });
    } finally {
      setSavingSettings(false);
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
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? "Syncing..." : "Refresh Telemetry"}</span>
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
            { id: "problem_statements", label: `[03 // PROBLEM STATEMENTS (${problemStatements.length})]` },
            { id: "users", label: `[04 // USER & ROLE MGMT (${usersList.length})]` },
            { id: "submissions", label: `[05 // DELIVERABLES (${submissions.length})]` },
            { id: "scores", label: `[06 // LEADERBOARD (${leaderboard.length})]` },
            { id: "exports", label: "[07 // EXPORTS & LOAD BALANCER]" },
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
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
                <div className="text-[10px] text-muted uppercase">// PROBLEM STATEMENTS</div>
                <div className="text-2xl font-bold text-cyan mt-1">{problemStatements.length}</div>
                <div className="text-[10px] text-subtle mt-1">Active in DB</div>
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

            {/* Submission Window Controls Card */}
            <div className="border border-hairline bg-panel p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-hairline/60 pb-3">
                <div>
                  <div className="text-xs font-semibold text-cyan uppercase">// LIVE SUBMISSION DEADLINE & WINDOW CONTROLS</div>
                  <p className="text-[11px] text-muted mt-0.5">
                    Controls whether team leaders can submit or edit project deliverables. Changes apply live without server restarts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-subtle font-mono uppercase">Current Status:</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold border font-mono ${
                      submissionWindow.closes_at && new Date(submissionWindow.closes_at) <= new Date()
                        ? "border-amber bg-amber/10 text-amber"
                        : "border-emerald-500 bg-emerald-950/40 text-emerald-300"
                    }`}
                  >
                    {submissionWindow.closes_at && new Date(submissionWindow.closes_at) <= new Date()
                      ? "🔒 LOCKED (DEADLINE PASSED)"
                      : "⚡ OPEN FOR SUBMISSIONS"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-subtle uppercase block">
                    Opens At (Optional):
                  </label>
                  <input
                    type="datetime-local"
                    value={submissionWindow.opens_at}
                    onChange={(e) => setSubmissionWindow({ ...submissionWindow, opens_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-muted block">
                    {submissionWindow.opens_at
                      ? `IST: ${new Date(submissionWindow.opens_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
                      : "Open immediately when event starts"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-subtle uppercase block">
                    Closes At / Deadline:
                  </label>
                  <input
                    type="datetime-local"
                    value={submissionWindow.closes_at}
                    onChange={(e) => setSubmissionWindow({ ...submissionWindow, closes_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-muted block">
                    {submissionWindow.closes_at
                      ? `IST: ${new Date(submissionWindow.closes_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
                      : "No deadline set (Submissions stay open)"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-hairline/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={() => handleSaveSubmissionWindow(new Date(Date.now() - 1000).toISOString())}
                    className="px-3 py-1.5 text-xs font-bold text-amber border border-amber/50 bg-amber/10 hover:bg-amber/20 transition-colors disabled:opacity-50"
                  >
                    🔒 Lock Now
                  </button>

                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={() => handleSaveSubmissionWindow(null, null)}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/50 bg-emerald-950/30 hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
                  >
                    ⚡ Unlock / Open
                  </button>

                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={() => {
                      const baseTime = submissionWindow.closes_at ? new Date(submissionWindow.closes_at).getTime() : Date.now();
                      const extended = new Date(Math.max(baseTime, Date.now()) + 60 * 60 * 1000).toISOString();
                      handleSaveSubmissionWindow(extended);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-cyan border border-cyan/50 bg-cyan/10 hover:bg-cyan/20 transition-colors disabled:opacity-50"
                  >
                    +1 Hour Extension
                  </button>
                </div>

                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() => handleSaveSubmissionWindow()}
                  className="px-4 py-1.5 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors disabled:opacity-50"
                >
                  {savingSettings ? "Saving Settings..." : "Save Custom Window"}
                </button>
              </div>
            </div>
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

              <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={sendingAllEmails || teams.length === 0}
                  onClick={handleSendEmailToAllTeams}
                  className="px-3 py-1 text-xs font-bold text-cyan border border-cyan/50 bg-cyan/10 hover:bg-cyan/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  title="Broadcast registration details and confirmation email to all registered teams"
                >
                  <span>✉</span>
                  <span>{sendingAllEmails ? "Broadcasting..." : `Send Email to All (${teams.length})`}</span>
                </button>

                <span className="text-muted ml-1">Filter:</span>
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
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={sendingEmailTeamId === team.id}
                              onClick={() => handleSendEmailToTeam(team.id, team.leader_email, team.team_name)}
                              className={`px-2 py-1 text-[10px] font-mono border transition-colors flex items-center gap-1 ${
                                team.email_sent
                                  ? "border-cyan/50 bg-cyan/10 text-cyan hover:bg-cyan/20"
                                  : "border-hairline bg-base text-subtle hover:border-cyan/50 hover:text-cyan"
                              }`}
                              title={team.email_sent ? "Email sent. Click to resend registration details." : "Send registration details email"}
                            >
                              {sendingEmailTeamId === team.id ? (
                                "Sending..."
                              ) : (
                                <>
                                  <span>✉</span>
                                  <span>{team.email_sent ? "Resend" : "Send Email"}</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteTeam(team.id, team.team_name)}
                              className="px-2 py-1 text-[10px] text-rose-400 border border-rose-500/30 hover:bg-rose-950/40 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PROBLEM STATEMENTS MANAGEMENT */}
        {activeTab === "problem_statements" && (
          <div className="space-y-6">
            {/* Header banner */}
            <div className="p-4 border border-cyan/40 bg-cyan/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-cyan uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
                  // PROBLEM STATEMENTS CATALOG &amp; DATABASE SYNCHRONIZATION
                </div>
                <p className="text-[11px] text-muted mt-0.5">
                  Select a category track or search to manage problem statements. Real-time updates directly sync with PostgreSQL.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddPsModal}
                  className="px-3.5 py-1.5 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span className="text-sm leading-none">+</span> Add Problem Statement
                </button>
              </div>
            </div>

            {/* Category Selector Grid & Search Hub */}
            <div className="space-y-4">
              {/* Live Search Bar with Quick Action */}
              <div className="p-4 border border-hairline bg-panel flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-3 flex items-center text-cyan text-sm pointer-events-none font-mono">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={psSearchQuery}
                    onChange={(e) => {
                      setPsSearchQuery(e.target.value);
                      setPsPage(1);
                    }}
                    placeholder="Search by code (e.g. CS 01), title, or keyword..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-base border border-hairline text-content focus:border-cyan focus:outline-none font-mono"
                  />
                  {psSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setPsSearchQuery("");
                        setPsPage(1);
                      }}
                      className="absolute inset-y-0 right-2.5 flex items-center text-muted hover:text-content text-xs font-mono"
                    >
                      &times; Clear
                    </button>
                  )}
                </div>

                {hasActivePsSelection && (
                  <button
                    type="button"
                    onClick={() => {
                      setPsDomainFilter("");
                      setPsSearchQuery("");
                      setPsPage(1);
                    }}
                    className="px-3 py-2 text-xs border border-hairline bg-base hover:bg-panel text-muted hover:text-content transition-colors font-mono whitespace-nowrap"
                  >
                    Reset &amp; View Categories
                  </button>
                )}
              </div>

              {/* Category Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {psDomainsList.map((domain) => {
                  const count = problemStatements.filter((p) => p.domain === domain).length;
                  const totalTeamsInDomain = problemStatements
                    .filter((p) => p.domain === domain)
                    .reduce((acc, curr) => acc + (curr.team_count || 0), 0);
                  const isCyber = domain === "Cybersecurity";
                  const isTech = domain === "Innovation & Emerging Technologies";
                  const isSelected = psDomainFilter === domain;

                  return (
                    <div
                      key={domain}
                      onClick={() => {
                        setPsDomainFilter(isSelected ? "" : domain);
                        setPsPage(1);
                      }}
                      role="button"
                      tabIndex={0}
                      className={`p-4 border transition-all cursor-pointer text-left flex flex-col justify-between select-none ${
                        isSelected
                          ? isCyber
                            ? "border-cyan bg-cyan/10 ring-1 ring-cyan"
                            : isTech
                            ? "border-purple-400 bg-purple-950/40 ring-1 ring-purple-400"
                            : "border-amber bg-amber/10 ring-1 ring-amber"
                          : "border-hairline bg-panel hover:border-hairline/80 hover:bg-panel/70"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 border ${
                              isCyber
                                ? "border-cyan/50 text-cyan bg-cyan/10"
                                : isTech
                                ? "border-purple-400/50 text-purple-300 bg-purple-950/40"
                                : "border-amber/50 text-amber bg-amber/10"
                            }`}
                          >
                            {isCyber ? "🛡️ CYBER TRACK" : isTech ? "⚡ TECH TRACK" : "🔮 CUSTOM TRACK"}
                          </span>
                          <span className="text-xs font-mono font-bold text-content">
                            {count} Statement{count === 1 ? "" : "s"}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-content mt-1">
                          {domain === "Innovation & Emerging Technologies" ? "Innovation & Emerging Tech" : domain}
                        </h3>
                        <p className="text-[11px] text-muted">
                          {totalTeamsInDomain} team{totalTeamsInDomain === 1 ? "" : "s"} assigned across this track.
                        </p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-hairline/50 flex items-center justify-between text-xs font-mono">
                        <span className={isSelected ? (isCyber ? "text-cyan font-bold" : isTech ? "text-purple-300 font-bold" : "text-amber font-bold") : "text-subtle"}>
                          {isSelected ? "● Category Active" : "Click to view track"}
                        </span>
                        <span className={isCyber ? "text-cyan" : isTech ? "text-purple-400" : "text-amber"}>
                          {isSelected ? "[ Hide ]" : "[ Browse → ]"}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* View All Card */}
                <div
                  onClick={() => {
                    setPsDomainFilter(psDomainFilter === "all" ? "" : "all");
                    setPsPage(1);
                  }}
                  role="button"
                  tabIndex={0}
                  className={`p-4 border transition-all cursor-pointer text-left flex flex-col justify-between select-none ${
                    psDomainFilter === "all"
                      ? "border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500"
                      : "border-hairline bg-panel hover:border-hairline/80 hover:bg-panel/70"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 border border-emerald-500/50 text-emerald-400 bg-emerald-950/30">
                        🌐 ALL CATEGORIES
                      </span>
                      <span className="text-xs font-mono font-bold text-content">
                        {problemStatements.length} Total
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-content mt-1">
                      Complete Catalog Overview
                    </h3>
                    <p className="text-[11px] text-muted">
                      Inspect all challenge statements across every domain simultaneously.
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-hairline/50 flex items-center justify-between text-xs font-mono">
                    <span className={psDomainFilter === "all" ? "text-emerald-400 font-bold" : "text-subtle"}>
                      {psDomainFilter === "all" ? "● All Tracks Active" : "Click to view all"}
                    </span>
                    <span className="text-emerald-400">{psDomainFilter === "all" ? "[ Hide ]" : "[ View All → ]"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ONLY SHOW PROBLEM STATEMENTS WHEN A CATEGORY IS CHOSEN OR A SEARCH QUERY IS ENTERED */}
            {hasActivePsSelection ? (
              <div className="space-y-4 animate-fadeIn">
                {/* Secondary Filter & Sort Control Bar */}
                <div className="p-3 border border-hairline bg-panel flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted font-mono uppercase text-[11px]">Active Filter:</span>
                    {psDomainFilter && (
                      <span className="px-2 py-0.5 border border-cyan/50 bg-cyan/10 text-cyan text-xs font-mono flex items-center gap-1.5">
                        <span>Track: {psDomainFilter === "all" ? "All Tracks" : psDomainFilter}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPsDomainFilter("");
                            setPsPage(1);
                          }}
                          className="hover:text-white"
                        >
                          &times;
                        </button>
                      </span>
                    )}
                    {psSearchQuery && (
                      <span className="px-2 py-0.5 border border-amber/50 bg-amber/10 text-amber text-xs font-mono flex items-center gap-1.5">
                        <span>Keyword: "{psSearchQuery}"</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPsSearchQuery("");
                            setPsPage(1);
                          }}
                          className="hover:text-white"
                        >
                          &times;
                        </button>
                      </span>
                    )}
                    <span className="text-subtle text-[11px]">
                      ({filteredAndSortedProblemStatements.length} matched)
                    </span>
                  </div>

                  {/* Sorting & Page Size Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted font-mono text-[11px]">Sort By:</span>
                      <select
                        value={psSortBy}
                        onChange={(e) => {
                          setPsSortBy(e.target.value);
                          setPsPage(1);
                        }}
                        className="px-2 py-1 text-xs bg-base border border-hairline text-content focus:border-cyan focus:outline-none font-mono"
                      >
                        <option value="code_asc">Code (Ascending A-Z)</option>
                        <option value="code_desc">Code (Descending Z-A)</option>
                        <option value="domain_asc">Category / Track (A-Z)</option>
                        <option value="title_asc">Title (A-Z)</option>
                        <option value="teams_desc">Most Teams Assigned</option>
                        <option value="teams_asc">Least Teams Assigned</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-muted font-mono text-[11px]">Per Page:</span>
                      <select
                        value={psPerPage}
                        onChange={(e) => {
                          setPsPerPage(Number(e.target.value));
                          setPsPage(1);
                        }}
                        className="px-2 py-1 text-xs bg-base border border-hairline text-content focus:border-cyan focus:outline-none font-mono"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={0}>Show All</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Problem Statements Table */}
                <div className="border border-hairline bg-panel overflow-x-auto shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-hairline bg-base/60 text-muted uppercase text-[10px]">
                        <th className="p-3 w-28">Code</th>
                        <th className="p-3 w-48">Category / Track</th>
                        <th className="p-3">Problem Title &amp; Brief</th>
                        <th className="p-3 text-center w-32">Assigned Teams</th>
                        <th className="p-3 text-right w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline font-mono">
                      {paginatedProblemStatements.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted font-mono">
                            No problem statements match your filter / search keyword.
                          </td>
                        </tr>
                      ) : (
                        paginatedProblemStatements.map((ps) => {
                          const isCyber = ps.domain === "Cybersecurity";
                          return (
                            <tr key={ps.id || ps.code} className="hover:bg-panel/50 transition-colors">
                              <td className="p-3 align-top font-bold">
                                <span
                                  className={`px-2 py-0.5 border text-xs ${
                                    isCyber
                                      ? "border-cyan/50 text-cyan bg-cyan/10"
                                      : "border-purple-500/50 text-purple-400 bg-purple-950/30"
                                  }`}
                                >
                                  {ps.code}
                                </span>
                              </td>

                              <td className="p-3 align-top">
                                <span className="text-[11px] text-muted block font-mono">
                                  {ps.domain}
                                </span>
                              </td>

                              <td className="p-3 align-top space-y-1">
                                <div className="font-bold text-content text-sm">{ps.title}</div>
                                <p className="text-xs text-muted leading-relaxed font-sans line-clamp-3">
                                  {ps.description}
                                </p>
                              </td>

                              <td className="p-3 align-top text-center">
                                <span
                                  className={`px-2 py-0.5 text-[11px] font-mono border ${
                                    (ps.team_count || 0) > 0
                                      ? "border-emerald-500/50 text-emerald-400 bg-emerald-950/30"
                                      : "border-hairline text-subtle"
                                  }`}
                                >
                                  {ps.team_count || 0} teams
                                </span>
                              </td>

                              <td className="p-3 align-top text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditPsModal(ps)}
                                    className="px-2.5 py-1 text-[11px] font-mono border border-cyan/40 bg-cyan/5 text-cyan hover:bg-cyan/20 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingPs(ps)}
                                    className="px-2.5 py-1 text-[11px] font-mono border border-rose-500/40 bg-rose-950/20 text-rose-400 hover:bg-rose-950/50 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls Footer */}
                {psPerPage > 0 && filteredAndSortedProblemStatements.length > psPerPage && (
                  <div className="p-3 border border-hairline bg-panel flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                    <div className="text-muted">
                      Showing{" "}
                      <strong className="text-content">{(psPage - 1) * psPerPage + 1}</strong> to{" "}
                      <strong className="text-content">
                        {Math.min(psPage * psPerPage, filteredAndSortedProblemStatements.length)}
                      </strong>{" "}
                      of <strong className="text-content">{filteredAndSortedProblemStatements.length}</strong> statements
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={psPage <= 1}
                        onClick={() => setPsPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 border border-hairline bg-base hover:bg-panel disabled:opacity-40 transition-colors text-content"
                      >
                        &larr; Previous
                      </button>

                      <span className="px-2 py-1 text-muted">
                        Page <strong className="text-cyan">{psPage}</strong> of {psTotalPages}
                      </span>

                      <button
                        type="button"
                        disabled={psPage >= psTotalPages}
                        onClick={() => setPsPage((p) => Math.min(psTotalPages, p + 1))}
                        className="px-3 py-1 border border-hairline bg-base hover:bg-panel disabled:opacity-40 transition-colors text-content"
                      >
                        Next &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Prompt when no category or search is active */
              <div className="p-8 border border-dashed border-hairline bg-panel/40 text-center space-y-3">
                <div className="text-2xl">📂</div>
                <div className="text-sm font-bold text-content font-mono">
                  Select a Category Track or Search to View Problem Statements
                </div>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Click on one of the track cards above or enter a keyword in the search bar to reveal and manage problem statements.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPsDomainFilter("all");
                      setPsPage(1);
                    }}
                    className="px-4 py-2 text-xs font-bold text-cyan border border-cyan/50 bg-cyan/10 hover:bg-cyan/20 transition-colors font-mono"
                  >
                    ⚡ View All Problem Statements ({problemStatements.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: USER & ROLE MANAGEMENT (INSTANT PROMOTE / DEMOTE & DIRECT USER ADDITION) */}
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
                    <th className="p-3">Project Title &amp; Description</th>
                    <th className="p-3">GitHub Repository</th>
                    <th className="p-3">Slide Deck / Demo</th>
                    <th className="p-3 text-center">Lock Status</th>
                    <th className="p-3">Submitted At</th>
                    <th className="p-3 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline/60">
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        No team deliverables submitted yet.
                      </td>
                    </tr>
                  ) : (
                    submissions.map((sub) => {
                      const isLocking = lockingSubId === sub.id;
                      return (
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

                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold border inline-block ${
                                sub.is_locked
                                  ? "border-rose-500/50 text-rose-400 bg-rose-950/20"
                                  : "border-emerald-500/50 text-emerald-400 bg-emerald-950/20"
                              }`}
                            >
                              {sub.is_locked ? "🔒 LOCKED" : "🔓 OPEN"}
                            </span>
                          </td>

                          <td className="p-3 text-muted font-mono text-[10px]">
                            {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "-"}
                          </td>

                          <td className="p-3 text-right">
                            <button
                              type="button"
                              disabled={isLocking}
                              onClick={() => handleToggleSubmissionLock(sub.id, sub.is_locked, sub.team_name)}
                              className={`px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
                                sub.is_locked
                                  ? "text-emerald-400 border border-emerald-500/60 hover:bg-emerald-950/30"
                                  : "text-rose-400 border border-rose-500/60 hover:bg-rose-950/30"
                              }`}
                            >
                              {isLocking ? (
                                "Updating..."
                              ) : sub.is_locked ? (
                                "🔓 Unlock / Re-open"
                              ) : (
                                "🔒 Lock Submission"
                              )}
                            </button>
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

      {/* ADD / EDIT PROBLEM STATEMENT MODAL */}
      {isAddPsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-panel border border-cyan/40 w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-hairline pb-3">
              <div>
                <div className="text-xs font-bold text-cyan uppercase">
                  // {editingPs ? `EDIT STATEMENT [${editingPs.code}]` : "ADD PROBLEM STATEMENT"}
                </div>
                <h2 className="text-xl font-bold text-content mt-1">
                  {editingPs ? `Edit Problem Statement` : "New Problem Statement"}
                </h2>
                <p className="text-[11px] text-muted mt-0.5">
                  Directly saved to the PostgreSQL database and immediately available for team selection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddPsModalOpen(false);
                  setEditingPs(null);
                }}
                className="text-muted hover:text-content text-xl font-bold px-2 py-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveProblemStatement} className="space-y-4 text-xs font-mono">
              {/* Category Track Selector Buttons */}
              <div className="space-y-2">
                <label className="text-[11px] uppercase text-subtle font-semibold block">
                  1. Assign Category Track
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPsForm({ ...psForm, domain: "Cybersecurity", customDomain: "" })}
                    className={`p-2.5 border text-left font-bold text-xs transition-all flex flex-col justify-between ${
                      psForm.domain === "Cybersecurity"
                        ? "border-cyan bg-cyan/15 text-cyan ring-1 ring-cyan"
                        : "border-hairline bg-base text-muted hover:text-content hover:border-hairline/80"
                    }`}
                  >
                    <span>🛡️ Cybersecurity</span>
                    <span className="text-[10px] font-normal text-subtle mt-0.5">Standard Track</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPsForm({ ...psForm, domain: "Innovation & Emerging Technologies", customDomain: "" })}
                    className={`p-2.5 border text-left font-bold text-xs transition-all flex flex-col justify-between ${
                      psForm.domain === "Innovation & Emerging Technologies"
                        ? "border-purple-400 bg-purple-950/40 text-purple-300 ring-1 ring-purple-400"
                        : "border-hairline bg-base text-muted hover:text-content hover:border-hairline/80"
                    }`}
                  >
                    <span>⚡ Innovation &amp; Tech</span>
                    <span className="text-[10px] font-normal text-subtle mt-0.5">Emerging Track</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPsForm({ ...psForm, domain: "Custom" })}
                    className={`p-2.5 border text-left font-bold text-xs transition-all flex flex-col justify-between ${
                      psForm.domain === "Custom" || (!["Cybersecurity", "Innovation & Emerging Technologies"].includes(psForm.domain))
                        ? "border-amber bg-amber/15 text-amber ring-1 ring-amber"
                        : "border-hairline bg-base text-muted hover:text-content hover:border-hairline/80"
                    }`}
                  >
                    <span>🔮 Custom Track</span>
                    <span className="text-[10px] font-normal text-subtle mt-0.5">+ Define Category</span>
                  </button>
                </div>
              </div>

              {/* If other custom tracks exist in DB, show quick-select chips */}
              {psDomainsList.filter(d => !["Cybersecurity", "Innovation & Emerging Technologies"].includes(d)).length > 0 && (
                <div className="space-y-1.5 p-2.5 border border-hairline/80 bg-base/50 text-[11px]">
                  <span className="text-subtle uppercase text-[10px] font-semibold block">
                    Existing Custom Tracks in Database:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {psDomainsList.filter(d => !["Cybersecurity", "Innovation & Emerging Technologies"].includes(d)).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPsForm({ ...psForm, domain: d, customDomain: "" })}
                        className={`px-2.5 py-1 border text-xs font-mono transition-colors ${
                          psForm.domain === d
                            ? "border-amber bg-amber/20 text-amber font-bold"
                            : "border-hairline bg-panel text-muted hover:text-content"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* If Custom Track selected or custom name needed */}
              {(psForm.domain === "Custom" || (!["Cybersecurity", "Innovation & Emerging Technologies"].includes(psForm.domain) && !psDomainsList.includes(psForm.domain))) && (
                <div className="space-y-1.5 p-3 border border-amber/50 bg-amber/5 animate-fadeIn">
                  <label className="text-[11px] uppercase text-amber font-semibold block flex items-center gap-1.5">
                    <span>🔮 Custom Track / Category Name:</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={psForm.customDomain}
                    onChange={(e) => setPsForm({ ...psForm, customDomain: e.target.value })}
                    placeholder="e.g. AI & Machine Learning, Blockchain, Cloud Security..."
                    className="w-full px-3 py-2 bg-base border border-amber/60 text-content focus:border-amber focus:outline-none font-bold"
                  />
                  <span className="text-[10px] text-muted block">
                    * This creates a dedicated category card in Admin and a new track tab on the Problem Statements page.
                  </span>
                </div>
              )}

              {/* Problem Code Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase text-subtle font-semibold block">
                  2. Problem Code (e.g. CS 19, IT 15, AI 01)
                </label>
                <input
                  type="text"
                  required
                  value={psForm.code}
                  onChange={(e) => setPsForm({ ...psForm, code: e.target.value })}
                  placeholder="e.g. AI 01, CS 19, IT 15"
                  className="w-full px-3 py-2 bg-base border border-hairline text-content focus:border-cyan focus:outline-none font-bold uppercase font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase text-subtle font-semibold block">
                  Problem Title
                </label>
                <input
                  type="text"
                  required
                  value={psForm.title}
                  onChange={(e) => setPsForm({ ...psForm, title: e.target.value })}
                  placeholder="e.g. AI-Powered Zero Trust Gateway"
                  className="w-full px-3 py-2 bg-base border border-hairline text-content focus:border-cyan focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase text-subtle font-semibold block">
                  Brief &amp; Description
                </label>
                <textarea
                  rows={4}
                  required
                  value={psForm.description}
                  onChange={(e) => setPsForm({ ...psForm, description: e.target.value })}
                  placeholder="Describe the problem statement, objectives, and expected deliverables for participants..."
                  className="w-full px-3 py-2 bg-base border border-hairline text-content focus:border-cyan focus:outline-none leading-relaxed font-sans text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddPsModalOpen(false);
                    setEditingPs(null);
                  }}
                  className="px-4 py-2 border border-hairline text-muted hover:text-content"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPs}
                  className="px-5 py-2 font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingPs ? "Saving to Database..." : editingPs ? "✓ Update Statement" : "+ Add Statement to DB"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PROBLEM STATEMENT CONFIRMATION MODAL */}
      {deletingPs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-panel border border-rose-500/50 w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-rose-500/30 pb-3">
              <div>
                <div className="text-xs font-bold text-rose-400 uppercase">// CONFIRM REMOVAL</div>
                <h2 className="text-lg font-bold text-content mt-1">Delete Problem Statement</h2>
              </div>
              <button
                type="button"
                onClick={() => setDeletingPs(null)}
                className="text-muted hover:text-content text-xl font-bold px-2 py-1"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono text-muted">
              <p className="text-content">
                Are you sure you want to permanently delete:
              </p>
              <div className="p-3 border border-hairline bg-base space-y-1">
                <div className="text-cyan font-bold">{deletingPs.code} — {deletingPs.title}</div>
                <div className="text-[11px] text-subtle font-mono">{deletingPs.domain}</div>
              </div>

              {(deletingPs.team_count || 0) > 0 ? (
                <div className="p-3 border border-amber/50 bg-amber/10 text-amber text-[11px] leading-relaxed">
                  ⚠️ <strong>Notice:</strong> <strong>{deletingPs.team_count}</strong> registered team(s) currently have this problem statement selected. Deleting it will safely unlink the assignment so teams can choose another statement without losing any team data.
                </div>
              ) : (
                <p className="text-[11px] text-subtle">
                  No registered teams are currently assigned to this statement.
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-hairline">
              <button
                type="button"
                onClick={() => setDeletingPs(null)}
                className="px-4 py-2 border border-hairline text-muted hover:text-content text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPsLoading}
                onClick={handleConfirmDeletePs}
                className="px-5 py-2 font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors disabled:opacity-50 text-xs flex items-center gap-2"
              >
                {deletingPsLoading ? "Deleting..." : "Permanently Delete PS"}
              </button>
            </div>
          </div>
        </div>
      )}

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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={sendingEmailTeamId === selectedTeamForDetails.id}
                  onClick={() =>
                    handleSendEmailToTeam(
                      selectedTeamForDetails.id,
                      selectedTeamForDetails.leader_email,
                      selectedTeamForDetails.team_name
                    )
                  }
                  className="px-3 py-1 border border-cyan/50 bg-cyan/10 hover:bg-cyan/20 text-cyan text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Send or resend registration confirmation and details email to team leader"
                >
                  <span>✉</span>
                  <span>
                    {sendingEmailTeamId === selectedTeamForDetails.id
                      ? "Sending..."
                      : selectedTeamForDetails.email_sent
                      ? "Resend Email"
                      : "Send Registration Email"}
                  </span>
                </button>

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
