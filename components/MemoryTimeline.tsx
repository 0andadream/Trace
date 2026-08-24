import type { TimelineEvent } from "@/lib/bnpl/relationship";

function formatWhen(iso: string, kind: TimelineEvent["kind"]) {
  if (kind === "now") return "Now";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MemoryTimeline({
  events,
  compact,
}: {
  events: TimelineEvent[];
  compact?: boolean;
}) {
  if (events.length === 0) return null;
  const shown = compact ? events.slice(-6) : events;
  return (
    <ol className={compact ? "space-y-2" : "space-y-3"}>
      {shown.map((e, i) => (
        <li key={`${e.at}-${e.kind}-${i}`} className="flex items-start gap-3">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              e.kind === "now"
                ? "bg-[#7828E8]"
                : e.kind === "default" || e.kind === "repay_late"
                  ? "bg-red-500"
                  : "bg-[#7828E8]/50"
            }`}
            aria-hidden
          />
          <p className={`min-w-0 leading-snug text-neutral-700 ${compact ? "text-[13px]" : "text-sm"}`}>
            <span className="font-medium text-neutral-500">{formatWhen(e.at, e.kind)}</span>
            <span className="text-neutral-400"> — </span>
            <span>{e.label}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
