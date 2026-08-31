import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <AppShell>
      <article className="glass-panel mx-auto max-w-2xl space-y-6 rounded-2xl p-8 text-sm leading-relaxed text-neutral-600">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">Legal</p>
          <h1 className="mt-2 text-lg font-semibold tracking-tight text-neutral-900">Terms of Service</h1>
        </div>
        <p>
          Trace runs on Base Sepolia testnet. It is not a loan, a credit product, or an offer of
          financial services. The dollars shown here are testnet tokens. You cannot lose real funds
          through this app.
        </p>
        <p>
          Alex may say yes or no to a purchase based on its own notes about you and its remaining
          cash. Those decisions are for this testnet. They are not credit underwriting and they do
          not create a debt you owe in the real world.
        </p>
        <p>
          By using Trace you agree that this is experimental software on a practice network. Do not
          send mainnet assets here.
        </p>
        <p>
          Questions: start at the{" "}
          <Link href="/" className="text-[#7828E8]">
            home page
          </Link>{" "}
          or{" "}
          <Link href="/docs" className="text-[#7828E8]">
            Docs
          </Link>
          .
        </p>
      </article>
    </AppShell>
  );
}
