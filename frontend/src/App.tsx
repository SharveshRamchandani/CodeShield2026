import { useEffect, useRef, useState } from "react";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
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

    const handleMouseMove = (e: MouseEvent) => {
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

      // Radar Concentric Rings
      const rings = [0.2, 0.4, 0.65, 0.9];
      rings.forEach((rRatio) => {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * rRatio, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Crosshair Grid Lines
      ctx.strokeStyle = "rgba(34, 211, 238, 0.05)";
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
        const alpha = ((tailSlices - i) / tailSlices) * 0.065;

        ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, start, end, false);
        ctx.closePath();
        ctx.fill();
      }

      // Razor Scan Line
      ctx.strokeStyle = "rgba(34, 211, 238, 0.75)";
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
  }, []);

  return (
    <main className="relative min-h-screen w-full bg-[#0B0F14] text-[#E7EDF3] flex flex-col items-center justify-center overflow-hidden select-none font-mono">
      {/* Background Tactical Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(34, 211, 238, 0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 211, 238, 0.035) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 block pointer-events-none" />

      {/* Radial Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, transparent 30%, rgba(11, 15, 20, 0.85) 90%)",
        }}
      />

      {/* Corner UI Framing */}
      <div className="absolute top-6 left-6 text-[10px] text-[#5A687A] uppercase tracking-widest pointer-events-none hidden sm:block">
        SYS.LOC // [42.3601° N, 71.0942° W]
      </div>
      <div className="absolute top-6 right-6 text-[10px] text-[#5A687A] uppercase tracking-widest pointer-events-none hidden sm:block">
        FREQ // 24.195 GHZ
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] text-[#5A687A] uppercase tracking-widest pointer-events-none hidden sm:block">
        DEFENSE PROTOCOL // 2026
      </div>
      <div className="absolute bottom-6 right-6 text-[10px] text-[#5A687A] uppercase tracking-widest pointer-events-none hidden sm:block">
        CURSOR // {coords.x}X {coords.y}Y
      </div>

      {/* Centerpiece Hero */}
      <div className="relative z-10 text-center px-6 max-w-4xl flex flex-col items-center">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-[#1C2633] bg-[#131A24]/90 backdrop-blur-md text-[11px] text-[#FFB100] tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFB100] animate-ping" />
          <span>SCANNING PERIMETER</span>
        </div>

        {/* Brand Title */}
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tighter text-[#E7EDF3] leading-none mb-4 font-sans drop-shadow-2xl">
          CodeShield
        </h1>

        {/* Subtitle / Coming Soon */}
        <div className="flex items-center gap-3 text-sm sm:text-lg lg:text-xl text-[#22D3EE] font-mono tracking-widest uppercase">
          <span className="text-[#5A687A]">//</span>
          <span className="font-semibold">COMING SOON</span>
          <span className="text-[#5A687A]">//</span>
          <span className="text-[#8B9BB0] text-xs sm:text-sm">2026</span>
        </div>
      </div>
    </main>
  );
}
