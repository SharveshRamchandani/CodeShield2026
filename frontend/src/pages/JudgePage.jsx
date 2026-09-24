import { useState, useEffect, useMemo, useCallback } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function JudgePage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("matrix"); // 'matrix' | 'my_evaluations' | 'rubric_guide' | 'leaderboard'
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'pending' | 'evaluated'
  const [activeTeamId, setActiveTeamId] = useState(null);

  // Evaluation form state for active submission
  const [formState, setFormState] = useState({
    innovation_score: 8,
    execution_score: 8,
    presentation_score: 8,
    usefulness_score: 8,
    notes: "",
  });
  const [submittingScore, setSubmittingScore] = useState(false);
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
      const [subsData, scoresData] = await Promise.all([
        apiClient.get("/api/submissions/").catch(() => []),
        apiClient.get("/api/scores/").catch(() => []),
      ]);
      setSubmissions(subsData || []);
      setScores(scoresData || []);

      // Auto-select first submission if none selected
      if (!activeTeamId && subsData && subsData.length > 0) {
        const first = subsData[0];
        setActiveTeamId(first.team_id);
        const existing = (scoresData || []).find((s) => s.team_id === first.team_id);
        if (existing) {
          setFormState({
            innovation_score: existing.innovation_score,
            execution_score: existing.execution_score,
            presentation_score: existing.presentation_score,
            usefulness_score: existing.usefulness_score,
            notes: existing.notes || "",
          });
        }
      }
    } catch {
      setStatusMessage({ type: "error", text: "Failed to load submissions or scores from server." });
    } finally {
      setLoading(false);
    }
  }, [activeTeamId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map team_id to existing judge score
  const scoresByTeamId = useMemo(() => {
    const map = {};
    for (const s of scores) {
      map[s.team_id] = s;
    }
    return map;
  }, [scores]);

  // Filtered Submissions List
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const isEvaluated = Boolean(scoresByTeamId[sub.team_id]);
      if (filterStatus === "evaluated" && !isEvaluated) return false;
      if (filterStatus === "pending" && isEvaluated) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        sub.team_name?.toLowerCase().includes(q) ||
        sub.team_code?.toLowerCase().includes(q) ||
        sub.problem_statement_code?.toLowerCase().includes(q) ||
        sub.problem_statement_title?.toLowerCase().includes(q) ||
        sub.idea_title?.toLowerCase().includes(q)
      );
    });
  }, [submissions, searchQuery, filterStatus, scoresByTeamId]);

  const activeSubmission = useMemo(() => {
    return submissions.find((s) => s.team_id === activeTeamId) || null;
  }, [submissions, activeTeamId]);

  const activeScore = useMemo(() => {
    return activeTeamId ? scoresByTeamId[activeTeamId] : null;
  }, [activeTeamId, scoresByTeamId]);

  // Select team for scoring studio
  const handleSelectTeam = (sub) => {
    setActiveTeamId(sub.team_id);
    const existing = scoresByTeamId[sub.team_id];
    if (existing) {
      setFormState({
        innovation_score: existing.innovation_score,
        execution_score: existing.execution_score,
        presentation_score: existing.presentation_score,
        usefulness_score: existing.usefulness_score,
        notes: existing.notes || "",
      });
    } else {
      setFormState({
        innovation_score: 8,
        execution_score: 8,
        presentation_score: 8,
        usefulness_score: 8,
        notes: "",
      });
    }
    setStatusMessage(null);
  };

  // Submit / Update Score
  const handleScoreSubmit = async (e) => {
    e.preventDefault();
    if (!activeTeamId) return;

    setSubmittingScore(true);
    setStatusMessage(null);

    try {
      const saved = await apiClient.post("/api/scores/", {
        team_id: activeTeamId,
        innovation_score: Number(formState.innovation_score),
        execution_score: Number(formState.execution_score),
        presentation_score: Number(formState.presentation_score),
        usefulness_score: Number(formState.usefulness_score),
        notes: formState.notes?.trim() || null,
      });

      setStatusMessage({
        type: "success",
        text: `Evaluation for ${saved.team_name || "Team"} successfully saved!`,
      });

      // Reload scores
      const updatedScores = await apiClient.get("/api/scores/");
      setScores(updatedScores || []);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to submit score. Please try again.",
      });
    } finally {
      setSubmittingScore(false);
    }
  };

  // Calculate live total
  const liveTotalScore =
    Number(formState.innovation_score || 0) +
    Number(formState.execution_score || 0) +
    Number(formState.presentation_score || 0) +
    Number(formState.usefulness_score || 0);

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-base text-content font-mono px-4 sm:px-8 py-8">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-hairline pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
              // JUDGE EVALUATION PORTAL &middot; CONFIDENTIAL
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
              CodeShield 2026 Evaluation Matrix
            </h1>
            <p className="text-xs text-muted mt-1">
              Authenticated Panel Judge: <span className="text-amber font-semibold">{user?.name || user?.email}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 text-xs border border-hairline bg-panel hover:bg-panel/80 text-content flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? "Refreshing..." : "Refresh Queue"}</span>
            </button>
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

        {/* Portal Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-hairline mt-6 pt-2 text-xs overflow-x-auto">
          {[
            { id: "matrix", label: `[01 // ACTIVE EVALUATION MATRIX (${submissions.length})]` },
            { id: "my_evaluations", label: `[02 // MY SUBMITTED EVALUATIONS (${scores.length})]` },
            { id: "rubric_guide", label: "[03 // RUBRIC GUIDELINES & CRITERIA]" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-amber text-amber bg-panel/60"
                  : "border-transparent text-muted hover:text-content"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        {/* TAB 1: EVALUATION MATRIX STUDIO */}
        {activeTab === "matrix" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Submissions Queue List (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Filter Bar */}
              <div className="p-3 border border-hairline bg-panel space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team, code, track, title..."
                  className="w-full px-3 py-1.5 text-xs bg-base border border-hairline text-content focus:border-amber focus:outline-none font-mono"
                />

                <div className="flex items-center justify-between text-xs pt-1 border-t border-hairline/60">
                  <span className="text-muted text-[11px]">Filter Queue:</span>
                  <div className="flex items-center gap-1">
                    {["all", "pending", "evaluated"].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFilterStatus(f)}
                        className={`px-2 py-0.5 text-[10px] uppercase border transition-colors ${
                          filterStatus === f
                            ? "border-amber bg-amber/10 text-amber font-bold"
                            : "border-hairline text-muted hover:text-content"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submissions Queue List */}
              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                {filteredSubmissions.length === 0 ? (
                  <div className="p-8 border border-hairline bg-panel text-center text-xs text-muted">
                    No submissions found matching criteria.
                  </div>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const isSelected = sub.team_id === activeTeamId;
                    const existing = scoresByTeamId[sub.team_id];

                    return (
                      <div
                        key={sub.id || sub.team_id}
                        onClick={() => handleSelectTeam(sub)}
                        className={`p-4 border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "border-amber bg-panel shadow-md ring-1 ring-amber/50"
                            : "border-hairline bg-panel/40 hover:border-hairline/80 hover:bg-panel"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber text-xs">{sub.team_code}</span>
                            <span className="text-content font-semibold text-xs">{sub.team_name}</span>
                          </div>

                          {existing ? (
                            <span className="px-2 py-0.5 text-[9px] font-bold border border-emerald-500/50 bg-emerald-950/30 text-emerald-400">
                              SCORED: {existing.innovation_score + existing.execution_score + existing.presentation_score + existing.usefulness_score}/40
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-bold border border-amber/40 bg-amber/10 text-amber">
                              PENDING
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-content font-medium line-clamp-1 mb-1">
                          {sub.idea_title || "Untitled Submission"}
                        </div>

                        <div className="text-[11px] text-muted line-clamp-2 leading-tight">
                          {sub.idea_description || "No project summary provided."}
                        </div>

                        {sub.problem_statement_code && (
                          <div className="mt-2 pt-2 border-t border-hairline/40 flex items-center justify-between text-[10px] text-subtle">
                            <span>Track: {sub.problem_statement_code}</span>
                            <span className="text-amber">Click to evaluate &rarr;</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Active Team Deliverables & Rubric Scoring Panel (7 Cols) */}
            <div className="lg:col-span-7">
              {activeSubmission ? (
                <div className="border border-hairline bg-panel p-6 space-y-6">
                  {/* Team Submission Header */}
                  <div className="border-b border-hairline pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-xs font-bold bg-amber text-zinc-950">
                          {activeSubmission.team_code}
                        </span>
                        <h2 className="text-lg font-bold text-content">{activeSubmission.team_name}</h2>
                      </div>

                      {activeScore && (
                        <div className="text-right">
                          <span className="text-xs text-emerald-400 font-bold">
                            Current Score: {activeScore.innovation_score + activeScore.execution_score + activeScore.presentation_score + activeScore.usefulness_score} / 40
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-content mt-2">{activeSubmission.idea_title}</h3>
                    <p className="text-xs text-muted leading-relaxed mt-1">{activeSubmission.idea_description}</p>

                    {/* Deliverable Resource Links */}
                    <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-hairline/60">
                      {activeSubmission.repo_url ? (
                        <a
                          href={activeSubmission.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 text-xs border border-cyan/50 bg-cyan/10 text-cyan hover:bg-cyan/20 flex items-center gap-1.5 transition-colors font-mono"
                        >
                          <span>&lt;/&gt;</span> Open GitHub Repository &rarr;
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted border border-hairline px-2.5 py-1">
                          No GitHub URL provided
                        </span>
                      )}

                      {activeSubmission.deck_file_url ? (
                        <a
                          href={activeSubmission.deck_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 text-xs border border-amber/50 bg-amber/10 text-amber hover:bg-amber/20 flex items-center gap-1.5 transition-colors font-mono"
                        >
                          <span>▣</span> View Presentation Deck &rarr;
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted border border-hairline px-2.5 py-1">
                          No Slide Deck provided
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rubric Evaluation Form */}
                  <form onSubmit={handleScoreSubmit} className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-amber uppercase">
                        // OFFICIAL SCORING RUBRIC (40 POINTS MAX)
                      </div>
                      <div className="text-sm font-bold text-content font-mono">
                        TOTAL: <span className="text-amber text-lg">{liveTotalScore}</span> / 40
                      </div>
                    </div>

                    {/* Criteria 1: Innovation */}
                    <div className="space-y-2 p-3 border border-hairline/60 bg-base/50">
                      <div className="flex justify-between text-xs">
                        <div>
                          <span className="font-bold text-content">1. Innovation & Novelty</span>
                          <p className="text-[10px] text-muted">Originality of solution, uniqueness of approach.</p>
                        </div>
                        <span className="text-sm font-bold text-amber font-mono">{formState.innovation_score} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={formState.innovation_score}
                        onChange={(e) => setFormState({ ...formState, innovation_score: Number(e.target.value) })}
                        className="w-full accent-amber cursor-pointer"
                      />
                    </div>

                    {/* Criteria 2: Technical Execution */}
                    <div className="space-y-2 p-3 border border-hairline/60 bg-base/50">
                      <div className="flex justify-between text-xs">
                        <div>
                          <span className="font-bold text-content">2. Technical Execution & Code Quality</span>
                          <p className="text-[10px] text-muted">Architecture, functionality, security practices, and implementation.</p>
                        </div>
                        <span className="text-sm font-bold text-amber font-mono">{formState.execution_score} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={formState.execution_score}
                        onChange={(e) => setFormState({ ...formState, execution_score: Number(e.target.value) })}
                        className="w-full accent-amber cursor-pointer"
                      />
                    </div>

                    {/* Criteria 3: Presentation & Pitch */}
                    <div className="space-y-2 p-3 border border-hairline/60 bg-base/50">
                      <div className="flex justify-between text-xs">
                        <div>
                          <span className="font-bold text-content">3. Presentation & Pitch Delivery</span>
                          <p className="text-[10px] text-muted">Clarity, slide design, live demo, and answering questions.</p>
                        </div>
                        <span className="text-sm font-bold text-amber font-mono">{formState.presentation_score} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={formState.presentation_score}
                        onChange={(e) => setFormState({ ...formState, presentation_score: Number(e.target.value) })}
                        className="w-full accent-amber cursor-pointer"
                      />
                    </div>

                    {/* Criteria 4: Feasibility & Impact */}
                    <div className="space-y-2 p-3 border border-hairline/60 bg-base/50">
                      <div className="flex justify-between text-xs">
                        <div>
                          <span className="font-bold text-content">4. Practical Utility & Impact</span>
                          <p className="text-[10px] text-muted">Real-world applicability, problem resolution, and scalability.</p>
                        </div>
                        <span className="text-sm font-bold text-amber font-mono">{formState.usefulness_score} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={formState.usefulness_score}
                        onChange={(e) => setFormState({ ...formState, usefulness_score: Number(e.target.value) })}
                        className="w-full accent-amber cursor-pointer"
                      />
                    </div>

                    {/* Judge Notes */}
                    <div className="space-y-2">
                      <label className="text-xs uppercase text-subtle font-semibold block">
                        Judge Evaluation Feedback & Notes (Confidential)
                      </label>
                      <textarea
                        rows={3}
                        value={formState.notes}
                        onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                        placeholder="Key strengths, architectural observations, recommendations for the team..."
                        className="w-full px-3 py-2 text-xs bg-base border border-hairline text-content focus:border-amber focus:outline-none font-mono"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submittingScore}
                        className="w-full py-3 text-xs font-bold text-zinc-950 bg-amber hover:bg-amber-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submittingScore ? (
                          <>
                            <div className="w-3 h-3 border-2 border-zinc-950 border-t-transparent animate-spin" />
                            <span>Saving Evaluation...</span>
                          </>
                        ) : (
                          <span>{activeScore ? "✓ Update Evaluation Score" : "⚡ Submit Official Score"}</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-12 border border-hairline bg-panel text-center text-xs text-muted">
                  Select a team submission from the queue on the left to review deliverables and record scoring.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MY SUBMITTED EVALUATIONS */}
        {activeTab === "my_evaluations" && (
          <div className="space-y-4">
            <div className="border border-hairline bg-panel overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-hairline bg-base/60 text-muted uppercase text-[10px]">
                    <th className="p-3">Team Code / Name</th>
                    <th className="p-3 text-center">Innovation (/10)</th>
                    <th className="p-3 text-center">Execution (/10)</th>
                    <th className="p-3 text-center">Presentation (/10)</th>
                    <th className="p-3 text-center">Impact (/10)</th>
                    <th className="p-3 text-center">Total (/40)</th>
                    <th className="p-3">Judge Notes</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline/60">
                  {scores.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted">
                        You have not submitted any evaluations yet.
                      </td>
                    </tr>
                  ) : (
                    scores.map((s) => {
                      const total =
                        (s.innovation_score || 0) +
                        (s.execution_score || 0) +
                        (s.presentation_score || 0) +
                        (s.usefulness_score || 0);

                      return (
                        <tr key={s.id} className="hover:bg-base/40 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-amber">{s.team_code}</div>
                            <div className="text-content font-medium">{s.team_name}</div>
                          </td>

                          <td className="p-3 text-center font-mono">{s.innovation_score}</td>
                          <td className="p-3 text-center font-mono">{s.execution_score}</td>
                          <td className="p-3 text-center font-mono">{s.presentation_score}</td>
                          <td className="p-3 text-center font-mono">{s.usefulness_score}</td>

                          <td className="p-3 text-center font-bold text-amber font-mono text-sm">
                            {total}
                          </td>

                          <td className="p-3 text-subtle text-[11px] max-w-xs truncate">
                            {s.notes || "—"}
                          </td>

                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTeamId(s.team_id);
                                setActiveTab("matrix");
                              }}
                              className="px-2.5 py-1 text-[11px] text-amber border border-amber/50 hover:bg-amber/10 transition-colors"
                            >
                              Edit Score &rarr;
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

        {/* TAB 3: RUBRIC GUIDELINES */}
        {activeTab === "rubric_guide" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border border-hairline bg-panel space-y-3">
              <div className="text-xs font-bold text-amber uppercase">// 1. INNOVATION & NOVELTY (10 PTS)</div>
              <ul className="text-xs text-muted space-y-2 list-disc pl-4 leading-relaxed">
                <li><strong className="text-content">9–10 pts:</strong> Highly unique, creative cybersecurity or AI solution with groundbreaking methodology.</li>
                <li><strong className="text-content">7–8 pts:</strong> Solid innovative feature set and fresh take on standard problem statements.</li>
                <li><strong className="text-content">4–6 pts:</strong> Standard implementation of existing open-source ideas with minor tweaks.</li>
                <li><strong className="text-content">0–3 pts:</strong> Trivial clone or direct copy of existing tutorial.</li>
              </ul>
            </div>

            <div className="p-6 border border-hairline bg-panel space-y-3">
              <div className="text-xs font-bold text-amber uppercase">// 2. TECHNICAL EXECUTION (10 PTS)</div>
              <ul className="text-xs text-muted space-y-2 list-disc pl-4 leading-relaxed">
                <li><strong className="text-content">9–10 pts:</strong> Clean architecture, robust error handling, fully working demo, and secure practices.</li>
                <li><strong className="text-content">7–8 pts:</strong> Functioning core features with reasonable code quality and architectural structure.</li>
                <li><strong className="text-content">4–6 pts:</strong> Partial implementation with bugs, mock data, or unstable features.</li>
                <li><strong className="text-content">0–3 pts:</strong> Non-functional project or broken repository.</li>
              </ul>
            </div>

            <div className="p-6 border border-hairline bg-panel space-y-3">
              <div className="text-xs font-bold text-amber uppercase">// 3. PRESENTATION & PITCH (10 PTS)</div>
              <ul className="text-xs text-muted space-y-2 list-disc pl-4 leading-relaxed">
                <li><strong className="text-content">9–10 pts:</strong> Exceptional pitch delivery, compelling live demonstration, and articulate Q&A responses.</li>
                <li><strong className="text-content">7–8 pts:</strong> Clear slide presentation and good explanation of core ideas.</li>
                <li><strong className="text-content">4–6 pts:</strong> Disorganized presentation, time management issues, or weak live demo.</li>
                <li><strong className="text-content">0–3 pts:</strong> Incomplete slides or inability to explain how the project functions.</li>
              </ul>
            </div>

            <div className="p-6 border border-hairline bg-panel space-y-3">
              <div className="text-xs font-bold text-amber uppercase">// 4. PRACTICAL UTILITY & IMPACT (10 PTS)</div>
              <ul className="text-xs text-muted space-y-2 list-disc pl-4 leading-relaxed">
                <li><strong className="text-content">9–10 pts:</strong> High-impact, realistic deployment capability for campus, enterprise, or public cybersecurity.</li>
                <li><strong className="text-content">7–8 pts:</strong> Clear real-world user value and well-identified target audience.</li>
                <li><strong className="text-content">4–6 pts:</strong> Niche or limited practical utility.</li>
                <li><strong className="text-content">0–3 pts:</strong> Impractical or unfeasible solution.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
