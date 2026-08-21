import { Header } from "@/components/Header";
import { LogActions } from "@/components/LogActions";
import { TraceArc } from "@/components/TraceArc";
import { formatAmount, shortAddress } from "@/lib/format";
import { memorySnapshot } from "@/lib/desk/run";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  Proceed: "text-proceed",
  "Proceed with flag": "text-flag",
  "Hold for approval": "text-hold",
};

export default async function LogPage() {
  const snap = await memorySnapshot();
  const pending = snap.actions.filter((a) => a.outcome === "pending");

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10">
        <p className="mono-label text-trace">Decision log</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Every recorded action</h1>
        <TraceArc className="mt-3 w-24" />
        <p className="mt-3 max-w-2xl text-sm text-paper-300">
          Seeded history plus live desk decisions. Approving a Hold writes a user override into
          reputation.
        </p>

        {pending.length > 0 ? (
          <section className="panel mt-8 p-5">
            <div className="mono-label text-hold">Pending holds</div>
            <ul className="mt-3 space-y-3">
              {pending.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm">
                      {row.action} {formatAmount(row.amount, row.token)} → {row.counterpartyLabel}
                    </div>
                    <div className="font-mono text-[10px] text-paper-500">
                      {shortAddress(row.recipient)} · risk {row.riskScore.toFixed(2)}
                    </div>
                  </div>
                  <LogActions id={row.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-8 overflow-x-auto panel">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Counterparty</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {snap.actions.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3 font-mono text-xs text-paper-500">{row.at.slice(0, 16).replace("T", " ")}</td>
                  <td className={`px-4 py-3 ${TONE[row.decision] ?? ""}`}>
                    {row.decision}
                    {row.userOverride ? <span className="ml-2 text-[10px] uppercase text-flag">override</span> : null}
                    {row.seed ? <span className="ml-2 text-[10px] uppercase text-paper-500">seed</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    {row.action} {formatAmount(row.amount, row.token)}
                  </td>
                  <td className="px-4 py-3">
                    {row.counterpartyLabel}
                    <div className="font-mono text-[10px] text-paper-500">{shortAddress(row.recipient)}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.riskScore.toFixed(2)}</td>
                  <td className="px-4 py-3">{row.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
