import Link from "next/link";
import { FlowStrip } from "@/components/FlowStrip";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { TraceArc } from "@/components/TraceArc";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-5 pb-20 pt-10">
        <Logo className="w-full max-w-md" />
        <p className="mono-label -mt-2 text-trace">Treasury agent · Sibyl Memory</p>
        <p className="mt-6 max-w-xl text-center text-lg font-medium tracking-tight text-paper sm:text-2xl">
          Alex does not guess.
          <br />
          Alex reads memory, then decides.
        </p>
        <p className="mt-4 max-w-xl text-center text-sm leading-relaxed text-paper-300">
          An autonomous treasury agent. Every request is scored against Sibyl Memory: agent
          reputation, the counterparty profile, and a risk score from 0 to 1. Code applies the
          policy. Alex writes the reasoning. Delete the Sibyl database and the agent forgets.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
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

        <div className="mt-14 w-full">
          <FlowStrip />
        </div>

        <section className="mt-14 grid w-full gap-4 md:grid-cols-3">
          {[
            {
              k: "Memory",
              t: "Three blocks, always",
              d: "Sibyl WARM entities + COLD journal. AGENT_REPUTATION, COUNTERPARTY_PROFILE, RISK_SCORE. If the profile is empty, Alex says so.",
            },
            {
              k: "Policy",
              t: "Proceed · Flag · Hold",
              d: "Risk < 0.30 proceeds. 0.30–0.60 proceeds with a flag. Above 0.60 holds for approval. The model cannot change this.",
            },
            {
              k: "Record",
              t: "History updates the next call",
              d: "Approving a Hold is a user override written to Sibyl. Restart the process: the next request to that counterparty is a different decision.",
            },
          ].map((card) => (
            <article key={card.k} className="panel p-5">
              <div className="mono-label text-trace">{card.k}</div>
              <h2 className="mt-2 text-lg font-medium">{card.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-300">{card.d}</p>
            </article>
          ))}
        </section>

        <section className="panel mt-8 w-full p-6 text-center sm:p-8">
          <div className="mono-label">Principle</div>
          <p className="mt-3 text-xl font-medium tracking-tight sm:text-2xl">Memory decides. Alex reports.</p>
          <TraceArc className="mx-auto mt-4 w-36" />
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-paper-300">
            Thin history is a risk factor. Unknown counterparties are held. High user-override rates
            defer to you. Alex is a treasury tool, not a chatbot.
          </p>
        </section>
      </main>
    </div>
  );
}
