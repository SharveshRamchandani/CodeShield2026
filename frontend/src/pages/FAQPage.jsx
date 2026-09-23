import { useState, useMemo } from "react";
import { Link } from "react-router-dom";

const FAQ_CATEGORIES = [
  { id: "all", label: "All Questions" },
  { id: "eligibility", label: "Eligibility & Format" },
  { id: "teams", label: "Teams & Registration" },
  { id: "rules", label: "Rules & Deliverables" },
  { id: "judging", label: "Judging & Mentorship" },
];

const FAQS = [
  {
    id: 1,
    category: "eligibility",
    question: "Who is eligible to participate in CodeShield 2026?",
    answer:
      "CodeShield 2026 is strictly an internal collegiate hackathon exclusively for active students of Bannari Amman Institute of Technology (BIT Sathy). Students from any department and year of study (1st to 4th year, UG and PG) are eligible to participate.",
    highlight: "Exclusive to BIT Sathy students only",
  },
  {
    id: 2,
    category: "eligibility",
    question: "What is the format of the hackathon (Online / Offline / Hybrid)?",
    answer:
      "CodeShield 2026 is conducted in a Hybrid format. Teams can collaborate, build, and interact during the 24-hour sprint with continuous online checkpoint updates, mentorship, and system submissions, while the final pitch presentations and jury evaluations take place on campus at BIT Sathy.",
    highlight: "24-Hour Hybrid Sprint",
  },
  {
    id: 3,
    category: "eligibility",
    question: "Is there any registration fee to participate?",
    answer:
      "No. Registration is completely free for all eligible BIT Sathy students. You only need to form a team of 2-4 members and select an official problem statement.",
  },
  {
    id: 4,
    category: "eligibility",
    question: "What domains and tracks are available for projects?",
    answer:
      "The hackathon features two primary innovation tracks with 32 curated problem statements: 1) Cybersecurity (CS-01 to CS-18) and 2) Innovation & Emerging Technologies (IT-01 to IT-14). Note: The previous CSIT track has been officially merged into Cybersecurity.",
  },
  {
    id: 5,
    category: "teams",
    question: "What is the required team size?",
    answer:
      "Teams must consist of 2 to 4 members. Individual (solo) participation and teams larger than 4 members are not allowed to ensure collaborative sprint balance.",
    highlight: "2 to 4 Members per Team",
  },
  {
    id: 6,
    category: "teams",
    question: "Can team members be from different departments or batches?",
    answer:
      "Yes! Interdisciplinary and cross-batch collaboration is highly encouraged. You can form teams across CSE, IT, AI&DS, ECE, Mechanical, or any other department within BIT Sathy.",
  },
  {
    id: 7,
    category: "teams",
    question: "What information is needed during registration?",
    answer:
      "The team leader must submit the Team Name, choose a Problem Statement from the catalog, and enter each member's Full Name, College Roll/ID number, official BIT email address, and Phone Number.",
  },
  {
    id: 8,
    category: "teams",
    question: "Can we change our Problem Statement or team details after registering?",
    answer:
      "Team leaders can update team info from the Leader Dashboard before the registration closing deadline. Once deliverables are submitted, details are permanently locked for jury evaluation.",
  },
  {
    id: 9,
    category: "rules",
    question: "What deliverables must be submitted at the end of 24 hours?",
    answer:
      "Teams must submit 4 core items before the deadline: 1) Final Project Title, 2) Technical Abstract/Description, 3) Public GitHub / GitLab Repository URL containing clean source code, and 4) Pitch Deck Presentation Slide URL or Live Demo link.",
    highlight: "Repository + Abstract + Slide Deck Demo",
  },
  {
    id: 10,
    category: "rules",
    question: "Can we use pre-existing code, open-source libraries, or AI tools?",
    answer:
      "You are welcome to use open-source packages, public APIs, UI component libraries, and AI developer tools. However, all core application architecture and feature logic must be developed during the hackathon. Submitting pre-built full applications or plagiarized repositories will lead to immediate disqualification.",
  },
  {
    id: 11,
    category: "rules",
    question: "Is attendance check-in mandatory?",
    answer:
      "Yes. Regular attendance check-ins are recorded on Day 1 and Day 2 to confirm team progress through the sprint checkpoints.",
  },
  {
    id: 12,
    category: "judging",
    question: "What are the judging and scoring criteria?",
    answer:
      "Submissions are evaluated by expert faculty and industry panels on: 1) Innovation & Technical Feasibility (30%), 2) Security & Code Quality (25%), 3) Practical Impact & Real-World Utility (25%), and 4) Final Demonstration & Presentation (20%).",
  },
  {
    id: 13,
    category: "judging",
    question: "Will mentors be available during the 24 hours?",
    answer:
      "Yes. Cyber Club leads and faculty mentors will be available online and offline throughout the checkpoints to help resolve technical blockers, clarify requirements, and review architectures.",
  },
  {
    id: 14,
    category: "judging",
    question: "How do I contact the organizers if I have additional questions?",
    answer:
      "You can reach the organizing committee directly at cyberclub@bitsathy.ac.in, or ask questions 24/7 to the AI Assistant bot located in the bottom-right corner of this portal.",
  },
];

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openItems, setOpenItems] = useState({ 1: true, 2: true });

  const toggleItem = (id) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const allOpen = {};
    FAQS.forEach((f) => (allOpen[f.id] = true));
    setOpenItems(allOpen);
  };

  const collapseAll = () => {
    setOpenItems({});
  };

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory =
        activeCategory === "all" || faq.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        (faq.highlight && faq.highlight.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="w-full px-6 sm:px-10 lg:px-12 py-12 max-w-5xl mx-auto font-mono">
      {/* Header Banner */}
      <div className="border-b border-hairline pb-8 mb-10">
        <div className="flex flex-wrap items-center gap-2.5 mb-3 text-xs text-muted">
          <span className="text-cyan font-bold">&gt;_ FAQ & KNOWLEDGE BASE</span>
          <span>/</span>
          <span className="px-2 py-0.5 bg-cyan/10 text-cyan border border-cyan/30 text-[11px] font-bold">
            BIT SATHY INTERNAL
          </span>
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
            HYBRID MODE
          </span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-content mb-4 font-sans">
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-muted max-w-2xl leading-relaxed">
          Everything you need to know about CodeShield 2026 — eligibility rules, team formation, hybrid sprint logistics, submission deliverables, and evaluation.
        </p>

        {/* Highlight Banner */}
        <div className="mt-6 p-4 bg-panel border border-cyan/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-cyan text-xl">ℹ</span>
            <div className="text-xs text-content">
              <span className="font-bold text-cyan">Internal Hackathon Notice:</span> Exclusively open to current BIT Sathy students. 24-hour hybrid format with final offline pitch.
            </div>
          </div>
          <Link
            to="/problem-statements"
            className="px-3 py-1.5 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors shrink-0"
          >
            Explore 32 Problem Statements &rarr;
          </Link>
        </div>
      </div>

      {/* Controls: Search & Categories */}
      <div className="space-y-4 mb-8">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions (e.g., hybrid mode, team size, eligibility, deliverables)..."
            className="w-full px-4 py-3 bg-panel text-content text-xs border border-hairline focus:border-cyan focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-3 text-xs text-muted hover:text-content"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Category Tabs & Expand Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap gap-1.5">
            {FAQ_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 text-xs transition-colors border ${
                    isActive
                      ? "bg-cyan text-zinc-950 font-bold border-cyan"
                      : "bg-panel text-muted hover:text-content border-hairline hover:border-cyan/40"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted">
            <button
              onClick={expandAll}
              className="hover:text-cyan transition-colors underline underline-offset-2"
            >
              Expand All
            </button>
            <span>·</span>
            <button
              onClick={collapseAll}
              className="hover:text-cyan transition-colors underline underline-offset-2"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Accordion FAQ List */}
      {filteredFaqs.length === 0 ? (
        <div className="p-8 text-center bg-panel border border-hairline text-muted text-xs">
          No questions found matching &ldquo;{searchQuery}&rdquo;. Try another search term or ask our AI Assistant.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq) => {
            const isOpen = !!openItems[faq.id];
            return (
              <div
                key={faq.id}
                className={`bg-panel border transition-colors ${
                  isOpen ? "border-cyan/50" : "border-hairline hover:border-hairline/80"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleItem(faq.id)}
                  className="w-full p-4 text-left flex items-start justify-between gap-4 focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-cyan font-bold mt-0.5 select-none">
                      Q{faq.id < 10 ? `0${faq.id}` : faq.id}.
                    </span>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-content leading-snug">
                        {faq.question}
                      </h3>
                      {faq.highlight && (
                        <span className="inline-block mt-1 text-[10px] text-cyan/90 font-medium">
                          &bull; {faq.highlight}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-sm text-cyan transition-transform select-none shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    &#9662;
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-muted leading-relaxed border-t border-hairline/40 animate-in fade-in duration-150">
                    <div className="pl-6 border-l-2 border-cyan/40 py-0.5">
                      {faq.answer}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Support Card */}
      <div className="mt-12 p-6 bg-base border border-hairline flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h4 className="text-sm font-bold text-content mb-1">
            Still have questions?
          </h4>
          <p className="text-xs text-muted">
            The Cyber Club organizing team is here to assist you throughout the registration and hackathon stages.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="mailto:cyberclub@bitsathy.ac.in"
            className="px-4 py-2 text-xs text-content bg-panel border border-hairline hover:border-cyan transition-colors"
          >
            Email: cyberclub@bitsathy.ac.in
          </a>
          <Link
            to="/register"
            className="px-4 py-2 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors"
          >
            Register Team &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
