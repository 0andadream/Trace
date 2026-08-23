"use client";

import { useEffect, useRef, useState } from "react";
import { TraceArc } from "@/components/TraceArc";

const STEPS = [
  {
    n: "01",
    title: "You ask to buy something",
    body: "You connect, that is your login. Alex checks if you have bought here before. First time? You start small. Been here? Alex looks at whether you paid it back on time. It does not pull a credit score from Equifax or anyone else.",
  },
  {
    n: "02",
    title: "Alex says yes or no, then sends you ETH",
    body: "You see how much you can spend, how many payments, and when they are due. If yes, Alex sends ETH to your wallet (shown as USDC). If Alex is short, or you asked for too much, it says no.",
  },
  {
    n: "03",
    title: "You pay Alex back in parts",
    body: "Each payment is on time, late, or missed. That is what the next deal is based on. Pay on time and the next offer can get better. Miss a payment and it gets harder, fast.",
  },
] as const;

type Visitor = "first" | "returning";
type PayMark = "on_time" | "late";
type StepN = 1 | 2 | 3;

const SCHEDULE: { id: 1 | 2 | 3 | 4; date: string; amount: string; locked?: "Paid" | "Due" }[] = [
  { id: 1, date: "Sep 1", amount: "$37.50", locked: "Paid" },
  { id: 2, date: "Oct 1", amount: "$37.50", locked: "Paid" },
  { id: 3, date: "Nov 1", amount: "$37.50" },
  { id: 4, date: "Dec 1", amount: "$37.50", locked: "Due" },
];

function pill(active: boolean) {
  return active
    ? "rounded-full bg-[#7828E8] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm"
    : "rounded-full px-3 py-1.5 text-[11px] font-semibold text-neutral-500 hover:text-neutral-900";
}

function statusChip(label: "Paid" | "Due" | "Late" | "On time") {
  const tone =
    label === "Paid" || label === "On time"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200/70"
      : label === "Late"
        ? "bg-red-50 text-red-800 ring-red-200/70"
        : "bg-black/5 text-neutral-600 ring-black/5";
  return `rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tone}`;
}

