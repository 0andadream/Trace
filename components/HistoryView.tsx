"use client";

import { useCallback, useEffect, useState } from "react";
import { getInjectedEthereum, useInjectedWallet } from "@/components/ConnectWallet";
import { sendUserRepay } from "@/lib/bnpl/sendUserRepay";
import { MemoryTimeline } from "@/components/MemoryTimeline";
import { memoryTimeline } from "@/lib/bnpl/relationship";
import { formatAmount, shortAddress } from "@/lib/format";
import { TxLink } from "@/components/TxLink";
import type { UserRelationship } from "@/types/bnpl";

export function HistoryView() {
  const injected = useInjectedWallet();
  const [rel, setRel] = useState<UserRelationship | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
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
    }
  }

  const rows = rel?.purchases ?? [];

  if (!injected.connected) {
    return (
      <section className="glass-panel rounded-2xl px-6 py-16 text-center">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">My history</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-500">
          Purchase history is private to the wallet that made it. Connect to see yours. Nobody else
          can open this list. Repay sends ETH (shown as USDC).
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">My history</h2>
        <p className="font-mono text-[11px] text-neutral-500">{shortAddress(injected.address!)}</p>
      </div>
      {error ? <p className="px-6 pb-3 text-sm text-red-600">{error}</p> : null}
      {rel && rel.total_purchases > 0 ? (
        <div className="border-t border-black/5 px-6 py-5">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">With this agent</p>
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
                  No purchases for this wallet yet. Request one on Buy. After Alex says yes, Repay
                  shows up here and on Buy.
                </td>
              </tr>
            ) : (
              rows
                .slice()
                .reverse()
                .map((p) => (
                  <tr key={p.purchase_id} className="border-b border-black/5">
                    <td className="px-6 py-3 font-mono text-[12px] text-neutral-600">
                      {p.approved_date.slice(0, 10)}
                    </td>
                    <td className="px-6 py-3">{p.merchant}</td>
                    <td className="px-6 py-3">{formatAmount(p.amount)}</td>
                    <td className="px-6 py-3 font-medium">{p.outcome.replaceAll("_", " ")}</td>
                    <td className="px-6 py-3 text-neutral-500">
                      {p.payout_tx_hash ? (
                        <TxLink hash={p.payout_tx_hash} className="text-[11px]" />
                      ) : p.payout_mode === "on_chain" ? (
                        "on-chain"
                      ) : (
                        "simulated"
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
                            {busy ? "Confirm in wallet…" : "Pay next"}
                          </button>
                          {p.schedule.filter((i) => i.status === "pending").length > 1 ? (
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded-full border border-[#7828E8]/40 px-3 py-1.5 text-xs font-semibold text-[#7828E8] hover:bg-[#7828E8]/5 disabled:opacity-50"
                              onClick={() => repay(p.purchase_id, true)}
                            >
                              Pay remaining
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
