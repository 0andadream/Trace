import type { StandingBreakdown } from "@/lib/bnpl/relationship";

function formatPts(n: number) {
  const abs = Math.abs(n);
  const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(/\.0$/, "");
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

export function ScoreBreakdown({
  breakdown,
  open = false,
}: {
  breakdown: StandingBreakdown | null;
  open?: boolean;
}) {
  if (!breakdown || breakdown.lines.length === 0) return null;
  const body = (
    <>
      <ul className="mt-3 space-y-1.5 font-mono text-[12px] leading-5 text-neutral-700">
        {breakdown.lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-3">
            <span className="min-w-0 font-sans text-neutral-600">{line.label}</span>
            <span
              className={`shrink-0 tabular-nums ${
                line.points < 0 ? "text-red-700" : line.points > 0 ? "text-neutral-900" : "text-neutral-500"
              }`}
            >
              {formatPts(line.points)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between border-t border-black/10 pt-2 font-mono text-[12px] font-semibold tabular-nums text-neutral-900">
        <span className="font-sans font-medium">Current score</span>
        <span>{breakdown.score}</span>
      </div>
    </>
  );
  if (open) {
    return (
      <div className="mt-4 w-full text-left">
        <p className="text-[12px] font-medium text-[#7828E8]">Why this score?</p>
        {body}
      </div>
    );
  }
  return (
    <details className="mt-4 w-full max-w-xs text-left">
      <summary className="cursor-pointer text-[12px] font-medium text-[#7828E8] hover:underline">
        Why this score?
      </summary>
      {body}
    </details>
  );
}
