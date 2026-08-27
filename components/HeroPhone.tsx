import Link from "next/link";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TraceMark } from "@/components/Logo";
import { ScoreRing } from "@/components/ScoreRing";
import { formatAmount, shortAddress } from "@/lib/format";

export type HeroLive = {
  spendable: number | null;
  owed: number | null;
  purchases: number | null;
  people: number | null;
  deployable: number | null;
  reserve: number | null;
  address: string | null;
  execute: boolean;
  simulated: boolean;
  error: string | null;
};

function money(n: number | null) {
  return n == null ? "—" : formatAmount(n);
}

function count(n: number | null) {
  return n == null ? "—" : String(n);
}

function PhoneBuyScreen({ live }: { live: HeroLive }) {
  return (
    <div className="phone-buy flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 px-4 pb-3 pt-11">
        <span className="inline-flex min-w-0 items-center gap-2">
          <TraceMark size={22} />
          <span className="truncate text-[12px] font-semibold tracking-tight text-neutral-900">Trace</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#7828E8] px-2 py-0.5 text-[8px] font-semibold text-white">
          <span className="h-1 w-1 rounded-full bg-white" aria-hidden />
          Testnet
        </span>
      </header>

      <div className="px-2.5">
        <div className="overflow-hidden rounded-[1.15rem] bg-white ring-1 ring-[#E8E7EC]">
          <div className="grid grid-cols-2 divide-x divide-y divide-[#E8E7EC]">
            {(
              [
                ["Available", money(live.spendable)],
                ["Upcoming", money(live.owed)],
                ["Purchases", count(live.purchases)],
                ["People on file", count(live.people)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="px-3 py-3">
                <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-neutral-500">{label}</p>
                <p className="mt-1 text-[15px] font-semibold tabular-nums tracking-tight text-neutral-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-[1] -mt-2 flex min-h-0 flex-1 flex-col px-2.5">
        <div className="flex min-h-0 flex-1 flex-col rounded-[1.35rem] bg-white px-4 pb-4 pt-4 shadow-[0_16px_40px_rgba(15,15,30,0.08)] ring-1 ring-[#E8E7EC]">
          <h2 className="text-[12px] font-semibold tracking-tight text-neutral-900">Your TRACE reputation</h2>
          <div className="mt-5 flex flex-1 flex-col items-center justify-center">
            <ScoreRing score={null} size="sm" />
            <span className="mt-3 rounded-full border border-amber-300/60 bg-amber-100 px-3 py-1 text-[9px] font-medium text-amber-800 shadow-sm">
              CONNECT WALLET
            </span>
            <p className="mt-4 max-w-[16rem] text-center text-[10px] leading-4 text-neutral-500">
              Connect a wallet to load your TRACE reputation.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-black/5 pt-3">
            {(
              [
                ["TRACE limit", "—"],
                ["On-time rate", "—"],
                ["Purchases", "—"],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <p className="text-[7px] font-medium uppercase tracking-[0.1em] text-neutral-500">{k}</p>
                <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-neutral-900">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 px-4 pb-9">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.06] ring-1 ring-black/10">
              <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className="text-neutral-500">
                <circle cx="3.2" cy="5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="6.8" cy="5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </span>
            <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#0052FF] text-[7px] font-bold text-white ring-2 ring-white">
              B
            </span>
          </span>
          <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-neutral-500">Base Sepolia</span>
        </div>
      </div>
    </div>
  );
}

export function HeroPhone({ live }: { live: HeroLive }) {
  return (
    <div className="phone-stage phone-float">
      <div className="phone-stage-glow" aria-hidden />
      <Link href="/buy" className="relative z-[1] block" aria-label="Open Buy">
        <PhoneFrame>
          <PhoneBuyScreen live={live} />
        </PhoneFrame>
      </Link>
      <div className="phone-cash">
        <section className="glass-panel standing-hero p-6 sm:p-7" aria-label="Available to spend">
          <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-neutral-500">
            Available to spend
          </p>
          {live.error && live.deployable == null ? (
            <p className="mt-3 text-sm text-red-600">
              {/sibyl|redis|memory/i.test(live.error) ? "Sibyl unavailable. " : ""}
              {live.error}
            </p>
          ) : (
            <>
              <p className="mt-3 text-[2rem] font-semibold tabular-nums tracking-[-0.025em] text-neutral-900 sm:text-[2.5rem]">
                {money(live.deployable)}
              </p>
              <p className="mt-3 text-[13px] leading-6 text-neutral-600">
                After keeping a reserve ({money(live.reserve)}) so the book is not emptied.
                {live.simulated
                  ? " We could not check the agent account just now, so this number is a stand-in."
                  : ""}
                {live.execute ? "" : " Payouts are simulated on this testnet; the yes or no is still real."}{" "}
                {live.address ? (
                  <>
                    Agent{" "}
                    <span className="font-mono text-neutral-900">{shortAddress(live.address)}</span>.
                  </>
                ) : (
                  "Agent account is not shown here."
                )}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
