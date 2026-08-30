import { ALEX_ACP_AGENT_ID, ALEX_ACP_PROFILE_URL } from "@/lib/virtuals/identity";

function ExternalMark() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden>
      <path
        d="M3.5 3.5h5v5M8.5 3.5 3.5 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VirtualsAcpBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-neutral-600 ring-1 ring-black/5 ${className}`}
    >
      Virtuals ACP Agent
    </span>
  );
}

export function ViewOnVirtuals({
  label = "View on Virtuals",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={ALEX_ACP_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-[12px] font-medium text-[#7828E8] hover:underline ${className}`}
    >
      {label}
      <ExternalMark />
    </a>
  );
}

/** Compact row under Alex’s introduction. */
export function AlexVerificationRow() {
  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-[1.4] text-neutral-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="text-emerald-600" aria-hidden>
          ✓
        </span>
        Registered on Virtuals ACP
      </span>
      <ViewOnVirtuals />
    </div>
  );
}

/** Detail block for the existing agent/infrastructure card. */
export function AgentIdentityCard() {
  return (
    <div className="rounded-xl bg-black/[0.03] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Agent identity</p>
      <p className="mt-1 text-[13px] font-medium text-neutral-900">Virtuals ACP</p>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Agent ID</p>
      <p className="mt-0.5 break-all font-mono text-[11px] leading-[1.45] text-neutral-600">{ALEX_ACP_AGENT_ID}</p>
      <ViewOnVirtuals label="View verified agent" className="mt-2" />
    </div>
  );
}

/** Architecture strip for How it works. Not a Virtuals-owned stack. */
export function AgentRoleStack() {
  const rows: { label: string; note?: string; badge?: boolean }[] = [
    { label: "User" },
    { label: "TRACE" },
    { label: "Alex — autonomous agent", badge: true },
    { label: "Sibyl Memory / risk context" },
    { label: "BNPL decision" },
    { label: "On-chain execution", note: "Base Sepolia" },
  ];
  return (
    <ol className="mt-4 space-y-0">
      {rows.map((row, i) => (
        <li key={row.label} className="min-w-0">
          {i > 0 ? (
            <div className="flex justify-center py-1" aria-hidden>
              <span className="text-[11px] leading-none text-neutral-300">↓</span>
            </div>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-neutral-900">{row.label}</p>
              {row.note ? <p className="text-[11px] text-neutral-500">{row.note}</p> : null}
            </div>
            {row.badge ? <VirtualsAcpBadge /> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
