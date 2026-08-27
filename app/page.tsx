import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HeroPhone } from "@/components/HeroPhone";
import { HowItWorks } from "@/components/HowItWorks";
import { getAgentStatus } from "@/lib/bnpl/status";
import { formatAmount } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatUsd(n: number) {
  return formatAmount(n);
}

export default async function HomePage() {
  let status: Awaited<ReturnType<typeof getAgentStatus>> | null = null;
  let statusError: string | null = null;
  try {
    status = await getAgentStatus();
  } catch (err) {
    statusError = err instanceof Error ? err.message : "Could not load Alex’s cash right now.";
  }

  return (
    <AppShell>
      <div className="flex justify-center pt-1 pb-6 lg:pt-2 lg:pb-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#17171c] px-4 py-2 text-[13px] font-medium text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7828E8]" aria-hidden />
          Built on Sibyl
        </span>
      </div>
      <section className="grid min-w-0 items-center gap-14 py-2 lg:min-h-[72vh] lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-6">
        <div className="min-w-0 max-w-xl">
          <p className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500 sm:tracking-[0.16em]">
            <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden>
              <circle cx="3.2" cy="5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="6.8" cy="5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Base Sepolia · Reputation weighted
          </p>
          <h1 className="mt-4 text-[1.85rem] font-semibold uppercase leading-[1.08] tracking-tight text-[#0A0219] [overflow-wrap:anywhere] sm:text-5xl lg:text-[5.25rem]">
            Pay on time, and the next deal gets easier.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-neutral-600 sm:text-[17px] sm:leading-8">
            Alex sends you ETH today (shown as USDC). You pay Alex back in a few parts. Pay on time
            and the next offer gets bigger. Miss a payment and it gets harder.
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-neutral-500">
            New here? Alex hasn&apos;t built up a relationship with you yet, so it starts cautious. A
            small first purchase, based only on your wallet&apos;s onchain activity.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/buy"
              className="inline-flex h-12 items-center rounded-full bg-[#7828E8] px-7 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(120,40,232,0.28)] hover:bg-[#6a1fd4]"
            >
              Launch App
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center rounded-full border border-black/10 px-6 text-sm font-medium text-neutral-900 hover:bg-black/5"
            >
              How it works
            </a>
          </div>
        </div>

        <HeroPhone
          live={{
            spendable: status?.spendable_usd ?? null,
            owed: status?.outstanding_exposure ?? null,
            purchases: status?.total_purchases ?? null,
            people: status?.wallets_with_history ?? null,
            deployable: status?.deployable ?? null,
            reserve: status?.reserve ?? null,
            address: status?.address ?? null,
            execute: Boolean(status?.execute),
            simulated: Boolean(status?.simulated_balance),
            error: statusError,
          }}
        />
      </section>

      <HowItWorks />

      <article className="mx-auto mt-24 max-w-3xl">
        <section id="agent-status" className="scroll-mt-28">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Alex’s cash, right now</h2>
          <p className="mt-3 text-[16px] leading-7 text-neutral-600">
            These numbers are from this testnet, not a made-up dashboard.
          </p>
          {status ? (
            <dl className="glass-panel mt-8 divide-y divide-[#E8E7EC] px-6">
              {(
                [
                  ["Alex’s account", status.address || "—"],
                  ["Where this runs", "Base Sepolia testnet"],
                  ["Cash on hand", formatUsd(status.spendable_usd)],
                  ["Still owed to Alex", formatUsd(status.outstanding_exposure)],
                  ["What Alex can still spend", formatUsd(status.deployable)],
                  ["ETH to your wallet", status.execute ? "Live on Base Sepolia" : "Simulated on this testnet"],
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
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">If we delete Alex’s notes</h2>
          <p className="mt-4 text-[16px] leading-7 text-neutral-600">
            Say you paid on time ten times. If we then delete Alex’s notes, the next time you ask you
            look brand new: smaller limit, fewer payments. Nothing else about you changed. Alex just
            forgot. That is the point of this testnet, the deal lives in Alex’s memory of you, not in a
            bureau file.
          </p>
        </section>
      </article>
    </AppShell>
  );
}
