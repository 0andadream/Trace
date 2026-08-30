"use client";

import { useEffect, useState } from "react";
import { TxLink } from "@/components/TxLink";
import { formatAmount } from "@/lib/format";
import type { AcpJobRecord } from "@/types/bnpl";

type Infra = {
  sibyl: { connected: boolean; loadBearing: boolean };
  virtuals: {
    agentRegistered: boolean;
    acpEnabled: boolean;
    reachable: boolean;
    jobCounter?: string;
    lastJob?: AcpJobRecord | null;
    reason?: string;
    verifyUrl: string;
  };
  base: { connected: boolean; execute: boolean; network: string };
};

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-neutral-300"}`}
      aria-hidden
    />
  );
}

function JobCard({ job }: { job: AcpJobRecord }) {
  const created = job.status === "created" || job.status === "executed";
  const executed = job.status === "executed";
  const hash = job.executeTxHash || job.createTxHash;
  return (
    <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">ACP job</p>
      <p className="mt-1 text-[14px] font-semibold text-neutral-900">{job.offering}</p>
      <p className="text-[13px] tabular-nums text-neutral-600">
        {formatAmount(job.metadata?.amount ?? 0)}
      </p>
      <ul className="mt-2 space-y-0.5 text-[12px] text-neutral-600">
        <li>{created ? "✓" : "○"} Job created{job.jobId ? ` · ${job.jobId}` : ""}</li>
        <li>{executed ? "✓ Job executed" : job.status === "failed" ? "× Job failed" : "○ Job executed"}</li>
      </ul>
      {hash ? (
        <p className="mt-2 font-mono text-[11px] text-neutral-500">
          <TxLink hash={hash} className="text-[11px]" />
        </p>
      ) : job.reason ? (
        <p className="mt-2 text-[12px] text-neutral-500">{job.reason}</p>
      ) : null}
    </div>
  );
}

export function AgentInfrastructure({ job }: { job?: AcpJobRecord | null }) {
  const [infra, setInfra] = useState<Infra | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/virtuals")
      .then((r) => r.json())
      .then((d) => {
        if (live && !d.error) setInfra(d as Infra);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [job?.jobId, job?.status]);

  const shown = job || infra?.virtuals.lastJob || null;

  return (
    <section className="glass-panel p-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        Agent infrastructure
      </h2>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
            <Dot on={Boolean(infra?.sibyl.connected && infra.sibyl.loadBearing)} />
            Sibyl
          </dt>
          <dd className="mt-0.5 pl-4 text-[12px] text-neutral-500">
            {infra?.sibyl.loadBearing ? "Memory connected" : infra ? "Memory unreachable" : "Checking…"}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
            <Dot on={Boolean(infra?.virtuals.reachable)} />
            Virtuals
          </dt>
          <dd className="mt-0.5 space-y-0.5 pl-4 text-[12px] text-neutral-500">
            <p>{infra?.virtuals.agentRegistered ? "Agent registered" : "Agent address unpublished"}</p>
            <p>{infra?.virtuals.acpEnabled ? "ACP enabled" : infra?.virtuals.reason || "ACP unreachable"}</p>
            {infra?.virtuals.jobCounter != null ? (
              <p className="font-mono text-[11px]">jobCounter {infra.virtuals.jobCounter}</p>
            ) : null}
          </dd>
          {shown ? <JobCard job={shown} /> : null}
        </div>
        <div>
          <dt className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
            <Dot on={Boolean(infra?.base.connected)} />
            Base
          </dt>
          <dd className="mt-0.5 pl-4 text-[12px] text-neutral-500">
            {infra?.base.execute ? "Settlement connected" : "Settlement simulated on this host"}
            {infra ? ` · ${infra.base.network}` : ""}
          </dd>
        </div>
      </dl>
      {infra?.virtuals.verifyUrl ? (
        <a
          href={infra.virtuals.verifyUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-[12px] font-medium text-[#7828E8] hover:underline"
        >
          Verify ACP contract →
        </a>
      ) : null}
    </section>
  );
}
