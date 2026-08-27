import { formatAmount } from "@/lib/format";
import { TxLink } from "@/components/TxLink";

export function PayoutNotice({
  amountUsd,
  hash,
  live,
  example = false,
  className = "",
}: {
  amountUsd?: number;
  hash?: string | null;
  live?: boolean;
  example?: boolean;
  className?: string;
}) {
  const amount = amountUsd != null ? formatAmount(amountUsd) : "$150";

  if (example) {
    return (
      <div
        className={`mt-4 flex items-start gap-2.5 rounded-xl bg-black/[0.04] px-3 py-2.5 text-sm text-neutral-600 ring-1 ring-black/10 ${className}`}
      >
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-400 text-[10px] font-bold text-white">
          i
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-neutral-400">Walkthrough</p>
          <p className="mt-0.5 font-medium text-neutral-800">
            If eligible, TRACE finances this {amount} purchase on testnet.
          </p>
          <p className="mt-1 text-[12px] leading-4 text-neutral-500">
            This screen is not a receipt. A real purchase includes a Base Sepolia explorer link.
          </p>
        </div>
      </div>
    );
  }

  if (live && hash) {
    return (
      <div
        className={`rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200/80 ${className}`}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
            ✓
          </span>
          <div className="min-w-0">
            <p className="font-medium">
              Purchase financed · {amount}
            </p>
            <p className="mt-1 break-all text-[12px]">
              <TxLink hash={hash} />
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl bg-neutral-100 px-3 py-2.5 text-sm text-neutral-600 ring-1 ring-black/10 ${className}`}
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-400 text-[10px] font-bold text-white">
        ~
      </span>
      <div className="min-w-0">
        <p className="font-medium text-neutral-700">
          Simulated: this {amount} purchase is not financed on this testnet
        </p>
      </div>
    </div>
  );
}
