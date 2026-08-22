import { Header } from "@/components/Header";
import { formatAmount, shortAddress } from "@/lib/format";
import { lendingSnapshot } from "@/lib/lending/run";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  on_time: "text-proceed",
  late: "text-flag",
  defaulted: "text-hold",
  active: "text-paper",
};

export default async function LogPage() {
  const snap = await lendingSnapshot();
  const loans = snap.relationships.flatMap((rel) =>
    rel.loans.map((loan) => ({ ...loan, wallet_address: rel.wallet_address })),
  );
  const quotes = snap.relationships.flatMap((rel) =>
    (rel.quotes || []).map((q) => ({ ...q, wallet_address: rel.wallet_address })),
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10">
        <p className="text-sm text-paper-500">Operating history</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">Loans this agent originated</h1>
        <p className="mt-3 max-w-2xl text-sm text-paper-300">
          Every line is a Sibyl relationship entity. Repayment outcomes live here, not on a public
          indexer. Reset memory and the improved rate disappears.
        </p>

        <section className="mt-8 space-y-3">
          {loans.length === 0 ? (
            <article className="panel p-5">
              <p className="text-sm text-paper-500">No loans in memory.</p>
            </article>
          ) : (
            loans.map((loan) => (
              <article key={loan.loan_id} className="panel p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm">
                    {formatAmount(loan.amount, loan.asset)} · {(loan.rate_quoted * 100).toFixed(1)}% ·{" "}
                    {shortAddress(loan.wallet_address)}
                  </p>
                  <p className={`text-sm ${TONE[loan.outcome] || ""}`}>{loan.outcome}</p>
                </div>
                <p className="mt-1 font-mono text-[10px] text-paper-500">
                  {loan.loan_id} · origin {loan.origin_date.slice(0, 10)} · due {loan.due_date.slice(0, 10)}
                  {loan.repaid_date ? ` · repaid ${loan.repaid_date.slice(0, 10)}` : ""}
                </p>
              </article>
            ))
          )}
        </section>

        {quotes.length > 0 ? (
          <section className="mt-10">
            <div className="mono-label">Prior quotes</div>
            <ul className="mt-3 space-y-2">
              {quotes
                .slice()
                .reverse()
                .slice(0, 12)
                .map((q) => (
                  <li key={q.quote_id} className="text-sm text-paper-300">
                    {q.at.slice(0, 10)} · {shortAddress(q.wallet_address)} · {q.decision} ·{" "}
                    {(q.apr * 100).toFixed(1)}% · {q.primary_signal}
                  </li>
                ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
