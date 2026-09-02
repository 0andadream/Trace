import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AgentInfrastructure } from "@/components/AgentInfrastructure";
import { DemoRun } from "@/components/DemoRun";
import { payoutIsLive } from "@/lib/bnpl/execute";

export const dynamic = "force-dynamic";

export default function DemoPage() {
  const started = new Date().toISOString();
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7828E8]">
          Judge demo
        </p>
        <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.03em] text-neutral-900">
          Sibyl remembers. Virtuals acts. Base settles.
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-neutral-600">
          TRACE is a memory-powered BNPL agent. Click Run the demo to execute the real purchase →
          payout → repay → second quote loop with an agent-controlled test wallet. Session started{" "}
          <span className="font-mono text-[13px] text-neutral-800">{started}</span>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/buy"
            className="inline-flex h-10 items-center rounded-full bg-[#7828E8] px-5 text-[14px] font-semibold text-white"
          >
            Open Buy
          </Link>
          <Link
            href="/log"
            className="inline-flex h-10 items-center rounded-full border border-black/10 px-5 text-[14px] font-medium text-neutral-800"
          >
            Agent log
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-10 items-center rounded-full border border-black/10 px-5 text-[14px] font-medium text-neutral-800"
          >
            Docs
          </Link>
        </div>
        <div className="mt-10">
          <DemoRun />
        </div>
        <div className="mt-10">
          <AgentInfrastructure execute={payoutIsLive()} />
        </div>
      </div>
    </AppShell>
  );
}
