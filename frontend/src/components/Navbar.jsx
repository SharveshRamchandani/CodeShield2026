import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navLinks = [
    { label: "Problem Statements", path: "/problem-statements" },
    { label: "FAQ", path: "/faq" },
    { label: "Schedule", path: "/schedule" },
    ...(!isAuthenticated ? [{ label: "Register", path: "/login", highlight: true }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-base/90 backdrop-blur-md border-b border-hairline transition-colors">
      {/* Skip to Content for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan focus:text-zinc-950 focus:font-mono focus:text-xs font-bold"
      >
        Skip to main content
      </a>

      <div className="w-full px-6 sm:px-10 lg:px-12 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <Link
          to="/"
          className="flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-content hover:text-cyan transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          aria-label="CodeShield 2026 Home"
        >
          <span className="font-mono text-cyan text-sm">&gt;_</span>
          <span>
            CodeShield <span className="font-mono text-xs font-normal text-muted">2026</span>
          </span>
        </Link>

        {/* Desktop Navigation & Theme Toggle */}
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-6" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              if (link.highlight) {
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="px-3.5 py-1.5 text-xs font-mono font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2"
                  >
                    {link.label}
                  </Link>
                );
              }
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
                    isActive
                      ? "text-cyan font-medium"
                      : "text-muted hover:text-content"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Role-Specific Navigation Links */}
            {isAuthenticated && user?.role === "admin" && (
              <Link
                to="/admin"
                className={`text-xs font-mono px-2.5 py-1 border border-cyan/40 bg-cyan/10 transition-colors ${
                  location.pathname === "/admin"
                    ? "text-cyan font-bold border-cyan"
                    : "text-cyan hover:bg-cyan/20"
                }`}
              >
                ADMIN DASHBOARD
              </Link>
            )}

            {isAuthenticated && user?.role === "judge" && (
              <Link
                to="/judge"
                className={`text-xs font-mono px-2.5 py-1 border border-cyan/40 bg-cyan/10 transition-colors ${
                  location.pathname === "/judge"
                    ? "text-cyan font-bold border-cyan"
                    : "text-cyan hover:bg-cyan/20"
                }`}
              >
                JUDGE PORTAL
              </Link>
            )}

            {isAuthenticated && user?.role === "leader" && (
              <Link
                to="/leader"
                className={`text-xs font-mono px-2.5 py-1 border border-emerald-500/40 bg-emerald-950/30 transition-colors ${
                  location.pathname === "/leader" || location.pathname === "/dashboard"
                    ? "text-emerald-400 font-bold border-emerald-400"
                    : "text-emerald-400 hover:bg-emerald-950/50"
                }`}
              >
                LEADER PORTAL
              </Link>
            )}

            {isAuthenticated && user?.role === "member" && (
              <Link
                to="/member"
                className={`text-xs font-mono px-2.5 py-1 border border-cyan/40 bg-cyan/10 transition-colors ${
                  location.pathname === "/member" || location.pathname === "/dashboard"
                    ? "text-cyan font-bold border-cyan"
                    : "text-cyan hover:bg-cyan/20"
                }`}
              >
                MEMBER PORTAL
              </Link>
            )}

            {/* Auth Session Action (Login / Logout) */}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-mono text-muted hover:text-amber transition-colors"
                title={`Logged in as ${user?.name || user?.email} (${user?.role})`}
              >
                [LOGOUT]
              </button>
            ) : (
              <Link
                to="/login"
                className={`text-xs font-mono transition-colors ${
                  location.pathname === "/login"
                    ? "text-cyan font-bold"
                    : "text-muted hover:text-content"
                }`}
              >
                [SIGN IN]
              </Link>
            )}
          </nav>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 border border-hairline bg-panel/60 text-muted hover:text-content hover:border-cyan/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Controls (Toggle + Hamburger) */}
        <div className="md:hidden flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 border border-hairline bg-panel/60 text-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <span className="font-mono text-xs text-cyan">
              {mobileMenuOpen ? "[CLOSE]" : "[MENU]"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-hairline bg-base px-6 py-4 flex flex-col gap-4 font-mono text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`py-1.5 transition-colors ${
                link.highlight
                  ? "text-cyan font-semibold"
                  : "text-muted hover:text-content"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {isAuthenticated && user?.role === "admin" && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 text-cyan font-bold"
            >
              &rarr; Admin Dashboard
            </Link>
          )}

          {isAuthenticated && user?.role === "judge" && (
            <Link
              to="/judge"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 text-cyan font-bold"
            >
              &rarr; Judge Portal
            </Link>
          )}

          {isAuthenticated && user?.role === "leader" && (
            <Link
              to="/leader"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 text-emerald-400 font-bold"
            >
              &rarr; Leader Dashboard
            </Link>
          )}

          {isAuthenticated && user?.role === "member" && (
            <Link
              to="/member"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 text-cyan font-bold"
            >
              &rarr; Member Portal
            </Link>
          )}

          <div className="pt-2 border-t border-hairline flex items-center justify-between text-xs">
            {isAuthenticated ? (
              <>
                <span className="text-subtle">
                  User: {user?.name || user?.email} ({user?.role})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="text-amber hover:underline"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-cyan hover:underline"
              >
                Sign In &rarr;
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
