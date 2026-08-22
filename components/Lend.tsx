"use client";

import { useCallback, useEffect, useState } from "react";
import { useInjectedWallet } from "@/components/ConnectWallet";
import { CLEAN_BORROWER, PENALIZED_BORROWER } from "@/lib/lending/demo-wallets";
import { formatAmount, shortAddress } from "@/lib/format";
import type { LendingDecision, QuoteResult, UserRelationship } from "@/types/lending";

const TONE: Record<LendingDecision, string> = {
  Approve: "text-proceed",
  "Approve with reduced limit": "text-flag",
  Decline: "text-hold",
  "Ceiling blocked": "text-hold",
};

type Tab = "supply" | "borrow" | "repay";

export function Lend() {
  const injected = useInjectedWallet();
  const [tab, setTab] = useState<Tab>("borrow");
  const [wallet, setWallet] = useState("");
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState("8");
  const [relationship, setRelationship] = useState<UserRelationship | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (injected.address && !wallet) setWallet(injected.address);
  }, [injected.address, wallet]);

  const loadRelationship = useCallback(async (addr: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr.trim())) return;
    const res = await fetch(`/api/relationship/${addr}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "relationship failed");
    setRelationship(data.relationship as UserRelationship);
  }, []);

  useEffect(() => {
    if (!wallet) return;
    const t = window.setTimeout(() => {
      loadRelationship(wallet).catch((err) => setError(err instanceof Error ? err.message : "load failed"));
    }, 200);
    return () => window.clearTimeout(t);
  }, [wallet, loadRelationship]);

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${path} failed`);
      if (data.relationship) setRelationship(data.relationship as UserRelationship);
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function onSupply() {
    const data = await post("/api/supply", { wallet, amount: Number(amount), asset });
    setNote(`Recorded ${amount} ${asset} collateral for ${shortAddress(wallet)}.`);
    return data;
  }

  async function onQuote() {
    const data = (await post("/api/quote", { wallet, amount: Number(amount), asset })) as QuoteResult;
    setQuote(data);
    return data;
  }

  async function onBorrow(override = false) {
    const data = await post("/api/borrow", { wallet, amount: Number(amount), asset, override });
    setQuote(data.quote as QuoteResult);
    setNote(
      data.tx?.sent
        ? `Loan ${data.loan.loan_id} originated and broadcast.`
        : `Loan ${data.loan.loan_id} originated in Sibyl. ${data.tx?.reason || ""}`,
    );
    await loadRelationship(wallet);
  }

  async function onRepay(loanId: string, markDefault = false) {
    const data = await post("/api/repay", { wallet, loan_id: loanId, mark_default: markDefault });
    setNote(`Loan ${loanId} marked ${data.outcome}. Standing now ${Number(data.standing).toFixed(2)}.`);
    setQuote(null);
  }

  const empty = !relationship || relationship.total_loans === 0;
  const decision = quote?.verdict.decision;
  const active = relationship?.loans.filter((l) => l.outcome === "active") ?? [];
  const collateral = (relationship?.collateral || []).reduce((s, c) => s + c.amount, 0);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section>
        <p className="text-sm text-paper-500">Alex</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">Reputation-weighted lending</h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-300">
          Connect a wallet, supply collateral, request a borrow. Terms come from this agent&apos;s
          memory of loans it originated with you. On-chain history is a fallback for wallets it has
          never lent to.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { id: "supply" as const, label: "Supply" },
            { id: "borrow" as const, label: "Borrow" },
            { id: "repay" as const, label: "Repay" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "btn-trace h-9 px-4 text-xs" : "btn-ghost h-9 px-4 text-xs"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="mt-6 block text-xs text-paper-500">
          Wallet
          <input
            className="field font-mono text-xs"
            value={wallet}
            placeholder="0x… (connect or paste)"
            onChange={(e) => setWallet(e.target.value.trim())}
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost h-8 px-3 text-[11px]"
            onClick={() => injected.address && setWallet(injected.address)}
            disabled={!injected.address}
          >
            Use connected
          </button>
          <button type="button" className="btn-ghost h-8 px-3 text-[11px]" onClick={() => setWallet(CLEAN_BORROWER)}>
            Demo: clean book
          </button>
          <button type="button" className="btn-ghost h-8 px-3 text-[11px]" onClick={() => setWallet(PENALIZED_BORROWER)}>
            Demo: defaulted
          </button>
        </div>

        {tab !== "repay" ? (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (tab === "supply") onSupply().catch((err) => setError(err instanceof Error ? err.message : "failed"));
              else onQuote().catch((err) => setError(err instanceof Error ? err.message : "failed"));
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-paper-500">
                Asset
                <input className="field" value={asset} onChange={(e) => setAsset(e.target.value.toUpperCase())} />
              </label>
              <label className="text-xs text-paper-500">
                Amount
                <input
                  type="number"
                  className="field"
                  value={amount}
                  min={0}
                  step="any"
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            </div>
            <button className="btn-trace h-11 px-5" disabled={busy || !wallet || !amount} type="submit">
              {busy ? "Working…" : tab === "supply" ? "Record supply" : "Get quote"}
            </button>
          </form>
        ) : (
          <div className="mt-5 space-y-3">
            {active.length === 0 ? (
              <p className="text-sm text-paper-500">No active loans in this agent&apos;s book for this wallet.</p>
            ) : (
              active.map((loan) => (
                <article key={loan.loan_id} className="panel p-4">
                  <p className="text-sm">
                    {formatAmount(loan.amount, loan.asset)} · {(loan.rate_quoted * 100).toFixed(1)}% APR · due{" "}
                    {loan.due_date.slice(0, 10)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-paper-500">{loan.loan_id}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-trace h-9 px-3 text-xs" disabled={busy} onClick={() => onRepay(loan.loan_id)}>
                      Repay
                    </button>
                    <button
                      className="btn-hold h-9 px-3 text-xs"
                      disabled={busy}
                      onClick={() => onRepay(loan.loan_id, true)}
                    >
                      Mark default
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-hold">{error}</p> : null}
        {note ? <p className="mt-4 text-sm text-proceed">{note}</p> : null}

        <div className="mt-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-paper-500">Memory Alex will receive</p>
          <article className="panel p-4">
            <div className="text-xs text-trace">USER_RELATIONSHIP</div>
            {empty ? (
              <p className="mt-2 text-sm text-hold">USER_RELATIONSHIP is empty. No loans originated by this agent.</p>
            ) : (
              <p className="mt-2 text-sm text-paper-300">
                {relationship!.total_loans} loans · {relationship!.on_time_count} on_time · {relationship!.late_count}{" "}
                late · {relationship!.default_count} defaulted · standing{" "}
                {relationship!.current_standing_score.toFixed(2)} · collateral {formatAmount(collateral)}
              </p>
            )}
          </article>
          <article className="panel p-4">
            <div className="text-xs text-trace">ONCHAIN_SIGNAL</div>
            {empty ? (
              <p className="mt-2 text-sm text-paper-300">
                Secondary. Fetched fresh, not stored. Used only because total_loans == 0.
              </p>
            ) : (
              <p className="mt-2 text-sm text-paper-500">
                Not used. This wallet has relationship history — on-chain data does not enter the rate function.
              </p>
            )}
          </article>
          <article className="panel p-4">
            <div className="text-xs text-trace">SCORE</div>
            <p className="mt-2 font-mono text-2xl">
              {(quote?.verdict.score ?? relationship?.current_standing_score ?? 0).toFixed(2)}
            </p>
          </article>
        </div>
      </section>

      <section className="panel flex min-h-[28rem] flex-col p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-paper-500">Output</p>
        {quote ? (
          <>
            <pre className="mt-4 flex-1 whitespace-pre-wrap font-mono text-sm leading-relaxed text-paper">
              {`Decision: ${quote.verdict.decision}

Reasoning:
${quote.verdict.reasoning.map((line) => `- ${line}`).join("\n")}

Score: ${quote.verdict.score.toFixed(2)}`}
            </pre>
            <p className={`mt-2 text-sm ${decision ? TONE[decision] : ""}`}>
              {(quote.quote.apr * 100).toFixed(1)}% APR · {quote.quote.collateral_ratio.toFixed(2)}x collateral · max{" "}
              {formatAmount(quote.quote.max_borrow_for_user, quote.request.asset)}
              {quote.quote.used_onchain ? " · primary ONCHAIN_SIGNAL" : " · primary USER_RELATIONSHIP"}
            </p>
            {quote.quote.decision === "Approve" || quote.quote.decision === "Approve with reduced limit" ? (
              <button className="btn-trace mt-5 h-10 px-4" disabled={busy} onClick={() => onBorrow(false)}>
                Accept loan
              </button>
            ) : quote.quote.decision === "Decline" ? (
              <button className="btn-hold mt-5 h-10 px-4" disabled={busy} onClick={() => onBorrow(true)}>
                Override and originate
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-8 text-sm text-paper-500">
            Waiting for a quote. Alex does not chat. Connect or paste a wallet, then request a rate.
          </p>
        )}
      </section>
    </main>
  );
}
