"use client";

import { useEffect, useState } from "react";
import { formatAmount, shortAddress } from "@/lib/format";
import { TxLink } from "@/components/TxLink";
import type { PurchaseRecord, QuoteRecord } from "@/types/bnpl";
import type { ReactNode } from "react";

type LoggedPurchase = PurchaseRecord & { wallet_address: string };
type LoggedQuote = QuoteRecord & { wallet_address: string };
type Row = { id: string; at: string; wallet: string; line: ReactNode };

export function AgentLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/log")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "failed");
        return data as { purchases?: LoggedPurchase[]; quotes?: LoggedQuote[] };
      })
      .then((data) => {
        if (!live) return;
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
    <section className="glass-panel overflow-hidden rounded-2xl">
      <div className="px-6 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">Agent log</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Every quote and purchase this agent has recorded. Public. Most recent first.
        </p>
      </div>
      {error ? <p className="px-6 pb-3 text-sm text-red-600">{error}</p> : null}
      <ul className="divide-y divide-[#E8E7EC]">
        {!loaded ? (
          <li className="px-6 py-10 text-sm text-neutral-500">Loading…</li>
        ) : rows.length === 0 ? (
          <li className="px-6 py-10 text-sm text-neutral-500">No decisions in memory yet.</li>
        ) : (
          rows.slice(0, 80).map((row) => (
            <li id={row.id} key={row.id} className="flex flex-wrap items-start gap-3 px-6 py-3 text-sm">
              <span className="mt-2 h-2 w-8 shrink-0 border-t-[3px] border-dashed border-[#7828E8]" aria-hidden />
              <span className="font-mono text-[12px] text-neutral-500">{row.at.slice(0, 19).replace("T", " ")}</span>
              <span className="font-mono text-[12px] text-neutral-400">{shortAddress(row.wallet)}</span>
              <span className="text-neutral-700">→ {row.line}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
