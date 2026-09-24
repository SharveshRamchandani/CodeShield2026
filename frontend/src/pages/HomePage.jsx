import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { getProblemStatements } from "../api/problemStatements";

const SCRAMBLE_CHARS = "01#$*+/<>[_]{}—X!Z?=";
const MAX_ANIMATION_PLAYS = 2;

function useScrambleText(finalText, duration = 2800, autoStartDelay = 250) {
  const [text, setText] = useState(() => {
    // Initial placeholder with random glyphs
    return finalText.replace(/[^\s]/g, () => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]);
  });

  const scramble = useCallback(() => {
    let frame = 0;
    const totalFrames = 60; // 60 smooth progression steps
    const intervalTime = duration / totalFrames;

    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      // Staggered progressive lock-in
      const fixedCount = Math.floor(progress * (finalText.length + 1));

      let output = "";
      for (let i = 0; i < finalText.length; i++) {
        if (i < fixedCount) {
          output += finalText[i];
        } else if (finalText[i] === " ") {
          output += " ";
        } else {
          output += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }
      setText(output);

      if (frame >= totalFrames) {
        clearInterval(interval);
        setText(finalText);
      }
    }, intervalTime);
  }, [finalText, duration]);

  useEffect(() => {
    const timer = setTimeout(scramble, autoStartDelay);
    return () => clearTimeout(timer);
  }, [scramble, autoStartDelay]);

  return [text, scramble];
}

