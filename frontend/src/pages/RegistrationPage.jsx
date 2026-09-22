import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiClient } from "../api/client";
import { getProblemStatements } from "../api/problemStatements";

export default function RegistrationPage() {
  const location = useLocation();
  const [problemStatements, setProblemStatements] = useState([]);
  const [loadingPS, setLoadingPS] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState(() => ({
    team_name: "",
    team_size: 2,
    leader_name: location.state?.prefillName || "",
    leader_email: location.state?.prefillEmail || "",
    leader_phone: "",
    leader_college_id: "",
    leader_department: "",
    leader_year: "3rd Year",
    member2_name: "",
    member2_college_id: "",
    member2_email: "",
    member3_name: "",
    member3_college_id: "",
    member3_email: "",
    member4_name: "",
    member4_college_id: "",
    member4_email: "",
    problem_statement_id: "",
  }));

  useEffect(() => {
    async function loadPS() {
      try {
        const data = await getProblemStatements();
        setProblemStatements(data || []);
      } catch {
        setProblemStatements([]);
      } finally {
        setLoadingPS(false);
      }
    }
    loadPS();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "team_size" ? parseInt(value, 10) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.team_name.trim()) {
      setErrorMessage("Please enter your team name.");
      return;
    }
    if (!formData.leader_name.trim() || !formData.leader_email.trim() || !formData.leader_phone.trim()) {
      setErrorMessage("Please complete all required leader contact fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        problem_statement_id: formData.problem_statement_id || null,
        member2_name: formData.team_size >= 2 ? formData.member2_name : null,
        member2_college_id: formData.team_size >= 2 ? formData.member2_college_id : null,
        member2_email: formData.team_size >= 2 && formData.member2_email ? formData.member2_email.trim().toLowerCase() : null,
        member3_name: formData.team_size >= 3 ? formData.member3_name : null,
        member3_college_id: formData.team_size >= 3 ? formData.member3_college_id : null,
        member3_email: formData.team_size >= 3 && formData.member3_email ? formData.member3_email.trim().toLowerCase() : null,
        member4_name: formData.team_size >= 4 ? formData.member4_name : null,
        member4_college_id: formData.team_size >= 4 ? formData.member4_college_id : null,
        member4_email: formData.team_size >= 4 && formData.member4_email ? formData.member4_email.trim().toLowerCase() : null,
      };

      const res = await apiClient.post("/api/register", payload);
      setSuccessResult(res);
    } catch (err) {
      setErrorMessage(err.message || "Failed to register team. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center px-6 py-20 bg-base text-content font-mono">
        <div className="w-full max-w-xl border border-emerald-500/50 bg-panel/70 p-8 sm:p-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-500/60 bg-emerald-950/40 text-xs text-emerald-300 font-semibold">
            <span>✓ REGISTRATION COMPLETE</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
            You're All Set!
          </h1>

          <p className="text-xs text-muted leading-relaxed">
            We sent your team registration details to{" "}
            <strong className="text-content font-semibold">{successResult.leader_email}</strong>. Your team is officially confirmed and ready for CodeShield 2026.
          </p>

          <div className="p-4 border border-hairline bg-base text-xs space-y-1">
            <div className="text-subtle text-[10px] uppercase">OFFICIAL TEAM CODE:</div>
            <div className="text-lg font-bold text-cyan">{successResult.team_code}</div>
            <div className="text-subtle text-[11px]">
              Status: <span className="text-emerald-400 font-semibold">Confirmed & Active</span>
            </div>
          </div>

          <div className="pt-4 border-t border-hairline flex flex-wrap gap-4">
            <Link
              to="/login"
              className="px-4 py-2 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 transition-colors"
            >
              Sign In to Participant Dashboard &rarr;
            </Link>
            <Link
              to="/problem-statements"
              className="px-4 py-2 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors"
            >
              Browse Problem Statements &rarr;
            </Link>
            <Link
              to="/"
              className="px-4 py-2 text-xs text-content border border-hairline bg-panel hover:bg-panel/80 transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-base text-content font-mono py-12 px-6 sm:px-10 lg:px-12">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-hairline pb-6">
          <div className="text-xs font-semibold text-cyan uppercase mb-2">
            // OFFICIAL TEAM REGISTRATION &middot; CODESHIELD 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-content">
            Register Your Team
          </h1>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            Teams can have 2 to 4 members. The team leader will receive an email with full registration details upon submission.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-4 border border-amber/50 bg-amber/10 text-amber text-xs flex items-start gap-3"
          >
            <span className="font-bold text-sm leading-none">[!]</span>
            <div>{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="border border-hairline bg-panel/50 p-6 sm:p-8 space-y-8">
          {/* Section 1: Team Basics */}
          <div className="space-y-4">
            <div className="text-xs font-semibold text-cyan uppercase pb-2 border-b border-hairline/60">
              1. Team Overview
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="team_name" className="text-xs text-subtle font-semibold block uppercase">
                  Team Name *
                </label>
                <input
                  id="team_name"
                  type="text"
                  name="team_name"
                  value={formData.team_name}
                  onChange={handleChange}
                  placeholder="e.g. CyberKnights"
                  required
                  className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="team_size" className="text-xs text-subtle font-semibold block uppercase">
                  Team Size *
                </label>
                <select
                  id="team_size"
                  name="team_size"
                  value={formData.team_size}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                >
                  <option value={2}>2 Members</option>
                  <option value={3}>3 Members</option>
                  <option value={4}>4 Members</option>
                </select>
              </div>
            </div>

            {/* Problem Statement Select */}
            <div className="space-y-1 pt-2">
              <label htmlFor="problem_statement_id" className="text-xs text-subtle font-semibold block uppercase">
                Chosen Problem Statement (Optional / Can select later)
              </label>
              <select
                id="problem_statement_id"
                name="problem_statement_id"
                value={formData.problem_statement_id}
                onChange={handleChange}
                disabled={loadingPS}
                className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
              >
                <option value="">-- Select Problem Statement --</option>
                {problemStatements.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    [{ps.code}] {ps.title} ({ps.domain})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Team Leader Details */}
          <div className="space-y-4">
            <div className="text-xs font-semibold text-cyan uppercase pb-2 border-b border-hairline/60">
              2. Team Leader (Primary Contact)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="leader_name" className="text-xs text-subtle font-semibold block uppercase">
                  Full Name *
                </label>
                <input
                  id="leader_name"
                  type="text"
                  name="leader_name"
                  value={formData.leader_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Alex Mercer"
                  className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="leader_email" className="text-xs text-subtle font-semibold block uppercase">
                  Email Address * (Confirmation Sent Here)
                </label>
                <input
                  id="leader_email"
                  type="email"
                  name="leader_email"
                  value={formData.leader_email}
                  onChange={handleChange}
                  required
                  placeholder="leader@college.edu"
                  className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="leader_phone" className="text-xs text-subtle font-semibold block uppercase">
                  Phone Number *
                </label>
                <input
                  id="leader_phone"
                  type="tel"
                  name="leader_phone"
                  value={formData.leader_phone}
                  onChange={handleChange}
                  required
                  placeholder="+91 9876543210"
                  className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="leader_college_id" className="text-xs text-subtle font-semibold block uppercase">
                  Roll / College ID *
                </label>
                <input
                  id="leader_college_id"
                  type="text"
                  name="leader_college_id"
                  value={formData.leader_college_id}
                  onChange={handleChange}
                  required
                  placeholder="7376222CS101"
                  className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="leader_department" className="text-xs text-subtle font-semibold block uppercase">
                  Department *
                </label>
                <input
                  id="leader_department"
                  type="text"
                  name="leader_department"
                  value={formData.leader_department}
                  onChange={handleChange}
                  required
                  placeholder="Computer Science & Engineering"
                  className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="leader_year" className="text-xs text-subtle font-semibold block uppercase">
                  Year of Study *
                </label>
                <select
                  id="leader_year"
                  name="leader_year"
                  value={formData.leader_year}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Team Members */}
          <div className="space-y-4">
            <div className="text-xs font-semibold text-cyan uppercase pb-2 border-b border-hairline/60">
              3. Team Members
            </div>

            {/* Member 2 */}
            <div className="p-4 border border-hairline bg-base/50 space-y-3">
              <div className="text-xs text-subtle font-semibold uppercase">Member 2</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  name="member2_name"
                  value={formData.member2_name}
                  onChange={handleChange}
                  placeholder="Member 2 Full Name"
                  className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none"
                />
                <input
                  type="text"
                  name="member2_college_id"
                  value={formData.member2_college_id}
                  onChange={handleChange}
                  placeholder="Roll / College ID"
                  className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none"
                />
                <input
                  type="email"
                  name="member2_email"
                  value={formData.member2_email}
                  onChange={handleChange}
                  placeholder="member2@bitsathy.ac.in"
                  className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none"
                />
              </div>
            </div>

            {/* Member 3 */}
            {formData.team_size >= 3 && (
              <div className="p-4 border border-hairline bg-base/50 space-y-3">
                <div className="text-xs text-subtle font-semibold uppercase">Member 3</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    name="member3_name"
                    value={formData.member3_name}
                    onChange={handleChange}
                    placeholder="Member 3 Full Name"
                    className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none"
                  />
                  <input
                    type="text"
                    name="member3_college_id"
                    value={formData.member3_college_id}
                    onChange={handleChange}
                    placeholder="Roll / College ID"
                    className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none"
                  />
                  <input
                    type="email"
                    name="member3_email"
                    value={formData.member3_email}
                    onChange={handleChange}
                    placeholder="member3@bitsathy.ac.in"
                    className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Member 4 */}
            {formData.team_size >= 4 && (
              <div className="p-4 border border-hairline bg-base/50 space-y-3">
                <div className="text-xs text-subtle font-semibold uppercase">Member 4</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    name="member4_name"
                    value={formData.member4_name}
                    onChange={handleChange}
                    placeholder="Member 4 Full Name"
                    className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none"
                  />
                  <input
                    type="text"
                    name="member4_college_id"
                    value={formData.member4_college_id}
                    onChange={handleChange}
                    placeholder="Roll / College ID"
                    className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none"
                  />
                  <input
                    type="email"
                    name="member4_email"
                    value={formData.member4_email}
                    onChange={handleChange}
                    placeholder="member4@bitsathy.ac.in"
                    className="w-full px-3 py-2 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 text-xs font-bold uppercase tracking-wider text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:opacity-50"
          >
            {submitting ? "Registering Team..." : "Submit Registration &rarr;"}
          </button>
        </form>
      </div>
    </div>
  );
}
