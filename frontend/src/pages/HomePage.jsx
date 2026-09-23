import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  const targetDate = new Date("2026-10-24T09:00:00Z").getTime();

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

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div className="w-full flex flex-col bg-base text-content">
      {/* Asymmetric Split-Screen Hero */}
      <section
        id="main-content"
        className="w-full border-b border-hairline grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-4rem)]"
      >
        {/* Left ~60% Column: Massive Display Type + Tight CTAs */}
        <div className="lg:col-span-7 xl:col-span-8 px-6 sm:px-10 lg:px-12 py-16 lg:py-24 flex flex-col justify-between overflow-hidden">
          <div className="w-full">
            <h1 className="text-6xl sm:text-8xl md:text-9xl lg:text-[7.5rem] xl:text-[9.5rem] 2xl:text-[11rem] font-extrabold tracking-tighter leading-[0.84] text-content select-none -ml-1 sm:-ml-2 break-words">
              CodeShield<br />
              <span className="text-cyan">2026</span>
            </h1>
          </div>

          <div className="mt-12 lg:mt-16 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className="px-6 py-3.5 text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2"
            >
              Register
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
                32 PROBLEM STATEMENTS
              </div>
            </div>

            {/* Two Domains Plainly Listed */}
            <div className="pb-6 border-b border-hairline">
              <div className="text-[11px] text-subtle uppercase mb-3">
                // COMPETITION DOMAINS
              </div>
              <ul className="space-y-2 text-sm text-content">
                <li className="flex items-center gap-2">
                  <span className="text-cyan font-bold">&gt;</span>
                  <span className="font-semibold">CYBERSECURITY</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan font-bold">&gt;</span>
                  <span className="font-semibold">INNOVATION &amp; EMERGING TECH</span>
                </li>
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
              CodeShield 2026 is an inter-collegiate cybersecurity and technological innovation hackathon organized by Cyber Club BIT. Built for student security researchers, software architects, and systems builders, teams compete across high-impact tracks to harden systems and deploy emerging tech prototypes.
            </p>
            <p className="text-sm font-mono text-muted">
              Venue logistics and timeline announcement TBA by Cyber Club BIT.
            </p>
          </div>
        </div>
      </section>

      {/* Architectural Divider */}
      <div className="w-full border-t border-hairline" />

      {/* Domain Details Section */}
      <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-20 md:py-28">
        <div className="mb-10 font-mono">
          <div className="text-xs uppercase text-cyan font-semibold mb-1">
            // DOMAINS
          </div>
          <div className="text-sm text-muted">
            Two focused technical tracks. No third track.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-hairline bg-panel/60 p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono text-cyan mb-2 font-semibold uppercase">TRACK A</div>
              <h3 className="text-2xl font-bold text-content mb-4">
                CYBERSECURITY
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                Offensive &amp; defensive security challenges, vulnerability analysis, reverse engineering, application hardening, and cryptographic systems.
              </p>
            </div>
          </div>

          <div className="border border-hairline bg-panel/60 p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono text-cyan mb-2 font-semibold uppercase">TRACK B</div>
              <h3 className="text-2xl font-bold text-content mb-4">
                INNOVATION &amp; EMERGING TECH
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                Applied AI infrastructure, decentralized computing, distributed architecture, hardware integrations, and high-impact automated systems.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