export default function HomePage() {
  const targetDate = new Date("2026-10-24T09:00:00Z").getTime();

  // Deliberate, smooth cinematic decryption pacing
  const [titleText, triggerTitleScramble] = useScrambleText("CodeShield", 2800, 200);
  const [yearText, triggerYearScramble] = useScrambleText("2026", 2200, 1100);

  // Track animation executions (capped at MAX_ANIMATION_PLAYS = 2 per page reload)
  const playCountRef = useRef(1); // 1 counted for initial mount
  const isAnimatingRef = useRef(true);

  useEffect(() => {
    const lockTimer = setTimeout(() => {
      isAnimatingRef.current = false;
    }, 3400);
    return () => clearTimeout(lockTimer);
  }, []);

  const calculateTimeLeft = () => {
    const now = new Date().getTime();
    const diff = Math.max(0, targetDate - now);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return { days, hours, minutes, seconds };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [problemStatements, setProblemStatements] = useState([]);
  const [loadingPs, setLoadingPs] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getProblemStatements()
      .then((data) => {
        if (isMounted && data) {
          setProblemStatements(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingPs(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const domainsList = useMemo(() => {
    const uniqueDomains = Array.from(
      new Set(problemStatements.map((ps) => ps.domain).filter(Boolean))
    );

    if (!uniqueDomains.includes("Cybersecurity")) {
      uniqueDomains.unshift("Cybersecurity");
    }
    if (!uniqueDomains.includes("Innovation & Emerging Technologies")) {
      uniqueDomains.push("Innovation & Emerging Technologies");
    }

    const defaultDescriptions = {
      "Cybersecurity": "Offensive & defensive security challenges, vulnerability analysis, reverse engineering, application hardening, and cryptographic systems.",
      "Innovation & Emerging Technologies": "Applied AI infrastructure, decentralized computing, distributed architecture, hardware integrations, and high-impact automated systems.",
      "Custom Track": "Specialized challenges, custom engineering workflows, and cutting-edge exploratory technical systems.",
    };

    return uniqueDomains.map((domain, index) => {
      const trackLetter = String.fromCharCode(65 + index);
      const count = problemStatements.filter((ps) => ps.domain === domain).length;
      const isTech = domain === "Innovation & Emerging Technologies";
      const displayName = isTech ? "INNOVATION & EMERGING TECH" : domain.toUpperCase();

      let description = defaultDescriptions[domain];
      if (!description) {
        description = `Specialized engineering track featuring real-world challenge briefs, innovative architectures, and rapid technical prototyping.`;
      }

      return {
        trackLetter,
        domain,
        displayName,
        count,
        description,
      };
    });
  }, [problemStatements]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n) => String(n).padStart(2, "0");

  const handleHeroHover = () => {
    if (playCountRef.current < MAX_ANIMATION_PLAYS && !isAnimatingRef.current) {
      playCountRef.current += 1;
      isAnimatingRef.current = true;
      triggerTitleScramble();
      triggerYearScramble();
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 3400);
    }
  };

  return (
    <div className="w-full flex flex-col bg-base text-content">
      {/* Asymmetric Split-Screen Hero */}
      <section
        id="main-content"
        className="w-full border-b border-hairline grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-4rem)] relative"
      >
        {/* Left ~60% Column: Massive Display Type + Tight CTAs */}
        <div className="lg:col-span-7 xl:col-span-8 px-6 sm:px-10 lg:px-12 py-16 lg:py-24 flex flex-col justify-between overflow-hidden relative">
          <div className="w-full">
            {/* Live System Status Pill */}
            <div className="flex items-center gap-2 mb-6 text-xs font-mono text-muted select-none">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan" />
              </span>
              <span className="text-cyan font-bold tracking-wider">[ONLINE // 24H HYBRID PROTOCOL]</span>
            </div>

            <h1
              onMouseEnter={handleHeroHover}
              className="text-6xl sm:text-8xl md:text-9xl lg:text-[7.5rem] xl:text-[9.5rem] 2xl:text-[11rem] font-extrabold tracking-tighter leading-[0.84] text-content select-none -ml-1 sm:-ml-2 break-words group"
            >
              <span className="inline-block transition-transform duration-200 group-hover:scale-[1.01]">
                {titleText}
              </span>
              <br />
              <span className="text-cyan inline-block transition-all duration-200 group-hover:drop-shadow-[0_0_20px_rgba(8,145,168,0.4)]">
                {yearText}
              </span>
            </h1>
          </div>

          <div className="mt-12 lg:mt-16 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className="px-6 py-3.5 text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-zinc-950 bg-cyan hover:bg-cyan-hover transition-all hover:shadow-[0_0_18px_rgba(8,145,168,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2"
            >
              Register &rarr;
            </Link>

            <Link
              to="/problem-statements"
              className="px-6 py-3.5 text-xs sm:text-sm font-mono font-medium uppercase tracking-wider text-content border border-hairline bg-panel hover:border-cyan/50 hover:bg-panel/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              View Problem Statements
            </Link>
          </div>
        </div>

        {/* Right ~40% Column: Persistent Vertical Panel with Monospace Data */}
        <div
          className="lg:col-span-5 xl:col-span-4 border-t lg:border-t-0 lg:border-l border-hairline bg-panel/60 p-6 sm:p-8 lg:p-10 flex flex-col justify-between font-mono relative overflow-hidden"
          style={{
            backgroundImage: `
              linear-gradient(to right, var(--color-grid) 1px, transparent 1px),
              linear-gradient(to bottom, var(--color-grid) 1px, transparent 1px)
            `,
            backgroundSize: "28px 28px",
          }}
        >
          {/* Cyber Scanline Laser Effect */}
          <div className="cyber-scanline" />

          <div className="space-y-8 relative z-10">
            {/* Inline Live Countdown */}
            <div className="pb-6 border-b border-hairline">
              <div className="text-[11px] text-subtle uppercase mb-2">
                // COUNTDOWN TO START
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-content">
                {timeLeft.days}D : {pad(timeLeft.hours)}H : {pad(timeLeft.minutes)}M : {pad(timeLeft.seconds)}S
              </div>
              <div className="text-[11px] text-amber font-semibold mt-2">
                SCHEDULE // DATE TBA
              </div>
            </div>

            {/* Problem Statements Count */}
            <div className="pb-6 border-b border-hairline">
              <div className="text-[11px] text-subtle uppercase mb-1">
                // CHALLENGE CATALOG
              </div>
              <div className="text-xl sm:text-2xl font-bold text-content">
                {problemStatements.length > 0 ? problemStatements.length : 32} PROBLEM STATEMENTS
              </div>
            </div>

            {/* Competition Domains Dynamically Listed */}
            <div className="pb-6 border-b border-hairline">
              <div className="text-[11px] text-subtle uppercase mb-3">
                // COMPETITION DOMAINS
              </div>
              <ul className="space-y-2 text-sm text-content">
                {domainsList.map((item) => (
                  <li key={item.domain} className="flex items-center gap-2">
                    <span className="text-cyan font-bold">&gt;</span>
                    <Link
                      to={`/problem-statements?domain=${encodeURIComponent(item.domain)}`}
                      className="font-semibold hover:text-cyan transition-colors"
                    >
                      {item.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Organizer Meta */}
          <div className="pt-6 border-t border-hairline text-xs text-muted relative z-10 space-y-1">
            <div className="text-[11px] text-subtle uppercase">// HOST</div>
            <div className="text-content font-semibold">CYBER CLUB BIT</div>
            <div className="text-[11px] text-subtle">Bannari Amman Institute of Technology</div>
          </div>
        </div>
      </section>

      {/* Brief Section */}
      <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-20 md:py-28">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
          <div className="md:col-span-4">
            <div className="text-xs font-mono uppercase text-cyan font-semibold">
              // ABOUT
            </div>
          </div>
          <div className="md:col-span-8 space-y-6">
            <p className="text-xl sm:text-2xl text-content font-normal leading-relaxed">
              CodeShield 2026 is an internal collegiate cybersecurity and technological innovation hackathon organized by Cyber Club BIT, exclusively for students of Bannari Amman Institute of Technology (BIT Sathy). Conducted in a hybrid sprint format, teams collaborate across high-impact tracks to harden systems and deploy emerging tech prototypes.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/faq"
                className="text-xs font-mono text-cyan hover:underline flex items-center gap-1.5"
              >
                <span>Read FAQ &amp; Hackathon Rules</span>
                <span>&rarr;</span>
              </Link>
            </div>
            <p className="text-sm font-mono text-muted">
              Hybrid sprint timeline and campus presentation schedule TBA by Cyber Club BIT.
            </p>
          </div>
        </div>
      </section>

      {/* Architectural Divider */}
      <div className="w-full border-t border-hairline" />

      {/* Domain Details Section (Dynamic) */}
      <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-20 md:py-28">
        <div className="mb-10 font-mono flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-cyan font-semibold mb-1">
              // DOMAINS
            </div>
            <div className="text-sm text-muted">
              {domainsList.length} focused technical {domainsList.length === 1 ? "track" : "tracks"} for high-impact innovation.
            </div>
          </div>
          <Link
            to="/problem-statements"
            className="text-xs font-mono text-cyan hover:underline flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>Browse All {problemStatements.length || 32} Problem Statements</span>
            <span>&rarr;</span>
          </Link>
        </div>

        <div className={`grid grid-cols-1 ${domainsList.length === 1 ? "max-w-xl" : domainsList.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"} gap-6`}>
          {domainsList.map((item) => (
            <div
              key={item.domain}
              className="border border-hairline bg-panel/60 p-8 flex flex-col justify-between hover:border-cyan/40 transition-colors group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-mono text-cyan font-semibold uppercase">
                    TRACK {item.trackLetter}
                  </div>
                  {item.count > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 border border-hairline bg-panel text-subtle">
                      {item.count} PS
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-content mb-4 tracking-tight group-hover:text-cyan transition-colors">
                  {item.displayName}
                </h3>
                <p className="text-sm text-muted leading-relaxed mb-6">
                  {item.description}
                </p>
              </div>

              <div className="pt-4 border-t border-hairline">
                <Link
                  to={`/problem-statements?domain=${encodeURIComponent(item.domain)}`}
                  className="text-xs font-mono text-cyan hover:underline flex items-center justify-between"
                >
                  <span>Explore Track Statements</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