function StepVisual({
  step,
  visitor,
  setVisitor,
  mark,
  setMark,
}: {
  step: StepN;
  visitor: Visitor;
  setVisitor: (v: Visitor) => void;
  mark: PayMark;
  setMark: (m: PayMark) => void;
}) {
  const first = visitor === "first";
  const nextLimit = mark === "on_time" ? 350 : 120;
  const nextUp = mark === "on_time";

  return (
    <>
      {step === 1 ? (
        <div>
          <div className="space-y-1">
            <div className="rounded-2xl bg-black/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-500">Pay</span>
                <span className="text-sm font-semibold text-neutral-900">USDC</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-neutral-900">150</p>
            </div>
            <div className="flex justify-center py-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-neutral-400">
                ↓
              </span>
            </div>
            <div className="rounded-2xl bg-black/[0.03] p-4">
              <p className="mb-2 text-[11px] font-medium text-neutral-500">Merchant</p>
              <p className="text-sm font-semibold text-neutral-900">Test Shop</p>
            </div>
          </div>

          <div className="mt-4 flex w-fit items-center gap-1 rounded-full bg-black/5 p-1">
            <button type="button" className={pill(first)} onClick={() => setVisitor("first")}>
              First time
            </button>
            <button type="button" className={pill(!first)} onClick={() => setVisitor("returning")}>
              Been here before
            </button>
          </div>

          <div
            className={`mt-4 rounded-xl px-3 py-2.5 text-sm ${
              first ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80" : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80"
            }`}
          >
            {first ? "No history yet, checking wallet age" : "3 purchases · all on time"}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Output</p>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-neutral-800">
            {first
              ? `Decision: Approve with reduced limit

Reasoning:
- No purchase history with this agent
- Checking wallet age only
- Limit cut to $75

Limit: $75 (based on wallet age only)`
              : `Decision: Approve

Reasoning:
- 3 purchases with this agent
- 3/3 on-time payments
- Relationship memory, not a credit file

Limit: $300 (3/3 on-time payments)`}
          </pre>
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200/80">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
              ✓
            </span>
            <span className="font-medium">Alex → your wallet: $150 in ETH sent</span>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Payback plan</p>
          <p className="mt-1 text-[12px] text-neutral-500">Tap payment 3 to mark it on time or late.</p>
          <ul className="mt-3 divide-y divide-black/5 rounded-xl ring-1 ring-black/5">
            {SCHEDULE.map((row) => {
              const interactive = !row.locked;
              const label = row.locked ?? (mark === "late" ? "Late" : "On time");
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={!interactive}
                    onClick={() => interactive && setMark(mark === "on_time" ? "late" : "on_time")}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${
                      interactive ? "bg-[#7828E8]/[0.04] hover:bg-[#7828E8]/[0.08]" : ""
                    }`}
                  >
                    <span className="text-neutral-500">{row.date}</span>
                    <span className="tabular-nums font-medium text-neutral-900">{row.amount}</span>
                    <span className={statusChip(label)}>{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div
            className={`mt-4 rounded-2xl px-4 py-4 ring-1 ${
              nextUp ? "bg-emerald-50 ring-emerald-200/80" : "bg-red-50 ring-red-200/80"
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Your next limit</p>
            <p
              key={nextLimit}
              className={`mt-1 text-4xl font-semibold tabular-nums tracking-tight ${
                nextUp ? "text-emerald-800" : "text-red-800"
              }`}
            >
              $300 → ${nextLimit}
            </p>
            <p className={`mt-1 text-[13px] ${nextUp ? "text-emerald-800" : "text-red-800"}`}>
              {nextUp ? "On-time payment raised the next offer." : "Late payment cut the next offer."}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ExampleFrame({ children }: { children: React.ReactNode }) {
  return (
    <aside className="glass-panel standing-hero p-5 md:p-7">
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Example
        </span>
        <span className="text-[11px] text-neutral-400">Preview</span>
      </div>
      {children}
    </aside>
  );
}

function StepCopy({
  s,
  n,
  on,
  onSelect,
}: {
  s: (typeof STEPS)[number];
  n: StepN;
  on: boolean;
  onSelect: (n: StepN) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(n)}
      aria-pressed={on}
      className={`w-full rounded-2xl p-5 text-left transition-[opacity,background-color] duration-[280ms] ease-out ${
        on ? "bg-black/[0.03]" : "opacity-40 hover:opacity-70"
      }`}
    >
      <p className="text-[11px] font-semibold text-[#7828E8]">{s.n}</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">{s.title}</h3>
      <p className="mt-3 text-[16px] leading-7 text-neutral-600">{s.body}</p>
    </button>
  );
}

export function HowItWorks() {
  const [step, setStep] = useState<StepN>(1);
  const [visitor, setVisitor] = useState<Visitor>("first");
  const [mark, setMark] = useState<PayMark>("on_time");
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const ticking = useRef(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const pick = () => {
      if (!desktop.matches) return;
      const trigger = window.innerHeight * 0.38;
      let best: StepN = 1;
      let bestDist = Infinity;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const dist = Math.abs(el.getBoundingClientRect().top - trigger);
        if (dist < bestDist) {
          bestDist = dist;
          best = (i + 1) as StepN;
        }
      });
      setStep((cur) => (cur === best ? cur : best));
    };
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        pick();
      });
    };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    desktop.addEventListener("change", pick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      desktop.removeEventListener("change", pick);
    };
  }, []);

  function goTo(n: StepN) {
    setStep(n);
    itemRefs.current[n - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const panel = (
    <ExampleFrame>
      <div className="relative">
        {([1, 2, 3] as const).map((n) => (
          <div
            key={n}
            className={`how-visual ${step === n ? "how-visual-on relative" : "how-visual-off absolute inset-x-0 top-0"}`}
            aria-hidden={step !== n}
          >
            <StepVisual step={n} visitor={visitor} setVisitor={setVisitor} mark={mark} setMark={setMark} />
          </div>
        ))}
      </div>
    </ExampleFrame>
  );

  return (
    <section id="how-it-works" className="mx-auto mt-24 max-w-5xl scroll-mt-28">
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">How it works</h2>
      <TraceArc className="mt-3 w-40" />

      <ol className="mt-10 space-y-12 lg:hidden">
        {STEPS.map((s, i) => {
          const n = (i + 1) as StepN;
          return (
            <li key={s.n} className="space-y-4">
              <StepCopy s={s} n={n} on onSelect={goTo} />
              <ExampleFrame>
                <StepVisual step={n} visitor={visitor} setVisitor={setVisitor} mark={mark} setMark={setMark} />
              </ExampleFrame>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 hidden lg:grid lg:grid-cols-2 lg:items-start lg:gap-14">
        <ol>
          {STEPS.map((s, i) => {
            const n = (i + 1) as StepN;
            return (
              <li
                key={s.n}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                data-step={n}
                className={n < 3 ? "min-h-[90vh]" : "min-h-[70vh] pb-16"}
              >
                <StepCopy s={s} n={n} on={step === n} onSelect={goTo} />
              </li>
            );
          })}
        </ol>
        <div className="sticky top-28 self-start">{panel}</div>
      </div>
    </section>
  );
}
