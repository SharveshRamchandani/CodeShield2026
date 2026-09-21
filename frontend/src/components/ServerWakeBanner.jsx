import { useState, useEffect } from "react";

/**
 * Non-blocking indicator banner that appears when backend requests take > 4s
 * (typical when cold-starting Render/free-tier backend instances).
 */
export default function ServerWakeBanner() {
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    const handleWakingEvent = (e) => {
      setIsWaking(Boolean(e.detail?.waking));
    };

    window.addEventListener("codeshield-server-waking", handleWakingEvent);
    return () => {
      window.removeEventListener("codeshield-server-waking", handleWakingEvent);
    };
  }, []);

  if (!isWaking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="border border-cyan/40 bg-panel/95 backdrop-blur-md px-3.5 py-2.5 shadow-2xl flex items-center gap-3 font-mono text-xs text-content">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan" />
        </span>
        <div className="flex-1 leading-snug">
          <span className="font-semibold text-cyan">Server waking up...</span>{" "}
          <span className="text-muted text-[11px]">
            This can take up to a minute on cold start.
          </span>
        </div>
      </div>
    </div>
  );
}
