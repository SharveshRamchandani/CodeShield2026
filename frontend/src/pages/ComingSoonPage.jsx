import { useEffect, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";

export default function ComingSoonPage() {
  const canvasRef = useRef(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    let angle = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e) => {
      setCoords({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.hypot(w, h) * 0.55;

      ctx.clearRect(0, 0, w, h);

      // Theme-adaptive radar color channels
      const r = isDark ? 34 : 8;
      const g = isDark ? 211 : 145;
      const b = isDark ? 238 : 168;

      // Radar Concentric Rings
      const rings = [0.2, 0.4, 0.65, 0.9];
      rings.forEach((rRatio) => {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.06 : 0.12})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * rRatio, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Crosshair Grid Lines
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.05 : 0.1})`;
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.stroke();

      // Rotating Radar Beam with Phosphor Trail
      const tailSlices = 24;
      const tailSpan = Math.PI / 3;
      for (let i = 0; i < tailSlices; i++) {
        const start = angle - (tailSpan * (i + 1)) / tailSlices;
        const end = angle - (tailSpan * i) / tailSlices;
        const alpha = ((tailSlices - i) / tailSlices) * (isDark ? 0.065 : 0.08);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, start, end, false);
        ctx.closePath();
        ctx.fill();
      }

      // Razor Scan Line
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.75 : 0.85})`;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.stroke();

      angle = (angle + 0.008) % (Math.PI * 2);
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isDark]);

  return (
    <main className="relative min-h-[calc(100vh-4rem)] w-full bg-base text-content flex flex-col items-center justify-center overflow-hidden select-none font-mono">
      {/* Background Tactical Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--color-grid) 1px, transparent 1px),
            linear-gradient(to bottom, var(--color-grid) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 block pointer-events-none" />

      {/* Radial Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(circle at center, transparent 30%, rgba(11, 15, 20, 0.85) 90%)"
            : "radial-gradient(circle at center, transparent 30%, rgba(244, 246, 248, 0.85) 90%)",
        }}
      />

      {/* Corner UI Framing */}
      <div className="absolute top-6 left-6 text-[10px] text-subtle uppercase tracking-widest pointer-events-none hidden sm:block">
        SYS.LOC // [42.3601° N, 71.0942° W]
      </div>
      <div className="absolute top-6 right-6 text-[10px] text-subtle uppercase tracking-widest pointer-events-none hidden sm:block">
        FREQ // 24.195 GHZ
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] text-subtle uppercase tracking-widest pointer-events-none hidden sm:block">
        DEFENSE PROTOCOL // 2026
      </div>
      <div className="absolute bottom-6 right-6 text-[10px] text-subtle uppercase tracking-widest pointer-events-none hidden sm:block">
        CURSOR // {coords.x}X {coords.y}Y
      </div>

      {/* Centerpiece Hero */}
      <div className="relative z-10 text-center px-6 max-w-4xl flex flex-col items-center">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 border border-hairline bg-panel/90 backdrop-blur-md text-[11px] text-amber tracking-widest uppercase font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber animate-ping" />
          <span>SCANNING PERIMETER</span>
        </div>

        {/* Brand Title */}
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tighter text-content leading-none mb-4 font-sans drop-shadow-sm">
          CodeShield
        </h1>

        {/* Subtitle / Coming Soon */}
        <div className="flex items-center gap-3 text-sm sm:text-lg lg:text-xl text-cyan font-mono tracking-widest uppercase">
          <span className="text-subtle">//</span>
          <span className="font-semibold">COMING SOON</span>
          <span className="text-subtle">//</span>
          <span className="text-muted text-xs sm:text-sm">2026</span>
        </div>
      </div>
    </main>
  );
}
