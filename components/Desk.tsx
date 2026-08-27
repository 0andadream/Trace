"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScoreRing } from "@/components/ScoreRing";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { MemoryTimeline } from "@/components/MemoryTimeline";
import { getInjectedEthereum, useInjectedWallet } from "@/components/ConnectWallet";
import { sendUserRepay } from "@/lib/bnpl/sendUserRepay";
import {
  memoryTimeline,
  onchainBaseline,
  onchainStandingBreakdown,
  standingBreakdown,
} from "@/lib/bnpl/relationship";
import { formatAmount, shortAddress } from "@/lib/format";
import { PayoutNotice } from "@/components/PayoutNotice";
import type { PurchaseRecord, PurchaseResult, UserRelationship } from "@/types/bnpl";
import Link from "next/link";

const MERCHANTS = ["Test Shop", "Sibyl Labs (test merchant)", "Northwind", "Acme Market", "Base Supply"];
const THINK_LINES = ["Checking notes…", "Checking cash…", "Writing the decision…"];

function scoreFromRel(rel: UserRelationship | null, onchainStanding: number | null) {
  if (!rel || rel.total_purchases === 0) {
    if (onchainStanding == null) return null;
    return Math.round(onchainStanding * 100);
  }
  return Math.round(rel.current_standing_score * 100);
}

function badge(rel: UserRelationship | null) {
  if (!rel || rel.total_purchases === 0) {
    return { label: "NEW WALLET, CAUTIOUS TERMS", cls: "bg-amber-100 text-amber-800 border-amber-300/60" };
  }
  if (rel.default_count >= 1) {
    return { label: "RESTRICTED", cls: "bg-red-100 text-red-800 border-red-300/50" };
  }
  if (rel.late_count >= 1) {
    return { label: "REVIEW", cls: "bg-amber-100 text-amber-800 border-amber-300/60" };
  }
  return { label: "APPROVED", cls: "bg-emerald-100 text-emerald-800 border-emerald-300/50" };
}

function standingCopy(rel: UserRelationship | null, quote: PurchaseResult | null) {
  if (!rel || rel.total_purchases === 0) {
    const age = quote?.onchain?.wallet_age_days;
    const txs = quote?.onchain?.tx_count;
    const chain =
      age != null && txs != null ? ` Wallet age ${age} days, ${txs} transactions.` : "";
    return `Alex hasn't built up a relationship with you yet. Terms use a conservative on-chain fallback only.${chain} That signal is fetched fresh and is not stored. After one on-time completion here, relationship memory takes over.`;
  }
  const completed = rel.on_time_count + rel.late_count + rel.default_count;
  return `This wallet has completed ${completed} purchase${completed === 1 ? "" : "s"} with this agent (${rel.on_time_count} on time, ${rel.late_count} late, ${rel.default_count} defaulted). Current limit is ${formatAmount(rel.current_limit)} across up to 2 active plans. No on-chain fallback was used, this wallet has a relationship history with this agent.`;
}

