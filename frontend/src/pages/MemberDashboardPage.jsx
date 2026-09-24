import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";

export default function MemberDashboardPage() {
  const { user } = useAuth();

  const [teamData, setTeamData] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'submission' | 'timeline'

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch team info directly via /api/teams/mine
      let teamInfo = null;
      try {
        teamInfo = await apiClient.get("/api/teams/mine");
      } catch {
        if (user?.team_code) {
          try {
            teamInfo = await apiClient.get(`/api/teams/${user.team_code}`);
          } catch {
            // fallback
          }
        }
      }

      // 2. Fetch submission if team id is available
      let subInfo = null;
      if (teamInfo?.id || user?.id) {
        try {
          const teamId = teamInfo?.id || user?.id;
          subInfo = await apiClient.get(`/api/submissions/team/${teamId}`);
        } catch {
          // fallback to /mine if member has leader credentials
          try {
            subInfo = await apiClient.get("/api/submissions/mine");
          } catch {
            // no submission yet
          }
        }
      }

      setTeamData(teamInfo);
      setSubmission(subInfo);
    } catch {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-base text-content font-mono px-4 sm:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header Banner */}
        <div className="border-b border-hairline pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan" />
              // TEAM MEMBER PORTAL &middot; CODESHIELD 2026
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
              {teamData?.team_name || user?.team_name || "Team Member Dashboard"}
            </h1>
            <p className="text-xs text-muted mt-1">
              Logged in as: <strong className="text-content">{user?.name || user?.email}</strong> &middot; Team Code:{" "}
              <span className="text-cyan font-bold">{teamData?.team_code || user?.team_code || "N/A"}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-1.5 text-xs border border-hairline bg-panel hover:bg-panel/80 text-content transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 border border-hairline bg-panel/60 space-y-1">
            <div className="text-[10px] text-subtle uppercase">REGISTRATION STATUS</div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  teamData?.confirmed !== false ? "bg-emerald-400" : "bg-amber"
                }`}
              />
              <span className="text-sm font-bold text-content">
                {teamData?.confirmed !== false ? "CONFIRMED & ACTIVE" : "PENDING EMAIL CONFIRMATION"}
              </span>
            </div>
            <div className="text-[11px] text-muted">
              Team Code: <span className="text-cyan font-semibold">{teamData?.team_code || user?.team_code}</span>
            </div>
          </div>

          <div className="p-4 border border-hairline bg-panel/60 space-y-1">
            <div className="text-[10px] text-subtle uppercase">ATTENDANCE CHECK-IN</div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  teamData?.attendance_day1 ? "bg-emerald-400" : "bg-zinc-600"
                }`}
              />
              <span className="text-sm font-bold text-content">
                {teamData?.attendance_day1 ? "DAY 1 PRESENT" : "PENDING CHECK-IN"}
              </span>
            </div>
            <div className="text-[11px] text-muted">
              Day 2: {teamData?.attendance_day2 ? "Present" : "Not yet checked in"}
            </div>
          </div>

          <div className="p-4 border border-hairline bg-panel/60 space-y-1">
            <div className="text-[10px] text-subtle uppercase">PROJECT DELIVERABLES</div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${submission ? "bg-emerald-400" : "bg-amber"}`}
              />
              <span className="text-sm font-bold text-content">
                {submission ? "SUBMITTED BY LEADER" : "AWAITING LEADER SUBMISSION"}
              </span>
            </div>
            <div className="text-[11px] text-muted">
              {submission?.submitted_at
                ? `Last updated: ${new Date(submission.submitted_at).toLocaleTimeString()}`
                : "Managed by team leader"}
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-hairline pt-2 text-xs">
          {[
            { id: "overview", label: "[01 // TEAM ROSTER & TRACK]" },
            { id: "submission", label: "[02 // PROJECT SUBMISSION STATUS]" },
            { id: "timeline", label: "[03 // HACKATHON CHECKPOINTS & TIMELINE]" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 border-b-2 font-semibold transition-colors ${
                activeTab === tab.id
                  ? "border-cyan text-cyan bg-panel/60"
                  : "border-transparent text-muted hover:text-content"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW & ROSTER */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <div className="border border-hairline bg-panel p-6 space-y-4">
                <div className="border-b border-hairline/60 pb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-content">Team Members</h2>
                  <span className="text-xs text-subtle">
                    TOTAL: {teamData?.team_size || 2} MEMBERS
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Leader */}
                  <div className="p-3.5 border border-cyan/40 bg-cyan/5 flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-cyan">
                        [LEADER] {teamData?.leader_name || "Team Leader"}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 space-y-0.5">
                        {teamData?.leader_email && <div>Email: {teamData.leader_email}</div>}
                        <div>Roll: {teamData?.leader_college_id || "N/A"} &middot; {teamData?.leader_department || ""}</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-cyan text-zinc-950 px-1.5 py-0.5 font-bold">
                      LEADER
                    </span>
                  </div>

                  {/* Member 2 */}
                  <div className="p-3.5 border border-hairline bg-base/40">
                    <div className="text-xs font-bold text-content">
                      {teamData?.member2_name || "Member 2"}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5 space-y-0.5">
                      {teamData?.member2_email && <div>Email: {teamData.member2_email}</div>}
                      <div>Roll: {teamData?.member2_college_id || "N/A"}</div>
                    </div>
                  </div>

                  {/* Member 3 */}
                  {teamData?.member3_name && (
                    <div className="p-3.5 border border-hairline bg-base/40">
                      <div className="text-xs font-bold text-content">{teamData.member3_name}</div>
                      <div className="text-[11px] text-muted mt-0.5 space-y-0.5">
                        {teamData?.member3_email && <div>Email: {teamData.member3_email}</div>}
                        <div>Roll: {teamData.member3_college_id || "N/A"}</div>
                      </div>
                    </div>
                  )}

                  {/* Member 4 */}
                  {teamData?.member4_name && (
                    <div className="p-3.5 border border-hairline bg-base/40">
                      <div className="text-xs font-bold text-content">{teamData.member4_name}</div>
                      <div className="text-[11px] text-muted mt-0.5 space-y-0.5">
                        {teamData?.member4_email && <div>Email: {teamData.member4_email}</div>}
                        <div>Roll: {teamData.member4_college_id || "N/A"}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Track Info */}
            <div className="lg:col-span-5 space-y-6">
              <div className="border border-hairline bg-panel/60 p-6 space-y-3">
                <div className="text-xs font-bold text-cyan uppercase">// SELECTED CHALLENGE TRACK</div>
                <h3 className="text-base font-bold text-content">
                  {submission?.problem_statement_title || "Problem Statement"}
                </h3>
                {submission?.problem_statement_code && (
                  <span className="inline-block px-2.5 py-1 text-xs font-bold bg-cyan/10 text-cyan border border-cyan/30">
                    Track Code: {submission.problem_statement_code}
                  </span>
                )}
                <div className="pt-3 border-t border-hairline/60">
                  <Link
                    to="/problem-statements"
                    className="text-xs text-cyan hover:underline flex items-center gap-1"
                  >
                    <span>&rarr;</span> Explore Challenge Catalog
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUBMISSION STATUS (READ-ONLY) */}
        {activeTab === "submission" && (
          <div className="border border-hairline bg-panel p-6 sm:p-8 space-y-6 max-w-4xl">
            <div className="border-b border-hairline/60 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-content">Active Project Deliverables</h2>
                <p className="text-xs text-muted">
                  View-only preview. Deliverables are managed by your team leader.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 text-xs font-bold ${
                  submission ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/40" : "bg-amber/10 text-amber border border-amber/40"
                }`}
              >
                {submission ? "SUBMITTED" : "PENDING"}
              </span>
            </div>

            {submission ? (
              <div className="space-y-6">
                <div className="space-y-1">
                  <span className="text-[10px] text-subtle uppercase">PROJECT TITLE</span>
                  <div className="text-lg font-bold text-content">{submission.idea_title}</div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-subtle uppercase">ABSTRACT & SUMMARY</span>
                  <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap">
                    {submission.idea_description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-hairline/60">
                  <div className="p-4 border border-hairline bg-base/50 space-y-1.5">
                    <span className="text-[10px] text-subtle uppercase">CODE REPOSITORY</span>
                    {submission.repo_url ? (
                      <a
                        href={submission.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-cyan hover:underline break-all block"
                      >
                        {submission.repo_url} &rarr;
                      </a>
                    ) : (
                      <div className="text-xs text-muted">No repository linked yet</div>
                    )}
                  </div>

                  <div className="p-4 border border-hairline bg-base/50 space-y-1.5">
                    <span className="text-[10px] text-subtle uppercase">PRESENTATION SLIDE DECK</span>
                    {submission.deck_file_url ? (
                      <a
                        href={submission.deck_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-amber hover:underline break-all block"
                      >
                        {submission.deck_file_url} &rarr;
                      </a>
                    ) : (
                      <div className="text-xs text-muted">No slide deck linked yet</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-hairline text-center text-xs text-muted">
                Your team leader has not submitted project deliverables yet. Coordinate with your leader to complete the submission.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TIMELINE */}
        {activeTab === "timeline" && (
          <div className="border border-hairline bg-panel p-6 sm:p-8 space-y-6 max-w-4xl">
            <div className="border-b border-hairline/60 pb-3">
              <h2 className="text-base font-bold text-content">36-Hour Hackathon Checkpoints</h2>
              <p className="text-xs text-muted">Key event milestones, mentoring checkpoints, and judging rounds.</p>
            </div>

            <div className="space-y-4 text-xs">
              {[
                { time: "09:00 AM &middot; Day 1", title: "Team Check-in & Hardware/Network Setup", status: "Upcoming" },
                { time: "11:00 AM &middot; Day 1", title: "Opening Ceremony & Problem Statement Clarifications", status: "Upcoming" },
                { time: "03:00 PM &middot; Day 1", title: "Checkpoint 1: Architecture & Tech Stack Review with Mentors", status: "Upcoming" },
                { time: "09:00 PM &middot; Day 1", title: "Checkpoint 2: Security Hardening & Prototype Progress", status: "Upcoming" },
                { time: "02:00 AM &middot; Day 2", title: "Midnight Cybersecurity CTF Sprint (Optional Bonus)", status: "Upcoming" },
                { time: "08:00 AM &middot; Day 2", title: "Final Deliverables Submission Freeze", status: "Upcoming" },
                { time: "10:00 AM &middot; Day 2", title: "Panel Judging & Live Pitch Presentations", status: "Upcoming" },
                { time: "04:00 PM &middot; Day 2", title: "Valedictory & Prize Distribution", status: "Upcoming" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 border border-hairline bg-base/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <span className="text-cyan font-bold" dangerouslySetInnerHTML={{ __html: item.time }} />
                    <div className="text-content font-medium">{item.title}</div>
                  </div>
                  <span className="text-[10px] text-subtle uppercase px-2 py-0.5 border border-hairline">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
