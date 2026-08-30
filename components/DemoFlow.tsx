"use client";

import { useState } from "react";
import { useInjectedWallet } from "@/components/ConnectWallet";

const SCENES = [
  {
    n: "1",
    title: "First-time user",
    body: "Connect the wallet. If Sibyl has no book, Alex starts from a cautious on-chain baseline. TRACE — not Virtuals — sets the number.",
  },
  {
    n: "2",
    title: "Borrow",
    body: "Request a purchase TRACE can approve (Notebook Set $12 on a thin book). Confirm. Watch the Agent Log: MEMORY_READ → CREDIT_DECISION.",
  },
  {
    n: "3",
    title: "Repay",
    body: "Pay the installment from your wallet. Sibyl writes repaymentStatus only after the ETH transfer is verified.",
  },
  {
    n: "4",
    title: "Fresh session",
    body: "New browser or private window. Reconnect the same wallet. The limit jump is Sibyl, not the public chain.",
  },
  {
    n: "5",
    title: "Virtuals ACP",
    body: "On the next approved purchase Alex creates a real ACP job (BNPL Settlement) on the Virtuals contract. The log shows ACP_JOB_CREATED and, if the lifecycle finishes, ACP_JOB_EXECUTED with a job id.",
  },
  {
    n: "6",
    title: "Base settlement",
    body: "The ETH payout is a Base Sepolia transaction from the agent. SETTLEMENT in the Agent Log is that hash.",
  },
  {
    n: "7",
    title: "Deletion test",
    body: "On History, Delete Sibyl memory for this wallet. Same wallet, same on-chain history, first-time terms again.",
  },
] as const;

export function DemoFlow({ started }: { started: string }) {
  const wallet = useInjectedWallet();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitPmf(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/pmf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          audience: "people who want BNPL that remembers repayment",
          pain: "financial agents forget users between sessions",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setNote("Recorded. No usage claims attached.");
      setEmail("");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <p className="text-[13px] text-neutral-500">
        Connected: {wallet.connected ? wallet.address : "none"} · timestamp {started.slice(0, 19).replace("T", " ")} UTC
      </p>
      <ol className="space-y-4">
        {SCENES.map((s) => (
          <li key={s.n} className="glass-panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Scene {s.n}</p>
            <h2 className="mt-1 text-[17px] font-semibold text-neutral-900">{s.title}</h2>
            <p className="mt-2 text-[14px] leading-6 text-neutral-600">{s.body}</p>
          </li>
        ))}
      </ol>
      <section className="glass-panel p-5">
        <h2 className="text-[15px] font-semibold text-neutral-900">Early access</h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          Named audience: people who need BNPL that does not reset when the tab closes. This form
          stores a waitlist row. It does not invent usage numbers.
        </p>
        <form onSubmit={submitPmf} className="mt-4 flex flex-wrap gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-10 min-w-[14rem] flex-1 rounded-full border border-black/10 px-4 text-[14px] outline-none focus:border-[#7828E8]"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-full bg-[#0A0219] px-5 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Join waitlist"}
          </button>
        </form>
        {note ? <p className="mt-2 text-[13px] text-neutral-600">{note}</p> : null}
      </section>
    </div>
  );
}