export function Desk() {
  const injected = useInjectedWallet();
  const [wallet, setWallet] = useState("");
  const [merchant, setMerchant] = useState(MERCHANTS[0]);
  const [amount, setAmount] = useState("12");
  const [rel, setRel] = useState<UserRelationship | null>(null);
  const [onchainStanding, setOnchainStanding] = useState<number | null>(null);
  const [onchainMeta, setOnchainMeta] = useState<{ age: number; txs: number } | null>(null);
  const [quote, setQuote] = useState<PurchaseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [thinkI, setThinkI] = useState(0);
  const [showOutput, setShowOutput] = useState(false);
  const [lastPurchase, setLastPurchase] = useState<PurchaseRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [payoutHash, setPayoutHash] = useState<string | null>(null);
  const [payoutLive, setPayoutLive] = useState(false);

  useEffect(() => {
    if (injected.address) setWallet(injected.address);
  }, [injected.address]);

  useEffect(() => {
    if (!deciding) return;
    setThinkI(0);
    const t = window.setInterval(() => setThinkI((i) => (i + 1) % THINK_LINES.length), 420);
    return () => window.clearInterval(t);
  }, [deciding]);

  useEffect(() => {
    setShowOutput(false);
  }, [amount, merchant, wallet]);

  const loadRel = useCallback(async (addr: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/i.test(addr.trim())) return;
    const res = await fetch(`/api/relationship/${addr}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "relationship failed");
    setRel(data.relationship as UserRelationship);
    if (data.relationship_empty && data.onchain) {
      const age = Number(data.onchain.wallet_age_days) || 0;
      const txs = Number(data.onchain.tx_count) || 0;
      setOnchainStanding(onchainBaseline(age, txs).standing);
      setOnchainMeta({ age, txs });
    } else {
      setOnchainStanding(null);
      setOnchainMeta(null);
    }
  }, []);

  useEffect(() => {
    if (!wallet) return;
    const t = window.setTimeout(() => {
      loadRel(wallet).catch((e) => setError(e instanceof Error ? e.message : "load failed"));
    }, 200);
    return () => window.clearTimeout(t);
  }, [wallet, loadRel]);

  useEffect(() => {
    if (!wallet || !Number(amount)) {
      setQuote(null);
      return;
    }
    const t = window.setTimeout(() => {
      fetch("/api/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            wallet,
            amount: Number(amount),
            merchant,
            persist: false,
          }),
      })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "quote failed");
          setQuote(d as PurchaseResult);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "quote failed"));
    }, 350);
    return () => window.clearTimeout(t);
  }, [wallet, amount, merchant]);

  async function requestPurchase() {
    if (!injected.address) {
      await injected.connect();
      return;
    }
    setBusy(true);
    setDeciding(true);
    setShowOutput(false);
    setError(null);
    setNote(null);
    setPayoutHash(null);
    setPayoutLive(false);
    const started = Date.now();
    try {
      const quoted = await fetch("/api/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet,
          amount: Number(amount),
          merchant,
        }),
      });
      const q = await quoted.json();
      if (!quoted.ok) throw new Error(q.error || "quote failed");
      setQuote(q as PurchaseResult);
      const ok =
        q.terms?.decision === "Approve" || q.terms?.decision === "Approve with reduced limit";
      if (ok) {
        const acc = await fetch("/api/purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wallet,
            amount: Number(amount),
            merchant,
            accept: true,
          }),
        });
        const data = await acc.json();
        if (!acc.ok) throw new Error(data.error || "accept failed");
        if (data.quote) setQuote(data.quote);
        if (data.purchase) setLastPurchase(data.purchase as PurchaseRecord);
        const hash = data.tx?.txHash || data.purchase?.payout_tx_hash || null;
        const live = data.payout_mode === "on_chain" && Boolean(data.tx?.sent) && Boolean(hash);
        setPayoutHash(hash);
        setPayoutLive(live);
        setNote(null);
        await loadRel(wallet);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      const wait = 1400 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => window.setTimeout(r, wait));
      setDeciding(false);
      setShowOutput(true);
      setBusy(false);
    }
  }

  async function repay(purchaseId: string, remaining = false) {
    if (!injected.address) {
      await injected.connect();
      return;
    }
    const plan = (rel?.purchases || []).find((p) => p.purchase_id === purchaseId);
    const pending = (plan?.schedule || []).filter((i) => i.status === "pending");
    const next = pending[0];
    if (!next) {
      setError("No pending installment to repay.");
      return;
    }
    const amountUsd = remaining ? pending.reduce((s, i) => s + i.amount, 0) : next.amount;
    setBusy(true);
    setError(null);
    setNote("Confirm the ETH transfer in your wallet…");
    try {
      if (injected.wrongNetwork) await injected.switchBaseSepolia();
      const eth = getInjectedEthereum();
      if (!eth) throw new Error("No injected wallet. Connect MetaMask, Rabby, or Coinbase Wallet.");
      const agentRes = await fetch("/api/agent-status");
      const agent = await agentRes.json();
      if (!agent.address) throw new Error("Alex’s account is not published.");
      if (!(agent.eth_usd > 0)) throw new Error("Could not read the ETH price for this repay.");
      const sent = await sendUserRepay({
        from: injected.address,
        agent: agent.address,
        amountUsd,
        ethUsd: agent.eth_usd,
        request: eth.request,
      });
      setNote("Transfer sent. Recording repayment…");
      const res = await fetch("/api/repay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: injected.address,
          purchase_id: purchaseId,
          tx_hash: sent.hash,
          pay_remaining: remaining,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "repay failed");
      setNote(
        `Repaid ${data.installment?.status || "on time"} on-chain. Limit now ${Number(data.limit).toFixed(0)}.`,
      );
      await loadRel(injected.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "repay failed");
      setNote(null);
    } finally {
      setBusy(false);
    }
  }

  const empty = !rel || rel.total_purchases === 0;
  const active = rel?.purchases.filter((p) => p.outcome === "active") ?? [];
  const score = scoreFromRel(rel, onchainStanding);
  const breakdown = useMemo(() => {
    if (!injected.connected) return null;
    if (!rel || rel.total_purchases === 0) {
      const age = quote?.onchain?.wallet_age_days ?? onchainMeta?.age;
      const txs = quote?.onchain?.tx_count ?? onchainMeta?.txs;
      if (age == null || txs == null) return null;
      return onchainStandingBreakdown(age, txs);
    }
    return standingBreakdown(rel);
  }, [injected.connected, rel, quote, onchainMeta]);
  const timeline = useMemo(() => (rel && rel.total_purchases > 0 ? memoryTimeline(rel) : []), [rel]);
  const tag = badge(rel);
  const completed = rel ? rel.on_time_count + rel.late_count + rel.default_count : 0;
  const onTimeRate = completed > 0 && rel ? `${Math.round((rel.on_time_count / completed) * 100)}%` : "—";
  const schedule = quote?.terms?.due_dates ?? [];
  const instN = quote?.terms?.installments ?? 0;
  const instAmt = quote?.terms?.installment_amount ?? 0;

  const primaryLabel = useMemo(() => {
    if (!injected.connected) return "Connect Wallet";
    if (deciding) return "Alex is thinking…";
    if (busy) return "Working…";
    if (quote?.terms?.outcome === "insolvent_declined") return "Agent insolvent";
    if (quote?.terms?.decision === "Decline" || quote?.terms?.decision === "Ceiling blocked") {
      return quote.terms.decision;
    }
    return "Request Purchase";
  }, [injected.connected, busy, deciding, quote]);

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <section className="glass-panel standing-hero min-w-0 p-5 sm:p-8 md:p-12">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Your standing</h2>
        <div className="mt-10 flex flex-col gap-10 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-3">
            <ScoreRing score={injected.connected ? score : null} />
            <span className={`rounded-full border px-5 py-1.5 text-sm font-medium shadow-sm ${tag.cls}`}>
              {injected.connected ? tag.label : "CONNECT WALLET"}
            </span>
            {injected.connected ? <ScoreBreakdown breakdown={breakdown} /> : null}
          </div>
          <div className="min-w-0 flex-1 space-y-5">
            <p className="text-[15px] leading-7 text-neutral-600">
              {injected.connected
                ? standingCopy(rel, quote)
                : "Connect a wallet to load this agent’s memory of you. If it has never approved a purchase for that address, Alex hasn't built up a relationship with you yet, so it uses a conservative on-chain baseline."}
            </p>
            {timeline.length > 0 ? (
              <div className="border-t border-black/5 pt-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">With this agent</p>
                <MemoryTimeline events={timeline} compact />
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2 border-t border-black/5 pt-4 sm:gap-4">
              {(
                [
                  ["Current Limit", empty ? "—" : formatAmount(rel!.current_limit)],
                  ["On-Time Rate", onTimeRate],
                  ["Purchases Completed", String(completed)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <p className="text-[10px] font-medium uppercase leading-tight tracking-[0.08em] text-neutral-500 sm:text-[11px] sm:tracking-[0.12em]">{k}</p>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-neutral-900 sm:text-base">{v}</p>
                </div>
              ))}
            </div>
            {deciding ? (
              <div className="flex flex-col items-start border-t border-black/5 pt-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7828E8]/10">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#7828E8]" />
                </span>
                <p className="mt-3 text-sm font-semibold text-neutral-900">Alex is thinking</p>
                <p className="mt-1 text-[13px] text-neutral-500">{THINK_LINES[thinkI]}</p>
              </div>
            ) : showOutput && quote ? (
              <div className="space-y-4 border-t border-black/5 pt-4">
                <div className="rounded-xl bg-[#7828E8]/[0.07] px-4 py-3 ring-1 ring-[#7828E8]/20">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7828E8]">
                    Memory just changed
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-neutral-900">
                    Score: {Math.round((lastPurchase?.score_before ?? quote.verdict.score ?? 0) * 100)} →{" "}
                    {Math.round((lastPurchase?.score_after ?? rel?.current_standing_score ?? quote.verdict.score ?? 0) * 100)}
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-neutral-900">
                    Limit: {formatAmount(lastPurchase?.limit_before ?? quote.terms.available)} →{" "}
                    {formatAmount(lastPurchase?.limit_after ?? rel?.current_limit ?? quote.terms.available)}
                  </p>
                </div>
                <div className="border-t border-black/[0.08] pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Decision</p>
                  {quote.verdict.why ? (
                    <p className="mt-2 text-[15px] leading-6 text-neutral-900">{quote.verdict.why}</p>
                  ) : null}
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-neutral-800">
                    {`Decision: ${quote.verdict.decision}`}
                  </pre>
                </div>
                <div className="border-t border-black/[0.08] pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Reasoning</p>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-neutral-800">
                    {(quote.verdict.reasoning || []).map((line) => `- ${line}`).join("\n")}
                  </pre>
                </div>
                <div className="border-t border-black/[0.08] pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Terms</p>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-neutral-800">
                    {quote.verdict.terms}
                  </pre>
                </div>
                {lastPurchase ? (
                  <div className="space-y-2">
                    <PayoutNotice
                      amountUsd={lastPurchase.amount}
                      hash={payoutHash}
                      live={payoutLive}
                    />
                    <Link
                      href={`/log#${lastPurchase.purchase_id}`}
                      className="inline-block text-[12px] font-medium text-[#7828E8] hover:underline"
                    >
                      See this in the Agent Log →
                    </Link>
                  </div>
                ) : note ? (
                  <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200/80">
                    <p className="font-medium">{note}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {injected.connected && active.length > 0 ? (
              <div className="space-y-3 border-t border-black/5 pt-4">
                <p className="text-[11px] font-medium text-neutral-500">Open plans, repay here</p>
                {active.map((p) => {
                  const pending = p.schedule.filter((i) => i.status === "pending");
                  const next = pending[0];
                  const paid = p.schedule.filter((i) => i.status !== "pending").length;
                  const rest = pending.reduce((s, i) => s + i.amount, 0);
                  return (
                    <div
                      key={p.purchase_id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/[0.03] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                          {formatAmount(p.amount)} · {p.merchant}
                        </p>
                        <p className="mt-0.5 text-[12px] text-neutral-500">
                          {paid}/{p.installments} paid
                          {next ? ` · next ${formatAmount(next.amount)} due ${next.due_date.slice(0, 10)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || !next}
                          onClick={() => repay(p.purchase_id, false)}
                          className="rounded-full bg-[#7828E8] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6a1fd4] disabled:opacity-50"
                        >
                          {busy ? "Confirm in wallet…" : `Pay next ${next ? formatAmount(next.amount) : ""}`}
                        </button>
                        {pending.length > 1 ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => repay(p.purchase_id, true)}
                            className="rounded-full border border-[#7828E8]/40 px-4 py-2 text-xs font-semibold text-[#7828E8] hover:bg-[#7828E8]/5 disabled:opacity-50"
                          >
                            Pay remaining {formatAmount(rest)}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-neutral-400">
                  Amounts are shown in USDC. Repay sends the ETH equivalent to Alex on Base Sepolia.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="glass-panel p-6 md:p-7">
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="text-neutral-400">
              <circle cx="3.2" cy="5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="6.8" cy="5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Base Sepolia
          </span>
        </div>
        <div className="mb-4 flex w-fit items-center gap-2 rounded-full bg-black/5 p-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7828E8] px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
            Testnet
          </span>
          <span className="inline-flex cursor-not-allowed items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-neutral-400">
            Mainnet
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-bold uppercase">Soon</span>
          </span>
        </div>

        <div className="space-y-1">
          <div className="rounded-well bg-black/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-500">Pay</span>
              <span className="text-sm font-semibold text-neutral-900">USDC</span>
            </div>
            <input
              type="number"
              min={0}
              step="any"
              className="w-full bg-transparent text-2xl font-semibold text-neutral-900 outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
              <p className="mt-2 text-[11px] text-neutral-400">Shown in USDC · settled in ETH</p>
          </div>

          <div className="flex justify-center py-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-neutral-400">
              ↓
            </span>
          </div>

          <div className="rounded-well bg-black/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-500">Merchant</span>
            </div>
            <select
              className="w-full bg-transparent text-sm font-semibold text-neutral-900 outline-none"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            >
              {MERCHANTS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-neutral-400">
              Merchant is a label. ETH is sent to your connected wallet, not to Sibyl Labs.
            </p>
          </div>

          <div className="flex justify-center py-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-neutral-400">
              ↓
            </span>
          </div>

          <div className="rounded-well bg-black/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-500">You&apos;ll pay back</span>
              <span className="text-sm font-semibold text-neutral-900">{instN ? `${instN}×` : "—"}</span>
            </div>
            <div className="min-h-[32px] text-2xl font-semibold text-neutral-900">
              {instN > 0 ? `${formatAmount(instAmt)} × ${instN}` : "—"}
            </div>
            {schedule.length > 0 ? (
              <>
                <p className="mt-2 text-[11px] text-neutral-500">
                  Due {schedule.map((d) => d.slice(0, 10)).join(" · ")}
                </p>
                {quote?.terms.interest_rate != null ? (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Trace interest {Math.round(quote.terms.interest_rate * 100)}% · receive{" "}
                    {formatAmount(quote.terms.principal || quote.terms.payout_amount)} · repay{" "}
                    {formatAmount(quote.terms.total_due || 0)}. You can pay the rest in one shot when you
                    repay.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-[11px] text-neutral-400">Enter an amount to see the schedule.</p>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={
            busy ||
            quote?.terms?.outcome === "insolvent_declined" ||
            quote?.terms?.decision === "Decline" ||
            quote?.terms?.decision === "Ceiling blocked"
          }
          onClick={requestPurchase}
          className="mt-4 w-full rounded-full bg-[#7828E8] py-3 text-sm font-semibold tracking-wide text-white shadow-md transition hover:bg-[#7828E8]/90 disabled:opacity-50"
        >
          {primaryLabel}
        </button>
        {quote && injected.connected ? (
          <p className="mt-3 text-center text-[11px] text-neutral-500">
            {quote.verdict.decision}
            {quote.terms.used_onchain ? " · on-chain fallback" : " · relationship memory"}
            {quote.verdict.score ? ` · score ${Math.round(quote.verdict.score * 100)}` : ""}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-center text-[12px] text-red-600">{error}</p> : null}
        {note ? <p className="mt-3 text-center text-[12px] text-emerald-700">{note}</p> : null}
        {wallet && injected.address && wallet !== injected.address ? (
          <p className="mt-2 text-center font-mono text-[10px] text-neutral-400">quoting {shortAddress(wallet)}</p>
        ) : null}
      </aside>
    </div>
  );
}
