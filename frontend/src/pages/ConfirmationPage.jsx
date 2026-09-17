import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../api/client";

export default function ConfirmationPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function confirmTeam() {
      if (!token) {
        setError("Missing confirmation token.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await apiClient.get(`/api/confirm/${token}`);
        if (isMounted) {
          setResult(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Invalid or expired confirmation token.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    confirmTeam();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="w-full min-h-[70vh] flex flex-col items-center justify-center px-6 py-20 bg-base text-content font-mono">
      <div className="w-full max-w-xl border border-hairline bg-panel/60 p-8 sm:p-10 space-y-6">
        {loading ? (
          <div className="py-12 text-center text-xs text-muted space-y-3">
            <div className="w-4 h-4 border-2 border-cyan border-t-transparent animate-spin mx-auto" />
            <div>// VERIFYING CONFIRMATION TOKEN...</div>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber/50 bg-amber/10 text-xs text-amber font-medium">
              <span>[!] CONFIRMATION FAILED</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
              Unable to Confirm Team
            </h1>
            <p className="text-xs text-muted leading-relaxed">{error}</p>
            <div className="pt-4 border-t border-hairline flex gap-4">
              <Link
                to="/register"
                className="px-4 py-2 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors"
              >
                Register Again &rarr;
              </Link>
              <Link
                to="/"
                className="px-4 py-2 text-xs text-content border border-hairline bg-panel hover:bg-panel/80 transition-colors"
              >
                Return Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyan/50 bg-cyan/10 text-xs text-cyan font-semibold">
              <span>✓ REGISTRATION CONFIRMED</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
              Welcome to CodeShield 2026!
            </h1>

            <p className="text-xs text-muted leading-relaxed">
              Your team registration for{" "}
              <strong className="text-content font-bold">{result?.team_name || "your team"}</strong>{" "}
              has been successfully verified and confirmed.
            </p>

            {result?.team_code && (
              <div className="p-4 border border-cyan/40 bg-base text-xs space-y-1">
                <div className="text-subtle text-[10px] uppercase">YOUR OFFICIAL TEAM CODE:</div>
                <div className="text-lg font-bold text-cyan tracking-wider">{result.team_code}</div>
                <div className="text-subtle text-[11px]">
                  Keep this code handy for check-in and project deliverables submission.
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-hairline flex flex-wrap gap-4">
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
        )}
      </div>
    </div>
  );
}
