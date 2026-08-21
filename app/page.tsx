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
          A treasury agent that remembers.
        </p>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-paper-300">
          Alex decides whether a payment can go out. It reads operating history from Sibyl Memory —
          who it has paid, what failed, what you overrode — then answers Proceed, Flag, or Hold.
          It does not chat. It does not connect a wallet. It signs with its own key.
        </p>

        <Link href="/alex" className="btn-trace mt-8 h-11 px-8">
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
              d: "Every decision is grounded in Sibyl. Empty counterparty means it says so. Delete the store and it forgets.",
            },
            {
              t: "Hold strangers",
              d: "Unknown recipients and thin history hold for your approval. Approving writes an override into memory.",
            },
            {
              t: "Hard ceiling",
              d: "Amounts over MAX_TX_AMOUNT_USDC are blocked before scoring. That is not a Hold. Nothing broadcasts.",
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
