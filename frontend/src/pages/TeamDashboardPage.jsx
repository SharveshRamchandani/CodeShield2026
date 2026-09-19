import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function TeamDashboardPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("deliverables"); // 'deliverables' | 'roster' | 'checkpoints'

  // Deliverables Form State
  const [formData, setFormData] = useState({
    idea_title: "",
    idea_description: "",
    repo_url: "",
    deck_file_url: "",
  });
  const [savingDeliverables, setSavingDeliverables] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Auto-dismiss status messages
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const loadTeamAndSubmission = useCallback(async () => {
    setLoading(true);
    try {
      const [teamData, subData] = await Promise.all([
        apiClient.get("/api/teams/mine").catch(() => null),
        apiClient.get("/api/submissions/mine").catch(() => null),
      ]);

      if (teamData) {
        setTeam(teamData);
      }
      if (subData) {
        setSubmission(subData);
        setFormData({
          idea_title: subData.idea_title || "",
          idea_description: subData.idea_description || "",
          repo_url: subData.repo_url || "",
          deck_file_url: subData.deck_file_url || "",
        });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Failed to load team workspace." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeamAndSubmission();
  }, [loadTeamAndSubmission]);

  // Handle Deliverable Save / Update
  const handleSaveDeliverables = async (e) => {
    e.preventDefault();
    if (!formData.idea_title.trim() || !formData.idea_description.trim()) {
      setStatusMessage({
        type: "error",
        text: "Please provide a Project Title and Brief Description.",
      });
      return;
    }

    setSavingDeliverables(true);
    setStatusMessage(null);

    try {
      const saved = await apiClient.put("/api/submissions/mine", {
        idea_title: formData.idea_title.trim(),
        idea_description: formData.idea_description.trim(),
        repo_url: formData.repo_url?.trim() || null,
        deck_file_url: formData.deck_file_url?.trim() || null,
      });

      setSubmission(saved);
      setStatusMessage({
        type: "success",
        text: "Project deliverables saved successfully! Panel judges can now review your submission.",
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err?.message || "Failed to save deliverables. Please check your links and try again.",
      });
    } finally {
      setSavingDeliverables(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-base text-content font-mono px-4 sm:px-8 py-8">
      {/* Top Banner */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-hairline pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              // TEAM LEADER WORKSPACE & DELIVERABLE PORTAL
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
              {team?.team_name || "Team Workspace"}
            </h1>
            <p className="text-xs text-muted mt-1">
              Logged in as: <span className="text-emerald-400 font-semibold">{user?.name || user?.email}</span> (Team Leader)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 text-xs font-bold border border-cyan/40 bg-cyan/10 text-cyan">
              CODE: {team?.team_code || "CS-TBA"}
            </span>
            <span
              className={`px-3 py-1 text-xs font-bold border ${
                team?.confirmed
                  ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-300"
                  : "border-amber/60 bg-amber/10 text-amber"
              }`}
            >
              {team?.confirmed ? "CONFIRMED ✓" : "REGISTRATION PENDING"}
            </span>
          </div>
        </div>

        {/* Global Toast Alert */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 border text-xs flex items-center justify-between transition-all ${
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

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-hairline mt-6 pt-2 text-xs overflow-x-auto">
          {[
            { id: "deliverables", label: "[01 // PROJECT DELIVERABLES]" },
            { id: "roster", label: "[02 // TEAM ROSTER & TRACK]" },
            { id: "checkpoints", label: "[03 // HACKATHON TIMELINE & RULES]" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-emerald-400 text-emerald-400 bg-panel/60"
                  : "border-transparent text-muted hover:text-content"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        {/* TAB 1: DELIVERABLES SUBMISSION */}
        {activeTab === "deliverables" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Column (8 Cols) */}
            <div className="lg:col-span-8 p-6 border border-hairline bg-panel space-y-6">
              <div className="border-b border-hairline pb-3">
                <div className="text-xs font-bold text-emerald-400 uppercase">// CODE & DELIVERABLE REPOSITORY</div>
                <p className="text-xs text-muted mt-1">
                  Submit your repository link, presentation deck, and project summary for CodeShield 2026 panel evaluation.
                </p>
              </div>

              <form onSubmit={handleSaveDeliverables} className="space-y-5 text-xs font-mono">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase text-subtle font-semibold block">
                    Project / Solution Title <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.idea_title}
                    onChange={(e) => setFormData({ ...formData, idea_title: e.target.value })}
                    placeholder="e.g. PhishGuard AI: Zero-Hour Phishing URL Detection"
                    className="w-full px-3 py-2.5 bg-base border border-hairline text-content focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase text-subtle font-semibold block">
                    Architecture & Approach Description <span className="text-emerald-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.idea_description}
                    onChange={(e) => setFormData({ ...formData, idea_description: e.target.value })}
                    placeholder="Briefly describe your solution architecture, key security features, algorithms used, and novelty..."
                    className="w-full px-3 py-2.5 bg-base border border-hairline text-content focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase text-subtle font-semibold block">
                    GitHub Repository URL (Public)
                  </label>
                  <input
                    type="url"
                    value={formData.repo_url}
                    onChange={(e) => setFormData({ ...formData, repo_url: e.target.value })}
                    placeholder="https://github.com/your-team/codeshield-project"
                    className="w-full px-3 py-2.5 bg-base border border-hairline text-content focus:border-emerald-400 focus:outline-none"
                  />
                  <span className="text-[10px] text-muted">
                    Ensure your GitHub repository is public or accessible to judges.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase text-subtle font-semibold block">
                    Presentation Slide Deck URL (Google Slides / Canva / PDF Drive)
                  </label>
                  <input
                    type="url"
                    value={formData.deck_file_url}
                    onChange={(e) => setFormData({ ...formData, deck_file_url: e.target.value })}
                    placeholder="https://docs.google.com/presentation/d/..."
                    className="w-full px-3 py-2.5 bg-base border border-hairline text-content focus:border-emerald-400 focus:outline-none"
                  />
                  <span className="text-[10px] text-muted">
                    Set share permissions to "Anyone with the link can view".
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-hairline">
                  <div className="text-[11px] text-muted">
                    {submission?.submitted_at ? (
                      <span>Last saved: {new Date(submission.submitted_at).toLocaleString()}</span>
                    ) : (
                      <span>No deliverables submitted yet.</span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingDeliverables}
                    className="px-6 py-2.5 font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingDeliverables ? (
                      <>
                        <div className="w-3 h-3 border-2 border-zinc-950 border-t-transparent animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>✓ Save Deliverables</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Submission Status & Tips Column (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 border border-hairline bg-panel space-y-3 text-xs">
                <div className="font-bold text-emerald-400 uppercase">// SUBMISSION CHECKLIST</div>
                <ul className="space-y-2 text-muted list-disc pl-4 leading-relaxed">
                  <li>Working codebase uploaded to GitHub with clear <code className="text-cyan">README.md</code>.</li>
                  <li>Include setup & execution instructions.</li>
                  <li>Presentation slide deck (max 8-10 slides).</li>
                  <li>Keep GitHub repos public throughout the 36 hours.</li>
                </ul>
              </div>

              {submission && (
                <div className="p-5 border border-emerald-500/40 bg-emerald-950/10 space-y-3 text-xs">
                  <div className="font-bold text-emerald-400 uppercase">// SUBMITTED LINKS</div>
                  {submission.repo_url && (
                    <div>
                      <span className="text-muted block text-[10px]">Repository:</span>
                      <a
                        href={submission.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan hover:underline break-all"
                      >
                        {submission.repo_url} &rarr;
                      </a>
                    </div>
                  )}

                  {submission.deck_file_url && (
                    <div className="pt-2 border-t border-hairline/40">
                      <span className="text-muted block text-[10px]">Slide Deck:</span>
                      <a
                        href={submission.deck_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber hover:underline break-all"
                      >
                        {submission.deck_file_url} &rarr;
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ROSTER & TRACK */}
        {activeTab === "roster" && (
          <div className="space-y-6">
            {/* Track Info */}
            <div className="p-5 border border-hairline bg-panel">
              <div className="text-xs font-bold text-cyan uppercase mb-1">// ASSIGNED PROBLEM STATEMENT</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="px-3 py-1 font-bold text-xs bg-cyan/10 border border-cyan/40 text-cyan">
                  {team?.problem_code || "CS Track"}
                </span>
                <h3 className="text-lg font-bold text-content">{team?.problem_title || "Track Assignment"}</h3>
              </div>
              <div className="text-xs text-muted mt-1">
                Domain: <span className="text-content">{team?.problem_domain || "Cybersecurity"}</span>
              </div>
            </div>

            {/* Members Grid */}
            <div>
              <div className="text-xs font-semibold text-cyan uppercase mb-3">// REGISTERED TEAM MEMBERS</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Leader */}
                <div className="p-4 border-2 border-emerald-500/40 bg-panel space-y-2">
                  <span className="text-[9px] px-1.5 py-0.5 bg-emerald-400 text-zinc-950 font-bold uppercase">
                    Team Leader
                  </span>
                  <div className="font-bold text-content text-sm">{team?.leader_name}</div>
                  <div className="text-xs text-emerald-400 font-mono">{team?.leader_email}</div>
                  <div className="text-[11px] text-muted font-mono">
                    ID: {team?.leader_college_id} &middot; {team?.leader_department}
                  </div>
                </div>

                {/* Member 2 */}
                <div className="p-4 border border-hairline bg-panel space-y-2">
                  <span className="text-[9px] px-1.5 py-0.5 border border-hairline bg-base text-muted uppercase">
                    Member 02
                  </span>
                  <div className="font-bold text-content text-sm">{team?.member2_name || "Member 2"}</div>
                  <div className="text-xs text-muted font-mono">Roll: {team?.member2_college_id || "—"}</div>
                </div>

                {/* Member 3 */}
                {team?.member3_name && (
                  <div className="p-4 border border-hairline bg-panel space-y-2">
                    <span className="text-[9px] px-1.5 py-0.5 border border-hairline bg-base text-muted uppercase">
                      Member 03
                    </span>
                    <div className="font-bold text-content text-sm">{team?.member3_name}</div>
                    <div className="text-xs text-muted font-mono">Roll: {team?.member3_college_id || "—"}</div>
                  </div>
                )}

                {/* Member 4 */}
                {team?.member4_name && (
                  <div className="p-4 border border-hairline bg-panel space-y-2">
                    <span className="text-[9px] px-1.5 py-0.5 border border-hairline bg-base text-muted uppercase">
                      Member 04
                    </span>
                    <div className="font-bold text-content text-sm">{team?.member4_name}</div>
                    <div className="text-xs text-muted font-mono">Roll: {team?.member4_college_id || "—"}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CHECKPOINTS & RULES */}
        {activeTab === "checkpoints" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 border border-hairline bg-panel space-y-3">
              <div className="text-xs font-bold text-cyan uppercase">// CHECKPOINT 01: IDEATION</div>
              <p className="text-xs text-muted leading-relaxed">
                Initial architectural approach discussion with designated mentors. Confirm problem statement feasibility and tech stack.
              </p>
              <div className="text-[11px] text-cyan font-semibold">Day 1 &middot; 02:00 PM</div>
            </div>

            <div className="p-5 border border-hairline bg-panel space-y-3">
              <div className="text-xs font-bold text-amber uppercase">// CHECKPOINT 02: PROGRESS REVIEW</div>
              <p className="text-xs text-muted leading-relaxed">
                Interim code inspection and database schema review. Ensure core functional logic is implemented and working.
              </p>
              <div className="text-[11px] text-amber font-semibold">Day 1 &middot; 09:00 PM</div>
            </div>

            <div className="p-5 border border-hairline bg-panel space-y-3">
              <div className="text-xs font-bold text-emerald-400 uppercase">// FINAL PRESENTATION & DEMO</div>
              <p className="text-xs text-muted leading-relaxed">
                Final deliverable lock. Live demonstration to panel judges, slide deck walkthrough, and Q&A session.
              </p>
              <div className="text-[11px] text-emerald-400 font-semibold">Day 2 &middot; 11:00 AM</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
