"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
      if (i < target.length) timer = window.setTimeout(tick, target[i - 1] === "\n" ? 36 : 10);
    };
    if (i < target.length) timer = window.setTimeout(tick, 12);
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

  return (
    <section className="agent-console overflow-hidden rounded-2xl ring-1 ring-emerald-500/25">
      <div className="flex items-center justify-between gap-3 border-b border-emerald-500/20 px-4 py-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-emerald-400/90">{label}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-500/70">
          {live || catchingUp ? "typing" : shown ? "idle" : "awaiting run"}
        </p>
      </div>
      <pre
        ref={boxRef}
        className="agent-console-body max-h-[22rem] overflow-auto px-4 py-3 font-mono text-[12px] leading-[1.65] text-emerald-400 sm:text-[13px]"
      >
        {shown || (live ? "> checking…" : "> run the demo to watch Alex type the live loop")}
        <span className={`agent-cursor ${live || catchingUp ? "agent-cursor-live" : ""}`} aria-hidden>
          █
        </span>
      </pre>
    </section>
  );
}
