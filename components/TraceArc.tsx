import { useId } from "react";

type TraceArcProps = {
  className?: string;
};

export function TraceArc({ className = "w-40" }: TraceArcProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 28" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id={`arc-${id}`} x1="0" x2="200" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7828E8" stopOpacity="0.12" />
          <stop offset="0.22" stopColor="#7828E8" stopOpacity="1" />
          <stop offset="0.78" stopColor="#7828E8" stopOpacity="1" />
          <stop offset="1" stopColor="#7828E8" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <path
        d="M12 8 Q100 34 188 8"
        stroke={`url(#arc-${id})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="7 8"
      />
    </svg>
  );
}
