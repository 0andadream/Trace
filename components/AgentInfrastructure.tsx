"use client";

import { useEffect, useState } from "react";
import { ViewOnVirtuals } from "@/components/AlexIdentity";
import { settlementPayoutLabel } from "@/lib/bnpl/execute";
import { ALEX_ACP_AGENT_ID } from "@/lib/virtuals/identity";
import type { AcpJobRecord } from "@/types/bnpl";

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-neutral-300"}`}
      aria-hidden
    />
  );
}

export function AgentInfrastructure({
  execute: executeHint = null,
}: {
  job?: AcpJobRecord | null;
  execute?: boolean | null;
}) {
  const [execute, setExecute] = useState<boolean | null>(executeHint);

  useEffect(() => {
    let live = true;
    fetch("/api/agent-status")
      .then((r) => r.json())
      .then((d) => {
        if (live && typeof d.execute === "boolean") setExecute(d.execute);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="glass-panel p-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        Agent infrastructure
      </h2>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
            <Dot on />
            Sibyl
          </dt>
          <dd className="mt-0.5 pl-4 text-[12px] text-neutral-500">Memory layer active</dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
            <Dot on />
            Virtuals
          </dt>
          <dd className="mt-0.5 space-y-2 pl-4 text-[12px] text-neutral-500">
            <p>
              <span className="text-emerald-600" aria-hidden>
                ✓
              </span>{" "}
              Agent registered
            </p>
            <p>Virtuals ACP identity</p>
            <div className="rounded-xl bg-black/[0.03] px-3 py-3">
              <p className="text-[13px] font-medium text-neutral-900">Alex · TRACE Agent</p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Agent ID</p>
              <p className="mt-0.5 break-all font-mono text-[11px] leading-[1.45] text-neutral-600">
                {ALEX_ACP_AGENT_ID}
              </p>
              <ViewOnVirtuals label="View verified agent" className="mt-2" />
            </div>
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
            <Dot on={execute === true} />
            Base
          </dt>
          <dd className="mt-0.5 pl-4 text-[12px] text-neutral-500">
            {execute == null ? "Checking settlement…" : settlementPayoutLabel(execute)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
