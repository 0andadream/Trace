import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HowItWorks } from "@/components/HowItWorks";
import { getAgentStatus, grokConfigured, payoutIsLive } from "@/lib/bnpl/status";
import { formatAmount, shortAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatUsd(n: number) {
  return formatAmount(n);
}

function StatusPill({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/70">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" aria-hidden />
      Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-semibold text-neutral-500 ring-1 ring-black/[0.06]">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" aria-hidden />
      Not live
    </span>
  );
}

export default async function HomePage() {
  let status: Awaited<ReturnType<typeof getAgentStatus>> | null = null;
  let statusError: string | null = null;
  try {
    status = await getAgentStatus();
  } catch (err) {
    statusError = err instanceof Error ? err.message : "Could not load Alex’s cash right now.";
  }

  const payoutLive = payoutIsLive();
  const grok = grokConfigured();

  const table: { capability: string; status: "Live" | "Not live"; detail: string }[] = [
    {
      capability: "Alex sends you ETH",
      status: payoutLive ? "Live" : "Not live",
      detail: payoutLive
        ? "When Alex says yes, it sends ETH to the wallet you connected. The amount is shown in USDC."
        : "Alex still says yes or no. ETH is not actually sent on this testnet.",
    },
    {
      capability: "Alex remembers you",
      status: status?.sibyl_load_bearing ? "Live" : "Not live",
      detail: status?.sibyl_load_bearing
        ? "Alex keeps notes on what you bought here and whether you paid it back. Delete those notes and you look new again."
        : "Alex cannot look you up right now. Notes are down.",
    },
    {
      capability: "Alex’s own cash",
      status: "Live",
      detail: `Alex will not spend its last ${status ? formatUsd(status.reserve) : "few dollars"}. If it cannot afford to send you the ETH, it says no, even if you always pay on time.`,
    },
    {
      capability: "First-time buyers",
      status: "Live",
      detail: "If you have never bought here, you start small. Alex is extra careful with people it does not know.",
    },
    {
      capability: "You paying Alex back",
      status: "Live",
      detail: "You sign an ETH transfer to Alex on Base Sepolia. The amount is shown in USDC. Late and missed payments still go in your notes.",
    },
    {
      capability: "Spending limits",
      status: "Live",
      detail: "There is a max you can buy at once ($3k at a 50 score, $10k at 95), and a max number of open plans. Those limits cannot be skipped.",
    },
    {
      capability: "Stopping spam",
      status: "Not live",
      detail: "Anyone can ask as often as they like on this testnet.",
    },
    {
      capability: "Why Alex said yes or no",
      status: grok ? "Live" : "Not live",
      detail: grok
        ? "Alex writes a short reason in plain words. Talking will not change the yes, the no, or the dollar amount."
        : "You still get a yes or no. The reason is a short stock sentence, not a chat.",
    },
    {
      capability: "Real money",
      status: "Not live",
      detail: "This is pretend money. You cannot lose real dollars here.",
    },
  ];

  return (
    <AppShell>
      <div className="mb-6 flex justify-center">
        <span className="inline-flex items-center rounded-full bg-[#17171c] px-5 py-2.5 text-sm font-medium text-white shadow-sm">
          Built on Sibyl
        </span>
      </div>
      <section className="overflow-hidden rounded-t-[min(50%,11rem)] bg-[#0A0219] lg:grid lg:grid-cols-2 lg:items-center">
        <div className="flex items-center justify-center px-8 pt-10 lg:px-12 lg:py-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="Trace"
            className="h-auto w-full max-h-[min(52vh,28rem)] object-contain"
          />
        </div>
        <div className="px-8 pb-12 pt-2 lg:px-12 lg:py-14">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#C4B5A0]">
            Base Sepolia · Reputation weighted
          </p>
          <h1 className="mt-4 text-[1.65rem] font-medium leading-snug tracking-tight text-[#F4EFE4] sm:text-[1.9rem]">
            Pay on time, and the next deal gets easier.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#9B96AB]">
            Alex sends you ETH today (shown as USDC). You pay Alex back in a few parts. Pay on time
            and the next offer gets bigger. Miss a payment and it gets harder.
          </p>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-[#7A7588]">
            New here? Alex has no history with you yet, so it starts cautious. A small first
            purchase, based only on your wallet&apos;s onchain activity.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/buy"
              className="inline-flex h-11 items-center rounded-full bg-[#7828E8] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#6a1fd4]"
            >
              Try a purchase
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-11 items-center rounded-full border border-white/15 px-6 text-sm font-medium text-[#F4EFE4] hover:bg-white/5"
            >
              How it works
            </a>
            <a
              href="#agent-status"
              className="inline-flex h-11 items-center rounded-full border border-white/15 px-6 text-sm font-medium text-[#F4EFE4] hover:bg-white/5"
            >
              See Alex’s cash
            </a>
          </div>
          {status ? (
            <p className="mt-8 text-sm text-[#C4B5A0]">
              Alex can still spend {formatUsd(status.deployable)}
              {status.address ? ` · ${shortAddress(status.address)}` : ""}
            </p>
          ) : statusError ? (
            <p className="mt-8 text-sm text-red-400">{statusError}</p>
          ) : null}
        </div>
      </section>

      <article className="mx-auto mt-16 max-w-3xl">
        <section className="glass-panel rounded-2xl p-8" aria-label="What Alex can still spend">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            What Alex can still spend
          </p>
          {status ? (
            <>
              <p className="mt-3 text-5xl font-semibold tabular-nums tracking-tight text-neutral-900 sm:text-6xl">
                {formatUsd(status.deployable)}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                After keeping a little cash ({formatUsd(status.reserve)}) so it is not emptied.
                {status.simulated_balance
                  ? " We could not check Alex’s account just now, so this cash number is a stand-in."
                  : ""}
                {status.execute ? "" : " Paying the shop is simulated on this testnet, the yes or no is still real."}{" "}
                {status.address ? (
                  <>
                    Alex’s account{" "}
                    <span className="font-mono text-neutral-900">{shortAddress(status.address)}</span>.
                  </>
                ) : (
                  "Alex’s account is not shown here."
                )}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-red-600">
              {/sibyl|redis|memory/i.test(statusError || "") ? "Sibyl unavailable. " : ""}
              {statusError}
            </p>
          )}
        </section>
      </article>

      <HowItWorks />

      <article className="mx-auto mt-16 max-w-3xl">
        <section id="status" className="scroll-mt-28">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">What is live, and what is not</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
            Live means it really happens. Not live means it is simulated or not built here yet.
          </p>
          <div className="glass-panel mt-6 overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="bg-black/[0.04] text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  <th className="px-5 py-3 font-medium">What</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">What that means</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.capability} className="border-t border-black/[0.08] align-middle">
                    <td className="px-5 py-4 font-medium text-neutral-900">{row.capability}</td>
                    <td className="px-5 py-4">
                      <StatusPill live={row.status === "Live"} />
                    </td>
                    <td className="px-5 py-4 leading-relaxed text-neutral-600">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="agent-status" className="mt-16 scroll-mt-28">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Alex’s cash, right now</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
            These numbers are from this testnet, not a made-up dashboard.
          </p>
          {status ? (
            <dl className="glass-panel mt-6 divide-y divide-black/5 rounded-2xl px-5">
              {(
                [
                  ["Alex’s account", status.address || "—"],
                  ["Where this runs", "Base Sepolia testnet"],
                  ["Cash on hand", formatUsd(status.spendable_usd)],
                  ["Still owed to Alex", formatUsd(status.outstanding_exposure)],
                  ["What Alex can still spend", formatUsd(status.deployable)],
                  ["Purchases on file", String(status.total_purchases)],
                  ["People Alex has seen before", String(status.wallets_with_history)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="font-mono text-[13px] text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-6 text-sm text-red-600">{statusError}</p>
          )}
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">If we delete Alex’s notes</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-600">
            Say you paid on time ten times. If we then delete Alex’s notes, the next time you ask you
            look brand new: smaller limit, fewer payments. Nothing else about you changed. Alex just
            forgot. That is the point of this testnet, the deal lives in Alex’s memory of you, not in a
            credit file.
          </p>
        </section>
      </article>
    </AppShell>
  );
}
