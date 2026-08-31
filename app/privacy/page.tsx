import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <AppShell>
      <article className="glass-panel mx-auto max-w-2xl space-y-6 rounded-2xl p-8 text-sm leading-relaxed text-neutral-600">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">Legal</p>
          <h1 className="mt-2 text-lg font-semibold tracking-tight text-neutral-900">Privacy Policy</h1>
        </div>
        <p>
          Alex remembers what you bought here, when payments were due, and whether you paid on time,
          late, or not at all. It keys that file to your wallet address.
        </p>
        <p>It does not collect your name, email, or a credit-bureau file. There is no mailing list.</p>
        <p>
          First-time checks look at public on-chain activity for that wallet. That look is not saved
          as your history with Alex.
        </p>
        <p>
          This page is a stub for testnet. If the product ships on mainnet, this policy will
          be replaced with a real one. Until then, assume anything you do here is on a practice
          network and may be wiped.
        </p>
        <p>
          See also{" "}
          <Link href="/terms" className="text-[#7828E8]">
            Terms of Service
          </Link>
          .
        </p>
      </article>
    </AppShell>
  );
}
