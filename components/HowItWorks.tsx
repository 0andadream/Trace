"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { PayoutNotice } from "@/components/PayoutNotice";
import { buildHowStory } from "@/components/howStory";
import { liveWalkthrough } from "@/lib/bnpl/walkthrough";
import { formatAmount } from "@/lib/format";

const LIVE = liveWalkthrough();

const STEPS = [
  {
    n: "01",
    title: "Buy",
    line: ["Buy", "now"],
    body: "Connect your wallet and choose a purchase. Alex, TRACE's autonomous agent, checks Sibyl Memory for this wallet.",
  },
  {
    n: "02",
    title: "Pay with TRACE",
    line: ["Pay with", "TRACE"],
    body: "TRACE finances the purchase upfront. You see your limit, how many payments, and when they are due.",
  },
  {
    n: "03",
    title: "Repay",
    line: ["Repay", "over time"],
    body: "Each payment is on time, late, or missed. Sibyl remembers that, and your reputation can grow.",
  },
] as const;

type Visitor = "first" | "returning";
type PayMark = "on_time" | "late";
type StepN = 1 | 2 | 3;

const DATES = ["Sep 1", "Sep 15", "Sep 29", "Oct 13"] as const;

function PosterIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HowPosters() {
  const score = LIVE.afterOnTime.score;
  const sweep = Math.max(8, Math.min(100, (score / 95) * 100));
  const signals = [
    { label: "Sibyl Memory", d: "M5 7h14v10H5zM8 11h8M8 14h5" },
    { label: "On-time repay", d: "M5 12.5 9.5 17 19 7" },
    { label: "Onchain start", d: "M12 4v16M5 12h14" },
    { label: "Open-plan cap", d: "M7 8h10v8H7zM12 8v8" },
    { label: "Standing", d: "M5 18V11M12 18V6M19 18v-4" },
    { label: "Next limit", d: "M5 16h14M12 8v8M8 12h8" },
  ] as const;
  const cards = [
    { name: LIVE.sku.name, amount: formatAmount(LIVE.sku.price), chip: "On time" },
    { name: "Pay with TRACE", amount: LIVE.moderate.installmentLabel, chip: "Test Shop" },
    { name: "Next limit", amount: LIVE.afterOnTime.limitLabel, chip: "Remembered" },
  ];
  return (
    <div className="how-posters" aria-hidden>
      <div className="how-poster" data-poster="1">
        <div className="how-glow" />
        <div className="how-stack">
          {cards.map((c, i) => (
            <article key={c.name} className={`how-stack-card how-stack-card-${i + 1}`}>
              <p className="how-stack-chip">{c.chip}</p>
              <p className="how-stack-name">{c.name}</p>
              <p className="how-stack-amt">{c.amount}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="how-poster" data-poster="2">
        <div className="how-glow" />
        <div className="how-plan">
          <p className="how-plan-kicker">Notebook Set</p>
          <p className="how-plan-amt">{formatAmount(LIVE.sku.price)}</p>
          <p className="how-plan-split">{LIVE.afterOnTime.installmentLabel}</p>
          <p className="how-plan-limit">After one on-time, limit {LIVE.afterOnTime.limitLabel}</p>
        </div>
      </div>
      <div className="how-poster" data-poster="3">
        <div className="how-score-grid">
          {signals.map((s) => (
            <div key={s.label} className="how-score-cell">
              <span className="how-score-ico">
                <PosterIcon d={s.d} />
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="how-gauge">
          <svg viewBox="0 0 220 120" className="how-gauge-svg">
            <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="#E8E7EC" strokeWidth="16" strokeLinecap="round" />
            <path
              d="M20 110 A90 90 0 0 1 200 110"
              fill="none"
              stroke="#7828E8"
              strokeWidth="16"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${sweep} 100`}
            />
          </svg>
          <p className="how-gauge-n">{score}</p>
          <p className="how-gauge-l">TRACE reputation</p>
        </div>
      </div>
    </div>
  );
}

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
  return `rounded-full px-2.5 py-0.5 text-[12px] font-medium uppercase tracking-[0.06em] ring-1 ${tone}`;
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
  const quote = first ? LIVE.moderate : LIVE.afterOnTime;
  const next = mark === "on_time" ? LIVE.afterOnTime : LIVE.afterLate;
  const nextUp = mark === "on_time";
  const n = Math.max(1, quote.installments);
  const rows = Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    date: DATES[i] || `Pay ${i + 1}`,
    amount: formatAmount(quote.installment_amount),
    locked: i === 0 ? ("Paid" as const) : i === n - 1 ? ("Due" as const) : undefined,
  }));

  return (
    <>
      {step === 1 ? (
        <div>
          <div className="rounded-2xl bg-black/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-neutral-500">{LIVE.sku.name}</span>
              <span className="text-[12px] font-medium text-neutral-400">USDC</span>
            </div>
            <p className="text-[2.5rem] font-semibold tabular-nums leading-none tracking-[-0.025em] text-neutral-900">
              {formatAmount(LIVE.sku.price)}
            </p>
            <p className="mt-3 text-[15px] font-medium text-neutral-900">Pay with TRACE</p>
            <p className="mt-1 text-[14px] font-normal text-neutral-600">{quote.installmentLabel}</p>
            <p className="mt-3 text-[12px] font-medium text-neutral-500">
              Merchant <span className="font-semibold text-neutral-900">Test Shop</span>
            </p>
          </div>

          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Try the memory</p>
          <p className="mt-1 text-[11px] text-neutral-400">Live policy from computeApproval, not illustrated numbers.</p>
          <div className="mt-2 flex w-fit items-center gap-1 rounded-full bg-black/5 p-1">
            <button type="button" className={pill(first)} onClick={() => setVisitor("first")}>
              First time
            </button>
            <button type="button" className={pill(!first)} onClick={() => setVisitor("returning")}>
              Returning customer
            </button>
          </div>

          <div
            className={`mt-3 rounded-xl px-3 py-2.5 text-[13px] leading-[1.45] ${
              first ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80" : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80"
            }`}
          >
            {first
              ? `No history yet. ONCHAIN_SIGNAL only. First-time band ${LIVE.firstTimeBandLabel}.`
              : `One on-time ${formatAmount(LIVE.sku.price)} is on file. USER_RELATIONSHIP, ONCHAIN_SIGNAL not used. Limit ${LIVE.afterOnTime.limitLabel}.`}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Decision</p>
          <p className="mt-2 text-[16px] font-semibold leading-snug text-neutral-800">
            Decision: {quote.decision}
          </p>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Reasoning</p>
          <ul className="mt-2 space-y-1 text-[13px] font-normal leading-[1.45] text-neutral-700">
            {(first
              ? [
                  "No purchase history with this agent",
                  `inputs: ${quote.primary}`,
                  `First-time band ${LIVE.firstTimeBandLabel} (thin / moderate / established)`,
                  `This wallet (moderate): limit ${quote.limitLabel}, ${quote.installmentLabel}, interest ${quote.interestLabel}`,
                ]
              : [
                  "1 purchase completed on time with this agent",
                  `inputs: ${quote.primary}`,
                  "ONCHAIN_SIGNAL not used",
                  `Limit ${quote.limitLabel}, ${quote.installmentLabel}, interest ${quote.interestLabel}`,
                ]
            ).map((line) => (
              <li key={line}>– {line}</li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] font-medium text-neutral-600">
            {first
              ? `Starting limit ${quote.limitLabel}. After one on-time ${formatAmount(LIVE.sku.price)}, limit becomes ${LIVE.afterOnTime.limitLabel}.`
              : `Limit ${quote.limitLabel} after 1/1 on-time. Late would be ${LIVE.afterLate.limitLabel}, ${LIVE.afterLate.installments} payments, interest ${LIVE.afterLate.interestLabel}.`}
          </p>
          <PayoutNotice example amountUsd={LIVE.sku.price} />
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <p className="text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.02em] text-neutral-900">Upcoming payments</p>
          <p className="mt-1 text-[13px] font-normal text-neutral-500">
            Tap a due row to mark the plan on time or late. Next limit is live policy.
          </p>
          <ul className="mt-3 divide-y divide-black/5 rounded-xl ring-1 ring-black/5">
            {rows.map((row) => {
              const interactive = !row.locked;
              const label = row.locked ?? (mark === "late" ? "Late" : "On time");
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={!interactive}
                    onClick={() => interactive && setMark(mark === "on_time" ? "late" : "on_time")}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${
                      interactive ? "bg-[#7828E8]/[0.04] hover:bg-[#7828E8]/[0.08]" : ""
                    }`}
                  >
                    <span className="text-[13px] font-normal text-neutral-500">{row.date}</span>
                    <span className="text-[18px] font-semibold tabular-nums text-neutral-900">{row.amount}</span>
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Your next limit</p>
            <p
              key={next.limit}
              className={`mt-1 text-[1.75rem] font-semibold tabular-nums tracking-[-0.025em] sm:text-[2rem] ${
                nextUp ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {LIVE.moderate.limitLabel} → {next.limitLabel}
            </p>
            <p className={`mt-1 text-[13px] font-normal leading-[1.45] ${nextUp ? "text-emerald-800" : "text-red-800"}`}>
              {nextUp
                ? `On time: ${next.installmentLabel}, interest ${next.interestLabel}. Standing no longer uses ONCHAIN_SIGNAL.`
                : `Late: ${next.installmentLabel}, interest ${next.interestLabel}. Limit, installment count, and interest all moved.`}
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
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
  }, [wide]);

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
      <div className="how-title-wrap">
        <h2 className="how-title">
          <span className="how-line how-line-1">
            How it
            <span className="how-slot" aria-hidden />
          </span>
          <span className="how-line how-line-2">works</span>
        </h2>
      </div>

      <div className="how-mask">
        <div className="how-mask-content">
          <div className="how-mask-copy">
            <p className="how-name">TRACE</p>
            <p className="how-sub">
              Powered by Sibyl Memory. Pay on time, and the next deal can get easier.
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
          <HowPosters />

          <div className="how-copy-lines">
            <p>
              <span className="how-head">
                <span className="how-t">{STEPS[0].line[0]}</span>
                <span className="how-t">{STEPS[0].line[1]}</span>
              </span>
              <span className="how-note">{STEPS[0].body}</span>
            </p>
            {!wide ? (
              <div className="how-stack-phone">
                <PhoneScreen>
                  <StepVisual step={2} {...visuals} />
                </PhoneScreen>
              </div>
            ) : null}
            <p className="how-step-2">
              <span className="how-head">
                <span className="how-t">{STEPS[1].line[0]}</span>
                <span className="how-t">{STEPS[1].line[1]}</span>
              </span>
              <span className="how-note">{STEPS[1].body}</span>
            </p>
            {!wide ? (
              <div className="how-stack-phone">
                <PhoneScreen>
                  <StepVisual step={3} {...visuals} />
                </PhoneScreen>
              </div>
            ) : null}
            <p>
              <span className="how-head">
                <span className="how-t">{STEPS[2].line[0]}</span>
                <span className="how-t">{STEPS[2].line[1]}</span>
              </span>
              <span className="how-note">{STEPS[2].body}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
