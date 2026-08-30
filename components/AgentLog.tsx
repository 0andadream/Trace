"use client";

import { useEffect, useState } from "react";
import { formatAmount, shortAddress } from "@/lib/format";
import { TxLink } from "@/components/TxLink";
import { AgentInfrastructure } from "@/components/AgentInfrastructure";
import type { AgentEvent } from "@/lib/trace/agentEvents";
import type { PurchaseRecord, QuoteRecord } from "@/types/bnpl";
import type { ReactNode } from "react";

type LoggedPurchase = PurchaseRecord & { wallet_address: string };
type LoggedQuote = QuoteRecord & { wallet_address: string };
type Row = { id: string; at: string; wallet: string; line: ReactNode };

function actorTone(actor: string) {
  if (actor === "SIBYL") return "text-[#7828E8]";
  if (actor === "VIRTUALS") return "text-sky-700";
  if (actor === "BASE") return "text-blue-700";
  return "text-neutral-700";
}

export function AgentLog({ execute }: { execute: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/log")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "failed");
        return data as {
          purchases?: LoggedPurchase[];
          quotes?: LoggedQuote[];
          events?: AgentEvent[];
        };
      })
      .then((data) => {
        if (!live) return;
        setEvents(data.events || []);
        const quotes = (data.quotes || []).map((q) => ({
          id: q.quote_id,
          at: q.at,
          wallet: q.wallet_address,
          line: (
            <>
              Quoted {q.decision}, {formatAmount(q.amount)}, {q.installments} installment
              {q.installments === 1 ? "" : "s"}, score {Math.round((q.standing_score || 0) * 100)}
            </>
          ),
        }));
        const purchases = (data.purchases || []).map((p) => ({
          id: p.purchase_id,
          at: p.approved_date,
          wallet: p.wallet_address,
          line: (
            <>
              Originated {formatAmount(p.amount)} at {p.merchant} · {p.outcome.replaceAll("_", " ")}
              {p.acp?.jobId ? ` · ACP job ${p.acp.jobId} (${p.acp.status})` : ""}
              {p.payout_tx_hash ? (
                <>
                  {" · ETH sent "}
                  <TxLink hash={p.payout_tx_hash} className="text-[12px]" />
                </>
              ) : p.payout_mode === "on_chain" ? (
                " · ETH sent"
              ) : (
                " · Simulated: ETH not sent"
              )}
              {p.score_before != null && p.score_after != null
                ? ` · score ${Math.round(p.score_before * 100)} → ${Math.round(p.score_after * 100)}`
                : ""}
            </>
          ),
        }));
        setRows([...quotes, ...purchases].sort((a, b) => b.at.localeCompare(a.at)));
        setLoaded(true);
        const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
        if (hash) {
          window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "center" }), 50);
        }
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "failed");
        setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
      <section className="glass-panel overflow-hidden rounded-2xl">
        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">Agent log</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Sibyl remembers. TRACE decides. Virtuals executes the job. Base settles.
          </p>
        </div>
        {error ? <p className="px-6 pb-3 text-sm text-red-600">{error}</p> : null}
        <ul className="divide-y divide-[#E8E7EC]">
          {!loaded ? (
            <li className="px-6 py-10 text-sm text-neutral-500">Loading…</li>
          ) : events.length === 0 && rows.length === 0 ? (
            <li className="px-6 py-10 text-sm text-neutral-500">No decisions in memory yet.</li>
          ) : events.length > 0 ? (
            events.slice(0, 80).map((ev) => (
              <li id={ev.id} key={ev.id} className="px-6 py-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[12px] font-medium text-neutral-500">
                    {ev.at.slice(0, 19).replace("T", " ")}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-900">
                    {ev.kind}
                  </span>
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${actorTone(ev.actor)}`}>
                    {ev.actor}
                  </span>
                  <span className="font-mono text-[12px] text-neutral-400">{shortAddress(ev.wallet)}</span>
                </div>
                <p className="mt-1 text-[14px] font-medium text-neutral-900">{ev.title}</p>
                <p className="mt-0.5 text-[13px] text-neutral-600">
                  {ev.kind === "SETTLEMENT" && ev.detail.startsWith("0x") ? (
                    <TxLink hash={ev.detail} className="text-[12px]" />
                  ) : (
                    ev.detail
                  )}
                </p>
                {ev.href && ev.kind !== "SETTLEMENT" ? (
                  <a href={ev.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12px] text-[#7828E8] hover:underline">
                    Open evidence →
                  </a>
                ) : null}
              </li>
            ))
          ) : (
            rows.slice(0, 80).map((row) => (
              <li id={row.id} key={row.id} className="flex flex-wrap items-start gap-3 px-6 py-3 text-sm">
                <span className="mt-2 h-2 w-8 shrink-0 border-t-[3px] border-dashed border-[#7828E8]" aria-hidden />
                <span className="text-[12px] font-medium leading-[1.4] text-neutral-500">{row.at.slice(0, 19).replace("T", " ")}</span>
                <span className="font-mono text-[12px] text-neutral-400">{shortAddress(row.wallet)}</span>
                <span className="text-neutral-700">→ {row.line}</span>
              </li>
            ))
          )}
        </ul>
      </section>
      <AgentInfrastructure execute={execute} />
    </div>
  );
}
