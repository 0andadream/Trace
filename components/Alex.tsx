"use client";

import { useEffect, useState } from "react";
import { FRESH_WALLET, SWAP_ROUTER, TREASURY_VAULT, VENDOR_DESK } from "@/lib/counterparties";
import { formatAmount, formatPct, shortAddress } from "@/lib/format";
import type { DecideResult, Decision, PreviewResult, TxAction } from "@/types";

const TONE: Record<Decision, string> = {
  Proceed: "text-proceed",
  "Proceed with flag": "text-flag",
  "Hold for approval": "text-hold",
};

export function Alex() {
  const [action, setAction] = useState<TxAction>("transfer");
  const [token, setToken] = useState("USDT");
  const [amount, setAmount] = useState(500);
  const [recipient, setRecipient] = useState(TREASURY_VAULT);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<DecideResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      action,
      token,
      amount: String(amount),
      recipient,
    });
    const t = window.setTimeout(() => {
      fetch(`/api/preview?${params}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error);
          setPreview(d as PreviewResult);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "preview failed"));
    }, 200);
    return () => window.clearTimeout(t);
  }, [action, token, amount, recipient]);

  async function submit() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, token, amount, recipient }),
      });
      const data = (await res.json()) as DecideResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "decide failed");
      setResult(data);
      setPreview({
        request: data.request,
        memory: data.memory,
        assessment: data.assessment,
        emptyCounterparty: data.emptyCounterparty,
        sibyl: data.sibyl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "decide failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(resolution: "approved" | "rejected") {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/log/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: result.id, resolution }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "resolve failed");
      setNote(
        resolution === "approved"
          ? "Override written to Sibyl. This counterparty now has a successful interaction."
          : "Hold confirmed. Recorded as rejected.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "resolve failed");
    } finally {
      setBusy(false);
    }
  }

  const blocks = result?.memory ?? preview?.memory;
  const empty = result?.emptyCounterparty ?? preview?.emptyCounterparty ?? true;
  const decision = result?.verdict.decision;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section>
        <p className="text-sm text-paper-500">Alex</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">Treasury request</h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-300">
          Submit an intent. Alex reads three memory blocks from Sibyl, then answers in this format
          only: Decision, Reasoning, Risk.
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-paper-500">
              Action
              <select className="field" value={action} onChange={(e) => setAction(e.target.value as TxAction)}>
                <option value="transfer">transfer</option>
                <option value="approve">approve</option>
                <option value="swap">swap</option>
                <option value="contract">contract</option>
              </select>
            </label>
            <label className="text-xs text-paper-500">
              Token
              <input className="field" value={token} onChange={(e) => setToken(e.target.value)} />
            </label>
            <label className="text-xs text-paper-500">
              Amount
              <input
                type="number"
                className="field"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>
            <label className="text-xs text-paper-500">
              Known recipients
              <select
                className="field"
                value={[TREASURY_VAULT, VENDOR_DESK, SWAP_ROUTER, FRESH_WALLET].includes(recipient) ? recipient : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") setRecipient(e.target.value);
                }}
              >
                <option value={TREASURY_VAULT}>Treasury Vault</option>
                <option value={VENDOR_DESK}>Vendor Desk</option>
                <option value={SWAP_ROUTER}>Swap Router</option>
                <option value={FRESH_WALLET}>Unseen address</option>
                <option value="custom">Paste address</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-paper-500">
            Recipient
            <input
              className="field font-mono text-xs"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </label>
          <button className="btn-trace h-11 px-5" disabled={busy} type="submit">
            {busy ? "Deciding…" : "Ask Alex"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-hold">{error}</p> : null}

        <div className="mt-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-paper-500">Memory blocks Alex will receive</p>
          <article className="panel p-4">
            <div className="text-xs text-trace">AGENT_REPUTATION</div>
            {blocks?.AGENT_REPUTATION ? (
              <p className="mt-2 text-sm text-paper-300">
                {blocks.AGENT_REPUTATION.totalActions} actions · {blocks.AGENT_REPUTATION.successfulActions}{" "}
                successful · {blocks.AGENT_REPUTATION.rejectedActions} rejected ·{" "}
                {blocks.AGENT_REPUTATION.userOverrides} overrides · hold-override{" "}
                {formatPct(blocks.AGENT_REPUTATION.holdOverrideRate)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-paper-500">Loading Sibyl…</p>
            )}
          </article>
          <article className="panel p-4">
            <div className="text-xs text-trace">COUNTERPARTY_PROFILE</div>
            {empty || !blocks?.COUNTERPARTY_PROFILE ? (
              <p className="mt-2 text-sm text-hold">No prior interactions with this counterparty.</p>
            ) : (
              <p className="mt-2 text-sm text-paper-300">
                {blocks.COUNTERPARTY_PROFILE.label} · {shortAddress(blocks.COUNTERPARTY_PROFILE.address)} ·{" "}
                {blocks.COUNTERPARTY_PROFILE.interactionCount} interactions ·{" "}
                {blocks.COUNTERPARTY_PROFILE.successful} successful · avg{" "}
                {formatAmount(blocks.COUNTERPARTY_PROFILE.avgAmount, token)}
              </p>
            )}
          </article>
          <article className="panel p-4">
            <div className="text-xs text-trace">RISK_SCORE</div>
            <p className="mt-2 font-mono text-2xl">
              {(result?.verdict.risk ?? blocks?.RISK_SCORE ?? 0).toFixed(2)}
            </p>
          </article>
        </div>
      </section>

      <section className="panel flex min-h-[28rem] flex-col p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-paper-500">Output</p>
        {result ? (
          <>
            <pre className="mt-4 flex-1 whitespace-pre-wrap font-mono text-sm leading-relaxed text-paper">
              {`Decision: ${result.verdict.decision}

Reasoning:
${result.verdict.reasoning.map((line) => `- ${line}`).join("\n")}

Risk: ${result.verdict.risk.toFixed(2)}`}
            </pre>
            <p className={`mt-2 text-sm ${decision ? TONE[decision] : ""}`}>
              {result.request.action} {formatAmount(result.request.amount, result.request.token)} →{" "}
              {result.counterpartyLabel}
            </p>
            {result.verdict.decision === "Hold for approval" ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="btn-trace h-10 px-4" disabled={busy} onClick={() => resolve("approved")}>
                  Approve
                </button>
                <button className="btn-hold h-10 px-4" disabled={busy} onClick={() => resolve("rejected")}>
                  Reject
                </button>
              </div>
            ) : null}
            {note ? <p className="mt-3 text-sm text-trace">{note}</p> : null}
          </>
        ) : (
          <p className="mt-8 text-sm text-paper-500">
            Waiting for a request. Alex does not chat. Submit an intent to get a decision.
          </p>
        )}
      </section>
    </main>
  );
}
