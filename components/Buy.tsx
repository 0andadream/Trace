"use client";

import { useCallback, useEffect, useState } from "react";
import { getInjectedEthereum, useInjectedWallet } from "@/components/ConnectWallet";
import { sendUserRepay } from "@/lib/bnpl/sendUserRepay";
import { CLEAN_BUYER, PENALIZED_BUYER } from "@/lib/bnpl/demo-wallets";
import { formatAmount, shortAddress } from "@/lib/format";
import { TxLink } from "@/components/TxLink";
import type { BnplDecision, PurchaseResult, UserRelationship } from "@/types/bnpl";

const TONE: Record<BnplDecision, string> = {
  Approve: "text-proceed",
  "Approve with reduced limit": "text-flag",
  Decline: "text-hold",
  "Ceiling blocked": "text-hold",
};

type Tab = "buy" | "repay";

export function Buy() {
  const injected = useInjectedWallet();
  const [tab, setTab] = useState<Tab>("buy");
  const [wallet, setWallet] = useState("");
  const [merchant, setMerchant] = useState("Test Shop");
  const [amount, setAmount] = useState("12");
  const [relationship, setRelationship] = useState<UserRelationship | null>(null);
  const [quote, setQuote] = useState<PurchaseResult | null>(null);
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

  async function onQuote() {
    const data = (await post("/api/purchase", {
      wallet,
      amount: Number(amount),
      merchant,
    })) as PurchaseResult;
    setQuote(data);
    return data;
  }

  async function onAccept(override = false) {
    const data = await post("/api/purchase", {
      wallet,
      amount: Number(amount),
      merchant,
      accept: true,
      override,
    });
    if (data.quote) setQuote(data.quote as PurchaseResult);
    setNote(
      data.payout_mode === "on_chain" && data.tx?.sent
        ? `Plan ${data.purchase.purchase_id} approved. On-chain payout.`
        : `Plan ${data.purchase.purchase_id} approved. Merchant payout simulated (not broadcast). ${data.tx?.reason || ""}`,
    );
    await loadRelationship(wallet);
  }

  async function onRepay(purchaseId: string, markDefault = false) {
    if (markDefault) {
      const data = await post("/api/repay", {
        wallet,
        purchase_id: purchaseId,
        mark_default: true,
      });
      setNote(`Purchase ${purchaseId} marked defaulted. Limit now ${Number(data.limit).toFixed(0)}.`);
      setQuote(null);
      return;
    }
    const plan = relationship?.purchases.find((p) => p.purchase_id === purchaseId);
    const next = plan?.schedule.find((i) => i.status === "pending");
    if (!next) throw new Error("No pending installment to repay.");
    if (injected.wrongNetwork) await injected.switchBaseSepolia();
    const eth = getInjectedEthereum();
    if (!eth) throw new Error("No injected wallet.");
    const agentRes = await fetch("/api/agent-status");
    const agent = await agentRes.json();
    if (!agent.address) throw new Error("Alex’s account is not published.");
    if (!(agent.eth_usd > 0)) throw new Error("Could not read the ETH price for this repay.");
    const sent = await sendUserRepay({
      from: wallet,
      agent: agent.address,
      amountUsd: next.amount,
      ethUsd: agent.eth_usd,
      request: eth.request,
    });
    const data = await post("/api/repay", {
      wallet,
      purchase_id: purchaseId,
      tx_hash: sent.hash,
    });
    setNote(
      `Installment paid on-chain (${data.installment?.status}). Plan ${data.outcome}. Limit now ${Number(data.limit).toFixed(0)}.`,
    );
    setQuote(null);
  }

  const empty = !relationship || relationship.total_purchases === 0;
  const decision = quote?.verdict.decision;
  const active = relationship?.purchases.filter((p) => p.outcome === "active") ?? [];

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section>
        <p className="text-sm text-paper-500">Alex</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">Buy now, pay later</h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-300">
          Connect a wallet and request a purchase in installments. Terms come from this agent&apos;s
          memory of plans it approved for you. On-chain history is a fallback for wallets it has
          never checked out.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(
            [
              { id: "buy" as const, label: "Buy" },
              { id: "repay" as const, label: "Repay" },
            ] as const
          ).map((t) => (
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
          <button type="button" className="btn-ghost h-8 px-3 text-[11px]" onClick={() => setWallet(CLEAN_BUYER)}>
            Sample: clean book
          </button>
          <button type="button" className="btn-ghost h-8 px-3 text-[11px]" onClick={() => setWallet(PENALIZED_BUYER)}>
            Sample: defaulted
          </button>
        </div>

        {tab === "buy" ? (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              onQuote().catch((err) => setError(err instanceof Error ? err.message : "failed"));
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-paper-500">
                Merchant
                <input className="field" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
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
              {busy ? "Working…" : "Request terms"}
            </button>
          </form>
        ) : (
          <div className="mt-5 space-y-3">
            {active.length === 0 ? (
              <p className="text-sm text-paper-500">No active installment plans in this agent&apos;s book for this wallet.</p>
            ) : (
              active.map((p) => {
                const next = p.schedule.find((i) => i.status === "pending");
                const paid = p.schedule.filter((i) => i.status !== "pending").length;
                return (
                  <article key={p.purchase_id} className="panel p-4">
                    <p className="text-sm">
                      {formatAmount(p.amount)} at {p.merchant} · {paid}/{p.installments} paid
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-paper-500">
                      {p.purchase_id}
                      {next ? ` · next due ${next.due_date.slice(0, 10)} · ${formatAmount(next.amount)}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-paper-500">
                      Agent payout: {p.payout_mode === "on_chain" ? "on-chain" : "simulated"}
                      {p.payout_tx_hash ? (
                        <>
                          {" · "}
                          <TxLink hash={p.payout_tx_hash} className="text-[11px]" />
                        </>
                      ) : null}{" "}
                      · repay sends ETH to Alex
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="btn-trace h-9 px-3 text-xs"
                        disabled={busy || !next}
                        onClick={() => onRepay(p.purchase_id)}
                      >
                        Mark installment paid
                      </button>
                      <button
                        className="btn-hold h-9 px-3 text-xs"
                        disabled={busy}
                        onClick={() => onRepay(p.purchase_id, true)}
                      >
                        Mark default
                      </button>
                    </div>
                  </article>
                );
              })
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
              <p className="mt-2 text-sm text-hold">USER_RELATIONSHIP is empty. No purchase history exists.</p>
            ) : (
              <p className="mt-2 text-sm text-paper-300">
                {relationship!.total_purchases} purchases · {relationship!.on_time_count} on_time ·{" "}
                {relationship!.late_count} late · {relationship!.default_count} defaulted · limit{" "}
                {formatAmount(relationship!.current_limit)} · standing {relationship!.current_standing_score.toFixed(2)}
              </p>
            )}
          </article>
          <article className="panel p-4">
            <div className="text-xs text-trace">AGENT_BOOK</div>
            {quote?.agent_book ? (
              <p className="mt-2 text-sm text-paper-300">
                exposure {formatAmount(quote.agent_book.outstanding_exposure)} · reserve{" "}
                {formatAmount(quote.agent_book.reserve)} · spendable {formatAmount(quote.agent_book.spendable_usd)} ·
                deployable {formatAmount(quote.agent_book.deployable)}
                {quote.agent_book.simulated_balance ? " · balance simulated" : ""}
                {quote.agent_book.execute ? "" : " · payouts simulated"}
              </p>
            ) : (
              <p className="mt-2 text-sm text-paper-500">Request terms to load the agent&apos;s own capital posture.</p>
            )}
          </article>
          <article className="panel p-4">
            <div className="text-xs text-trace">ONCHAIN_SIGNAL</div>
            {empty ? (
              <p className="mt-2 text-sm text-paper-300">
                Secondary. Fetched fresh, not stored. Used only because total_purchases == 0.
              </p>
            ) : (
              <p className="mt-2 text-sm text-paper-500">
                Not used. This wallet has purchase history, on-chain data does not enter the terms function.
              </p>
            )}
          </article>
        </div>
      </section>

      <section className="panel flex min-h-[28rem] flex-col p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-paper-500">Output</p>
        {quote ? (
          <>
            {quote.verdict.why ? (
              <p className="mt-4 text-sm leading-relaxed text-paper">{quote.verdict.why}</p>
            ) : null}
            <pre className="mt-4 flex-1 whitespace-pre-wrap font-mono text-sm leading-relaxed text-paper">
              {`Decision: ${quote.verdict.decision}

Reasoning:
${quote.verdict.reasoning.map((line) => `- ${line}`).join("\n")}

${quote.verdict.terms}`}
            </pre>
            <p className={`mt-2 text-sm ${decision ? TONE[decision] : ""}`}>
              {quote.terms.outcome === "insolvent_declined"
                ? "insolvent_declined · agent capital, not user reputation"
                : quote.terms.used_onchain
                  ? "primary ONCHAIN_SIGNAL"
                  : "primary USER_RELATIONSHIP"}
              {quote.terms.outstanding > 0 ? ` · user outstanding ${formatAmount(quote.terms.outstanding)}` : ""}
            </p>
            {quote.terms.decision === "Approve" || quote.terms.decision === "Approve with reduced limit" ? (
              <button className="btn-trace mt-5 h-10 px-4" disabled={busy} onClick={() => onAccept(false)}>
                Accept plan (agent fronts merchant)
              </button>
            ) : quote.terms.outcome === "insolvent_declined" ? null : quote.terms.decision === "Decline" ? (
              <button className="btn-hold mt-5 h-10 px-4" disabled={busy} onClick={() => onAccept(true)}>
                Override and approve
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-8 text-sm text-paper-500">
            Waiting for a request. Alex does not chat. Connect or paste a wallet, then ask for terms.
          </p>
        )}
      </section>
    </main>
  );
}
