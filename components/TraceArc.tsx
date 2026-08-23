import { useId } from "react";

type TraceArcProps = {
  className?: string;
};

export function TraceArc({ className = "w-40" }: TraceArcProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 200 44"
      className={className}
      fill="none"
      aria-hidden
      overflow="visible"
    >
      <defs>
        <linearGradient id={`arc-${id}`} x1="0" x2="200" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7828E8" stopOpacity="0.35" />
          <stop offset="0.18" stopColor="#7828E8" stopOpacity="1" />
          <stop offset="0.82" stopColor="#7828E8" stopOpacity="1" />
          <stop offset="1" stopColor="#7828E8" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M10 8 Q100 42 190 8"
        stroke={`url(#arc-${id})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeDasharray="8 9"
      />
    </svg>
  );
}
