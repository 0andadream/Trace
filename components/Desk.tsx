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

const THINK_LINES = ["Checking your history…", "Checking capacity…", "Writing the decision…"];
const CUSTOM_MERCHANT = "Test Shop";

const PRODUCTS = [
  { id: "notebook", name: "Notebook Set", price: 12 },
  { id: "lamp", name: "Desk Lamp", price: 40 },
  { id: "headphones", name: "Wireless Headphones", price: 150 },
] as const;

type ProductId = (typeof PRODUCTS)[number]["id"] | "custom";
type Step = "product" | "plan" | "reason" | "confirm" | "success";

const STEPS: { id: Step; n: string; label: string }[] = [
  { id: "product", n: "1", label: "Purchase" },
  { id: "plan", n: "2", label: "How you'll pay" },
  { id: "reason", n: "3", label: "Why you're eligible" },
  { id: "confirm", n: "4", label: "Confirm" },
];

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
    return `Sibyl has no financial history for this wallet yet. TRACE starts from a cautious onchain baseline.${chain} That signal is fetched fresh and is not stored. After one on-time repayment, memory takes over.`;
  }
  const completed = rel.on_time_count + rel.late_count + rel.default_count;
  return `Sibyl remembers ${completed} purchase${completed === 1 ? "" : "s"} with TRACE (${rel.on_time_count} on time, ${rel.late_count} late, ${rel.default_count} defaulted). Your TRACE limit is ${formatAmount(rel.current_limit)} across up to 2 open plans.`;
}

