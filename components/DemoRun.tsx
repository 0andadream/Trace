"use client";

import { useCallback, useEffect, useState } from "react";
import { DecisionTrace } from "@/components/DecisionTrace";
import { TxLink } from "@/components/TxLink";
import type { DemoEvent, DemoStatus } from "@/lib/bnpl/demoTypes";
import { formatAmount, shortAddress } from "@/lib/format";

const STEP_ORDER = ["reset", "memory", "purchase1", "payout", "repay", "repay_record", "purchase2", "done"] as const;

function stepLabel(step: string) {
  switch (step) {
    case "reset":
      return "Preparing a first-time book";
    case "memory":
      return "Checking memory for this wallet…";
    case "purchase1":
      return "Requesting purchase…";
    case "payout":
      return "Sending payout…";
    case "repay":
      return "Signing repayment…";
    case "repay_record":
      return "Verifying repayment…";
    case "purchase2":
      return "Requesting second purchase…";
    case "done":
      return "Done";
    default:
      return step;
  }
}

function parseSseChunk(chunk: string, onEvent: (event: DemoEvent) => void) {
  for (const block of chunk.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    try {
      onEvent(JSON.parse(line.slice(6)) as DemoEvent);
    } catch {
      // ignore malformed frames
    }
  }
}

export function DemoRun() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/demo/status", { cache: "no-store" });
    const data = (await res.json()) as DemoStatus & { reason?: string; error?: string };
    if (!res.ok && !data.reason && !data.available) {
      setStatusError(data.error || data.reason || "Demo status failed.");
      setStatus(data.available === false ? data : null);
      return;
    }
    setStatusError(data.available ? null : data.reason || null);
    setStatus(data);
  }, []);

  useEffect(() => {
    let live = true;
    loadStatus().catch((e) => {
      if (live) setStatusError(e instanceof Error ? e.message : "status failed");
    });
    return () => {
      live = false;
    };
  }, [loadStatus]);

  async function run() {
    setBusy(true);
    setRunError(null);
    setEvents([]);
    try {
      const res = await fetch("/api/demo/run", { method: "POST" });
      if (res.status === 429) {
        const data = (await res.json()) as { error?: string; retryAfterSec?: number };
        throw new Error(data.error || `Rate limited. Try again in ${data.retryAfterSec || 180}s.`);
      }
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Demo run failed (${res.status}).`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sawDone = false;
      let sawError = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          parseSseChunk(part + "\n\n", (event) => {
            if (event.step === "done" && event.status === "ok") sawDone = true;
            if (event.status === "error") {
              sawError = true;
              setRunError(event.message);
            }
            setEvents((prev) => [...prev, event]);
          });
        }
      }
      if (buf.trim()) {
        parseSseChunk(buf + "\n\n", (event) => {
          if (event.step === "done" && event.status === "ok") sawDone = true;
          if (event.status === "error") {
            sawError = true;
            setRunError(event.message);
          }
          setEvents((prev) => [...prev, event]);
        });
      }
      if (!sawDone && !sawError) setRunError("The demo stream ended before the run finished.");
      await loadStatus();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Demo run failed.");
      await loadStatus().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const latestByStep = new Map<string, DemoEvent>();
  for (const event of events) latestByStep.set(event.step, event);
  const first = latestByStep.get("purchase1");
  const second = latestByStep.get("purchase2");
  const done = latestByStep.get("done");
  const unavailable = status && !status.available;
  const reason = statusError || status?.reason || null;

  return (
    <div className="space-y-6">
      <section className="glass-panel p-5">
        <p className="text-[13px] leading-6 text-neutral-700">
          This demo runs the real flow using an agent-controlled test wallet — real Sibyl memory, real
          Base Sepolia transactions, no wallet connection required.
        </p>
        {status?.demoWallet ? (
          <p className="mt-3 font-mono text-[12px] text-neutral-500">
            Demo wallet {shortAddress(status.demoWallet)}
            {status.execute ? " · live Base Sepolia" : " · BASE_EXECUTE off (payout simulated)"}
            {status.demoEth != null ? ` · ${Number(status.demoEth).toFixed(4)} ETH` : ""}
          </p>
        ) : null}

        {unavailable || reason ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[14px] leading-6 text-amber-900 ring-1 ring-amber-200">
            {reason || "Demo temporarily unavailable."}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || Boolean(unavailable)}
            onClick={run}
            className="rounded-full bg-[#7828E8] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Running the real flow…" : "Run the demo"}
          </button>
        </div>
        {runError ? <p className="mt-3 text-[13px] text-red-700">{runError}</p> : null}
      </section>

      {events.length > 0 ? (
        <ol className="space-y-3">
          {STEP_ORDER.map((step) => {
            const event = latestByStep.get(step);
            if (!event && !busy) return null;
            if (!event && busy) {
              const idx = STEP_ORDER.indexOf(step);
              const started = events.some((e) => STEP_ORDER.indexOf(e.step as (typeof STEP_ORDER)[number]) >= 0);
              const last = events[events.length - 1];
              const lastIdx = last ? STEP_ORDER.indexOf(last.step as (typeof STEP_ORDER)[number]) : -1;
              if (!started || idx > lastIdx + 1) return null;
              if (idx !== lastIdx + 1) return null;
            }
            const shown = event;
            return (
              <li key={step} className="glass-panel p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                  {shown?.status === "ok" ? "Done" : shown?.status === "error" ? "Error" : "In progress"}
                </p>
                <h3 className="mt-1 text-[16px] font-semibold text-neutral-900">
                  {shown?.title || stepLabel(step)}
                </h3>
                {shown?.message ? (
                  <p className="mt-2 text-[14px] leading-6 text-neutral-600">{shown.message}</p>
                ) : (
                  <p className="mt-2 text-[14px] leading-6 text-neutral-500">{stepLabel(step)}</p>
                )}
                {shown?.terms ? (
                  <div className="mt-4">
                    <DecisionTrace
                      primary={shown.terms.primary_signal}
                      standing={shown.standing ?? shown.terms.standing_score}
                      limit={shown.limit ?? shown.terms.limit}
                      installments={shown.installments ?? shown.terms.installments}
                      interestRate={shown.terms.interest_rate}
                      keysRead={
                        shown.terms.used_onchain
                          ? "USER_RELATIONSHIP (empty), ONCHAIN_SIGNAL"
                          : "USER_RELATIONSHIP (purchases, schedules, outcomes, snapshot). ONCHAIN_SIGNAL not used"
                      }
                      txHash={shown.txHash}
                    />
                  </div>
                ) : shown?.txHash ? (
                  <p className="mt-3 break-all text-[13px]">
                    <TxLink hash={shown.txHash} />
                  </p>
                ) : null}
                {shown?.explorerUrl && shown.txHash ? (
                  <p className="mt-2 text-[12px]">
                    <a
                      href={shown.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#7828E8] underline decoration-[#7828E8]/40 underline-offset-2"
                    >
                      Open on Base Sepolia explorer
                    </a>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {done && first?.terms && second?.terms ? (
        <section className="glass-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Live terms, same wallet
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-black/[0.03] p-4 ring-1 ring-black/5">
              <p className="text-[12px] font-semibold text-neutral-500">First purchase</p>
              <p className="mt-1 text-[15px] font-semibold text-neutral-900">{first.terms.decision}</p>
              <p className="mt-1 text-[13px] text-neutral-600">
                limit {formatAmount(first.terms.limit)} · {first.terms.installments} installment
                {first.terms.installments === 1 ? "" : "s"} · {first.terms.primary_signal}
              </p>
            </div>
            <div className="rounded-2xl bg-black/[0.03] p-4 ring-1 ring-black/5">
              <p className="text-[12px] font-semibold text-neutral-500">Second purchase</p>
              <p className="mt-1 text-[15px] font-semibold text-neutral-900">{second.terms.decision}</p>
              <p className="mt-1 text-[13px] text-neutral-600">
                limit {formatAmount(second.terms.limit)} · {second.terms.installments} installment
                {second.terms.installments === 1 ? "" : "s"} · {second.terms.primary_signal}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
