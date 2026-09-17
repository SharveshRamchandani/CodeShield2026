import { useState, useEffect, useMemo, useCallback } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function JudgePage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subsData, scoresData] = await Promise.all([
        apiClient.get("/api/submissions/").catch(() => []),
        apiClient.get("/api/scores/").catch(() => []),
      ]);
      setSubmissions(subsData || []);
      setScores(scoresData || []);
    } catch {
      setStatusMessage({ type: "error", text: "Failed to load submissions or scores." });
    } finally {
      setLoading(false);
    }
  }, []);

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

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
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
  }, [submissions, searchQuery]);

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

  const handleScoreSubmit = async (e) => {
    e.preventDefault();
    if (!activeTeamId) return;

    setSubmittingScore(true);
    setStatusMessage(null);

    try {
      await apiClient.post("/api/scores/", {
        team_id: activeTeamId,
        innovation_score: Number(formState.innovation_score),
        execution_score: Number(formState.execution_score),
        presentation_score: Number(formState.presentation_score),
        usefulness_score: Number(formState.usefulness_score),
        notes: formState.notes?.trim() || null,
      });

      setStatusMessage({ type: "success", text: "Evaluation saved successfully!" });
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

  return (
    <div className="w-full min-h-screen bg-base text-content font-mono">
      {/* Page Header */}
      <section className="w-full border-b border-hairline px-6 sm:px-10 lg:px-12 py-10 bg-panel/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-semibold text-cyan uppercase mb-2">
              // JUDGING &amp; EVALUATION PORTAL
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-content">
              Panel Evaluation
            </h1>
            <p className="text-xs text-muted mt-1">
              Review project deliverables, source code repositories, and record evaluation criteria.
            </p>
          </div>

          <div className="flex items-center gap-4 border border-hairline bg-panel/70 px-4 py-2.5 text-xs">
            <span className="text-subtle">ACTIVE JUDGE:</span>
            <span className="text-cyan font-semibold">{user?.name || user?.email}</span>
            <span className="px-2 py-0.5 text-[10px] bg-cyan/20 text-cyan uppercase font-bold">
              JUDGE
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="w-full px-6 sm:px-10 lg:px-12 py-8 max-w-7xl mx-auto">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-hairline text-xs">
          <div className="flex items-center gap-4">
            <span className="text-subtle">
              SUBMISSIONS // {filteredSubmissions.length} AVAILABLE
            </span>
            <span className="text-cyan">
              {scores.length} OF {submissions.length} EVALUATED
            </span>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by team, code or PS..."
              className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan placeholder-subtle transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-muted">
            <div className="inline-flex items-center gap-3">
              <div className="w-3 h-3 border-2 border-cyan border-t-transparent animate-spin" />
              <span>LOADING SUBMISSION QUEUE...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Submissions List */}
            <div className="lg:col-span-7 space-y-4">
              {filteredSubmissions.length === 0 ? (
                <div className="p-8 border border-hairline bg-panel/30 text-center text-xs text-muted">
                  No submissions match your query.
                </div>
              ) : (
                filteredSubmissions.map((sub) => {
                  const isSelected = activeTeamId === sub.team_id;
                  const existingScore = scoresByTeamId[sub.team_id];
                  const totalScore = existingScore
                    ? existingScore.innovation_score +
                      existingScore.execution_score +
                      existingScore.presentation_score +
                      existingScore.usefulness_score
                    : null;

                  return (
                    <div
                      key={sub.id}
                      onClick={() => handleSelectTeam(sub)}
                      className={`p-5 border cursor-pointer transition-all ${
                        isSelected
                          ? "border-cyan bg-panel/60 shadow-sm"
                          : "border-hairline bg-panel/30 hover:border-hairline/80 hover:bg-panel/50"
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-hairline/60">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 text-xs font-bold text-zinc-950 bg-cyan">
                            {sub.team_code}
                          </span>
                          <span className="text-sm font-bold text-content">{sub.team_name}</span>
                        </div>

                        {existingScore ? (
                          <div className="flex items-center gap-2 text-xs text-cyan">
                            <span>SCORED:</span>
                            <strong className="font-bold text-content">{totalScore} / 40</strong>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber font-medium">
                            [PENDING EVALUATION]
                          </span>
                        )}
                      </div>

                      {/* Problem Statement Tag */}
                      {sub.problem_statement_code && (
                        <div className="text-xs text-muted mb-2">
                          <span className="text-cyan font-semibold">{sub.problem_statement_code}</span>:{" "}
                          <span>{sub.problem_statement_title}</span>
                        </div>
                      )}

                      {/* Idea Title & Summary */}
                      <h4 className="text-sm font-semibold text-content mb-1">{sub.idea_title}</h4>
                      <p className="text-xs text-muted line-clamp-2 leading-relaxed mb-4">
                        {sub.idea_description}
                      </p>

                      {/* Links Row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-hairline/40">
                        {sub.repo_url && (
                          <a
                            href={sub.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-cyan hover:underline flex items-center gap-1"
                          >
                            &rarr; Repository
                          </a>
                        )}
                        {sub.deck_file_url && (
                          <a
                            href={sub.deck_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-cyan hover:underline flex items-center gap-1"
                          >
                            &rarr; Pitch Deck
                          </a>
                        )}
                        <span className="text-subtle ml-auto text-[11px]">
                          Submitted: {new Date(sub.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right: Scoring Form */}
            <div className="lg:col-span-5 sticky top-24">
              {activeTeamId ? (
                <form
                  onSubmit={handleScoreSubmit}
                  className="border border-cyan bg-panel/70 p-6 space-y-6"
                >
                  <div className="pb-4 border-b border-hairline">
                    <div className="text-xs text-cyan uppercase font-semibold mb-1">
                      // SCORING RUBRIC &middot; 40 PTS MAX
                    </div>
                    <h3 className="text-base font-bold text-content">
                      {submissions.find((s) => s.team_id === activeTeamId)?.team_name || "Team Score"}
                    </h3>
                  </div>

                  {statusMessage && (
                    <div
                      role="alert"
                      className={`p-3 text-xs border ${
                        statusMessage.type === "success"
                          ? "border-cyan/50 bg-cyan/10 text-cyan"
                          : "border-amber/50 bg-amber/10 text-amber"
                      }`}
                    >
                      {statusMessage.text}
                    </div>
                  )}

                  {/* Criteria 1: Innovation */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="innovation-score" className="text-content font-semibold">
                        Innovation &amp; Originality (0–10)
                      </label>
                      <span className="text-cyan font-bold">{formState.innovation_score} / 10</span>
                    </div>
                    <input
                      id="innovation-score"
                      type="range"
                      min="0"
                      max="10"
                      value={formState.innovation_score}
                      onChange={(e) =>
                        setFormState({ ...formState, innovation_score: e.target.value })
                      }
                      className="w-full accent-cyan cursor-pointer"
                    />
                  </div>

                  {/* Criteria 2: Execution */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="execution-score" className="text-content font-semibold">
                        Technical Execution &amp; Code (0–10)
                      </label>
                      <span className="text-cyan font-bold">{formState.execution_score} / 10</span>
                    </div>
                    <input
                      id="execution-score"
                      type="range"
                      min="0"
                      max="10"
                      value={formState.execution_score}
                      onChange={(e) =>
                        setFormState({ ...formState, execution_score: e.target.value })
                      }
                      className="w-full accent-cyan cursor-pointer"
                    />
                  </div>

                  {/* Criteria 3: Presentation */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="presentation-score" className="text-content font-semibold">
                        Presentation &amp; Demo (0–10)
                      </label>
                      <span className="text-cyan font-bold">{formState.presentation_score} / 10</span>
                    </div>
                    <input
                      id="presentation-score"
                      type="range"
                      min="0"
                      max="10"
                      value={formState.presentation_score}
                      onChange={(e) =>
                        setFormState({ ...formState, presentation_score: e.target.value })
                      }
                      className="w-full accent-cyan cursor-pointer"
                    />
                  </div>

                  {/* Criteria 4: Usefulness */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="usefulness-score" className="text-content font-semibold">
                        Practical Impact &amp; Usability (0–10)
                      </label>
                      <span className="text-cyan font-bold">{formState.usefulness_score} / 10</span>
                    </div>
                    <input
                      id="usefulness-score"
                      type="range"
                      min="0"
                      max="10"
                      value={formState.usefulness_score}
                      onChange={(e) =>
                        setFormState({ ...formState, usefulness_score: e.target.value })
                      }
                      className="w-full accent-cyan cursor-pointer"
                    />
                  </div>

                  {/* Notes / Feedback */}
                  <div className="space-y-2">
                    <label htmlFor="score-notes" className="text-xs uppercase text-subtle font-semibold block">
                      Judge Feedback &amp; Notes
                    </label>
                    <textarea
                      id="score-notes"
                      rows="3"
                      value={formState.notes}
                      onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                      placeholder="Constructive feedback for the team..."
                      className="w-full p-3 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan placeholder-subtle transition-colors"
                    />
                  </div>

                  {/* Summary & Submit */}
                  <div className="pt-2 border-t border-hairline flex items-center justify-between">
                    <div className="text-xs font-bold text-content">
                      TOTAL:{" "}
                      <span className="text-cyan text-sm">
                        {Number(formState.innovation_score) +
                          Number(formState.execution_score) +
                          Number(formState.presentation_score) +
                          Number(formState.usefulness_score)}{" "}
                        / 40
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingScore}
                      className="px-5 py-2.5 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors disabled:opacity-50"
                    >
                      {submittingScore ? "Saving..." : "Save Evaluation"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="border border-hairline bg-panel/30 p-8 text-center text-xs text-muted space-y-2">
                  <div className="text-cyan font-semibold">// SELECT A SUBMISSION</div>
                  <p>Click on any team from the queue on the left to evaluate deliverables and record scores.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