function formatDue(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function canApprove(quote: PurchaseResult | null) {
  const d = quote?.terms?.decision;
  return d === "Approve" || d === "Approve with reduced limit";
}

export function Desk() {
  const injected = useInjectedWallet();
  const [wallet, setWallet] = useState("");
  const [merchant, setMerchant] = useState(CUSTOM_MERCHANT);
  const [amount, setAmount] = useState("12");
  const [productId, setProductId] = useState<ProductId | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [step, setStep] = useState<Step>("product");
  const [rel, setRel] = useState<UserRelationship | null>(null);
  const [onchainStanding, setOnchainStanding] = useState<number | null>(null);
  const [onchainMeta, setOnchainMeta] = useState<{ age: number; txs: number } | null>(null);
  const [quote, setQuote] = useState<PurchaseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [repayingId, setRepayingId] = useState<string | null>(null);
  const [repayingRest, setRepayingRest] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [thinkI, setThinkI] = useState(0);
  const [showOutput, setShowOutput] = useState(false);
  const [lastPurchase, setLastPurchase] = useState<PurchaseRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [payoutHash, setPayoutHash] = useState<string | null>(null);
  const [payoutLive, setPayoutLive] = useState(false);
  const [payInFull, setPayInFull] = useState(false);

  const product = PRODUCTS.find((p) => p.id === productId) ?? null;
  const itemName = product?.name ?? (productId === "custom" ? "Custom amount" : null);

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
          pay_in_full: payInFull,
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
  }, [wallet, amount, merchant, payInFull]);

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
          pay_in_full: payInFull,
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
            pay_in_full: payInFull,
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
        setStep("success");
      } else {
        setStep("reason");
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
    setRepayingId(purchaseId);
    setRepayingRest(remaining);
    setError(null);
    setNote("Confirm the payment in your wallet…");
    try {
      if (injected.wrongNetwork) await injected.switchBaseSepolia();
      const eth = getInjectedEthereum();
      if (!eth) throw new Error("No injected wallet. Connect MetaMask, Rabby, or Coinbase Wallet.");
      const agentRes = await fetch("/api/agent-status");
      const agent = await agentRes.json();
      if (!agent.address) throw new Error("The TRACE agent account is not published.");
      if (!(agent.eth_usd > 0)) throw new Error("Could not read the settlement price for this repayment.");
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
      setRepayingId(null);
      setRepayingRest(false);
    }
  }

  function pickProduct(id: ProductId, price: number, _label: string) {
    setProductId(id);
    setAmount(String(price));
    setMerchant(CUSTOM_MERCHANT);
    setLastPurchase(null);
    setShowOutput(false);
    setStep("plan");
  }

  function go(next: Step) {
    if (next === "product") setStep("product");
    else if (next === "plan" && productId) setStep("plan");
    else if (next === "reason" && productId) setStep("reason");
    else if (next === "confirm" && productId && canApprove(quote)) setStep("confirm");
    else if (next === "success" && lastPurchase) setStep("success");
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
  const approved = canApprove(quote);
  const blocked =
    quote?.terms?.outcome === "insolvent_declined" ||
    quote?.terms?.decision === "Decline" ||
    quote?.terms?.decision === "Ceiling blocked";

  const confirmLabel = !injected.connected
    ? "Connect Wallet"
    : deciding
      ? "Checking your history…"
      : busy
        ? "Working…"
        : blocked
          ? quote?.terms?.decision || "Cannot confirm"
          : "Confirm purchase";

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <section className="glass-panel min-w-0 p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Buy with TRACE</h2>
            <p className="mt-1 text-[13px] text-neutral-500">
              Pay now or split your purchase into payments.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            TESTNET · BASE SEPOLIA
          </span>
        </div>

        {step !== "success" ? (
          <ol className="mt-6 flex flex-wrap gap-2">
            {STEPS.map((s, i) => {
              const activeStep = s.id === step;
              const reached = STEPS.findIndex((x) => x.id === step) >= i;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                      activeStep
                        ? "bg-[#7828E8] text-white"
                        : reached
                          ? "bg-[#7828E8]/10 text-[#7828E8]"
                          : "bg-black/5 text-neutral-400"
                    }`}
                  >
                    {s.n} {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}

        {step === "product" || step === "plan" ? (
          <div className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">Purchase</p>
            <p className="mt-1 text-[13px] text-neutral-500">
              Merchant: {merchant}. Amount sets what you&apos;re asking TRACE to front.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {PRODUCTS.map((p) => {
                const selected = productId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p.id, p.price, p.name)}
                    className={`rounded-2xl p-4 text-left ring-1 transition ${
                      selected
                        ? "bg-[#7828E8]/[0.07] ring-[#7828E8]/40"
                        : "bg-black/[0.03] ring-black/5 hover:ring-black/15"
                    }`}
                  >
                    <p className="text-sm font-semibold text-neutral-900">{p.name}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
                      {formatAmount(p.price)}
                    </p>
                    <p className="mt-2 text-[11px] text-neutral-400">Testnet purchase</p>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="mt-3 text-[12px] font-medium text-[#7828E8] hover:underline"
              onClick={() => setCustomOpen((v) => !v)}
            >
              {customOpen ? "Hide custom amount" : "Or enter an amount"}
            </button>
            {customOpen ? (
              <div className="mt-3 rounded-2xl bg-black/[0.03] p-4 ring-1 ring-black/5">
                <div className="flex items-end justify-between gap-3">
                  <label className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-neutral-500">Purchase amount</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="mt-1 w-full bg-transparent text-2xl font-semibold text-neutral-900 outline-none"
                      value={productId === "custom" ? amount : ""}
                      placeholder="0"
                      onChange={(e) => {
                        setProductId("custom");
                        setAmount(e.target.value);
                        setMerchant(CUSTOM_MERCHANT);
                        setLastPurchase(null);
                        setShowOutput(false);
                        if (step === "product") setStep("plan");
                      }}
                    />
                  </label>
                  <span className="text-sm font-semibold text-neutral-500">USDC</span>
                </div>
                <p className="mt-2 text-[11px] text-neutral-400">Testnet purchase amount</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "plan" ? (
          <div className="mt-8 border-t border-black/5 pt-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">How you&apos;ll pay</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
              {itemName} · {formatAmount(Number(amount) || 0)}
            </h3>
            <p className="mt-1 text-[13px] text-neutral-500">Merchant: {merchant}</p>
            {!injected.connected ? (
              <p className="mt-4 text-[15px] leading-7 text-neutral-600">
                Connect a wallet to see your TRACE limit and payment options.
              </p>
            ) : !quote ? (
              <p className="mt-4 text-sm text-neutral-500">Loading your offer…</p>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPayInFull(true)}
                    className={`rounded-2xl p-4 text-left ring-1 transition ${
                      payInFull
                        ? "bg-[#7828E8]/[0.07] ring-[#7828E8]/40"
                        : "bg-black/[0.03] ring-black/5 hover:ring-black/15"
                    }`}
                  >
                    <p className="text-sm font-semibold text-neutral-900">Pay today</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">
                      {formatAmount(quote.terms.total_due || Number(amount) || 0)}
                    </p>
                    <p className="mt-2 text-[12px] text-neutral-500">One payment of principal plus TRACE interest.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayInFull(false)}
                    className={`rounded-2xl p-4 text-left ring-1 transition ${
                      !payInFull
                        ? "bg-[#7828E8]/[0.07] ring-[#7828E8]/40"
                        : "bg-black/[0.03] ring-black/5 hover:ring-black/15"
                    }`}
                  >
                    <p className="text-sm font-semibold text-neutral-900">Pay with TRACE</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">
                      {instN ? `${instN} payments` : "—"}
                    </p>
                    <p className="mt-2 text-[12px] text-neutral-500">
                      {instN
                        ? `${formatAmount(instAmt)} each · repay ${formatAmount(quote.terms.total_due || 0)}`
                        : "Split into payments."}
                    </p>
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {(
                    [
                      [
                        "Available to spend",
                        empty && !quote.terms.used_onchain
                          ? "—"
                          : formatAmount(
                              empty ? quote.terms.available : rel!.current_limit,
                            ),
                      ],
                      ["Purchase", formatAmount(quote.terms.principal || Number(amount) || 0)],
                      [
                        "After purchase",
                        formatAmount(
                          Math.max(
                            0,
                            (empty ? quote.terms.available : rel!.current_limit) -
                              (quote.terms.principal || Number(amount) || 0),
                          ),
                        ) + " remaining",
                      ],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-black/[0.03] px-3 py-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-500">{k}</p>
                      <p className="mt-1 text-[15px] font-semibold tabular-nums leading-tight text-neutral-900">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-neutral-500">Your TRACE limit</p>
                {quote.terms.reduced_limit != null ? (
                  <p className="mt-2 text-sm text-amber-800">
                    You asked for {formatAmount(Number(amount))}. Eligible amount is{" "}
                    {formatAmount(quote.terms.reduced_limit)}.
                  </p>
                ) : null}
                {schedule.length > 0 ? (
                  <ul className="mt-5 divide-y divide-black/5 rounded-xl ring-1 ring-black/5">
                    {schedule.map((due, i) => (
                      <li key={`${due}-${i}`} className="flex items-center justify-between px-4 py-3 text-sm">
                        <span className="text-neutral-500">
                          {i === 0 ? "First payment" : `Payment ${i + 1}`}
                        </span>
                        <span className="font-medium tabular-nums text-neutral-900">{formatAmount(instAmt)}</span>
                        <span className="text-neutral-500">{formatDue(due)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-neutral-500">No repayment schedule on this offer.</p>
                )}
                {quote.terms.interest_rate != null && instN > 0 ? (
                  <p className="mt-3 text-[13px] leading-6 text-neutral-500">
                    TRACE interest {Math.round(quote.terms.interest_rate * 100)}% · total repayment{" "}
                    {formatAmount(quote.terms.total_due || 0)}.
                  </p>
                ) : null}
              </>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep("product")}
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-black/5"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!injected.connected}
                onClick={async () => {
                  if (!injected.connected) {
                    await injected.connect();
                    return;
                  }
                  setStep("reason");
                }}
                className="rounded-full bg-[#7828E8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6a1fd4] disabled:opacity-50"
              >
                {injected.connected ? "Why you're eligible" : "Connect Wallet"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "reason" ? (
          <div className="mt-8 border-t border-black/5 pt-6">
            {!injected.connected ? (
              <p className="text-[15px] text-neutral-600">Connect a wallet to see why you&apos;re eligible.</p>
            ) : deciding ? (
              <div>
                <p className="text-sm font-semibold text-neutral-900">Checking your history</p>
                <p className="mt-1 text-[13px] text-neutral-500">{THINK_LINES[thinkI]}</p>
              </div>
            ) : quote ? (
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Why you&apos;re eligible
                  </p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">
                    {quote.verdict.decision}
                  </h3>
                  {quote.verdict.why ? (
                    <p className="mt-3 text-[17px] leading-7 text-neutral-800">{quote.verdict.why}</p>
                  ) : null}
                  <p className="mt-3 text-[15px] leading-6 text-neutral-700">
                    Sibyl remembers your financial history.
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    Powered by Sibyl Memory
                    {quote.verdict.score ? ` · TRACE reputation ${Math.round(quote.verdict.score * 100)}` : ""}
                    {quote.terms.used_onchain ? " · onchain baseline (no purchases on file yet)" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                    What TRACE used
                  </p>
                  <ul className="mt-3 space-y-2 text-[15px] leading-6 text-neutral-800">
                    {(quote.verdict.reasoning || []).map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7828E8]" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Terms</p>
                  <p className="mt-2 font-mono text-[13px] leading-6 text-neutral-800">{quote.verdict.terms}</p>
                </div>
                {injected.connected ? (
                  <div className="rounded-2xl bg-black/[0.03] px-4 py-4">
                    <div className="flex items-start gap-4">
                      <ScoreRing score={score} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-neutral-500">Your TRACE reputation</p>
                        <ScoreBreakdown breakdown={breakdown} open />
                      </div>
                    </div>
                    {timeline.length > 0 ? (
                      <div className="mt-5 border-t border-black/5 pt-4">
                        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                          Financial history on file
                        </p>
                        <MemoryTimeline events={timeline} compact />
                      </div>
                    ) : (
                      <p className="mt-4 text-[13px] text-neutral-500">{standingCopy(rel, quote)}</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Waiting on your offer…</p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep("plan")}
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-black/5"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!approved || deciding}
                onClick={() => setStep("confirm")}
                className="rounded-full bg-[#7828E8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6a1fd4] disabled:opacity-50"
              >
                {blocked ? quote?.terms.decision : "Continue to confirm"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "confirm" ? (
          <div className="mt-8 border-t border-black/5 pt-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">Confirm purchase</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
              {itemName ?? "Purchase"}
            </h3>
            {deciding ? (
              <div className="mt-6">
                <p className="text-sm font-semibold text-neutral-900">Checking your history</p>
                <p className="mt-1 text-[13px] text-neutral-500">{THINK_LINES[thinkI]}</p>
              </div>
            ) : quote ? (
              <dl className="mt-5 divide-y divide-black/5 rounded-xl ring-1 ring-black/5">
                {(
                  [
                    ["Purchase", itemName ?? "—"],
                    ["Merchant", merchant],
                    ["Amount", formatAmount(quote.terms.principal || Number(amount) || 0)],
                    [
                      "How you'll pay",
                      payInFull || instN === 1
                        ? "Pay today"
                        : `Pay with TRACE · ${instN} payments of ${formatAmount(instAmt)}`,
                    ],
                    ["Total repayment", formatAmount(quote.terms.total_due || 0)],
                    ["Schedule", schedule.map(formatDue).join(" · ") || "—"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-neutral-500">{k}</dt>
                    <dd className="text-right font-medium text-neutral-900">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep("reason")}
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-black/5"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || deciding || blocked}
                onClick={requestPurchase}
                className="rounded-full bg-[#7828E8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6a1fd4] disabled:opacity-50"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        ) : null}

        {step === "success" ? (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7828E8]">
                Recorded in Sibyl Memory
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
                Your next purchase will reflect this.
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-neutral-600">
                Your reputation compounds because your history is remembered.
              </p>
            </div>
            {lastPurchase && quote ? (
              <div className="rounded-xl bg-[#7828E8]/[0.07] px-4 py-3 ring-1 ring-[#7828E8]/20">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7828E8]">
                  Your next limit
                </p>
                <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-neutral-900">
                  Score: {Math.round((lastPurchase.score_before ?? quote.verdict.score ?? 0) * 100)} →{" "}
                  {Math.round((lastPurchase.score_after ?? rel?.current_standing_score ?? quote.verdict.score ?? 0) * 100)}
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-neutral-900">
                  Limit: {formatAmount(lastPurchase.limit_before ?? quote.terms.available)} →{" "}
                  {formatAmount(lastPurchase.limit_after ?? rel?.current_limit ?? quote.terms.available)}
                </p>
              </div>
            ) : null}
            {lastPurchase ? (
              <PayoutNotice amountUsd={lastPurchase.amount} hash={payoutHash} live={payoutLive} />
            ) : null}
            {quote ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Decision</p>
                <p className="mt-2 text-lg font-semibold text-neutral-900">{quote.verdict.decision}</p>
                {quote.verdict.why ? (
                  <p className="mt-1 text-[15px] leading-6 text-neutral-700">{quote.verdict.why}</p>
                ) : null}
              </div>
            ) : null}
            {lastPurchase ? (
              <Link
                href={`/log#${lastPurchase.purchase_id}`}
                className="inline-block text-[13px] font-medium text-[#7828E8] hover:underline"
              >
                See this in the Agent Log →
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setStep("product");
                setLastPurchase(null);
                setShowOutput(false);
              }}
              className="block rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-black/5"
            >
              New purchase
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {note && step !== "success" ? <p className="mt-3 text-sm text-emerald-700">{note}</p> : null}
      </section>

      <aside className="space-y-6">
        <section className="glass-panel standing-hero p-6 md:p-7">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Your TRACE reputation</h2>
          <p className="mt-1 text-[13px] text-neutral-500">Built from your financial history.</p>
          <div className="mt-6 flex flex-col items-center">
            <ScoreRing score={injected.connected ? score : null} />
            <span className={`mt-3 rounded-full border px-4 py-1 text-[12px] font-medium shadow-sm ${tag.cls}`}>
              {injected.connected ? tag.label : "CONNECT WALLET"}
            </span>
          </div>
          <p className="mt-5 text-[14px] leading-6 text-neutral-600">
            {injected.connected
              ? standingCopy(rel, quote)
              : "Connect a wallet to load your TRACE reputation. If Sibyl has no history for that address, TRACE starts from a cautious onchain baseline."}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-black/5 pt-4">
            {(
              [
                ["TRACE limit", empty ? "—" : formatAmount(rel!.current_limit)],
                ["On-time rate", onTimeRate],
                ["Purchases", String(completed)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <p className="text-[10px] font-medium uppercase leading-tight tracking-[0.08em] text-neutral-500">
                  {k}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900">{v}</p>
              </div>
            ))}
          </div>
          {step !== "reason" && injected.connected ? (
            <button
              type="button"
              className="mt-4 text-[12px] font-medium text-[#7828E8] hover:underline"
              onClick={() => {
                if (productId) setStep("reason");
                else setStep("product");
              }}
            >
              {productId ? "Why you're eligible →" : "Choose a purchase to see eligibility →"}
            </button>
          ) : null}
        </section>

        {injected.connected && active.length > 0 ? (
          <section className="glass-panel p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Upcoming payments
            </p>
            <div className="mt-4 space-y-3">
              {active.map((p) => {
                const pending = p.schedule.filter((i) => i.status === "pending");
                const next = pending[0];
                const paid = p.schedule.filter((i) => i.status !== "pending").length;
                const rest = pending.reduce((s, i) => s + i.amount, 0);
                return (
                  <div
                    key={p.purchase_id}
                    className={`rounded-xl bg-black/[0.03] px-4 py-3 ${
                      repayingId === p.purchase_id ? "ring-1 ring-[#7828E8]/35" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-neutral-900">
                      {formatAmount(p.amount)} · {p.merchant}
                    </p>
                    <p className="mt-0.5 text-[12px] text-neutral-500">
                      {paid} of {p.installments} payments complete
                      {next ? ` · next ${formatAmount(next.amount)} on ${next.due_date.slice(0, 10)}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || !next}
                        onClick={() => repay(p.purchase_id, false)}
                        className="rounded-full bg-[#7828E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6a1fd4] disabled:opacity-50"
                      >
                        {repayingId === p.purchase_id && !repayingRest
                          ? "Confirm in wallet…"
                          : `Pay next ${next ? formatAmount(next.amount) : ""}`}
                      </button>
                      {pending.length > 1 ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => repay(p.purchase_id, true)}
                          className="rounded-full border border-[#7828E8]/40 px-4 py-2 text-xs font-semibold text-[#7828E8] hover:bg-[#7828E8]/5 disabled:opacity-50"
                        >
                          {repayingId === p.purchase_id && repayingRest
                            ? "Confirm in wallet…"
                            : `Pay remaining ${formatAmount(rest)}`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-neutral-400">
              Pay on time and your future capacity can increase — TRACE remembers the repayment.
            </p>
          </section>
        ) : null}

        <p className="px-1 text-[11px] leading-5 text-neutral-400">
          Testnet only — no real goods or loans are provided. Powered by Sibyl Memory.
          {wallet && injected.address && wallet !== injected.address
            ? ` Quoting ${shortAddress(wallet)}.`
            : null}
        </p>
        {showOutput && quote && step !== "success" && step !== "reason" ? (
          <p className="px-1 text-[12px] text-neutral-500">{quote.verdict.decision}</p>
        ) : null}
      </aside>
    </div>
  );
}
