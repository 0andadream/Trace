"use client";

import { useCallback, useEffect, useState } from "react";
import { getInjectedEthereum, useInjectedWallet } from "@/components/ConnectWallet";
import { sendUserRepay } from "@/lib/bnpl/sendUserRepay";
import { MemoryTimeline } from "@/components/MemoryTimeline";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { memoryTimeline, standingBreakdown } from "@/lib/bnpl/relationship";
import { formatAmount, shortAddress } from "@/lib/format";
import { TxLink } from "@/components/TxLink";
import type { UserRelationship } from "@/types/bnpl";

export function HistoryView() {
  const injected = useInjectedWallet();
  const [rel, setRel] = useState<UserRelationship | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [repayingId, setRepayingId] = useState<string | null>(null);
  const [repayingRest, setRepayingRest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgetting, setForgetting] = useState(false);
  const [forgot, setForgot] = useState(false);

  const load = useCallback(async (addr: string) => {
    const res = await fetch(`/api/relationship/${addr}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "failed");
    setRel(data.relationship as UserRelationship);
  }, []);

  useEffect(() => {
    if (!injected.address) {
      setRel(null);
      setLoaded(false);
      return;
    }
    setLoaded(false);
    load(injected.address)
      .then(() => setLoaded(true))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "failed");
        setLoaded(true);
      });
  }, [injected.address, load]);

  async function repay(id: string, remaining = false) {
    if (!injected.address) {
      await injected.connect();
      return;
    }
    const plan = (rel?.purchases || []).find((p) => p.purchase_id === id);
    const pending = (plan?.schedule || []).filter((i) => i.status === "pending");
    const next = pending[0];
    if (!next) {
      setError("No pending installment to repay.");
      return;
    }
    const amountUsd = remaining ? pending.reduce((s, i) => s + i.amount, 0) : next.amount;
    setBusy(true);
    setRepayingId(id);
    setRepayingRest(remaining);
    setError(null);
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
      const res = await fetch("/api/repay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: injected.address,
          purchase_id: id,
          tx_hash: sent.hash,
          pay_remaining: remaining,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "repay failed");
      await load(injected.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "repay failed");
    } finally {
      setBusy(false);
      setRepayingId(null);
      setRepayingRest(false);
    }
  }

  async function forgetWallet() {
    if (!injected.address) return;
    const ok = window.confirm(
      "Delete Sibyl memory for this wallet only? On-chain history stays. TRACE will treat you as a first-time user.",
    );
    if (!ok) return;
    setForgetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/relationship/${injected.address}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "delete failed");
      setForgot(true);
      await load(injected.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    } finally {
      setForgetting(false);
    }
  }

  const rows = rel?.purchases ?? [];

  if (!injected.connected) {
    return (
      <section className="glass-panel rounded-2xl px-6 py-16 text-center">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">My history</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-500">
          Purchase history is private to the wallet that made it. Connect to see yours. Nobody else
          can open this list.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">My history</h2>
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] text-neutral-500">{shortAddress(injected.address!)}</p>
          <button
            type="button"
            disabled={forgetting || !rel || rel.total_purchases === 0}
            onClick={forgetWallet}
            className="rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-medium text-neutral-600 hover:bg-black/5 disabled:opacity-40"
          >
            {forgetting ? "Deleting…" : "Delete Sibyl memory"}
          </button>
        </div>
      </div>
      {forgot ? (
        <p className="px-6 pb-3 text-[13px] text-neutral-600">
          Same wallet. Same onchain history. Different memory.
        </p>
      ) : null}
      {error ? <p className="px-6 pb-3 text-sm text-red-600">{error}</p> : null}
      {rel && rel.total_purchases > 0 ? (
        <div className="border-t border-black/5 px-6 py-5">
          <ScoreBreakdown breakdown={standingBreakdown(rel)} />
          <p className="mb-4 mt-6 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">Financial history on file</p>
          <MemoryTimeline events={memoryTimeline(rel)} />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-y border-black/5 text-[11px] font-medium text-neutral-500">
              <th className="px-6 py-2 font-medium">Date</th>
              <th className="px-6 py-2 font-medium">Merchant</th>
              <th className="px-6 py-2 font-medium">Amount</th>
              <th className="px-6 py-2 font-medium">Status</th>
              <th className="px-6 py-2 font-medium">Payout</th>
              <th className="px-6 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {!loaded ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-neutral-500">
                  Loading this wallet’s notes…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-neutral-500">
                  No purchases for this wallet yet. Request one on Buy. After TRACE says yes, upcoming
                  payments show up here and on Buy.
                </td>
              </tr>
            ) : (
              rows
                .slice()
                .reverse()
                .map((p) => (
                  <tr key={p.purchase_id} className="border-b border-black/5">
                    <td className="px-6 py-3 text-[13px] font-medium tabular-nums text-neutral-600">
                      {p.approved_date.slice(0, 10)}
                    </td>
                    <td className="px-6 py-3">{p.merchant}</td>
                    <td className="px-6 py-3">{formatAmount(p.amount)}</td>
                    <td className="px-6 py-3 font-medium">{p.outcome.replaceAll("_", " ")}</td>
                    <td className="px-6 py-3 text-neutral-500">
                      {p.payout_tx_hash ? (
                        <span className="block">
                          <span className="text-neutral-700">Financed · </span>
                          <TxLink hash={p.payout_tx_hash} className="text-[11px]" />
                        </span>
                      ) : p.payout_mode === "on_chain" ? (
                        "Financed"
                      ) : (
                        "Simulated, not sent"
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {p.outcome === "active" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-full bg-[#7828E8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6a1fd4] disabled:opacity-50"
                            onClick={() => repay(p.purchase_id, false)}
                          >
                            {repayingId === p.purchase_id && !repayingRest ? "Confirm in wallet…" : "Pay next"}
                          </button>
                          {p.schedule.filter((i) => i.status === "pending").length > 1 ? (
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded-full border border-[#7828E8]/40 px-3 py-1.5 text-xs font-semibold text-[#7828E8] hover:bg-[#7828E8]/5 disabled:opacity-50"
                              onClick={() => repay(p.purchase_id, true)}
                            >
                              {repayingId === p.purchase_id && repayingRest ? "Confirm in wallet…" : "Pay remaining"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
