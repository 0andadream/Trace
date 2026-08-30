"use client";

import { useEffect, useState } from "react";
import { TxLink } from "@/components/TxLink";
import { AgentIdentityCard, ViewOnVirtuals } from "@/components/AlexIdentity";
import { settlementPayoutLabel } from "@/lib/bnpl/execute";
import { formatAmount } from "@/lib/format";
import type { AcpJobRecord } from "@/types/bnpl";

type Infra = {
  sibyl: { connected: boolean; loadBearing: boolean };
  virtuals: {
    profileRegistered: boolean;
    profileWallet?: string | null;
    offerings: number;
    jobEndpoint: boolean;
    inboundHandled: number;
    marketplaceListener: boolean;
    sepoliaContractReachable: boolean;
    sepoliaJobCounter?: string;
    lastJob?: AcpJobRecord | null;
    statusLabel: string;
    verifyUrl: string;
  };
  base: { connected: boolean; execute: boolean; payoutLabel?: string; network: string };
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">ACP settlement job</p>
      <p className="mt-1 text-[14px] font-semibold text-neutral-900">{job.offering}</p>
      <p className="text-[13px] tabular-nums text-neutral-600">{formatAmount(job.metadata?.amount ?? 0)}</p>
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

export function AgentInfrastructure({
  job,
  execute: executeHint = null,
}: {
  job?: AcpJobRecord | null;
  execute?: boolean | null;
}) {
  const [infra, setInfra] = useState<Infra | null>(null);
  const [execute, setExecute] = useState<boolean | null>(executeHint);

  useEffect(() => {
    let live = true;
    fetch("/api/agent-status")
      .then((r) => r.json())
      .then((d) => {
        if (live && typeof d.execute === "boolean") setExecute(d.execute);
      })
      .catch(() => {});
    fetch("/api/virtuals")
      .then((r) => r.json())
      .then((d) => {
        if (live && !d.error) {
          setInfra(d as Infra);
          if (typeof d.base?.execute === "boolean") setExecute(d.base.execute);
        }
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
            <Dot on={Boolean(infra?.virtuals.profileRegistered)} />
            Virtuals
          </dt>
          <dd className="mt-0.5 space-y-2 pl-4 text-[12px] text-neutral-500">
            <p>
              {infra?.virtuals.profileRegistered
                ? "Agent registered on Virtuals ACP"
                : infra
                  ? "Registry not confirmed"
                  : "Checking…"}
            </p>
            {infra?.virtuals.profileWallet ? (
              <p className="break-all font-mono text-[11px]">{infra.virtuals.profileWallet}</p>
            ) : null}
            <p>
              Job offerings listed: {infra ? String(infra.virtuals.offerings) : "—"}
            </p>
            <p>
              {infra?.virtuals.marketplaceListener
                ? "Marketplace listener connected"
                : "Marketplace listener not connected"}
            </p>
            <p>
              {infra?.virtuals.jobEndpoint
                ? `TRACE ACP job endpoint live · ${infra.virtuals.inboundHandled} inbound job${infra.virtuals.inboundHandled === 1 ? "" : "s"} recorded`
                : "TRACE ACP job endpoint off"}
            </p>
            {infra?.virtuals.statusLabel ? (
              <p className="leading-5 text-neutral-600">{infra.virtuals.statusLabel}</p>
            ) : null}
            <div className="pt-1">
              <AgentIdentityCard />
            </div>
            {shown ? <JobCard job={shown} /> : null}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
            <Dot on={execute === true} />
            Base
          </dt>
          <dd className="mt-0.5 pl-4 text-[12px] text-neutral-500">
            {execute == null ? "Checking settlement…" : settlementPayoutLabel(execute)}
            {infra ? ` · ${infra.base.network}` : ""}
            {infra?.virtuals.sepoliaContractReachable
              ? ` · ACP contract reachable${infra.virtuals.sepoliaJobCounter ? ` (network jobCounter ${infra.virtuals.sepoliaJobCounter})` : ""}`
              : ""}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex min-w-0 flex-wrap gap-x-4 gap-y-1">
        <ViewOnVirtuals label="View Alex on Virtuals" />
        {infra?.virtuals.verifyUrl ? (
          <a
            href={infra.virtuals.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-[12px] font-medium text-neutral-500 hover:text-neutral-800 hover:underline"
          >
            Sepolia ACP contract
          </a>
        ) : null}
      </div>
    </section>
  );
}
