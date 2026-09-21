import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "317519964205-ci2ugcntg0hbkq8qgcbhifjhmt5tgsoo.apps.googleusercontent.com";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState("staff"); // 'staff' | 'team'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { login, loginWithToken, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleBtnRef = useRef(null);

  const from = location.state?.from?.pathname;

  const navigateUserByRole = useCallback(
    (role) => {
      const roleAllowedPaths = {
        admin: ["/admin", "/judge", "/leader", "/member", "/dashboard", "/problem-statements", "/schedule"],
        judge: ["/judge", "/problem-statements", "/schedule"],
        leader: ["/leader", "/dashboard", "/problem-statements", "/schedule"],
        member: ["/member", "/dashboard", "/problem-statements", "/schedule"],
      };

      const isPathAllowed = from && roleAllowedPaths[role]?.some((path) => from.startsWith(path));

      if (from && isPathAllowed) {
        navigate(from, { replace: true });
      } else if (role === "admin") {
        navigate("/admin", { replace: true });
      } else if (role === "judge") {
        navigate("/judge", { replace: true });
      } else if (role === "leader") {
        navigate("/leader", { replace: true });
      } else if (role === "member") {
        navigate("/member", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    },
    [from, navigate]
  );

  // Handle GIS Response (Unified auto-routing)
  const handleGoogleResponse = useCallback(
    async (response) => {
      setErrorMessage("");
      setSubmitting(true);
      try {
        const res = await apiClient.post("/api/auth/google", {
          credential: response.credential,
        });

        if (res.needs_registration) {
          navigate("/register", {
            state: {
              prefillEmail: res.email,
              prefillName: res.name,
            },
          });
          return;
        }

        if (res.access_token) {
          await loginWithToken(res);
          navigateUserByRole(res.role);
        }
      } catch (err) {
        setErrorMessage(
          err.message ||
            "Google sign-in failed. Please verify your account and try again."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [loginWithToken, navigateUserByRole, navigate]
  );


  // Initialize Google Identity Services button on tab change
  useEffect(() => {
    let timer;
    const initGoogle = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleResponse,
            auto_select: false,
          });

          googleBtnRef.current.innerHTML = ""; // Clear existing button before re-rendering
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "filled_black",
            size: "large",
            width: googleBtnRef.current.offsetWidth || 340,
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left",
          });
        } catch {
          // Handled gracefully
        }
      }
    };

    timer = setTimeout(initGoogle, 150);
    return () => clearTimeout(timer);
  }, [activeTab, handleGoogleResponse]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setSubmitting(true);
    try {
      if (activeTab === "staff") {
        // Staff Login (Admin / Judge)
        const res = await login(email.trim(), password, "staff");
        navigateUserByRole(res.role);
      } else {
        // Team Leader Login
        const res = await login(email.trim(), password, "team");
        navigateUserByRole(res.role || "leader");
      }
    } catch (err) {
      setErrorMessage(
        err.status === 401
          ? "Invalid email or password. Please verify your credentials."
          : err.message || "Failed to authenticate. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // If already authenticated, show status
  if (isAuthenticated && user) {
    return (
      <div className="w-full max-w-lg mx-auto px-6 py-24 min-h-[60vh] flex flex-col items-center justify-center font-mono text-center">
        <div className="p-6 border border-hairline bg-panel/60 w-full space-y-4">
          <div className="text-xs text-cyan font-semibold">// SESSION ACTIVE</div>
          <p className="text-sm text-content">
            You are logged in as <strong className="text-cyan">{user.name || user.email}</strong> (
            {user.role}).
          </p>
          {user.team_code && (
            <div className="text-xs text-subtle">
              TEAM: <span className="text-cyan font-bold">{user.team_code}</span> ({user.team_name})
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => navigateUserByRole(user.role)}
              className="px-5 py-2.5 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors"
            >
              &rarr; Go to{" "}
              {user.role === "admin"
                ? "Admin Portal"
                : user.role === "judge"
                ? "Judge Portal"
                : user.role === "leader"
                ? "Leader Dashboard"
                : user.role === "member"
                ? "Member Portal"
                : "Team Dashboard"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-16 bg-base text-content font-mono">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-left">
          <div className="text-xs font-semibold text-cyan uppercase mb-2">
            // AUTHORIZED ACCESS PORTAL
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-content">Sign In</h1>
          <p className="text-xs text-muted mt-1">
            Access CodeShield 2026 across all three authenticated roles.
          </p>
        </div>

        {/* 3 Roles Showcase */}
        <div className="grid grid-cols-3 gap-2 mb-6 text-left">
          <div
            onClick={() => {
              setActiveTab("staff");
              setErrorMessage("");
            }}
            className={`p-2.5 border cursor-pointer transition-all ${
              activeTab === "staff"
                ? "border-cyan/70 bg-panel"
                : "border-hairline bg-panel/30 hover:border-hairline/80"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              <span className="text-[11px] font-bold text-cyan">ADMIN</span>
            </div>
            <div className="text-[10px] text-muted leading-tight">
              Console, Teams, CSV & Attendance
            </div>
          </div>

          <div
            onClick={() => {
              setActiveTab("staff");
              setErrorMessage("");
            }}
            className={`p-2.5 border cursor-pointer transition-all ${
              activeTab === "staff"
                ? "border-cyan/70 bg-panel"
                : "border-hairline bg-panel/30 hover:border-hairline/80"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber" />
              <span className="text-[11px] font-bold text-amber">JUDGE</span>
            </div>
            <div className="text-[10px] text-muted leading-tight">
              Rubric Scoring & Deliverable Reviews
            </div>
          </div>

          <div
            onClick={() => {
              setActiveTab("team");
              setErrorMessage("");
            }}
            className={`p-2.5 border cursor-pointer transition-all ${
              activeTab === "team"
                ? "border-cyan/70 bg-panel"
                : "border-hairline bg-panel/30 hover:border-hairline/80"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-400">LEADER</span>
            </div>
            <div className="text-[10px] text-muted leading-tight">
              Deliverables & Team Submissions
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-4 border-b border-hairline mb-6 pb-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("staff");
              setErrorMessage("");
            }}
            className={`transition-colors ${
              activeTab === "staff"
                ? "text-cyan font-bold border-b-2 border-cyan pb-1"
                : "text-muted hover:text-content"
            }`}
          >
            [STAFF LOGIN &middot; ADMIN / JUDGE]
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("team");
              setErrorMessage("");
            }}
            className={`transition-colors ${
              activeTab === "team"
                ? "text-cyan font-bold border-b-2 border-cyan pb-1"
                : "text-muted hover:text-content"
            }`}
          >
            [TEAM LEADER LOGIN]
          </button>
        </div>


        {/* Error Alert Box */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 border border-amber/40 bg-amber/10 text-amber text-xs leading-relaxed flex items-start gap-3"
          >
            <span className="font-bold text-sm leading-none">[!]</span>
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Form Card */}
        <div className="border border-hairline bg-panel/60 p-6 sm:p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="text-xs uppercase text-subtle font-semibold block"
              >
                {activeTab === "staff" ? "Staff Email Address" : "Team Leader Email Address"}
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={activeTab === "staff" ? "admin@codeshield.org" : "leader@bitsathy.ac.in"}
                required
                disabled={submitting}
                autoComplete="email"
                className="w-full px-3.5 py-2.5 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan placeholder-subtle transition-colors"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="text-xs uppercase text-subtle font-semibold block"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={submitting}
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 text-xs bg-base text-content border border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan placeholder-subtle transition-colors"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-xs font-bold uppercase tracking-wider text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Authenticating..." : "Sign In with Password \u2192"}
            </button>
          </form>

          {/* Google Sign In Option for Both Staff and Team */}
          <div className="pt-4 border-t border-hairline/60 space-y-4">
            <div className="relative text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-hairline/60" />
              </div>
              <span className="relative px-3 bg-panel text-[11px] text-subtle uppercase">
                // OR SIGN IN WITH GOOGLE
              </span>
            </div>

            <div className="flex flex-col items-center justify-center pt-1">
              <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
              <span className="text-[10px] text-subtle mt-2 text-center">
                {activeTab === "team"
                  ? "* Restricted to verified @bitsathy.ac.in accounts"
                  : "* Registered staff email addresses"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-subtle">
          Protected evaluation network &middot; Cyber Club BIT
        </div>
      </div>
    </div>
  );
}

