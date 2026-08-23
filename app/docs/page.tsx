import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function DocsPage() {
  return (
    <AppShell>
      <article className="glass-panel max-w-2xl space-y-8 rounded-2xl p-8 text-sm leading-relaxed text-neutral-600">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">Docs</h1>
          <p className="mt-2">
            Trace is buy now, pay later on Base Sepolia. Alex sends you ETH (shown as USDC). You pay Alex back in
            parts. Your deal depends on whether you paid on time last time, not on a credit score.
            The home page at{" "}
            <Link href="/" className="text-[#7828E8]">
              /
            </Link>{" "}
            says what is real on this testnet and what is pretend.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-neutral-900">Try it</h2>
          <p className="mt-2">
            Open Buy, connect (that is your login), enter an amount, and ask. First time? You start
            small. Pay it back from My History.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-neutral-900">What Alex remembers</h2>
          <p className="mt-2">
            What you bought here, when payments were due, and whether you paid on time, late, or
            missed. Not your name. Not your email.
          </p>
        </div>
      </article>
    </AppShell>
  );
}
