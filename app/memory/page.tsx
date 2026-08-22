import { Header } from "@/components/Header";
import { formatAmount, formatPct, shortAddress } from "@/lib/format";
import { memorySnapshot } from "@/lib/desk/run";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const snap = await memorySnapshot();
  const r = snap.reputation;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10">
        <p className="text-sm text-paper-500">Sibyl Memory</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">What Alex is allowed to know</h1>
        <p className="mt-3 max-w-2xl text-sm text-paper-300">
          These blocks are the only history Alex may cite. Empty counterparty profiles stay empty
          until Sibyl has a recorded interaction. Delete the database and learned overrides
          disappear.
        </p>

        {snap.sibyl ? (
          <section className="panel mt-8 p-5">
            <div className="mono-label text-trace">Sibyl Memory · load-bearing</div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">engine</dt>
                <dd className="mt-1">{snap.sibyl.engine}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">tenant</dt>
                <dd className="mt-1 font-mono text-xs">{snap.sibyl.tenant}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">actions / counterparties</dt>
                <dd className="mt-1">
                  {snap.sibyl.actionCount} / {snap.sibyl.counterpartyCount}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">db</dt>
                <dd className="mt-1 break-all font-mono text-xs text-paper-500">{snap.sibyl.db}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        <section className="panel mt-8 p-5">
          <div className="mono-label">AGENT_REPUTATION</div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["total", r.totalActions],
              ["successful", r.successfulActions],
              ["rejected", r.rejectedActions],
              ["overrides", r.userOverrides],
              ["holds", r.holdDecisions],
              ["incidents", r.incidentActions],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">{k}</dt>
                <dd className="mt-1 text-2xl">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-paper-300">
            Hold override rate {formatPct(r.holdOverrideRate)} · rejection rate {formatPct(r.rejectionRate)} ·
            incident rate {formatPct(r.incidentRate)}
            {r.thinHistory ? " · thin history" : ""}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {Object.entries(r.byActionType).map(([action, stats]) => (
              <article key={action} className="border border-white/[0.06] p-3">
                <div className="mono-label">{action}</div>
                <p className="mt-2 text-sm">
                  {stats.count} · avg {formatAmount(stats.avgAmount)}
                </p>
                <p className="text-xs text-paper-500">
                  {stats.successful} ok · {stats.rejected} rejected · {stats.overrides} overrides
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="mono-label">COUNTERPARTY_PROFILE</div>
          <div className="mt-4 overflow-x-auto panel">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">n</th>
                  <th className="px-4 py-3">Ok / rej</th>
                  <th className="px-4 py-3">Avg</th>
                  <th className="px-4 py-3">Last</th>
                </tr>
              </thead>
              <tbody>
                {snap.counterparties.map((c) => (
                  <tr key={c.address} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3">{c.label}</td>
                    <td className="px-4 py-3">{c.verification ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-paper-500">{shortAddress(c.address)}</td>
                    <td className="px-4 py-3">{c.interactionCount}</td>
                    <td className="px-4 py-3">
                      {c.successful} / {c.rejected}
                    </td>
                    <td className="px-4 py-3">{formatAmount(c.avgAmount)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-paper-500">
                      {c.lastAt ? c.lastAt.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
