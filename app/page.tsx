import Link from "next/link";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { TraceArc } from "@/components/TraceArc";
import { readAgentWalletFile } from "@/lib/agent-wallet-file";

export default function HomePage() {
  const wallet = readAgentWalletFile();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-5 pb-24 pt-10 text-center">
        <Logo className="w-full max-w-md" />
        <p className="mt-2 max-w-md text-lg font-medium tracking-tight text-paper sm:text-xl">
          A lending agent that remembers.
        </p>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-paper-300">
          Alex quotes supply and borrow terms from its own memory of loans it originated with your
          wallet — repayments, lates, defaults, overrides. On-chain history is only a conservative
          baseline for wallets it has never lent to. Delete Sibyl and it forgets.
        </p>

        <Link href="/lend" className="btn-trace mt-8 h-11 px-8">
          Open Alex
        </Link>

        {wallet ? (
          <p className="mt-6 font-mono text-xs text-paper-500">
            Agent {wallet.address}
            <span className="text-paper-500"> · {wallet.network}</span>
          </p>
        ) : null}

        <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
          {[
            {
              t: "Memory first",
              d: "Rate and limit are f(loans this agent made with you). Chain age and tx count cannot reconstruct that book.",
            },
            {
              t: "On-chain is fallback",
              d: "New wallets get conservative terms from a fresh on-chain read. After one on-time repayment, relationship memory dominates.",
            },
            {
              t: "Hard ceiling",
              d: "MAX_BORROW_AMOUNT and MIN_COLLATERAL_RATIO are checked before scoring. Score and the LLM cannot override them.",
            },
          ].map((card) => (
            <article key={card.t} className="panel p-5">
              <h2 className="text-base font-medium">{card.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-300">{card.d}</p>
            </article>
          ))}
        </div>

        <TraceArc className="mt-14 w-40" />
      </main>
    </div>
  );
}
