export function ScoreRing({ score, size = "md" }: { score: number | null; size?: "md" | "sm" }) {
  const px = size === "sm" ? 96 : 128;
  const r = 56;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const live = score != null;

  return (
    <div
      className={`score-object relative inline-flex items-center justify-center ${live ? "score-object-live" : ""}`}
      style={{ width: px, height: px }}
    >
      <svg className="-rotate-90 transform" width={px} height={px} viewBox="0 0 128 128" aria-hidden>
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
        <span
          className={`font-semibold tabular-nums tracking-tight text-neutral-900 ${
            size === "sm" ? "text-2xl" : "text-4xl"
          }`}
        >
          {score == null ? "—" : Math.round(score)}
        </span>
        <span className={`font-medium text-neutral-500 ${size === "sm" ? "text-[9px]" : "text-[11px]"}`}>Score</span>
      </div>
    </div>
  );
}
