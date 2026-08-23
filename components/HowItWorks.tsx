"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { buildHowStory } from "@/components/howStory";

const STEPS = [
  {
    n: "01",
    title: "You ask to buy something",
    line: ["You ask to", "buy something"],
    body: "You connect, that is your login. Alex checks if you have bought here before. First time? You start small. Been here? Alex looks at whether you paid it back on time. It does not pull a credit score from Equifax or anyone else.",
  },
  {
    n: "02",
    title: "Alex says yes or no, then sends you ETH",
    line: ["Alex says yes", "or no, then sends you ETH"],
    body: "You see how much you can spend, how many payments, and when they are due. If yes, Alex sends ETH to your wallet (shown as USDC). If Alex is short, or you asked for too much, it says no.",
  },
  {
    n: "03",
    title: "You pay Alex back in parts",
    line: ["You pay Alex", "back in parts"],
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
              className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${
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

function PhoneScreen({
  children,
  layers,
}: {
  children?: React.ReactNode;
  layers?: React.ReactNode;
}) {
  return (
    <PhoneFrame className="w-full">
      <div className="flex h-full flex-col bg-[#F9F8FB]">
        <div className="relative min-h-0 flex-1 overflow-hidden px-3.5 pb-8 pt-11">
          {layers ?? <div className="h-full overflow-y-auto">{children}</div>}
        </div>
      </div>
    </PhoneFrame>
  );
}

export function HowItWorks() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [visitor, setVisitor] = useState<Visitor>("first");
  const [mark, setMark] = useState<PayMark>("on_time");

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let revert = buildHowStory(el);
    const mq = window.matchMedia("(min-width: 1024px)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rebuild = () => {
      revert();
      revert = buildHowStory(el);
    };
    mq.addEventListener("change", rebuild);
    rm.addEventListener("change", rebuild);
    return () => {
      mq.removeEventListener("change", rebuild);
      rm.removeEventListener("change", rebuild);
      revert();
    };
  }, []);

  const visuals = {
    visitor,
    setVisitor,
    mark,
    setMark,
  };

  return (
    <section
      id="how-it-works"
      ref={rootRef}
      className="how-reveal mt-24 scroll-mt-28"
    >
      <h2 className="sr-only">How it works</h2>

      <div className="how-title-wrap">
        <p className="how-title">
          <span className="how-line how-line-1">
            How it
            <span className="how-slot" aria-hidden />
          </span>
          <span className="how-line how-line-2">works</span>
        </p>
      </div>

      <div className="how-mask">
        <div className="how-mask-content">
          <div className="how-mask-copy">
            <p className="how-kicker">How it works</p>
            <p className="how-name">Alex</p>
            <p className="how-sub">
              You connect. Alex remembers if you paid on time.
              <br />
              The next deal is based on that, not a credit file.
            </p>
          </div>

          <div className="how-mask-phone">
            <div className="how-phone-lean">
              <div className="how-phone-float">
                <PhoneScreen
                  layers={
                    <div className="how-screen relative h-full">
                      {([1, 2, 3] as const).map((n) => (
                        <div key={n} className="how-screen-layer" data-screen={n}>
                          <StepVisual step={n} {...visuals} />
                        </div>
                      ))}
                      <div className="how-screen-dim" aria-hidden />
                    </div>
                  }
                />
              </div>
            </div>
          </div>

          <div className="how-copy-lines">
            <p>
              <span className="how-t">{STEPS[0].line[0]}</span>
              <span className="how-t">{STEPS[0].line[1]}</span>
              <span className="how-note">{STEPS[0].body}</span>
            </p>
            <div className="how-stack-phone">
              <PhoneScreen>
                <StepVisual step={2} {...visuals} />
              </PhoneScreen>
            </div>
            <p className="how-step-2">
              <span className="how-t">{STEPS[1].line[0]}</span>
              <span className="how-t">{STEPS[1].line[1]}</span>
              <span className="how-note">{STEPS[1].body}</span>
            </p>
            <div className="how-stack-phone">
              <PhoneScreen>
                <StepVisual step={3} {...visuals} />
              </PhoneScreen>
            </div>
            <p>
              <span className="how-t">{STEPS[2].line[0]}</span>
              <span className="how-t">{STEPS[2].line[1]}</span>
              <span className="how-note">{STEPS[2].body}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
