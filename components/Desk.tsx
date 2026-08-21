"use client";

import { useEffect, useState } from "react";
import {
  FRESH_WALLET,
  SWAP_ROUTER,
  TREASURY_VAULT,
  VENDOR_DESK,
} from "@/lib/counterparties";
import { TraceArc } from "@/components/TraceArc";
import { formatAmount, formatPct, shortAddress } from "@/lib/format";
import type { DecideResult, Decision, TxAction } from "@/types";

const STEPS = ["Load reputation", "Load counterparty", "Score deviation", "Apply policy", "Write reasoning"];

type Scenario = "typical" | "oversized" | "unknown" | "custom";

const DECISION_STYLE: Record<Decision, { color: string; border: string; bg: string; mark: string }> = {
  Proceed: { color: "text-proceed", border: "border-proceed/40", bg: "bg-proceed/10", mark: "✓" },
  "Proceed with flag": { color: "text-flag", border: "border-flag/40", bg: "bg-flag/10", mark: "!" },
  "Hold for approval": { color: "text-hold", border: "border-hold/40", bg: "bg-hold/10", mark: "✕" },
};

export function Desk() {
  const [action, setAction] = useState<TxAction>("transfer");
  const [token, setToken] = useState("USDT");
  const [amount, setAmount] = useState(500);
  const [recipient, setRecipient] = useState(TREASURY_VAULT);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"idle" | "reading" | "done">("idle");
  const [active, setActive] = useState<Scenario | null>(null);
  const [result, setResult] = useState<DecideResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolveMsg, setResolveMsg] = useState<string | null>(null);

  async function run(kind: Scenario) {
    if (kind === "typical") {
      setAction("transfer");
      setToken("USDT");
      setAmount(500);
      setRecipient(TREASURY_VAULT);
    }
    if (kind === "oversized") {
      setAction("transfer");
      setToken("USDT");
      setAmount(2400);
      setRecipient(TREASURY_VAULT);
    }
    if (kind === "unknown") {
      setAction("transfer");
      setToken("USDT");
      setAmount(400);
      setRecipient(FRESH_WALLET);
    }

    setActive(kind);
    setError(null);
    setResolveMsg(null);
    setBusy(true);
    setPhase("reading");
    setStep(0);
    setResult(null);

    const timers = STEPS.map((_, i) => window.setTimeout(() => setStep(i + 1), 180 + i * 140));

    const body =
      kind === "custom"
        ? { action, token, amount, recipient, scenario: "custom" as const }
        : { scenario: kind };

    try {
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as DecideResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "decide failed");
      await new Promise((r) => setTimeout(r, 900));
      setResult(data);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "decide failed");
      setPhase("idle");
    } finally {
      timers.forEach(clearTimeout);
      setStep(STEPS.length);
      setBusy(false);
    }
  }

  async function resolve(resolution: "approved" | "rejected") {
    if (!result) return;
    setBusy(true);
    setResolveMsg(null);
    try {
      const res = await fetch("/api/log/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: result.id, resolution }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "resolve failed");
      setResolveMsg(
        resolution === "approved"
          ? "Override recorded. This counterparty now has a successful interaction in memory."
          : "Hold confirmed. Recorded as rejected. No override.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "resolve failed");
    } finally {
      setBusy(false);
    }
  }

  const style = result ? DECISION_STYLE[result.verdict.decision] : null;
  const rep = result?.memory.AGENT_REPUTATION;
  const profile = result?.memory.COUNTERPARTY_PROFILE;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10">
      <p className="mono-label text-trace">Treasury desk</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">Ask Alex</h1>
      <TraceArc className="mt-3 w-24" />
      <p className="mt-3 max-w-2xl text-sm text-paper-300">
        Three seeded paths, or a custom intent. Code computes risk. Alex writes the reasoning from
        memory — nothing else.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn-trace h-11 px-5" disabled={busy} onClick={() => run("typical")}>
          A · Typical vault
        </button>
        <button className="btn-ghost h-11 px-5" disabled={busy} onClick={() => run("oversized")}>
          B · Oversized vault
        </button>
        <button className="btn-hold h-11 px-5" disabled={busy} onClick={() => run("unknown")}>
          C · Unknown recipient
        </button>
      </div>
      <p className="mt-2 text-xs text-paper-500">
        A: $500 USDT → Treasury Vault · B: $2,400 to the same vault · C: $400 to a wallet with no
        profile. After C, approve the Hold and run C again — memory changes the decision.
      </p>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <form
          className="panel p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run("custom");
          }}
        >
          <div className="mono-label">Custom request</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-paper-500">
              Action
              <select
                className="field"
                value={action}
                onChange={(e) => setAction(e.target.value as TxAction)}
              >
                <option value="transfer">transfer</option>
                <option value="approve">approve</option>
                <option value="swap">swap</option>
                <option value="contract">contract</option>
              </select>
            </label>
            <label className="text-xs text-paper-500">
              Token
              <input
                className="field"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
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
              Recipient
              <select
                className="field"
                value={
                  [TREASURY_VAULT, VENDOR_DESK, SWAP_ROUTER, FRESH_WALLET].includes(recipient)
                    ? recipient
                    : "custom"
                }
                onChange={(e) => {
                  if (e.target.value !== "custom") setRecipient(e.target.value);
                }}
              >
                <option value={TREASURY_VAULT}>Treasury Vault</option>
                <option value={VENDOR_DESK}>Vendor Desk</option>
                <option value={SWAP_ROUTER}>Swap Router</option>
                <option value={FRESH_WALLET}>Unknown (fresh)</option>
                <option value="custom">Custom address</option>
              </select>
            </label>
          </div>
          <input
            className="field mt-3 font-mono text-xs"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          <button className="btn-ghost mt-4 h-10 px-4" disabled={busy} type="submit">
            Submit to Alex
          </button>
        </form>

        <div className="panel scanline p-5">
          <div className="mono-label">Pipeline</div>
          <ol className="mt-4 space-y-2">
            {STEPS.map((label, i) => {
              const on = phase === "reading" ? i < step : phase === "done";
              return (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span className={`font-mono text-[10px] ${on ? "text-trace" : "text-paper-500"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={on ? "text-paper" : "text-paper-500"}>{label}</span>
                </li>
              );
            })}
          </ol>
          {active ? (
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-500">
              scenario {active}
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-hold">{error}</p> : null}
        </div>
      </section>

      {result && style ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className={`border ${style.border} ${style.bg} p-5`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mono-label">Decision</div>
                <h2 className={`mt-2 text-2xl ${style.color}`}>
                  {style.mark} {result.verdict.decision}
                </h2>
              </div>
              <div className="text-right">
                <div className="mono-label">Risk</div>
                <div className={`mt-2 font-mono text-2xl ${style.color}`}>
                  {result.verdict.risk.toFixed(2)}
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-paper-300">
              {result.request.action} {formatAmount(result.request.amount, result.request.token)} →{" "}
              {result.counterpartyLabel}{" "}
              <span className="font-mono text-xs text-paper-500">
                {shortAddress(result.request.recipient)}
              </span>
            </p>
            <div className="mt-5">
              <div className="mono-label">Reasoning</div>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed">
                {result.verdict.reasoning.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-trace">–</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-500">
              source {result.verdict.source} · sibyl {result.sibyl?.engine} · {result.sibyl?.actionCount} actions
            </p>
            {result.base ? (
              <p className="mt-1 break-all font-mono text-[10px] text-paper-500">
                base {result.base.chainLabel} · {result.base.memoryHash}
                {result.base.written ? " · written" : result.base.reason ? ` · ${result.base.reason}` : ""}
              </p>
            ) : null}
            {result.verdict.decision === "Hold for approval" ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="btn-trace h-10 px-4" disabled={busy} onClick={() => resolve("approved")}>
                  Approve (override)
                </button>
                <button className="btn-hold h-10 px-4" disabled={busy} onClick={() => resolve("rejected")}>
                  Confirm reject
                </button>
              </div>
            ) : null}
            {resolveMsg ? <p className="mt-3 text-sm text-trace">{resolveMsg}</p> : null}
          </article>

          <div className="space-y-4">
            <article className="panel p-5">
              <div className="mono-label">AGENT_REPUTATION</div>
              {rep ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Stat k="actions" v={String(rep.totalActions)} />
                  <Stat k="successful" v={String(rep.successfulActions)} />
                  <Stat k="rejected" v={String(rep.rejectedActions)} />
                  <Stat k="overrides" v={String(rep.userOverrides)} />
                  <Stat k="hold override" v={formatPct(rep.holdOverrideRate)} />
                  <Stat k="unverified rejects" v={String(rep.rejectedUnverifiedCount)} />
                </dl>
              ) : null}
            </article>
            <article className="panel p-5">
              <div className="mono-label">COUNTERPARTY_PROFILE</div>
              {profile ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Stat k="label" v={profile.label} />
                  <Stat k="interactions" v={String(profile.interactionCount)} />
                  <Stat k="successful" v={String(profile.successful)} />
                  <Stat k="rejected" v={String(profile.rejected)} />
                  <Stat k="avg" v={formatAmount(profile.avgAmount)} />
                  <Stat k="max" v={formatAmount(profile.maxAmount)} />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-hold">No prior interactions with this counterparty.</p>
              )}
            </article>
            <article className="panel p-5">
              <div className="mono-label">RISK_SCORE factors</div>
              <ul className="mt-3 space-y-2 text-xs text-paper-300">
                {result.assessment.factors.length === 0 ? (
                  <li>No deviation factors. Request sits inside recorded history.</li>
                ) : (
                  result.assessment.factors.map((f) => (
                    <li key={f.id} className="flex justify-between gap-3">
                      <span>{f.reason}</span>
                      <span className="font-mono text-flag">+{f.delta.toFixed(2)}</span>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </div>
        </section>
      ) : (
        <LiveMemory />
      )}
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}

function LiveMemory() {
  const [rep, setRep] = useState<{
    totalActions?: number;
    successfulActions?: number;
    rejectedActions?: number;
    userOverrides?: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => setRep(d.AGENT_REPUTATION))
      .catch(() => setRep(null));
  }, []);

  if (!rep) return null;
  return (
    <section className="panel mt-6 p-5">
      <div className="mono-label">Current AGENT_REPUTATION</div>
      <p className="mt-3 text-sm text-paper-300">
        {rep.totalActions} actions · {rep.successfulActions} successful · {rep.rejectedActions}{" "}
        rejected · {rep.userOverrides} user overrides
      </p>
    </section>
  );
}
