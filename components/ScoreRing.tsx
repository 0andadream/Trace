export function ScoreRing({ score }: { score: number | null }) {
  const r = 56;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const live = score != null;

  return (
    <div
      className={`score-object relative inline-flex h-32 w-32 items-center justify-center ${live ? "score-object-live" : ""}`}
    >
      <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 128 128" aria-hidden>
        <circle
          cx="64"
          cy="64"
          r={r}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray="7 8"
          className="text-black/10"
        />
        <circle
          cx="64"
          cy="64"
          r={r}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} ${100 - pct}`}
          className="text-[#7828E8] transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tabular-nums tracking-tight text-neutral-900">
          {score == null ? "—" : Math.round(score)}
        </span>
        <span className="text-[11px] font-medium text-neutral-500">Score</span>
      </div>
    </div>
  );
}
