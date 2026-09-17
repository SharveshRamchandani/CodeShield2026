import { useState, useEffect, useMemo } from "react";
import { getProblemStatements } from "../api/problemStatements";

export default function ProblemStatementsPage() {
  const [problemStatements, setProblemStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const data = await getProblemStatements();
        if (isMounted) {
          setProblemStatements(data || []);
        }
      } catch {
        if (isMounted) {
          setProblemStatements([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const domainOptions = [
    { label: "All", value: "All" },
    { label: "Cybersecurity", value: "Cybersecurity" },
    { label: "Innovation & Emerging Tech", value: "Innovation & Emerging Technologies" },
  ];

  // Filtered problem statements
  const filteredList = useMemo(() => {
    return problemStatements.filter((item) => {
      const matchesDomain =
        selectedDomain === "All" || item.domain === selectedDomain;

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.code?.toLowerCase().includes(q) ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);

      return matchesDomain && matchesSearch;
    });
  }, [problemStatements, selectedDomain, searchQuery]);

  const toggleExpand = (identifier) => {
    setExpandedId((prev) => (prev === identifier ? null : identifier));
  };

  const handleKeyDown = (e, identifier) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpand(identifier);
    }
  };

  return (
    <div className="w-full flex flex-col bg-base text-content">
      {/* Page Header */}
      <section
        id="main-content"
        className="w-full border-b border-hairline px-6 sm:px-10 lg:px-12 pt-16 pb-12"
      >
        <div className="max-w-6xl mx-auto flex flex-col items-start">
          <div className="text-xs font-mono uppercase text-cyan font-semibold mb-3">
            // CATALOG &middot; 32 PROBLEM STATEMENTS
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-content leading-none mb-4">
            Problem Statements
          </h1>
          <p className="text-base sm:text-lg text-muted font-normal max-w-2xl leading-relaxed">
            Explore the 32 official challenge briefs for CodeShield 2026 across Cybersecurity and Innovation &amp; Emerging Technologies.
          </p>
        </div>
      </section>

      {/* Filter and Search Controls Bar */}
      <section className="w-full border-b border-hairline bg-panel/40 px-6 sm:px-10 lg:px-12 py-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Domain Filter Toggles (Plain text toggles, no button-pills) */}
          <div
            role="tablist"
            aria-label="Filter by domain"
            className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-xs sm:text-sm"
          >
            <span className="text-subtle uppercase text-xs">// TRACK:</span>
            {domainOptions.map((opt) => {
              const isSelected = selectedDomain === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedDomain(opt.value)}
                  className={`transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
                    isSelected
                      ? "text-cyan font-semibold border-b-2 border-cyan pb-0.5"
                      : "text-muted hover:text-content"
                  }`}
                >
                  [{opt.label}]
                </button>
              );
            })}
          </div>

          {/* Live Search Input */}
          <div className="w-full lg:w-80">
            <label htmlFor="ps-search" className="sr-only">
              Search by title or code
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none font-mono text-xs text-subtle">
                /
              </span>
              <input
                id="ps-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or code..."
                className="w-full pl-7 pr-4 py-2 text-xs font-mono bg-base text-content border border-hairline hover:border-hairline focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan placeholder-subtle transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-3 flex items-center font-mono text-xs text-muted hover:text-content"
                  aria-label="Clear search"
                >
                  [clear]
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statements List */}
      <section className="w-full px-6 sm:px-10 lg:px-12 py-12 min-h-[50vh]">
        <div className="max-w-6xl mx-auto">
          {/* Status Header count */}
          <div className="flex items-center justify-between pb-4 mb-2 border-b border-hairline font-mono text-xs text-muted">
            <span>RESULTS // {filteredList.length} OF {problemStatements.length} STATEMENTS</span>
            <span className="text-subtle hidden sm:inline">CLICK ROW TO EXPAND</span>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-16 text-center font-mono text-xs text-muted">
              loading problem statements...
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredList.length === 0 && (
            <div className="py-16 text-center font-mono text-xs text-muted space-y-2">
              <div>no problem statements match your filter.</div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDomain("All");
                  setSearchQuery("");
                }}
                className="text-cyan underline hover:text-cyan-hover"
              >
                Reset filters
              </button>
            </div>
          )}

          {/* List Rows */}
          {!loading && (
            <div className="divide-y divide-hairline border-b border-hairline">
              {filteredList.map((item) => {
                const itemKey = item.code;
                const isExpanded = expandedId === itemKey;

                return (
                  <div
                    key={itemKey}
                    className={`transition-colors ${
                      isExpanded ? "bg-panel/30" : "hover:bg-panel/20"
                    }`}
                  >
                    {/* Row Header (Clickable & Keyboard Accessible) */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpand(itemKey)}
                      onKeyDown={(e) => handleKeyDown(e, itemKey)}
                      className="w-full py-4 sm:py-5 px-2 sm:px-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                    >
                      {/* Left: Code + Title */}
                      <div className="flex items-start sm:items-center gap-4 flex-grow min-w-0">
                        <span className="font-mono text-xs sm:text-sm font-semibold text-cyan w-16 sm:w-20 shrink-0">
                          {item.code}
                        </span>
                        <span className="text-base sm:text-lg font-bold text-content tracking-tight">
                          {item.title}
                        </span>
                      </div>

                      {/* Right: Domain Label + Expand Indicator */}
                      <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 pl-20 md:pl-0">
                        <span className="text-xs font-mono text-muted uppercase">
                          {item.domain === "Cybersecurity"
                            ? "Cybersecurity"
                            : "Innovation & Emerging Tech"}
                        </span>
                        <span className="font-mono text-xs text-cyan shrink-0 w-6 text-right">
                          {isExpanded ? "[-]" : "[+]"}
                        </span>
                      </div>
                    </div>

                    {/* Accordion Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 sm:px-6 pb-6 pt-3 pl-6 sm:pl-28 border-t border-hairline/40">
                        <div className="max-w-3xl space-y-4">
                          {/* Metadata Row */}
                          <div className="flex flex-wrap items-center gap-6 font-mono text-xs text-subtle">
                            <span>
                              TRACK: <strong className="text-content font-semibold">{item.domain}</strong>
                            </span>
                            <span>
                              IDENTIFIER: <strong className="text-cyan font-semibold">{item.code}</strong>
                            </span>
                          </div>

                          {/* Problem Statement Description Box */}
                          <div className="p-4 sm:p-5 bg-panel/60 border-l-2 border-l-cyan border-y border-r border-hairline/60">
                            <span className="font-mono text-[11px] font-semibold tracking-wider text-cyan uppercase block mb-2">
                              // PROBLEM STATEMENT BRIEF
                            </span>
                            <p className="text-content text-sm sm:text-base font-normal leading-relaxed">
                              {item.description || "No description provided for this problem statement."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
