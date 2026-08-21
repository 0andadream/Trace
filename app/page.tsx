import Link from "next/link";
import { FlowStrip } from "@/components/FlowStrip";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-20 pt-14">
        <Logo className="h-16 w-16 sm:h-20 sm:w-20" />
        <p className="mono-label mt-6 text-trace">Treasury agent · memory-grounded</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-medium tracking-tight sm:text-6xl">Trace</h1>
        <p className="mt-4 max-w-2xl text-lg uppercase tracking-tight text-paper">
          Alex does not guess.
          <br />
          Alex reads memory,
          <br />
          then decides.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-paper-300">
          An autonomous treasury agent. Every request is scored against persistent operating history:
          agent reputation, the counterparty profile, and a risk score from 0 to 1. Code applies the
          policy. Alex writes the reasoning.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/desk" className="btn-trace h-11 px-6">
            Open desk
          </Link>
          <Link href="/memory" className="btn-ghost h-11 px-6">
            View memory
          </Link>
          <Link href="/developers" className="btn-ghost h-11 px-6">
            Developers
          </Link>
        </div>

        <div className="mt-12">
          <FlowStrip />
        </div>

        <section className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            {
              k: "Memory",
              t: "Three blocks, always",
              d: "AGENT_REPUTATION, COUNTERPARTY_PROFILE, RISK_SCORE. If the profile is empty, Alex says so. No invented history.",
            },
            {
              k: "Policy",
              t: "Proceed · Flag · Hold",
              d: "Risk < 0.30 proceeds. 0.30–0.60 proceeds with a flag. Above 0.60 holds for approval. The model cannot change this.",
            },
            {
              k: "Record",
              t: "History updates the next call",
              d: "Approving a Hold is a user override. The next request to that counterparty is a different decision.",
            },
          ].map((card) => (
            <article key={card.k} className="panel p-5">
              <div className="mono-label text-trace">{card.k}</div>
              <h2 className="mt-2 text-lg">{card.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-300">{card.d}</p>
            </article>
          ))}
        </section>

        <section className="panel mt-8 p-5">
          <div className="mono-label">Principle</div>
          <p className="mt-3 text-xl tracking-tight">Memory decides. Alex reports.</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-300">
            Thin history is a risk factor. Unknown counterparties are held. High user-override rates
            defer to you. Alex is a treasury tool, not a chatbot.
          </p>
        </section>
      </main>
    </div>
  );
}
