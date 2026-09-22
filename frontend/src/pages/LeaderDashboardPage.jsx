import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";

export default function LeaderDashboardPage() {
  const { user } = useAuth();

  const [teamData, setTeamData] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("submission"); // 'submission' | 'roster' | 'rubric'

  // Submission Form State
  const [formData, setFormData] = useState({
    idea_title: "",
    idea_description: "",
    repo_url: "",
    deck_file_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Auto-dismiss status messages after 5 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch team metadata directly via /api/teams/mine
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

      // 2. Fetch leader's active project submission
      let subInfo = null;
      try {
        subInfo = await apiClient.get("/api/submissions/mine");
      } catch {
        // null if no submission yet
      }

      setTeamData(teamInfo);
      setSubmission(subInfo);

      if (subInfo) {
        setFormData({
          idea_title: subInfo.idea_title || "",
          idea_description: subInfo.idea_description || "",
          repo_url: subInfo.repo_url || "",
          deck_file_url: subInfo.deck_file_url || "",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Failed to load team and submission information from server.",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveSubmission = async (e) => {
    e.preventDefault();
    if (!formData.idea_title.trim() || !formData.idea_description.trim()) {
      setStatusMessage({
        type: "error",
        text: "Project Idea Title and Description are required.",
      });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      const payload = {
        team_id: user.id,
        idea_title: formData.idea_title.trim(),
        idea_description: formData.idea_description.trim(),
        repo_url: formData.repo_url.trim() || null,
        deck_file_url: formData.deck_file_url.trim() || null,
      };

      const res = await apiClient.put("/api/submissions/mine", payload);
      setSubmission(res);
      setStatusMessage({
        type: "success",
        text: "Project deliverables saved and recorded successfully!",
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to save submission. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-base text-content font-mono px-4 sm:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header Banner */}
        <div className="border-b border-hairline pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              // TEAM LEADER CONTROL CENTER &middot; CODESHIELD 2026
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
              {teamData?.team_name || user?.team_name || "Team Dashboard"}
            </h1>
            <p className="text-xs text-muted mt-1">
              Leader: <strong className="text-content">{user?.name || user?.email}</strong> &middot; Team Code:{" "}
              <span className="text-cyan font-bold">{teamData?.team_code || user?.team_code || "N/A"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-1.5 text-xs border border-hairline bg-panel hover:bg-panel/80 text-content transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <span className={loading ? "animate-spin" : ""}>&circlearrowright;</span>
              {loading ? "Refreshing..." : "Refresh Status"}
            </button>
          </div>
        </div>

        {/* Global Toast Alert */}
        {statusMessage && (
          <div
            className={`p-3 border text-xs flex items-center justify-between transition-all ${
              statusMessage.type === "success"
                ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300"
                : "border-rose-500/50 bg-rose-950/30 text-rose-300"
            }`}
          >
            <span>&gt; {statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-muted hover:text-content text-sm ml-4"
            >
              &times;
            </button>
          </div>
        )}

        {/* Dynamic Registration Completion Alert if Members not fully set */}
        {!teamData?.member2_name && (
          <div className="p-4 border border-cyan/50 bg-cyan/10 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-bold text-cyan">// TEAM CODE ASSIGNED: {teamData?.team_code || user?.team_code || "AUTO-ASSIGNED"}</span>
              <p className="text-muted text-[11px]">
                You can add teammate details (Members 2, 3, 4) and select your target Problem Statement via the official registration form.
              </p>
            </div>
            <Link
              to="/register"
              state={{
                prefillEmail: user?.email,
                prefillName: user?.name,
              }}
              className="px-4 py-2 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              Complete Team Roster &rarr;
            </Link>
          </div>
        )}

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Confirmation */}
          <div className="p-4 border border-hairline bg-panel/60 space-y-1">
            <div className="text-[10px] text-subtle uppercase">REGISTRATION STATUS</div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  teamData?.confirmed !== false ? "bg-emerald-400" : "bg-amber"
                }`}
              />
              <span className="text-sm font-bold text-content">
                {teamData?.confirmed !== false ? "VERIFIED & CONFIRMED" : "PENDING EMAIL CONFIRMATION"}
              </span>
            </div>
            <div className="text-[11px] text-muted">
              Team Code: <span className="text-cyan font-semibold">{teamData?.team_code || user?.team_code}</span>
            </div>
          </div>

          {/* Card 2: Day 1 Attendance */}
          <div className="p-4 border border-hairline bg-panel/60 space-y-1">
            <div className="text-[10px] text-subtle uppercase">DAY 1 CHECK-IN</div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  teamData?.attendance_day1 ? "bg-emerald-400" : "bg-zinc-600"
                }`}
              />
              <span className="text-sm font-bold text-content">
                {teamData?.attendance_day1 ? "PRESENT (VERIFIED)" : "NOT CHECKED IN"}
              </span>
            </div>
            <div className="text-[11px] text-muted">On-site registration desk verification</div>
          </div>

          {/* Card 3: Day 2 Attendance */}
          <div className="p-4 border border-hairline bg-panel/60 space-y-1">
            <div className="text-[10px] text-subtle uppercase">DAY 2 FINALS CHECK-IN</div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  teamData?.attendance_day2 ? "bg-emerald-400" : "bg-zinc-600"
                }`}
              />
              <span className="text-sm font-bold text-content">
                {teamData?.attendance_day2 ? "PRESENT (QUALIFIED)" : "NOT CHECKED IN"}
              </span>
            </div>
            <div className="text-[11px] text-muted">Presentation pitch attendance</div>
          </div>

          {/* Card 4: Submission State */}
          <div className="p-4 border border-hairline bg-panel/60 space-y-1">
            <div className="text-[10px] text-subtle uppercase">PROJECT DELIVERABLES</div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${submission ? "bg-emerald-400" : "bg-amber"}`}
              />
              <span className="text-sm font-bold text-content">
                {submission ? "SUBMITTED & ACTIVE" : "PENDING SUBMISSION"}
              </span>
            </div>
            <div className="text-[11px] text-muted">
              {submission?.submitted_at
                ? `Updated: ${new Date(submission.submitted_at).toLocaleTimeString()}`
                : "Submit before judging deadline"}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-hairline pt-2 text-xs">
          {[
            { id: "submission", label: "[01 // PROJECT SUBMISSION STUDIO]" },
            { id: "roster", label: `[02 // TEAM ROSTER (${teamData?.team_size || 2} MEMBERS)]` },
            { id: "rubric", label: "[03 // EVALUATION RUBRIC CRITERIA]" },
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

        {/* TAB 1: SUBMISSION STUDIO */}
        {activeTab === "submission" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Col (7): Submission Form */}
            <div className="lg:col-span-7">
              <form
                onSubmit={handleSaveSubmission}
                className="border border-hairline bg-panel/60 p-6 sm:p-8 space-y-6"
              >
                <div className="border-b border-hairline/60 pb-3">
                  <div className="text-xs font-semibold text-cyan uppercase mb-1">
                    // SUBMISSION DETAILS & DELIVERABLES
                  </div>
                  <p className="text-xs text-muted">
                    Team leaders can continuously update project deliverables up until the evaluation cutoff.
                  </p>
                </div>

                {/* Submission Window Lock Banner */}
                {submission?.is_locked && (
                  <div className="p-3.5 border border-amber/50 bg-amber/10 text-amber text-xs font-mono space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>🔒</span>
                      <span>SUBMISSIONS LOCKED (READ ONLY)</span>
                    </div>
                    <p className="text-[11px] text-content/80 leading-relaxed">
                      The project submission deadline has passed. Deliverables are locked in read-only mode for judge evaluations.
                      {submission.closes_at && (
                        <span className="block text-muted text-[10px] mt-0.5">
                          Cutoff: {new Date(submission.closes_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {/* Project Idea Title */}
                <div className="space-y-1.5">
                  <label htmlFor="idea_title" className="text-xs uppercase text-subtle font-semibold block">
                    Project Title *
                  </label>
                  <input
                    id="idea_title"
                    type="text"
                    name="idea_title"
                    value={formData.idea_title}
                    onChange={handleInputChange}
                    disabled={saving || Boolean(submission?.is_locked)}
                    placeholder="e.g. SentinelZero: Autonomous Threat Detection"
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Project Idea Description */}
                <div className="space-y-1.5">
                  <label htmlFor="idea_description" className="text-xs uppercase text-subtle font-semibold block">
                    Project Abstract / Solution Overview *
                  </label>
                  <textarea
                    id="idea_description"
                    rows={4}
                    name="idea_description"
                    value={formData.idea_description}
                    onChange={handleInputChange}
                    disabled={saving || Boolean(submission?.is_locked)}
                    placeholder="Describe your architecture, the problem addressed, key novelty, tech stack, and cybersecurity resilience..."
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                {/* GitHub Repository URL */}
                <div className="space-y-1.5">
                  <label htmlFor="repo_url" className="text-xs uppercase text-subtle font-semibold block">
                    GitHub / GitLab Repository URL
                  </label>
                  <input
                    id="repo_url"
                    type="url"
                    name="repo_url"
                    value={formData.repo_url}
                    onChange={handleInputChange}
                    disabled={saving || Boolean(submission?.is_locked)}
                    placeholder="https://github.com/username/project"
                    className="w-full px-3.5 py-2.5 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-[10px] text-muted">
                    Ensure the repository is public or accessible to panel judges.
                  </span>
                </div>

                {/* Presentation Deck URL */}
                <div className="space-y-1.5">
                  <label htmlFor="deck_file_url" className="text-xs uppercase text-subtle font-semibold block">
                    Slide Deck / Pitch Video URL (Google Drive / Canva / Loom)
                  </label>
                  <input
                    id="deck_file_url"
                    type="url"
                    name="deck_file_url"
                    value={formData.deck_file_url}
                    onChange={handleInputChange}
                    disabled={saving || Boolean(submission?.is_locked)}
                    placeholder="https://docs.google.com/presentation/d/..."
                    className="w-full px-3.5 py-2.5 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={saving || Boolean(submission?.is_locked)}
                  className="w-full py-3 text-xs font-bold uppercase tracking-wider text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent animate-spin" />
                      <span>Saving Deliverables...</span>
                    </>
                  ) : submission?.is_locked ? (
                    <span>🔒 Submissions Closed</span>
                  ) : (
                    <span>{submission ? "✓ Update Project Deliverables" : "⚡ Submit Deliverables &rarr;"}</span>
                  )}
                </button>
              </form>
            </div>

            {/* Right Col (5): Track Brief & Live Preview */}
            <div className="lg:col-span-5 space-y-6">
              {/* Submission Live Preview Card */}
              <div className="border border-hairline bg-panel/40 p-6 space-y-4">
                <div className="text-xs font-bold text-cyan uppercase">// LIVE SUBMISSION PREVIEW</div>

                {submission ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-subtle uppercase text-[10px]">Title:</span>
                      <div className="font-bold text-content text-sm">{submission.idea_title}</div>
                    </div>

                    <div>
                      <span className="text-subtle uppercase text-[10px]">Description:</span>
                      <p className="text-muted leading-relaxed line-clamp-4">{submission.idea_description}</p>
                    </div>

                    <div className="pt-2 border-t border-hairline/60 flex flex-col gap-2">
                      {submission.repo_url && (
                        <a
                          href={submission.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan hover:underline flex items-center gap-1.5"
                        >
                          <span>&lt;/&gt;</span> {submission.repo_url} &rarr;
                        </a>
                      )}
                      {submission.deck_file_url && (
                        <a
                          href={submission.deck_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber hover:underline flex items-center gap-1.5"
                        >
                          <span>▣</span> Presentation Deck &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted py-6 text-center border border-dashed border-hairline">
                    No deliverables submitted yet. Complete the form to register your project for evaluation.
                  </div>
                )}
              </div>

              {/* Problem Statement Card */}
              {submission?.problem_statement_code && (
                <div className="border border-hairline bg-panel/40 p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan uppercase">// ASSIGNED CHALLENGE TRACK</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan/10 text-cyan border border-cyan/30">
                      {submission.problem_statement_code}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-content">{submission.problem_statement_title}</h3>
                  <Link
                    to="/problem-statements"
                    className="inline-block text-xs text-cyan hover:underline pt-1"
                  >
                    View All Problem Statements &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ROSTER */}
        {activeTab === "roster" && (
          <div className="border border-hairline bg-panel p-6 sm:p-8 space-y-6">
            <div className="border-b border-hairline/60 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-content">Registered Team Members</h2>
                <p className="text-xs text-muted">
                  Official roster verified against college roll numbers and cybersecurity guidelines.
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-bold bg-cyan/10 text-cyan border border-cyan/40">
                TEAM SIZE: {teamData?.team_size || 2}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Leader Card */}
              <div className="p-4 border border-cyan/40 bg-cyan/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-cyan uppercase">TEAM LEADER (PRIMARY)</span>
                  <span className="text-[10px] bg-cyan text-zinc-950 px-1.5 py-0.5 font-bold">LEADER</span>
                </div>
                <div className="text-sm font-bold text-content">{teamData?.leader_name || user?.name}</div>
                <div className="text-xs text-muted space-y-0.5">
                  <div>Email: {teamData?.leader_email || user?.email}</div>
                  <div>Roll / College ID: {teamData?.leader_college_id || "N/A"}</div>
                  {teamData?.leader_phone && <div>Phone: {teamData.leader_phone}</div>}
                  {teamData?.leader_department && (
                    <div>Dept: {teamData.leader_department} ({teamData.leader_year})</div>
                  )}
                </div>
              </div>

              {/* Member 2 */}
              <div className="p-4 border border-hairline bg-base/50 space-y-2">
                <div className="text-[10px] font-bold text-subtle uppercase">MEMBER 2</div>
                <div className="text-sm font-bold text-content">{teamData?.member2_name || "Member 2"}</div>
                <div className="text-xs text-muted space-y-0.5">
                  {teamData?.member2_email && <div>Email: {teamData.member2_email}</div>}
                  <div>Roll / College ID: {teamData?.member2_college_id || "N/A"}</div>
                </div>
              </div>

              {/* Member 3 */}
              {teamData?.member3_name && (
                <div className="p-4 border border-hairline bg-base/50 space-y-2">
                  <div className="text-[10px] font-bold text-subtle uppercase">MEMBER 3</div>
                  <div className="text-sm font-bold text-content">{teamData.member3_name}</div>
                  <div className="text-xs text-muted space-y-0.5">
                    {teamData.member3_email && <div>Email: {teamData.member3_email}</div>}
                    <div>Roll / College ID: {teamData.member3_college_id || "N/A"}</div>
                  </div>
                </div>
              )}

              {/* Member 4 */}
              {teamData?.member4_name && (
                <div className="p-4 border border-hairline bg-base/50 space-y-2">
                  <div className="text-[10px] font-bold text-subtle uppercase">MEMBER 4</div>
                  <div className="text-sm font-bold text-content">{teamData.member4_name}</div>
                  <div className="text-xs text-muted space-y-0.5">
                    {teamData.member4_email && <div>Email: {teamData.member4_email}</div>}
                    <div>Roll / College ID: {teamData.member4_college_id || "N/A"}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: RUBRIC CRITERIA */}
        {activeTab === "rubric" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border border-hairline bg-panel space-y-2">
              <div className="text-xs font-bold text-cyan uppercase">// 1. INNOVATION & NOVELTY (10 PTS)</div>
              <p className="text-xs text-muted leading-relaxed">
                Uniqueness of the proposed cybersecurity or tech solution, creativity in problem formulation, and originality beyond standard tutorial implementations.
              </p>
            </div>

            <div className="p-6 border border-hairline bg-panel space-y-2">
              <div className="text-xs font-bold text-cyan uppercase">// 2. TECHNICAL EXECUTION (10 PTS)</div>
              <p className="text-xs text-muted leading-relaxed">
                Code architecture, functional working prototype, repository structure, security hardening, and error handling resilience.
              </p>
            </div>

            <div className="p-6 border border-hairline bg-panel space-y-2">
              <div className="text-xs font-bold text-cyan uppercase">// 3. PRESENTATION & PITCH (10 PTS)</div>
              <p className="text-xs text-muted leading-relaxed">
                Clarity of presentation, slide deck design, articulate live demo during round evaluations, and response to panel judge questions.
              </p>
            </div>

            <div className="p-6 border border-hairline bg-panel space-y-2">
              <div className="text-xs font-bold text-cyan uppercase">// 4. PRACTICAL UTILITY & IMPACT (10 PTS)</div>
              <p className="text-xs text-muted leading-relaxed">
                Real-world deployment readiness, campus or enterprise utility, addressing realistic threat models, and scalability.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
