"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const GLYPHS = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789TRACEALEXSIBYL";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function MatrixRain({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let cols: number[] = [];
    const size = 14;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      const n = Math.max(8, Math.floor(canvas.width / size));
      cols = Array.from({ length: n }, () => Math.random() * canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const draw = () => {
      ctx.fillStyle = "rgba(2, 8, 4, 0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${size}px ui-monospace, monospace`;
      cols.forEach((y, i) => {
        const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)] || "0";
        const x = i * size;
        ctx.fillStyle = i % 7 === 0 ? "#d1fae5" : "#22c55e";
        ctx.fillText(ch, x, y);
        cols[i] = y > canvas.height + Math.random() * 80 ? 0 : y + (active ? size : size * 0.45);
      });
      raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [active, reduced]);

  if (reduced) return null;
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-40" aria-hidden />;
}

export function AgentConsole({
  lines,
  live = false,
  label = "alex@trace",
}: {
  lines: string[];
  live?: boolean;
  label?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState("");
  const shownRef = useRef("");
  const target = useMemo(() => lines.join("\n"), [lines]);
  const boxRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (reduced) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    if (!target) {
      shownRef.current = "";
      setShown("");
      return;
    }
    let i = target.startsWith(shownRef.current) ? shownRef.current.length : 0;
    if (i === 0) {
      shownRef.current = "";
      setShown("");
    }
    let timer = 0;
    const tick = () => {
      i = Math.min(i + 1, target.length);
      const next = target.slice(0, i);
      shownRef.current = next;
      setShown(next);
      const prev = target[i - 1];
      const wait = prev === "\n" ? 90 : 22;
      if (i < target.length) timer = window.setTimeout(tick, wait);
    };
    if (i < target.length) timer = window.setTimeout(tick, 20);
    else {
      shownRef.current = target;
      setShown(target);
    }
    return () => window.clearTimeout(timer);
  }, [target, reduced]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);

  const catchingUp = shown.length < target.length;
  const idle = !live && !catchingUp && !shown;

  return (
    <section className="agent-console relative isolate overflow-hidden rounded-2xl ring-1 ring-emerald-400/30">
      <MatrixRain active={live || catchingUp} />
      <div className="relative z-10 flex items-center justify-between gap-3 border-b border-emerald-400/20 bg-black/30 px-4 py-2.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-300">{label}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-500">
          {live || catchingUp ? "agent typing" : shown ? "idle" : "awaiting run"}
        </p>
      </div>
      <pre
        ref={boxRef}
        className="agent-console-body relative z-10 min-h-[18rem] max-h-[28rem] overflow-auto px-4 py-4 font-mono text-[13px] leading-[1.7] text-emerald-300 sm:min-h-[22rem] sm:text-[14px]"
      >
        {shown ||
          (live
            ? "> alex is checking sibyl…"
            : "> press run. alex types the live loop here.\n> sibyl memory · virtuals identity · base sepolia")}
        <span className={`agent-cursor ${live || catchingUp || idle ? "agent-cursor-live" : ""}`} aria-hidden>
          █
        </span>
      </pre>
    </section>
  );
}
