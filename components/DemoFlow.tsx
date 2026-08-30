"use client";

import { useCallback, useEffect, useState } from "react";
import { DecisionTrace, PartnerColumns } from "@/components/DecisionTrace";
import { getInjectedEthereum, useInjectedWallet } from "@/components/ConnectWallet";
import { sendUserRepay } from "@/lib/bnpl/sendUserRepay";
import { DEMO_SKU } from "@/lib/bnpl/walkthrough";
import { formatAmount, shortAddress } from "@/lib/format";
import type { PurchaseRecord, PurchaseResult, UserRelationship } from "@/types/bnpl";

const STEPS = [
  { n: "1", title: "Empty book", body: "Same wallet the whole way. First-time terms come from ONCHAIN_SIGNAL only." },
  { n: "2", title: "Buy Notebook $12", body: "Approve the default SKU. ETH settles on Base if BASE_EXECUTE=1." },
  { n: "3", title: "Repay", body: "Sibyl writes repaymentStatus only after ETH to the agent is verified." },
  { n: "4", title: "Fresh session", body: "New request, same wallet. USER_RELATIONSHIP is primary. ONCHAIN_SIGNAL is not used." },
  { n: "5", title: "Delete memory", body: "Delete Sibyl for this wallet. Chain is unchanged. First-time terms return." },
] as const;

type Step = 1 | 2 | 3 | 4 | 5;

function keysRead(rel: UserRelationship | null, usedOnchain: boolean) {
  if (!rel || rel.total_purchases === 0 || usedOnchain) {
    return "USER_RELATIONSHIP (empty), ONCHAIN_SIGNAL (age, tx_count)";
  }
  return "USER_RELATIONSHIP (purchases, schedules, outcomes, snapshot)";
}

