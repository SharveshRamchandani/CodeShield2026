import { Link } from "react-router-dom";

export default function StubPage({ title, description, statusTag }) {
  return (
    <div className="w-full max-w-4xl mx-auto px-6 sm:px-10 lg:px-12 py-24 md:py-32 flex flex-col items-start min-h-[70vh]">
      <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-hairline bg-panel text-xs font-mono text-amber font-medium">
        <span className="w-1.5 h-1.5 bg-amber" aria-hidden="true" />
        <span>{statusTag || "Status: Under Preparation"}</span>
      </div>

      <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-content mb-6">
        {title}
      </h1>

      <p className="text-base sm:text-lg text-muted font-normal max-w-2xl leading-relaxed mb-10">
        {description}
      </p>

      <div className="border border-hairline bg-panel p-6 w-full max-w-xl mb-10 text-xs font-mono text-muted space-y-2">
        <div className="text-content font-semibold">Organized by Cyber Club BIT</div>
        <div>Official notifications and updates will be released as the event date approaches.</div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Link
          to="/"
          className="px-5 py-2.5 text-xs font-mono font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2"
        >
          &larr; Return to Home
        </Link>
      </div>
    </div>
  );
}
