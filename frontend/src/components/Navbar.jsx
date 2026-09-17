import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();

  const navLinks = [
    { label: "Problem Statements", path: "/problem-statements" },
    { label: "Schedule", path: "/schedule" },
    { label: "Register", path: "/register", highlight: true },
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
              // Sun Icon
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
              // Moon Icon
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
        <div className="md:hidden border-t border-hairline bg-base px-6 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`text-sm font-mono py-2 transition-colors ${
                link.highlight
                  ? "text-cyan font-semibold"
                  : "text-muted hover:text-content"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
