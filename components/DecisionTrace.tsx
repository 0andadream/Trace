import { formatAmount } from "@/lib/format";
import { ALEX_ACP_AGENT_ID } from "@/lib/virtuals/identity";
import type { PolicyPrimary } from "@/types/bnpl";

export function DecisionTrace({
  primary,
  standing,
  limit,
  installments,
  interestRate,
  keysRead,
  keysWritten,
  txHash,
  acpJobId,
}: {
  primary: PolicyPrimary;
  standing: number;
  limit: number;
  installments: number;
  interestRate?: number;
  keysRead: string;
  keysWritten?: string;
  txHash?: string | null;
  acpJobId?: string | null;
}) {
  return (
    <dl className="rounded-xl bg-black/[0.03] px-4 py-3 font-mono text-[11px] leading-[1.55] text-neutral-700 ring-1 ring-black/5">
      <div>
        inputs: <span className="text-neutral-900">{primary}</span>
      </div>
      <div>keys read: {keysRead}</div>
      {keysWritten ? <div>keys written: {keysWritten}</div> : null}
      <div>
        standing {standing.toFixed(2)} · limit {formatAmount(limit)} · installments {installments}
        {interestRate != null ? ` · interest ${Math.round(interestRate * 100)}%` : ""}
      </div>
      <div>
        virtuals: Alex {ALEX_ACP_AGENT_ID}
        {acpJobId ? ` · job ${acpJobId}` : " · identity request"}
      </div>
      {txHash ? <div className="break-all">tx {txHash}</div> : null}
    </dl>
  );
}

export function PartnerColumns({
  remembered,
  requested,
  settled,
}: {
  remembered: string;
  requested: string;
  settled: string;
}) {
  const cols = [
    ["Sibyl remembered", remembered],
    ["Alex requested", requested],
    ["Base settled", settled],
  ] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cols.map(([k, v]) => (
        <div key={k} className="rounded-2xl bg-black/[0.03] p-4 ring-1 ring-black/5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{k}</p>
          <p className="mt-2 text-[13px] leading-5 text-neutral-800">{v}</p>
        </div>
      ))}
    </div>
  );
}