export function DemoFlow({ started }: { started: string }) {
  const injected = useInjectedWallet();
  const [step, setStep] = useState<Step>(1);
  const [rel, setRel] = useState<UserRelationship | null>(null);
  const [quote, setQuote] = useState<PurchaseResult | null>(null);
  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null);
  const [payoutHash, setPayoutHash] = useState<string | null>(null);
  const [repayHash, setRepayHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadRel = useCallback(async (addr: string) => {
    const res = await fetch(`/api/relationship/${addr}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "relationship failed");
    setRel(data.relationship as UserRelationship);
    return data.relationship as UserRelationship;
  }, []);

  const quoteSku = useCallback(async (addr: string) => {
    const res = await fetch("/api/purchase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: addr, amount: DEMO_SKU.price, merchant: "Test Shop" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "quote failed");
    setQuote(data as PurchaseResult);
    return data as PurchaseResult;
  }, []);

  useEffect(() => {
    if (!injected.address) {
      setRel(null);
      setQuote(null);
      return;
    }
    let live = true;
    Promise.all([loadRel(injected.address), quoteSku(injected.address)])
      .then(() => {
        if (!live) return;
        setError(null);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "failed");
      });
    return () => {
      live = false;
    };
  }, [injected.address, loadRel, quoteSku]);

  async function ensureWallet() {
    if (!injected.address) {
      await injected.connect();
      return null;
    }
    return injected.address;
  }

  async function buy() {
    const addr = await ensureWallet();
    if (!addr) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: addr,
          amount: DEMO_SKU.price,
          merchant: "Test Shop",
          accept: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "accept failed");
      const rec = data.purchase as PurchaseRecord;
      setPurchase(rec);
      setPayoutHash(data.tx?.txHash || rec.payout_tx_hash || null);
      if (data.quote) setQuote(data.quote as PurchaseResult);
      await loadRel(addr);
      setNote("Purchase recorded. Repay in step 3.");
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "buy failed");
    } finally {
      setBusy(false);
    }
  }

  async function repay() {
    const addr = await ensureWallet();
    if (!addr) return;
    const book = rel || (await loadRel(addr));
    const plan =
      (purchase && book.purchases.find((p) => p.purchase_id === purchase.purchase_id)) ||
      book.purchases.find((p) => p.outcome === "active");
    const pending = (plan?.schedule || []).filter((i) => i.status === "pending");
    if (!plan || !pending.length) {
      setError("No open installment. Buy $12 in step 2 first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (injected.wrongNetwork) await injected.switchBaseSepolia();
      const eth = getInjectedEthereum();
      if (!eth) throw new Error("Connect MetaMask, Rabby, or Coinbase Wallet.");
      const agentRes = await fetch("/api/agent-status");
      const agent = await agentRes.json();
      if (!agent.address) throw new Error("The TRACE agent account is not published.");
      const sent = await sendUserRepay({
        from: addr,
        agent: agent.address,
        amountUsd: pending.reduce((s, i) => s + i.amount, 0),
        ethUsd: agent.eth_usd,
        request: eth.request,
      });
      setRepayHash(sent.hash);
      const res = await fetch("/api/repay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: addr,
          purchase_id: plan.purchase_id,
          tx_hash: sent.hash,
          pay_remaining: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "repay failed");
      await loadRel(addr);
      setNote("Repayment written to Sibyl after the ETH was verified.");
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "repay failed");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSession() {
    const addr = await ensureWallet();
    if (!addr) return;
    setBusy(true);
    setError(null);
    try {
      await loadRel(addr);
      const q = await quoteSku(addr);
      if (q.terms.used_onchain) {
        setNote("This request still used ONCHAIN_SIGNAL. Finish an on-time repay in step 3 first.");
      } else {
        setNote("Fresh request, same wallet. USER_RELATIONSHIP is primary. ONCHAIN_SIGNAL not used.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    const addr = await ensureWallet();
    if (!addr) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/relationship/${addr}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "delete failed");
      const next = await loadRel(addr);
      const q = await quoteSku(addr);
      setPurchase(null);
      setPayoutHash(null);
      setRepayHash(null);
      setNote(
        next.total_purchases === 0 && q.terms.used_onchain
          ? "Sibyl is empty for this wallet. Chain is unchanged. First-time terms are back."
          : "Delete ran. Reload if the book still shows.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    } finally {
      setBusy(false);
    }
  }

  const terms = quote?.terms;
  const primary = terms?.primary_signal ?? (rel && rel.total_purchases > 0 ? "USER_RELATIONSHIP" : "ONCHAIN_SIGNAL");
  const empty = !rel || rel.total_purchases === 0;
  const open = (rel?.purchases || []).some((p) => p.outcome === "active");
  const completed = rel ? rel.on_time_count + rel.late_count + rel.default_count : 0;

  return (
    <div className="space-y-8">
      <p className="text-[13px] text-neutral-500">
        Connected: {injected.connected ? shortAddress(injected.address || "") : "none"} · started{" "}
        {started.slice(0, 19).replace("T", " ")} UTC · SKU {DEMO_SKU.name} {formatAmount(DEMO_SKU.price)}
      </p>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s) => {
          const n = Number(s.n) as Step;
          const active = step === n;
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => setStep(n)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                  active ? "bg-[#7828E8] text-white" : "bg-black/5 text-neutral-600"
                }`}
              >
                {s.n} {s.title}
              </button>
            </li>
          );
        })}
      </ol>

      <section className="glass-panel p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
          Step {step}
        </p>
        <h2 className="mt-1 text-[17px] font-semibold text-neutral-900">{STEPS[step - 1].title}</h2>
        <p className="mt-2 text-[14px] leading-6 text-neutral-600">{STEPS[step - 1].body}</p>

        {terms ? (
          <div className="mt-4">
            <DecisionTrace
              primary={primary}
              standing={terms.standing_score}
              limit={terms.limit}
              installments={terms.installments}
              interestRate={terms.interest_rate}
              keysRead={keysRead(rel, terms.used_onchain)}
              keysWritten={
                step === 2 && purchase
                  ? "USER_RELATIONSHIP.purchases, snapshot"
                  : step === 3 && repayHash
                    ? "USER_RELATIONSHIP.schedule, snapshot.last_outcome"
                    : step === 5
                      ? "USER_RELATIONSHIP deleted"
                      : undefined
              }
              txHash={step === 2 ? payoutHash : step === 3 ? repayHash : null}
              acpJobId={purchase?.acp?.jobId}
            />
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-neutral-500">
            {injected.connected ? "Loading this wallet’s book…" : "Connect a wallet in the header to start."}
          </p>
        )}

        {rel && completed === 0 && rel.total_purchases > 0 ? (
          <p className="mt-3 text-[13px] text-amber-800">
            Open plan. Standing is capped at 0.38 until this plan is finished. Limit {formatAmount(rel.current_limit)}.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-[13px] text-red-700">{error}</p> : null}
        {note ? <p className="mt-3 text-[13px] text-neutral-700">{note}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {!injected.connected ? (
            <button
              type="button"
              onClick={() => injected.connect()}
              className="rounded-full bg-[#7828E8] px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              Connect wallet
            </button>
          ) : null}
          {step === 1 ? (
            <button
              type="button"
              disabled={busy || !injected.connected}
              onClick={() => setStep(empty ? 2 : open ? 3 : 4)}
              className="rounded-full bg-[#0A0219] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              {empty ? "Book is empty, continue" : "This wallet already has a book, skip ahead"}
            </button>
          ) : null}
          {step === 2 ? (
            <button
              type="button"
              disabled={busy || !injected.connected}
              onClick={buy}
              className="rounded-full bg-[#7828E8] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Working…" : `Confirm ${DEMO_SKU.name} ${formatAmount(DEMO_SKU.price)}`}
            </button>
          ) : null}
          {step === 3 ? (
            <button
              type="button"
              disabled={busy || !injected.connected}
              onClick={repay}
              className="rounded-full bg-[#7828E8] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Confirm in wallet…" : "Repay remaining on-chain"}
            </button>
          ) : null}
          {step === 4 ? (
            <button
              type="button"
              disabled={busy || !injected.connected}
              onClick={refreshSession}
              className="rounded-full bg-[#7828E8] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Reading Sibyl…" : "Re-quote $12 as a new request"}
            </button>
          ) : null}
          {step === 5 ? (
            <button
              type="button"
              disabled={busy || !injected.connected}
              onClick={forget}
              className="rounded-full border border-black/15 px-5 py-2.5 text-[14px] font-semibold text-neutral-900 disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Delete Sibyl memory for this wallet"}
            </button>
          ) : null}
        </div>
      </section>

      <PartnerColumns
        remembered={
          empty
            ? "Nothing for this wallet. USER_RELATIONSHIP is empty."
            : `purchases=${rel?.total_purchases} on_time=${rel?.on_time_count} late=${rel?.late_count} default=${rel?.default_count}. ${rel?.snapshot?.trust_note || ""}`
        }
        requested={`Alex asked TRACE to quote ${DEMO_SKU.name} ${formatAmount(DEMO_SKU.price)}. Virtuals is identity${purchase?.acp?.jobId ? `, job ${purchase.acp.jobId}` : ""}. TRACE set the numbers.`}
        settled={
          payoutHash
            ? `ETH payout ${payoutHash.slice(0, 10)}…${repayHash ? ` repay ${repayHash.slice(0, 10)}…` : ""}`
            : "No Base hash yet. Confirm the $12 purchase with BASE_EXECUTE=1 to settle."
        }
      />
    </div>
  );
}
