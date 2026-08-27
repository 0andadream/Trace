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
    statusError = err instanceof Error ? err.message : "Could not load TRACE capacity right now.";
  }

  return (
    <AppShell>
      <div className="flex justify-center pt-1 pb-6 lg:pt-2 lg:pb-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#17171c] px-4 py-2 text-[12px] font-semibold tracking-[0.06em] text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7828E8]" aria-hidden />
          Powered by Sibyl Memory
        </span>
      </div>
      <section className="grid min-w-0 items-center gap-14 py-2 lg:min-h-[72vh] lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-6">
        <div className="min-w-0 max-w-xl">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
            <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden>
              <circle cx="3.2" cy="5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="6.8" cy="5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            TESTNET · BASE SEPOLIA
          </p>
          <h1 className="mt-4 max-w-xl text-[2.375rem] font-semibold leading-[1.05] tracking-[-0.035em] text-[#0A0219] [overflow-wrap:anywhere] sm:text-[3rem] lg:text-[3.5rem]">
            Pay on time, and the next deal gets easier.
          </h1>
          <p className="mt-6 max-w-[38.75rem] text-[18px] font-normal leading-[1.5] text-neutral-600">
            TRACE uses your onchain financial history to build a reputation that can unlock better
            ways to pay over time.
          </p>
          <p className="mt-3 max-w-[38.75rem] text-[15px] font-normal leading-[1.5] text-neutral-500">
            Buy now. Pay over time. Build a financial reputation as you go.
          </p>
          <p className="mt-3 max-w-[38.75rem] text-[13px] font-medium leading-[1.4] text-neutral-400">
            Alex is TRACE&apos;s autonomous BNPL agent. Sibyl provides the persistent memory that
            lets Alex remember your financial history across sessions.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/buy"
              className="inline-flex h-12 items-center rounded-full bg-[#7828E8] px-7 text-[15px] font-semibold text-white shadow-[0_12px_32px_rgba(120,40,232,0.28)] hover:bg-[#6a1fd4]"
            >
              Launch App
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center rounded-full border border-black/10 px-6 text-[15px] font-medium text-neutral-900 hover:bg-black/5"
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
        <section className="scroll-mt-28">
          <h2 className="text-[2rem] font-semibold leading-[1.15] tracking-[-0.02em] text-neutral-900 sm:text-[2.25rem]">Your history doesn&apos;t disappear.</h2>
          <p className="mt-4 max-w-[38.75rem] text-[15px] font-normal leading-[1.5] text-neutral-600 sm:text-base">
            Sibyl Memory carries your financial history across sessions, so TRACE doesn&apos;t start
            from zero every time.
          </p>
          <p className="mt-4 max-w-[38.75rem] text-[15px] font-normal leading-[1.5] text-neutral-600 sm:text-base">
            Your past behavior can change your next offer.
          </p>
        </section>

        <section className="mt-16">
          <h2 className="text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.02em] text-neutral-900 sm:text-[1.75rem]">Without memory, you start from zero.</h2>
          <p className="mt-4 max-w-[38.75rem] text-[15px] font-normal leading-[1.5] text-neutral-600">
            Delete Sibyl Memory and TRACE loses the financial history behind your previous offers.
          </p>
          <p className="mt-4 max-w-[38.75rem] text-[15px] font-normal leading-[1.5] text-neutral-600">
            With Sibyl Memory, previous behavior can influence what you&apos;re offered next.
          </p>
        </section>

        <section id="agent-status" className="mt-16 scroll-mt-28">
          <h2 className="text-[1.125rem] font-semibold leading-[1.2] tracking-[-0.02em] text-neutral-900 sm:text-[1.25rem]">Available to spend, in total</h2>
          <p className="mt-2 max-w-[38.75rem] text-[13px] font-normal leading-[1.45] text-neutral-500">
            Live testnet figures. Testnet only — no real goods or loans are provided.
          </p>
          {status ? (
            <dl className="glass-panel mt-6 divide-y divide-[#E8E7EC] px-6">
              {(
                [
                  ["Agent account", status.address || "—"],
                  ["Network", "Base Sepolia testnet"],
                  ["Available to spend", formatUsd(status.spendable_usd)],
                  ["Upcoming payments, in total", formatUsd(status.outstanding_exposure)],
                  ["Deployable after reserve", formatUsd(status.deployable)],
                  ["Purchase payouts", status.execute ? "Live on Base Sepolia" : "Simulated on this testnet"],
                  ["Purchases on file", String(status.total_purchases)],
                  ["People TRACE has seen before", String(status.wallets_with_history)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex flex-wrap justify-between gap-2 py-2.5">
                  <dt className="text-[13px] text-neutral-500">{k}</dt>
                  <dd className={`text-[14px] font-medium leading-[1.4] text-neutral-900 sm:text-[15px] ${String(v).startsWith("0x") ? "font-mono text-[12px] sm:text-[13px]" : "tabular-nums"}`}>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-6 text-sm text-red-600">{statusError}</p>
          )}
        </section>
      </article>
    </AppShell>
  );
}
