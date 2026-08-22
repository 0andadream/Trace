import { Header } from "@/components/Header";
import { formatAmount, shortAddress } from "@/lib/format";
import { lendingSnapshot } from "@/lib/lending/run";
import { isRelationshipEmpty } from "@/lib/lending/relationship";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const snap = await lendingSnapshot();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10">
        <p className="text-sm text-paper-500">Sibyl Memory</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">What Alex is allowed to know</h1>
        <p className="mt-3 max-w-2xl text-sm text-paper-300">
          USER_RELATIONSHIP is loans this agent originated with a wallet — outcomes, quotes, human
          overrides. That cannot be read off the chain. ONCHAIN_SIGNAL is never stored here.
        </p>

        {snap.sibyl ? (
          <section className="panel mt-8 p-5">
            <div className="mono-label text-trace">Sibyl Memory · load-bearing</div>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">engine</dt>
                <dd className="mt-1">{snap.sibyl.engine}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">tenant</dt>
                <dd className="mt-1 font-mono text-xs">{snap.sibyl.tenant}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">relationships</dt>
                <dd className="mt-1">{snap.sibyl.relationshipCount ?? snap.relationships.length}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">db</dt>
                <dd className="mt-1 break-all font-mono text-xs text-paper-500">{snap.sibyl.db}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        <section className="mt-8 space-y-4">
          <div className="mono-label">USER_RELATIONSHIP</div>
          {snap.relationships.length === 0 ? (
            <article className="panel p-5">
              <p className="text-sm text-hold">USER_RELATIONSHIP is empty for every wallet.</p>
            </article>
          ) : (
            snap.relationships.map((rel) => (
              <article key={rel.wallet_address} className="panel p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-mono text-sm">{shortAddress(rel.wallet_address)}</h2>
                  <p className="text-sm text-paper-300">
                    standing {rel.current_standing_score.toFixed(2)}
                    {isRelationshipEmpty(rel) ? " · empty book" : ""}
                  </p>
                </div>
                <p className="mt-2 text-sm text-paper-300">
                  {rel.total_loans} loans · {rel.on_time_count} on_time · {rel.late_count} late · {rel.default_count}{" "}
                  defaulted · borrowed {formatAmount(rel.total_borrowed)} · repaid {formatAmount(rel.total_repaid)} ·{" "}
                  {rel.override_count} overrides
                </p>
                <ul className="mt-3 space-y-1 font-mono text-[11px] text-paper-500">
                  {rel.loans.map((loan) => (
                    <li key={loan.loan_id}>
                      {loan.loan_id} · {loan.amount} {loan.asset} · {loan.outcome}
                      {loan.repaid_date ? ` · repaid ${loan.repaid_date.slice(0, 10)}` : ""}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
